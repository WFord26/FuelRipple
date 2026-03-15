import { useState, useEffect, useMemo } from 'react';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import { interpolateRdYlGn } from 'd3-scale-chromatic';
import { merge } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';

const US_ATLAS_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json';

// FIPS → state abbreviation
const FIPS_TO_ABBR: Record<string, string> = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA',
  '08': 'CO', '09': 'CT', '10': 'DE', '11': 'DC', '12': 'FL',
  '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN',
  '19': 'IA', '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME',
  '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN', '28': 'MS',
  '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH',
  '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND',
  '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI',
  '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT',
  '50': 'VT', '51': 'VA', '53': 'WA', '54': 'WV', '55': 'WI', '56': 'WY',
};

// FIPS → PADD region code
const FIPS_TO_PADD: Record<string, string> = {
  // PADD 1 – East Coast
  '09': 'R10', '11': 'R10', '10': 'R10', '12': 'R10', '13': 'R10',
  '25': 'R10', '24': 'R10', '23': 'R10', '37': 'R10', '33': 'R10',
  '34': 'R10', '36': 'R10', '42': 'R10', '44': 'R10', '45': 'R10',
  '51': 'R10', '50': 'R10', '54': 'R10',
  // PADD 2 – Midwest
  '19': 'R20', '17': 'R20', '18': 'R20', '20': 'R20', '21': 'R20',
  '26': 'R20', '27': 'R20', '29': 'R20', '38': 'R20', '31': 'R20',
  '39': 'R20', '40': 'R20', '46': 'R20', '47': 'R20', '55': 'R20',
  // PADD 3 – Gulf Coast
  '01': 'R30', '05': 'R30', '22': 'R30', '28': 'R30', '35': 'R30', '48': 'R30',
  // PADD 4 – Rocky Mountain
  '08': 'R40', '16': 'R40', '30': 'R40', '49': 'R40', '56': 'R40',
  // PADD 5 – West Coast
  '02': 'R50', '04': 'R50', '06': 'R50', '15': 'R50', '32': 'R50',
  '41': 'R50', '53': 'R50',
};

const PADD_META: Record<string, { name: string; color: string }> = {
  R10: { name: 'East Coast',      color: '#3b82f6' },
  R20: { name: 'Midwest',         color: '#10b981' },
  R30: { name: 'Gulf Coast',      color: '#f59e0b' },
  R40: { name: 'Rocky Mountain',  color: '#8b5cf6' },
  R50: { name: 'West Coast',      color: '#ef4444' },
};

export interface USPriceMapProps {
  /** Comparison data returned by GET /prices/comparison */
  comparisonData: Array<{
    region: string;
    value: number;
    states?: Array<{ abbr: string; name: string; value: number }>;
  }>;
  /** Height in pixels (default 420) */
  height?: number;
  /** Optional callback when a state is clicked (receives 2-letter abbreviation) */
  onStateClick?: (abbr: string) => void;
}

