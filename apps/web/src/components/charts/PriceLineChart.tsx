/**
 * PriceLineChart - Unified multi-series price chart
 * Used across Historical, Correlation, and Comparison pages
 */

import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine as RechartsReferenceLine,
} from 'recharts';
import { ChartTooltip } from './ChartTooltip';

export interface ChartReferenceLine {
  y?: number;
  x?: string | number;
  label?: string;
  stroke?: string;
  strokeDasharray?: string;
  strokeWidth?: number;
  /** Metadata passed back to onAnnotationClick when the marker is clicked. */
  id?: string;
  category?: string;
}

export interface PriceChartSeries {
  key: string;
  name: string;
  color: string;
  dataKey: string;
  strokeWidth?: number;
}

export interface PriceLineChartProps {
  data: any[];
  series: PriceChartSeries[];
  height?: number;
  showLegend?: boolean;
  showGrid?: boolean;
  xAxisKey?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  yAxisDomain?: [number | string, number | string];
  yAxisTickFormatter?: (value: any) => string;
  xAxisTickFormatter?: (value: any) => string;
  margin?: { top?: number; right?: number; bottom?: number; left?: number };
  tooltip?: {
    formatter?: (value: any, name: string) => string | [string, string];
    labelFormatter?: (label: any) => string;
  };
  referenceLines?: ChartReferenceLine[];
  /** Called when an annotation reference line is clicked. */
  onAnnotationClick?: (ref: ChartReferenceLine) => void;
  className?: string;
}

/**
 * Unified multi-series line chart component
 * Provides consistent styling, tooltips, and interactions
 * For area charts, use UtilizationAreaChart instead
 */
export function PriceLineChart({
  data,
  series,
  height = 400,
  showLegend = true,
  showGrid = true,
  xAxisKey = 'time',
  xAxisLabel,
  yAxisLabel,
  yAxisDomain,
  yAxisTickFormatter = (v: any) => `$${v.toFixed(2)}`,
  xAxisTickFormatter,
  margin = { top: 5, right: 30, left: 0, bottom: 5 },
  tooltip,
  referenceLines = [],
  onAnnotationClick,
  className = '',
}: PriceLineChartProps) {
  return (
    <div className={`w-full ${className}`} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsLineChart
          data={data}
          margin={margin}
        >
          {showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#334155"
              vertical={false}
            />
          )}
          <XAxis
            dataKey={xAxisKey}
            stroke="#94a3b8"
            style={{ fontSize: '12px' }}
            tick={{ fill: '#94a3b8' }}
            tickFormatter={xAxisTickFormatter}
            label={
              xAxisLabel
                ? { value: xAxisLabel, position: 'insideBottomRight', offset: -5 }
                : undefined
            }
          />
          <YAxis
            stroke="#94a3b8"
            style={{ fontSize: '12px' }}
            tick={{ fill: '#94a3b8' }}
            domain={yAxisDomain}
            tickFormatter={yAxisTickFormatter}
            label={
              yAxisLabel
                ? { value: yAxisLabel, angle: -90, position: 'insideLeft' }
                : undefined
            }
          />
          <Tooltip
            content={(props) => (
              <ChartTooltip
                {...props}
                formatter={tooltip?.formatter}
                labelFormatter={tooltip?.labelFormatter}
              />
            )}
          />
          {showLegend && <Legend />}

          {series.map((s) => (
            <Line
              key={s.key}
              dataKey={s.dataKey}
              name={s.name}
              stroke={s.color}
              strokeWidth={s.strokeWidth ?? 2}
              dot={false}
              isAnimationActive={false}
            />
          ))}

          {referenceLines.map((ref, idx) => (
            <RechartsReferenceLine
              key={`ref-${idx}`}
              y={ref.y}
              x={ref.x}
              stroke={ref.stroke ?? '#475569'}
              strokeWidth={ref.strokeWidth ?? 1}
              strokeDasharray={ref.strokeDasharray ?? '3 3'}
              onClick={onAnnotationClick ? () => onAnnotationClick(ref) : undefined}
              style={onAnnotationClick ? { cursor: 'pointer' } : undefined}
              label={
                ref.label
                  ? {
                      value: ref.label,
                      position: ref.x !== undefined ? 'insideTopLeft' : 'insideBottomRight',
                      offset: 10,
                      fill: '#94a3b8',
                      fontSize: 11,
                    }
                  : false
              }
            />
          ))}
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
}
