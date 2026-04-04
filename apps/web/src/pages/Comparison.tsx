import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getAaaPaddRegions, getAllAaaStatePrices } from '../api/client';
import { usePageSEO } from '../hooks/usePageSEO';
import { ChartContainer, ComparisonBarChart } from '../components/charts';
import USPriceMap from '../components/USPriceMap';

// Grade display config
const GRADES = [
  { key: 'regular',   label: 'Regular' },
  { key: 'mid_grade', label: 'Mid-Grade' },
  { key: 'premium',   label: 'Premium' },
  { key: 'diesel',    label: 'Diesel' },
] as const;
type GradeKey = typeof GRADES[number]['key'];

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

// State abbr → display name lookup
const STATE_NAMES: Record<string, string> = Object.fromEntries(
  PADD_REGIONS.flatMap(r => r.allStates.map(s => [s.abbr, s.name]))
);

export default function Comparison() {
  usePageSEO({
    title: 'Regional Gas Price Comparison',
    description: 'Compare gasoline and diesel prices across all 5 PADD regions and all 50 states. Updated daily from AAA price data.',
    canonicalPath: '/comparison',
  });

  const [grade, setGrade] = useState<GradeKey>('regular');
  const [method, setMethod] = useState<'mean' | 'wtd'>('wtd');
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  const { data: paddData, isLoading: paddLoading } = useQuery({
    queryKey: ['aaaPaddRegions'],
    queryFn: () => getAaaPaddRegions(),
  });

  const { data: stateData } = useQuery({
    queryKey: ['aaaAllStates'],
    queryFn: () => getAllAaaStatePrices(),
  });

  const isLoading = paddLoading;

  // Build the price key for selected grade + method: e.g. 'regular_wtd'
  const priceKey = `${grade}_${method}` as keyof NonNullable<typeof paddData>[number];

  // Build the USPriceMap-compatible comparisonData from AAA sources
  const comparisonData = useMemo(() => {
    if (!paddData) return [];
    return PADD_REGIONS.map(region => {
      const paddRow = paddData.find(p => p.padd === region.code);
      const paddValue = paddRow ? (paddRow[priceKey] as number | null) ?? 0 : 0;

      // State list: all AAA-reported states in this PADD, sorted high→low
      const states = region.allStates
        .map(s => {
          const stateRow = stateData?.find(r => r.state === s.abbr);
          const price = stateRow ? (stateRow[grade] as number | null) : null;
          return { abbr: s.abbr, name: s.name, value: price };
        })
        .filter((s): s is { abbr: string; name: string; value: number } => s.value !== null)
        .sort((a, b) => b.value - a.value);

      return { region: region.code, value: paddValue, states };
    });
  }, [paddData, stateData, priceKey, grade]);

  // Summary stats computed from PADD values
  const { nationalAvg, minPrice, maxPrice, priceSpread } = useMemo(() => {
    const values = comparisonData.map(d => d.value).filter(v => v > 0);
    if (values.length === 0) return { nationalAvg: 0, minPrice: 0, maxPrice: 0, priceSpread: 0 };
    const nationalAvg = values.reduce((a, b) => a + b, 0) / values.length;
    const minPrice = Math.min(...values);
    const maxPrice = Math.max(...values);
    return { nationalAvg, minPrice, maxPrice, priceSpread: maxPrice - minPrice };
  }, [comparisonData]);

  // Derive chart data from the PADD comparison data
  const chartData = PADD_REGIONS.map(region => {
    const d = comparisonData.find(c => c.region === region.code);
    return { name: region.name, price: d?.value || 0, code: region.code, color: region.color };
  }).filter(d => d.price > 0);

  const toggleRegion = (code: string) => {
    setExpandedRegions(prev => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Regional Comparison</h2>
          <p className="text-slate-400">Compare prices across US PADD regions — click a region to see all state prices</p>
        </div>
        {/* Grade + method controls */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex rounded-lg overflow-hidden border border-slate-600">
            {GRADES.map(g => (
              <button
                key={g.key}
                onClick={() => setGrade(g.key)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  grade === g.key
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
          <div className="flex rounded-lg overflow-hidden border border-slate-600">
            <button
              onClick={() => setMethod('wtd')}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                method === 'wtd'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
              title="Population-weighted mean (2020 Census)"
            >
              Pop. Weighted
            </button>
            <button
              onClick={() => setMethod('mean')}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                method === 'mean'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
              title="Simple arithmetic mean across reporting states"
            >
              Mean
            </button>
          </div>
          <span className="text-xs text-slate-500 px-1">Source: AAA · Daily</span>
        </div>
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
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 overflow-hidden">
        <h3 className="text-lg font-semibold text-white mb-2">Price Map by State</h3>
        <p className="text-xs text-slate-500 mb-4">Colored by regular gas price · PADD region borders shown · hover for details · click a state for detail</p>
        <USPriceMap comparisonData={comparisonData ?? []} height={400} onStateClick={(abbr) => navigate(`/state/${abbr}`)} />
      </div>

      {/* Chart */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4">Regional Price Comparison</h3>
        <ChartContainer
          height={340}
          isLoading={isLoading}
          isEmpty={chartData.length === 0}
          emptyMessage="No comparison data available"
        >
          <ComparisonBarChart
            data={chartData}
            series={[
              {
                key: 'price',
                name: 'Price',
                dataKey: 'price',
                color: '#3b82f6',
              },
            ]}
            layout="horizontal"
            xAxisKey="name"
            yAxisTickFormatter={(v) => `$${Number(v).toFixed(2)}`}
            tooltip={{
              formatter: (value) => `$${Number(value).toFixed(3)}`,
              labelFormatter: (label) => label,
            }}
            margin={{ top: 8, right: 16, bottom: 0, left: 100 }}
          />
        </ChartContainer>
      </div>

      {/* PADD Region Cards with state breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {PADD_REGIONS.map(region => {
          const regionData = comparisonData.find(d => d.region === region.code);
          const price = regionData?.value ?? 0;
          const vsNational = price > 0 && nationalAvg > 0 ? ((price - nationalAvg) / nationalAvg) * 100 : 0;
          const isExpanded = expandedRegions.has(region.code);
          const regionStates = regionData?.states ?? [];

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
                    <span className="ml-2 font-normal normal-case text-slate-500">
                      ({regionStates.length} of {region.allStates.length} states)
                    </span>
                  </div>

                  {regionStates.length > 0 ? (
                    <div className="space-y-1">
                      {regionStates.map(s => {
                        const vs = nationalAvg > 0 ? ((s.value - nationalAvg) / nationalAvg) * 100 : 0;
                        return (
                          <div
                            key={s.abbr}
                            className="flex items-center justify-between py-1 border-b border-slate-700/50 last:border-0 cursor-pointer hover:bg-slate-700/30 rounded px-1 -mx-1 transition-colors"
                            onClick={() => navigate(`/state/${s.abbr}`)}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs font-mono bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded w-8 text-center flex-shrink-0">
                                {s.abbr}
                              </span>
                              <span className="text-sm text-slate-300 truncate">{STATE_NAMES[s.abbr] ?? s.name}</span>
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

                      {/* States AAA did not report today */}
                      {region.allStates
                        .filter(s => !regionStates.find(r => r.abbr === s.abbr))
                        .map(s => (
                          <div key={s.abbr} className="flex items-center justify-between py-1 border-b border-slate-700/50 last:border-0 opacity-40">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs font-mono bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded w-8 text-center flex-shrink-0">
                                {s.abbr}
                              </span>
                              <span className="text-sm text-slate-400 truncate">{s.name}</span>
                            </div>
                            <span className="text-xs text-slate-500 flex-shrink-0 ml-2">no data</span>
                          </div>
                        ))
                      }
                    </div>
                  ) : (
                    <p className="text-slate-500 text-sm">No state-level data available yet.</p>
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
