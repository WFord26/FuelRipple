/**
 * Unified Tooltip Component for all charts
 * Consistent styling across the dashboard visualization system
 */

export interface TooltipPayload {
  name: string;
  value: number | string;
  color: string;
  dataKey?: string;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string | number;
  formatter?: (value: any, name: string) => string | [string, string];
  labelFormatter?: (label: any) => string;
}

/**
 * Base tooltip component used by all Recharts-based charts
 * Provides consistent dark styling with slate theme
 */
export function ChartTooltip({
  active,
  payload,
  label,
  labelFormatter,
  formatter,
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  const displayLabel = labelFormatter ? labelFormatter(label) : label;

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm shadow-xl">
      {displayLabel && (
        <div className="text-slate-300 font-medium mb-1">{displayLabel}</div>
      )}
      <div className="space-y-0.5">
        {payload.map((entry, index) => {
          const formatted = formatter ? formatter(entry.value, entry.name) : entry.value;
          const displayValue = Array.isArray(formatted) ? formatted[0] : formatted;
          const displayName = Array.isArray(formatted) ? formatted[1] : entry.name;

          return (
            <div key={`${entry.dataKey}-${index}`} className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-slate-400">{displayName}:</span>
              <span className="text-white font-semibold">{displayValue}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Custom tooltip for correlation/statistical charts
 * Shows additional metadata like correlation classification
 */
interface CorrelationTooltipProps extends ChartTooltipProps {
  renderExtra?: (payloadItem: any) => React.ReactNode;
}

export function CorrelationTooltip({
  active,
  payload,
  label,
  renderExtra,
}: CorrelationTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm shadow-xl">
      {label && (
        <div className="text-slate-300 font-medium mb-1">{label}</div>
      )}
      <div className="space-y-0.5">
        {payload.map((entry, index) => (
          <div key={`${entry.dataKey}-${index}`} className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-slate-400">{entry.name}:</span>
            <span className="text-white font-semibold">{entry.value}</span>
          </div>
        ))}
      </div>
      {renderExtra && payload[0] && (
        <div className="text-slate-400 text-xs mt-2 pt-2 border-t border-slate-700">
          {renderExtra(payload[0])}
        </div>
      )}
    </div>
  );
}
