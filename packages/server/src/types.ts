export interface Site {
  id: number;
  fqdn: string;
  display_name: string | null;
  scan_interval_seconds: number;
  is_active: number;
  retention_days: number;
  created_at: string;
  updated_at: string;
}

export interface Scan {
  id: number;
  site_id: number;
  started_at: string;
  completed_at: string | null;
  status: 'running' | 'completed' | 'failed' | 'timeout';
  error_message: string | null;
  page_url: string;
  detection_count: number;
  scripts_analyzed: number;
}

export interface Detection {
  id: number;
  scan_id: number;
  site_id: number;
  category: 'devtools' | 'automation' | 'instrumentation' | 'visibility' | 'fingerprinting';
  signal_name: string;
  weight: number;
  source_script_url: string | null;
  source_script_hash: string | null;
  stack_trace: string | null;
  initiator_chain: string | null;
  details: string | null;
  ad_slot_id: number | null;
  count: number;
  detected_at: string;
}

export interface ScanScript {
  id: number;
  scan_id: number;
  site_id: number;
  script_url: string;
  script_hash: string | null;
  initiator_chain: string | null;
  signal_count: number;
  category_count: number;
  categories: string;
  weight_sum: number;
  effective_weight_sum: number;
  threat_score: number;
  is_vendor_allowlisted: number;
  assessed_at: string;
}

export interface ScanAdSlot {
  id: number;
  scan_id: number;
  site_id: number;
  provider: string;
  slot_id: string;
  creative_id: string | null;
  advertiser_id: string | null;
  advertiser_domain: string | null;
  line_item_id: string | null;
  bidder: string | null;
  bid_price: number | null;
  media_url: string | null;
  wrapper_chain: string | null;
  script_urls: string;
  detected_at: string;
}

export interface VendorAllowlistEntry {
  id: number;
  domain_pattern: string;
  vendor_name: string;
  is_builtin: number;
  is_active: number;
  created_at: string;
}

export interface DashboardStats {
  total_sites: number;
  active_sites: number;
  scans_24h: number;
  detections_24h: number;
  tier1_24h: number;
  top_threat_scripts: Array<ScanScript & { site_fqdn: string }>;
  category_breakdown: Record<string, number>;
}

export interface TimelinePoint {
  hour: string;
  tier1: number;
  tier2: number;
  tier3: number;
}

export interface ListOptions {
  limit?: number;
  offset?: number;
  site_id?: number;
  scan_id?: number;
  category?: string;
  min_weight?: number;
  max_weight?: number;
  tier?: number;
  creative_id?: string;
  advertiser_id?: string;
}
