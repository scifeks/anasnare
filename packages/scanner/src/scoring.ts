import type { DetectionEvent } from './types.js';

export const TIER_1_MIN = 0.70;
export const TIER_2_MIN = 0.25;
export const VENDOR_DISCOUNT_TIER2 = 0.5;
export const VENDOR_DISCOUNT_TIER3 = 0.1;
export const SPREAD_MULTIPLIERS = [0, 1.0, 1.5, 2.0, 2.5, 3.0];

export interface ScriptScore {
  scriptUrl: string;
  signalCount: number;
  categoryCount: number;
  categories: string[];
  weightSum: number;
  effectiveWeightSum: number;
  threatScore: number;
  isVendorAllowlisted: boolean;
  sourceURLSpoofed: boolean;
}

export function matchesAllowlist(hostname: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    if (pattern.startsWith('*.')) {
      const suffix = pattern.slice(1);
      if (hostname.endsWith(suffix) || hostname === pattern.slice(2)) return true;
    } else if (hostname === pattern) {
      return true;
    }
  }
  return false;
}

function hostnameFromUrl(url: string): string {
  try { return new URL(url).hostname; } catch { return url; }
}

export function scoreScan(
  detections: DetectionEvent[],
  allowlistPatterns: string[],
): ScriptScore[] {
  const byScript = new Map<string, DetectionEvent[]>();
  for (const det of detections) {
    const key = det.sourceScript || 'unknown';
    const arr = byScript.get(key) ?? [];
    arr.push(det);
    byScript.set(key, arr);
  }

  const scores: ScriptScore[] = [];

  for (const [scriptUrl, dets] of byScript) {
    const hostname = hostnameFromUrl(scriptUrl);
    const isAllowlisted = matchesAllowlist(hostname, allowlistPatterns);

    const uniqueSignals = new Map<string, DetectionEvent>();
    for (const det of dets) {
      if (!uniqueSignals.has(det.signal)) uniqueSignals.set(det.signal, det);
    }

    const isSpoofed = [...uniqueSignals.values()].some(d => d.sourceURLSpoofed === true);

    const categories = new Set<string>();
    let weightSum = 0;
    let effectiveWeightSum = 0;

    for (const det of uniqueSignals.values()) {
      categories.add(det.category);
      weightSum += det.weight;

      let effectiveWeight = det.weight;
      if (isAllowlisted && !isSpoofed) {
        if (det.weight >= TIER_1_MIN) {
          effectiveWeight = det.weight;
        } else if (det.weight >= TIER_2_MIN) {
          effectiveWeight = det.weight * VENDOR_DISCOUNT_TIER2;
        } else {
          effectiveWeight = det.weight * VENDOR_DISCOUNT_TIER3;
        }
      }
      effectiveWeightSum += effectiveWeight;
    }

    const categoryCount = categories.size;
    const multiplier = SPREAD_MULTIPLIERS[Math.min(categoryCount, SPREAD_MULTIPLIERS.length - 1)];

    scores.push({
      scriptUrl,
      signalCount: uniqueSignals.size,
      categoryCount,
      categories: [...categories],
      weightSum,
      effectiveWeightSum,
      threatScore: effectiveWeightSum * multiplier,
      isVendorAllowlisted: isAllowlisted,
      sourceURLSpoofed: isSpoofed,
    });
  }

  scores.sort((a, b) => b.threatScore - a.threatScore);
  return scores;
}
