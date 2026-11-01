import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import {
  initDb,
  createSite,
  getSite,
  listSites,
  updateSite,
  deleteSite,
  createScan,
  completeScan,
  getScan,
  listScans,
  insertDetection,
  getDetection,
  listDetections,
  listDetectionsByScript,
  listDetectionsByCampaign,
  getDashboardStats,
  getTimeline,
  insertScanScript,
  listScanScripts,
  insertAdSlot,
  listAdSlots,
  listVendorAllowlist,
  createVendorEntry,
  updateVendorEntry,
  deleteVendorEntry,
  seedVendorAllowlist,
  getActiveAllowlistPatterns,
  runRetentionCleanup,
} from '../src/db.js';

describe('database', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = initDb(':memory:');
  });

  describe('sites', () => {
    it('creates and retrieves a site', () => {
      const site = createSite(db, 'example.com');
      expect(site.fqdn).toBe('example.com');
      expect(site.scan_interval_seconds).toBe(1800);
      expect(site.is_active).toBe(1);
      expect(site.retention_days).toBe(30);

      const fetched = getSite(db, site.id);
      expect(fetched).toEqual(site);
    });

    it('enforces unique fqdn', () => {
      createSite(db, 'example.com');
      expect(() => createSite(db, 'example.com')).toThrow();
    });

    it('lists all sites', () => {
      createSite(db, 'a.com');
      createSite(db, 'b.com');
      const sites = listSites(db);
      expect(sites).toHaveLength(2);
    });

    it('updates a site partially', () => {
      const site = createSite(db, 'example.com');
      const updated = updateSite(db, site.id, { is_active: 0, retention_days: 7 });
      expect(updated!.is_active).toBe(0);
      expect(updated!.retention_days).toBe(7);
      expect(updated!.fqdn).toBe('example.com');
    });

    it('deletes a site and cascades', () => {
      const site = createSite(db, 'example.com');
      const scan = createScan(db, site.id, 'https://example.com');
      insertDetection(db, {
        scan_id: scan.id,
        site_id: site.id,
        category: 'devtools',
        signal_name: 'debugger_timing_loop',
        weight: 0.95,
        source_script_url: 'https://cdn.example.com/ad.js',
      });
      deleteSite(db, site.id);
      expect(getSite(db, site.id)).toBeUndefined();
      expect(getScan(db, scan.id)).toBeUndefined();
    });
  });

  describe('scans', () => {
    it('creates a running scan and completes it', () => {
      const site = createSite(db, 'example.com');
      const scan = createScan(db, site.id, 'https://example.com');
      expect(scan.status).toBe('running');
      expect(scan.completed_at).toBeNull();

      completeScan(db, scan.id, 'completed', 5, 12);
      const updated = getScan(db, scan.id);
      expect(updated!.status).toBe('completed');
      expect(updated!.detection_count).toBe(5);
      expect(updated!.completed_at).not.toBeNull();
    });

    it('lists scans with pagination', () => {
      const site = createSite(db, 'example.com');
      for (let i = 0; i < 5; i++) {
        const s = createScan(db, site.id, 'https://example.com');
        completeScan(db, s.id, 'completed', 0, 0);
      }
      const page = listScans(db, { site_id: site.id, limit: 2, offset: 0 });
      expect(page.data).toHaveLength(2);
      expect(page.total).toBe(5);
    });
  });

  describe('detections', () => {
    it('inserts and retrieves a detection with weight', () => {
      const site = createSite(db, 'example.com');
      const scan = createScan(db, site.id, 'https://example.com');
      const id = insertDetection(db, {
        scan_id: scan.id,
        site_id: site.id,
        category: 'automation',
        signal_name: 'webdriver_check',
        weight: 0.45,
        source_script_url: 'https://cdn.ad.com/tracker.js',
        stack_trace: 'Error\n    at check (tracker.js:10)',
        details: JSON.stringify({ probed: 'navigator.webdriver' }),
      });
      const det = getDetection(db, id);
      expect(det!.signal_name).toBe('webdriver_check');
      expect(det!.weight).toBe(0.45);
    });

    it('filters by category and weight range', () => {
      const site = createSite(db, 'example.com');
      const scan = createScan(db, site.id, 'https://example.com');
      insertDetection(db, { scan_id: scan.id, site_id: site.id, category: 'devtools', signal_name: 'debugger_timing_loop', weight: 0.95 });
      insertDetection(db, { scan_id: scan.id, site_id: site.id, category: 'automation', signal_name: 'webdriver_check', weight: 0.45 });
      insertDetection(db, { scan_id: scan.id, site_id: site.id, category: 'fingerprinting', signal_name: 'canvas_fingerprint', weight: 0.15 });

      const tier1 = listDetections(db, { min_weight: 0.70 });
      expect(tier1.data).toHaveLength(1);

      const devtoolsOnly = listDetections(db, { category: 'devtools' });
      expect(devtoolsOnly.data).toHaveLength(1);
    });

    it('filters by tier convenience param', () => {
      const site = createSite(db, 'example.com');
      const scan = createScan(db, site.id, 'https://example.com');
      insertDetection(db, { scan_id: scan.id, site_id: site.id, category: 'devtools', signal_name: 'debugger_timing_loop', weight: 0.95 });
      insertDetection(db, { scan_id: scan.id, site_id: site.id, category: 'automation', signal_name: 'webdriver_check', weight: 0.45 });
      insertDetection(db, { scan_id: scan.id, site_id: site.id, category: 'fingerprinting', signal_name: 'canvas_fingerprint', weight: 0.15 });

      const tier2 = listDetections(db, { tier: 2 });
      expect(tier2.data).toHaveLength(1);
      expect(tier2.data[0].signal_name).toBe('webdriver_check');
    });

    it('places weights between 0.50 and 0.70 in tier 2 and 0.70 only in tier 1', () => {
      const site = createSite(db, 'example.com');
      const scan = createScan(db, site.id, 'https://example.com');
      insertDetection(db, { scan_id: scan.id, site_id: site.id, category: 'automation', signal_name: 'mid', weight: 0.60 });
      insertDetection(db, { scan_id: scan.id, site_id: site.id, category: 'automation', signal_name: 'edge', weight: 0.70 });

      expect(listDetections(db, { tier: 2 }).data.map(d => d.signal_name)).toEqual(['mid']);
      expect(listDetections(db, { tier: 1 }).data.map(d => d.signal_name)).toEqual(['edge']);
    });

    it('caps a negative limit instead of returning unlimited rows', () => {
      const site = createSite(db, 'example.com');
      const scan = createScan(db, site.id, 'https://example.com');
      const stmt = db.prepare("INSERT INTO detections (scan_id, site_id, category, signal_name, weight) VALUES (?, ?, 'devtools', 'bulk', 0.05)");
      for (let i = 0; i < 210; i++) stmt.run(scan.id, site.id);

      const page = listDetections(db, { limit: -1 });
      expect(page.data.length).toBeLessThanOrEqual(200);
      expect(page.total).toBe(210);
    });

    it('filters by source script url', () => {
      const site = createSite(db, 'example.com');
      const scan = createScan(db, site.id, 'https://example.com');
      insertDetection(db, { scan_id: scan.id, site_id: site.id, category: 'devtools', signal_name: 'a', weight: 0.9, source_script_url: 'https://x.com/a.js' });
      insertDetection(db, { scan_id: scan.id, site_id: site.id, category: 'devtools', signal_name: 'b', weight: 0.9, source_script_url: 'https://x.com/b.js' });
      insertDetection(db, { scan_id: scan.id, site_id: site.id, category: 'devtools', signal_name: 'c', weight: 0.9 });

      const result = listDetectionsByScript(db, 'https://x.com/a.js');
      expect(result.total).toBe(1);
      expect(result.data[0].signal_name).toBe('a');
    });

    it('filters by campaign creative and advertiser through linked ad slots', () => {
      const site = createSite(db, 'example.com');
      const scan = createScan(db, site.id, 'https://example.com');
      const slotA = insertAdSlot(db, { scan_id: scan.id, site_id: site.id, provider: 'gpt', slot_id: 's1', creative_id: 'c1', advertiser_id: 'adv1', script_urls: '[]' });
      const slotB = insertAdSlot(db, { scan_id: scan.id, site_id: site.id, provider: 'gpt', slot_id: 's2', creative_id: 'c2', advertiser_id: 'adv1', script_urls: '[]' });
      const slotC = insertAdSlot(db, { scan_id: scan.id, site_id: site.id, provider: 'gpt', slot_id: 's3', creative_id: 'c3', advertiser_id: 'adv2', script_urls: '[]' });
      insertDetection(db, { scan_id: scan.id, site_id: site.id, category: 'devtools', signal_name: 'a', weight: 0.9, ad_slot_id: slotA });
      insertDetection(db, { scan_id: scan.id, site_id: site.id, category: 'devtools', signal_name: 'b', weight: 0.9, ad_slot_id: slotB });
      insertDetection(db, { scan_id: scan.id, site_id: site.id, category: 'devtools', signal_name: 'c', weight: 0.9, ad_slot_id: slotC });
      insertDetection(db, { scan_id: scan.id, site_id: site.id, category: 'devtools', signal_name: 'unlinked', weight: 0.9 });

      expect(listDetectionsByCampaign(db, { creative_id: 'c1' }).data.map(d => d.signal_name)).toEqual(['a']);
      expect(listDetectionsByCampaign(db, { advertiser_id: 'adv1' }).total).toBe(2);
      expect(listDetectionsByCampaign(db).total).toBe(3);
    });
  });

  describe('scan_scripts', () => {
    it('inserts and lists by threat score descending', () => {
      const site = createSite(db, 'example.com');
      const scan = createScan(db, site.id, 'https://example.com');
      insertScanScript(db, {
        scan_id: scan.id,
        site_id: site.id,
        script_url: 'https://cdn.ad.com/low.js',
        signal_count: 1,
        category_count: 1,
        categories: JSON.stringify(['fingerprinting']),
        weight_sum: 0.15,
        effective_weight_sum: 0.15,
        threat_score: 0.15,
        is_vendor_allowlisted: 0,
      });
      insertScanScript(db, {
        scan_id: scan.id,
        site_id: site.id,
        script_url: 'https://cdn.ad.com/high.js',
        signal_count: 4,
        category_count: 3,
        categories: JSON.stringify(['devtools', 'automation', 'fingerprinting']),
        weight_sum: 1.55,
        effective_weight_sum: 1.55,
        threat_score: 3.10,
        is_vendor_allowlisted: 0,
      });
      const result = listScanScripts(db, { scan_id: scan.id });
      expect(result.data[0].script_url).toBe('https://cdn.ad.com/high.js');
      expect(result.data[1].script_url).toBe('https://cdn.ad.com/low.js');
    });
  });

  describe('scan_ad_slots', () => {
    it('inserts and lists ad slots for a scan', () => {
      const site = createSite(db, 'example.com');
      const scan = createScan(db, site.id, 'https://example.com');
      insertAdSlot(db, {
        scan_id: scan.id,
        site_id: site.id,
        provider: 'gpt',
        slot_id: '/1234/homepage/leaderboard',
        creative_id: '98765',
        advertiser_id: '111',
        script_urls: JSON.stringify(['https://securepubads.g.doubleclick.net/tag/js/gpt.js']),
      });
      const slots = listAdSlots(db, scan.id);
      expect(slots).toHaveLength(1);
      expect(slots[0].provider).toBe('gpt');
      expect(slots[0].creative_id).toBe('98765');
    });
  });

  describe('vendor_allowlist', () => {
    it('seeds default vendors on first boot', () => {
      seedVendorAllowlist(db);
      const entries = listVendorAllowlist(db);
      expect(entries.length).toBeGreaterThan(0);
      expect(entries.every(e => e.is_builtin === 1)).toBe(true);
    });

    it('does not re-seed if entries exist', () => {
      seedVendorAllowlist(db);
      const count1 = listVendorAllowlist(db).length;
      seedVendorAllowlist(db);
      const count2 = listVendorAllowlist(db).length;
      expect(count1).toBe(count2);
    });

    it('creates and deletes admin entries', () => {
      const entry = createVendorEntry(db, '*.custom-vendor.com', 'Custom');
      expect(entry.is_builtin).toBe(0);
      expect(deleteVendorEntry(db, entry.id)).toBe(true);
      expect(listVendorAllowlist(db)).toHaveLength(0);
    });

    it('prevents deleting built-in entries', () => {
      seedVendorAllowlist(db);
      const builtins = listVendorAllowlist(db).filter(e => e.is_builtin === 1);
      expect(deleteVendorEntry(db, builtins[0].id)).toBe(false);
    });

    it('disables a built-in entry', () => {
      seedVendorAllowlist(db);
      const builtins = listVendorAllowlist(db);
      const updated = updateVendorEntry(db, builtins[0].id, { is_active: 0 });
      expect(updated!.is_active).toBe(0);
    });

    it('returns only active patterns', () => {
      seedVendorAllowlist(db);
      const all = listVendorAllowlist(db);
      updateVendorEntry(db, all[0].id, { is_active: 0 });
      const patterns = getActiveAllowlistPatterns(db);
      expect(patterns.length).toBe(all.length - 1);
    });
  });

  describe('retention', () => {
    it('deletes old scans and cascades detections', () => {
      const site = createSite(db, 'example.com', undefined, undefined, 0);
      const scan = createScan(db, site.id, 'https://example.com');
      insertDetection(db, { scan_id: scan.id, site_id: site.id, category: 'devtools', signal_name: 'test', weight: 0.05 });
      completeScan(db, scan.id, 'completed', 1, 1);

      db.prepare("UPDATE scans SET completed_at = datetime('now', '-31 days') WHERE id = ?").run(scan.id);

      const deleted = runRetentionCleanup(db);
      expect(deleted).toBe(1);
      expect(getScan(db, scan.id)).toBeUndefined();
    });

    it('deletes stuck running scans that never completed', () => {
      const site = createSite(db, 'example.com', undefined, undefined, 7);
      const stuck = createScan(db, site.id, 'https://example.com');
      const fresh = createScan(db, site.id, 'https://example.com');
      db.prepare("UPDATE scans SET started_at = datetime('now', '-10 days') WHERE id = ?").run(stuck.id);

      expect(runRetentionCleanup(db)).toBe(1);
      expect(getScan(db, stuck.id)).toBeUndefined();
      expect(getScan(db, fresh.id)).toBeDefined();
    });
  });

  describe('timeline and dashboard', () => {
    function seed(siteId: number, scanId: number, weight: number, category: string, offset: string): void {
      db.prepare("INSERT INTO detections (scan_id, site_id, category, signal_name, weight, detected_at) VALUES (?, ?, ?, 'sig', ?, datetime('now', ?))").run(scanId, siteId, category, weight, offset);
    }

    it('buckets detections by hour and tier, and filters by site', () => {
      const a = createSite(db, 'a.com');
      const b = createSite(db, 'b.com');
      const scanA = createScan(db, a.id, 'https://a.com');
      const scanB = createScan(db, b.id, 'https://b.com');
      seed(a.id, scanA.id, 0.95, 'devtools', '-1 hour');
      seed(a.id, scanA.id, 0.60, 'automation', '-1 hour');
      seed(a.id, scanA.id, 0.10, 'fingerprinting', '-1 hour');
      seed(b.id, scanB.id, 0.95, 'devtools', '-1 hour');

      const sum = (points: ReturnType<typeof getTimeline>) => points.reduce(
        (acc, p) => ({ tier1: acc.tier1 + p.tier1, tier2: acc.tier2 + p.tier2, tier3: acc.tier3 + p.tier3 }),
        { tier1: 0, tier2: 0, tier3: 0 },
      );

      const all = getTimeline(db);
      expect(all).toHaveLength(49);
      expect(sum(all)).toEqual({ tier1: 2, tier2: 1, tier3: 1 });
      expect(sum(getTimeline(db, a.id))).toEqual({ tier1: 1, tier2: 1, tier3: 1 });
      expect(sum(getTimeline(db, b.id))).toEqual({ tier1: 1, tier2: 0, tier3: 0 });
    });

    it('computes dashboard counts and category breakdown', () => {
      const active = createSite(db, 'a.com');
      const inactive = createSite(db, 'b.com');
      updateSite(db, inactive.id, { is_active: 0 });
      const scan = createScan(db, active.id, 'https://a.com');
      seed(active.id, scan.id, 0.95, 'devtools', '-1 hour');
      seed(active.id, scan.id, 0.30, 'automation', '-2 hours');
      seed(active.id, scan.id, 0.10, 'automation', '-3 days');

      const stats = getDashboardStats(db);
      expect(stats.total_sites).toBe(2);
      expect(stats.active_sites).toBe(1);
      expect(stats.scans_24h).toBe(1);
      expect(stats.detections_24h).toBe(2);
      expect(stats.tier1_24h).toBe(1);
      expect(stats.category_breakdown).toEqual({ devtools: 1, automation: 2 });
    });
  });
});
