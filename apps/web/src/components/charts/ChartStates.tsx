/**
 * Chart Loading and Empty State Components
 * Unified presentation across all dashboard charts
 */

interface ChartSkeletonProps {
  height?: number;
  rows?: number;
}

/**
 * Skeleton loader for charts
 * Displays animated placeholder while data loads
 */
export function ChartSkeleton({ height = 400, rows = 3 }: ChartSkeletonProps) {
  // Deterministic widths based on row index for consistent snapshot testing
  const widths = [90, 80, 85, 75, 95, 70, 88];
  
  return (
    <div
      className="w-full bg-slate-800/50 rounded-lg overflow-hidden"
      style={{ height: `${height}px` }}
    >
      <div className="p-4 space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="h-2 bg-slate-700/50 rounded animate-pulse"
            style={{
              width: `${widths[i % widths.length]}%`,
              animationDelay: `${i * 0.1}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

interface ChartLoadingProps {
  height?: number;
  message?: string;
}

/**
 * Loading state with spinner and optional message
 */
export function ChartLoading({
  height = 400,
  message = 'Loading chart...',
}: ChartLoadingProps) {
  return (
    <div
      className="w-full flex items-center justify-center"
      style={{ height: `${height}px` }}
    >
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin">
          <div className="w-6 h-6 border-2 border-slate-700 border-t-blue-400 rounded-full" />
        </div>
        <p className="text-sm text-slate-400">{message}</p>
      </div>
    </div>
  );
}

interface ChartEmptyStateProps {
  height?: number;
  title?: string;
  message?: string;
  icon?: string;
}

/**
 * Empty state when there's no data to display
 */
export function ChartEmptyState({
  height = 400,
  title = 'No data available',
  message,
  icon = '📊',
}: ChartEmptyStateProps) {
  return (
    <div
      className="w-full flex items-center justify-center"
      style={{ height: `${height}px` }}
    >
      <div className="flex flex-col items-center gap-3">
        <div className="text-4xl">{icon}</div>
        <h3 className="text-base font-semibold text-slate-300">{title}</h3>
        {message && <p className="text-sm text-slate-500 max-w-xs text-center">{message}</p>}
      </div>
    </div>
  );
}

interface ChartErrorStateProps {
  height?: number;
  message?: string;
}

/**
 * Error state when chart fails to load
 */
export function ChartErrorState({
  height = 400,
  message = 'Unable to load chart data',
}: ChartErrorStateProps) {
  return (
    <div
      className="w-full flex items-center justify-center bg-red-900/20 border border-red-700/50 rounded-lg"
      style={{ height: `${height}px` }}
    >
      <div className="flex flex-col items-center gap-2">
        <div className="text-2xl">⚠️</div>
        <p className="text-sm text-red-400">{message}</p>
      </div>
    </div>
  );
}
