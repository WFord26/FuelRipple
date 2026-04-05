/**
 * EventAnnotation
 * Converts event data into chart annotation markers
 * Used across dashboard surfaces for consistent event visualization
 */

export interface ChartEvent {
  id: string;
  event_date: string;
  category: string;
  title: string;
  description: string;
  impact: 'bullish' | 'bearish' | 'neutral';
}

export interface AnnotationMarker {
  time: string;
  position: 'aboveBar' | 'belowBar' | 'inBar';
  color: string;
  shape: 'circle' | 'arrowUp' | 'arrowDown';
  text: string;
}

/**
 * Convert event to chart annotation marker
 */
export function eventToAnnotationMarker(event: ChartEvent): AnnotationMarker {
  const shapeMap: Record<string, 'circle' | 'arrowUp' | 'arrowDown'> = {
    bullish: 'arrowUp',
    bearish: 'arrowDown',
    neutral: 'circle',
  };

  const colorMap: Record<string, string> = {
    bullish: '#ef4444', // red for price up
    bearish: '#22c55e', // green for price down
    neutral: '#64748b', // slate for neutral
  };

  const categoryLabel: Record<string, string> = {
    opec: '🛢️ OPEC',
    hurricane: '🌀 Hurricane',
    sanctions: '⚠️ Sanctions',
    policy: '📋 Policy',
    other: '📰 Event',
  };

  return {
    time: event.event_date,
    position: event.impact === 'bullish' ? 'aboveBar' : event.impact === 'bearish' ? 'belowBar' : 'inBar',
    color: colorMap[event.impact],
    shape: shapeMap[event.impact],
    text: `${categoryLabel[event.category] || 'Event'}: ${event.title}`,
  };
}

/**
 * Filter events by category
 */
export function filterEventsByCategory(events: ChartEvent[], categories: string[]): ChartEvent[] {
  if (categories.length === 0) return events;
  return events.filter(e => categories.includes(e.category));
}

/**
 * Get event categories present in event list
 */
export function getEventCategories(events: ChartEvent[]): string[] {
  return Array.from(new Set(events.map(e => e.category)));
}

/**
 * Get active event count aggregations
 */
export interface EventStats {
  total: number;
  byCategory: Record<string, number>;
  byImpact: Record<string, number>;
}

export function getEventStats(events: ChartEvent[]): EventStats {
  const stats: EventStats = {
    total: events.length,
    byCategory: {},
    byImpact: {},
  };

  events.forEach(e => {
    // Count by category
    stats.byCategory[e.category] = (stats.byCategory[e.category] || 0) + 1;
    // Count by impact
    stats.byImpact[e.impact] = (stats.byImpact[e.impact] || 0) + 1;
  });

  return stats;
}
