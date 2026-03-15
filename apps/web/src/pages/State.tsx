import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  getCurrentPrices,
  getHistoricalPrices,
  getPriceChanges,
  getTypicalImpact,
  getSeasonalComparison,
} from '../api/client';
import { PriceChart } from '../components/PriceChart';
import { usePageSEO } from '../hooks/usePageSEO';

// ── State → EIA duoarea code mapping ─────────────────────────────────────────
const ABBR_TO_DUOAREA: Record<string, string> = {
  AL: 'SAL', AK: 'SAK', AZ: 'SAZ', AR: 'SAR', CA: 'SCA',
  CO: 'SCO', CT: 'SCT', DC: 'SDC', DE: 'SDE', FL: 'SFL',
  GA: 'SGA', HI: 'SHI', ID: 'SID', IL: 'SIL', IN: 'SIN',
  IA: 'SIA', KS: 'SKS', KY: 'SKY', LA: 'SLA', ME: 'SME',
  MD: 'SMD', MA: 'SMA', MI: 'SMI', MN: 'SMN', MS: 'SMS',
  MO: 'SMO', MT: 'SMT', NE: 'SNE', NV: 'SNV', NH: 'SNH',
  NJ: 'SNJ', NM: 'SNM', NY: 'SNY', NC: 'SNC', ND: 'SND',
  OH: 'SOH', OK: 'SOK', OR: 'SOR', PA: 'SPA', RI: 'SRI',
  SC: 'SSC', SD: 'SSD', TN: 'STN', TX: 'STX', UT: 'SUT',
  VT: 'SVT', VA: 'SVA', WA: 'SWA', WV: 'SWV', WI: 'SWI',
  WY: 'SWY',
};

const ABBR_TO_NAME: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DC: 'Washington DC', DE: 'Delaware', FL: 'Florida',
  GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana',
  IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine',
  MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
  MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire',
  NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota',
  OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island',
  SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah',
  VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin',
  WY: 'Wyoming',
};

const ABBR_TO_PADD: Record<string, { code: string; name: string }> = {
  CT: { code: 'R10', name: 'East Coast' }, DC: { code: 'R10', name: 'East Coast' },
  DE: { code: 'R10', name: 'East Coast' }, FL: { code: 'R10', name: 'East Coast' },
  GA: { code: 'R10', name: 'East Coast' }, MA: { code: 'R10', name: 'East Coast' },
  MD: { code: 'R10', name: 'East Coast' }, ME: { code: 'R10', name: 'East Coast' },
  NC: { code: 'R10', name: 'East Coast' }, NH: { code: 'R10', name: 'East Coast' },
  NJ: { code: 'R10', name: 'East Coast' }, NY: { code: 'R10', name: 'East Coast' },
  PA: { code: 'R10', name: 'East Coast' }, RI: { code: 'R10', name: 'East Coast' },
  SC: { code: 'R10', name: 'East Coast' }, VA: { code: 'R10', name: 'East Coast' },
  VT: { code: 'R10', name: 'East Coast' }, WV: { code: 'R10', name: 'East Coast' },
  IA: { code: 'R20', name: 'Midwest' }, IL: { code: 'R20', name: 'Midwest' },
  IN: { code: 'R20', name: 'Midwest' }, KS: { code: 'R20', name: 'Midwest' },
  KY: { code: 'R20', name: 'Midwest' }, MI: { code: 'R20', name: 'Midwest' },
  MN: { code: 'R20', name: 'Midwest' }, MO: { code: 'R20', name: 'Midwest' },
  ND: { code: 'R20', name: 'Midwest' }, NE: { code: 'R20', name: 'Midwest' },
  OH: { code: 'R20', name: 'Midwest' }, OK: { code: 'R20', name: 'Midwest' },
  SD: { code: 'R20', name: 'Midwest' }, TN: { code: 'R20', name: 'Midwest' },
  WI: { code: 'R20', name: 'Midwest' },
  AL: { code: 'R30', name: 'Gulf Coast' }, AR: { code: 'R30', name: 'Gulf Coast' },
  LA: { code: 'R30', name: 'Gulf Coast' }, MS: { code: 'R30', name: 'Gulf Coast' },
  NM: { code: 'R30', name: 'Gulf Coast' }, TX: { code: 'R30', name: 'Gulf Coast' },
  CO: { code: 'R40', name: 'Rocky Mountain' }, ID: { code: 'R40', name: 'Rocky Mountain' },
  MT: { code: 'R40', name: 'Rocky Mountain' }, UT: { code: 'R40', name: 'Rocky Mountain' },
  WY: { code: 'R40', name: 'Rocky Mountain' },
  AK: { code: 'R50', name: 'West Coast' }, AZ: { code: 'R50', name: 'West Coast' },
  CA: { code: 'R50', name: 'West Coast' }, HI: { code: 'R50', name: 'West Coast' },
  NV: { code: 'R50', name: 'West Coast' }, OR: { code: 'R50', name: 'West Coast' },
  WA: { code: 'R50', name: 'West Coast' },
};

