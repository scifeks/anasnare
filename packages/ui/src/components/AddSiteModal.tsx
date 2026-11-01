import { useState } from 'react';

interface Props {
  onAdd: (fqdn: string, displayName: string, interval: number) => void;
  onClose: () => void;
}

const INTERVALS = [
  { label: '5 min', value: 300 }, { label: '15 min', value: 900 },
  { label: '30 min', value: 1800 }, { label: '1 hour', value: 3600 },
  { label: '4 hours', value: 14400 }, { label: '12 hours', value: 43200 },
  { label: '24 hours', value: 86400 },
];

export function AddSiteModal({ onAdd, onClose }: Props) {
  const [fqdn, setFqdn] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [interval, setInterval] = useState(1800);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-96 rounded-lg border border-gray-700 bg-gray-900 p-6">
        <h2 className="mb-4 text-lg font-medium">Add Site</h2>
        <div className="space-y-3">
          <input className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm" placeholder="example.com" value={fqdn} onChange={e => setFqdn(e.target.value)} />
          <input className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm" placeholder="Display name (optional)" value={displayName} onChange={e => setDisplayName(e.target.value)} />
          <select className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm" value={interval} onChange={e => setInterval(Number(e.target.value))}>
            {INTERVALS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
          </select>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button className="rounded px-3 py-1.5 text-sm text-gray-400 hover:text-white" onClick={onClose}>Cancel</button>
          <button className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium hover:bg-blue-500" onClick={() => { if (fqdn.trim()) onAdd(fqdn.trim(), displayName.trim(), interval); }}>Add</button>
        </div>
      </div>
    </div>
  );
}
