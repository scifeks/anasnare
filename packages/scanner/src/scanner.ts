import { chromium, type CDPSession, type BrowserContext, type Page } from 'playwright';
import crypto from 'node:crypto';
import { generateInjectionScript } from './injector.js';
import { getAllDetectors } from './detectors/index.js';
import { getAllProviders } from './enrichment/index.js';
import { ScriptRegistry } from './script-registry.js';
import type { DetectionEvent, AdSlotEvent, ScanResult, CDPHandler } from './types.js';

const SCAN_TIMEOUT = 150_000;
const NAV_TIMEOUT = 60_000;
const AD_WAIT = 15_000;
const SCROLL_MAX_TIME = 45_000;
const SCROLL_MAX_VH = 10;
const POST_SCROLL_WAIT = 10_000;
const DEDUP_CAP = 5;

type CallFrame = { scriptId: string; url: string; lineNumber: number; columnNumber: number };

interface SessionContext {
  bindingName: string;
  magic: string;
  wrapperScript: string;
  registry: ScriptRegistry;
  nonceStacks: Map<string, CallFrame[]>;
  addDetection: (evt: DetectionEvent) => void;
  adSlots: AdSlotEvent[];
  scriptInitiators: Record<string, string[]>;
  scriptsAnalyzed: { count: number };
  cdpHandlers: CDPHandler[];
}

async function setupCdpSession(cdp: CDPSession, ctx: SessionContext): Promise<void> {
  await cdp.send('Debugger.enable');
  await cdp.send('Network.enable');
  await cdp.send('Runtime.enable');

  cdp.on('Debugger.scriptParsed', (params) => {
    const parentFrame = (params.stackTrace as { callFrames?: Array<{ scriptId: string }> } | undefined)?.callFrames?.[0];
    const rawParams = params as typeof params & { sourceURL?: string };
    ctx.registry.register({
      scriptId: params.scriptId as string,
      url: params.url as string,
      hasSourceURL: Boolean(params.hasSourceURL),
      sourceURL: rawParams.sourceURL,
      parentScriptId: parentFrame?.scriptId,
    });
  });

  for (const handler of ctx.cdpHandlers) {
    (cdp as unknown as { on(event: string, cb: (params: Record<string, unknown>) => void): void }).on(
      handler.event,
      (params) => {
        try {
          const emitted: DetectionEvent[] = [];
          handler.handler(params, emitted);
          emitted.forEach(ctx.addDetection);
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
      if (chain.length > 0) ctx.scriptInitiators[url] = chain;
    }
    if (/\.m?js(\?|$)/i.test(url) || params.type === 'Script') {
      ctx.scriptsAnalyzed.count++;
    }
  });

  cdp.on('Runtime.consoleAPICalled', (params) => {
    if (params.type !== 'debug') return;
    const args = params.args as Array<{ type: string; value: unknown }>;
    if (args.length < 2 || args[0]?.value !== ctx.magic) return;
    const nonce = String(args[1].value);
    const frames = (params.stackTrace as { callFrames?: CallFrame[] })?.callFrames;
    if (frames) ctx.nonceStacks.set(nonce, frames);
  });

  cdp.on('Runtime.bindingCalled', (params) => {
    if (params.name !== ctx.bindingName) return;
    let envelope: { nonce: string; raw: string };
    try { envelope = JSON.parse(params.payload as string); } catch { return; }

    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(envelope.raw); } catch { return; }

    const stack = ctx.nonceStacks.get(envelope.nonce);
    ctx.nonceStacks.delete(envelope.nonce);

    if (parsed.type === 'ad') {
      ctx.adSlots.push(parsed.payload as AdSlotEvent);
      return;
    }
    if (!stack) return;

    let sourceScript = 'inline/unknown';
    let sourceURLSpoofed = false;
    for (const frame of stack) {
      const resolved = ctx.registry.resolve(frame.scriptId);
      if (resolved.url !== 'inline/unknown') {
        sourceScript = resolved.url;
        sourceURLSpoofed = resolved.spoofed;
        break;
      }
    }

    const stackStr = stack.map(f =>
      `  at ${f.url || '(anonymous)'}:${f.lineNumber}:${f.columnNumber}`
    ).join('\n');

    ctx.addDetection({
      category: parsed.category as string,
      signal: parsed.signal as string,
      weight: parsed.weight as number,
      sourceScript,
      stack: stackStr,
      sourceURLSpoofed,
      timestamp: parsed.timestamp as number,
      details: (parsed.details ?? {}) as Record<string, unknown>,
    });
  });

  await cdp.send('Runtime.addBinding', { name: ctx.bindingName });
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: ctx.wrapperScript });
}

export async function runScan(siteId: number, pageUrl: string): Promise<ScanResult> {
  const detections: DetectionEvent[] = [];
  const adSlots: AdSlotEvent[] = [];
  const scriptInitiators: Record<string, string[]> = {};
  const dedupCounts = new Map<string, number>();
  const scriptsAnalyzed = { count: 0 };

  const registry = new ScriptRegistry();
  const nonceStacks = new Map<string, CallFrame[]>();

  const addDetection = (evt: DetectionEvent): void => {
    const key = `${evt.signal}:${evt.sourceScript ?? 'unknown'}`;
    const count = dedupCounts.get(key) ?? 0;
    if (count >= DEDUP_CAP) return;
    dedupCounts.set(key, count + 1);
    detections.push(evt);
  };

  const magic = `__anasnare_${crypto.randomBytes(4).toString('hex')}`;
  const bindingName = `__bind_${crypto.randomBytes(8).toString('hex')}`;
  const detectors = getAllDetectors();
  const providers = getAllProviders();
  const iife = generateInjectionScript(bindingName, detectors, providers);

  const wrapperScript = `(() => {
    const nativeBinding = globalThis['${bindingName}'];
    const dbg = console.debug;
    let seq = 0;
    Object.defineProperty(globalThis, '${bindingName}', {
      configurable: false, writable: false, enumerable: false,
      value: function(payload) {
        const nonce = (++seq) + ':' + Math.random().toString(36).slice(2);
        dbg(${JSON.stringify(magic)}, nonce);
        nativeBinding(JSON.stringify({ nonce: nonce, raw: payload }));
      }
    });
  })();`;

  const cdpHandlers = detectors.flatMap(d => d.getCDPHandlers?.() ?? []);

  const ctx: SessionContext = {
    bindingName, magic, wrapperScript, registry, nonceStacks,
    addDetection, adSlots, scriptInitiators, scriptsAnalyzed, cdpHandlers,
  };

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

    await cdp.send('Page.enable');
    await setupCdpSession(cdp, ctx);

    const attachedFrames = new Set<import('playwright').Frame>();
    async function attachChildFrame(frame: import('playwright').Frame): Promise<void> {
      if (attachedFrames.has(frame) || frame === page.mainFrame()) return;
      attachedFrames.add(frame);
      try {
        const childCdp = await page.context().newCDPSession(frame);
        await setupCdpSession(childCdp, ctx);
      } catch {
        // Same-origin frames share the parent session and already have the binding
      }
    }

    page.on('framenavigated', (frame) => { attachChildFrame(frame).catch(() => {}); });

    await context.addInitScript(iife);

    await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
    await page.waitForTimeout(AD_WAIT);

    await autoScroll(page);
    await page.waitForTimeout(POST_SCROLL_WAIT);

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

  scanPromise.catch(() => {});
  if (context) {
    await (context as BrowserContext).close().catch(() => {});
  }

  const base = { siteId, pageUrl, detections, adSlots, scriptInitiators, scriptsAnalyzed: scriptsAnalyzed.count };
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
