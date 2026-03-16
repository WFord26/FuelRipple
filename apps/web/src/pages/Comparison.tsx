import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getRegionalComparison } from '../api/client';
import { usePageSEO } from '../hooks/usePageSEO';
import { Chart, Settings, BarSeries, Axis, DARK_THEME, ScaleType, Position, Tooltip } from '@elastic/charts';
import '@elastic/charts/dist/theme_dark.css';
import USPriceMap from '../components/USPriceMap';

const barTheme = {
  ...DARK_THEME,
  background: { color: '#1e293b' },
  axes: {
    ...DARK_THEME.axes,
    gridLine: {
      horizontal: { stroke: '#334155', strokeWidth: 1, dash: [3, 3] },
      vertical: { visible: false },
    },
  },
};

interface StateEntry {
  abbr: string;
  name: string;
}

const PADD_REGIONS: { code: string; name: string; color: string; allStates: StateEntry[] }[] = [
  {
    code: 'R10', name: 'East Coast', color: '#3b82f6',
    allStates: [
      { abbr: 'CT', name: 'Connecticut' }, { abbr: 'DC', name: 'Washington DC' },
      { abbr: 'DE', name: 'Delaware' },    { abbr: 'FL', name: 'Florida' },
      { abbr: 'GA', name: 'Georgia' },     { abbr: 'MA', name: 'Massachusetts' },
      { abbr: 'MD', name: 'Maryland' },    { abbr: 'ME', name: 'Maine' },
      { abbr: 'NC', name: 'North Carolina' }, { abbr: 'NH', name: 'New Hampshire' },
      { abbr: 'NJ', name: 'New Jersey' },  { abbr: 'NY', name: 'New York' },
      { abbr: 'PA', name: 'Pennsylvania' },{ abbr: 'RI', name: 'Rhode Island' },
      { abbr: 'SC', name: 'South Carolina' }, { abbr: 'VA', name: 'Virginia' },
      { abbr: 'VT', name: 'Vermont' },     { abbr: 'WV', name: 'West Virginia' },
    ],
  },
  {
    code: 'R20', name: 'Midwest', color: '#10b981',
    allStates: [
      { abbr: 'IA', name: 'Iowa' },        { abbr: 'IL', name: 'Illinois' },
      { abbr: 'IN', name: 'Indiana' },     { abbr: 'KS', name: 'Kansas' },
      { abbr: 'KY', name: 'Kentucky' },    { abbr: 'MI', name: 'Michigan' },
      { abbr: 'MN', name: 'Minnesota' },   { abbr: 'MO', name: 'Missouri' },
      { abbr: 'ND', name: 'North Dakota' },{ abbr: 'NE', name: 'Nebraska' },
      { abbr: 'OH', name: 'Ohio' },        { abbr: 'OK', name: 'Oklahoma' },
      { abbr: 'SD', name: 'South Dakota' },{ abbr: 'TN', name: 'Tennessee' },
      { abbr: 'WI', name: 'Wisconsin' },
    ],
  },
  {
    code: 'R30', name: 'Gulf Coast', color: '#f59e0b',
    allStates: [
      { abbr: 'AL', name: 'Alabama' },   { abbr: 'AR', name: 'Arkansas' },
      { abbr: 'LA', name: 'Louisiana' }, { abbr: 'MS', name: 'Mississippi' },
      { abbr: 'NM', name: 'New Mexico' },{ abbr: 'TX', name: 'Texas' },
    ],
  },
  {
    code: 'R40', name: 'Rocky Mountain', color: '#8b5cf6',
    allStates: [
      { abbr: 'CO', name: 'Colorado' }, { abbr: 'ID', name: 'Idaho' },
      { abbr: 'MT', name: 'Montana' },  { abbr: 'UT', name: 'Utah' },
      { abbr: 'WY', name: 'Wyoming' },
    ],
  },
  {
    code: 'R50', name: 'West Coast', color: '#ef4444',
    allStates: [
      { abbr: 'AK', name: 'Alaska' },    { abbr: 'AZ', name: 'Arizona' },
      { abbr: 'CA', name: 'California' },{ abbr: 'HI', name: 'Hawaii' },
      { abbr: 'NV', name: 'Nevada' },    { abbr: 'OR', name: 'Oregon' },
      { abbr: 'WA', name: 'Washington' },
    ],
  },
];

