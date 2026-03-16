/**
 * React hooks and helpers for Application Insights analytics.
 *
 * Hooks:
 *  - usePageTracking()  — call once in App.tsx to auto-track route changes
 *  - useTrackEvent()    — returns a stable callback for tracking custom events
 *
 * Standalone helpers are also exported from `lib/appInsights.ts` for use
 * in non-hook contexts (e.g. callbacks, class components).
 */

import { useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { trackEvent, trackException, trackPageView } from '../lib/appInsights';

// ── Page-view tracking ───────────────────────────────────────────────────────

/** Tracks a page view every time the React Router location changes. */
export function usePageTracking() {
  const location = useLocation();

  useEffect(() => {
    const name = document.title || location.pathname;
    trackPageView(name, location.pathname + location.search);
  }, [location]);
}

// ── Custom event tracking ────────────────────────────────────────────────────

/**
 * Returns a stable `track` callback scoped to the given event category.
 *
 * @example
 * const track = useTrackEvent('CDI Widget');
 * track('calculate', { region: 'PADD1' }, { cost: 1.23 });
 */
export function useTrackEvent(category: string) {
  return useCallback(
    (
      action: string,
      properties?: Record<string, string>,
      measurements?: Record<string, number>,
    ) => {
      trackEvent(`${category} - ${action}`, properties, measurements);
    },
    [category],
  );
}

// Re-export primitives so callers only need one import
export { trackEvent, trackException, trackPageView };
