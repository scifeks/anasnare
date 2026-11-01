import Database from 'better-sqlite3';
import type {
  Site, Scan, Detection, ScanScript, ScanAdSlot,
  VendorAllowlistEntry, DashboardStats, TimelinePoint, ListOptions,
} from './types.js';
import { VENDOR_SEEDS } from './vendor-seeds.js';

const TIER_1_MIN = 0.70;
const TIER_2_MIN = 0.25;

function paginate(opts: ListOptions): { limit: number; offset: number } {
  const limit = Math.max(1, Math.min(opts.limit ?? 50, 200));
  const offset = Math.max(0, opts.offset ?? 0);
  return { limit, offset };
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS sites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fqdn TEXT NOT NULL UNIQUE,
    display_name TEXT,
    scan_interval_seconds INTEGER NOT NULL DEFAULT 1800,
    is_active INTEGER NOT NULL DEFAULT 1,
    retention_days INTEGER NOT NULL DEFAULT 30,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS scans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT,
    status TEXT NOT NULL DEFAULT 'running',
    error_message TEXT,
    page_url TEXT NOT NULL,
    detection_count INTEGER NOT NULL DEFAULT 0,
    scripts_analyzed INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS scan_ad_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scan_id INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    slot_id TEXT NOT NULL,
    creative_id TEXT,
    advertiser_id TEXT,
    advertiser_domain TEXT,
    line_item_id TEXT,
    bidder TEXT,
    bid_price REAL,
    media_url TEXT,
    wrapper_chain TEXT,
    script_urls TEXT NOT NULL,
    detected_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS detections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scan_id INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    signal_name TEXT NOT NULL,
    weight REAL NOT NULL,
    source_script_url TEXT,
    source_script_hash TEXT,
    stack_trace TEXT,
    initiator_chain TEXT,
    details TEXT,
    ad_slot_id INTEGER REFERENCES scan_ad_slots(id) ON DELETE SET NULL,
    count INTEGER NOT NULL DEFAULT 1,
    detected_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS scan_scripts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scan_id INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    script_url TEXT NOT NULL,
    script_hash TEXT,
    initiator_chain TEXT,
    signal_count INTEGER NOT NULL,
    category_count INTEGER NOT NULL,
    categories TEXT NOT NULL,
    weight_sum REAL NOT NULL,
    effective_weight_sum REAL NOT NULL,
    threat_score REAL NOT NULL,
    is_vendor_allowlisted INTEGER NOT NULL DEFAULT 0,
    assessed_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS vendor_allowlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain_pattern TEXT NOT NULL UNIQUE,
    vendor_name TEXT NOT NULL,
    is_builtin INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_detections_site_id ON detections(site_id);
  CREATE INDEX IF NOT EXISTS idx_detections_scan_id ON detections(scan_id);
  CREATE INDEX IF NOT EXISTS idx_detections_category ON detections(category);
  CREATE INDEX IF NOT EXISTS idx_detections_weight ON detections(weight);
  CREATE INDEX IF NOT EXISTS idx_detections_source_script ON detections(source_script_url);
  CREATE INDEX IF NOT EXISTS idx_detections_detected_at ON detections(detected_at);
  CREATE INDEX IF NOT EXISTS idx_detections_ad_slot_id ON detections(ad_slot_id);
  CREATE INDEX IF NOT EXISTS idx_scans_site_id ON scans(site_id);
  CREATE INDEX IF NOT EXISTS idx_scans_status ON scans(status);
  CREATE INDEX IF NOT EXISTS idx_scan_scripts_scan_id ON scan_scripts(scan_id);
  CREATE INDEX IF NOT EXISTS idx_scan_scripts_site_id ON scan_scripts(site_id);
  CREATE INDEX IF NOT EXISTS idx_scan_scripts_threat ON scan_scripts(threat_score DESC);
  CREATE INDEX IF NOT EXISTS idx_scan_ad_slots_scan_id ON scan_ad_slots(scan_id);
  CREATE INDEX IF NOT EXISTS idx_scan_ad_slots_site_id ON scan_ad_slots(site_id);
  CREATE INDEX IF NOT EXISTS idx_scan_ad_slots_creative ON scan_ad_slots(creative_id);
  CREATE INDEX IF NOT EXISTS idx_vendor_allowlist_pattern ON vendor_allowlist(domain_pattern);
`;

export function initDb(dbPath: string): Database.Database {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}

export function createSite(db: Database.Database, fqdn: string, displayName?: string, intervalSeconds?: number, retentionDays?: number): Site {
  const result = db.prepare('INSERT INTO sites (fqdn, display_name, scan_interval_seconds, retention_days) VALUES (?, ?, ?, ?)').run(fqdn, displayName ?? null, intervalSeconds ?? 1800, retentionDays ?? 30);
  return getSite(db, result.lastInsertRowid as number)!;
}

export function getSite(db: Database.Database, id: number): Site | undefined {
  return db.prepare('SELECT * FROM sites WHERE id = ?').get(id) as Site | undefined;
}

export function listSites(db: Database.Database): Site[] {
  return db.prepare('SELECT * FROM sites ORDER BY created_at DESC').all() as Site[];
}

export function updateSite(db: Database.Database, id: number, fields: Partial<Pick<Site, 'display_name' | 'scan_interval_seconds' | 'is_active' | 'retention_days'>>): Site | undefined {
  const allowed = ['display_name', 'scan_interval_seconds', 'is_active', 'retention_days'] as const;
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const key of allowed) {
    if (key in fields) { sets.push(`${key} = ?`); values.push(fields[key]); }
  }
  if (sets.length === 0) return getSite(db, id);
  sets.push("updated_at = datetime('now')");
  values.push(id);
  db.prepare(`UPDATE sites SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  return getSite(db, id);
}

