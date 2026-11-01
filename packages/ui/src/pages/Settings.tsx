import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { AddSiteModal } from '../components/AddSiteModal.js';
import type { Site, VendorAllowlistEntry } from '../types.js';

const INTERVALS = [
  { label: '5 min', value: 300 }, { label: '15 min', value: 900 },
  { label: '30 min', value: 1800 }, { label: '1 hour', value: 3600 },
  { label: '4 hours', value: 14400 }, { label: '12 hours', value: 43200 },
  { label: '24 hours', value: 86400 },
];

const RETENTION_OPTIONS = [
  { label: '7 days', value: 7 }, { label: '14 days', value: 14 },
  { label: '30 days', value: 30 }, { label: '60 days', value: 60 },
  { label: '90 days', value: 90 },
];

function EditSiteRow({ site, onSave, onCancel }: {
  site: Site;
  onSave: (id: number, fields: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [displayName, setDisplayName] = useState(site.display_name ?? '');
  const [interval, setInterval] = useState(site.scan_interval_seconds);
  const [retention, setRetention] = useState(site.retention_days);

  return (
    <tr className="border-b border-gray-800/50 bg-gray-800/30">
      <td className="py-2">
        <div className="font-medium">{site.fqdn}</div>
        <input
          className="mt-1 w-full rounded border border-gray-600 bg-gray-700 px-2 py-1 text-xs"
          placeholder="Display name"
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
        />
      </td>
      <td className="py-2">
        <select className="rounded border border-gray-600 bg-gray-700 px-2 py-1 text-xs" value={interval} onChange={e => setInterval(Number(e.target.value))}>
          {INTERVALS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
        </select>
      </td>
      <td className="py-2">
        <select className="rounded border border-gray-600 bg-gray-700 px-2 py-1 text-xs" value={retention} onChange={e => setRetention(Number(e.target.value))}>
          {RETENTION_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </td>
      <td className="py-2" />
      <td className="py-2">
        <div className="flex gap-2">
          <button className="text-xs text-blue-400 hover:text-blue-300" onClick={() => onSave(site.id, { display_name: displayName || null, scan_interval_seconds: interval, retention_days: retention })}>Save</button>
          <button className="text-xs text-gray-400 hover:text-gray-300" onClick={onCancel}>Cancel</button>
        </div>
      </td>
    </tr>
  );
}

export function Settings() {
  const [sites, setSites] = useState<Site[]>([]);
  const [vendors, setVendors] = useState<VendorAllowlistEntry[]>([]);
  const [showAddSite, setShowAddSite] = useState(false);
  const [editingSiteId, setEditingSiteId] = useState<number | null>(null);
  const [newPattern, setNewPattern] = useState('');
  const [newVendorName, setNewVendorName] = useState('');

  useEffect(() => {
    api.listSites().then(setSites);
    api.listVendorAllowlist().then(setVendors);
  }, []);

  async function handleAddSite(fqdn: string, displayName: string, interval: number) {
    await api.createSite({ fqdn, display_name: displayName || undefined, scan_interval_seconds: interval });
    setSites(await api.listSites());
    setShowAddSite(false);
  }

  async function handleEditSite(id: number, fields: Record<string, unknown>) {
    await api.updateSite(id, fields);
    setSites(await api.listSites());
    setEditingSiteId(null);
  }

  async function handleDeleteSite(id: number) {
    if (!confirm('Delete this site and all its scan data?')) return;
    await api.deleteSite(id);
    setSites(await api.listSites());
  }

  async function handleToggleSite(site: Site) {
    await api.updateSite(site.id, { is_active: site.is_active ? 0 : 1 });
    setSites(await api.listSites());
  }

  async function handleAddVendor() {
    if (!newPattern.trim() || !newVendorName.trim()) return;
    await api.createVendorEntry({ domain_pattern: newPattern.trim(), vendor_name: newVendorName.trim() });
    setVendors(await api.listVendorAllowlist());
    setNewPattern('');
    setNewVendorName('');
  }

  async function handleToggleVendor(entry: VendorAllowlistEntry) {
    await api.updateVendorEntry(entry.id, { is_active: entry.is_active ? 0 : 1 });
    setVendors(await api.listVendorAllowlist());
  }

  async function handleDeleteVendor(id: number) {
    await api.deleteVendorEntry(id);
    setVendors(await api.listVendorAllowlist());
  }

  return (
    <div className="space-y-10">

      <section className="rounded-lg border border-gray-700 bg-gray-900/50 p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium">Monitored Sites</h2>
            <p className="mt-1 text-sm text-gray-500">Sites scanned for malvertising evasion techniques</p>
          </div>
          <button className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium hover:bg-blue-500" onClick={() => setShowAddSite(true)}>Add Site</button>
        </div>
        {sites.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">No sites configured. Add one to start scanning.</p>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-700 text-left text-gray-500">
              <th className="pb-2">Site</th><th className="pb-2">Interval</th><th className="pb-2">Retention</th><th className="pb-2">Status</th><th className="pb-2">Actions</th>
            </tr></thead>
            <tbody>
              {sites.map(s => editingSiteId === s.id ? (
                <EditSiteRow key={s.id} site={s} onSave={handleEditSite} onCancel={() => setEditingSiteId(null)} />
              ) : (
                <tr key={s.id} className="border-b border-gray-800/50">
                  <td className="py-2">
                    <div className="font-medium">{s.display_name || s.fqdn}</div>
                    {s.display_name && <div className="text-xs text-gray-500">{s.fqdn}</div>}
                  </td>
                  <td className="py-2">{Math.round(s.scan_interval_seconds / 60)}m</td>
                  <td className="py-2">{s.retention_days}d</td>
                  <td className="py-2">
                    <button className={`rounded px-2 py-0.5 text-xs ${s.is_active ? 'bg-green-900/50 text-green-300' : 'bg-gray-800 text-gray-500'}`} onClick={() => handleToggleSite(s)}>
                      {s.is_active ? 'Active' : 'Paused'}
                    </button>
                  </td>
                  <td className="py-2">
                    <div className="flex gap-3">
                      <button className="text-xs text-blue-400 hover:text-blue-300" onClick={() => setEditingSiteId(s.id)}>Edit</button>
                      <button className="text-xs text-red-400 hover:text-red-300" onClick={() => handleDeleteSite(s.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="rounded-lg border border-gray-700 bg-gray-900/50 p-6">
        <div className="mb-4">
          <h2 className="text-lg font-medium">Vendor Allowlist</h2>
          <p className="mt-1 text-sm text-gray-500">Known verification vendors receive tier-gated score discounts</p>
        </div>
        <div className="mb-4 flex gap-2">
          <input className="flex-1 rounded border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm" placeholder="*.vendor.com" value={newPattern} onChange={e => setNewPattern(e.target.value)} />
          <input className="flex-1 rounded border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm" placeholder="Vendor Name" value={newVendorName} onChange={e => setNewVendorName(e.target.value)} />
          <button className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium hover:bg-blue-500" onClick={handleAddVendor}>Add</button>
        </div>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-700 text-left text-gray-500">
            <th className="pb-2">Pattern</th><th className="pb-2">Vendor</th><th className="pb-2">Type</th><th className="pb-2">Status</th><th className="pb-2">Actions</th>
          </tr></thead>
          <tbody>
            {vendors.map(v => (
              <tr key={v.id} className="border-b border-gray-800/50">
                <td className="py-2 font-mono text-xs">{v.domain_pattern}</td>
                <td className="py-2">{v.vendor_name}</td>
                <td className="py-2">{v.is_builtin ? <span className="rounded bg-gray-800 px-2 py-0.5 text-xs text-gray-400">Built-in</span> : <span className="text-xs text-gray-500">Custom</span>}</td>
                <td className="py-2">
                  <button className={`rounded px-2 py-0.5 text-xs ${v.is_active ? 'bg-green-900/50 text-green-300' : 'bg-gray-800 text-gray-500'}`} onClick={() => handleToggleVendor(v)}>
                    {v.is_active ? 'Active' : 'Disabled'}
                  </button>
                </td>
                <td className="py-2">
                  {!v.is_builtin && <button className="text-xs text-red-400 hover:text-red-300" onClick={() => handleDeleteVendor(v.id)}>Delete</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {showAddSite && <AddSiteModal onAdd={handleAddSite} onClose={() => setShowAddSite(false)} />}
    </div>
  );
}
