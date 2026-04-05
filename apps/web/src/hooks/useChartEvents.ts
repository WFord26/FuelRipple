import { useQuery } from '@tanstack/react-query';
import { getEvents } from '../api/client';
import { ChartEvent, eventToAnnotationMarker, AnnotationMarker } from '../utils/eventAnnotations';
import { useCallback, useMemo, useState } from 'react';

/**
 * Hook to manage event data and annotations for charts
 * Supports date range filtering and category selection
 */
export function useChartEvents(
  dateStart?: string,
  dateEnd?: string,
) {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Fetch events for the specified date range
  const { data: events = [] } = useQuery({
    queryKey: ['chartEvents', dateStart, dateEnd],
    queryFn: () => {
      const params: any = {};
      if (dateStart) params.start = dateStart;
      if (dateEnd) params.end = dateEnd;
      return getEvents(params);
    },
    staleTime: 60 * 60 * 1000, // 1 hour
  });

  // Filter events by selected categories
  const filteredEvents: ChartEvent[] = useMemo(() => {
    if (selectedCategories.length === 0) return events;
    return events.filter(e => selectedCategories.includes(e.category));
  }, [events, selectedCategories]);

  // Convert to annotation markers for charts
  const annotations: AnnotationMarker[] = useMemo(() => {
    return filteredEvents.map(eventToAnnotationMarker);
  }, [filteredEvents]);

  // Toggle category selection
  const toggleCategory = useCallback((category: string) => {
    setSelectedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  }, []);

  // Reset selection
  const resetSelection = useCallback(() => {
    setSelectedCategories([]);
  }, []);

  return {
    events,
    filteredEvents,
    annotations,
    selectedCategories,
    toggleCategory,
    resetSelection,
  };
}
