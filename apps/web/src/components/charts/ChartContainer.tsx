/**
 * ChartContainer - Wrapper for all charts
 * Provides consistent loading/empty/error state handling
 */

import React from 'react';
import {
  ChartSkeleton,
  ChartEmptyState,
  ChartErrorState,
} from './ChartStates';

export interface ChartContainerProps {
  title?: string;
  subtitle?: string;
  height?: number;
  isLoading?: boolean;
  isError?: boolean;
  error?: Error;
  isEmpty?: boolean;
  emptyMessage?: string;
  errorMessage?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Container component that wraps all charts with consistent styling,
 * loading states, empty states, and error handling.
 *
 * Handles the common pattern:
 * - Show title + subtitle
 * - Show loading skeleton while data loads
 * - Show empty state if no data
 * - Show error state if query failed
 * - Render children if all good
 */
export function ChartContainer({
  title,
  subtitle,
  height,
  isLoading,
  isError,
  error,
  isEmpty,
  emptyMessage,
  errorMessage,
  children,
  actions,
  className = '',
}: ChartContainerProps) {
  return (
    <div className={`w-full ${className}`}>
      {/* Header */}
      {(title || actions) && (
        <div className="flex flex-col gap-1 mb-4">
          <div className="flex items-start justify-between gap-3">
            {title && <h3 className="text-lg font-semibold text-white">{title}</h3>}
            {actions && <div className="flex gap-2">{actions}</div>}
          </div>
          {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <ChartSkeleton height={height} />
      ) : isError ? (
        <ChartErrorState
          height={height}
          message={errorMessage || error?.message || 'Unable to load chart'}
        />
      ) : isEmpty ? (
        <ChartEmptyState height={height} message={emptyMessage} />
      ) : (
        children
      )}
    </div>
  );
}
