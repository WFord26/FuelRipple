import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getCurrentPrices, getDisruptionScore, getTypicalImpact, getRegionalComparison, getPriceChanges, getSupplyHealth, getDownstreamImpact } from '../api/client';
import DisruptionMeter from '../components/DisruptionMeter';
import USPriceMap from '../components/USPriceMap';
import { usePageSEO } from '../hooks/usePageSEO';

const SUPPLY_CLR: Record<string, string> = {
  normal:        'text-green-400  bg-green-500/15  border-green-500/30',
  elevated_risk: 'text-yellow-400 bg-yellow-500/15 border-yellow-500/30',
  supply_stress: 'text-orange-400 bg-orange-500/15 border-orange-500/30',
  critical:      'text-red-400    bg-red-500/15    border-red-500/30',
};
const SUPPLY_BAR: Record<string, string> = {
  normal: 'bg-green-500', elevated_risk: 'bg-yellow-400', supply_stress: 'bg-orange-500', critical: 'bg-red-500',
};
const SUPPLY_LABEL: Record<string, string> = {
  normal: 'Normal', elevated_risk: 'Elevated Risk', supply_stress: 'Supply Stress', critical: 'Critical',
};

export default function Dashboard() {
  usePageSEO({
    title: 'US Gas Price Dashboard',
    description: 'Live US gasoline prices across all PADD regions and 50 states. Includes a Consumer Disruption Index, supply health alerts, and crude oil correlation. Data from EIA, FRED, and AAA.',
    canonicalPath: '/',
  });

  const { data: prices, isLoading: pricesLoading } = useQuery({
    queryKey: ['currentPrices'],
    queryFn: () => getCurrentPrices('gas_regular'),
  });

  const { data: priceChanges } = useQuery({
    queryKey: ['priceChanges'],
    queryFn: () => getPriceChanges('gas_regular', 'NUS'),
  });

  const { data: comparisonData } = useQuery({
    queryKey: ['priceComparison'],
    queryFn: () => getRegionalComparison('gas_regular'),
  });

  const { data: disruption, isLoading: disruptionLoading } = useQuery({
    queryKey: ['disruptionScore'],
    queryFn: () => getDisruptionScore(),
  });

  const { data: impact, isLoading: impactLoading } = useQuery({
    queryKey: ['typicalImpact'],
    queryFn: () => getTypicalImpact(),
  });

  const { data: supplyHealth } = useQuery({
    queryKey: ['supplyHealth'],
    queryFn: getSupplyHealth,
    staleTime: 60 * 60 * 1000,
  });

  const { data: downstream } = useQuery({
    queryKey: ['downstreamImpact'],
    queryFn: () => getDownstreamImpact(),
    staleTime: 60 * 60 * 1000,
  });

  if (pricesLoading || disruptionLoading || impactLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-slate-400">Loading dashboard...</div>
      </div>
    );
  }

  const nationalPrice = prices?.find((p: any) => p.region === 'NUS');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-white mb-2">Price Overview</h2>
        <p className="text-slate-400">Current US gasoline prices and consumer impact</p>
      </div>

      {/* National Average — 5 squares */}
      <div>
        <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">National Average</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {/* Current */}
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 flex flex-col items-center justify-center text-center">
            <div className="text-xs text-slate-400 mb-1 uppercase tracking-wide">Current</div>
            <div className="text-2xl font-bold text-white">${nationalPrice?.value.toFixed(3)}</div>
            <div className="text-xs text-slate-500 mt-0.5">per gallon</div>
          </div>

          {/* 1 Week */}
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 flex flex-col items-center justify-center text-center">
            <div className="text-xs text-slate-400 mb-1 uppercase tracking-wide">1 Week Ago</div>
            <div className="text-2xl font-bold text-white">
              {priceChanges?.weekAgoPrice != null ? `$${priceChanges.weekAgoPrice.toFixed(3)}` : '—'}
            </div>
            {priceChanges?.weekChangePct != null && (
              <span className={`mt-1 inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${priceChanges.weekChangePct >= 0 ? 'bg-red-900/50 text-red-300' : 'bg-green-900/50 text-green-300'}`}>
                {priceChanges.weekChangePct >= 0 ? '▲' : '▼'} {Math.abs(priceChanges.weekChangePct).toFixed(2)}%
              </span>
            )}
          </div>

          {/* 1 Month */}
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 flex flex-col items-center justify-center text-center">
            <div className="text-xs text-slate-400 mb-1 uppercase tracking-wide">1 Month Ago</div>
            <div className="text-2xl font-bold text-white">
              {priceChanges?.monthAgoPrice != null ? `$${priceChanges.monthAgoPrice.toFixed(3)}` : '—'}
            </div>
            {priceChanges?.monthChangePct != null && (
              <span className={`mt-1 inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${priceChanges.monthChangePct >= 0 ? 'bg-red-900/50 text-red-300' : 'bg-green-900/50 text-green-300'}`}>
                {priceChanges.monthChangePct >= 0 ? '▲' : '▼'} {Math.abs(priceChanges.monthChangePct).toFixed(2)}%
              </span>
            )}
          </div>

          {/* 3 Month */}
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 flex flex-col items-center justify-center text-center">
            <div className="text-xs text-slate-400 mb-1 uppercase tracking-wide">3 Months Ago</div>
            <div className="text-2xl font-bold text-white">
              {priceChanges?.threeMonthAgoPrice != null ? `$${priceChanges.threeMonthAgoPrice.toFixed(3)}` : '—'}
            </div>
            {priceChanges?.threeMonthChangePct != null && (
              <span className={`mt-1 inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${priceChanges.threeMonthChangePct >= 0 ? 'bg-red-900/50 text-red-300' : 'bg-green-900/50 text-green-300'}`}>
                {priceChanges.threeMonthChangePct >= 0 ? '▲' : '▼'} {Math.abs(priceChanges.threeMonthChangePct).toFixed(2)}%
              </span>
            )}
          </div>

          {/* 1 Year */}
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 flex flex-col items-center justify-center text-center">
            <div className="text-xs text-slate-400 mb-1 uppercase tracking-wide">1 Year Ago</div>
            <div className="text-2xl font-bold text-white">
              {priceChanges?.yearAgoPrice != null ? `$${priceChanges.yearAgoPrice.toFixed(3)}` : '—'}
            </div>
            {priceChanges?.yearChangePct != null && (
              <span className={`mt-1 inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${priceChanges.yearChangePct >= 0 ? 'bg-red-900/50 text-red-300' : 'bg-green-900/50 text-green-300'}`}>
                {priceChanges.yearChangePct >= 0 ? '▲' : '▼'} {Math.abs(priceChanges.yearChangePct).toFixed(2)}%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Consumer Expenditure Impact */}
      <div>
        <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">Consumer Expenditure Impact</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Household Annual Fuel Cost */}
          <div className="bg-slate-800 rounded-lg p-5 border border-slate-700">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">⛽</span>
              <span className="text-sm font-medium text-slate-300">Annual Fuel Cost</span>
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              ${impact?.annualCost != null ? Math.round(impact.annualCost).toLocaleString() : '—'}
            </div>
            <div className="text-xs text-slate-500 mb-3">avg household · 13,500 mi/yr @ 25.4 MPG</div>
            {impact?.vsBaseline != null && (
              <div className={`text-xs font-semibold ${impact.vsBaseline >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                {impact.vsBaseline >= 0 ? '▲' : '▼'} ${Math.abs(impact.vsBaseline).toFixed(0)} vs baseline
              </div>
            )}
            <div className="mt-3 pt-3 border-t border-slate-700 text-xs text-slate-500">
              <div className="flex justify-between">
                <span>Per-dollar sensitivity</span>
                <span className="text-slate-400">{impact?.costPerDollar != null ? impact.costPerDollar.toFixed(0) : '—'} gal/yr</span>
              </div>
            </div>
          </div>

          {/* Freight Cost Increase */}
          <div className="bg-slate-800 rounded-lg p-5 border border-slate-700">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">🚛</span>
              <span className="text-sm font-medium text-slate-300">Freight Cost Increase</span>
            </div>
            {downstream ? (
              <>
                <div className="text-3xl font-bold text-white mb-1">
                  {downstream.freight.rateIncreasePercent >= 0 ? '+' : ''}{downstream.freight.rateIncreasePercent.toFixed(1)}%
                </div>
                <div className="text-xs text-slate-500 mb-3">trucking rate vs diesel baseline (${downstream.diesel.baseline.toFixed(2)}/gal)</div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Diesel price</span>
                    <span className={`font-semibold ${downstream.diesel.increase >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                      ${downstream.diesel.current.toFixed(3)}
                      {downstream.diesel.increase !== 0 && (
                        <span className="ml-1">({downstream.diesel.increase >= 0 ? '+' : ''}${downstream.diesel.increase.toFixed(2)})</span>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Surcharge per mile</span>
                    <span className={`font-semibold ${downstream.freight.surchargePerMile >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {downstream.freight.surchargePerMile >= 0 ? '+' : ''}¢{(downstream.freight.surchargePerMile * 100).toFixed(1)}/mi
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Cost per mile increase</span>
                    <span className={`font-semibold ${downstream.freight.costPerMileIncrease >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {downstream.freight.costPerMileIncrease >= 0 ? '+' : ''}¢{(downstream.freight.costPerMileIncrease * 100).toFixed(1)}/mi
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-slate-500 text-sm">Loading…</div>
            )}
          </div>

          {/* Consumer Goods Impact */}
          <div className="bg-slate-800 rounded-lg p-5 border border-slate-700">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">🛒</span>
              <span className="text-sm font-medium text-slate-300">Consumer Goods Impact</span>
            </div>
            {downstream ? (
              <>
                <div className="text-3xl font-bold text-white mb-1">
                  {downstream.consumer.avgCPIIncrease >= 0 ? '+' : ''}{downstream.consumer.avgCPIIncrease.toFixed(2)}%
                </div>
                <div className="text-xs text-slate-500 mb-3">estimated CPI pass-through from freight rates</div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">CPI range</span>
                    <span className="text-slate-300 font-semibold">
                      +{downstream.consumer.minCPIIncrease.toFixed(2)}% – +{downstream.consumer.maxCPIIncrease.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Food price increase</span>
                    <span className={`font-semibold ${downstream.consumer.foodPriceIncrease >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {downstream.consumer.foodPriceIncrease >= 0 ? '+' : ''}{downstream.consumer.foodPriceIncrease.toFixed(2)}%
                    </span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-700 text-xs text-slate-500">
                  Transport is ~9% of retail food cost. Freight rate → CPI ratio ~10:1.
                </div>
              </>
            ) : (
              <div className="text-slate-500 text-sm">Loading…</div>
            )}
          </div>

        </div>
      </div>

      {/* Daily US Consumer Spend */}
      {priceChanges && (() => {
        const gal = priceChanges.dailyGallonsUs;
        const todayCost  = priceChanges.dailyConsumerCost;
        const weekCost        = priceChanges.weekAgoPrice       != null ? priceChanges.weekAgoPrice       * gal : null;
        const monthCost       = priceChanges.monthAgoPrice      != null ? priceChanges.monthAgoPrice      * gal : null;
        const threeMonthCost  = priceChanges.threeMonthAgoPrice != null ? priceChanges.threeMonthAgoPrice * gal : null;
        const vsWeekDelta       = weekCost       != null ? todayCost - weekCost       : null;
        const vsMonthDelta      = monthCost      != null ? todayCost - monthCost      : null;
        const vsThreeMonthDelta = threeMonthCost != null ? todayCost - threeMonthCost : null;

        const DeltaBadge = ({ delta, label }: { delta: number | null; label: string }) => {
          if (delta == null) return null;
          const up = delta >= 0;
          const abs = Math.abs(delta / 1_000_000_000);
          return (
            <div className="flex flex-col">
              <span className="text-xs text-slate-500">{label}</span>
              <span className={`text-sm font-semibold ${up ? 'text-red-400' : 'text-green-400'}`}>
                {up ? '+' : '-'}${abs.toFixed(2)}B/day
              </span>
            </div>
          );
        };

        return (
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4">
              Daily US Consumer Gas Spend
              <span className="text-xs font-normal text-slate-500 ml-2">(prior day estimate)</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div>
                <div className="text-xs text-slate-400 mb-1">Price per Gallon</div>
                <div className="text-2xl font-bold text-white">${priceChanges.currentPrice.toFixed(3)}</div>
                <div className="text-xs text-slate-500 mt-0.5">latest weekly national avg</div>
              </div>
              <div>
                <div className="text-xs text-slate-400 mb-1">Daily Gallons Purchased</div>
                <div className="text-2xl font-bold text-white">
                  {(gal / 1_000_000).toFixed(0)}M
                </div>
                <div className="text-xs text-slate-500 mt-0.5">est. US daily consumption (EIA)</div>
              </div>
              <div>
                <div className="text-xs text-slate-400 mb-1">Total Daily Cost to US Consumers</div>
                <div className="text-2xl font-bold text-blue-400">
                  ${(todayCost / 1_000_000_000).toFixed(2)}B
                </div>
                <div className="text-xs text-slate-500 mt-0.5 mb-2">price × daily gallons consumed</div>
                <div className="flex gap-4 flex-wrap">
                  <DeltaBadge delta={vsWeekDelta}       label="vs 1 week ago" />
                  <DeltaBadge delta={vsMonthDelta}      label="vs 1 month ago" />
                  <DeltaBadge delta={vsThreeMonthDelta} label="vs 3 months ago" />
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Disruption Score + Supply Health side-by-side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="text-sm text-slate-400 mb-4">Disruption Score</div>
          {disruption && (
            <DisruptionMeter
              score={disruption.score}
              classification={disruption.classification}
            />
          )}
        </div>

        {/* Supply Health Mini Card */}
        {supplyHealth && (() => {
          const overall = supplyHealth.overall ?? 'normal';
          return (
            <div className={`bg-slate-800 rounded-lg p-6 border ${SUPPLY_CLR[overall]}`}>
              <div className="flex justify-between items-start mb-4">
                <div className="text-sm text-slate-400">Supply Health</div>
                <Link to="/supply" className="text-xs text-primary-400 hover:text-primary-300 transition-colors">
                  Full report →
                </Link>
              </div>
              <div className={`text-2xl font-bold mb-1 ${SUPPLY_CLR[overall].split(' ')[0]}`}>
                {SUPPLY_LABEL[overall]}
              </div>
              <div className="text-xs text-slate-400 mb-4">
                Refinery utilization &amp; inventory levels
              </div>
              {/* PADD mini bars */}
              <div className="space-y-2">
                {(supplyHealth.regions ?? []).map((r: any) => (
                  <div key={r.region}>
                    <div className="flex justify-between text-xs text-slate-400 mb-0.5">
                      <span>{r.region === 'US' ? 'National' : r.region === 'R10' ? 'East Coast' : r.region === 'R20' ? 'Midwest' : r.region === 'R30' ? 'Gulf Coast' : r.region === 'R40' ? 'Rocky Mountain' : 'West Coast'}</span>
                      <span className="text-slate-300">{r.utilization_pct?.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${SUPPLY_BAR[r.classification]}`}
                        style={{ width: `${Math.min(r.utilization_pct ?? 0, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Regional Breakdown */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h3 className="text-xl font-bold text-white mb-4">Regional Prices</h3>
        <USPriceMap comparisonData={comparisonData ?? []} height={380} />
      </div>

      {/* Cost Impact */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h3 className="text-xl font-bold text-white mb-4">Consumer Impact</h3>
        <div className="text-slate-300 space-y-2">
          <p>
            <span className="font-semibold text-primary-400">
              ${impact?.costPerDollar.toFixed(0)}
            </span>{' '}
            additional annual cost per $1/gallon increase
          </p>
          <p className="text-sm text-slate-400">
            Based on average driving patterns of 13,500 miles per year with a fleet fuel
            economy of 25.4 MPG (EPA)
          </p>
        </div>
      </div>
    </div>
  );
}
