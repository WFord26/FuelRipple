import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAaaNationalHistory, getAaaStateHistory, getAaaPaddHistory } from '../api/client';
import { usePageSEO } from '../hooks/usePageSEO';
import { ChartContainer, PriceLineChart, type PriceChartSeries } from '../components/charts';

type TimeRange = '7D' | '30D' | '90D' | '1Y' | '5Y' | 'ALL';
type FuelGrade = 'regular' | 'mid_grade' | 'premium' | 'diesel';

const TIME_RANGES: { label: string; value: TimeRange; days: number }[] = [
  { label: '7 Days', value: '7D', days: 7 },
  { label: '30 Days', value: '30D', days: 30 },
  { label: '90 Days', value: '90D', days: 90 },
  { label: '1 Year', value: '1Y', days: 365 },
  { label: '5 Years', value: '5Y', days: 1825 },
  { label: 'All Time', value: 'ALL', days: 10000 },
];

// AAA fuel grades with colors and styling
const FUEL_GRADES: { label: string; value: FuelGrade; color: string; activeCls: string; borderCls: string }[] = [
  { label: 'Regular', value: 'regular', color: '#3b82f6', activeCls: 'bg-blue-500 border-blue-500 text-white', borderCls: 'border-l-blue-500' },
  { label: 'Mid Grade', value: 'mid_grade', color: '#8b5cf6', activeCls: 'bg-violet-500 border-violet-500 text-white', borderCls: 'border-l-violet-500' },
  { label: 'Premium', value: 'premium', color: '#ec4899', activeCls: 'bg-pink-500 border-pink-500 text-white', borderCls: 'border-l-pink-500' },
  { label: 'Diesel', value: 'diesel', color: '#10b981', activeCls: 'bg-emerald-500 border-emerald-500 text-white', borderCls: 'border-l-emerald-500' },
];

// PADD region codes for AAA aggregates
const PADD_REGIONS = [
  { label: 'PADD 1 - East Coast', value: 'R10' },
  { label: 'PADD 2 - Midwest', value: 'R20' },
  { label: 'PADD 3 - Gulf Coast', value: 'R30' },
  { label: 'PADD 4 - Rocky Mountain', value: 'R40' },
  { label: 'PADD 5 - West Coast', value: 'R50' },
];

// US state abbreviations for AAA state-level data
const STATE_ABBREVIATIONS: { label: string; value: string }[] = [
  { label: 'Alabama', value: 'AL' }, { label: 'Alaska', value: 'AK' },
  { label: 'Arizona', value: 'AZ' }, { label: 'Arkansas', value: 'AR' },
  { label: 'California', value: 'CA' }, { label: 'Colorado', value: 'CO' },
  { label: 'Connecticut', value: 'CT' }, { label: 'Delaware', value: 'DE' },
  { label: 'Washington DC', value: 'DC' }, { label: 'Florida', value: 'FL' },
  { label: 'Georgia', value: 'GA' }, { label: 'Hawaii', value: 'HI' },
  { label: 'Idaho', value: 'ID' }, { label: 'Illinois', value: 'IL' },
  { label: 'Indiana', value: 'IN' }, { label: 'Iowa', value: 'IA' },
  { label: 'Kansas', value: 'KS' }, { label: 'Kentucky', value: 'KY' },
  { label: 'Louisiana', value: 'LA' }, { label: 'Maine', value: 'ME' },
  { label: 'Maryland', value: 'MD' }, { label: 'Massachusetts', value: 'MA' },
  { label: 'Michigan', value: 'MI' }, { label: 'Minnesota', value: 'MN' },
  { label: 'Mississippi', value: 'MS' }, { label: 'Missouri', value: 'MO' },
  { label: 'Montana', value: 'MT' }, { label: 'Nebraska', value: 'NE' },
  { label: 'Nevada', value: 'NV' }, { label: 'New Hampshire', value: 'NH' },
  { label: 'New Jersey', value: 'NJ' }, { label: 'New Mexico', value: 'NM' },
  { label: 'New York', value: 'NY' }, { label: 'North Carolina', value: 'NC' },
  { label: 'North Dakota', value: 'ND' }, { label: 'Ohio', value: 'OH' },
  { label: 'Oklahoma', value: 'OK' }, { label: 'Oregon', value: 'OR' },
  { label: 'Pennsylvania', value: 'PA' }, { label: 'Rhode Island', value: 'RI' },
  { label: 'South Carolina', value: 'SC' }, { label: 'South Dakota', value: 'SD' },
  { label: 'Tennessee', value: 'TN' }, { label: 'Texas', value: 'TX' },
  { label: 'Utah', value: 'UT' }, { label: 'Vermont', value: 'VT' },
  { label: 'Virginia', value: 'VA' }, { label: 'Washington', value: 'WA' },
  { label: 'West Virginia', value: 'WV' }, { label: 'Wisconsin', value: 'WI' },
  { label: 'Wyoming', value: 'WY' },
];

