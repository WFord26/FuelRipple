import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePageSEO } from '../hooks/usePageSEO';
import { format, parseISO } from 'date-fns';
import {
  getSupplyHealth,
  getSupplyUtilization,
  getSupplyInventories,
  getSupplyProduction,
} from '../api/client';
import { ChartContainer, UtilizationAreaChart, PriceLineChart } from '../components/charts';

// ── Helpers ────────────────────────────────────────────────────────────────

const PADD_NAMES: Record<string, string> = {
  R10: 'East Coast',
  R20: 'Midwest',
  R30: 'Gulf Coast',
  R40: 'Rocky Mountain',
  R50: 'West Coast',
  US:  'National',
};

const PADD_SHORT: Record<string, string> = {
  R10: 'E. Coast', R20: 'Midwest', R30: 'Gulf Coast',
  R40: 'Rocky Mtn', R50: 'W. Coast', US: 'National',
};

const CLASS_COLOR: Record<string, string> = {
  normal:        'text-green-400  bg-green-500/15  border-green-500/30',
  elevated_risk: 'text-yellow-400 bg-yellow-500/15 border-yellow-500/30',
  supply_stress: 'text-orange-400 bg-orange-500/15 border-orange-500/30',
  critical:      'text-red-400    bg-red-500/15    border-red-500/30',
};

const CLASS_BAR: Record<string, string> = {
  normal:        'bg-green-500',
  elevated_risk: 'bg-yellow-400',
  supply_stress: 'bg-orange-500',
  critical:      'bg-red-500',
};

const CLASS_LABEL: Record<string, string> = {
  normal:        'Normal',
  elevated_risk: 'Elevated Risk',
  supply_stress: 'Supply Stress',
  critical:      'Critical',
};

const BANNER_BG: Record<string, string> = {
  normal:        'from-green-900/40  to-slate-900 border-green-700/40',
  elevated_risk: 'from-yellow-900/40 to-slate-900 border-yellow-700/40',
  supply_stress: 'from-orange-900/40 to-slate-900 border-orange-700/40',
  critical:      'from-red-900/50    to-slate-900 border-red-700/50',
};

function fmtNum(val: number | null | undefined, decimals = 1) {
  if (val == null) return '—';
  return val.toFixed(decimals);
}

