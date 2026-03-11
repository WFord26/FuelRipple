import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCurrentPrices, getDisruptionScore, getVolatility, getDownstreamImpact } from '../api/client';
import DisruptionMeter from '../components/DisruptionMeter';
import { usePageSEO } from '../hooks/usePageSEO';

// ── Federal-data defaults (architecture doc §4.1.2) ─────────────────────────
const DEFAULTS = {
  annualMiles: 13500,
  vehicleMPG: 25.4,
  commuteDistance: 20.5,
  workingDays: 250,
};

// ── Client-side calculation (mirrors impact-engine/fuelCost.ts) ──────────────
function calcFuelCost(
  annualMiles: number,
  mpg: number,
  commuteDistance: number,
  workingDays: number,
  currentPrice: number,
  baselinePrice: number,
) {
  const annualGallons       = annualMiles / mpg;
  const annualFuelCost      = annualGallons * currentPrice;
  const priceSensitivity    = annualGallons;                         // $/year per $1/gal
  const commuteAnnualMiles  = commuteDistance * 2 * workingDays;
  const commuteGallons      = commuteAnnualMiles / mpg;
  const commuteCostPerYear  = commuteGallons * currentPrice;
  const costVsBaseline      = (currentPrice - baselinePrice) * annualGallons;
  const perFillup           = currentPrice * 13;                     // ~13-gal tank
  return { annualFuelCost, annualGallons, priceSensitivity, commuteCostPerYear, costVsBaseline, perFillup };
}

// ── Volatility pill ──────────────────────────────────────────────────────────
function VolBadge({ level }: { level: string }) {
  const styles: Record<string, string> = {
    calm:     'bg-green-500/15  text-green-400  border-green-500/30',
    moderate: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    high:     'bg-red-500/15    text-red-400    border-red-500/30',
  };
  return (
    <span className={`inline-block px-3 py-0.5 rounded-full border text-xs font-semibold uppercase tracking-wide ${styles[level] ?? styles.calm}`}>
      {level}
    </span>
  );
}

