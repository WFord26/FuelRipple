import { useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { PriceChart, ChartSeries } from '../components/PriceChart';
import { getHistoricalPrices, getEvents } from '../api/client';
import { usePageSEO } from '../hooks/usePageSEO';

type TimeRange = '30D' | '90D' | '1Y' | '5Y' | 'ALL';
type Metric = 'gas_regular' | 'crude_wti' | 'crude_brent' | 'diesel';

const TIME_RANGES: { label: string; value: TimeRange; days: number }[] = [
  { label: '30 Days', value: '30D', days: 30 },
  { label: '90 Days', value: '90D', days: 90 },
  { label: '1 Year', value: '1Y', days: 365 },
  { label: '5 Years', value: '5Y', days: 1825 },
  { label: 'All Time', value: 'ALL', days: 10000 },
];

const METRICS: { label: string; value: Metric; color: string; activeCls: string; borderCls: string }[] = [
  { label: 'Regular Gas', value: 'gas_regular', color: '#3b82f6', activeCls: 'bg-blue-500 border-blue-500 text-white', borderCls: 'border-l-blue-500' },
  { label: 'WTI Crude', value: 'crude_wti', color: '#f59e0b', activeCls: 'bg-amber-400 border-amber-400 text-white', borderCls: 'border-l-amber-400' },
  { label: 'Brent Crude', value: 'crude_brent', color: '#ef4444', activeCls: 'bg-red-500 border-red-500 text-white', borderCls: 'border-l-red-500' },
  { label: 'Diesel', value: 'diesel', color: '#10b981', activeCls: 'bg-emerald-500 border-emerald-500 text-white', borderCls: 'border-l-emerald-500' },
];

// Crude oil is only available at the national (US) level
const CRUDE_METRICS: Metric[] = ['crude_wti', 'crude_brent'];

// PADD region codes stored in the DB (EIA R-codes)
const PADD_REGIONS = [
  { label: 'PADD 1 - East Coast', value: 'R10' },
  { label: 'PADD 2 - Midwest', value: 'R20' },
  { label: 'PADD 3 - Gulf Coast', value: 'R30' },
  { label: 'PADD 4 - Rocky Mountain', value: 'R40' },
  { label: 'PADD 5 - West Coast/AK/HI', value: 'R50' },
];

// EIA duoarea state codes (S + 2-letter abbr)
const STATE_OPTIONS: { label: string; value: string }[] = [
  { label: 'Alabama', value: 'SAL' }, { label: 'Alaska', value: 'SAK' },
  { label: 'Arizona', value: 'SAZ' }, { label: 'Arkansas', value: 'SAR' },
  { label: 'California', value: 'SCA' }, { label: 'Colorado', value: 'SCO' },
  { label: 'Connecticut', value: 'SCT' }, { label: 'Delaware', value: 'SDE' },
  { label: 'Washington DC', value: 'SDC' }, { label: 'Florida', value: 'SFL' },
  { label: 'Georgia', value: 'SGA' }, { label: 'Hawaii', value: 'SHI' },
  { label: 'Idaho', value: 'SID' }, { label: 'Illinois', value: 'SIL' },
  { label: 'Indiana', value: 'SIN' }, { label: 'Iowa', value: 'SIA' },
  { label: 'Kansas', value: 'SKS' }, { label: 'Kentucky', value: 'SKY' },
  { label: 'Louisiana', value: 'SLA' }, { label: 'Maine', value: 'SME' },
  { label: 'Maryland', value: 'SMD' }, { label: 'Massachusetts', value: 'SMA' },
  { label: 'Michigan', value: 'SMI' }, { label: 'Minnesota', value: 'SMN' },
  { label: 'Mississippi', value: 'SMS' }, { label: 'Missouri', value: 'SMO' },
  { label: 'Montana', value: 'SMT' }, { label: 'Nebraska', value: 'SNE' },
  { label: 'Nevada', value: 'SNV' }, { label: 'New Hampshire', value: 'SNH' },
  { label: 'New Jersey', value: 'SNJ' }, { label: 'New Mexico', value: 'SNM' },
  { label: 'New York', value: 'SNY' }, { label: 'North Carolina', value: 'SNC' },
  { label: 'North Dakota', value: 'SND' }, { label: 'Ohio', value: 'SOH' },
  { label: 'Oklahoma', value: 'SOK' }, { label: 'Oregon', value: 'SOR' },
  { label: 'Pennsylvania', value: 'SPA' }, { label: 'Rhode Island', value: 'SRI' },
  { label: 'South Carolina', value: 'SSC' }, { label: 'South Dakota', value: 'SSD' },
  { label: 'Tennessee', value: 'STN' }, { label: 'Texas', value: 'STX' },
  { label: 'Utah', value: 'SUT' }, { label: 'Vermont', value: 'SVT' },
  { label: 'Virginia', value: 'SVA' }, { label: 'Washington', value: 'SWA' },
  { label: 'West Virginia', value: 'SWV' }, { label: 'Wisconsin', value: 'SWI' },
  { label: 'Wyoming', value: 'SWY' },
];

type RegionScope = 'national' | 'padd' | 'state';

export default function Historical() {
  usePageSEO({
    title: 'Historical Gas Price Charts',
    description: '30+ years of US gasoline price history by PADD region and state. Compare regular gas, WTI, Brent crude, and diesel trends with geopolitical event overlays.',
    canonicalPath: '/historical',
  });

  const [timeRange, setTimeRange] = useState<TimeRange>('1Y');
  const [activeMetrics, setActiveMetrics] = useState<Set<Metric>>(
    new Set(METRICS.map(m => m.value))
  );
  const [regionScope, setRegionScope] = useState<RegionScope>('national');
  const [selectedPadd, setSelectedPadd] = useState('R10');
  const [selectedState, setSelectedState] = useState('SCA');
  const [showEvents, setShowEvents] = useState(true);

  const selectedRange = TIME_RANGES.find(r => r.value === timeRange);
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (selectedRange?.days || 365));

  const granularity =
    (timeRange === '30D' || timeRange === '90D') ? 'daily' :
    (timeRange === '5Y' || timeRange === 'ALL') ? 'monthly' :
    'weekly';

  // National region codes differ by metric:
  //   gas_regular → 'NUS'  (EIA national duoarea code)
  //   diesel, crude_wti, crude_brent → 'US'
  const NATIONAL_REGION: Record<Metric, string> = {
    gas_regular: 'NUS',
    diesel:      'US',
    crude_wti:   'US',
    crude_brent: 'US',
  };

  // Resolve the region code for a given metric given current scope selection
  const getRegion = (metric: Metric): string => {
    if (CRUDE_METRICS.includes(metric)) return 'US';
    if (regionScope === 'national') return NATIONAL_REGION[metric] ?? 'US';
    if (regionScope === 'padd') return selectedPadd;
    return selectedState;
  };

  const toggleMetric = (metric: Metric) => {
    setActiveMetrics(prev => {
      const next = new Set(prev);
      if (next.has(metric)) {
        if (next.size > 1) next.delete(metric);
      } else {
        next.add(metric);
      }
      return next;
    });
  };

  // Fetch all 4 metrics in parallel with explicit region on every request
  const metricQueries = useQueries({
    queries: METRICS.map(m => {
      const region = getRegion(m.value);
      return {
        queryKey: ['priceHistory', m.value, region, timeRange],
        queryFn: async () => {
          const data = await getHistoricalPrices({
            metric: m.value,
            region,
            start: startDate.toISOString(),
            end: endDate.toISOString(),
            granularity,
          });
          return { metric: m.value, data };
        },
      };
    }),
  });

  // Fetch geopolitical events
  const { data: events } = useQuery({
    queryKey: ['events', timeRange],
    queryFn: async () => {
      const data = await getEvents({
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      });
      return data;
    },
    enabled: showEvents,
  });

  const isLoading = metricQueries.some(q => q.isLoading);

  // Build chart series sorted ascending by time
  const chartSeries: ChartSeries[] = METRICS.filter(m => activeMetrics.has(m.value)).flatMap(m => {
    const q = metricQueries.find(q => q.data?.metric === m.value);
    const raw = q?.data?.data ?? [];
    if (!raw.length) return [];
    return [{
      id: m.value,
      name: m.label,
      color: m.color,
      data: raw
        .map((p: any) => ({ time: p.time.split('T')[0], value: p.value }))
        .sort((a: any, b: any) => a.time.localeCompare(b.time)),
    }];
  });

  // Per-metric stat cards
  const metricStats = METRICS.filter(m => activeMetrics.has(m.value)).map(m => {
    const q = metricQueries.find(q => q.data?.metric === m.value);
    const raw: { time: string; value: number }[] = (q?.data?.data ?? [])
      .map((p: any) => ({ time: p.time.split('T')[0], value: p.value }))
      .sort((a: any, b: any) => a.time.localeCompare(b.time));
    if (!raw.length) return null;
    const values = raw.map(d => d.value);
    const current = values[values.length - 1];
    const change = values.length > 1
      ? ((current - values[0]) / values[0]) * 100
      : 0;
    return {
      ...m,
      current,
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((s, v) => s + v, 0) / values.length,
      change,
    };
  }).filter(Boolean) as (typeof METRICS[0] & { current: number; min: number; max: number; avg: number; change: number })[];

  const eventMarkers = showEvents && events?.map((e: any) => ({
    time: (e.event_date ?? e.date ?? '').split('T')[0],
    position: e.impact === 'bullish' ? 'aboveBar' : 'belowBar' as const,
    color: e.impact === 'bullish' ? '#ef4444' : '#10b981',
    shape: e.impact === 'bullish' ? 'arrowUp' : 'arrowDown' as const,
    text: e.title?.substring(0, 1) ?? '',
  })) || [];

  const regionLabel =
    regionScope === 'national' ? 'National (US)' :
    regionScope === 'padd' ? (PADD_REGIONS.find(p => p.value === selectedPadd)?.label ?? selectedPadd) :
    (STATE_OPTIONS.find(s => s.value === selectedState)?.label ?? selectedState);

  const showCrudeNote = regionScope !== 'national' &&
    (activeMetrics.has('crude_wti') || activeMetrics.has('crude_brent'));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-white mb-2">Historical Trends</h2>
        <p className="text-slate-400">
          Daily-averaged price history by region — national, PADD, or state level
        </p>
      </div>

      {/* Controls */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 space-y-5">

        {/* Metric Toggles */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Metrics</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {METRICS.map((metric) => {
              const active = activeMetrics.has(metric.value);
              return (
                <button
                  key={metric.value}
                  onClick={() => toggleMetric(metric.value)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors border-2 ${
                    active
                      ? metric.activeCls
                      : 'bg-slate-700 text-slate-400 border-slate-600 hover:bg-slate-600'
                  }`}
                >
                  {metric.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Region Scope */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Region</label>
          <div className="flex flex-wrap gap-2">
            {(['national', 'padd', 'state'] as RegionScope[]).map(scope => (
              <button
                key={scope}
                onClick={() => setRegionScope(scope)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  regionScope === scope
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {scope === 'national' ? 'National (US)' : scope === 'padd' ? 'PADD Region' : 'State'}
              </button>
            ))}
          </div>

          {/* PADD picker */}
          {regionScope === 'padd' && (
            <select
              aria-label="Select PADD region"
              value={selectedPadd}
              onChange={e => setSelectedPadd(e.target.value)}
              className="mt-3 w-full sm:w-auto bg-slate-700 border border-slate-600 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {PADD_REGIONS.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          )}

          {/* State picker */}
          {regionScope === 'state' && (
            <select
              aria-label="Select state"
              value={selectedState}
              onChange={e => setSelectedState(e.target.value)}
              className="mt-3 w-full sm:w-72 bg-slate-700 border border-slate-600 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {STATE_OPTIONS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          )}

          {/* Crude-national notice */}
          {showCrudeNote && (
            <p className="mt-2 text-xs text-amber-400">
              WTI and Brent Crude prices are only available at the national level and are always shown as US averages.
            </p>
          )}
        </div>

        {/* Time Range */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Time Range</label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {TIME_RANGES.map((range) => (
              <button
                key={range.value}
                onClick={() => setTimeRange(range.value)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  timeRange === range.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>

        {/* Event Toggle */}
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="showEvents"
            checked={showEvents}
            onChange={(e) => setShowEvents(e.target.checked)}
            className="w-4 h-4 rounded border-slate-600 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="showEvents" className="text-sm text-slate-300">
            Show geopolitical event markers
          </label>
        </div>
      </div>

      {/* Combined Chart */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-semibold text-white">Combined Price History</h3>
          <span className="text-xs text-slate-400 bg-slate-700 px-2 py-1 rounded">
            {regionLabel} &middot; {granularity} avg
          </span>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Values are {granularity} averages of all readings within each {granularity === 'daily' ? 'day' : '7-day window'}.
        </p>
        {isLoading ? (
          <div className="flex items-center justify-center h-96">
            <div className="text-slate-400">Loading chart data...</div>
          </div>
        ) : chartSeries.length > 0 ? (
          <PriceChart
            series={chartSeries}
            height={520}
            events={eventMarkers}
          />
        ) : (
          <div className="flex items-center justify-center h-96">
            <div className="text-slate-400">No data available for the selected range and region</div>
          </div>
        )}
      </div>

      {/* Per-Metric Statistics */}
      {metricStats.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {metricStats.map(stat => (
            <div
              key={stat.value}
              className={`bg-slate-800 rounded-lg p-4 border border-slate-700 border-l-4 ${stat.borderCls}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-white">{stat.label}</span>
                <span className={`text-sm font-bold ${stat.change >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {stat.change >= 0 ? '+' : ''}{stat.change.toFixed(2)}%
                </span>
              </div>
              {CRUDE_METRICS.includes(stat.value as Metric) && regionScope !== 'national' && (
                <p className="text-xs text-amber-400 mb-2">US national only</p>
              )}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-slate-400">Current</div>
                  <div className="text-white font-semibold">${stat.current.toFixed(3)}</div>
                </div>
                <div>
                  <div className="text-slate-400">Average</div>
                  <div className="text-white font-semibold">${stat.avg.toFixed(3)}</div>
                </div>
                <div>
                  <div className="text-slate-400">Min</div>
                  <div className="text-green-400 font-semibold">${stat.min.toFixed(3)}</div>
                </div>
                <div>
                  <div className="text-slate-400">Max</div>
                  <div className="text-red-400 font-semibold">${stat.max.toFixed(3)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Events List */}
      {showEvents && events && events.length > 0 && (
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4">Geopolitical Events</h3>
          <div className="space-y-3">
            {events.slice(0, 10).map((event: any, index: number) => (
              <div key={index} className="flex items-start space-x-3 p-3 bg-slate-700/50 rounded-lg">
                <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${event.impact >= 0 ? 'bg-red-400' : 'bg-green-400'}`} />
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium text-white">{event.title}</div>
                    <div className="text-sm text-slate-400 whitespace-nowrap">{new Date(event.date).toLocaleDateString()}</div>
                  </div>
                  <div className="text-sm text-slate-300 mt-1">{event.description}</div>
                  <div className="flex items-center space-x-4 mt-2 text-xs">
                    <span className="text-slate-400">Impact: <span className={event.impact >= 0 ? 'text-red-400' : 'text-green-400'}>{event.impact >= 0 ? '+' : ''}{event.impact}%</span></span>
                    <span className="text-slate-500">{event.category}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}