export function deleteSite(db: Database.Database, id: number): boolean {
  return db.prepare('DELETE FROM sites WHERE id = ?').run(id).changes > 0;
}

export function createScan(db: Database.Database, siteId: number, pageUrl: string): Scan {
  const result = db.prepare('INSERT INTO scans (site_id, page_url) VALUES (?, ?)').run(siteId, pageUrl);
  return getScan(db, result.lastInsertRowid as number)!;
}

export function completeScan(db: Database.Database, scanId: number, status: string, detectionCount: number, scriptsAnalyzed: number, errorMessage?: string): void {
  db.prepare("UPDATE scans SET status = ?, detection_count = ?, scripts_analyzed = ?, error_message = ?, completed_at = datetime('now') WHERE id = ?").run(status, detectionCount, scriptsAnalyzed, errorMessage ?? null, scanId);
}

export function getScan(db: Database.Database, id: number): Scan | undefined {
  return db.prepare('SELECT * FROM scans WHERE id = ?').get(id) as Scan | undefined;
}

export function listScans(db: Database.Database, opts: ListOptions = {}): { data: Scan[]; total: number } {
  const { limit, offset } = paginate(opts);
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.site_id !== undefined) { where.push('site_id = ?'); params.push(opts.site_id); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (db.prepare(`SELECT COUNT(*) as c FROM scans ${clause}`).get(...params) as { c: number }).c;
  const data = db.prepare(`SELECT * FROM scans ${clause} ORDER BY started_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset) as Scan[];
  return { data, total };
}

function tierToWeightRange(tier: number): { min: number; max: number } {
  if (tier === 1) return { min: TIER_1_MIN, max: Number.POSITIVE_INFINITY };
  if (tier === 2) return { min: TIER_2_MIN, max: TIER_1_MIN };
  return { min: 0.0, max: TIER_2_MIN };
}

export function insertDetection(db: Database.Database, det: Partial<Detection> & Pick<Detection, 'scan_id' | 'site_id' | 'category' | 'signal_name' | 'weight'>): number {
  const result = db.prepare('INSERT INTO detections (scan_id, site_id, category, signal_name, weight, source_script_url, source_script_hash, stack_trace, initiator_chain, details, ad_slot_id, count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    det.scan_id, det.site_id, det.category, det.signal_name, det.weight,
    det.source_script_url ?? null, det.source_script_hash ?? null,
    det.stack_trace ?? null, det.initiator_chain ?? null,
    det.details ?? null, det.ad_slot_id ?? null, det.count ?? 1,
  );
  return result.lastInsertRowid as number;
}

export function getDetection(db: Database.Database, id: number): Detection | undefined {
  return db.prepare('SELECT * FROM detections WHERE id = ?').get(id) as Detection | undefined;
}

export function listDetections(db: Database.Database, opts: ListOptions = {}): { data: Detection[]; total: number } {
  const { limit, offset } = paginate(opts);
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.site_id !== undefined) { where.push('site_id = ?'); params.push(opts.site_id); }
  if (opts.scan_id !== undefined) { where.push('scan_id = ?'); params.push(opts.scan_id); }
  if (opts.category) { where.push('category = ?'); params.push(opts.category); }
  if (opts.tier !== undefined) {
    const range = tierToWeightRange(opts.tier);
    where.push('weight >= ? AND weight < ?');
    params.push(range.min, range.max);
  } else {
    if (opts.min_weight !== undefined) { where.push('weight >= ?'); params.push(opts.min_weight); }
    if (opts.max_weight !== undefined) { where.push('weight <= ?'); params.push(opts.max_weight); }
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (db.prepare(`SELECT COUNT(*) as c FROM detections ${clause}`).get(...params) as { c: number }).c;
  const data = db.prepare(`SELECT * FROM detections ${clause} ORDER BY detected_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset) as Detection[];
  return { data, total };
}

