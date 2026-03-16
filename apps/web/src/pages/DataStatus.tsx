import { useQuery } from '@tanstack/react-query';
import { getDataStatus } from '../api/client';
import { usePageSEO } from '../hooks/usePageSEO';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function freshness(iso: string): { label: string; color: string } {
  const diff = Date.now() - new Date(iso).getTime();
  const hrs = diff / 3_600_000;
  if (hrs < 24) return { label: 'Fresh', color: 'bg-green-500' };
  if (hrs < 72) return { label: 'Recent', color: 'bg-yellow-500' };
  if (hrs < 168) return { label: 'Stale', color: 'bg-orange-500' };
  return { label: 'Old', color: 'bg-red-500' };
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

const SOURCE_LABELS: Record<string, string> = {
  eia: 'EIA (Energy Information Administration)',
  fred: 'FRED (Federal Reserve Economic Data)',
  aaa: 'AAA (American Automobile Association)',
  yahoo: 'Yahoo Finance',
  oilprice: 'OilPrice API',
};

const METRIC_LABELS: Record<string, string> = {
  gas_regular: 'Regular Gasoline',
  gas_midgrade: 'Mid-Grade Gasoline',
  gas_premium: 'Premium Gasoline',
  diesel: 'Diesel',
  crude_wti: 'Crude Oil (WTI)',
  crude_brent: 'Crude Oil (Brent)',
};

export default function DataStatus() {
  usePageSEO({
    title: 'Data Status — FuelRipple',
    description: 'Data freshness and collection status for all energy price data sources in FuelRipple.',
    canonicalPath: '/data-status',
  });

  const { data: statusRows, isLoading, error } = useQuery({
    queryKey: ['dataStatus'],
    queryFn: getDataStatus,
    refetchInterval: 60_000, // refresh every minute
  });

  // Group by source
  const grouped = statusRows?.reduce<Record<string, typeof statusRows>>((acc, row) => {
    (acc[row.source] ??= []).push(row);
    return acc;
  }, {}) ?? {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-1">Data Status</h1>
        <p className="text-slate-400">Last update times and row counts for each data source, metric, and region level.</p>
      </div>

      {isLoading && (
        <div className="animate-pulse space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-40 bg-slate-800 rounded-xl" />
          ))}
        </div>
      )}

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 text-red-300">
          Failed to load data status. Is the API running?
        </div>
      )}

      {!isLoading && statusRows && Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([source, rows]) => (
        <div key={source} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          {/* Source header */}
          <div className="px-5 py-3 bg-slate-800/80 border-b border-slate-700">
            <h2 className="text-lg font-semibold text-white">{SOURCE_LABELS[source] ?? source}</h2>
            <p className="text-xs text-slate-500 font-mono">{source}</p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-700">
              <thead>
                <tr className="text-xs text-slate-400 uppercase tracking-wider">
                  <th className="px-4 py-2.5 text-left">Metric</th>
                  <th className="px-4 py-2.5 text-left">Region Level</th>
                  <th className="px-4 py-2.5 text-right">Regions</th>
                  <th className="px-4 py-2.5 text-right">Total Rows</th>
                  <th className="px-4 py-2.5 text-left">Earliest</th>
                  <th className="px-4 py-2.5 text-left">Latest</th>
                  <th className="px-4 py-2.5 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {rows.sort((a, b) => a.metric.localeCompare(b.metric) || a.region_class.localeCompare(b.region_class)).map((row, idx) => {
                  const fresh = freshness(row.latest_time);
                  return (
                    <tr key={idx} className="hover:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-2.5 text-sm text-white whitespace-nowrap">
                        {METRIC_LABELS[row.metric] ?? row.metric}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-slate-300">{row.region_class}</td>
                      <td className="px-4 py-2.5 text-sm text-slate-300 text-right font-mono tabular-nums">
                        {formatNumber(Number(row.region_count))}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-slate-300 text-right font-mono tabular-nums">
                        {formatNumber(Number(row.total_rows))}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-slate-400 whitespace-nowrap">
                        {new Date(row.earliest_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-slate-300 whitespace-nowrap" title={new Date(row.latest_time).toLocaleString()}>
                        {timeAgo(row.latest_time)}
                        <span className="text-slate-500 ml-1 text-xs">
                          ({new Date(row.latest_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
                          fresh.color === 'bg-green-500' ? 'bg-green-900/50 text-green-300' :
                          fresh.color === 'bg-yellow-500' ? 'bg-yellow-900/50 text-yellow-300' :
                          fresh.color === 'bg-orange-500' ? 'bg-orange-900/50 text-orange-300' :
                          'bg-red-900/50 text-red-300'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${fresh.color}`} />
                          {fresh.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Summary */}
      {statusRows && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Sources', value: new Set(statusRows.map((r) => r.source)).size },
            { label: 'Metrics', value: new Set(statusRows.map((r) => r.metric)).size },
            { label: 'Total Rows', value: statusRows.reduce((sum, r) => sum + Number(r.total_rows), 0) },
            {
              label: 'Freshest Data',
              value: statusRows.length > 0
                ? timeAgo(statusRows.reduce((a, b) => new Date(a.latest_time) > new Date(b.latest_time) ? a : b).latest_time)
                : '—',
            },
          ].map((stat) => (
            <div key={stat.label} className="bg-slate-800 rounded-xl border border-slate-700 p-4">
              <p className="text-xs text-slate-400 uppercase tracking-wider">{stat.label}</p>
              <p className="text-2xl font-bold text-white mt-1">
                {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
