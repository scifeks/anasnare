import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { DetectionTable } from '../components/DetectionTable.js';
import { TimelineChart } from '../components/TimelineChart.js';
import type { Site, Scan, Detection, TimelinePoint } from '../types.js';

export function SiteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [site, setSite] = useState<Site | null>(null);
  const [scans, setScans] = useState<Scan[]>([]);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);

  useEffect(() => {
    if (!id) return;
    api.getSite(Number(id)).then(setSite);
    api.listScans({ site_id: id, limit: '20' }).then(r => setScans(r.data));
    api.listDetections({ site_id: id, limit: '50' }).then(r => setDetections(r.data));
    api.timeline({ site_id: id }).then(setTimeline);
  }, [id]);

  if (!site) return <div className="text-gray-400">Loading...</div>;

  async function toggleActive() {
    if (!site) return;
    const updated = await api.updateSite(site.id, { is_active: site.is_active ? 0 : 1 });
    setSite(updated);
  }

  async function handleDelete() {
    if (!site || !confirm(`Delete ${site.fqdn}?`)) return;
    await api.deleteSite(site.id);
    navigate('/');
  }

  async function handleScanNow() {
    if (!site) return;
    await api.triggerScan(site.id);
    api.listScans({ site_id: String(site.id), limit: '20' }).then(r => setScans(r.data));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{site.display_name || site.fqdn}</h1>
          <div className="text-sm text-gray-400">{site.fqdn}</div>
        </div>
        <div className="flex gap-2">
          <button className="rounded border border-gray-700 px-3 py-1.5 text-sm hover:bg-gray-800" onClick={toggleActive}>{site.is_active ? 'Pause' : 'Resume'}</button>
          <button className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium hover:bg-blue-500" onClick={handleScanNow}>Scan Now</button>
          <button className="rounded border border-red-800 px-3 py-1.5 text-sm text-red-400 hover:bg-red-900/30" onClick={handleDelete}>Delete</button>
        </div>
      </div>

      <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
        <h2 className="mb-4 text-sm font-medium text-gray-400">Detection Timeline</h2>
        <TimelineChart data={timeline} />
      </div>

      <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
        <h2 className="mb-4 text-sm font-medium text-gray-400">Scan History</h2>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-800 text-left text-gray-500">
            <th className="pb-2">Time</th><th className="pb-2">Status</th><th className="pb-2">Detections</th><th className="pb-2">Scripts</th>
          </tr></thead>
          <tbody>
            {scans.map(s => (
              <tr key={s.id} className="border-b border-gray-800/50">
                <td className="py-2 text-xs text-gray-400">{new Date(s.started_at).toLocaleString()}</td>
                <td className="py-2"><span className={`rounded px-2 py-0.5 text-xs ${s.status === 'completed' ? 'bg-green-900/50 text-green-300' : s.status === 'failed' ? 'bg-red-900/50 text-red-300' : 'bg-yellow-900/50 text-yellow-300'}`}>{s.status}</span></td>
                <td className="py-2">{s.detection_count}</td>
                <td className="py-2">{s.scripts_analyzed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
        <h2 className="mb-4 text-sm font-medium text-gray-400">Recent Detections</h2>
        <DetectionTable detections={detections} />
      </div>
    </div>
  );
}
