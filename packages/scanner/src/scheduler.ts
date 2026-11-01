import cron from 'node-cron';
import type { ScanResult } from './types.js';
import { scoreScan } from './scoring.js';

export interface DbOperations {
  listSites(): Array<{ id: number; fqdn: string; scan_interval_seconds: number; is_active: number; retention_days: number }>;
  getScan(id: number): { id: number; status: string } | undefined;
  createScan(siteId: number, pageUrl: string): { id: number; site_id: number; page_url: string; status: string };
  completeScan(scanId: number, status: string, detectionCount: number, scriptsAnalyzed: number, errorMessage?: string): void;
  insertDetection(det: {
    scan_id: number; site_id: number; category: string; signal_name: string;
    weight: number; source_script_url?: string | null; source_script_hash?: string | null;
    stack_trace?: string | null; initiator_chain?: string | null; details?: string | null;
    ad_slot_id?: number | null; count?: number; source_url_spoofed?: number;
  }): number;
  insertScanScript(ss: {
    scan_id: number; site_id: number; script_url: string; script_hash?: string | null;
    initiator_chain?: string | null; signal_count: number; category_count: number;
    categories: string; weight_sum: number; effective_weight_sum: number;
    threat_score: number; is_vendor_allowlisted: number; source_url_spoofed?: number;
  }): number;
  insertAdSlot(slot: {
    scan_id: number; site_id: number; provider: string; slot_id: string;
    creative_id?: string | null; advertiser_id?: string | null;
    advertiser_domain?: string | null; line_item_id?: string | null;
    bidder?: string | null; bid_price?: number | null;
    media_url?: string | null; wrapper_chain?: string | null; script_urls: string;
  }): number;
  getActiveAllowlistPatterns(): string[];
  runRetentionCleanup(): number;
}

type ScanFn = (siteId: number, pageUrl: string) => Promise<ScanResult>;

export async function runSiteScan(
  ops: DbOperations,
  scanFn: ScanFn,
  siteId: number,
  fqdn: string,
): Promise<void> {
  const pageUrl = `https://${fqdn}`;
  const scan = ops.createScan(siteId, pageUrl);

  try {
    const result = await scanFn(siteId, pageUrl);
    const allowlistPatterns = ops.getActiveAllowlistPatterns();

    const adSlotMap = new Map<number, { scriptUrls: string[] }>();
    for (const slot of result.adSlots) {
      const id = ops.insertAdSlot({
        scan_id: scan.id, site_id: siteId, provider: slot.provider,
        slot_id: slot.slotId, creative_id: slot.creativeId ?? null,
        advertiser_id: slot.advertiserId ?? null,
        advertiser_domain: slot.advertiserDomain ?? null,
        line_item_id: slot.lineItemId ?? null, bidder: slot.bidder ?? null,
        bid_price: slot.bidPrice ?? null, media_url: slot.mediaUrl ?? null,
        wrapper_chain: slot.wrapperChain ? JSON.stringify(slot.wrapperChain) : null,
        script_urls: JSON.stringify(slot.scriptUrls),
      });
      adSlotMap.set(id, { scriptUrls: slot.scriptUrls });
    }

    function findAdSlotForScript(scriptUrl: string): number | null {
      for (const [id, slot] of adSlotMap) {
        if (slot.scriptUrls.some(u => scriptUrl.includes(u) || u.includes(scriptUrl))) return id;
      }
      return null;
    }

    const dedupCounts = new Map<string, number>();
    for (const det of result.detections) {
      const key = `${det.signal}:${det.sourceScript ?? ''}`;
      dedupCounts.set(key, (dedupCounts.get(key) ?? 0) + 1);
    }

    const seen = new Set<string>();
    for (const det of result.detections) {
      const key = `${det.signal}:${det.sourceScript ?? ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      ops.insertDetection({
        scan_id: scan.id, site_id: siteId, category: det.category,
        signal_name: det.signal, weight: det.weight,
        source_script_url: det.sourceScript || null,
        stack_trace: det.stack || null,
        initiator_chain: result.scriptInitiators[det.sourceScript ?? '']
          ? JSON.stringify(result.scriptInitiators[det.sourceScript ?? ''])
          : null,
        details: Object.keys(det.details).length > 0 ? JSON.stringify(det.details) : null,
        ad_slot_id: findAdSlotForScript(det.sourceScript ?? ''), count: dedupCounts.get(key) ?? 1,
        source_url_spoofed: det.sourceURLSpoofed ? 1 : 0,
      });
    }

    const scores = scoreScan(result.detections, allowlistPatterns);
    for (const score of scores) {
      const chain = result.scriptInitiators[score.scriptUrl];
      ops.insertScanScript({
        scan_id: scan.id, site_id: siteId, script_url: score.scriptUrl,
        initiator_chain: chain ? JSON.stringify(chain) : null,
        signal_count: score.signalCount, category_count: score.categoryCount,
        categories: JSON.stringify(score.categories),
        weight_sum: score.weightSum, effective_weight_sum: score.effectiveWeightSum,
        threat_score: score.threatScore,
        is_vendor_allowlisted: score.isVendorAllowlisted ? 1 : 0,
        source_url_spoofed: score.sourceURLSpoofed ? 1 : 0,
      });
    }

    let status = 'completed';
    if (result.error) {
      status = result.error.includes('timed out') ? 'timeout' : 'failed';
    }
    ops.completeScan(scan.id, status, result.detections.length, result.scriptsAnalyzed, result.error);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    ops.completeScan(scan.id, 'failed', 0, 0, message);
  }
}

export function createScheduler(ops: DbOperations, scanFn: ScanFn) {
  const inFlight = new Set<number>();
  const jobs: cron.ScheduledTask[] = [];

  async function executeScan(siteId: number, fqdn: string): Promise<void> {
    if (inFlight.has(siteId)) return;
    const current = ops.listSites().find(s => s.id === siteId);
    if (!current || !current.is_active) return;
    inFlight.add(siteId);
    try {
      await runSiteScan(ops, scanFn, siteId, fqdn);
    } finally {
      inFlight.delete(siteId);
    }
  }

  function secondsToCron(seconds: number): string {
    const minutes = Math.max(5, Math.round(seconds / 60));
    if (minutes < 60) return `*/${minutes} * * * *`;
    const hours = Math.round(minutes / 60);
    return `0 */${hours} * * *`;
  }

  return {
    start() {
      const sites = ops.listSites().filter(s => s.is_active);
      for (const site of sites) {
        const cronExpr = secondsToCron(site.scan_interval_seconds);
        const job = cron.schedule(cronExpr, () => {
          executeScan(site.id, site.fqdn).catch((err: unknown) => {
            console.error(`Scan failed for site ${site.id}:`, err);
          });
        });
        jobs.push(job);
      }
      const retentionJob = cron.schedule('0 * * * *', () => { ops.runRetentionCleanup(); });
      jobs.push(retentionJob);
    },

    stop() {
      for (const job of jobs) job.stop();
      jobs.length = 0;
    },
  };
}
