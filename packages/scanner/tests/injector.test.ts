import { describe, it, expect } from 'vitest';
import { generateInjectionScript } from '../src/injector.js';
import type { DetectorModule, AdContextProvider } from '../src/types.js';

const mockDetector: DetectorModule = {
  category: 'test',
  getInjectionCode(reportFnName: string) {
    return `${reportFnName}({ category: 'test', signal: 'mock', weight: 0.5, sourceScript: 'test.js', stack: '', timestamp: Date.now(), details: {} });`;
  },
};

const mockProvider: AdContextProvider = {
  name: 'test',
  getInjectionCode(reportFnName: string) {
    return `${reportFnName}({ provider: 'test', slotId: 'slot1', scriptUrls: [], timestamp: Date.now() });`;
  },
};

describe('generateInjectionScript', () => {
  it('wraps code in an IIFE', () => {
    const code = generateInjectionScript('__rpt', '__rptAd', [mockDetector], []);
    expect(code).toMatch(/^\(function\(\)\{/);
    expect(code).toMatch(/\}\)\(\);$/);
  });

  it('includes both report function names', () => {
    const code = generateInjectionScript('__rpt', '__rptAd', [mockDetector], [mockProvider]);
    expect(code).toContain('__rpt');
    expect(code).toContain('__rptAd');
  });

  it('includes detector code', () => {
    const code = generateInjectionScript('__rpt', '__rptAd', [mockDetector], []);
    expect(code).toContain("signal: 'mock'");
  });

  it('includes ad context provider code', () => {
    const code = generateInjectionScript('__rpt', '__rptAd', [], [mockProvider]);
    expect(code).toContain("provider: 'test'");
  });

  it('includes Layer 2 toString stealth', () => {
    const code = generateInjectionScript('__rpt', '__rptAd', [], []);
    expect(code).toContain('WeakMap');
    expect(code).toContain('toString');
    expect(code).toContain('[native code]');
  });

  it('includes stealth patches', () => {
    const code = generateInjectionScript('__rpt', '__rptAd', [], []);
    expect(code).toContain('webdriver');
    expect(code).toContain('navigator');
  });

  it('includes queue-and-flush for both channels', () => {
    const code = generateInjectionScript('__rpt', '__rptAd', [], []);
    expect(code).toContain('_detQ');
    expect(code).toContain('_adQ');
  });

  it('includes getCallerScript helper', () => {
    const code = generateInjectionScript('__rpt', '__rptAd', [], []);
    expect(code).toContain('getCallerScript');
  });
});
