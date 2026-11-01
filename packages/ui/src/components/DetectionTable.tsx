import { Link } from 'react-router-dom';
import { WeightBadge } from './WeightBadge.js';
import type { Detection } from '../types.js';

export function DetectionTable({ detections }: { detections: Detection[] }) {
  if (detections.length === 0) return <div className="text-sm text-gray-500">No detections</div>;
  return (
    <table className="w-full text-sm">
      <thead><tr className="border-b border-gray-800 text-left text-gray-500">
        <th className="pb-2">Time</th><th className="pb-2">Category</th><th className="pb-2">Signal</th><th className="pb-2">Weight</th><th className="pb-2">Script</th>
      </tr></thead>
      <tbody>
        {detections.map(d => (
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
  );
}
