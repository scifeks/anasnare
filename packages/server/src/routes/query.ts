import type { Request } from 'express';
import type { ListOptions } from '../types.js';

function intParam(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function floatParam(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function stringParam(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

export function parseListOptions(req: Request): ListOptions {
  const q = req.query;
  return {
    limit: intParam(q.limit),
    offset: intParam(q.offset),
    site_id: intParam(q.site_id),
    scan_id: intParam(q.scan_id),
    category: stringParam(q.category),
    min_weight: floatParam(q.min_weight),
    max_weight: floatParam(q.max_weight),
    tier: intParam(q.tier),
    creative_id: stringParam(q.creative_id),
    advertiser_id: stringParam(q.advertiser_id),
  };
}

export function parseId(req: Request): number | undefined {
  return intParam(req.params.id);
}