export function listDetectionsByScript(db: Database.Database, url: string, opts: ListOptions = {}): { data: Detection[]; total: number } {
  const { limit, offset } = paginate(opts);
  const total = (db.prepare('SELECT COUNT(*) as c FROM detections WHERE source_script_url = ?').get(url) as { c: number }).c;
  const data = db.prepare('SELECT * FROM detections WHERE source_script_url = ? ORDER BY detected_at DESC LIMIT ? OFFSET ?').all(url, limit, offset) as Detection[];
  return { data, total };
}

export function listDetectionsByCampaign(db: Database.Database, opts: ListOptions = {}): { data: Detection[]; total: number } {
  const { limit, offset } = paginate(opts);
  const where: string[] = ['d.ad_slot_id IS NOT NULL'];
  const params: unknown[] = [];
  if (opts.creative_id) { where.push('a.creative_id = ?'); params.push(opts.creative_id); }
  if (opts.advertiser_id) { where.push('a.advertiser_id = ?'); params.push(opts.advertiser_id); }
  const clause = `WHERE ${where.join(' AND ')}`;
  const total = (db.prepare(`SELECT COUNT(*) as c FROM detections d JOIN scan_ad_slots a ON d.ad_slot_id = a.id ${clause}`).get(...params) as { c: number }).c;
  const data = db.prepare(`SELECT d.* FROM detections d JOIN scan_ad_slots a ON d.ad_slot_id = a.id ${clause} ORDER BY d.detected_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset) as Detection[];
  return { data, total };
}

export function insertScanScript(db: Database.Database, ss: Omit<ScanScript, 'id' | 'assessed_at'> & { script_hash?: string; initiator_chain?: string }): number {
  const result = db.prepare('INSERT INTO scan_scripts (scan_id, site_id, script_url, script_hash, initiator_chain, signal_count, category_count, categories, weight_sum, effective_weight_sum, threat_score, is_vendor_allowlisted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    ss.scan_id, ss.site_id, ss.script_url, ss.script_hash ?? null,
    ss.initiator_chain ?? null, ss.signal_count, ss.category_count,
    ss.categories, ss.weight_sum, ss.effective_weight_sum,
    ss.threat_score, ss.is_vendor_allowlisted,
  );
  return result.lastInsertRowid as number;
}

export function listScanScripts(db: Database.Database, opts: ListOptions = {}): { data: ScanScript[]; total: number } {
  const { limit, offset } = paginate(opts);
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.scan_id !== undefined) { where.push('scan_id = ?'); params.push(opts.scan_id); }
  if (opts.site_id !== undefined) { where.push('site_id = ?'); params.push(opts.site_id); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (db.prepare(`SELECT COUNT(*) as c FROM scan_scripts ${clause}`).get(...params) as { c: number }).c;
  const data = db.prepare(`SELECT * FROM scan_scripts ${clause} ORDER BY threat_score DESC LIMIT ? OFFSET ?`).all(...params, limit, offset) as ScanScript[];
  return { data, total };
}

export function insertAdSlot(db: Database.Database, slot: Partial<ScanAdSlot> & Pick<ScanAdSlot, 'scan_id' | 'site_id' | 'provider' | 'slot_id' | 'script_urls'>): number {
  const result = db.prepare('INSERT INTO scan_ad_slots (scan_id, site_id, provider, slot_id, creative_id, advertiser_id, advertiser_domain, line_item_id, bidder, bid_price, media_url, wrapper_chain, script_urls) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    slot.scan_id, slot.site_id, slot.provider, slot.slot_id,
    slot.creative_id ?? null, slot.advertiser_id ?? null,
    slot.advertiser_domain ?? null, slot.line_item_id ?? null,
    slot.bidder ?? null, slot.bid_price ?? null,
    slot.media_url ?? null, slot.wrapper_chain ?? null, slot.script_urls,
  );
  return result.lastInsertRowid as number;
}

export function listAdSlots(db: Database.Database, scanId: number): ScanAdSlot[] {
  return db.prepare('SELECT * FROM scan_ad_slots WHERE scan_id = ? ORDER BY detected_at DESC').all(scanId) as ScanAdSlot[];
}

export function listVendorAllowlist(db: Database.Database): VendorAllowlistEntry[] {
  return db.prepare('SELECT * FROM vendor_allowlist ORDER BY vendor_name, domain_pattern').all() as VendorAllowlistEntry[];
}

export function getVendorEntry(db: Database.Database, id: number): VendorAllowlistEntry | undefined {
  return db.prepare('SELECT * FROM vendor_allowlist WHERE id = ?').get(id) as VendorAllowlistEntry | undefined;
}

export function createVendorEntry(db: Database.Database, domainPattern: string, vendorName: string): VendorAllowlistEntry {
  const result = db.prepare('INSERT INTO vendor_allowlist (domain_pattern, vendor_name, is_builtin) VALUES (?, ?, 0)').run(domainPattern, vendorName);
  return db.prepare('SELECT * FROM vendor_allowlist WHERE id = ?').get(result.lastInsertRowid) as VendorAllowlistEntry;
}

export function updateVendorEntry(db: Database.Database, id: number, fields: Partial<Pick<VendorAllowlistEntry, 'domain_pattern' | 'vendor_name' | 'is_active'>>): VendorAllowlistEntry | undefined {
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const key of ['domain_pattern', 'vendor_name', 'is_active'] as const) {
    if (key in fields) { sets.push(`${key} = ?`); values.push(fields[key]); }
  }
  if (sets.length === 0) return db.prepare('SELECT * FROM vendor_allowlist WHERE id = ?').get(id) as VendorAllowlistEntry | undefined;
  values.push(id);
  db.prepare(`UPDATE vendor_allowlist SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  return db.prepare('SELECT * FROM vendor_allowlist WHERE id = ?').get(id) as VendorAllowlistEntry | undefined;
}

export function deleteVendorEntry(db: Database.Database, id: number): boolean {
  const entry = db.prepare('SELECT is_builtin FROM vendor_allowlist WHERE id = ?').get(id) as { is_builtin: number } | undefined;
  if (!entry || entry.is_builtin === 1) return false;
  return db.prepare('DELETE FROM vendor_allowlist WHERE id = ?').run(id).changes > 0;
}

export function seedVendorAllowlist(db: Database.Database): void {
  const count = (db.prepare('SELECT COUNT(*) as c FROM vendor_allowlist').get() as { c: number }).c;
  if (count > 0) return;
  const stmt = db.prepare('INSERT INTO vendor_allowlist (domain_pattern, vendor_name, is_builtin) VALUES (?, ?, 1)');
  const txn = db.transaction(() => { for (const seed of VENDOR_SEEDS) stmt.run(seed.domain_pattern, seed.vendor_name); });
  txn();
}

export function getActiveAllowlistPatterns(db: Database.Database): string[] {
  return (db.prepare('SELECT domain_pattern FROM vendor_allowlist WHERE is_active = 1').all() as { domain_pattern: string }[]).map(r => r.domain_pattern);
}

export function getDashboardStats(db: Database.Database): DashboardStats {
  const total_sites = (db.prepare('SELECT COUNT(*) as c FROM sites').get() as { c: number }).c;
  const active_sites = (db.prepare('SELECT COUNT(*) as c FROM sites WHERE is_active = 1').get() as { c: number }).c;
  const scans_24h = (db.prepare("SELECT COUNT(*) as c FROM scans WHERE started_at >= datetime('now', '-1 day')").get() as { c: number }).c;
  const detections_24h = (db.prepare("SELECT COUNT(*) as c FROM detections WHERE detected_at >= datetime('now', '-1 day')").get() as { c: number }).c;
  const tier1_24h = (db.prepare("SELECT COUNT(*) as c FROM detections WHERE detected_at >= datetime('now', '-1 day') AND weight >= ?").get(TIER_1_MIN) as { c: number }).c;

  const top_threat_scripts = db.prepare(`
    SELECT ss.*, s.fqdn as site_fqdn FROM scan_scripts ss
    JOIN sites s ON ss.site_id = s.id
    WHERE ss.assessed_at >= datetime('now', '-7 days')
    ORDER BY ss.threat_score DESC LIMIT 10
  `).all() as Array<ScanScript & { site_fqdn: string }>;

  const categoryRows = db.prepare("SELECT category, COUNT(*) as c FROM detections WHERE detected_at >= datetime('now', '-7 days') GROUP BY category").all() as { category: string; c: number }[];
  const category_breakdown: Record<string, number> = {};
  for (const row of categoryRows) category_breakdown[row.category] = row.c;

  return { total_sites, active_sites, scans_24h, detections_24h, tier1_24h, top_threat_scripts, category_breakdown };
}

export function getTimeline(db: Database.Database, siteId?: number, days = 2): TimelinePoint[] {
  const hours = days * 24;
  const where = siteId ? 'AND d.site_id = ?' : '';
  const params: unknown[] = siteId ? [hours, siteId] : [hours];
  return db.prepare(`
    WITH RECURSIVE offsets(value) AS (SELECT 0 UNION ALL SELECT value + 1 FROM offsets WHERE value < ?),
    hours AS (SELECT datetime('now', '-' || value || ' hours') as hour FROM offsets)
    SELECT strftime('%Y-%m-%dT%H:00:00', h.hour) as hour,
      COALESCE(SUM(CASE WHEN d.weight >= ${TIER_1_MIN} THEN 1 ELSE 0 END), 0) as tier1,
      COALESCE(SUM(CASE WHEN d.weight >= ${TIER_2_MIN} AND d.weight < ${TIER_1_MIN} THEN 1 ELSE 0 END), 0) as tier2,
      COALESCE(SUM(CASE WHEN d.weight < ${TIER_2_MIN} THEN 1 ELSE 0 END), 0) as tier3
    FROM hours h LEFT JOIN detections d ON strftime('%Y-%m-%dT%H', d.detected_at) = strftime('%Y-%m-%dT%H', h.hour) ${where}
    GROUP BY strftime('%Y-%m-%dT%H:00:00', h.hour) ORDER BY hour ASC
  `).all(...params) as TimelinePoint[];
}

export function runRetentionCleanup(db: Database.Database): number {
  const sites = db.prepare('SELECT id, retention_days FROM sites').all() as Pick<Site, 'id' | 'retention_days'>[];
  let totalDeleted = 0;
  const deleteStmt = db.prepare("DELETE FROM scans WHERE site_id = ? AND COALESCE(completed_at, started_at) < datetime('now', '-' || ? || ' days')");
  for (const site of sites) totalDeleted += deleteStmt.run(site.id, site.retention_days).changes;
  return totalDeleted;
}
