import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePageSEO } from '../hooks/usePageSEO';
import {
  Sankey,
  Layer,
  Rectangle,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { getDownstreamImpact, getEconomicIndicators } from '../api/client';
import { ChartContainer, PriceLineChart } from '../components/charts';

// ── Type helpers ──────────────────────────────────────────────────────────────
interface DownstreamData {
  diesel:   { current: number; baseline: number; increase: number; baselineSource?: string };
  freight:  { surchargePerMile: number; costPerMileIncrease: number; rateIncreasePercent: number };
  consumer: { minCPIIncrease: number; maxCPIIncrease: number; avgCPIIncrease: number; foodPriceIncrease: number };
  lag?: { freightSurcharge: { label: string }; consumerGoods: { label: string }; foodPrices: { label: string } };
}

// ── Sankey helpers ────────────────────────────────────────────────────────────
const NODE_COLORS = [
  '#3b82f6', // 0 Freight Rate increase – blue
  '#ef4444', // 1 Consumer CPI impact – red
  '#f97316', // 2 Food & grocery – orange
  '#64748b', // 3 Absorbed by carriers – slate
  '#475569', // 4 Other goods – dark slate
];

function computeSankeyData(downstream: DownstreamData | undefined) {
  if (!downstream) return null;

  /**
   * Sankey modeling of freight cost pass-through.
   * 
   * Scale: Use 100 units as the base for "freight rate increase"
   *   - 15 units pass through to consumers as CPI (elasticity ≈ 0.15)
   *   - 85 units absorbed by carriers/retailers (logistics margin compression)
   * 
   * Consumer CPI is then broken down into food vs non-food components.
   */
  const TOTAL_FREIGHT = 100; // Base units for freight rate increase

  // Calculate pass-through ratio from actual elasticity
  // Min 0.05 to avoid edge cases; max 0.25 to cap visualization
  const passThruRatio = downstream.freight.rateIncreasePercent > 0
    ? Math.max(0.05, Math.min(0.25, downstream.consumer.avgCPIIncrease / downstream.freight.rateIncreasePercent))
    : 0.15;

  // Freight cost split: what flows to consumers vs. absorbed
  const cpiPassThru = Math.round(TOTAL_FREIGHT * passThruRatio);
  const carrierAbsorption = TOTAL_FREIGHT - cpiPassThru;

  // CPI breakdown into food and non-food components
  // These are proportional to the relative price increases
  const foodValue = Math.max(Math.round(downstream.consumer.foodPriceIncrease * 5), 1);
  const nonFoodValue = Math.max(Math.round((downstream.consumer.avgCPIIncrease - downstream.consumer.foodPriceIncrease) * 5), 1);

  return {
    nodes: [
      { name: `Freight Rate ↑ ${downstream.freight.rateIncreasePercent.toFixed(1)}%` },
      { name: `Consumer CPI ↑ ${downstream.consumer.avgCPIIncrease.toFixed(2)}%` },
      { name: `Food ↑ ${downstream.consumer.foodPriceIncrease.toFixed(2)}%` },
      { name: 'Absorbed by\nCarriers/Retailers' },
      { name: `Other Goods ↑ ${(downstream.consumer.avgCPIIncrease - downstream.consumer.foodPriceIncrease).toFixed(2)}%` },
    ],
    links: [
      { source: 0, target: 1, value: cpiPassThru },          // Freight → CPI pass-through
      { source: 0, target: 3, value: carrierAbsorption },    // Freight → Absorbed
      { source: 1, target: 2, value: foodValue },            // CPI → Food
      { source: 1, target: 4, value: nonFoodValue },         // CPI → Non-food
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
  const latestCpiYoY    = useMemo(() => indicators?.series.cpi[indicators.series.cpi.length - 1]?.yoy     ?? null, [indicators]);
  const latestFoodYoY   = useMemo(() => indicators?.series.cpiFood[indicators.series.cpiFood.length - 1]?.yoy  ?? null, [indicators]);
  const latestPpiTYoY   = useMemo(() => indicators?.series.ppiTrucking[indicators.series.ppiTrucking.length - 1]?.yoy ?? null, [indicators]);

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
            sub={`$${downstream.diesel.increase >= 0 ? '+' : ''}${downstream.diesel.increase.toFixed(3)} vs ${downstream.diesel.baselineSource === 'rolling_52w' ? '52-week ago' : downstream.diesel.baselineSource === 'custom' ? 'custom baseline' : 'DOE baseline'}`}
          />
          <MetricCard
            color="amber"
            label="Freight Surcharge"
            value={`$${downstream.freight.surchargePerMile.toFixed(3)}/mi`}
            sub={`+${downstream.freight.rateIncreasePercent.toFixed(1)}% freight rate | lag: ${downstream.lag?.freightSurcharge?.label ?? '1-2 weeks'}`}
          />
          <MetricCard
            color="red"
            label="Consumer CPI Impact"
            value={`+${downstream.consumer.avgCPIIncrease.toFixed(2)}%`}
            sub={`Range: ${downstream.consumer.minCPIIncrease.toFixed(2)}%–${downstream.consumer.maxCPIIncrease.toFixed(2)}% | lag: ${downstream.lag?.consumerGoods?.label ?? '2-6 months'}`}
          />
          <MetricCard
            color="orange"
            label="Food Price Impact"
            value={`+${downstream.consumer.foodPriceIncrease.toFixed(2)}%`}
            sub={`9% of food cost is transport (USDA) | lag: ${downstream.lag?.foodPrices?.label ?? '1-3 months'}`}
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
                { color: '#3b82f6', label: 'Freight rate increase (100%)' },
                { color: '#ef4444', label: 'Consumer CPI pass-through (~15%)' },
                { color: '#f97316', label: 'Food & grocery inflation (9% transport share)' },
                { color: '#64748b', label: 'Absorbed by carriers/retailers (~85%)' },
                { color: '#475569', label: 'Other goods & services' },
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
              yoy={indicators?.series.ppiFreight?.[indicators.series.ppiFreight.length - 1]?.yoy ?? null}
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
            <ChartContainer
              height={300}
              isLoading={false}
              isEmpty={false}
            >
              <PriceLineChart
                data={blsChartData}
                series={[
                  { key: 'cpi', name: 'CPI All Urban', color: '#3b82f6', dataKey: 'cpi' },
                  { key: 'food', name: 'CPI Food at Home', color: '#f97316', dataKey: 'food' },
                  { key: 'ppiTrucking', name: 'PPI Truck Transport', color: '#f59e0b', dataKey: 'ppiTrucking' },
                  { key: 'ppiFreight', name: 'PPI Freight (commodity)', color: '#a78bfa', dataKey: 'ppiFreight' },
                ]}
                referenceLines={[
                  { y: 0, label: '0% baseline', stroke: '#475569', strokeWidth: 1, strokeDasharray: '3 3' },
                  { y: 2, label: 'Fed 2% target', stroke: '#10b981', strokeWidth: 1.5, strokeDasharray: '4 2' },
                ]}
                xAxisKey="month"
                xAxisTickFormatter={(v) => v}
                yAxisTickFormatter={(v) => `${v >= 0 ? '+' : ''}${(v as number).toFixed(0)}%`}
                margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                tooltip={{
                  formatter: (value) => `${(value as number) >= 0 ? '+' : ''}${(value as number).toFixed(2)}%`,
                }}
              />
            </ChartContainer>
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
