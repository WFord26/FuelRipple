/**
 * React hooks and helpers for Application Insights analytics.
 *
 * Hooks:
 *  - usePageTracking()        — call once in App.tsx to auto-track route changes
 *  - useTrackEvent()          — returns a stable callback for tracking custom events
 *  - useDashboardTelemetry()  — structured callbacks for dashboard interaction events
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

// ── Dashboard interaction telemetry ─────────────────────────────────────────

/**
 * Structured analytics callbacks for dashboard interactions.
 *
 * Event names are stable string constants so that downstream queries in
 * Application Insights / Kusto are not affected by UI copy changes.
 *
 * @example
 * const telemetry = useDashboardTelemetry();
 * telemetry.trackFilterChanged('fuel', 'diesel');
 * telemetry.trackStateDrilldown('CA');
 */
export function useDashboardTelemetry() {
  /** Fires `dashboard_filter_changed` when any filter is updated. */
  const trackFilterChanged = useCallback(
    (filter: string, value: string, previousValue?: string) => {
      trackEvent('dashboard_filter_changed', {
        filter,
        value,
        ...(previousValue !== undefined ? { previous_value: previousValue } : {}),
      });
    },
    [],
  );

  /** Fires `time_range_changed` when the chart time range selector changes. */
  const trackTimeRangeChanged = useCallback(
    (range: string, previousRange?: string) => {
      trackEvent('time_range_changed', {
        range,
        ...(previousRange !== undefined ? { previous_range: previousRange } : {}),
      });
    },
    [],
  );

  /** Fires `state_drilldown_opened` when a user clicks a state on the map. */
  const trackStateDrilldown = useCallback(
    (stateAbbr: string, fuelType: string) => {
      trackEvent('state_drilldown_opened', { state: stateAbbr, fuel_type: fuelType });
    },
    [],
  );

  /** Fires `chart_annotation_opened` when a chart annotation marker is clicked. */
  const trackChartAnnotationOpened = useCallback(
    (annotationId: string, title: string, category?: string) => {
      trackEvent('chart_annotation_opened', {
        annotation_id: annotationId,
        title,
        ...(category ? { category } : {}),
      });
    },
    [],
  );

  /** Fires `story_card_opened` when a market story card is expanded or actioned. */
  const trackStoryCardOpened = useCallback(
    (cardId: string, title: string, category: string) => {
      trackEvent('story_card_opened', { card_id: cardId, title, category });
    },
    [],
  );

  /**
   * Fires `compare_mode_enabled` when a user activates compare mode.
   * Payload: the compare target (e.g. a PADD region code or state abbreviation).
   */
  const trackCompareModeEnabled = useCallback(
    (compareTarget: string, fuelType?: string) => {
      trackEvent('compare_mode_enabled', {
        compare_target: compareTarget,
        ...(fuelType ? { fuel_type: fuelType } : {}),
      });
    },
    [],
  );

  /**
   * Fires `panel_expanded` when a collapsible dashboard panel is opened.
   * Payload: a stable panel identifier (e.g. 'supply_health', 'regional_breakdown').
   */
  const trackPanelExpanded = useCallback(
    (panelId: string) => {
      trackEvent('panel_expanded', { panel_id: panelId });
    },
    [],
  );

  return {
    trackFilterChanged,
    trackTimeRangeChanged,
    trackStateDrilldown,
    trackChartAnnotationOpened,
    trackStoryCardOpened,
    trackCompareModeEnabled,
    trackPanelExpanded,
  };
}

// Re-export primitives so callers only need one import
export { trackEvent, trackException, trackPageView };
