import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePageSEO } from '../hooks/usePageSEO';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Sankey,
  Layer,
  Rectangle,
} from 'recharts';
import { getDownstreamImpact, getEconomicIndicators } from '../api/client';

// ── Type helpers ──────────────────────────────────────────────────────────────
interface DownstreamData {
  diesel:   { current: number; baseline: number; increase: number };
  freight:  { surchargePerMile: number; costPerMileIncrease: number; rateIncreasePercent: number };
  consumer: { minCPIIncrease: number; maxCPIIncrease: number; avgCPIIncrease: number; foodPriceIncrease: number };
}

// ── Sankey helpers ────────────────────────────────────────────────────────────
const NODE_COLORS = [
  '#3b82f6', // 0 Diesel – blue
  '#f59e0b', // 1 Trucking – amber
  '#eab308', // 2 Freight Rate – yellow
  '#ef4444', // 3 Consumer Goods – red
  '#f97316', // 4 Food Prices – orange
  '#64748b', // 5 Absorbed by Carriers – slate
  '#475569', // 6 Absorbed by Retailers – slate
];

function computeSankeyData(downstream: DownstreamData | undefined) {
  if (!downstream) return null;

  const dieselIncrease = Math.max(downstream.diesel.increase, 0.01);
  const total = 1000;

  // Freight rate increase % → scale to units out of 1000
  const freightValue       = Math.min(Math.round(downstream.freight.rateIncreasePercent * 10), 950);
  const carrierAbsorption  = Math.max(total - freightValue, 50);

  // Consumer impact out of freightValue budget
  const cpiValue           = Math.max(Math.round(downstream.consumer.avgCPIIncrease * 100), 1);
  const foodValue          = Math.max(Math.round(downstream.consumer.foodPriceIncrease * 100), 1);
  const retailerAbsorption = Math.max(freightValue - cpiValue - foodValue, 1);

  return {
    nodes: [
      { name: `Diesel ↑$${dieselIncrease.toFixed(2)}/gal` },
      { name: 'Trucking Costs' },
      { name: 'Freight Surcharges' },
      { name: `Consumer Goods +${downstream.consumer.avgCPIIncrease.toFixed(2)}%` },
      { name: `Food & Grocery +${downstream.consumer.foodPriceIncrease.toFixed(2)}%` },
      { name: 'Absorbed – Carriers' },
      { name: 'Absorbed – Retailers' },
    ],
    links: [
      { source: 0, target: 1, value: total },
      { source: 1, target: 2, value: freightValue },
      { source: 1, target: 5, value: carrierAbsorption },
      { source: 2, target: 3, value: cpiValue },
      { source: 2, target: 4, value: Math.max(foodValue, 1) },
      { source: 2, target: 6, value: Math.max(retailerAbsorption, 1) },
    ],
  };
}

// ── Custom Sankey node renderer ───────────────────────────────────────────────
function SankeyNode(props: any) {
  const { x, y, width, height, index, payload } = props;
  const color = NODE_COLORS[index] ?? '#64748b';
  const isSource = index === 0;
  const fontSize = Math.max(9, Math.min(11, height / 2));

  return (
    <Layer key={`CustomNode-${index}`}>
      <Rectangle
        x={x}
        y={y}
        width={width}
        height={height}
        fill={color}
        fillOpacity={0.9}
        radius={2}
      />
      {height > 12 && (
        <text
          textAnchor={isSource ? 'end' : 'start'}
          x={isSource ? x - 6 : x + width + 6}
          y={y + height / 2}
          fontSize={fontSize}
          fill="#cbd5e1"
          dominantBaseline="middle"
        >
          {payload.name}
        </text>
      )}
    </Layer>
  );
}

// ── Custom Sankey link tooltip ────────────────────────────────────────────────
function SankeyTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const link = payload[0]?.payload;
  if (!link) return null;
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs shadow-lg">
      <div className="text-slate-300">
        <span className="font-semibold text-white">{link.source?.name}</span>
        <span className="mx-2 text-slate-500">→</span>
        <span className="font-semibold text-white">{link.target?.name}</span>
      </div>
      <div className="text-slate-400 mt-0.5">
        Relative flow: <span className="text-white font-mono">{link.value}</span>
      </div>
    </div>
  );
}

// ── BLS Chart tooltip ─────────────────────────────────────────────────────────
function BlsTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs shadow-lg min-w-[170px]">
      <p className="text-slate-400 mb-1 font-medium">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-mono text-white">
            {p.value !== null && p.value !== undefined ? `${p.value >= 0 ? '+' : ''}${p.value.toFixed(2)}%` : '–'}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Metric card ───────────────────────────────────────────────────────────────
