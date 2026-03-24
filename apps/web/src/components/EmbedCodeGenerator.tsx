import { useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

type WidgetType = 'price-ticker' | 'disruption-score' | 'price-trend';
type Grade = 'regular' | 'mid_grade' | 'premium' | 'diesel';

interface WidgetDef {
  label: string;
  description: string;
  defaultWidth: number;
  defaultHeight: number;
  supportsGrade: boolean;
}

const WIDGETS: Record<WidgetType, WidgetDef> = {
  'price-ticker': {
    label: 'Price Ticker',
    description: 'Current national average gas price for a selected grade.',
    defaultWidth: 240,
    defaultHeight: 160,
    supportsGrade: true,
  },
  'disruption-score': {
    label: 'Disruption Score',
    description: 'Live market disruption index (0–5 scale) with classification.',
    defaultWidth: 240,
    defaultHeight: 220,
    supportsGrade: false,
  },
  'price-trend': {
    label: '30-Day Price Trend',
    description: '30-day sparkline chart with latest price and % change.',
    defaultWidth: 300,
    defaultHeight: 160,
    supportsGrade: true,
  },
};

const GRADE_LABELS: Record<Grade, string> = {
  regular:   'Regular',
  mid_grade: 'Mid-Grade',
  premium:   'Premium',
  diesel:    'Diesel',
};

const SITE_URL =
  (typeof import.meta !== 'undefined' &&
    import.meta.env &&
    (import.meta.env as Record<string, string>).VITE_SITE_URL) ||
  'https://fuelripple.com';

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildSrc(widgetType: WidgetType, grade: Grade): string {
  const params = new URLSearchParams();
  if (WIDGETS[widgetType].supportsGrade) params.set('grade', grade);
  const qs = params.toString();
  return `${SITE_URL}/embed/${widgetType}${qs ? `?${qs}` : ''}`;
}

function buildIframeCode(src: string, width: number, height: number): string {
  return `<iframe
  src="${src}"
  width="${width}"
  height="${height}"
  style="border:none;border-radius:12px;overflow:hidden;"
  loading="lazy"
  title="FuelRipple Widget"
></iframe>`;
}

// ── CopyButton ────────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
        copied
          ? 'bg-green-700 text-green-200'
          : 'bg-slate-600 hover:bg-slate-500 text-slate-200'
      }`}
    >
      {copied ? (
        <>
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Copied!
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          Copy Code
        </>
      )}
    </button>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function EmbedCodeGenerator() {
  const [widgetType, setWidgetType] = useState<WidgetType>('price-ticker');
  const [grade, setGrade] = useState<Grade>('regular');

  const def = WIDGETS[widgetType];
  const src = buildSrc(widgetType, grade);
  const iframeCode = buildIframeCode(src, def.defaultWidth, def.defaultHeight);

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-700">
        <h2 className="text-lg font-semibold text-white">Embed FuelRipple Widgets</h2>
        <p className="text-sm text-slate-400 mt-1">
          Add live fuel data to any website with a single line of HTML.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-700">
        {/* Left: Controls */}
        <div className="p-5 space-y-5">
          {/* Widget selector */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">
              Widget Type
            </label>
            <div className="space-y-2">
              {(Object.keys(WIDGETS) as WidgetType[]).map(type => (
                <button
                  key={type}
                  onClick={() => setWidgetType(type)}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                    widgetType === type
                      ? 'border-blue-500 bg-blue-500/10 text-white'
                      : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  <div className="font-medium text-sm">{WIDGETS[type].label}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{WIDGETS[type].description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Grade selector (conditional) */}
          {def.supportsGrade && (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">
                Fuel Grade
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(GRADE_LABELS) as Grade[]).map(g => (
                  <button
                    key={g}
                    onClick={() => setGrade(g)}
                    className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                      grade === g
                        ? 'border-blue-500 bg-blue-500/10 text-white font-medium'
                        : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    {GRADE_LABELS[g]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Dimensions note */}
          <div className="text-xs text-slate-500">
            Recommended size: {def.defaultWidth}×{def.defaultHeight}px.
            You can adjust the <code className="text-slate-400">width</code> and{' '}
            <code className="text-slate-400">height</code> attributes as needed.
          </div>
        </div>

        {/* Right: Preview + code */}
        <div className="p-5 space-y-4">
          {/* Live preview */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">
              Preview
            </label>
            <div className="bg-slate-950 rounded-lg p-4 flex items-center justify-center">
              <iframe
                key={`${widgetType}-${grade}`}
                src={src}
                width={def.defaultWidth}
                height={def.defaultHeight}
                className="border-0 rounded-xl overflow-hidden block"
                title={`${WIDGETS[widgetType].label} preview`}
              />
            </div>
          </div>

          {/* Embed code */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                Embed Code
              </label>
              <CopyButton text={iframeCode} />
            </div>
            <pre className="bg-slate-950 rounded-lg p-3 text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap break-all font-mono border border-slate-800">
              {iframeCode}
            </pre>
          </div>

          {/* Attribution */}
          <p className="text-xs text-slate-500">
            Data updates automatically. Attribution to FuelRipple is built into the widget.
          </p>
        </div>
      </div>
    </div>
  );
}
