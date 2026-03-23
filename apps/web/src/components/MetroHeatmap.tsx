import { useMemo, useState, useEffect } from 'react';
import { geoAlbersUsa, geoPath, type GeoProjection } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { AaaMetroAggregate } from '../api/client';

const US_ATLAS_URL = '/states-10m.json';

const ABBR_TO_FIPS: Record<string, string> = {
  AL:'01', AK:'02', AZ:'04', AR:'05', CA:'06', CO:'08', CT:'09', DC:'11',
  DE:'10', FL:'12', GA:'13', HI:'15', ID:'16', IL:'17', IN:'18', IA:'19',
  KS:'20', KY:'21', LA:'22', ME:'23', MD:'24', MA:'25', MI:'26', MN:'27',
  MS:'28', MO:'29', MT:'30', NE:'31', NV:'32', NH:'33', NJ:'34', NM:'35',
  NY:'36', NC:'37', ND:'38', OH:'39', OK:'40', OR:'41', PA:'42', RI:'44',
  SC:'45', SD:'46', TN:'47', TX:'48', UT:'49', VT:'50', VA:'51', WA:'53',
  WV:'54', WI:'55', WY:'56',
};

const SVG_W = 800;
const SVG_H = 500;

interface MetroHeatmapProps {
  metros: AaaMetroAggregate[];
  fuelType: 'regular' | 'mid_grade' | 'premium' | 'diesel';
  stateAbbr?: string;
}

/**
 * Metro Heatmap Component
 *
 * Renders the selected state's geographic outline (from US TopoJSON atlas)
 * and overlays color-coded metro circles using a d3-geo projection.
 */
export function MetroHeatmap({ metros, fuelType, stateAbbr }: MetroHeatmapProps) {
  const [statePath, setStatePath] = useState<string>('');
  const [projection, setProjection] = useState<GeoProjection | null>(null);
  const [tooltip, setTooltip] = useState<{ name: string; price: number | null } | null>(null);

  const priceRange = useMemo(() => {
    const prices = metros
      .map(m => m[fuelType as keyof AaaMetroAggregate] as number | null)
      .filter((p): p is number => p !== null);
    if (prices.length === 0) return { min: 0, max: 1 };
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return { min, max: max === min ? min + 0.01 : max };
  }, [metros, fuelType]);

  const priceToColor = (price: number | null): string => {
    if (price === null || price === undefined) return '#64748b';
    const t = Math.max(0, Math.min(1, (price - priceRange.min) / (priceRange.max - priceRange.min)));
    return `hsl(${240 - t * 240}, 90%, 55%)`;
  };

  useEffect(() => {
    if (!stateAbbr) return;
    const fips = ABBR_TO_FIPS[stateAbbr.toUpperCase()];
    if (!fips) return;

    fetch(US_ATLAS_URL)
      .then(r => r.json())
      .then((topo: Topology) => {
        const states = feature(topo, topo.objects['states'] as GeometryCollection);
        const stateFeature = states.features.find(f => f.id === fips || String(f.id) === fips);
        if (!stateFeature) return;

        const proj = geoAlbersUsa().fitSize([SVG_W, SVG_H], stateFeature);
        const path = geoPath(proj);
        setProjection(() => proj);
        setStatePath(path(stateFeature) ?? '');
      })
      .catch(console.error);
  }, [stateAbbr]);

  const metroPoints = useMemo(() => {
    if (!projection) return [];
    return metros
      .filter(m => m.latitude !== null && m.longitude !== null)
      .map(m => {
        const pt = projection([m.longitude as number, m.latitude as number]);
        if (!pt) return null;
        const price = m[fuelType as keyof AaaMetroAggregate] as number | null;
        return { ...m, svgX: pt[0], svgY: pt[1], price, color: priceToColor(price) };
      })
      .filter(Boolean) as Array<AaaMetroAggregate & { svgX: number; svgY: number; price: number | null; color: string }>;
  }, [metros, fuelType, projection, priceRange]);

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <div className="relative bg-slate-900 rounded border border-slate-700 overflow-hidden" style={{ height: 420 }}>
        {statePath ? (
          <svg
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            width="100%"
            height="100%"
            style={{ display: 'block' }}
          >
            {/* State outline */}
            <path d={statePath} fill="#1e3a5f" stroke="#4a6fa5" strokeWidth={1.5} />

            {/* Metro dots */}
            {metroPoints.map(m => (
              <circle
                key={m.metro_id}
                cx={m.svgX}
                cy={m.svgY}
                r={8}
                fill={m.color}
                fillOpacity={0.85}
                stroke="#0f172a"
                strokeWidth={1}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setTooltip({ name: m.metro_name, price: m.price })}
                onMouseLeave={() => setTooltip(null)}
              />
            ))}
          </svg>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-500 text-sm">
            Loading map…
          </div>
        )}

        {/* Hover tooltip */}
        {tooltip && (
          <div className="absolute top-3 left-3 bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-sm pointer-events-none shadow-lg">
            <span className="text-white font-medium">{tooltip.name}</span>
            <span className="text-slate-300 ml-2">
              {tooltip.price !== null ? `$${tooltip.price.toFixed(3)}` : 'N/A'}
            </span>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center gap-3 text-xs text-slate-400">
        <span>Price Range</span>
        <span
          className="w-4 h-3 rounded flex-shrink-0"
          style={{ background: 'hsl(240,90%,55%)' }}
        />
        <span className="text-slate-300">${priceRange.min.toFixed(2)}</span>
        <div
          className="flex-1 h-1.5 rounded"
          style={{
            backgroundImage:
              'linear-gradient(to right, hsl(240,90%,55%), hsl(180,90%,55%), hsl(120,90%,55%), hsl(60,90%,55%), hsl(0,90%,55%))',
          }}
        />
        <span className="text-slate-300">${priceRange.max.toFixed(2)}</span>
        <span
          className="w-4 h-3 rounded flex-shrink-0"
          style={{ background: 'hsl(0,90%,55%)' }}
        />
      </div>

      {/* Metro list */}
      {metros.length > 0 && (
        <div className="mt-5">
          <h4 className="text-sm font-semibold text-slate-300 mb-3">
            Metro Areas ({metros.length})
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto">
            {[...metros]
              .sort((a, b) => {
                const pA = (a[fuelType as keyof AaaMetroAggregate] as number) ?? 0;
                const pB = (b[fuelType as keyof AaaMetroAggregate] as number) ?? 0;
                return pB - pA;
              })
              .map(metro => {
                const price = metro[fuelType as keyof AaaMetroAggregate] as number | null;
                return (
                  <div key={metro.metro_id} className="text-xs flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ background: priceToColor(price) }}
                    />
                    <span className="text-slate-300 truncate">{metro.metro_name}</span>
                    <span className="text-slate-500 ml-auto flex-shrink-0">
                      {price ? `$${price.toFixed(3)}` : '–'}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {metros.length === 0 && (
        <div className="flex items-center justify-center h-32 text-slate-400">
          No metro price data available
        </div>
      )}
    </div>
  );
}
