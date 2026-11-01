import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { TimelinePoint } from '../types.js';

export function TimelineChart({ data }: { data: TimelinePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <XAxis dataKey="hour" tick={{ fontSize: 10 }} tickFormatter={h => h.slice(11, 16)} stroke="#6b7280" />
        <YAxis stroke="#6b7280" />
        <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} />
        <Legend />
        <Line type="monotone" dataKey="tier1" name="Tier 1" stroke="#ef4444" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="tier2" name="Tier 2" stroke="#f59e0b" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="tier3" name="Tier 3" stroke="#3b82f6" strokeWidth={1} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