export default function Comparison() {
  usePageSEO({
    title: 'Regional Gas Price Comparison',
    description: 'Compare gasoline prices across all 5 PADD regions and 50 states. See which regions pay the most and least, and explore state-level breakdowns updated weekly by EIA.',
    canonicalPath: '/comparison',
  });

  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  const { data: comparisonData, isLoading } = useQuery({
    queryKey: ['priceComparison'],
    queryFn: () => getRegionalComparison('gas_regular'),
  });

  const toggleRegion = (code: string) => {
    setExpandedRegions(prev => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  };

  // Transform PADD data for chart
  const chartData = PADD_REGIONS.map(region => {
    const regionData = comparisonData?.find((d: any) => d.region === region.code);
    return {
      name: region.name,
      price: regionData?.value || 0,
      code: region.code,
      color: region.color,
    };
  }).filter(d => d.price > 0);

  const nationalAvg = chartData.length > 0
    ? chartData.reduce((sum, d) => sum + d.price, 0) / chartData.length
    : 0;
  const minPrice = chartData.length > 0 ? Math.min(...chartData.map(d => d.price)) : 0;
  const maxPrice = chartData.length > 0 ? Math.max(...chartData.map(d => d.price)) : 0;
  const priceSpread = maxPrice - minPrice;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-white mb-2">Regional Comparison</h2>
        <p className="text-slate-400">Compare gasoline prices across US PADD regions — click a region to see state breakdown</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="text-sm text-slate-400">National Average</div>
          <div className="text-3xl font-bold text-white mt-1">${nationalAvg.toFixed(3)}</div>
          <div className="text-sm text-slate-500 mt-1">per gallon</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="text-sm text-slate-400">Price Range</div>
          <div className="text-3xl font-bold text-white mt-1">${priceSpread.toFixed(3)}</div>
          <div className="text-sm text-slate-500 mt-1">${minPrice.toFixed(3)} – ${maxPrice.toFixed(3)}</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="text-sm text-slate-400">Price Variance</div>
          <div className="text-3xl font-bold text-white mt-1">
            {nationalAvg > 0 ? ((priceSpread / nationalAvg) * 100).toFixed(1) : '—'}%
          </div>
          <div className="text-sm text-slate-500 mt-1">regional spread</div>
        </div>
      </div>

      {/* US Choropleth Map */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-2">Price Map by State</h3>
        <p className="text-xs text-slate-500 mb-4">Colored by regular gas price · PADD region borders shown · hover for details · click a state for detail</p>
        <USPriceMap comparisonData={comparisonData ?? []} height={400} onStateClick={(abbr) => navigate(`/state/${abbr}`)} />
      </div>

      {/* Chart */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4">Regional Price Comparison</h3>
        {isLoading ? (
          <div className="flex items-center justify-center h-96">
            <div className="text-slate-400">Loading comparison data...</div>
          </div>
        ) : chartData.length > 0 ? (
          <Chart size={{ height: 340 }}>
            <Settings theme={barTheme} showLegend={false} />
            <Tooltip
              headerFormatter={({ value }) => `${value}`}
            />
            <Axis
              id="x-axis"
              position={Position.Bottom}
              style={{ tickLabel: { fill: '#94a3b8', fontSize: 12 }, axisLine: { stroke: '#475569' }, tickLine: { stroke: '#475569' } }}
            />
            <Axis
              id="y-axis"
              position={Position.Left}
              tickFormat={(d) => `$${Number(d).toFixed(2)}`}
              style={{ tickLabel: { fill: '#94a3b8', fontSize: 11 }, axisLine: { stroke: '#475569' }, tickLine: { stroke: '#475569' } }}
            />
            {chartData.map(entry => (
              <BarSeries
                key={entry.code}
                id={entry.code}
                name={entry.name}
                data={[{ x: entry.name, y: entry.price }]}
                xAccessor="x"
                yAccessors={['y']}
                xScaleType={ScaleType.Ordinal}
                yScaleType={ScaleType.Linear}
                color={entry.color}
              />
            ))}
          </Chart>
        ) : (
          <div className="flex items-center justify-center h-96">
            <div className="text-slate-400">No comparison data available</div>
          </div>
        )}
      </div>

      {/* PADD Region Cards with state breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {PADD_REGIONS.map(region => {
          const regionData = comparisonData?.find((d: any) => d.region === region.code);
          const price = regionData?.value ?? 0;
          const vsNational = price > 0 && nationalAvg > 0 ? ((price - nationalAvg) / nationalAvg) * 100 : 0;
          const isExpanded = expandedRegions.has(region.code);
          // State rows from API (only states EIA reports on)
          const apiStates: any[] = regionData?.states ?? [];

          return (
            <div key={region.code} className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
              {/* Card header — click to expand */}
              <button
                onClick={() => toggleRegion(region.code)}
                className="w-full p-4 text-left hover:bg-slate-700/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: region.color }} />
                    <div className="font-semibold text-white">{region.name}</div>
                  </div>
                  <svg
                    className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {price > 0 ? (
                  <>
                    <div className="text-3xl font-bold text-white my-2">${price.toFixed(3)}</div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm font-medium ${vsNational >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {vsNational >= 0 ? '+' : ''}{vsNational.toFixed(2)}% vs national avg
                      </span>
                      {price === minPrice && (
                        <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">Lowest</span>
                      )}
                      {price === maxPrice && (
                        <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full">Highest</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-2">
                      {region.allStates.map(s => s.abbr).join(', ')}
                    </div>
                  </>
                ) : (
                  <div className="text-slate-500 text-sm mt-2">No data available</div>
                )}
              </button>

              {/* State breakdown — shown when expanded */}
              {isExpanded && (
                <div className="border-t border-slate-700 px-4 pb-4 pt-3">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    State Prices
                    {apiStates.length < region.allStates.length && (
                      <span className="ml-2 font-normal normal-case text-slate-500">
                        ({apiStates.length} of {region.allStates.length} states reported by EIA)
                      </span>
                    )}
                  </div>

                  {apiStates.length > 0 ? (
                    <div className="space-y-1">
                      {/* States with direct EIA data, sorted high → low */}
                      {apiStates.map((s: any) => {
                        const vs = nationalAvg > 0 ? ((s.value - nationalAvg) / nationalAvg) * 100 : 0;
                        return (
                          <div key={s.abbr} className="flex items-center justify-between py-1 border-b border-slate-700/50 last:border-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs font-mono bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded w-8 text-center flex-shrink-0">
                                {s.abbr}
                              </span>
                              <span className="text-sm text-slate-300 truncate">{s.name}</span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                              <span className="text-sm font-semibold text-white">${s.value.toFixed(3)}</span>
                              <span className={`text-xs ${vs >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                                {vs >= 0 ? '+' : ''}{vs.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        );
                      })}

                      {/* States without direct EIA data */}
                      {region.allStates
                        .filter(s => !apiStates.find((a: any) => a.abbr === s.abbr))
                        .map(s => (
                          <div key={s.abbr} className="flex items-center justify-between py-1 border-b border-slate-700/50 last:border-0 opacity-50">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs font-mono bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded w-8 text-center flex-shrink-0">
                                {s.abbr}
                              </span>
                              <span className="text-sm text-slate-400 truncate">{s.name}</span>
                            </div>
                            <span className="text-xs text-slate-500 flex-shrink-0 ml-2">PADD avg</span>
                          </div>
                        ))
                      }
                    </div>
                  ) : (
                    <p className="text-slate-500 text-sm">No state-level data available — EIA does not report individual states for this region.</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Regional Insights */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4">Regional Insights</h3>
        <div className="space-y-3 text-sm text-slate-300">
          <div className="flex items-start space-x-2">
            <span className="text-yellow-400 font-bold">•</span>
            <p><span className="font-semibold">PADD 3 (Gulf Coast)</span> typically has the lowest prices due to over 50% of US refining capacity being located in Texas and Louisiana.</p>
          </div>
          <div className="flex items-start space-x-2">
            <span className="text-red-400 font-bold">•</span>
            <p><span className="font-semibold">PADD 5 (West Coast)</span> consistently posts the highest prices, driven by California's special-blend gasoline requirements and geographic isolation from pipeline networks.</p>
          </div>
          <div className="flex items-start space-x-2">
            <span className="text-green-400 font-bold">•</span>
            <p><span className="font-semibold">PADD 2 (Midwest)</span> experiences higher volatility due to refinery outages causing rapid price spikes.</p>
          </div>
          <div className="flex items-start space-x-2">
            <span className="text-purple-400 font-bold">•</span>
            <p><span className="font-semibold">PADD 4 (Rocky Mountain)</span> faces higher transport costs due to limited local refining and mountain terrain.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
