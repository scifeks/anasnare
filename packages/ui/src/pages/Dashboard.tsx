import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { WeightBadge } from '../components/WeightBadge.js';
import { TimelineChart } from '../components/TimelineChart.js';
import type { DashboardStats, TimelinePoint, Detection, Site } from '../types.js';

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [recentDetections, setRecentDetections] = useState<Detection[]>([]);
  const [sites, setSites] = useState<Site[]>([]);

  useEffect(() => {
    api.dashboard().then(setStats);
    api.timeline().then(setTimeline);
    api.listDetections({ limit: '20' }).then(r => setRecentDetections(r.data));
    api.listSites().then(setSites);
  }, []);

  if (!stats) return <div className="text-gray-400">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Sites', value: stats.total_sites },
          { label: 'Active Sites', value: stats.active_sites },
          { label: 'Detections (24h)', value: stats.detections_24h },
          { label: 'Tier 1 (24h)', value: stats.tier1_24h },
        ].map(c => (
          <div key={c.label} className="rounded-lg border border-gray-800 bg-gray-900 p-4">
            <div className="text-sm text-gray-400">{c.label}</div>
            <div className="mt-1 text-2xl font-bold">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
        <h2 className="mb-4 text-sm font-medium text-gray-400">Detection Timeline (48h)</h2>
        <TimelineChart data={timeline} />
      </div>

      {stats.top_threat_scripts.length > 0 && (
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <h2 className="mb-4 text-sm font-medium text-gray-400">Top Threat Scripts</h2>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-800 text-left text-gray-500">
              <th className="pb-2">Script</th><th className="pb-2">Score</th><th className="pb-2">Categories</th><th className="pb-2">Signals</th><th className="pb-2">Allowlisted</th>
            </tr></thead>
            <tbody>
              {stats.top_threat_scripts.map(s => (
                <tr key={s.id} className="border-b border-gray-800/50">
                  <td className="py-2 font-mono text-xs truncate max-w-xs">{s.script_url}</td>
                  <td className="py-2">{s.threat_score.toFixed(2)}</td>
                  <td className="py-2">{s.category_count}</td>
                  <td className="py-2">{s.signal_count}</td>
                  <td className="py-2">{s.is_vendor_allowlisted ? 'Yes' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
        <h2 className="mb-4 text-sm font-medium text-gray-400">Recent Detections</h2>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-800 text-left text-gray-500">
            <th className="pb-2">Time</th><th className="pb-2">Category</th><th className="pb-2">Signal</th><th className="pb-2">Weight</th><th className="pb-2">Script</th>
          </tr></thead>
          <tbody>
            {recentDetections.map(d => (
              <tr key={d.id} className="border-b border-gray-800/50">
                <td className="py-2 text-xs text-gray-400">{new Date(d.detected_at).toLocaleTimeString()}</td>
                <td className="py-2">{d.category}</td>
                <td className="py-2"><Link to={`/detections/${d.id}`} className="text-blue-400 hover:underline">{d.signal_name}</Link></td>
                <td className="py-2"><WeightBadge weight={d.weight} /></td>
                <td className="py-2 font-mono text-xs truncate max-w-xs">{d.source_script_url}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {sites.map(s => (
          <Link key={s.id} to={`/sites/${s.id}`} className="rounded-lg border border-gray-800 bg-gray-900 p-4 hover:border-gray-700">
            <div className="font-medium">{s.display_name || s.fqdn}</div>
            <div className="mt-1 text-xs text-gray-400">{s.fqdn}</div>
            <div className="mt-2 text-xs text-gray-500">{s.is_active ? 'Active' : 'Paused'}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
