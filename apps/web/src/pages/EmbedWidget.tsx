/**
 * EmbedWidget — minimal iframe-renderable page.
 * Route: /embed/:widgetType
 *
 * Supported widget types:
 *   price-ticker    — current national gas price
 *   disruption-score — disruption index badge
 *   price-trend     — 30-day sparkline
 *
 * Query params:
 *   grade   regular | mid_grade | premium | diesel  (default: regular)
 *   region  US | PADD1 | … (default: US, price-ticker only)
 */
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getAaaNationalLatest, getAaaNationalHistory, getDisruptionScore } from '../api/client';

// ── helpers ──────────────────────────────────────────────────────────────────

type Grade = 'regular' | 'mid_grade' | 'premium' | 'diesel';

const GRADE_LABELS: Record<Grade, string> = {
  regular:   'Regular',
  mid_grade: 'Mid-Grade',
  premium:   'Premium',
  diesel:    'Diesel',
};

function fmt(price: number | null | undefined): string {
  if (price == null) return '—';
  return `$${price.toFixed(3)}`;
}

// ── Sparkline SVG (no chart library) ─────────────────────────────────────────

function Sparkline({ values, width = 220, height = 48 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 0.01;
  const pad = 4;

  const points = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (v - min) / range) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const pathD = `M ${points.join(' L ')}`;

  // area fill
  const areaD = `M ${points[0]} L ${points.join(' L ')} L ${(width - pad).toFixed(1)},${height} L ${pad},${height} Z`;

  const lastX = parseFloat(points[points.length - 1].split(',')[0]);
  const lastY = parseFloat(points[points.length - 1].split(',')[1]);

  const latest = values[values.length - 1];
  const oldest = values[0];
  const trendUp = latest > oldest;

  const lineColor = trendUp ? '#f97316' : '#22c55e';
  const fillColor = trendUp ? 'rgba(249,115,22,0.12)' : 'rgba(34,197,94,0.12)';

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lineColor} stopOpacity="0.2" />
          <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#spark-fill)" />
      <path d={pathD} fill="none" stroke={lineColor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lastX} cy={lastY} r="3" fill={lineColor} />
    </svg>
  );
}

// ── Branding footer ───────────────────────────────────────────────────────────

function Branding() {
  return (
    <a
      href="https://fuelripple.com"
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-400 transition-colors"
    >
      <svg viewBox="0 0 16 16" width="12" height="12" fill="none">
        <circle cx="8" cy="8" r="7" stroke="#38bdf8" strokeWidth="1.5" />
        <path d="M5 10 Q8 5 11 10" stroke="#f97316" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      </svg>
      <span>FuelRipple</span>
    </a>
  );
}

// ── Widget: Price Ticker ──────────────────────────────────────────────────────

function PriceTickerWidget({ grade }: { grade: Grade }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['embed-aaa-latest'],
    queryFn: getAaaNationalLatest,
    staleTime: 5 * 60 * 1000,
  });

  const price = data?.[grade] ?? null;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 animate-pulse">
        <div className="h-10 w-24 bg-slate-700 rounded-lg" />
        <div className="h-4 w-16 bg-slate-800 rounded" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500 text-sm">
        Unavailable
      </div>
    );
  }

  const asOf = data.time
    ? new Date(data.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  return (
    <div className="flex flex-col items-center justify-center h-full gap-1 px-4 text-center">
      <div className="text-xs text-slate-400 font-medium tracking-wide uppercase">
        {GRADE_LABELS[grade]} · US Avg
      </div>
      <div className="text-4xl font-bold text-white tabular-nums leading-none">
        {fmt(price)}
      </div>
      <div className="text-xs text-slate-500">
        per gallon{asOf ? ` · ${asOf}` : ''}
      </div>
      <div className="mt-2">
        <Branding />
      </div>
    </div>
  );
}

// ── Widget: Disruption Score ──────────────────────────────────────────────────

