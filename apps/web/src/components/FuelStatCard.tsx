import { ReactNode } from 'react';

interface FuelStatCardProps {
  label: string;
  current: number;
  min: number;
  max: number;
  avg: number;
  change: number;
  change7d: number;
  change30d: number;
  color: string;
  borderColor: string;
  icon?: ReactNode;
}

export function FuelStatCard({
  label,
  current,
  min,
  max,
  avg,
  change,
  change7d,
  change30d,
  color,
  borderColor,
}: FuelStatCardProps) {
  const formatChangeColor = (value: number) => {
    if (value >= 2) return 'text-red-400';
    if (value > 0) return 'text-orange-400';
    if (value <= -2) return 'text-green-400';
    return 'text-emerald-400';
  };

  const formatChangeBg = (value: number) => {
    if (value >= 2) return 'bg-red-500/20';
    if (value > 0) return 'bg-orange-500/20';
    if (value <= -2) return 'bg-green-500/20';
    return 'bg-emerald-500/20';
  };

  return (
    <div className={`bg-slate-800 rounded-lg p-4 border border-slate-700 ${borderColor}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-6 rounded" style={{ backgroundColor: color }} />
          <h4 className="text-sm font-semibold text-white">{label}</h4>
        </div>
      </div>

      {/* Current Price */}
      <div className="mb-4">
        <p className="text-3xl font-bold text-white">${current.toFixed(2)}</p>
        <div className={`inline-block mt-2 px-2 py-0.5 rounded text-xs font-semibold ${
          formatChangeBg(change)
        } ${formatChangeColor(change)}`}>
          {change >= 0 ? '+' : ''}{change.toFixed(1)}% period
        </div>
      </div>

      {/* Time-Series Changes */}
      <div className="grid grid-cols-3 gap-2 mb-4 pb-4 border-b border-slate-700">
        <div>
          <div className="text-xs text-slate-500 font-medium">7-day</div>
          <div className={`text-sm font-semibold ${formatChangeColor(change7d)}`}>
            {change7d >= 0 ? '+' : ''}{change7d.toFixed(1)}%
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500 font-medium">30-day</div>
          <div className={`text-sm font-semibold ${formatChangeColor(change30d)}`}>
            {change30d >= 0 ? '+' : ''}{change30d.toFixed(1)}%
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500 font-medium">Range</div>
          <div className="text-sm font-semibold text-slate-300">
            ${(max - min).toFixed(2)}
          </div>
        </div>
      </div>

      {/* Min, Max, Average */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <div className="text-slate-500 font-medium">Min</div>
          <div className="text-slate-300 font-semibold">${min.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-slate-500 font-medium">Avg</div>
          <div className="text-slate-300 font-semibold">${avg.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-slate-500 font-medium">Max</div>
          <div className="text-slate-300 font-semibold">${max.toFixed(2)}</div>
        </div>
      </div>
    </div>
  );
}