// ── Slider input row ─────────────────────────────────────────────────────────
function SliderRow({
  label, value, min, max, step, unit,
  onChange,
}: {
  label: string; value: number; min: number; max: number; step: number; unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-slate-300">{label}</span>
        <span className="text-white font-medium tabular-nums">
          {value.toLocaleString()}<span className="text-slate-400 ml-1 text-xs">{unit}</span>
        </span>
      </div>
      <input
        type="range"
        title={label}
        aria-label={label}
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none bg-slate-600
                   [&::-webkit-slider-thumb]:appearance-none
                   [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                   [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500
                   [&::-webkit-slider-thumb]:cursor-pointer
                   [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4
                   [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-blue-500
                   [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
      />
    </div>
  );
}

// ── Metric card ──────────────────────────────────────────────────────────────
function MetricCard({ label, value, sub, highlight = false }: {
  label: string; value: string; sub?: string; highlight?: boolean;
}) {
  return (
    <div className={`rounded-lg p-4 border ${highlight ? 'bg-blue-900/20 border-blue-700/50' : 'bg-slate-700/40 border-slate-600/50'}`}>
      <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-2xl font-bold tabular-nums ${highlight ? 'text-blue-300' : 'text-white'}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function Impact() {
  usePageSEO({
    title: 'Consumer Fuel Cost Calculator & Disruption Index',
    description: 'Personalize your annual fuel cost using live gas prices. Shows the Consumer Disruption Index (z-score), annualized volatility, and diesel-to-CPI freight pass-through impact.',
    canonicalPath: '/impact',
  });

  // ── Slider state ───────────────────────────────────────────────────────────
  const [annualMiles,      setAnnualMiles]      = useState(DEFAULTS.annualMiles);
  const [vehicleMPG,       setVehicleMPG]       = useState(DEFAULTS.vehicleMPG);
  const [commuteDistance,  setCommuteDistance]  = useState(DEFAULTS.commuteDistance);
  const [workingDays,      setWorkingDays]      = useState(DEFAULTS.workingDays);
  const [useLivePrice,     setUseLivePrice]     = useState(true);
  const [manualPrice,      setManualPrice]      = useState(3.50);
  const [baselinePrice,    setBaselinePrice]    = useState(3.00);

  // ── Remote data ────────────────────────────────────────────────────────────
  const { data: prices } = useQuery({
    queryKey: ['currentPrices'],
    queryFn: () => getCurrentPrices('gas_regular'),
  });

  const { data: disruption, isLoading: disruptionLoading } = useQuery({
    queryKey: ['disruptionScore'],
    queryFn: () => getDisruptionScore('gas_regular', 'US'),
    staleTime: 60 * 60 * 1000,
  });

  const { data: volatility, isLoading: volLoading } = useQuery({
    queryKey: ['volatility'],
    queryFn: () => getVolatility('gas_regular', 'US', 52),
    staleTime: 60 * 60 * 1000,
  });

  const { data: downstream, isLoading: downstreamLoading } = useQuery({
    queryKey: ['downstreamImpact'],
    queryFn: () => getDownstreamImpact(),
    staleTime: 60 * 60 * 1000,
  });

  const nationalPrice = prices?.find((p: any) => p.region === 'NUS')?.value as number | undefined;
  const livePrice     = nationalPrice ?? manualPrice;
  const currentPrice  = useLivePrice ? (livePrice) : manualPrice;

  // ── Derived calculations (no API round-trip) ───────────────────────────────
  const result = useMemo(
    () => calcFuelCost(annualMiles, vehicleMPG, commuteDistance, workingDays, currentPrice, baselinePrice),
    [annualMiles, vehicleMPG, commuteDistance, workingDays, currentPrice, baselinePrice],
  );

  // Commute fraction of total annual cost
  const commuteFraction = result.annualFuelCost > 0
    ? Math.min(result.commuteCostPerYear / result.annualFuelCost, 1)
    : 0;

  const deltaColor = result.costVsBaseline >= 0 ? 'text-red-400' : 'text-green-400';
  const deltaSign  = result.costVsBaseline >= 0 ? '+' : '';

  return (
    <div className="space-y-8">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-3xl font-bold text-white mb-2">Consumer Impact</h2>
        <p className="text-slate-400">
          Personalize your fuel cost exposure and monitor market disruption risk
        </p>
      </div>

      {/* ── Live price banner ──────────────────────────────────────────────── */}
      {nationalPrice && (
        <div className="flex items-center gap-3 bg-slate-800 rounded-lg px-4 py-3 border border-slate-700 text-sm">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-slate-400">National avg (regular):</span>
          <span className="text-white font-bold tabular-nums">${nationalPrice.toFixed(3)}/gal</span>
          {disruption && (
            <>
              <span className="text-slate-600">·</span>
              <span className="text-slate-400">Disruption:</span>
              <span className={`font-semibold ${
                disruption.classification === 'normal'   ? 'text-green-400' :
                disruption.classification === 'elevated' ? 'text-yellow-400' :
                disruption.classification === 'high'     ? 'text-orange-400' : 'text-red-400'
              }`}>{disruption.classification.toUpperCase()}</span>
            </>
          )}
        </div>
      )}

      {/* ══ Section 1: Fuel cost calculator ══════════════════════════════════ */}
      <section className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-white">⛽ Personalized Fuel Cost Calculator</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Default values from FHWA, EPA, and Census Bureau federal data
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-700">
          {/* ── Left: Inputs ─────────────────────────────────────────────── */}
          <div className="p-6 space-y-6">
            {/* Price inputs */}
            <div className="space-y-4">
              <h4 className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Gas Prices</h4>

              {/* Live / manual toggle */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setUseLivePrice(!useLivePrice)}
                  aria-label={useLivePrice ? 'Switch to manual price entry' : 'Switch to live price'}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors cursor-pointer
                    ${useLivePrice ? 'bg-blue-600' : 'bg-slate-600'}`}
                >
                  <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${useLivePrice ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
                <span className="text-sm text-slate-300">
                  {useLivePrice ? 'Using live national avg' : 'Manual entry'}
                  {useLivePrice && nationalPrice && (
                    <span className="ml-2 text-blue-400 font-mono">${nationalPrice.toFixed(3)}</span>
                  )}
                </span>
              </div>

              {!useLivePrice && (
                <div className="flex items-center gap-3">
                  <label className="text-sm text-slate-300 w-36">Current price</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                    <input
                      type="number" min={0.5} max={10} step={0.001}
                      value={manualPrice}
                      title="Current gas price per gallon"
                      aria-label="Current gas price per gallon"
                      placeholder="3.50"
                      onChange={e => setManualPrice(Number(e.target.value))}
                      className="pl-7 pr-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm w-28 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <span className="text-slate-500 text-xs">/gal</span>
                </div>
              )}

              <SliderRow
                label="Baseline price (comparison)"
                value={baselinePrice} min={1} max={8} step={0.01} unit="/gal"
                onChange={setBaselinePrice}
              />
            </div>

            <div className="border-t border-slate-700/60" />

            {/* Driving inputs */}
            <div className="space-y-5">
              <h4 className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Driving Profile</h4>
              <SliderRow
                label="Annual miles driven"
                value={annualMiles} min={1000} max={50000} step={500} unit="mi"
                onChange={setAnnualMiles}
              />
              <SliderRow
                label="Vehicle fuel economy"
                value={vehicleMPG} min={10} max={60} step={0.5} unit="MPG"
                onChange={setVehicleMPG}
              />
              <SliderRow
                label="One-way commute distance"
                value={commuteDistance} min={0} max={100} step={0.5} unit="mi"
                onChange={setCommuteDistance}
              />
              <SliderRow
                label="Working days per year"
                value={workingDays} min={100} max={365} step={5} unit="days"
                onChange={setWorkingDays}
              />
            </div>

            {/* Reset */}
            <button
              onClick={() => {
                setAnnualMiles(DEFAULTS.annualMiles);
                setVehicleMPG(DEFAULTS.vehicleMPG);
                setCommuteDistance(DEFAULTS.commuteDistance);
                setWorkingDays(DEFAULTS.workingDays);
              }}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              Reset to federal defaults
            </button>
          </div>

          {/* ── Right: Results ────────────────────────────────────────────── */}
          <div className="p-6 space-y-5">
            <h4 className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Your Cost Projection</h4>

            {/* Primary metric */}
            <div className="bg-blue-600/10 border border-blue-600/30 rounded-xl p-5 text-center">
              <div className="text-xs text-blue-300 uppercase tracking-wide mb-1">Annual Fuel Cost</div>
              <div className="text-4xl font-bold text-white tabular-nums">
                ${result.annualFuelCost.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
              <div className="text-sm text-blue-300/70 mt-1">
                at ${currentPrice.toFixed(3)}/gal
              </div>
            </div>

            {/* Secondary metrics grid */}
            <div className="grid grid-cols-2 gap-3">
              <MetricCard
                label="Gallons / year"
                value={result.annualGallons.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                sub="based on your miles + MPG"
              />
              <MetricCard
                label="Cost per $1/gal change"
                value={`$${result.priceSensitivity.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
                sub="annual exposure"
              />
              <MetricCard
                label="Commute cost / year"
                value={`$${result.commuteCostPerYear.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
                sub={`${(commuteDistance * 2 * workingDays).toLocaleString()} commute miles`}
              />
              <MetricCard
                label="Avg fill-up cost"
                value={`$${result.perFillup.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                sub="~13 gallon tank"
              />
            </div>

            {/* Vs baseline delta */}
            <div className="flex items-center justify-between bg-slate-700/40 rounded-lg px-4 py-3 border border-slate-600/50">
              <span className="text-sm text-slate-300">
                vs ${baselinePrice.toFixed(2)}/gal baseline
              </span>
              <span className={`text-lg font-bold tabular-nums ${deltaColor}`}>
                {deltaSign}${Math.abs(result.costVsBaseline).toLocaleString('en-US', { maximumFractionDigits: 0 })}/yr
              </span>
            </div>

            {/* Commute vs other bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Commute share</span>
                <span>{(commuteFraction * 100).toFixed(0)}% of annual cost</span>
              </div>
              <div className="h-2 rounded-full bg-slate-700 overflow-hidden flex">
                <div
                  className="bg-blue-500 h-full transition-all duration-300"
                  style={{ width: `${commuteFraction * 100}%` }}
                />
                <div className="bg-slate-500 h-full flex-1" />
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-blue-500" />Commute</span>
                <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-slate-500" />Other driving</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ Section 2: Disruption Score + Volatility ════════════════════════ */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Disruption gauge */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-white">📊 Market Disruption Score</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Z-score of weekly price change vs 52-week history
            </p>
          </div>

          {disruptionLoading ? (
            <div className="flex items-center justify-center h-48 text-slate-500 text-sm">Loading…</div>
          ) : disruption ? (
            <>
              <DisruptionMeter
                score={Math.abs(disruption.score)}
                classification={disruption.classification}
              />
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="bg-slate-700/40 rounded-lg px-4 py-3 border border-slate-600/50">
                  <div className="text-xs text-slate-400 mb-0.5">Weekly Change</div>
                  <div className={`font-bold tabular-nums ${disruption.weeklyChange >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {disruption.weeklyChange >= 0 ? '+' : ''}{(disruption.weeklyChange * 100).toFixed(2)}%
                  </div>
                </div>
                <div className="bg-slate-700/40 rounded-lg px-4 py-3 border border-slate-600/50">
                  <div className="text-xs text-slate-400 mb-0.5">Z-Score</div>
                  <div className="text-white font-bold tabular-nums">
                    {disruption.score >= 0 ? '+' : ''}{disruption.score.toFixed(2)}σ
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-slate-500 text-sm text-center py-12">No disruption data available</div>
          )}
        </div>

        {/* Volatility index */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-white">📈 Annualized Volatility Index</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Rolling stddev of log-returns × √52 · 52-week window
            </p>
          </div>

          {volLoading ? (
            <div className="flex items-center justify-center h-48 text-slate-500 text-sm">Loading…</div>
          ) : volatility ? (
            <div className="space-y-6">
              {/* Big number */}
              <div className="text-center pt-4">
                <div className="text-5xl font-bold text-white tabular-nums">
                  {volatility.annualizedVolatility.toFixed(1)}<span className="text-2xl text-slate-400 ml-1">%</span>
                </div>
                <div className="mt-2 flex justify-center">
                  <VolBadge level={volatility.classification} />
                </div>
              </div>

              {/* Gauge bar */}
              <div className="space-y-1.5">
                <div className="h-3 rounded-full overflow-hidden bg-slate-700 flex">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      volatility.classification === 'calm'     ? 'bg-green-500' :
                      volatility.classification === 'moderate' ? 'bg-yellow-400' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(volatility.annualizedVolatility / 100 * 100, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>0%</span>
                  <span className="text-green-500">calm &lt;30%</span>
                  <span className="text-yellow-400">moderate 30–60%</span>
                  <span className="text-red-400">high &gt;60%</span>
                  <span>100%</span>
                </div>
              </div>

              {/* Interpretation */}
              <div className="bg-slate-700/40 rounded-lg px-4 py-3 border border-slate-600/50 text-sm text-slate-300 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Data points</span>
                  <span className="font-medium tabular-nums">{volatility.dataPoints} weeks</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Window</span>
                  <span className="font-medium tabular-nums">{volatility.window} weeks</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Annualization</span>
                  <span className="font-medium">√52 × weekly σ</span>
                </div>
              </div>

              {/* Historical benchmarks */}
              <div className="space-y-1.5 text-xs text-slate-400">
                <div className="font-semibold text-slate-300 text-xs uppercase tracking-wide">Historical benchmarks</div>
                <div className="flex justify-between"><span>2022 Russia-Ukraine invasion</span><span className="text-red-400 tabular-nums">~95%</span></div>
                <div className="flex justify-between"><span>2008 oil price shock</span><span className="text-red-400 tabular-nums">~85%</span></div>
                <div className="flex justify-between"><span>Typical seasonal swing</span><span className="text-green-400 tabular-nums">15–25%</span></div>
              </div>
            </div>
          ) : (
            <div className="text-slate-500 text-sm text-center py-12">No volatility data available</div>
          )}
        </div>
      </section>

      {/* ══ Section 3: Freight & Consumer Goods Impact ════════════════════ */}
      <section className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-white">🚛 Freight &amp; Consumer Goods Impact</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Diesel → trucking freight → grocery &amp; retail price pass-through (ATRI, BLS, USDA)
          </p>
        </div>

        {downstreamLoading ? (
          <div className="flex items-center justify-center h-48 text-slate-500 text-sm">Loading downstream data…</div>
        ) : downstream ? (
          <div className="p-6 space-y-6">
            {/* ── Flow chain ──────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Diesel */}
              <div className="bg-slate-700/40 rounded-lg p-5 border border-slate-600/50 text-center relative">
                <div className="text-xs text-slate-400 uppercase tracking-wide mb-2">Diesel Price</div>
                <div className="text-3xl font-bold text-white tabular-nums">
                  ${downstream.diesel.current.toFixed(3)}
                </div>
                <div className="text-xs text-slate-500 mt-1">/gallon</div>
                <div className={`mt-2 text-sm font-semibold tabular-nums ${downstream.diesel.increase >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {downstream.diesel.increase >= 0 ? '+' : ''}${downstream.diesel.increase.toFixed(3)} vs baseline
                </div>
                <div className="text-xs text-slate-600 mt-0.5">
                  Baseline: ${downstream.diesel.baseline.toFixed(2)}/gal (DOE ref)
                </div>
                {/* Arrow */}
                <div className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 text-slate-500 text-lg z-10">→</div>
              </div>

              {/* Freight */}
              <div className="bg-amber-900/10 rounded-lg p-5 border border-amber-700/30 text-center relative">
                <div className="text-xs text-amber-400 uppercase tracking-wide mb-2">Freight Impact</div>
                <div className="text-3xl font-bold text-amber-300 tabular-nums">
                  +{downstream.freight.rateIncreasePercent.toFixed(1)}%
                </div>
                <div className="text-xs text-slate-500 mt-1">freight rate increase</div>
                <div className="mt-3 text-sm text-slate-300 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Surcharge/mile</span>
                    <span className="tabular-nums font-medium">${downstream.freight.surchargePerMile.toFixed(3)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Cost/mile increase</span>
                    <span className="tabular-nums font-medium">${downstream.freight.costPerMileIncrease.toFixed(3)}</span>
                  </div>
                </div>
                {/* Arrow */}
                <div className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 text-slate-500 text-lg z-10">→</div>
              </div>

              {/* Consumer Goods */}
              <div className="bg-red-900/10 rounded-lg p-5 border border-red-700/30 text-center">
                <div className="text-xs text-red-400 uppercase tracking-wide mb-2">Consumer Goods</div>
                <div className="text-3xl font-bold text-red-300 tabular-nums">
                  +{downstream.consumer.avgCPIIncrease.toFixed(2)}%
                </div>
                <div className="text-xs text-slate-500 mt-1">avg CPI increase</div>
                <div className="mt-3 text-sm text-slate-300 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">CPI range</span>
                    <span className="tabular-nums font-medium">{downstream.consumer.minCPIIncrease.toFixed(2)}% – {downstream.consumer.maxCPIIncrease.toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Food price impact</span>
                    <span className="tabular-nums font-medium text-orange-400">+{downstream.consumer.foodPriceIncrease.toFixed(2)}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Pass-through chain table ────────────────────────────────── */}
            <div className="bg-slate-700/30 rounded-lg border border-slate-600/40 p-5">
              <h4 className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-3">
                Diesel-to-Consumer Pass-Through Chain
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="text-xs text-slate-400 uppercase tracking-wide border-b border-slate-700">
                      <th className="pb-2 pr-6 font-medium">Stage</th>
                      <th className="pb-2 pr-6 font-medium">Impact</th>
                      <th className="pb-2 font-medium">Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    <tr>
                      <td className="py-2.5 pr-6 text-slate-300">$1/gal diesel increase</td>
                      <td className="py-2.5 pr-6 text-amber-400 font-medium tabular-nums">+15–17¢/mile trucking cost</td>
                      <td className="py-2.5 text-slate-500 text-xs">ATRI Operational Costs Study</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 pr-6 text-slate-300">Trucking cost increase</td>
                      <td className="py-2.5 pr-6 text-amber-400 font-medium tabular-nums">5–10% freight rate increase</td>
                      <td className="py-2.5 text-slate-500 text-xs">DAT / FreightWaves SONAR</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 pr-6 text-slate-300">Freight rate increase</td>
                      <td className="py-2.5 pr-6 text-red-400 font-medium tabular-nums">0.5–2% consumer goods increase</td>
                      <td className="py-2.5 text-slate-500 text-xs">BLS PPI for Truck Transport</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 pr-6 text-slate-300">Food specifically</td>
                      <td className="py-2.5 pr-6 text-orange-400 font-medium tabular-nums">~9% of retail food cost is transport</td>
                      <td className="py-2.5 text-slate-500 text-xs">USDA Economic Research Service</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 pr-6 text-slate-300">Macro pass-through</td>
                      <td className="py-2.5 pr-6 text-red-400 font-medium tabular-nums">1% gas price ↑ → 0.04% CPI ↑</td>
                      <td className="py-2.5 text-slate-500 text-xs">IMF Working Paper 2021/271</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Household grocery estimate ──────────────────────────────── */}
            {downstream.consumer.foodPriceIncrease > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-orange-900/10 rounded-lg p-5 border border-orange-700/30">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">🛒</span>
                    <span className="text-sm font-medium text-orange-300">Household Grocery Impact</span>
                  </div>
                  <p className="text-xs text-slate-400 mb-3">
                    Average US household spends ~$6,000/yr on food at home (BLS Consumer Expenditure Survey)
                  </p>
                  <div className="text-2xl font-bold text-white tabular-nums">
                    +${(6000 * downstream.consumer.foodPriceIncrease / 100).toFixed(0)}<span className="text-base text-slate-400">/yr</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    estimated extra grocery cost from freight pass-through
                  </div>
                </div>

                <div className="bg-slate-700/30 rounded-lg p-5 border border-slate-600/40">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">💰</span>
                    <span className="text-sm font-medium text-slate-300">Total Household Fuel Burden</span>
                  </div>
                  <p className="text-xs text-slate-400 mb-3">
                    Direct fuel + indirect freight-driven price increases
                  </p>
                  <div className="text-2xl font-bold text-white tabular-nums">
                    ${(result.annualFuelCost + 6000 * downstream.consumer.foodPriceIncrease / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    <span className="text-base text-slate-400">/yr</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    fuel (${result.annualFuelCost.toLocaleString('en-US', { maximumFractionDigits: 0 })}) + grocery impact (+${(6000 * downstream.consumer.foodPriceIncrease / 100).toFixed(0)})
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 text-slate-500 text-sm text-center py-12">
            No downstream impact data available — diesel price data may not be loaded yet.
          </div>
        )}
      </section>

      {/* ══ Section 4: Cost sensitivity context ════════════════════════════ */}
      <section className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-1">📖 Cost Sensitivity Reference</h3>
        <p className="text-xs text-slate-500 mb-5">Annual impact of $1/gallon price change at various driving profiles</p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-xs text-slate-400 uppercase tracking-wide border-b border-slate-700">
                <th className="pb-2 pr-6 font-medium">Driver Profile</th>
                <th className="pb-2 pr-6 font-medium text-right">Annual Miles</th>
                <th className="pb-2 pr-6 font-medium text-right">MPG</th>
                <th className="pb-2 text-right font-medium">Cost / $1/gal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {[
                { label: 'Low mileage (retired)',        miles: 8000,  mpg: 28 },
                { label: 'National average (EPA/FHWA)',  miles: 13500, mpg: 25.4 },
                { label: 'Long commuter (suburban)',     miles: 20000, mpg: 22 },
                { label: 'High mileage (sales/trade)',   miles: 30000, mpg: 20 },
                { label: 'Truck / SUV driver',           miles: 15000, mpg: 16 },
                { label: 'Your profile',                 miles: annualMiles, mpg: vehicleMPG },
              ].map((row, i) => {
                const sens = row.miles / row.mpg;
                const isUser = i === 5;
                return (
                  <tr key={row.label} className={isUser ? 'bg-blue-900/20' : ''}>
                    <td className={`py-2.5 pr-6 ${isUser ? 'text-blue-300 font-semibold' : 'text-slate-300'}`}>
                      {row.label}
                    </td>
                    <td className="py-2.5 pr-6 text-right text-slate-400 tabular-nums">
                      {row.miles.toLocaleString()}
                    </td>
                    <td className="py-2.5 pr-6 text-right text-slate-400 tabular-nums">
                      {row.mpg.toFixed(1)}
                    </td>
                    <td className="py-2.5 text-right font-bold tabular-nums text-white">
                      ${sens.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-slate-600 mt-4">
          Sources: FHWA Highway Statistics Table VM-1 (average annual miles); EPA Automotive Trends Report (fleet MPG).
        </p>
      </section>
    </div>
  );
}
