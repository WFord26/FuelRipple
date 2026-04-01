import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { DashboardFilters } from '@fuelripple/shared';

const DEFAULTS: DashboardFilters = {
  fuel:      'gas_regular',
  region:    'US',
  timerange: '1m',
  overlay:   'none',
};

/**
 * Persist dashboard filter state in the URL search params so that filters
 * survive page refresh and can be shared via link.
 *
 * Only params that differ from their defaults are written to the URL to
 * keep links clean.
 */
export function useDashboardFilters(): [DashboardFilters, (patch: Partial<DashboardFilters>) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters: DashboardFilters = {
    fuel:      (searchParams.get('fuel')      as DashboardFilters['fuel'])      ?? DEFAULTS.fuel,
    region:    searchParams.get('region')                                        ?? DEFAULTS.region,
    timerange: (searchParams.get('timerange') as DashboardFilters['timerange']) ?? DEFAULTS.timerange,
    compare:   searchParams.get('compare')    ?? undefined,
    overlay:   (searchParams.get('overlay')   as DashboardFilters['overlay'])   ?? DEFAULTS.overlay,
  };

  const setFilters = useCallback(
    (patch: Partial<DashboardFilters>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          const current: DashboardFilters = {
            fuel:      (prev.get('fuel')      as DashboardFilters['fuel'])      ?? DEFAULTS.fuel,
            region:    prev.get('region')                                        ?? DEFAULTS.region,
            timerange: (prev.get('timerange') as DashboardFilters['timerange']) ?? DEFAULTS.timerange,
            compare:   prev.get('compare')    ?? undefined,
            overlay:   (prev.get('overlay')   as DashboardFilters['overlay'])   ?? DEFAULTS.overlay,
          };
          const merged = { ...current, ...patch };

          // Write each key — omit if it equals the default to keep URLs clean
          const pairs: [string, string | undefined][] = [
            ['fuel',      merged.fuel      !== DEFAULTS.fuel      ? merged.fuel      : undefined],
            ['region',    merged.region    !== DEFAULTS.region    ? merged.region    : undefined],
            ['timerange', merged.timerange !== DEFAULTS.timerange ? merged.timerange : undefined],
            ['compare',   merged.compare                          ? merged.compare   : undefined],
            ['overlay',   merged.overlay   !== DEFAULTS.overlay   ? merged.overlay   : undefined],
          ];

          for (const [key, value] of pairs) {
            if (value !== undefined) {
              next.set(key, value);
            } else {
              next.delete(key);
            }
          }

          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  return [filters, setFilters];
}
