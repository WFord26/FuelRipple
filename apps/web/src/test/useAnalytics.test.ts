import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock appInsights before importing the hook so trackEvent is intercepted
vi.mock('../lib/appInsights', () => ({
  trackEvent: vi.fn(),
  trackException: vi.fn(),
  trackPageView: vi.fn(),
}));

import { trackEvent } from '../lib/appInsights';
import { useDashboardTelemetry } from '../hooks/useAnalytics';

describe('useDashboardTelemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('trackFilterChanged emits dashboard_filter_changed with filter and value', () => {
    const { result } = renderHook(() => useDashboardTelemetry());
    act(() => {
      result.current.trackFilterChanged('fuel', 'diesel');
    });
    expect(trackEvent).toHaveBeenCalledWith('dashboard_filter_changed', {
      filter: 'fuel',
      value: 'diesel',
    });
  });

  it('trackFilterChanged includes previous_value when provided', () => {
    const { result } = renderHook(() => useDashboardTelemetry());
    act(() => {
      result.current.trackFilterChanged('fuel', 'diesel', 'gas_regular');
    });
    expect(trackEvent).toHaveBeenCalledWith('dashboard_filter_changed', {
      filter: 'fuel',
      value: 'diesel',
      previous_value: 'gas_regular',
    });
  });

  it('trackTimeRangeChanged emits time_range_changed with range', () => {
    const { result } = renderHook(() => useDashboardTelemetry());
    act(() => {
      result.current.trackTimeRangeChanged('3m');
    });
    expect(trackEvent).toHaveBeenCalledWith('time_range_changed', { range: '3m' });
  });

  it('trackTimeRangeChanged includes previous_range when provided', () => {
    const { result } = renderHook(() => useDashboardTelemetry());
    act(() => {
      result.current.trackTimeRangeChanged('3m', '1m');
    });
    expect(trackEvent).toHaveBeenCalledWith('time_range_changed', {
      range: '3m',
      previous_range: '1m',
    });
  });

  it('trackStateDrilldown emits state_drilldown_opened with state and fuel_type', () => {
    const { result } = renderHook(() => useDashboardTelemetry());
    act(() => {
      result.current.trackStateDrilldown('CA', 'gas_regular');
    });
    expect(trackEvent).toHaveBeenCalledWith('state_drilldown_opened', {
      state: 'CA',
      fuel_type: 'gas_regular',
    });
  });

  it('trackChartAnnotationOpened emits chart_annotation_opened with id and title', () => {
    const { result } = renderHook(() => useDashboardTelemetry());
    act(() => {
      result.current.trackChartAnnotationOpened('evt-123', 'OPEC Cut');
    });
    expect(trackEvent).toHaveBeenCalledWith('chart_annotation_opened', {
      annotation_id: 'evt-123',
      title: 'OPEC Cut',
    });
  });

  it('trackChartAnnotationOpened includes category when provided', () => {
    const { result } = renderHook(() => useDashboardTelemetry());
    act(() => {
      result.current.trackChartAnnotationOpened('evt-123', 'OPEC Cut', 'opec');
    });
    expect(trackEvent).toHaveBeenCalledWith('chart_annotation_opened', {
      annotation_id: 'evt-123',
      title: 'OPEC Cut',
      category: 'opec',
    });
  });

  it('trackStoryCardOpened emits story_card_opened with id, title, and category', () => {
    const { result } = renderHook(() => useDashboardTelemetry());
    act(() => {
      result.current.trackStoryCardOpened('story-1', 'OPEC Production Cut', 'event');
    });
    expect(trackEvent).toHaveBeenCalledWith('story_card_opened', {
      card_id: 'story-1',
      title: 'OPEC Production Cut',
      category: 'event',
    });
  });

  it('trackCompareModeEnabled emits compare_mode_enabled with compare_target', () => {
    const { result } = renderHook(() => useDashboardTelemetry());
    act(() => {
      result.current.trackCompareModeEnabled('R10');
    });
    expect(trackEvent).toHaveBeenCalledWith('compare_mode_enabled', {
      compare_target: 'R10',
    });
  });

  it('trackCompareModeEnabled includes fuel_type when provided', () => {
    const { result } = renderHook(() => useDashboardTelemetry());
    act(() => {
      result.current.trackCompareModeEnabled('R10', 'diesel');
    });
    expect(trackEvent).toHaveBeenCalledWith('compare_mode_enabled', {
      compare_target: 'R10',
      fuel_type: 'diesel',
    });
  });

  it('trackPanelExpanded emits panel_expanded with panel_id', () => {
    const { result } = renderHook(() => useDashboardTelemetry());
    act(() => {
      result.current.trackPanelExpanded('supply_health');
    });
    expect(trackEvent).toHaveBeenCalledWith('panel_expanded', {
      panel_id: 'supply_health',
    });
  });

  it('returns stable callback references across re-renders', () => {
    const { result, rerender } = renderHook(() => useDashboardTelemetry());
    const first = result.current.trackFilterChanged;
    rerender();
    expect(result.current.trackFilterChanged).toBe(first);
  });
});