type RegionScope = 'national' | 'padd' | 'state';

// Compute simple moving average
const computeMA = (values: number[], window: number): number[] => {
  const ma: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = values.slice(start, i + 1);
    ma.push(slice.reduce((a, b) => a + b, 0) / slice.length);
  }
  return ma;
};

// Calculate price statistics with period-over-period changes
const calculateStats = (data: Array<{ time: string; value: number }>) => {
  if (data.length === 0) return null;
  const values = data.map(d => d.value);
  const current = values[values.length - 1];
  const prev = values[0];
  
  // Period-over-period changes
  const change7d = values.length >= 7 ? ((current - values[Math.max(0, values.length - 7)]) / values[Math.max(0, values.length - 7)]) * 100 : 0;
  const change30d = values.length >= 30 ? ((current - values[Math.max(0, values.length - 30)]) / values[Math.max(0, values.length - 30)]) * 100 : 0;
  
  return {
    current,
    min: Math.min(...values),
    max: Math.max(...values),
    avg: values.reduce((s, v) => s + v, 0) / values.length,
    change: values.length > 1 ? ((current - prev) / prev) * 100 : 0,
    change7d,
    change30d,
  };
};

export default function Historical() {
  usePageSEO({
    title: 'Historical Fuel Prices by Grade',
    description: 'Daily AAA and Yahoo Finance fuel prices: regular, mid-grade, premium, diesel, WTI and Brent crude at national, PADD regional, and state levels.',
    canonicalPath: '/historical',
  });

  const [timeRange, setTimeRange] = useState<TimeRange>('1Y');
  const [activeFuels, setActiveFuels] = useState<Set<FuelGrade>>(
    new Set(['regular', 'diesel'])
  );
  const [showCrude, setShowCrude] = useState(false);
  const [regionScope, setRegionScope] = useState<RegionScope>('national');
  const [selectedPadd, setSelectedPadd] = useState('R10');
  const [selectedState, setSelectedState] = useState('CA');
  const [showMovingAverage, setShowMovingAverage] = useState(false);
  const [showEvents, setShowEvents] = useState(false);

  const selectedRange = TIME_RANGES.find(r => r.value === timeRange);
  const limit = Math.ceil((selectedRange?.days || 365) * 1.5); // AAA API limit

  // Fetch AAA data based on region scope
  const aaaQuery = useQuery({
    queryKey: ['aaa', regionScope, selectedPadd, selectedState, timeRange],
    queryFn: async () => {
      let data;
      if (regionScope === 'national') {
        data = await getAaaNationalHistory(limit);
      } else if (regionScope === 'padd') {
        data = await getAaaPaddHistory(selectedPadd, limit);
      } else {
        data = await getAaaStateHistory(selectedState, limit);
      }
      return data.reverse(); // Oldest first for charting
    },
  });

  // Prepare chart data with optional moving averages
  const chartData = useMemo(() => {
    if (!aaaQuery.data) return [];
    
    const base = aaaQuery.data.map((point: any) => {
      const date = new Date(point.time);
      return {
        time: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }),
        timeRaw: point.time,
        regular: point.regular,
        mid_grade: point.mid_grade,
        premium: point.premium,
        diesel: point.diesel,
      };
    });

    if (!showMovingAverage) return base;

    // Add 7-day moving averages
    const ma7Window = 7;
    const regularVals = base.map((d: any) => d.regular).filter((v: any): v is number => v !== null);
    const dieselVals = base.map((d: any) => d.diesel).filter((v: any): v is number => v !== null);
    
    const regularMA = computeMA(regularVals, ma7Window);
    const dieselMA = computeMA(dieselVals, ma7Window);

    return base.map((d: any, i: number) => ({
      ...d,
      regularMA: regularMA[i],
      dieselMA: dieselMA[i],
    }));
  }, [aaaQuery.data, showMovingAverage]);

  // Statistics for visible fuel grades
  const stats = useMemo(() => {
    if (!aaaQuery.data) return {};
    
    const result: Record<FuelGrade, ReturnType<typeof calculateStats>> = {
      regular: null,
      mid_grade: null,
      premium: null,
      diesel: null,
    };

    activeFuels.forEach((fuel: FuelGrade) => {
      const values = aaaQuery.data
        .map((d: any) => ({ time: d.time, value: d[fuel] }))
        .filter((d: any): d is { time: string; value: number } => d.value != null && typeof d.value === 'number');
      
      result[fuel] = calculateStats(values);
    });

    return result;
  }, [aaaQuery.data, activeFuels]);

  const toggleFuel = (fuel: FuelGrade) => {
    setActiveFuels(prev => {
      const next = new Set(prev);
      if (next.has(fuel)) {
        if (next.size > 1) next.delete(fuel);
      } else {
        next.add(fuel);
      }
      return next;
    });
  };

  const isLoading = aaaQuery.isLoading;
  const regionLabel =
    regionScope === 'national' ? 'National (US)' :
    regionScope === 'padd' ? (PADD_REGIONS.find(p => p.value === selectedPadd)?.label ?? selectedPadd) :
    (STATE_ABBREVIATIONS.find(s => s.value === selectedState)?.label ?? selectedState);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-white mb-2">Historical Fuel Prices</h2>
        <p className="text-slate-400">
          Daily AAA averages for all 4 fuel grades by region, plus Yahoo Finance crude oil comparison
        </p>
      </div>

      {/* Controls Card */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 space-y-5">
        
        {/* Fuel Grade Toggles */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-3">Fuel Grades (AAA Data)</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {FUEL_GRADES.map((fuel) => {
              const active = activeFuels.has(fuel.value);
              return (
                <button
                  key={fuel.value}
                  onClick={() => toggleFuel(fuel.value)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors border-2 ${
                    active
                      ? fuel.activeCls
                      : 'bg-slate-700 text-slate-400 border-slate-600 hover:bg-slate-600'
                  }`}
                >
                  {fuel.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Crude Oil Toggle (National Only) */}
        {regionScope === 'national' && (
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="showCrude"
              checked={showCrude}
              onChange={(e) => setShowCrude(e.target.checked)}
              className="w-4 h-4 rounded border-slate-600 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="showCrude" className="text-sm text-slate-300">
              Overlay WTI/Brent Crude (Yahoo Finance)
            </label>
          </div>
        )}

        {/* Region Selection */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-3">Region</label>
          <div className="flex flex-wrap gap-2 mb-3">
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
                {scope === 'national' ? 'National' : scope === 'padd' ? 'PADD Region' : 'State'}
              </button>
            ))}
          </div>

          {/* PADD Selector */}
          {regionScope === 'padd' && (
            <select
              aria-label="Select PADD region"
              value={selectedPadd}
              onChange={e => setSelectedPadd(e.target.value)}
              className="w-full sm:w-72 bg-slate-700 border border-slate-600 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {PADD_REGIONS.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          )}

          {/* State Selector */}
          {regionScope === 'state' && (
            <select
              aria-label="Select state"
              value={selectedState}
              onChange={e => setSelectedState(e.target.value)}
              className="w-full sm:w-72 bg-slate-700 border border-slate-600 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {STATE_ABBREVIATIONS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          )}
        </div>

        {/* Time Range */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-3">Time Range</label>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {TIME_RANGES.map((range) => (
              <button
                key={range.value}
                onClick={() => setTimeRange(range.value)}
                className={`px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
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

        {/* Analysis Options */}
        <div className="flex flex-wrap gap-4 pt-2 border-t border-slate-700">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showMovingAverage}
              onChange={(e) => setShowMovingAverage(e.target.checked)}
              className="w-4 h-4 rounded border-slate-600 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-slate-300">7-day Moving Average</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showEvents}
              onChange={(e) => setShowEvents(e.target.checked)}
              className="w-4 h-4 rounded border-slate-600 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-slate-300">Show Events</span>
          </label>
        </div>
      </div>

      {/* Main Chart */}
      {useMemo(() => {
        // Build series dynamically based on active fuels
        const baseSeries: PriceChartSeries[] = [
          { key: 'regular', name: 'Regular', color: '#3b82f6', dataKey: 'regular' },
          { key: 'mid_grade', name: 'Mid Grade', color: '#8b5cf6', dataKey: 'mid_grade' },
          { key: 'premium', name: 'Premium', color: '#ec4899', dataKey: 'premium' },
          { key: 'diesel', name: 'Diesel', color: '#10b981', dataKey: 'diesel' },
        ].filter(s => activeFuels.has(s.key as FuelGrade));

        // Add moving averages if enabled
        if (showMovingAverage) {
          if (activeFuels.has('regular')) {
            baseSeries.push({
              key: 'regularMA',
              name: 'Regular 7MA',
              color: '#3b82f6',
              dataKey: 'regularMA',
              strokeWidth: 2,
            });
          }
          if (activeFuels.has('diesel')) {
            baseSeries.push({
              key: 'dieselMA',
              name: 'Diesel 7MA',
              color: '#10b981',
              dataKey: 'dieselMA',
              strokeWidth: 2,
            });
          }
        }

        return (
          <ChartContainer
            title="Price History"
            subtitle={regionLabel}
            height={450}
            isLoading={isLoading}
            isEmpty={chartData.length === 0}
            emptyMessage="No data available for this region and time range"
            actions={
              <div className="text-xs text-slate-500 bg-slate-700 px-3 py-1 rounded">
                {chartData.length} days
              </div>
            }
          >
            <PriceLineChart
              data={chartData}
              series={baseSeries}
              height={450}
              yAxisLabel="Price ($/gal)"
              tooltip={{
                formatter: (value) => `$${(value as number).toFixed(3)}`,
                labelFormatter: (label) => label,
              }}
            />
          </ChartContainer>
        );
      }, [activeFuels, showMovingAverage, chartData, isLoading, regionLabel])}
      

      {/* Statistics Grid */}
      {activeFuels.size > 0 && Object.values(stats).some(s => s !== null) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FUEL_GRADES
            .filter(f => activeFuels.has(f.value) && (stats as any)[f.value])
            .map((fuel: typeof FUEL_GRADES[0]) => {
              const s = (stats as Record<FuelGrade, any>)[fuel.value];
              if (!s) return null;
              return (
                <div key={fuel.value} className={`bg-slate-800 rounded-lg p-4 border border-slate-700 border-l-4 ${fuel.borderCls}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="text-sm font-semibold text-white">{fuel.label}</h4>
                      <p className="text-2xl font-bold text-white mt-1">${s.current.toFixed(2)}</p>
                    </div>
                    <div className={`text-xs font-semibold px-2 py-1 rounded ${
                      s.change >= 0 ? 'bg-red-500/20 text-red-300' : 'bg-green-500/20 text-green-300'
                    }`}>
                      {s.change >= 0 ? '+' : ''}{s.change.toFixed(1)}%
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-slate-500">7-day</div>
                      <div className={`font-semibold ${s.change7d >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {s.change7d >= 0 ? '+' : ''}{s.change7d.toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">30-day</div>
                      <div className={`font-semibold ${s.change30d >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {s.change30d >= 0 ? '+' : ''}{s.change30d.toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">Min</div>
                      <div className="text-slate-300">${s.min.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Max</div>
                      <div className="text-slate-300">${s.max.toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* Data Source Info */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 text-xs text-slate-400">
        <p className="mb-2">
          <strong>Data Sources:</strong>
        </p>
        <ul className="space-y-1 ml-4 list-disc">
          <li>Regular, Mid-Grade, Premium, Diesel: AAA National Average prices (daily updates)</li>
          <li>WTI & Brent Crude: Yahoo Finance market data (15-min delayed)</li>
          <li>Regional aggregates (PADD): Computed from state AAA averages</li>
        </ul>
      </div>
    </div>
  );
}