function DisruptionScoreWidget() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['embed-disruption'],
    queryFn: () => getDisruptionScore('gas_regular', 'US'),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 animate-pulse">
        <div className="h-12 w-12 rounded-full bg-slate-700" />
        <div className="h-4 w-20 bg-slate-800 rounded" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500 text-sm">
        Unavailable
      </div>
    );
  }

  const score: number = data.score ?? 0;
  const cls: string = data.classification ?? 'normal';

  const clsColor =
    cls === 'normal'   ? { ring: 'ring-green-500',  text: 'text-green-400',  bg: 'bg-green-500/20'  } :
    cls === 'elevated' ? { ring: 'ring-yellow-400', text: 'text-yellow-400', bg: 'bg-yellow-400/20' } :
    cls === 'high'     ? { ring: 'ring-orange-500', text: 'text-orange-400', bg: 'bg-orange-500/20' } :
                         { ring: 'ring-red-500',    text: 'text-red-400',    bg: 'bg-red-500/20'    };

  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 px-4 text-center">
      <div className="text-xs text-slate-400 font-medium tracking-wide uppercase">
        Disruption Index
      </div>
      <div className={`w-20 h-20 rounded-full flex flex-col items-center justify-center ring-2 ${clsColor.ring} ${clsColor.bg}`}>
        <span className={`text-2xl font-bold tabular-nums leading-none ${clsColor.text}`}>
          {score.toFixed(2)}
        </span>
        <span className="text-xs text-slate-400 mt-0.5">/ 5</span>
      </div>
      <div className={`px-3 py-1 rounded-full text-xs font-semibold ${clsColor.bg} ${clsColor.text}`}>
        {cls.toUpperCase()}
      </div>
      <Branding />
    </div>
  );
}

// ── Widget: Price Trend ───────────────────────────────────────────────────────

function PriceTrendWidget({ grade }: { grade: Grade }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['embed-aaa-history-30'],
    queryFn: () => getAaaNationalHistory(30),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col h-full gap-3 p-4 animate-pulse">
        <div className="h-4 w-28 bg-slate-700 rounded" />
        <div className="flex-1 bg-slate-800 rounded" />
      </div>
    );
  }

  if (isError || !data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500 text-sm">
        Unavailable
      </div>
    );
  }

  // History comes newest-first; reverse for left-to-right chart
  const reversed = [...data].reverse();
  const values = reversed.map(d => d[grade] ?? 0).filter(v => v > 0);
  const latest = values[values.length - 1];
  const oldest = values[0];
  const delta = latest - oldest;
  const deltaPct = oldest > 0 ? (delta / oldest) * 100 : 0;
  const trendUp = delta > 0;

  const asOf = data[0]?.time
    ? new Date(data[0].time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  return (
    <div className="flex flex-col h-full px-3 py-3 gap-1">
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-400 font-medium">{GRADE_LABELS[grade]} · 30-day</div>
        <div className={`text-xs font-semibold ${trendUp ? 'text-orange-400' : 'text-green-400'}`}>
          {trendUp ? '+' : ''}{deltaPct.toFixed(1)}%
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-white tabular-nums">{fmt(latest)}</span>
        {asOf && <span className="text-xs text-slate-500">{asOf}</span>}
      </div>
      <div className="flex-1 flex items-end">
        <Sparkline values={values} width={220} height={52} />
      </div>
      <div className="flex justify-end mt-1">
        <Branding />
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

const WIDGET_TYPES = ['price-ticker', 'disruption-score', 'price-trend'] as const;
type WidgetType = typeof WIDGET_TYPES[number];

export default function EmbedWidget() {
  const { widgetType } = useParams<{ widgetType: string }>();
  const [searchParams] = useSearchParams();

  const grade = (searchParams.get('grade') ?? 'regular') as Grade;

  const isValid = WIDGET_TYPES.includes(widgetType as WidgetType);

  return (
    <div className="w-full h-screen flex flex-col bg-slate-950">
      {!isValid ? (
        <div className="flex items-center justify-center h-full text-slate-500 text-sm">
          Unknown widget type
        </div>
      ) : widgetType === 'price-ticker' ? (
        <PriceTickerWidget grade={grade} />
      ) : widgetType === 'disruption-score' ? (
        <DisruptionScoreWidget />
      ) : (
        <PriceTrendWidget grade={grade} />
      )}
    </div>
  );
}
