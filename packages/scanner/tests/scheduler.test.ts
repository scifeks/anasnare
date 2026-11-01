import { describe, it, expect, vi } from 'vitest';
import { runSiteScan, type DbOperations } from '../src/scheduler.js';
import type { DetectionEvent, ScanResult } from '../src/types.js';

function mockOps(): DbOperations {
  return {
    listSites: vi.fn().mockReturnValue([]),
    getScan: vi.fn(),
    createScan: vi.fn().mockReturnValue({ id: 7, site_id: 1, page_url: 'https://example.com', status: 'running' }),
    completeScan: vi.fn(),
    insertDetection: vi.fn().mockReturnValue(1),
    insertScanScript: vi.fn().mockReturnValue(1),
    insertAdSlot: vi.fn().mockReturnValue(1),
    getActiveAllowlistPatterns: vi.fn().mockReturnValue([]),
    runRetentionCleanup: vi.fn().mockReturnValue(0),
  };
}

function detection(signal: string, sourceScript: string): DetectionEvent {
  return { category: 'fingerprint', signal, weight: 0.6, sourceScript, stack: '', timestamp: 0, details: {} };
}

function scanResult(detections: DetectionEvent[], error?: string): ScanResult {
  return {
    siteId: 1, pageUrl: 'https://example.com', detections, adSlots: [],
    scriptInitiators: {}, scriptsAnalyzed: 2, error,
  };
}

describe('runSiteScan', () => {
  it('persists detections and scan scripts then completes the scan', async () => {
    const ops = mockOps();
    const scanFn = vi.fn().mockResolvedValue(
      scanResult([detection('canvas', 'https://a.test/a.js'), detection('webgl', 'https://b.test/b.js')]),
    );

    await runSiteScan(ops, scanFn, 1, 'example.com');

    expect(scanFn).toHaveBeenCalledWith(1, 'https://example.com');
    expect(ops.insertDetection).toHaveBeenCalledTimes(2);
    expect(ops.insertScanScript).toHaveBeenCalledTimes(2);
    expect(ops.completeScan).toHaveBeenCalledWith(7, 'completed', 2, 2, undefined);
  });

  it('marks the scan failed when the scanner reports an error', async () => {
    const ops = mockOps();
    const scanFn = vi.fn().mockResolvedValue(scanResult([], 'navigation timeout'));

    await runSiteScan(ops, scanFn, 1, 'example.com');

    expect(ops.completeScan).toHaveBeenCalledWith(7, 'failed', 0, 2, 'navigation timeout');
  });

  it('marks the scan failed when the scanner throws', async () => {
    const ops = mockOps();
    const scanFn = vi.fn().mockRejectedValue(new Error('browser crashed'));

    await runSiteScan(ops, scanFn, 1, 'example.com');

    expect(ops.completeScan).toHaveBeenCalledWith(7, 'failed', 0, 0, 'browser crashed');
    expect(ops.insertDetection).not.toHaveBeenCalled();
  });

  it('inserts a repeated signal from the same script only once', async () => {
    const ops = mockOps();
    const scanFn = vi.fn().mockResolvedValue(scanResult([
      detection('canvas', 'https://a.test/a.js'),
      detection('canvas', 'https://a.test/a.js'),
      detection('canvas', 'https://b.test/b.js'),
    ]));

    await runSiteScan(ops, scanFn, 1, 'example.com');

    expect(ops.insertDetection).toHaveBeenCalledTimes(2);
    const urls = vi.mocked(ops.insertDetection).mock.calls.map(c => c[0].source_script_url);
    expect(urls).toEqual(['https://a.test/a.js', 'https://b.test/b.js']);
  });
});
