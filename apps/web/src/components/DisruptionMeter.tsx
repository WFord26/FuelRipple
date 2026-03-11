import { Chart, Settings, Bullet, BulletSubtype, DARK_THEME } from '@elastic/charts';
import '@elastic/charts/dist/theme_dark.css';

interface DisruptionMeterProps {
  score: number;
  classification: 'normal' | 'elevated' | 'high' | 'crisis';
}

const colorBands = [
  { gte: 0, lt: 1,  color: '#22c55e' },
  { gte: 1, lt: 2,  color: '#eab308' },
  { gte: 2, lt: 3,  color: '#f97316' },
  { gte: 3, lte: 5, color: '#ef4444' },
];

const gaugeTheme = {
  ...DARK_THEME,
  background: { color: '#1e293b' },
};

export default function DisruptionMeter({ score, classification }: DisruptionMeterProps) {
  const clampedScore = Math.min(Math.max(score, 0), 5);

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Elastic Charts half-circle bullet gauge */}
      <div className="w-full max-w-sm">
        <Chart size={{ height: 220 }}>
          <Settings theme={gaugeTheme} showLegend={false} />
          <Bullet
            id="disruption-gauge"
            subtype={BulletSubtype.halfCircle}
            data={[[{
              title: 'Disruption Score',
              value: clampedScore,
              domain: [0, 5],
              ticks: [0, 1, 2, 3, 4, 5],
              valueFormatter: (v: number) => v.toFixed(2),
              tickFormatter: (v: number) => String(v),
            }]]}
            colorBands={colorBands}
          />
        </Chart>
      </div>

      {/* Classification badge */}
      <div className={`inline-block px-5 py-2 rounded-lg text-base font-bold ${
        classification === 'normal'   ? 'bg-green-500/20  text-green-400'  :
        classification === 'elevated' ? 'bg-yellow-400/20 text-yellow-400' :
        classification === 'high'     ? 'bg-orange-500/20 text-orange-400' :
                                        'bg-red-500/20    text-red-400'
      }`}>
        {classification.toUpperCase()} &mdash; {score.toFixed(2)}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-slate-300">Normal (&lt;1)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <span className="text-slate-300">Elevated (1–2)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-orange-500" />
          <span className="text-slate-300">High (2–3)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-slate-300">Crisis (3+)</span>
        </div>
      </div>
    </div>
  );
}
