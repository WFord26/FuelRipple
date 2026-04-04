/**
 * AreaChart Component - For supply, inventory, and utilization trends
 * Used in Supply page and other utilization-based visualizations
 */

import {
  AreaChart as RechartsAreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ChartTooltip } from './ChartTooltip';

export interface AreaChartSeries {
  key: string;
  name: string;
  dataKey: string;
  color: string;
  fill?: string;
  stackId?: string;
}

export interface UtilizationAreaChartProps {
  data: any[];
  series: AreaChartSeries[];
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
  type?: 'monotone' | 'linear' | 'natural' | 'step';
  className?: string;
}

/**
 * Unified area chart component
 * Supports stacking and is formatted for utilization/supply metrics
 */
export function UtilizationAreaChart({
  data,
  series,
  height = 350,
  showLegend = true,
  showGrid = true,
  xAxisKey = 'time',
  xAxisLabel,
  yAxisLabel,
  yAxisDomain,
  yAxisTickFormatter = (v: any) => `${v}%`,
  xAxisTickFormatter,
  margin = { top: 5, right: 30, left: 0, bottom: 5 },
  tooltip,
  type = 'monotone',
  className = '',
}: UtilizationAreaChartProps) {
  return (
    <div className={`w-full ${className}`} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsAreaChart
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
            <Area
              key={s.key}
              dataKey={s.dataKey}
              name={s.name}
              stroke={s.color}
              fill={s.fill || s.color}
              type={type}
              stackId={s.stackId}
              opacity={0.8}
              isAnimationActive={false}
            />
          ))}
        </RechartsAreaChart>
      </ResponsiveContainer>
    </div>
  );
}