export default function USPriceMap({ comparisonData, height = 420, onStateClick }: USPriceMapProps) {
  const [topology, setTopology] = useState<Topology | null>(null);
  const [tooltip, setTooltip] = useState<{
    x: number; y: number;
    abbr: string; name: string;
    price: number | null;
    padd: string;
    source: 'state' | 'padd';
  } | null>(null);

  // Load US atlas topology
  useEffect(() => {
    fetch(US_ATLAS_URL)
      .then(r => r.json())
      .then(setTopology)
      .catch(console.error);
  }, []);

  // Build a flat abbr → price lookup, falling back to PADD average
  const { statePriceMap, paddPriceMap, minPrice, maxPrice } = useMemo(() => {
    const paddPriceMap: Record<string, number> = {};
    const statePriceMap: Record<string, number> = {};

    for (const region of comparisonData) {
      paddPriceMap[region.region] = region.value;
      for (const s of region.states ?? []) {
        statePriceMap[s.abbr] = s.value;
      }
    }

    const allPrices = [
      ...Object.values(statePriceMap),
      ...Object.values(paddPriceMap),
    ].filter(Boolean);

    const minPrice = allPrices.length ? Math.min(...allPrices) : 2.5;
    const maxPrice = allPrices.length ? Math.max(...allPrices) : 5.5;

    return { statePriceMap, paddPriceMap, minPrice, maxPrice };
  }, [comparisonData]);

  // Compute PADD merged outline geometries once topology is ready
  const paddOutlines = useMemo(() => {
    if (!topology || !topology.objects?.states) return [];

    const states = topology.objects.states as GeometryCollection;

    return Object.keys(PADD_META).map(paddCode => {
      const paddGeoms = states.geometries.filter(
        g => FIPS_TO_PADD[String(g.id).padStart(2, '0')] === paddCode
      );
      if (paddGeoms.length === 0) return null;

      const merged = merge(topology as any, paddGeoms as any);
      const geoJSON = {
        type: 'FeatureCollection' as const,
        features: [{ type: 'Feature' as const, geometry: merged, properties: {} }],
      };
      return { paddCode, geoJSON, color: PADD_META[paddCode].color };
    }).filter(Boolean) as { paddCode: string; geoJSON: any; color: string }[];
  }, [topology]);

  const getStateColor = (fips: string): string => {
    const abbr = FIPS_TO_ABBR[fips.padStart(2, '0')];
    const padd = FIPS_TO_PADD[fips.padStart(2, '0')];

    const price = abbr
      ? (statePriceMap[abbr] ?? (padd ? paddPriceMap[padd] : null))
      : (padd ? paddPriceMap[padd] : null);

    if (price == null || maxPrice === minPrice) return '#334155';

    // Normalize: 0 = cheapest (green), 1 = most expensive (red)
    const t = 1 - (price - minPrice) / (maxPrice - minPrice);
    const hex = interpolateRdYlGn(t);
    return hex;
  };

  const getStatePrice = (fips: string): number | null => {
    const abbr = FIPS_TO_ABBR[fips.padStart(2, '0')];
    const padd = FIPS_TO_PADD[fips.padStart(2, '0')];
    if (abbr && statePriceMap[abbr] != null) return statePriceMap[abbr];
    if (padd && paddPriceMap[padd] != null) return paddPriceMap[padd];
    return null;
  };

  // For states that only have PADD-level data, find state name from FIPS
  const STATE_NAMES: Record<string, string> = {
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

  if (!topology) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <div className="text-slate-400 text-sm">Loading map…</div>
      </div>
    );
  }

  return (
    <div className="relative select-none" style={{ height }}>
      <ComposableMap
        projection="geoAlbersUsa"
        projectionConfig={{ scale: 920, center: [0, 0] }}
        width={800}
        height={height}
        style={{ width: '100%', height: '100%' }}
      >
        {/* State fills — choropleth by price */}
        <Geographies geography={US_ATLAS_URL}>
          {({ geographies }: { geographies: any[] }) =>
            geographies.map((geo: any) => {
              const fips = String(geo.id);
              const abbr = FIPS_TO_ABBR[fips.padStart(2, '0')];
              const padd = FIPS_TO_PADD[fips.padStart(2, '0')];
              const price = getStatePrice(fips);
              const isStateDirect = abbr != null && statePriceMap[abbr] != null;

              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={getStateColor(fips)}
                  stroke="#0f172a"
                  strokeWidth={0.6}
                  style={{
                    default: { outline: 'none' },
                    hover: { outline: 'none', opacity: 0.85, cursor: 'pointer' },
                    pressed: { outline: 'none' },
                  }}
                  onMouseEnter={(e: React.MouseEvent<SVGPathElement>) => {
                    const rect = (e.target as SVGPathElement)
                      .closest('svg')!
                      .getBoundingClientRect();
                    setTooltip({
                      x: e.clientX - rect.left,
                      y: e.clientY - rect.top,
                      abbr: abbr ?? '??',
                      name: abbr ? (STATE_NAMES[abbr] ?? abbr) : fips,
                      price,
                      padd,
                      source: isStateDirect ? 'state' : 'padd',
                    });
                  }}
                  onMouseMove={(e: React.MouseEvent<SVGPathElement>) => {
                    const rect = (e.target as SVGPathElement)
                      .closest('svg')!
                      .getBoundingClientRect();
                    setTooltip(prev => prev ? { ...prev, x: e.clientX - rect.left, y: e.clientY - rect.top } : null);
                  }}
                  onMouseLeave={() => setTooltip(null)}
                  onClick={() => {
                    if (abbr && onStateClick) onStateClick(abbr);
                  }}
                />
              );
            })
          }
        </Geographies>

        {/* PADD region outlines — thick colored borders of each PADD boundary */}
        {paddOutlines.map(({ paddCode, geoJSON, color }) => (
          <Geographies key={paddCode} geography={geoJSON}>
            {({ geographies }: { geographies: any[] }) =>
              geographies.map((geo: any) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="none"
                  stroke={color}
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                  style={{
                    default: { outline: 'none', pointerEvents: 'none' },
                    hover: { outline: 'none', pointerEvents: 'none' },
                    pressed: { outline: 'none', pointerEvents: 'none' },
                  }}
                />
              ))
            }
          </Geographies>
        ))}
      </ComposableMap>

      {/* Hover tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none z-20 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm shadow-xl"
          style={{
            left: Math.min(tooltip.x + 12, 680),
            top: Math.max(tooltip.y - 60, 8),
          }}
        >
          <div className="font-bold text-white">{tooltip.name} ({tooltip.abbr})</div>
          {tooltip.price != null ? (
            <>
              <div className="text-emerald-400 font-semibold">${tooltip.price.toFixed(3)}/gal</div>
              {tooltip.source === 'padd' && (
                <div className="text-slate-500 text-xs mt-0.5">
                  {PADD_META[tooltip.padd]?.name} avg (no state data)
                </div>
              )}
            </>
          ) : (
            <div className="text-slate-400">No data</div>
          )}
        </div>
      )}

      {/* Price gradient legend */}
      <div className="absolute bottom-2 left-4 flex items-center gap-2">
        <span className="text-xs text-slate-400">${minPrice.toFixed(2)}</span>
        <div
          className="w-32 h-3 rounded"
          style={{
            background: `linear-gradient(to right, ${interpolateRdYlGn(1)}, ${interpolateRdYlGn(0.5)}, ${interpolateRdYlGn(0)})`,
          }}
        />
        <span className="text-xs text-slate-400">${maxPrice.toFixed(2)}</span>
      </div>

      {/* PADD legend */}
      <div className="absolute bottom-2 right-4 flex flex-col gap-1">
        {Object.entries(PADD_META).map(([code, { name, color }]) => {
          const paddData = comparisonData.find(d => d.region === code);
          return (
            <div key={code} className="flex items-center gap-1.5 text-xs">
              <div className="w-3 h-0.5" style={{ backgroundColor: color, minWidth: 12, border: `1.5px solid ${color}` }} />
              <span className="text-slate-400">{name}</span>
              {paddData && (
                <span className="text-slate-300 font-mono">${paddData.value.toFixed(3)}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
