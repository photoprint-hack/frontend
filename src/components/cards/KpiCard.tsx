import { Link } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight, Minus, Info, TrendingDown, TrendingUp } from 'lucide-react';
import type { Kpi } from '@/types/api';
import { cn } from '@/lib/utils/cn';
import { Badge } from '@/components/ui/Badge';
import { METRIC_STATUS_LABELS, METRIC_STATUS_HINT } from '@/constants/metrics';
import { formatDateTime, formatPercent, formatSignedPercent, formatUnit } from '@/lib/formatters';

const STATUS_TONE = {
  normal: 'ok',
  warning: 'warn',
  critical: 'bad',
  no_data: 'idle',
} as const;

export function KpiCard({ kpi }: { kpi: Kpi }) {
  const tone = STATUS_TONE[kpi.status];
  const hasTarget = kpi.target !== null && kpi.target !== undefined;
  const progress =
    kpi.achievement_percent === null ? null : Math.max(0, Math.min(140, kpi.achievement_percent));
  const isLowerBetter = kpi.direction === 'lower_is_better';
  const goodDeviation = kpi.deviation_percent === null ? null : isLowerBetter ? kpi.deviation_percent <= 0 : kpi.deviation_percent >= 0;

  return (
    <Link
      to={`/metrics/${kpi.code}`}
      className={cn(
        'group relative flex flex-col gap-2.5 overflow-hidden rounded-xl border border-ink-700/80 bg-ink-900/70 p-3.5 shadow-card transition',
        'hover:border-accent-400/40 hover:bg-ink-850/80 hover:shadow-glow focus-visible:border-accent-400',
      )}
      aria-label={`${kpi.name}: ${formatUnit(kpi.actual, kpi.unit)}. ${METRIC_STATUS_LABELS[kpi.status]}`}
    >
      <span
        aria-hidden
        className={cn(
          'absolute inset-x-0 top-0 h-0.5',
          tone === 'ok' && 'bg-signal-ok/70',
          tone === 'warn' && 'bg-signal-warn/70',
          tone === 'bad' && 'bg-signal-bad/70',
          tone === 'idle' && 'bg-ink-500/70',
        )}
      />

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium uppercase tracking-[0.08em] text-ink-300">{kpi.name}</p>
          <p className="mt-1.5 truncate text-xl font-semibold leading-none tracking-tight text-ink-50">
            {formatUnit(kpi.actual, kpi.unit)}
          </p>
        </div>
        <Badge tone={tone} title={METRIC_STATUS_HINT[kpi.status]} dot className="mt-0.5 shrink-0">
          {METRIC_STATUS_LABELS[kpi.status]}
        </Badge>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="text-ink-400">
            План:{' '}
            <span className="font-medium text-ink-200">
              {hasTarget ? formatUnit(kpi.target, kpi.unit) : 'не задан'}
            </span>
          </span>
          {kpi.deviation_percent !== null && kpi.direction !== 'none' ? (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 font-medium',
                goodDeviation ? 'text-signal-ok' : 'text-signal-bad',
              )}
            >
              {kpi.deviation_percent > 0 ? (
                <ArrowUpRight className="h-3 w-3" aria-hidden />
              ) : kpi.deviation_percent < 0 ? (
                <ArrowDownRight className="h-3 w-3" aria-hidden />
              ) : (
                <Minus className="h-3 w-3" aria-hidden />
              )}
              {formatSignedPercent(kpi.deviation_percent)}
            </span>
          ) : (
            <span className="text-ink-500">—</span>
          )}
        </div>

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-700/70" role="presentation">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              tone === 'ok' && 'bg-signal-ok',
              tone === 'warn' && 'bg-signal-warn',
              tone === 'bad' && 'bg-signal-bad',
              tone === 'idle' && 'bg-ink-500',
            )}
            style={{ width: `${progress === null ? 0 : Math.min(100, progress)}%` }}
          />
        </div>

        <div className="flex items-center justify-between gap-2 text-[10px] text-ink-500">
          <span>
            Выполнение:{' '}
            <span className="text-ink-300">
              {kpi.achievement_percent === null ? '—' : formatPercent(kpi.achievement_percent)}
            </span>
          </span>
          {kpi.forecast !== null ? (
            <span className="inline-flex items-center gap-0.5 text-accent-300">
              <TrendingUp className="h-3 w-3" aria-hidden />
              прогноз {formatUnit(kpi.forecast, kpi.unit)}
            </span>
          ) : kpi.forecast_method === null && kpi.code === 'revenue' ? (
            <span className="inline-flex items-center gap-0.5" title="Прогноз недоступен для выбранного периода">
              <Info className="h-3 w-3" aria-hidden /> без прогноза
            </span>
          ) : (
            <span className="inline-flex items-center gap-0.5">
              <TrendingDown className="h-3 w-3" aria-hidden /> динамика по источнику
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-ink-800/80 pt-1.5 text-[10px] text-ink-500">
        <span className="truncate">Источник: {kpi.source.join(', ')}</span>
        <span className="shrink-0">{formatDateTime(kpi.updated_at)}</span>
      </div>

      {kpi.notices.length > 0 && (
        <p className="rounded-md bg-ink-800/60 px-2 py-1 text-[10px] leading-snug text-ink-400">
          {kpi.notices[0]}
        </p>
      )}
    </Link>
  );
}
