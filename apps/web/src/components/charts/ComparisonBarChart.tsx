/**
 * ComparisonBarChart - Side-by-side bar chart comparisons
 * Used for regional/supply comparisons across the dashboard
 */

import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ChartTooltip } from './ChartTooltip';

export interface BarChartSeries {
  key: string;
  name: string;
  dataKey: string;
  color: string | ((index: number) => string);
  stackId?: string;
}

export interface ComparisonBarChartProps {
  data: any[];
  series: BarChartSeries[];
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
  barCategoryGap?: string | number;
  layout?: 'vertical' | 'horizontal';
  className?: string;
}

/**
 * Unified bar chart for comparisons
 * Supports stacking and custom color schemes
 */
export function ComparisonBarChart({
  data,
  series,
  height = 350,
  showLegend = true,
  showGrid = true,
  xAxisKey = 'name',
  xAxisLabel,
  yAxisLabel,
  yAxisDomain,
  yAxisTickFormatter = (v: any) => v.toString(),
  xAxisTickFormatter,
  margin = { top: 8, right: 16, bottom: 0, left: 0 },
  tooltip,
  barCategoryGap = '15%',
  layout = 'horizontal',
  className = '',
}: ComparisonBarChartProps) {
  return (
    <div className={`w-full ${className}`} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart
          data={data}
          margin={margin}
          layout={layout}
          barCategoryGap={barCategoryGap}
        >
          {showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#334155"
              vertical={layout === 'horizontal'}
              horizontal={layout === 'vertical'}
            />
          )}

          {layout === 'horizontal' ? (
            <>
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
                type="number"
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
            </>
          ) : (
            <>
              <XAxis
                type="number"
                stroke="#94a3b8"
                style={{ fontSize: '12px' }}
                tick={{ fill: '#94a3b8' }}
                domain={yAxisDomain}
                tickFormatter={yAxisTickFormatter}
                label={
                  yAxisLabel
                    ? { value: yAxisLabel, position: 'insideBottomRight', offset: -5 }
                    : undefined
                }
              />
              <YAxis
                dataKey={xAxisKey}
                type="category"
                stroke="#94a3b8"
                style={{ fontSize: '12px' }}
                tick={{ fill: '#94a3b8' }}
                tickFormatter={xAxisTickFormatter}
                label={
                  xAxisLabel
                    ? { value: xAxisLabel, angle: -90, position: 'insideLeft' }
                    : undefined
                }
              />
            </>
          )}

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

          {series.map((s, idx) => (
            <Bar
              key={s.key}
              dataKey={s.dataKey}
              name={s.name}
              fill={typeof s.color === 'function' ? s.color(idx) : s.color}
              stackId={s.stackId}
            />
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}
