import { chromium, type BrowserContext, type Page } from 'playwright';
import crypto from 'node:crypto';
import { generateInjectionScript } from './injector.js';
import { getAllDetectors } from './detectors/index.js';
import { getAllProviders } from './enrichment/index.js';
import type { DetectionEvent, AdSlotEvent, ScanResult } from './types.js';

const SCAN_TIMEOUT = 150_000;
const NAV_TIMEOUT = 60_000;
const AD_WAIT = 15_000;
const SCROLL_MAX_TIME = 45_000;
const SCROLL_MAX_VH = 10;
const POST_SCROLL_WAIT = 10_000;
const DEDUP_CAP = 5;

export async function runScan(siteId: number, pageUrl: string): Promise<ScanResult> {
  const detections: DetectionEvent[] = [];
  const adSlots: AdSlotEvent[] = [];
  const scriptInitiators: Record<string, string[]> = {};
  const dedupCounts = new Map<string, number>();
  let scriptsAnalyzed = 0;

  const addDetection = (evt: DetectionEvent): void => {
    const key = `${evt.signal}:${evt.sourceScript}`;
    const count = dedupCounts.get(key) ?? 0;
    if (count >= DEDUP_CAP) return;
    dedupCounts.set(key, count + 1);
    detections.push(evt);
  };

  const detReportFn = `__rpt_${crypto.randomBytes(4).toString('hex')}`;
  const adReportFn = `__rptAd_${crypto.randomBytes(4).toString('hex')}`;

  const detectors = getAllDetectors();
  const providers = getAllProviders();
  const iife = generateInjectionScript(detReportFn, adReportFn, detectors, providers);

  let context: BrowserContext | null = null;
  let timeoutHandle: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<'timeout'>((resolve) => {
    timeoutHandle = setTimeout(() => resolve('timeout'), SCAN_TIMEOUT);
  });

  const scanPromise = (async (): Promise<'done'> => {
    context = await chromium.launchPersistentContext('', {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = context.pages()[0] || await context.newPage();
    const cdp = await page.context().newCDPSession(page);

    await cdp.send('Debugger.enable');
    await cdp.send('Network.enable');

    const cdpHandlers = detectors.flatMap(d => d.getCDPHandlers?.() ?? []);
    for (const handler of cdpHandlers) {
      // Playwright's typed CDP events do not cover arbitrary handler event names.
      (cdp as unknown as { on(event: string, cb: (params: Record<string, unknown>) => void): void }).on(
        handler.event,
        (params) => {
          try {
            const emitted: DetectionEvent[] = [];
            handler.handler(params, emitted);
            emitted.forEach(addDetection);
          } finally {
            if (handler.event === 'Debugger.paused') {
              cdp.send('Debugger.resume').catch(() => {});
            }
          }
        },
      );
    }

    cdp.on('Network.requestWillBeSent', (params) => {
      const url = params.request.url;
      const frames = params.initiator.stack?.callFrames;
      if (frames) {
        const chain = frames.map(f => f.url).filter(Boolean);
        if (chain.length > 0) scriptInitiators[url] = chain;
      }
      if (/\.m?js(\?|$)/i.test(url) || params.type === 'Script') {
        scriptsAnalyzed++;
      }
    });

    await context.addInitScript(iife);

    await page.exposeFunction(detReportFn, (raw: string) => {
      const evt = JSON.parse(raw) as DetectionEvent;
      addDetection(evt);
    });

    await page.exposeFunction(adReportFn, (raw: string) => {
      adSlots.push(JSON.parse(raw) as AdSlotEvent);
    });

    await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
    await page.waitForTimeout(AD_WAIT);

    await autoScroll(page);
    await page.waitForTimeout(POST_SCROLL_WAIT);

    await drainQueues(page);

    return 'done';
  })();

  let outcome: 'done' | 'timeout' | 'error';
  let errorMessage: string | undefined;
  try {
    outcome = await Promise.race([scanPromise, timeoutPromise]);
  } catch (err) {
    outcome = 'error';
    errorMessage = err instanceof Error ? err.message : String(err);
  } finally {
    clearTimeout(timeoutHandle);
  }

  // Closing the context also rejects any in-flight scan steps after a timeout.
  scanPromise.catch(() => {});
  if (context) {
    await (context as BrowserContext).close().catch(() => {});
  }

  const base = { siteId, pageUrl, detections, adSlots, scriptInitiators, scriptsAnalyzed };
  if (outcome === 'timeout') {
    return { ...base, error: 'Scan timed out after 150 seconds' };
  }
  if (outcome === 'error') {
    return { ...base, error: errorMessage };
  }
  return base;
}

async function autoScroll(page: Page): Promise<void> {
  const startTime = Date.now();
  const viewportHeight = page.viewportSize()?.height ?? 800;
  let scrolled = 0;

  while (scrolled < viewportHeight * SCROLL_MAX_VH && (Date.now() - startTime) < SCROLL_MAX_TIME) {
    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    scrolled += viewportHeight;
    await page.waitForTimeout(1000);
  }
}

async function drainQueues(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as Record<string, (() => void) | undefined>;
    try { w.__anasnare_flushDet?.(); } catch (_e) { /* page may have torn down */ }
    try { w.__anasnare_flushAd?.(); } catch (_e) { /* page may have torn down */ }
  });
}