// ── Time range options ───────────────────────────────────────────────────────


export default function State() {
  const { stateAbbr: rawAbbr } = useParams<{ stateAbbr: string }>();
  const abbr = (rawAbbr ?? '').toUpperCase();
  const stateName = ABBR_TO_NAME[abbr];
  const duoarea = ABBR_TO_DUOAREA[abbr];
  const padd = ABBR_TO_PADD[abbr];

  usePageSEO({
    title: stateName ? `${stateName} Gas Prices` : 'State Gas Prices',
    description: stateName
      ? `Current ${stateName} gasoline prices, historical trends, and consumer impact. Compare ${abbr} prices to the national and ${padd?.name ?? 'regional'} average.`
      : 'State-level gasoline price data',
    canonicalPath: `/state/${abbr}`,
  });

  // ── Queries ────────────────────────────────────────────────────────────────
  // State-level current prices (all regions come back — we'll filter)
  const { data: allPrices, isLoading: pricesLoading } = useQuery({
    queryKey: ['currentPrices', 'gas_regular'],
    queryFn: () => getCurrentPrices('gas_regular'),
    enabled: !!duoarea,
  });

  // Historical price chart data
  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['stateHistory', duoarea],
    queryFn: () => getHistoricalPrices({ metric: 'gas_regular', region: duoarea!, granularity: 'weekly' }),
    enabled: !!duoarea,
  });

  // Price changes (week/month/year deltas)
  const { data: priceChanges } = useQuery({
    queryKey: ['statePriceChanges', duoarea],
    queryFn: () => getPriceChanges('gas_regular', duoarea!),
    enabled: !!duoarea,
  });

  // Consumer impact at current state price
  const { data: impact } = useQuery({
    queryKey: ['stateImpact', duoarea],
    queryFn: () => getTypicalImpact(duoarea!),
    enabled: !!duoarea,
  });

  // Seasonal comparison
  const { data: seasonal } = useQuery({
    queryKey: ['stateSeasonal', duoarea],
    queryFn: () => getSeasonalComparison('gas_regular', duoarea!, 5),
    enabled: !!duoarea,
  });

  // National + PADD averages for comparison
  const nationalPrice = useMemo(() => {
    return allPrices?.find((p: any) => p.region === 'NUS')?.value ?? null;
  }, [allPrices]);

  const paddPrice = useMemo(() => {
    if (!padd) return null;
    return allPrices?.find((p: any) => p.region === padd.code)?.value ?? null;
  }, [allPrices, padd]);

  const statePrice = useMemo(() => {
    if (!duoarea) return null;
    return allPrices?.find((p: any) => p.region === duoarea)?.value ?? null;
  }, [allPrices, duoarea]);

  // ── Guard: unknown state ───────────────────────────────────────────────────
  if (!stateName || !duoarea) {
    return (
      <div className="space-y-4">
        <Link to="/comparison" className="text-primary-400 hover:text-primary-300 text-sm">← Back to Regional</Link>
        <div className="bg-slate-800 rounded-lg p-8 border border-slate-700 text-center">
          <div className="text-2xl font-bold text-white mb-2">State Not Found</div>
          <p className="text-slate-400">
            "{rawAbbr}" is not a recognized state abbreviation.
          </p>
        </div>
      </div>
    );
  }

  if (pricesLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-slate-400">Loading {stateName} data...</div>
      </div>
    );
  }

  const vsNational = statePrice != null && nationalPrice != null && nationalPrice > 0
    ? ((statePrice - nationalPrice) / nationalPrice) * 100
    : null;
  const vsPadd = statePrice != null && paddPrice != null && paddPrice > 0
    ? ((statePrice - paddPrice) / paddPrice) * 100
    : null;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link to="/comparison" className="text-primary-400 hover:text-primary-300 transition-colors">Regional</Link>
        <span className="text-slate-600">/</span>
        <span className="text-slate-400">{stateName}</span>
      </div>

      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-white mb-1">{stateName} ({abbr})</h2>
        <p className="text-slate-400">
          {padd?.name} (PADD {padd?.code.replace('R', '')}) · Regular gasoline
        </p>
      </div>

      {/* Price Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* State Price */}
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 text-center">
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">{abbr} Current</div>
          <div className="text-2xl font-bold text-white">
            {statePrice != null ? `$${statePrice.toFixed(3)}` : '—'}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">per gallon</div>
        </div>

        {/* vs National */}
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 text-center">
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">National Avg</div>
          <div className="text-2xl font-bold text-white">
            {nationalPrice != null ? `$${nationalPrice.toFixed(3)}` : '—'}
          </div>
          {vsNational != null && (
            <span className={`mt-1 inline-flex text-xs font-semibold px-2 py-0.5 rounded-full ${vsNational >= 0 ? 'bg-red-900/50 text-red-300' : 'bg-green-900/50 text-green-300'}`}>
              {vsNational >= 0 ? '+' : ''}{vsNational.toFixed(1)}%
            </span>
          )}
        </div>

        {/* vs PADD */}
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 text-center">
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">{padd?.name} Avg</div>
          <div className="text-2xl font-bold text-white">
            {paddPrice != null ? `$${paddPrice.toFixed(3)}` : '—'}
          </div>
          {vsPadd != null && (
            <span className={`mt-1 inline-flex text-xs font-semibold px-2 py-0.5 rounded-full ${vsPadd >= 0 ? 'bg-red-900/50 text-red-300' : 'bg-green-900/50 text-green-300'}`}>
              {vsPadd >= 0 ? '+' : ''}{vsPadd.toFixed(1)}%
            </span>
          )}
        </div>

        {/* Seasonal */}
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 text-center">
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Seasonal Avg</div>
          {seasonal ? (
            <>
              <div className="text-2xl font-bold text-white">${seasonal.seasonalAvg.toFixed(3)}</div>
              <span className={`mt-1 inline-flex text-xs font-semibold px-2 py-0.5 rounded-full ${seasonal.delta >= 0 ? 'bg-red-900/50 text-red-300' : 'bg-green-900/50 text-green-300'}`}>
                {seasonal.delta >= 0 ? '+' : ''}${Math.abs(seasonal.delta).toFixed(3)}
              </span>
            </>
          ) : (
            <div className="text-2xl font-bold text-white">—</div>
          )}
        </div>
      </div>

      {/* Price Changes */}
      {priceChanges && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: '1 Week', price: priceChanges.weekAgoPrice, pct: priceChanges.weekChangePct },
            { label: '1 Month', price: priceChanges.monthAgoPrice, pct: priceChanges.monthChangePct },
            { label: '3 Months', price: priceChanges.threeMonthAgoPrice, pct: priceChanges.threeMonthChangePct },
            { label: '1 Year', price: priceChanges.yearAgoPrice, pct: priceChanges.yearChangePct },
          ].map(({ label, price, pct }) => (
            <div key={label} className="bg-slate-800 rounded-lg p-4 border border-slate-700 text-center">
              <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">{label} Ago</div>
              <div className="text-xl font-bold text-white">
                {price != null ? `$${price.toFixed(3)}` : '—'}
              </div>
              {pct != null && (
                <span className={`mt-1 inline-flex text-xs font-semibold px-2 py-0.5 rounded-full ${pct >= 0 ? 'bg-red-900/50 text-red-300' : 'bg-green-900/50 text-green-300'}`}>
                  {pct >= 0 ? '▲' : '▼'} {Math.abs(pct).toFixed(2)}%
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Historical Chart */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4">
          Price History — {stateName}
        </h3>
        {historyLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-slate-400">Loading chart...</div>
          </div>
        ) : history && history.length > 0 ? (
          <PriceChart
            data={history.map((d: any) => ({
              time: d.time,
              value: parseFloat(d.value),
            }))}
            height={320}
          />
        ) : (
          <div className="flex justify-center items-center h-64">
            <p className="text-slate-400">
              No historical data available for {stateName}.
              {!statePrice && ' EIA may not report state-level prices for this state.'}
            </p>
          </div>
        )}
      </div>

      {/* Consumer Impact */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Household Cost */}
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">⛽</span>
            <span className="text-sm font-medium text-slate-300">Annual Fuel Cost in {abbr}</span>
          </div>
          {impact ? (
            <>
              <div className="text-3xl font-bold text-white mb-1">
                ${Math.round(impact.annualCost).toLocaleString()}
              </div>
              <div className="text-xs text-slate-500 mb-3">avg household · 13,500 mi/yr @ 25.4 MPG</div>
              {impact.vsBaseline != null && (
                <div className={`text-xs font-semibold ${impact.vsBaseline >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {impact.vsBaseline >= 0 ? '▲' : '▼'} ${Math.abs(impact.vsBaseline).toFixed(0)} vs $2.50 baseline
                </div>
              )}
              <div className="mt-3 pt-3 border-t border-slate-700 text-xs text-slate-500">
                <div className="flex justify-between">
                  <span>Per-dollar sensitivity</span>
                  <span className="text-slate-400">{impact.costPerDollar?.toFixed(0) ?? '—'} gal/yr</span>
                </div>
              </div>
            </>
          ) : statePrice ? (
            <div className="text-slate-500 text-sm">Calculating…</div>
          ) : (
            <div className="text-slate-500 text-sm">No state-level price data available</div>
          )}
        </div>

        {/* Price Position */}
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">📊</span>
            <span className="text-sm font-medium text-slate-300">Price Position</span>
          </div>
          <div className="space-y-4">
            {/* vs National bar */}
            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>vs National Average</span>
                <span className={vsNational != null ? (vsNational >= 0 ? 'text-red-400' : 'text-green-400') : ''}>
                  {vsNational != null ? `${vsNational >= 0 ? '+' : ''}${vsNational.toFixed(1)}%` : '—'}
                </span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2.5 relative">
                {vsNational != null && (
                  <>
                    <div className="absolute top-0 left-1/2 w-0.5 h-2.5 bg-slate-500" />
                    <div
                      className={`absolute top-0 h-2.5 rounded-full ${vsNational >= 0 ? 'bg-red-500' : 'bg-green-500'}`}
                      style={{
                        left: vsNational >= 0 ? '50%' : `${50 + Math.max(vsNational, -20)}%`,
                        width: `${Math.min(Math.abs(vsNational), 20)}%`,
                      }}
                    />
                  </>
                )}
              </div>
            </div>
            {/* vs PADD bar */}
            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>vs {padd?.name} Average</span>
                <span className={vsPadd != null ? (vsPadd >= 0 ? 'text-red-400' : 'text-green-400') : ''}>
                  {vsPadd != null ? `${vsPadd >= 0 ? '+' : ''}${vsPadd.toFixed(1)}%` : '—'}
                </span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2.5 relative">
                {vsPadd != null && (
                  <>
                    <div className="absolute top-0 left-1/2 w-0.5 h-2.5 bg-slate-500" />
                    <div
                      className={`absolute top-0 h-2.5 rounded-full ${vsPadd >= 0 ? 'bg-red-500' : 'bg-green-500'}`}
                      style={{
                        left: vsPadd >= 0 ? '50%' : `${50 + Math.max(vsPadd, -20)}%`,
                        width: `${Math.min(Math.abs(vsPadd), 20)}%`,
                      }}
                    />
                  </>
                )}
              </div>
            </div>
            {/* Seasonal position */}
            {seasonal && (
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>vs {seasonal.yearsIncluded}Y Seasonal Avg (wk {seasonal.isoWeek})</span>
                  <span className={seasonal.deltaPct >= 0 ? 'text-red-400' : 'text-green-400'}>
                    {seasonal.deltaPct >= 0 ? '+' : ''}{seasonal.deltaPct.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2.5 relative">
                  <div className="absolute top-0 left-1/2 w-0.5 h-2.5 bg-slate-500" />
                  <div
                    className={`absolute top-0 h-2.5 rounded-full ${seasonal.deltaPct >= 0 ? 'bg-red-500' : 'bg-green-500'}`}
                    style={{
                      left: seasonal.deltaPct >= 0 ? '50%' : `${50 + Math.max(seasonal.deltaPct, -20)}%`,
                      width: `${Math.min(Math.abs(seasonal.deltaPct), 20)}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
          {!statePrice && (
            <p className="text-xs text-slate-500 mt-4">
              EIA does not report individual prices for {stateName}. The PADD regional average is shown instead.
            </p>
          )}
        </div>
      </div>

      {/* No data note */}
      {!statePrice && (
        <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-4">
          <p className="text-sm text-amber-300">
            <strong>Note:</strong> The EIA does not publish weekly retail gasoline prices for every state.
            {stateName} is part of the {padd?.name} region — the PADD average (${ paddPrice?.toFixed(3) ?? '—'}/gal) is shown as a proxy.
          </p>
        </div>
      )}
    </div>
  );
}
