import { describe, it, expect } from 'vitest';
import { generateInjectionScript } from '../src/injector.js';
import type { DetectorModule, AdContextProvider } from '../src/types.js';

const mockDetector: DetectorModule = {
  category: 'test',
  getInjectionCode(reportFnName: string) {
    return `${reportFnName}({ category: 'test', signal: 'mock', weight: 0.5, timestamp: Date.now(), details: {} });`;
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
    const code = generateInjectionScript('__bind_abc', [mockDetector], []);
    expect(code).toMatch(/^\(function\(\)\{/);
    expect(code).toMatch(/\}\)\(\);$/);
  });

  it('references the binding name for report functions', () => {
    const code = generateInjectionScript('__bind_abc', [mockDetector], [mockProvider]);
    expect(code).toContain('__bind_abc');
  });

  it('includes detector code', () => {
    const code = generateInjectionScript('__bind_abc', [mockDetector], []);
    expect(code).toContain("signal: 'mock'");
  });

  it('includes ad context provider code', () => {
    const code = generateInjectionScript('__bind_abc', [], [mockProvider]);
    expect(code).toContain("provider: 'test'");
  });

  it('includes Layer 2 toString stealth', () => {
    const code = generateInjectionScript('__bind_abc', [], []);
    expect(code).toContain('WeakMap');
    expect(code).toContain('toString');
    expect(code).toContain('[native code]');
  });

  it('includes stealth patches', () => {
    const code = generateInjectionScript('__bind_abc', [], []);
    expect(code).toContain('webdriver');
    expect(code).toContain('navigator');
  });

  it('does not include queue/flush or getCallerScript', () => {
    const code = generateInjectionScript('__bind_abc', [], []);
    expect(code).not.toContain('_detQ');
    expect(code).not.toContain('_adQ');
    expect(code).not.toContain('__anasnare_flushDet');
    expect(code).not.toContain('__anasnare_flushAd');
    expect(code).not.toContain('getCallerScript');
    expect(code).not.toContain('_marker');
  });

  it('calls binding with type field for detections and ads', () => {
    const code = generateInjectionScript('__bind_abc', [mockDetector], [mockProvider]);
    expect(code).toContain("type:'det'");
    expect(code).toContain("type:'ad'");
  });
});
