import { describe, it, expect } from 'vitest';
import { scoreScan, matchesAllowlist, TIER_1_MIN, SPREAD_MULTIPLIERS } from '../src/scoring.js';
import type { DetectionEvent } from '../src/types.js';

describe('matchesAllowlist', () => {
  it('matches glob patterns against hostnames', () => {
    expect(matchesAllowlist('cdn.doubleverify.com', ['*.doubleverify.com'])).toBe(true);
    expect(matchesAllowlist('scripts.doubleverify.com', ['*.doubleverify.com'])).toBe(true);
    expect(matchesAllowlist('evil.com', ['*.doubleverify.com'])).toBe(false);
  });

  it('matches exact domains', () => {
    expect(matchesAllowlist('moatads.com', ['moatads.com'])).toBe(true);
  });
});

describe('scoreScan', () => {
  const base: Omit<DetectionEvent, 'category' | 'signal' | 'weight'> = {
    sourceScript: 'https://cdn.example.com/ad.js',
    stack: '',
    timestamp: Date.now(),
    details: {},
  };

  it('scores a single-category script', () => {
    const detections: DetectionEvent[] = [
      { ...base, category: 'fingerprinting', signal: 'canvas_fingerprint', weight: 0.15 },
    ];
    const scores = scoreScan(detections, []);
    expect(scores).toHaveLength(1);
    expect(scores[0].weightSum).toBeCloseTo(0.15);
    expect(scores[0].threatScore).toBeCloseTo(0.15 * SPREAD_MULTIPLIERS[1]);
  });

  it('applies spread multiplier for cross-category signals', () => {
    const detections: DetectionEvent[] = [
      { ...base, category: 'devtools', signal: 'debugger_timing_loop', weight: 0.95 },
      { ...base, category: 'automation', signal: 'webdriver_check', weight: 0.45 },
      { ...base, category: 'fingerprinting', signal: 'canvas_fingerprint', weight: 0.15 },
    ];
    const scores = scoreScan(detections, []);
    expect(scores[0].categoryCount).toBe(3);
    expect(scores[0].threatScore).toBeCloseTo((0.95 + 0.45 + 0.15) * SPREAD_MULTIPLIERS[3]);
  });

  it('applies tier-gated allowlist discounts', () => {
    const detections: DetectionEvent[] = [
      { ...base, sourceScript: 'https://cdn.doubleverify.com/dvtp.js', category: 'devtools', signal: 'debugger_timing_loop', weight: 0.95 },
      { ...base, sourceScript: 'https://cdn.doubleverify.com/dvtp.js', category: 'automation', signal: 'webdriver_check', weight: 0.45 },
      { ...base, sourceScript: 'https://cdn.doubleverify.com/dvtp.js', category: 'fingerprinting', signal: 'canvas_fingerprint', weight: 0.15 },
    ];
    const scores = scoreScan(detections, ['*.doubleverify.com']);
    const s = scores[0];
    expect(s.isVendorAllowlisted).toBe(true);
    expect(s.weightSum).toBeCloseTo(0.95 + 0.45 + 0.15);
    expect(s.effectiveWeightSum).toBeCloseTo(0.95 + (0.45 * 0.5) + (0.15 * 0.1));
  });

  it('never suppresses Tier 1 signals from allowlisted vendors', () => {
    const detections: DetectionEvent[] = [
      { ...base, sourceScript: 'https://cdn.doubleverify.com/evil.js', category: 'devtools', signal: 'debugger_timing_loop', weight: 0.95 },
    ];
    const scores = scoreScan(detections, ['*.doubleverify.com']);
    expect(scores[0].effectiveWeightSum).toBeCloseTo(0.95);
  });

  it('deduplicates signals by name per script', () => {
    const detections: DetectionEvent[] = [
      { ...base, category: 'fingerprinting', signal: 'canvas_fingerprint', weight: 0.15 },
      { ...base, category: 'fingerprinting', signal: 'canvas_fingerprint', weight: 0.15 },
      { ...base, category: 'fingerprinting', signal: 'canvas_fingerprint', weight: 0.15 },
    ];
    const scores = scoreScan(detections, []);
    expect(scores[0].signalCount).toBe(1);
    expect(scores[0].weightSum).toBeCloseTo(0.15);
  });

  it('skips vendor allowlist discounts when sourceURLSpoofed is true', () => {
    const detections: DetectionEvent[] = [
      {
        ...base,
        sourceScript: 'https://cdn.doubleverify.com/dvtp.js',
        category: 'automation',
        signal: 'webdriver_check',
        weight: 0.45,
        sourceURLSpoofed: true,
      },
      {
        ...base,
        sourceScript: 'https://cdn.doubleverify.com/dvtp.js',
        category: 'fingerprinting',
        signal: 'canvas_fingerprint',
        weight: 0.15,
        sourceURLSpoofed: true,
      },
    ];
    const scores = scoreScan(detections, ['*.doubleverify.com']);
    const s = scores[0];
    expect(s.isVendorAllowlisted).toBe(true);
    expect(s.sourceURLSpoofed).toBe(true);
    expect(s.effectiveWeightSum).toBeCloseTo(0.45 + 0.15);
  });

  it('applies vendor discounts when sourceURLSpoofed is false', () => {
    const detections: DetectionEvent[] = [
      {
        ...base,
        sourceScript: 'https://cdn.doubleverify.com/dvtp.js',
        category: 'automation',
        signal: 'webdriver_check',
        weight: 0.45,
        sourceURLSpoofed: false,
      },
    ];
    const scores = scoreScan(detections, ['*.doubleverify.com']);
    expect(scores[0].sourceURLSpoofed).toBe(false);
    expect(scores[0].effectiveWeightSum).toBeCloseTo(0.45 * 0.5);
  });
});