function ZBadge({ z }: { z: number }) {
  const cls =
    z > -0.5 ? 'text-green-400 bg-green-500/10' :
    z > -1.5 ? 'text-yellow-400 bg-yellow-500/10' :
    z > -2.5 ? 'text-orange-400 bg-orange-500/10' :
               'text-red-400 bg-red-500/10';
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${cls}`}>
      {z >= 0 ? '+' : ''}{z.toFixed(2)}σ
    </span>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function UtilCard({ r }: { r: any }) {
  // Derive classification from z-scores if the server didn't provide one
  const cls = r.classification
    ?? ((): string => {
      const z = r.stress_z_score ?? r.util_z ?? 0;
      if (z <= -2.5) return 'critical';
      if (z <= -1.5) return 'supply_stress';
      if (z <= -0.5) return 'elevated_risk';
      return 'normal';
    })();
  const util = r.utilization_pct ?? 0;
  return (
    <div className={`bg-slate-800 rounded-lg p-4 border ${CLASS_COLOR[cls]}`}>
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="text-xs text-slate-400 mb-0.5">{PADD_SHORT[r.region]}</div>
          <div className="text-sm font-semibold text-white">{PADD_NAMES[r.region]}</div>
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded border ${CLASS_COLOR[cls]}`}>
          {CLASS_LABEL[cls]}
        </span>
      </div>

      {/* Utilization gauge bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-slate-400 mb-1">
          <span>Utilization</span>
          <span className="text-white font-bold">{fmtNum(util)}%</span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${CLASS_BAR[cls]}`}
            style={{ width: `${Math.min(util, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-500 mt-0.5">
          <span>52w avg: {fmtNum(r.avg_utilization_52w)}%</span>
          <ZBadge z={r.util_z ?? r.stress_z_score ?? 0} />
        </div>
      </div>

      {/* Stocks */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <div className="text-slate-500">Gas Stocks</div>
          <div className="text-slate-200 font-medium">
            {r.gasoline_stocks ? (r.gasoline_stocks / 1000).toFixed(1) + 'M bbl' : '—'}
          </div>
        </div>
        <div>
          <div className="text-slate-500">Dist. Stocks</div>
          <div className="text-slate-200 font-medium">
            {r.distillate_stocks ? (r.distillate_stocks / 1000).toFixed(1) + 'M bbl' : '—'}
          </div>
        </div>
        {r.crude_inputs && (
          <div className="col-span-2">
            <div className="text-slate-500">Crude Inputs</div>
            <div className="text-slate-200 font-medium">{r.crude_inputs.toLocaleString()} MBBL/D</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

const INVENTORY_REGIONS = ['US', 'R10', 'R20', 'R30', 'R40', 'R50'];

export default function Supply() {
  usePageSEO({
    title: 'Refinery Supply Health Monitor',
    description: 'Track US refinery utilization, gasoline and distillate production, and inventory levels by PADD region. Early warning supply stress alerts before retail price spikes.',
    canonicalPath: '/supply',
  });

  const [invRegion, setInvRegion] = useState('US');
  const [invWeeks, setInvWeeks] = useState(52);

  const { data: health, isLoading: healthLoading } = useQuery({
    queryKey: ['supplyHealth'],
    queryFn: getSupplyHealth,
    staleTime: 60 * 60 * 1000,
  });

  const { data: utilData } = useQuery({
    queryKey: ['supplyUtilization'],
    queryFn: () => getSupplyUtilization(),
    staleTime: 60 * 60 * 1000,
  });

  const { data: invData } = useQuery({
    queryKey: ['supplyInventories', invRegion, invWeeks],
    queryFn: () => getSupplyInventories(invRegion, invWeeks),
    staleTime: 60 * 60 * 1000,
  });

  const { data: prodData } = useQuery({
    queryKey: ['supplyProduction', 'US'],
    queryFn: () => getSupplyProduction('US', 52),
    staleTime: 60 * 60 * 1000,
  });

  // Merge health regions with utilization data (health has stocks, util has 52w avg)
  const regionRows: any[] = (() => {
    const regions = health?.regions ?? [];
    const utilMap = new Map((utilData ?? []).map((r: any) => [r.region, r]));
    return regions.map((r: any) => ({
      ...r,
      ...(utilMap.get(r.region) ?? {}),
      // health has classification, utilization_pct, stocks
      classification: r.classification,
    }));
  })();

  // --- Chart data ---
  const invChartData = [...(invData ?? [])].reverse().map((r: any) => ({
    date: format(parseISO(r.time), 'MMM d'),
    gasoline: r.gasoline_stocks,
    distillate: r.distillate_stocks,
    gasAvg: r.gasoline_stocks_52w_avg ? Math.round(r.gasoline_stocks_52w_avg) : null,
  }));

  const prodChartData = [...(prodData ?? [])].reverse().map((r: any) => ({
    date: format(parseISO(r.time), 'MMM d'),
    gasoline: r.gasoline_production,
    distillate: r.distillate_production,
    gasAvg: r.gasoline_prod_4w_avg ? Math.round(r.gasoline_prod_4w_avg) : null,
  }));

  const overall = health?.overall ?? 'normal';
  const latestDate = health?.regions?.[0]?.latest_data_time
    ? format(parseISO(health.regions[0].latest_data_time), 'MMM d, yyyy')
    : 'Loading…';

  if (healthLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-slate-400">Loading supply data…</div>
      </div>
    );
  }

  // Ordered: US first, then PADDs
  const orderedRegions = [
    ...regionRows.filter((r: any) => r.region === 'US'),
    ...regionRows.filter((r: any) => r.region !== 'US').sort((a: any, b: any) => a.region.localeCompare(b.region)),
  ];

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div>
        <h2 className="text-3xl font-bold text-white mb-1">Supply Monitor</h2>
        <p className="text-slate-400">Refinery utilization, petroleum inventories &amp; production — EIA WPSR</p>
      </div>

      {/* ── Overall Health Banner ── */}
      <div className={`bg-gradient-to-r ${BANNER_BG[overall]} rounded-xl p-6 border`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs text-slate-400 mb-1">Overall Supply Status · Week of {latestDate}</div>
            <div className={`text-2xl font-bold ${CLASS_COLOR[overall].split(' ')[0]}`}>
              {CLASS_LABEL[overall]}
            </div>
            <div className="text-sm text-slate-400 mt-1">
              {health?.meta?.classifications?.[overall]}
            </div>
          </div>
          {/* Mini region status pills */}
          <div className="flex flex-wrap gap-2">
            {orderedRegions.map((r: any) => (
              <div
                key={r.region}
                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${CLASS_COLOR[r.classification]}`}
              >
                {PADD_SHORT[r.region]}
                <span className="ml-1.5 opacity-70">
                  {fmtNum(r.utilization_pct)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Supply-Squeeze Alert ── */}
      {health?.squeezeAlert?.active && (
        <div className="bg-red-900/30 border border-red-700/60 rounded-xl p-5 flex items-start gap-4">
          <span className="text-2xl shrink-0">⚠️</span>
          <div>
            <div className="text-sm font-bold text-red-300 mb-1">Supply Squeeze Alert</div>
            <p className="text-sm text-slate-300">
              Inventory <span className="font-semibold">and</span> refinery utilization are simultaneously below seasonal norms
              in <span className="font-semibold text-white">
                {health.squeezeAlert.regions.map((r: string) => PADD_NAMES[r] ?? r).join(', ')}
              </span>. This dual-stress condition is the strongest historical predictor of near-term retail price increases (1–2 week lead time).
            </p>
          </div>
        </div>
      )}

      {/* ── PADD Utilization Grid ── */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Refinery Utilization by Region</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {orderedRegions.map((r: any) => <UtilCard key={r.region} r={r} />)}
        </div>
      </div>

      {/* ── Inventories Section ── */}
      <ChartContainer
        title="Petroleum Inventories"
        subtitle="Weekly ending stocks in thousand barrels"
        height={280}
        isLoading={false}
        isEmpty={invChartData.length === 0}
        emptyMessage="No inventory data available"
        actions={
          <div className="flex items-center gap-3">
            {/* Region selector */}
            <select
              aria-label="Select inventory region"
              value={invRegion}
              onChange={e => setInvRegion(e.target.value)}
              className="bg-slate-700 text-slate-200 text-sm rounded-lg px-3 py-1.5 border border-slate-600 focus:outline-none focus:border-primary-500"
            >
              {INVENTORY_REGIONS.map(r => (
                <option key={r} value={r}>{PADD_NAMES[r]}</option>
              ))}
            </select>
            {/* Time range */}
            <select
              aria-label="Select time range for inventory data"
              value={invWeeks}
              onChange={e => setInvWeeks(Number(e.target.value))}
              className="bg-slate-700 text-slate-200 text-sm rounded-lg px-3 py-1.5 border border-slate-600 focus:outline-none focus:border-primary-500"
            >
              <option value={26}>6 Months</option>
              <option value={52}>1 Year</option>
              <option value={104}>2 Years</option>
            </select>
          </div>
        }
      >
        {invChartData.length > 0 && (
          <UtilizationAreaChart
            data={invChartData}
            series={[
              { key: 'gasoline', name: 'Gasoline Stocks', dataKey: 'gasoline', color: '#3b82f6' },
              { key: 'distillate', name: 'Distillate Stocks', dataKey: 'distillate', color: '#a78bfa' },
            ]}
            xAxisKey="date"
            yAxisTickFormatter={(v) => `${(v as number / 1000).toFixed(0)}M`}
            tooltip={{
              formatter: (val) => `${(val as number).toLocaleString()} Mbbl`,
            }}
          />
        )}
      </ChartContainer>

      {/* ── Production Section ── */}
      <ChartContainer
        title="US Refinery Production"
        subtitle="Weekly output in thousand barrels per day (MBBL/D)"
        height={260}
        isEmpty={prodChartData.length === 0}
        emptyMessage="No production data available"
      >
        {prodChartData.length > 0 && (
          <PriceLineChart
            data={prodChartData}
            series={[
              { key: 'gasoline', name: 'Gasoline Prod.', dataKey: 'gasoline', color: '#22c55e' },
              { key: 'distillate', name: 'Distillate Prod.', dataKey: 'distillate', color: '#f59e0b' },
            ]}
            xAxisKey="date"
            yAxisTickFormatter={(v) => `${(v as number).toLocaleString()}`}
            tooltip={{
              formatter: (val) => `${(val as number).toLocaleString()} MBBL/D`,
            }}
          />
        )}
      </ChartContainer>

      {/* ── Classifications Key ── */}
      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
        <div className="text-xs text-slate-500 mb-2 font-semibold uppercase tracking-wide">Supply Status Key</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          {Object.entries(CLASS_LABEL).map(([key, label]) => (
            <div key={key} className="flex items-start gap-2">
              <div className={`w-2 h-2 rounded-full mt-0.5 shrink-0 ${CLASS_BAR[key]}`} />
              <div>
                <div className={`font-semibold ${CLASS_COLOR[key].split(' ')[0]}`}>{label}</div>
                <div className="text-slate-500">{health?.meta?.classifications?.[key] ?? ''}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
