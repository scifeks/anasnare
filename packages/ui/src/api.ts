function getCsrfToken(): string {
  const match = document.cookie.match(/anasnare_csrf=([^;]+)/);
  return match?.[1] ?? '';
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(opts.headers as Record<string, string> || {}) };
  if (opts.method && opts.method !== 'GET') {
    headers['X-CSRF-Token'] = getCsrfToken();
  }
  const res = await fetch(path, { ...opts, headers, credentials: 'same-origin' });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  exchange: (token: string) => request('/api/auth/exchange', { method: 'POST', body: JSON.stringify({ token }) }),
  health: () => request<{ status: string }>('/api/health'),
  listSites: async () => (await request<{ data: import('./types.js').Site[]; total: number }>('/api/sites')).data,
  createSite: (body: { fqdn: string; display_name?: string; scan_interval_seconds?: number }) => request<import('./types.js').Site>('/api/sites', { method: 'POST', body: JSON.stringify(body) }),
  getSite: (id: number) => request<import('./types.js').Site>(`/api/sites/${id}`),
  updateSite: (id: number, body: Record<string, unknown>) => request<import('./types.js').Site>(`/api/sites/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteSite: (id: number) => request<void>(`/api/sites/${id}`, { method: 'DELETE' }),
  triggerScan: (siteId: number) => request<import('./types.js').Scan>(`/api/sites/${siteId}/scan`, { method: 'POST' }),
  listScans: (params?: Record<string, string>) => request<{ data: import('./types.js').Scan[]; total: number }>(`/api/scans?${new URLSearchParams(params)}`),
  getScan: (id: number) => request<import('./types.js').Scan>(`/api/scans/${id}`),
  listAdSlots: async (scanId: number) => (await request<{ data: import('./types.js').ScanAdSlot[]; total: number }>(`/api/scans/${scanId}/ad-slots`)).data,
  listDetections: (params?: Record<string, string>) => request<{ data: import('./types.js').Detection[]; total: number }>(`/api/detections?${new URLSearchParams(params)}`),
  getDetection: (id: number) => request<import('./types.js').Detection>(`/api/detections/${id}`),
  listDetectionsByScript: (url: string) => request<{ data: import('./types.js').Detection[]; total: number }>(`/api/detections/by-script?url=${encodeURIComponent(url)}`),
  dashboard: () => request<import('./types.js').DashboardStats>('/api/dashboard'),
  timeline: (params?: Record<string, string>) => request<import('./types.js').TimelinePoint[]>(`/api/dashboard/timeline?${new URLSearchParams(params)}`),
  listVendorAllowlist: async () => (await request<{ data: import('./types.js').VendorAllowlistEntry[]; total: number }>('/api/vendor-allowlist')).data,
  createVendorEntry: (body: { domain_pattern: string; vendor_name: string }) => request<import('./types.js').VendorAllowlistEntry>('/api/vendor-allowlist', { method: 'POST', body: JSON.stringify(body) }),
  updateVendorEntry: (id: number, body: Record<string, unknown>) => request<import('./types.js').VendorAllowlistEntry>(`/api/vendor-allowlist/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteVendorEntry: (id: number) => request<void>(`/api/vendor-allowlist/${id}`, { method: 'DELETE' }),
};
