export interface Site {
  id: number; fqdn: string; display_name: string | null;
  scan_interval_seconds: number; is_active: number; retention_days: number;
  created_at: string; updated_at: string;
}

export interface Scan {
  id: number; site_id: number; started_at: string; completed_at: string | null;
  status: string; error_message: string | null; page_url: string;
  detection_count: number; scripts_analyzed: number;
}

export interface Detection {
  id: number; scan_id: number; site_id: number; category: string;
  signal_name: string; weight: number; source_script_url: string | null;
  source_script_hash: string | null; stack_trace: string | null;
  initiator_chain: string | null; details: string | null;
  ad_slot_id: number | null; count: number; detected_at: string;
}

export interface ScanScript {
  id: number; scan_id: number; site_id: number; script_url: string;
  signal_count: number; category_count: number; categories: string;
  weight_sum: number; effective_weight_sum: number; threat_score: number;
  is_vendor_allowlisted: number; site_fqdn?: string;
}

export interface ScanAdSlot {
  id: number; scan_id: number; provider: string; slot_id: string;
  creative_id: string | null; advertiser_id: string | null;
  bidder: string | null; bid_price: number | null; wrapper_chain: string | null;
}

export interface VendorAllowlistEntry {
  id: number; domain_pattern: string; vendor_name: string;
  is_builtin: number; is_active: number;
}

export interface DashboardStats {
  total_sites: number; active_sites: number; scans_24h: number;
  detections_24h: number; tier1_24h: number;
  top_threat_scripts: ScanScript[]; category_breakdown: Record<string, number>;
}

export interface TimelinePoint {
  hour: string; tier1: number; tier2: number; tier3: number;
}

export function getTierLabel(weight: number): string {
  if (weight >= 0.70) return 'Tier 1';
  if (weight >= 0.25) return 'Tier 2';
  return 'Tier 3';
}

export function getTierColor(weight: number): 'red' | 'amber' | 'blue' {
  if (weight >= 0.70) return 'red';
  if (weight >= 0.25) return 'amber';
  return 'blue';
}
