import { useState, useMemo, Fragment } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  getAaaStateLatest,
  getAaaStateHistory,
  getAaaStateChanges,
  getAaaNationalLatest,
  getStatePrice,
  getTypicalImpact,
  getAaaMetrosLatest,
  getEvents,
} from '../api/client';
import { PriceChart } from '../components/PriceChart';
import { MetroHeatmap } from '../components/MetroHeatmap';
import StoryCard, { StoryCardData } from '../components/StoryCard';
import EventAnnotationControls from '../components/EventAnnotationControls';
import { usePageSEO } from '../hooks/usePageSEO';
import { eventToAnnotationMarker } from '../utils/eventAnnotations';

// ── State → EIA duoarea code mapping ─────────────────────────────────────────
// Keeping PADD mapping for regional reference, but no longer mapping to EIA regions


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

// Map from UI fuel type to grade name in API responses
const gradeMap: Record<string, string> = {
  gas_regular: 'regular',
  diesel: 'diesel',
};


export default function State() {
  const { stateAbbr: rawAbbr } = useParams<{ stateAbbr: string }>();
  const abbr = (rawAbbr ?? '').toUpperCase();
  const stateName = ABBR_TO_NAME[abbr];
  const padd = ABBR_TO_PADD[abbr];
  const [chartFuelType, setChartFuelType] = useState<'gas_regular' | 'diesel'>('gas_regular');
  const chartFuelLabel = chartFuelType === 'gas_regular' ? 'Regular Gasoline' : 'Diesel';
  const [selectedEventCategories, setSelectedEventCategories] = useState<string[]>([]);

  usePageSEO({
    title: stateName ? `${stateName} Gas Prices` : 'State Gas Prices',
    description: stateName
      ? `Current ${stateName} gasoline and diesel prices, historical trends, and consumer impact. Compare ${abbr} prices to the national and ${padd?.name ?? 'regional'} average.`
      : 'State-level gasoline price data',
    canonicalPath: `/state/${abbr}`,
  });

  // ── Queries ────────────────────────────────────────────────────────────────
  // State-level data: Try AAA first, fall back to EIA if unavailable
  const { data: stateLatest, isLoading: stateLoading } = useQuery({
    queryKey: ['stateLatest', abbr],
    queryFn: async () => {
      try {
        // Try AAA first
        return await getAaaStateLatest(abbr);
      } catch (error) {
        // Fall back to EIA if AAA not available
        return await getStatePrice(abbr);
      }
    },
    enabled: !!stateName,
  });

  const { data: stateHistory, isLoading: historyLoading } = useQuery({
    queryKey: ['aaaStateHistory', abbr],
    queryFn: () => getAaaStateHistory(abbr, 90),
    enabled: !!stateName,
  });

  const { data: stateChanges } = useQuery({
    queryKey: ['aaaStateChanges', abbr],
    queryFn: () => getAaaStateChanges(abbr),
    enabled: !!stateName,
  });

  // National AAA data for comparison
  const { data: nationalLatest } = useQuery({
    queryKey: ['aaaNationalLatest'],
    queryFn: () => getAaaNationalLatest(),
  });

  const { data: impact } = useQuery({
    queryKey: ['stateImpact', padd?.code],
    queryFn: () => getTypicalImpact(padd?.code || 'NUS'),
    enabled: !!padd,
  });

  // Metro-level data for heatmap
  const { data: metros, isLoading: metrosLoading } = useQuery({
    queryKey: ['metrosLatest', abbr],
    queryFn: () => getAaaMetrosLatest(abbr),
    enabled: !!stateName,
  });

  // Recent market events for context
  const { data: recentEvents = [] } = useQuery({
    queryKey: ['stateEvents'],
    queryFn: () => getEvents(),
    staleTime: 60 * 60 * 1000,
  });

  // Extract all prices from AAA data
  const allGrades = useMemo(() => {
    if (!stateLatest || !nationalLatest) return null;
    
    return [
      {
        grade: 'regular',
        label: 'Regular',
        statePrice: typeof stateLatest.regular === 'number' ? stateLatest.regular : Number(stateLatest.regular),
        nationalPrice: typeof nationalLatest.regular === 'number' ? nationalLatest.regular : Number(nationalLatest.regular),
      },
      {
        grade: 'mid_grade',
        label: 'Mid-Grade',
        statePrice: typeof stateLatest.mid_grade === 'number' ? stateLatest.mid_grade : Number(stateLatest.mid_grade),
        nationalPrice: typeof nationalLatest.mid_grade === 'number' ? nationalLatest.mid_grade : Number(nationalLatest.mid_grade),
      },
      {
        grade: 'premium',
        label: 'Premium',
        statePrice: typeof stateLatest.premium === 'number' ? stateLatest.premium : Number(stateLatest.premium),
        nationalPrice: typeof nationalLatest.premium === 'number' ? nationalLatest.premium : Number(nationalLatest.premium),
      },
      {
        grade: 'diesel',
        label: 'Diesel',
        statePrice: typeof stateLatest.diesel === 'number' ? stateLatest.diesel : Number(stateLatest.diesel),
        nationalPrice: typeof nationalLatest.diesel === 'number' ? nationalLatest.diesel : Number(nationalLatest.diesel),
      },
    ].map(g => ({
      ...g,
      vsDiff: g.statePrice != null && g.nationalPrice != null && g.nationalPrice > 0
        ? ((g.statePrice - g.nationalPrice) / g.nationalPrice) * 100
        : null,
    }));
  }, [stateLatest, nationalLatest]);

  const pricesLoading = stateLoading;

  // ── Guard: unknown state ───────────────────────────────────────────────────
  if (!stateName) {
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

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link to="/comparison" className="text-primary-400 hover:text-primary-300 transition-colors">Regional</Link>
        <span className="text-slate-600">/</span>
        <span className="text-slate-400">{stateName}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold text-white mb-1">{stateName} ({abbr})</h2>
          <p className="text-slate-400">
            {padd?.name} (PADD {padd?.code.replace('R', '')})
          </p>
        </div>
      </div>

      {/* Market Context Story Cards */}
      {recentEvents.length > 0 && (() => {
        const categoryIcons: Record<string, string> = {
          opec: '🛢️', hurricane: '🌀', sanctions: '⚠️', policy: '📋', other: '📰',
        };
        const stateStories: StoryCardData[] = recentEvents.slice(0, 3).map((evt: any) => ({
          id: `state-event-${evt.id}`,
          title: evt.title,
          insight:
            evt.impact === 'bullish' ? 'Upward price pressure expected' :
            evt.impact === 'bearish' ? 'Downward price pressure expected' :
            'Neutral market impact',
          detail: evt.description,
          category: 'event' as const,
          icon: categoryIcons[evt.category] || '📰',
          color: (evt.impact === 'bullish' ? 'red' : evt.impact === 'bearish' ? 'green' : 'slate') as StoryCardData['color'],
          date: new Date(evt.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        }));

        return (
          <div>
            <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">Recent Market Events</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {stateStories.map((story) => (
                <StoryCard key={story.id} {...story} />
              ))}
            </div>
          </div>
        );
      })()}

      {/* Current Prices Table — All Grades */}
      {allGrades && allGrades.length > 0 ? (
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 overflow-x-auto">
          <h3 className="text-lg font-semibold text-white mb-4">Current Prices</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left px-3 py-2 text-slate-400 font-medium">Fuel Grade</th>
                <th className="text-right px-3 py-2 text-slate-400 font-medium">{abbr} Price</th>
                <th className="text-right px-3 py-2 text-slate-400 font-medium">National Avg</th>
                <th className="text-right px-3 py-2 text-slate-400 font-medium">Difference</th>
              </tr>
            </thead>
            <tbody>
              {allGrades.map((g) => (
                <tr key={g.grade} className="border-b border-slate-700 last:border-b-0">
                  <td className="px-3 py-3 text-slate-300 font-medium">{g.label}</td>
                  <td className="text-right px-3 py-3 text-white font-semibold">
                    ${g.statePrice?.toFixed(3) ?? '—'}
                  </td>
                  <td className="text-right px-3 py-3 text-slate-400">
                    ${g.nationalPrice?.toFixed(3) ?? '—'}
                  </td>
                  <td className="text-right px-3 py-3">
                    {g.vsDiff != null ? (
                      <span className={`font-semibold ${g.vsDiff >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {g.vsDiff >= 0 ? '+' : ''}{g.vsDiff.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 text-center">
          <p className="text-slate-400">No current price data available for {stateName}</p>
        </div>
      )}

      {/* Metro Heatmap */}
      {metros && metros.length > 0 ? (
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Regional Prices by Metro</h3>
            <div className="flex items-center bg-slate-700 rounded-lg border border-slate-600 p-1">
              <button
                onClick={() => setChartFuelType('gas_regular')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  chartFuelType === 'gas_regular'
                    ? 'bg-primary-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                ⛽ Regular Gas
              </button>
              <button
                onClick={() => setChartFuelType('diesel')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  chartFuelType === 'diesel'
                    ? 'bg-primary-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🛢️ Diesel
              </button>
            </div>
          </div>
          {metrosLoading ? (
            <div className="text-center py-8 text-slate-400">Loading metro prices...</div>
          ) : (
            <MetroHeatmap
              metros={metros}
              fuelType={chartFuelType === 'gas_regular' ? 'regular' : 'diesel'}
              stateAbbr={abbr}
            />
          )}
        </div>
      ) : null}

      {/* Price Changes — Chart Fuel Type */}
      {/* Price History by Grade — all grades × all time periods */}
      {stateChanges && stateChanges.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">Price History by Grade</h3>
          <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide px-4 py-3">Grade</th>
                  <th className="text-right text-xs font-semibold text-slate-400 uppercase tracking-wide px-4 py-3">Current</th>
                  <th className="text-right text-xs font-semibold text-slate-400 uppercase tracking-wide px-4 py-3">1 Week Ago</th>
                  <th className="text-right text-xs font-semibold text-slate-400 uppercase tracking-wide px-4 py-3">Change</th>
                  <th className="text-right text-xs font-semibold text-slate-400 uppercase tracking-wide px-4 py-3">1 Month Ago</th>
                  <th className="text-right text-xs font-semibold text-slate-400 uppercase tracking-wide px-4 py-3">Change</th>
                  <th className="text-right text-xs font-semibold text-slate-400 uppercase tracking-wide px-4 py-3">3 Months Ago</th>
                  <th className="text-right text-xs font-semibold text-slate-400 uppercase tracking-wide px-4 py-3">Change</th>
                  <th className="text-right text-xs font-semibold text-slate-400 uppercase tracking-wide px-4 py-3">1 Year Ago</th>
                  <th className="text-right text-xs font-semibold text-slate-400 uppercase tracking-wide px-4 py-3">Change</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { key: 'regular', label: 'Regular' },
                  { key: 'mid_grade', label: 'Mid-Grade' },
                  { key: 'premium', label: 'Premium' },
                  { key: 'diesel', label: 'Diesel' },
                ].map(({ key, label }, i) => {
                  const row = stateChanges.find(c => c.grade === key);
                  if (!row) return null;
                  const periods = [
                    { priceKey: 'week_ago_price', pctKey: 'week_change_pct' },
                    { priceKey: 'month_ago_price', pctKey: 'month_change_pct' },
                    { priceKey: 'three_month_ago_price', pctKey: 'three_month_change_pct' },
                    { priceKey: 'year_ago_price', pctKey: 'year_change_pct' },
                  ];
                  return (
                    <tr key={key} className={i < 3 ? 'border-b border-slate-700/50' : ''}>
                      <td className="px-4 py-3 font-medium text-white">{label}</td>
                      <td className="px-4 py-3 text-right font-bold text-white">
                        {row.current_price != null ? `$${Number(row.current_price).toFixed(3)}` : '—'}
                      </td>
                      {periods.map(({ priceKey, pctKey }) => {
                        const price = (row as any)[priceKey];
                        const pct = (row as any)[pctKey] as number | null;
                        return (
                          <Fragment key={priceKey}>
                            <td className="px-4 py-3 text-right text-slate-300">
                              {price != null ? `$${Number(price).toFixed(3)}` : '—'}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {pct != null ? (
                                <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full ${pct >= 0 ? 'bg-red-900/50 text-red-300' : 'bg-green-900/50 text-green-300'}`}>
                                  {pct >= 0 ? '▲' : '▼'} {Math.abs(Number(pct)).toFixed(2)}%
                                </span>
                              ) : '—'}
                            </td>
                          </Fragment>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Historical Chart */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Price History — {chartFuelLabel}</h3>
          <div className="flex items-center bg-slate-700 rounded-lg border border-slate-600 p-1">
            <button
              onClick={() => setChartFuelType('gas_regular')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                chartFuelType === 'gas_regular'
                  ? 'bg-primary-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              ⛽ Regular Gas
            </button>
            <button
              onClick={() => setChartFuelType('diesel')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                chartFuelType === 'diesel'
                  ? 'bg-primary-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🚛 Diesel
            </button>
          </div>
        </div>
        {historyLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-slate-400">Loading chart...</div>
          </div>
        ) : stateHistory && stateHistory.length > 0 ? (
          <>
            <EventAnnotationControls
              events={recentEvents as any[]}
              selectedCategories={selectedEventCategories}
              onCategoryToggle={(cat) =>
                setSelectedEventCategories(prev =>
                  prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
                )
              }
              onReset={() => setSelectedEventCategories([])}
            />
            <PriceChart
              data={stateHistory
                .map((d: any) => {
                  const grade = gradeMap[chartFuelType] as keyof typeof d;
                  return {
                    time: d.time,
                    value: d[grade],
                  };
                })
                .filter((d: any) => d.value != null)}
              events={(selectedEventCategories.length > 0
                ? (recentEvents as any[]).filter(e => selectedEventCategories.includes(e.category))
                : (recentEvents as any[])
              ).map(eventToAnnotationMarker)}
              height={320}
            />
          </>
        ) : (
          <div className="flex justify-center items-center h-64">
            <p className="text-slate-400">
              No historical AAA data available for {stateName}.
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
          ) : allGrades?.[0]?.statePrice ? (
            <div className="text-slate-500 text-sm">Calculating…</div>
          ) : (
            <div className="text-slate-500 text-sm">No state-level price data available</div>
          )}
        </div>

        {/* Price Position */}
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">📊</span>
            <span className="text-sm font-medium text-slate-300">Price Position vs National</span>
          </div>
          <div className="space-y-4">
            {/* vs National bar */}
            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>{stateName} vs National Average (Regular)</span>
                <span className={allGrades?.[0]?.vsDiff != null ? (allGrades[0].vsDiff >= 0 ? 'text-red-400' : 'text-green-400') : ''}>
                  {allGrades?.[0]?.vsDiff != null ? `${allGrades[0].vsDiff >= 0 ? '+' : ''}${allGrades[0].vsDiff.toFixed(1)}%` : '—'}
                </span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2.5 relative">
                {allGrades?.[0]?.vsDiff != null && (
                  <>
                    <div className="absolute top-0 left-1/2 w-0.5 h-2.5 bg-slate-500" />
                    <div
                      className={`absolute top-0 h-2.5 rounded-full ${allGrades[0].vsDiff >= 0 ? 'bg-red-500' : 'bg-green-500'}`}
                      style={{
                        left: allGrades[0].vsDiff >= 0 ? '50%' : `${50 + Math.max(allGrades[0].vsDiff, -20)}%`,
                        width: `${Math.min(Math.abs(allGrades[0].vsDiff), 20)}%`,
                      }}
                    />
                  </>
                )}
              </div>
            </div>
          </div>
          {!allGrades?.[0]?.statePrice && (
            <p className="text-xs text-slate-500 mt-4">
              Awaiting AAA data for {stateName}.
            </p>
          )}
        </div>
      </div>

      {/* No data note */}
      {!allGrades?.[0]?.statePrice && (
        <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-4">
          <p className="text-sm text-amber-300">
            <strong>Note:</strong> The EIA does not publish weekly retail gasoline prices for every state.
            {stateName} is part of the {padd?.name} region. Please check back for regional price data.
          </p>
        </div>
      )}
    </div>
  );
}
