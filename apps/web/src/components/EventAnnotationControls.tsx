import { useState, useMemo } from 'react';
import { ChartEvent, getEventCategories, getEventStats } from '../utils/eventAnnotations';

interface EventAnnotationControlsProps {
  events: ChartEvent[];
  selectedCategories: string[];
  onCategoryToggle: (category: string) => void;
  onReset: () => void;
}

export default function EventAnnotationControls({
  events,
  selectedCategories,
  onCategoryToggle,
  onReset,
}: EventAnnotationControlsProps) {
  const categories = useMemo(() => getEventCategories(events), [events]);
  const stats = useMemo(() => getEventStats(events), [events]);

  if (categories.length === 0) return null;

  const categoryIcons: Record<string, string> = {
    opec: '🛢️',
    hurricane: '🌀',
    sanctions: '⚠️',
    policy: '📋',
    other: '📰',
  };

  return (
    <div className="flex flex-wrap items-center gap-2 py-3 px-1 border-b border-slate-700">
      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Event Filters:</span>
      {categories.map((cat) => {
        const isSelected = selectedCategories.includes(cat);
        const count = stats.byCategory[cat] || 0;
        const displayLabel = 
          cat === 'opec' ? 'OPEC' :
          cat === 'hurricane' ? 'Weather' :
          cat === 'sanctions' ? 'Sanctions' :
          cat === 'policy' ? 'Policy' :
          'Other';

        return (
          <button
            key={cat}
            onClick={() => onCategoryToggle(cat)}
            className={`
              inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
              transition-all duration-200 whitespace-nowrap
              ${isSelected
                ? 'bg-primary-600 text-white border border-primary-500'
                : 'bg-slate-700/50 text-slate-300 border border-slate-600 hover:border-slate-500'
              }
            `}
            title={`${displayLabel} (${count} events)`}
          >
            <span>{categoryIcons[cat] || '📌'}</span>
            <span>{displayLabel}</span>
            <span className="text-[10px] opacity-75">({count})</span>
          </button>
        );
      })}
      {selectedCategories.length > 0 && (
        <button
          onClick={onReset}
          className="text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors ml-auto"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