function MetricCard({
  label, value, sub, color = 'default',
}: { label: string; value: string; sub?: string; color?: 'blue' | 'amber' | 'red' | 'orange' | 'default' }) {
  const palette = {
    blue:    { bg: 'bg-blue-900/20',   border: 'border-blue-700/50',   text: 'text-blue-300' },
    amber:   { bg: 'bg-amber-900/20',  border: 'border-amber-700/50',  text: 'text-amber-300' },
    red:     { bg: 'bg-red-900/20',    border: 'border-red-700/50',    text: 'text-red-300' },
    orange:  { bg: 'bg-orange-900/15', border: 'border-orange-700/40', text: 'text-orange-300' },
    default: { bg: 'bg-slate-700/40',  border: 'border-slate-600/50',  text: 'text-white' },
  }[color];
  return (
    <div className={`rounded-lg p-4 border ${palette.bg} ${palette.border}`}>
      <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-2xl font-bold tabular-nums ${palette.text}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

// ── Indicator stat box ────────────────────────────────────────────────────────
function IndicatorStat({
  label, value, yoy, description,
}: { label: string; value: number | null; yoy: number | null; description: string }) {
  if (value === null) return null;
  const yoyColor = yoy === null ? 'text-slate-400' : yoy > 5 ? 'text-red-400' : yoy > 2 ? 'text-yellow-400' : 'text-green-400';
  return (
    <div className="bg-slate-700/40 rounded-lg p-4 border border-slate-600/50">
      <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">{label}</div>
      <div className="text-xl font-bold text-white tabular-nums">{value.toFixed(1)}</div>
      {yoy !== null && (
        <div className={`text-sm font-semibold tabular-nums mt-0.5 ${yoyColor}`}>
          {yoy >= 0 ? '+' : ''}{yoy.toFixed(1)}% YoY
        </div>
      )}
      <div className="text-xs text-slate-500 mt-1">{description}</div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Downstream() {
  usePageSEO({
    title: 'Diesel Freight Ripple Effect — CPI Pass-Through Dashboard',
    description: 'Track how diesel price increases flow through trucking freight costs into consumer CPI and food prices. Includes a Sankey flow diagram and historical BLS CPI, PPI Trucking data.',
    canonicalPath: '/downstream',
  });

  const { data: downstream, isLoading: dsLoading } = useQuery({
    queryKey: ['downstreamImpact'],
    queryFn: () => getDownstreamImpact(),
    staleTime: 60 * 60 * 1000,
  });

  const { data: indicators, isLoading: indLoading } = useQuery({
    queryKey: ['economicIndicators', 60],
    queryFn:  () => getEconomicIndicators(60),
    staleTime: 24 * 60 * 60 * 1000,
  });

  // ── Sankey data ─────────────────────────────────────────────────────────────
  const sankeyData = useMemo(() => computeSankeyData(downstream), [downstream]);

  // ── BLS chart data (yoy % changes, sampled monthly) ────────────────────────
  const blsChartData = useMemo(() => {
    if (!indicators?.series) return [];
    const cpi   = indicators.series.cpi;
    const food  = indicators.series.cpiFood;
    const ppiT  = indicators.series.ppiTrucking;
    const ppiF  = indicators.series.ppiFreight;

    // Build a date-keyed map using CPI as the spine (monthly)
    const map = new Map<string, any>();
    const fmtDate = (d: string) => {
      const dt = new Date(d);
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    };

    const addSeries = (rows: { date: string; yoy: number | null }[], key: string) => {
      for (const r of rows) {
        const k = fmtDate(r.date);
        if (!map.has(k)) map.set(k, { month: k });
        map.get(k)![key] = r.yoy !== null ? +r.yoy.toFixed(2) : null;
      }
    };

    addSeries(cpi,  'cpi');
    addSeries(food, 'food');
    addSeries(ppiT, 'ppiTrucking');
    addSeries(ppiF, 'ppiFreight');

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v)
      .filter(v => v.cpi !== undefined || v.food !== undefined || v.ppiTrucking !== undefined);
  }, [indicators]);

  // ── Latest indicator values with YoY ───────────────────────────────────────
  const latestCpiYoY    = useMemo(() => indicators?.series.cpi.at(-1)?.yoy     ?? null, [indicators]);
  const latestFoodYoY   = useMemo(() => indicators?.series.cpiFood.at(-1)?.yoy  ?? null, [indicators]);
  const latestPpiTYoY   = useMemo(() => indicators?.series.ppiTrucking.at(-1)?.yoy ?? null, [indicators]);

  return (
    <div className="space-y-8">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-3xl font-bold text-white mb-2">Downstream Impact</h2>
        <p className="text-slate-400">
          How diesel price changes ripple through trucking, freight markets, and into consumer prices
        </p>
      </div>

      {/* ── Key metrics banner ───────────────────────────────────────────────── */}
      {dsLoading ? (
        <div className="h-28 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 text-sm">Loading live diesel data…</div>
      ) : downstream ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            color="blue"
            label="Diesel Price"
            value={`$${downstream.diesel.current.toFixed(3)}/gal`}
            sub={`$${downstream.diesel.increase >= 0 ? '+' : ''}${downstream.diesel.increase.toFixed(3)} vs DOE baseline`}
          />
          <MetricCard
            color="amber"
            label="Freight Surcharge"
            value={`$${downstream.freight.surchargePerMile.toFixed(3)}/mi`}
            sub={`+${downstream.freight.rateIncreasePercent.toFixed(1)}% freight rate increase`}
          />
          <MetricCard
            color="red"
            label="Consumer Goods CPI"
            value={`+${downstream.consumer.avgCPIIncrease.toFixed(2)}%`}
            sub={`Range: ${downstream.consumer.minCPIIncrease.toFixed(2)}% – ${downstream.consumer.maxCPIIncrease.toFixed(2)}%`}
          />
          <MetricCard
            color="orange"
            label="Food Price Impact"
            value={`+${downstream.consumer.foodPriceIncrease.toFixed(2)}%`}
            sub="~9% of food cost is transport (USDA)"
          />
        </div>
      ) : null}

      {/* ══ Section 1: Sankey Flow Diagram ════════════════════════════════════ */}
      <section className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-white">🔀 Diesel-to-Consumer Pass-Through Flow</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Sankey diagram showing how a diesel price increase propagates through the supply chain.
            Node width ∝ relative flow; grey nodes represent costs absorbed by carriers and retailers
            before reaching consumers.
          </p>
        </div>

        {dsLoading ? (
          <div className="h-64 flex items-center justify-center text-slate-500 text-sm">Loading…</div>
        ) : !downstream || !sankeyData ? (
          <div className="h-64 flex items-center justify-center text-slate-500 text-sm">
            No diesel data available — run the backfill to load historical prices.
          </div>
        ) : downstream.diesel.increase <= 0 ? (
          <div className="h-64 flex items-center justify-center text-slate-500 text-sm">
            Diesel price is at or below the DOE baseline of ${downstream.diesel.baseline.toFixed(2)}/gal. No pass-through to model.
          </div>
        ) : (
          <div className="p-6">
            <div className="w-full" style={{ height: 340 }}>
              <Sankey
                width={900}
                height={320}
                data={sankeyData}
                nodePadding={40}
                nodeWidth={14}
                margin={{ top: 10, right: 160, bottom: 10, left: 160 }}
                node={<SankeyNode />}
                link={{ stroke: '#475569', strokeOpacity: 0.5 }}
              >
                <RechartsTooltip content={<SankeyTooltip />} />
              </Sankey>
            </div>

            {/* Legend */}
            <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-400">
              {[
                { color: '#3b82f6', label: 'Diesel – source of cost increase' },
                { color: '#f59e0b', label: 'Trucking operations absorb diesel cost' },
                { color: '#eab308', label: 'Freight surcharges passed to shippers' },
                { color: '#ef4444', label: 'Consumer goods CPI impact' },
                { color: '#f97316', label: 'Food & grocery inflation' },
                { color: '#64748b', label: 'Cost absorbed (not passed through)' },
              ].map(({ color, label }) => (
                <span key={label} className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ══ Section 2: Historical BLS Indicator Chart ═════════════════════════ */}
      <section className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-white">📊 BLS Economic Indicators — Year-over-Year Change</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time BLS data (via FRED): CPI All Urban, CPI Food at Home, PPI Truck Transportation.
            Values show 12-month per cent change; dashed line marks 2% Fed target.
          </p>
        </div>

        {/* Latest values row */}
        {!indLoading && indicators && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 px-6 pt-6">
            <IndicatorStat
              label="CPI All Urban (YoY)"
              value={indicators.latest.cpi?.value ?? null}
              yoy={latestCpiYoY}
              description="FRED CPIAUCSL – monthly"
            />
            <IndicatorStat
              label="CPI Food at Home (YoY)"
              value={indicators.latest.cpiFood?.value ?? null}
              yoy={latestFoodYoY}
              description="FRED CUSR0000SAF11 – monthly"
            />
            <IndicatorStat
              label="PPI Truck Transport (YoY)"
              value={indicators.latest.ppiTrucking?.value ?? null}
              yoy={latestPpiTYoY}
              description="FRED PCU484484 – monthly"
            />
            <IndicatorStat
              label="PPI Freight (YoY)"
              value={indicators.latest.ppiFreight?.value ?? null}
              yoy={indicators?.series.ppiFreight?.at(-1)?.yoy ?? null}
              description="FRED WPU3012 – monthly"
            />
          </div>
        )}

        <div className="p-6">
          {indLoading ? (
            <div className="h-72 flex items-center justify-center text-slate-500 text-sm">Loading BLS data…</div>
          ) : blsChartData.length < 3 ? (
            <div className="h-72 flex flex-col items-center justify-center gap-3 text-slate-500 text-sm">
              <span>No BLS indicator data found in the database.</span>
              <code className="text-xs bg-slate-700 text-slate-300 px-3 py-1.5 rounded font-mono">
                npm run backfill -- --sources economic
              </code>
              <span className="text-xs">Run the backfill to seed historical CPI and PPI series from FRED.</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={blsChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="month"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: '#475569' }}
                  interval={11} // ~yearly ticks
                />
                <YAxis
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: '#475569' }}
                  tickFormatter={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(0)}%`}
                />
                <RechartsTooltip content={<BlsTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 12, color: '#94a3b8', paddingTop: 12 }}
                />
                <ReferenceLine y={2}  stroke="#22d3ee" strokeDasharray="4 2" label={{ value: 'Fed 2% target', fill: '#22d3ee', fontSize: 10, position: 'right' }} />
                <ReferenceLine y={0}  stroke="#475569" />
                <Line
                  type="monotone"
                  dataKey="cpi"
                  name="CPI All Urban"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="food"
                  name="CPI Food at Home"
                  stroke="#f97316"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="ppiTrucking"
                  name="PPI Truck Transport"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  strokeDasharray="5 3"
                  dot={false}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="ppiFreight"
                  name="PPI Freight (commodity)"
                  stroke="#a78bfa"
                  strokeWidth={2}
                  strokeDasharray="3 3"
                  dot={false}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* ══ Section 3: Annual Household Dollar Impact ════════════════════════ */}
      {downstream && downstream.diesel.increase > 0 && (
        <section className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-700">
            <h3 className="text-lg font-semibold text-white">🏠 Estimated Annual Household Impact</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Diesel price above DOE baseline → higher freight costs → higher retail prices.
              Based on BLS Consumer Expenditure Survey averages.
            </p>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Food */}
            <div className="bg-orange-900/10 rounded-lg p-5 border border-orange-700/30 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-2xl">🛒</span>
                <span className="text-sm font-semibold text-orange-300">Grocery Budget</span>
              </div>
              <p className="text-xs text-slate-400 mb-3">
                Avg household $6,000/yr on food at home (BLS CE Survey)
              </p>
              <div className="text-3xl font-bold text-white tabular-nums">
                +${(6000 * downstream.consumer.foodPriceIncrease / 100).toFixed(0)}
                <span className="text-base text-slate-400"> /yr</span>
              </div>
              <div className="text-xs text-slate-500 mt-1">freight-driven grocery inflation</div>
            </div>

            {/* All consumer goods */}
            <div className="bg-red-900/10 rounded-lg p-5 border border-red-700/30 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-2xl">🛍️</span>
                <span className="text-sm font-semibold text-red-300">All Consumer Goods</span>
              </div>
              <p className="text-xs text-slate-400 mb-3">
                Avg household ~$60,000/yr expenditures (BLS CE Survey)
              </p>
              <div className="text-3xl font-bold text-white tabular-nums">
                +${(60000 * downstream.consumer.avgCPIIncrease / 100).toFixed(0)}
                <span className="text-base text-slate-400"> /yr</span>
              </div>
              <div className="text-xs text-slate-500 mt-1">avg CPI pass-through ({downstream.consumer.avgCPIIncrease.toFixed(2)}% on basket)</div>
            </div>

            {/* Total combined */}
            <div className="bg-slate-700/30 rounded-lg p-5 border border-slate-600/40 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-2xl">💸</span>
                <span className="text-sm font-semibold text-slate-300">Combined Burden</span>
              </div>
              <p className="text-xs text-slate-400 mb-3">
                Indirect freight inflation on top of direct fuel cost
              </p>
              <div className="text-3xl font-bold text-white tabular-nums">
                +${(6000 * downstream.consumer.foodPriceIncrease / 100 + 60000 * downstream.consumer.avgCPIIncrease / 100).toFixed(0)}
                <span className="text-base text-slate-400"> /yr</span>
              </div>
              <div className="text-xs text-slate-500 mt-1">food inflation + general CPI inflation</div>
            </div>
          </div>
        </section>
      )}

      {/* ══ Section 4: Pass-through chain methodology ════════════════════════ */}
      <section className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-1">📖 Pass-Through Chain — Methodology</h3>
        <p className="text-xs text-slate-500 mb-5">
          Each stage in the diesel-to-consumer pass-through chain is backed by federal and academic sources.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-xs text-slate-400 uppercase tracking-wide border-b border-slate-700">
                <th className="pb-2 pr-6 font-medium">Stage</th>
                <th className="pb-2 pr-6 font-medium">Effect</th>
                <th className="pb-2 font-medium">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50 text-slate-300">
              <tr>
                <td className="py-2.5 pr-6">$1/gal diesel increase</td>
                <td className="py-2.5 pr-6 text-amber-400 tabular-nums font-medium">+15–17¢/mile trucking cost</td>
                <td className="py-2.5 text-slate-500 text-xs">ATRI Operational Costs Study</td>
              </tr>
              <tr>
                <td className="py-2.5 pr-6">Trucking cost increase</td>
                <td className="py-2.5 pr-6 text-amber-400 tabular-nums font-medium">5–10% freight rate increase</td>
                <td className="py-2.5 text-slate-500 text-xs">DAT / FreightWaves SONAR</td>
              </tr>
              <tr>
                <td className="py-2.5 pr-6">Freight rate increase</td>
                <td className="py-2.5 pr-6 text-red-400 tabular-nums font-medium">0.5–2% consumer goods price increase</td>
                <td className="py-2.5 text-slate-500 text-xs">BLS PPI for Truck Transport (PCU484484)</td>
              </tr>
              <tr>
                <td className="py-2.5 pr-6">Food specifically</td>
                <td className="py-2.5 pr-6 text-orange-400 tabular-nums font-medium">~9% of retail food cost is transport</td>
                <td className="py-2.5 text-slate-500 text-xs">USDA Economic Research Service</td>
              </tr>
              <tr>
                <td className="py-2.5 pr-6">Macro pass-through</td>
                <td className="py-2.5 pr-6 text-red-400 tabular-nums font-medium">1% gas price ↑ → 0.04% CPI ↑</td>
                <td className="py-2.5 text-slate-500 text-xs">IMF Working Paper 2021/271</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* DOE Baseline note */}
        <div className="mt-5 flex items-start gap-3 bg-slate-700/30 rounded-lg px-4 py-3 border border-slate-600/40 text-xs text-slate-400">
          <span className="text-blue-400 mt-0.5">ℹ</span>
          <span>
            The DOE baseline diesel price of <span className="text-white font-medium">$1.25/gallon</span> is the
            industry-standard reference set by the US Department of Energy for fuel surcharge calculations.
            Freight carriers apply surcharges on top of base rates once diesel exceeds this threshold.
            The EIA On-Highway Diesel price (FRED series <code className="text-slate-300">GASREGW</code>) is
            used as the current benchmark.
          </span>
        </div>

        {/* BLS series reference */}
        <div className="mt-4 border-t border-slate-700/50 pt-4 grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {[
            { id: 'CPIAUCSL',      desc: 'CPI All Urban Consumers',           freq: 'Monthly' },
            { id: 'CUSR0000SAF11', desc: 'CPI Food at Home',                  freq: 'Monthly' },
            { id: 'PCU484484',     desc: 'PPI – Truck Transportation',        freq: 'Monthly' },
            { id: 'WPU3012',       desc: 'PPI – Freight Trucking (commodity)',freq: 'Monthly' },
          ].map(({ id, desc, freq }) => (
            <div key={id} className="bg-slate-700/30 rounded p-2.5 border border-slate-600/30">
              <div className="font-mono text-blue-400 mb-0.5">{id}</div>
              <div className="text-slate-300">{desc}</div>
              <div className="text-slate-500 mt-0.5">{freq} · via FRED</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
