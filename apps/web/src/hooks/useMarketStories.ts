import { useQuery } from '@tanstack/react-query';
import { getEvents, getVolatility, getDisruptionScore } from '../api/client';
import { StoryCardData } from '../components/StoryCard';

interface Event {
  id: string;
  event_date: string;
  category: string;
  title: string;
  description: string;
  impact: 'bullish' | 'bearish' | 'neutral';
}

export function useMarketStories(metric: string = 'gas_regular', region: string = 'US') {
  const { data: events } = useQuery({
    queryKey: ['marketStories:events', metric],
    queryFn: () => getEvents(),
    staleTime: 60 * 60 * 1000, // 1 hour
  });

  const { data: disruption } = useQuery({
    queryKey: ['marketStories:disruption', metric, region],
    queryFn: () => getDisruptionScore(metric, region),
    staleTime: 30 * 60 * 1000, // 30 minutes
  });

  const { data: volatility } = useQuery({
    queryKey: ['marketStories:volatility', metric, region],
    queryFn: () => getVolatility(metric, region, 30),
    staleTime: 30 * 60 * 1000, // 30 minutes
  });

  const stories: StoryCardData[] = [];

  // 1. Recent significant events → "Why this moved"
  if (events && events.length > 0) {
    const recentEvent = events[0]; // Most recent event
    const eventIconMap: Record<string, string> = {
      opec: '🛢️',
      hurricane: '🌀',
      sanctions: '⚠️',
      policy: '📋',
      other: '📰',
    };

    const eventColorMap: Record<string, 'blue' | 'amber' | 'red' | 'green' | 'slate'> = {
      opec: 'blue',
      hurricane: 'red',
      sanctions: 'amber',
      policy: 'slate',
      other: 'slate',
    };

    stories.push({
      id: `story-event-${recentEvent.id}`,
      title: recentEvent.title,
      insight: `Why prices moved: ${getEventNarrative(recentEvent)}`,
      detail: recentEvent.description,
      category: 'event',
      icon: eventIconMap[recentEvent.category] || '📰',
      color: eventColorMap[recentEvent.category] || 'slate',
      date: new Date(recentEvent.event_date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
    });

    // Add 1-2 additional context cards for other recent events
    for (let i = 1; i < Math.min(2, events.length); i++) {
      const evt = events[i];
      stories.push({
        id: `story-event-${evt.id}`,
        title: evt.title,
        insight: getEventNarrative(evt),
        detail: evt.description,
        category: 'event',
        icon: eventIconMap[evt.category] || '📰',
        color: eventColorMap[evt.category] || 'slate',
        date: new Date(evt.event_date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
      });
    }
  }

  // 2. Market volatility → "What to watch next"
  if (volatility) {
    let watchColor: 'blue' | 'amber' | 'red' | 'green' | 'slate' = 'blue';
    let watchInsight = 'Market is stable';

    if (volatility.classification === 'extreme') {
      watchColor = 'red';
      watchInsight = 'Extreme volatility ahead—prepare for sharp price swings';
    } else if (volatility.classification === 'elevated') {
      watchColor = 'amber';
      watchInsight = 'Elevated volatility expected in the coming weeks';
    } else if (volatility.classification === 'moderate') {
      watchColor = 'slate';
      watchInsight = 'Moderate volatility—monitor for shifts in supply or geopolitics';
    }

    stories.push({
      id: 'story-volatility-watch',
      title: 'Market Watch',
      insight: watchInsight,
      detail: `30-day price volatility: ${volatility.annualizedVolatility?.toFixed(1)}%`,
      category: 'market',
      icon: '👁️',
      color: watchColor,
      actionLabel: 'View volatility',
    });
  }

  // 3. Disruption index → "Consumer impact context"
  if (disruption) {
    let impactColor: 'blue' | 'amber' | 'red' | 'green' | 'slate' = 'blue';
    let impactInsight = '';

    if (disruption.classification === 'critical') {
      impactColor = 'red';
      impactInsight = 'Critical disruption: household budgets under significant strain';
    } else if (disruption.classification === 'severe') {
      impactColor = 'amber';
      impactInsight = 'Severe impacts: consumers face elevated fuel costs';
    } else if (disruption.classification === 'moderate') {
      impactColor = 'slate';
      impactInsight = 'Moderate impacts: watch for shifts in consumer behavior';
    } else {
      impactColor = 'green';
      impactInsight = 'Low disruption: minimal household budget strain';
    }

    stories.push({
      id: 'story-disruption',
      title: 'Consumer Impact',
      insight: impactInsight,
      detail: `Disruption score: ${disruption.score.toFixed(1)}/100`,
      category: 'supply',
      icon: '👥',
      color: impactColor,
      actionLabel: 'View impact details',
    });
  }

  return stories.slice(0, 5); // Return top 5 stories
}

/**
 * Generate narrative text for an event based on its category and impact
 */
function getEventNarrative(event: Event): string {
  const impactMap = {
    bullish: 'prices are expected to rise',
    bearish: 'prices are expected to decline',
    neutral: 'neutral impact on prices',
  };

  const categoryMap: Record<string, string> = {
    opec: 'OPEC production decision',
    hurricane: 'tropical weather threat',
    sanctions: 'geopolitical sanctions',
    policy: 'regulatory or policy change',
    other: 'market event',
  };

  const categoryDescr = categoryMap[event.category] || 'market development';
  const impactText = impactMap[event.impact] || impactMap.neutral;

  return `${categoryDescr} → ${impactText}`;
}
