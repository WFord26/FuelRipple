export interface StoryCardData {
  id: string;
  title: string;
  insight: string;
  detail?: string;
  category: 'market' | 'supply' | 'event' | 'correlation';
  icon: string;
  color: 'blue' | 'amber' | 'red' | 'green' | 'slate';
  actionLabel?: string;
  onAction?: () => void;
  date?: string;
}

const colorVariants = {
  blue: 'bg-blue-500/15 border-blue-500/30 text-blue-400',
  amber: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
  red: 'bg-red-500/15 border-red-500/30 text-red-400',
  green: 'bg-green-500/15 border-green-500/30 text-green-400',
  slate: 'bg-slate-700/30 border-slate-600/50 text-slate-300',
};

const textColorMap = {
  blue: 'text-blue-300',
  amber: 'text-amber-300',
  red: 'text-red-300',
  green: 'text-green-300',
  slate: 'text-slate-200',
};

export default function StoryCard({
  title,
  insight,
  detail,
  category,
  icon,
  color,
  actionLabel,
  onAction,
  date,
}: StoryCardData) {
  return (
    <div
      className={`
        rounded-lg border p-4 transition-all duration-200
        hover:shadow-lg hover:border-opacity-60 cursor-pointer
        ${colorVariants[color]}
      `}
      role="article"
      onClick={onAction}
    >
      {/* Header with icon and category */}
      <div className="flex items-start gap-3 mb-3">
        <span className="text-2xl shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-bold text-white truncate">{title}</h3>
            <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-300 shrink-0">
              {category === 'market'
                ? 'Market'
                : category === 'supply'
                ? 'Supply'
                : category === 'event'
                ? 'Event'
                : 'Correlation'}
            </span>
          </div>
          {date && <div className="text-xs text-slate-500">{date}</div>}
        </div>
      </div>

      {/* Main insight */}
      <p className={`text-sm font-semibold mb-2 ${textColorMap[color]}`}>{insight}</p>

      {/* Supporting detail */}
      {detail && <p className="text-xs text-slate-400 mb-3 line-clamp-2">{detail}</p>}

      {/* Action button if provided */}
      {actionLabel && onAction && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAction();
          }}
          className="text-xs font-semibold text-slate-300 hover:text-white transition-colors mt-2 inline-flex items-center gap-1"
        >
          {actionLabel} →
        </button>
      )}
    </div>
  );
}
