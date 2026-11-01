import { getTierLabel, getTierColor } from '../types.js';

const colorClasses = {
  red: 'bg-red-900/50 text-red-300 border-red-700',
  amber: 'bg-amber-900/50 text-amber-300 border-amber-700',
  blue: 'bg-blue-900/50 text-blue-300 border-blue-700',
};

export function WeightBadge({ weight }: { weight: number }) {
  const color = getTierColor(weight);
  const label = getTierLabel(weight);
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium ${colorClasses[color]}`}>
      {weight.toFixed(2)} <span className="opacity-70">{label}</span>
    </span>
  );
}
