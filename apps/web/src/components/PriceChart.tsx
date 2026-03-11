import {
  Chart,
  Settings,
  LineSeries,
  Axis,
  DARK_THEME,
  ScaleType,
  Position,
  niceTimeFormatter,
  LineAnnotation,
  AnnotationDomainType,
} from '@elastic/charts';
import '@elastic/charts/dist/theme_dark.css';

export interface PriceDataPoint {
  time: string;
  value: number;
}

export interface EventMarker {
  time: string;
  position: 'aboveBar' | 'belowBar' | 'inBar';
  color: string;
  shape: 'circle' | 'arrowUp' | 'arrowDown';
  text: string;
}

export interface ChartSeries {
  id: string;
  name: string;
  color: string;
  data: PriceDataPoint[];
}

interface PriceChartProps {
  data?: PriceDataPoint[];
  series?: ChartSeries[];
  title?: string;
  height?: number;
  events?: EventMarker[];
  showVolume?: boolean;
}

// Extend DARK_THEME to match slate-800 background and slate grid lines
const chartTheme = {
  ...DARK_THEME,
  background: { color: '#1e293b' },
  axes: {
    ...DARK_THEME.axes,
    gridLine: {
      horizontal: { stroke: '#334155', strokeWidth: 1, dash: [3, 3] },
      vertical: { stroke: '#334155', strokeWidth: 1, dash: [3, 3] },
    },
  },
};

export function PriceChart({ data, series, title, height = 400, events = [] }: PriceChartProps) {
  // Resolve series list — either from multi-series prop or from the legacy single-series data prop
  const allSeries: ChartSeries[] = series && series.length > 0
    ? series
    : data
      ? [{ id: 'price-line', name: 'Price', color: '#3b82f6', data }]
      : [];

  // Compute global time domain across all series
  const allTimes = allSeries.flatMap(s =>
    s.data.map(d => new Date(d.time).getTime()).filter(t => !isNaN(t))
  );
  const domainRange: [number, number] =
    allTimes.length > 1
      ? [Math.min(...allTimes), Math.max(...allTimes)]
      : [Date.now() - 86_400_000 * 365, Date.now()];

  // Deduplicate event annotations by timestamp
  const annotationData = Array.from(
    new Map(
      events.map(e => [
        new Date(e.time).getTime(),
        { dataValue: new Date(e.time).getTime(), header: e.text, details: e.text },
      ])
    ).values()
  );

  return (
    <div className="w-full">
      {title && <h3 className="text-lg font-semibold text-white mb-3">{title}</h3>}
      <Chart size={{ height }}>
        <Settings
          theme={chartTheme}
          showLegend={allSeries.length > 1}
          legendPosition={Position.Bottom}
        />
        <Axis
          id="x-axis"
          position={Position.Bottom}
          tickFormat={niceTimeFormatter(domainRange)}
          style={{
            tickLabel: { fill: '#94a3b8', fontSize: 11 },
            axisLine: { stroke: '#475569' },
            tickLine: { stroke: '#475569' },
          }}
        />
        <Axis
          id="y-axis"
          position={Position.Left}
          tickFormat={(d) => `$${Number(d).toFixed(2)}`}
          style={{
            tickLabel: { fill: '#94a3b8', fontSize: 11 },
            axisLine: { stroke: '#475569' },
            tickLine: { stroke: '#475569' },
          }}
        />
        {allSeries.map(s => {
          const formatted = s.data
            .map(d => ({ x: new Date(d.time).getTime(), y: d.value }))
            .filter(d => !isNaN(d.x) && d.y != null)
            .sort((a, b) => a.x - b.x);
          return (
            <LineSeries
              key={s.id}
              id={s.id}
              name={s.name}
              data={formatted}
              xAccessor="x"
              yAccessors={['y']}
              xScaleType={ScaleType.Time}
              yScaleType={ScaleType.Linear}
              color={s.color}
              lineSeriesStyle={{
                line: { strokeWidth: 2 },
                point: { radius: 0, opacity: 0 },
              }}
            />
          );
        })}
        {annotationData.length > 0 && (
          <LineAnnotation
            id="event-markers"
            domainType={AnnotationDomainType.XDomain}
            dataValues={annotationData}
            style={{
              line: { stroke: '#f59e0b', strokeWidth: 1, opacity: 0.7, dash: [4, 2] },
            }}
          />
        )}
      </Chart>
    </div>
  );
}
