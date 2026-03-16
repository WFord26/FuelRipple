import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePageSEO } from '../hooks/usePageSEO';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
  Cell, ResponsiveContainer, ComposedChart, Line, Legend,
} from 'recharts';
import {
  getCrudeGasCorrelation, getRocketsAndFeathers,
  getCorrelationPriceSeries, getEvents,
} from '../api/client';

// ── Event category config ─────────────────────────────────────────────────────

const EVENT_CATEGORIES: Record<string, { label: string; color: string; emoji: string }> = {
  opec:      { label: 'OPEC',       color: '#f59e0b', emoji: '🛢️'  },
  sanctions: { label: 'Sanctions',  color: '#ef4444', emoji: '🚫'  },
  hurricane: { label: 'Hurricane',  color: '#8b5cf6', emoji: '🌀'  },
  policy:    { label: 'Policy',     color: '#06b6d4', emoji: '📜'  },
  other:     { label: 'Other',      color: '#94a3b8', emoji: '📌'  },
};

const ALL_CATEGORIES = Object.keys(EVENT_CATEGORIES);

// ── Helpers ──────────────────────────────────────────────────────────────────

function classifyCorrelation(r: number): string {
  const abs = Math.abs(r);
  if (abs >= 0.85) return 'Very strong';
  if (abs >= 0.70) return 'Strong';
  if (abs >= 0.50) return 'Moderate';
  if (abs >= 0.30) return 'Weak';
  return 'Negligible';
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, accent = false,
}: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg p-4 border ${accent
      ? 'bg-amber-900/20 border-amber-700/50'
      : 'bg-slate-700/40 border-slate-600/50'}`}>
      <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-2xl font-bold tabular-nums ${accent ? 'text-amber-300' : 'text-white'}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

interface LagPoint { lag: number; correlation: number; }

function CrossCorrelationChart({
  data, optimalLag,
}: { data: LagPoint[]; optimalLag: number }) {
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const { lag, correlation } = payload[0].payload as LagPoint;
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm shadow-xl">
        <div className="text-slate-300 font-medium">
          {lag === 0 ? 'Same week' : `${lag}-week lag`}
        </div>
        <div className="text-white font-bold tabular-nums">
          r = {correlation.toFixed(3)}
        </div>
        <div className="text-slate-400 text-xs">{classifyCorrelation(correlation)} correlation</div>
        {lag === optimalLag && (
          <div className="text-amber-400 text-xs font-semibold mt-0.5">★ Optimal lag</div>
        )}
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
        <XAxis
          dataKey="lag"
          tick={{ fill: '#94a3b8', fontSize: 12 }}
          tickFormatter={(v: number) => v === 0 ? '0' : `${v}w`}
          label={{ value: 'Lag (weeks)', position: 'insideBottom', offset: -2, fill: '#64748b', fontSize: 12 }}
        />
        <YAxis
          domain={[-0.2, 1]}
          tick={{ fill: '#94a3b8', fontSize: 12 }}
          tickFormatter={(v: number) => v.toFixed(1)}
          label={{ value: 'Pearson r', angle: -90, position: 'insideLeft', offset: 10, fill: '#64748b', fontSize: 12 }}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        <ReferenceLine y={0} stroke="#475569" strokeWidth={1} />
        <Bar dataKey="correlation" radius={[3, 3, 0, 0]}>
          {data.map((entry) => (
            <Cell
              key={`cell-${entry.lag}`}
              fill={entry.lag === optimalLag ? '#f59e0b' : entry.correlation > 0 ? '#3b82f6' : '#ef4444'}
              fillOpacity={entry.lag === optimalLag ? 1 : 0.75}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function RocketsFeathersViz({
  asymmetryRatio,
  riseElasticity, fallElasticity,
  cumulativePassThrough, riseHalfLifeWeeks, fallHalfLifeWeeks,
}: {
  asymmetryRatio: number;
  riseElasticity: number;
  fallElasticity: number;
  cumulativePassThrough: { lag: number; risePct: number; fallPct: number }[];
  riseHalfLifeWeeks: number;
  fallHalfLifeWeeks: number;
}) {
  const maxElasticity = Math.max(riseElasticity, fallElasticity);
  const risePct  = maxElasticity > 0 ? (riseElasticity / maxElasticity) * 100 : 0;
  const fallPct  = maxElasticity > 0 ? (fallElasticity / maxElasticity) * 100 : 0;

  const ratioColor =
    asymmetryRatio > 3 ? 'text-red-400' :
    asymmetryRatio > 2 ? 'text-orange-400' :
    asymmetryRatio > 1.5 ? 'text-yellow-400' : 'text-green-400';

  const ratioLabel =
    asymmetryRatio > 3 ? 'Severe asymmetry' :
    asymmetryRatio > 2 ? 'Strong asymmetry' :
    asymmetryRatio > 1.5 ? 'Moderate asymmetry' : 'Near-symmetric';

  return (
    <div className="space-y-5">
      {/* Elasticity ratio hero */}
      <div className="flex items-center gap-6">
        <div className="text-center min-w-[80px]">
          <div className={`text-5xl font-bold tabular-nums ${ratioColor}`}>
            {asymmetryRatio > 0 ? `${asymmetryRatio.toFixed(1)}×` : '—'}
          </div>
          <div className="text-xs text-slate-400 mt-1 uppercase tracking-wide">Elasticity ratio</div>
          <div className={`text-xs font-semibold mt-0.5 ${ratioColor}`}>{ratioLabel}</div>
        </div>
        <div className="flex-1 text-sm text-slate-400 leading-relaxed">
          When crude rises 1%, gas responds with <span className="text-red-400 font-semibold">{(riseElasticity * 100).toFixed(1)}%</span> at the pump.
          When crude falls 1%, gas only drops <span className="text-green-400 font-semibold">{(fallElasticity * 100).toFixed(1)}%</span>.
          That's a <span className={`font-semibold ${ratioColor}`}>{asymmetryRatio.toFixed(1)}× elasticity gap</span>.
        </div>
      </div>

      {/* Elasticity comparison bars */}
      <div className="space-y-3">
        <div className="space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="flex items-center gap-2 text-red-400 font-medium">
              <span>🚀</span> Rise elasticity (crude ↑)
            </span>
            <span className="text-slate-300 tabular-nums">{(riseElasticity * 100).toFixed(1)}% gas per 1% crude</span>
          </div>
          <div className="h-3 rounded-full bg-slate-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-700"
              style={{ width: `${risePct}%` }}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="flex items-center gap-2 text-green-400 font-medium">
              <span>🪶</span> Fall elasticity (crude ↓)
            </span>
            <span className="text-slate-300 tabular-nums">{(fallElasticity * 100).toFixed(1)}% gas per 1% crude</span>
          </div>
          <div className="h-3 rounded-full bg-slate-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-green-600 to-green-400 transition-all duration-700"
              style={{ width: `${fallPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Cumulative pass-through chart */}
      {cumulativePassThrough.length > 0 && (
        <div className="border-t border-slate-700 pt-4">
          <h4 className="text-sm font-semibold text-slate-300 mb-3">Cumulative Pass-Through Speed</h4>
          <div className="grid grid-cols-5 gap-2 text-center text-xs">
            {cumulativePassThrough.map(({ lag, risePct: rP, fallPct: fP }) => (
              <div key={lag} className="space-y-2">
                <div className="text-slate-500">Week {lag}</div>
                <div className="relative h-24 bg-slate-800 rounded flex items-end justify-center gap-0.5 overflow-hidden">
                  <div
                    className="w-5 bg-gradient-to-t from-red-700 to-red-400 rounded-t transition-all duration-500"
                    style={{ height: `${Math.max(rP, 2)}%` }}
                    title={`Rise: ${rP.toFixed(0)}%`}
                  />
                  <div
                    className="w-5 bg-gradient-to-t from-green-700 to-green-400 rounded-t transition-all duration-500"
                    style={{ height: `${Math.max(fP, 2)}%` }}
                    title={`Fall: ${fP.toFixed(0)}%`}
                  />
                </div>
                <div className="space-y-0.5">
                  <div className="text-red-400 tabular-nums">{rP.toFixed(0)}%</div>
                  <div className="text-green-400 tabular-nums">{fP.toFixed(0)}%</div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-4 mt-2 text-xs text-slate-500 justify-center">
            <span><span className="inline-block w-2 h-2 rounded-sm bg-red-500 mr-1" />Crude ↑</span>
            <span><span className="inline-block w-2 h-2 rounded-sm bg-green-500 mr-1" />Crude ↓</span>
          </div>
        </div>
      )}

      {/* Half-life comparison */}
      {(riseHalfLifeWeeks > 0 || fallHalfLifeWeeks > 0) && (
        <div className="flex gap-4 text-center border-t border-slate-700 pt-4">
          <div className="flex-1 bg-slate-800 rounded-lg p-3">
            <div className="text-2xl font-bold text-red-400 tabular-nums">{riseHalfLifeWeeks}w</div>
            <div className="text-xs text-slate-500 mt-0.5">50% rise pass-through</div>
          </div>
          <div className="flex-1 bg-slate-800 rounded-lg p-3">
            <div className="text-2xl font-bold text-green-400 tabular-nums">{fallHalfLifeWeeks}w</div>
            <div className="text-xs text-slate-500 mt-0.5">50% fall pass-through</div>
          </div>
          <div className="flex-1 bg-slate-800 rounded-lg p-3">
            <div className={`text-2xl font-bold tabular-nums ${fallHalfLifeWeeks > riseHalfLifeWeeks ? 'text-orange-400' : 'text-green-400'}`}>
              {fallHalfLifeWeeks > riseHalfLifeWeeks ? `+${fallHalfLifeWeeks - riseHalfLifeWeeks}w` : '0w'}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">Fall delay</div>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-500 border-t border-slate-700 pt-3">
        <strong>Elasticity ratio</strong> compares how much gas prices move per 1% crude change, 
        up vs down. <strong>Pass-through speed</strong> measures what % of the total gas price 
        adjustment has occurred by each week after a crude shock. An FTC study found pump prices 
        typically rise 4× faster than they fall — the classic "rockets and feathers" effect.
      </p>
    </div>
  );
}

// ── Dual-axis price chart with event overlays ────────────────────────────────

interface PricePoint { week: string; gas_value: number; crude_value: number; }
interface GeoEventRow {
  id: number;
  event_date: string;
  category: string;
  title: string;
  description?: string;
  impact?: 'bullish' | 'bearish' | 'neutral';
}

function DualAxisPriceChart({
  data, events, activeCategories,
}: { data: PricePoint[]; events: GeoEventRow[]; activeCategories: string[] }) {

  // Format week label
  const fmtWeek = (w: string) => {
    const d = new Date(w);
    return isNaN(d.getTime()) ? w : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
  };

  // Only show one label per event (avoid duplicates on close dates)
  const weekTimestamps = data.map(d => ({ week: d.week, ts: new Date(d.week).getTime() }))
    .filter(d => !isNaN(d.ts));

  const findNearestWeek = (dateStr: string): string | null => {
    const target = new Date(dateStr).getTime();
    if (isNaN(target) || weekTimestamps.length === 0) return null;
    let best = weekTimestamps[0];
    for (const w of weekTimestamps) {
      if (Math.abs(w.ts - target) < Math.abs(best.ts - target)) best = w;
    }
    return Math.abs(best.ts - target) < 45 * 86400_000 ? best.week : null; // within 45 days
  };

  const visibleEvents = events
    .filter(e => activeCategories.includes(e.category))
    .map(e => ({ ...e, nearestWeek: findNearestWeek(e.event_date) }))
    .filter((e): e is typeof e & { nearestWeek: string } => e.nearestWeek !== null);

  // Custom tooltip
  const ChartTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const gasEntry   = payload.find((p: any) => p.dataKey === 'gas_value');
    const crudeEntry = payload.find((p: any) => p.dataKey === 'crude_value');
    return (
      <div className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm shadow-xl">
        <div className="text-slate-400 text-xs mb-1">{fmtWeek(label)}</div>
        {gasEntry   && <div className="text-blue-300">Gas: <span className="text-white font-bold">${gasEntry.value?.toFixed(3)}/gal</span></div>}
        {crudeEntry && <div className="text-amber-300">WTI: <span className="text-white font-bold">${crudeEntry.value?.toFixed(2)}/bbl</span></div>}
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
        <XAxis
          dataKey="week"
          tick={{ fill: '#94a3b8', fontSize: 11 }}
          tickFormatter={fmtWeek}
          interval={Math.floor(data.length / 8)}
        />
        {/* Gas price axis — left */}
        <YAxis
          yAxisId="gas"
          orientation="left"
          tick={{ fill: '#60a5fa', fontSize: 11 }}
          tickFormatter={(v: number) => `$${v.toFixed(2)}`}
          width={52}
          label={{ value: '$/gal', angle: -90, position: 'insideLeft', offset: 12, fill: '#60a5fa', fontSize: 11 }}
        />
        {/* Crude price axis — right */}
        <YAxis
          yAxisId="crude"
          orientation="right"
          tick={{ fill: '#fbbf24', fontSize: 11 }}
          tickFormatter={(v: number) => `$${v.toFixed(0)}`}
          width={48}
          label={{ value: '$/bbl', angle: 90, position: 'insideRight', offset: 12, fill: '#fbbf24', fontSize: 11 }}
        />
        <Tooltip content={<ChartTooltip />} />
        <Legend
          formatter={(value) =>
            value === 'gas_value' ? 'US Regular Gas ($/gal)' : 'WTI Crude ($/bbl)'
          }
          wrapperStyle={{ fontSize: 12, color: '#94a3b8', paddingTop: 8 }}
        />
        <Line
          yAxisId="gas"
          type="monotone"
          dataKey="gas_value"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          yAxisId="crude"
          type="monotone"
          dataKey="crude_value"
          stroke="#f59e0b"
          strokeWidth={1.5}
          dot={false}
          activeDot={{ r: 4 }}
          strokeDasharray="4 2"
        />
        {visibleEvents.map(ev => {
          const cfg = EVENT_CATEGORIES[ev.category] ?? EVENT_CATEGORIES.other;
          return (
            <ReferenceLine
              key={ev.id}
              yAxisId="gas"
              x={ev.nearestWeek}
              stroke={cfg.color}
              strokeWidth={1.5}
              strokeDasharray="3 2"
              label={{
                value: cfg.emoji,
                position: 'top',
                fill: cfg.color,
                fontSize: 13,
              }}
            />
          );
        })}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ── Skeleton loader ───────────────────────────────────────────────────────────

function SkeletonBlock({ h = 'h-48' }: { h?: string }) {
  return <div className={`${h} rounded-xl bg-slate-700/40 animate-pulse`} />;
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Correlation() {
  usePageSEO({
    title: 'Crude Oil to Gas Price Correlation & Lag Analysis',
    description: 'Analyze the lag between WTI crude oil price changes and retail gasoline pump prices. Includes rockets-and-feathers asymmetry analysis and geopolitical event overlays.',
    canonicalPath: '/correlation',
  });

  const [region, setRegion] = useState('US');
  const [activeCategories, setActiveCategories] = useState<string[]>(ALL_CATEGORIES);

  const {
    data: corrData,
    isLoading: corrLoading,
    isError: corrError,
  } = useQuery({
    queryKey: ['crudeGasCorrelation', region],
    queryFn: () => getCrudeGasCorrelation(region, 12),
    staleTime: 60 * 60 * 1000,
  });

  const {
    data: rfData,
    isLoading: rfLoading,
    isError: rfError,
  } = useQuery({
    queryKey: ['rocketsFeathers', region],
    queryFn: () => getRocketsAndFeathers(region),
    staleTime: 60 * 60 * 1000,
  });

  const {
    data: priceSeries = [],
    isLoading: seriesLoading,
  } = useQuery({
    queryKey: ['correlationPriceSeries', region],
    queryFn: () => getCorrelationPriceSeries(region, 520), // 10 years
    staleTime: 60 * 60 * 1000,
  });

  const {
    data: allEvents = [],
  } = useQuery({
    queryKey: ['geoEvents'],
    queryFn: () => getEvents(),
    staleTime: 24 * 60 * 60 * 1000,
  });

  // Derived
  const crossCorr: LagPoint[]  = corrData?.crossCorrelation ?? [];
  const optimalLag: number     = corrData?.optimalLag ?? 0;
  const optimalR: number       = corrData?.optimalCorrelation ?? 0;
  const rSquared: number       = optimalR * optimalR;

  // Normalize event_date to YYYY-MM-DD string
  const events: GeoEventRow[] = useMemo(() =>
    (allEvents as any[]).map(e => ({
      ...e,
      event_date: typeof e.event_date === 'string'
        ? e.event_date.slice(0, 10)
        : new Date(e.event_date).toISOString().slice(0, 10),
    })),
    [allEvents]
  );

  const toggleCategory = (cat: string) => {
    setActiveCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const rf = rfData?.data ?? rfData;
  const asymmetryRatio: number = rf?.elasticityRatio ?? rf?.asymmetryRatio ?? 0;
  const riseElasticity: number = rf?.riseElasticity ?? 0;
  const fallElasticity: number = rf?.fallElasticity ?? 0;
  const cumulativePassThrough: { lag: number; risePct: number; fallPct: number }[] =
    rf?.cumulativePassThrough ?? [];
  const riseHalfLifeWeeks: number = rf?.riseHalfLifeWeeks ?? 0;
  const fallHalfLifeWeeks: number = rf?.fallHalfLifeWeeks ?? 0;

  const hasCorr = !corrLoading && !corrError && crossCorr.length > 0;
  const hasRf   = !rfLoading  && !rfError  && asymmetryRatio > 0;

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Market Correlation</h2>
          <p className="text-slate-400">
            Crude oil → pump price lag analysis and rockets-and-feathers asymmetry
          </p>
        </div>

        {/* Region selector */}
        <select
          value={region}
          onChange={e => setRegion(e.target.value)}
          className="bg-slate-800 border border-slate-600 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Select region"
          title="Select region"
        >
          <option value="US">🇺🇸 National (US)</option>
          <option value="R10">PADD 1 — East Coast</option>
          <option value="R20">PADD 2 — Midwest</option>
          <option value="R30">PADD 3 — Gulf Coast</option>
          <option value="R40">PADD 4 — Rocky Mountain</option>
          <option value="R50">PADD 5 — West Coast</option>
        </select>
      </div>

      {/* ── Rule-of-thumb explainer card ── */}
      <div className="bg-blue-950/40 border border-blue-800/50 rounded-xl px-6 py-4 flex flex-wrap gap-6 items-center">
        <div className="flex-1 min-w-[200px]">
          <div className="text-blue-300 font-semibold mb-1">Price Transmission Rule of Thumb</div>
          <div className="text-slate-300 text-sm leading-relaxed">
            A <span className="text-white font-bold">$10/barrel</span> change in crude oil → 
            roughly <span className="text-white font-bold">$0.25/gallon</span> at the pump, 
            with a typical lag of <span className="text-amber-300 font-bold">1–2 weeks</span> for price 
            increases and <span className="text-green-400 font-bold">4–8 weeks</span> for price decreases.
          </div>
        </div>
        <div className="flex gap-4 text-center flex-wrap">
          {[
            { label: 'Crude oil', pct: '~50%', color: 'text-blue-300' },
            { label: 'Refining',  pct: '~15%', color: 'text-purple-300' },
            { label: 'Dist. & Mktg', pct: '~15%', color: 'text-teal-300' },
            { label: 'Taxes',     pct: '~20%', color: 'text-slate-300' },
          ].map(item => (
            <div key={item.label}>
              <div className={`text-xl font-bold ${item.color}`}>{item.pct}</div>
              <div className="text-slate-500 text-xs">{item.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Dual-axis price chart with event overlays ── */}
      <section className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-lg font-semibold text-white">📊 Crude Oil vs. Pump Price — Historical</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                <span className="text-blue-400">Blue line</span> = US regular gas ($/gal, left axis) &nbsp;·&nbsp;
                <span className="text-amber-400">Dashed amber</span> = WTI crude ($/bbl, right axis)
              </p>
            </div>
            {/* Event category toggles */}
            <div className="flex flex-wrap gap-2">
              {ALL_CATEGORIES.map(cat => {
                const cfg = EVENT_CATEGORIES[cat];
                const on  = activeCategories.includes(cat);
                return (
                  <button
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      on
                        ? 'border-current text-current bg-current/10'
                        : 'border-slate-600 text-slate-500 bg-transparent'
                    }`}
                    style={on ? { color: cfg.color, borderColor: cfg.color } : {}}
                    title={`Toggle ${cfg.label} events`}
                  >
                    <span>{cfg.emoji}</span>
                    <span>{cfg.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="p-6">
          {seriesLoading && <SkeletonBlock h="h-80" />}
          {!seriesLoading && priceSeries.length > 0 && (
            <DualAxisPriceChart
              data={priceSeries}
              events={events}
              activeCategories={activeCategories}
            />
          )}
          {!seriesLoading && priceSeries.length === 0 && (
            <div className="h-80 flex items-center justify-center flex-col gap-2 text-center">
              <div className="text-slate-400">No price series data yet</div>
              <div className="text-slate-500 text-xs max-w-xs">
                Run the data ingestion job to populate crude oil and gasoline price history.
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Cross-correlation section ── */}
      <section className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-lg font-semibold text-white">📈 WTI Crude → Pump Price Correlation</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Pearson r at each lag (0–12 weeks) — amber bar = optimal lag
            </p>
          </div>
          {hasCorr && (
            <div className="flex gap-3 flex-wrap">
              <span className="text-xs px-2 py-1 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 font-semibold">
                Peak r = {optimalR.toFixed(3)} at lag {optimalLag}w
              </span>
              <span className="text-xs px-2 py-1 rounded bg-slate-700 border border-slate-600 text-slate-300">
                {classifyCorrelation(optimalR)} correlation
              </span>
            </div>
          )}
        </div>

        <div className="p-6">
          {corrLoading && <SkeletonBlock h="h-72" />}
          {corrError && (
            <div className="h-72 flex items-center justify-center text-slate-500 text-sm">
              Unable to load correlation data. Ensure the API is running and the database has price history.
            </div>
          )}
          {hasCorr && (
            <>
              <CrossCorrelationChart data={crossCorr} optimalLag={optimalLag} />

              <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-3">
                <StatCard
                  label="Optimal lag"
                  value={`${optimalLag} week${optimalLag !== 1 ? 's' : ''}`}
                  sub="WTI → pump peak"
                  accent
                />
                <StatCard
                  label="Peak correlation"
                  value={optimalR.toFixed(3)}
                  sub={classifyCorrelation(optimalR)}
                />
                <StatCard
                  label="R² (goodness of fit)"
                  value={rSquared.toFixed(3)}
                  sub={`${(rSquared * 100).toFixed(1)}% variance explained`}
                />
                <StatCard
                  label="Instant corr (lag 0)"
                  value={(crossCorr[0]?.correlation ?? 0).toFixed(3)}
                  sub="Same-week movement"
                />
                <StatCard
                  label="12-week corr"
                  value={(crossCorr[12]?.correlation ?? crossCorr[crossCorr.length - 1]?.correlation ?? 0).toFixed(3)}
                  sub="3-month trailing"
                />
              </div>
            </>
          )}
          {!corrLoading && !corrError && crossCorr.length === 0 && (
            <div className="h-72 flex items-center justify-center flex-col gap-2 text-center">
              <div className="text-slate-400">No correlation data yet</div>
              <div className="text-slate-500 text-xs max-w-xs">
                Correlation analysis requires at least 13 weeks of overlapping crude oil and gasoline price data.
                Trigger a data ingestion job to populate the database.
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Rockets & Feathers section ── */}
      <section className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-white">🚀🪶 Rockets & Feathers Asymmetry</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            How quickly pump prices respond to crude oil increases vs decreases
          </p>
        </div>

        <div className="p-6">
          {rfLoading && <SkeletonBlock h="h-52" />}
          {rfError && (
            <div className="h-52 flex items-center justify-center text-slate-500 text-sm">
              Unable to load rockets-and-feathers data.
            </div>
          )}
          {hasRf && (
            <RocketsFeathersViz
              asymmetryRatio={asymmetryRatio}
              riseElasticity={riseElasticity}
              fallElasticity={fallElasticity}
              cumulativePassThrough={cumulativePassThrough}
              riseHalfLifeWeeks={riseHalfLifeWeeks}
              fallHalfLifeWeeks={fallHalfLifeWeeks}
            />
          )}
          {!rfLoading && !rfError && asymmetryRatio === 0 && (
            <div className="h-52 flex items-center justify-center flex-col gap-2 text-center">
              <div className="text-slate-400">No asymmetry data yet</div>
              <div className="text-slate-500 text-xs max-w-xs">
                Populate the database with gasoline and crude oil price history to run this analysis.
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Methodology note ── */}
      <section className="bg-slate-800/60 rounded-xl border border-slate-700/60 px-6 py-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">📐 Methodology</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-400 leading-relaxed">
          <div>
            <div className="text-slate-300 font-semibold mb-1">Cross-Correlation Function (CCF)</div>
            <p>
              Pearson correlation is computed between weekly US regular gasoline prices and WTI crude oil 
              (lag-shifted by 0–12 weeks). The lag with the highest absolute correlation coefficient is 
              considered the "optimal transmission lag."
            </p>
          </div>
          <div>
            <div className="text-slate-300 font-semibold mb-1">Asymmetric Error Correction</div>
            <p>
              Oil price changes are split into positive (crude up) and negative (crude down) components. 
              The average week-over-week gas price response is computed separately for each component. 
              The asymmetry ratio = rise speed ÷ fall speed; values above 1 indicate "rockets and feathers."
            </p>
          </div>
        </div>
        <div className="mt-3 text-xs text-slate-500">
          Data sources: EIA Open Data API v2 (PET.EMM_EPMR_PTE_NUS_DPG.W — US regular gasoline; 
          PET.RWTC.D — WTI crude oil spot). Updated weekly.
        </div>
      </section>
    </div>
  );
}
