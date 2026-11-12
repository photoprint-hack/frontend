import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Database,
  LineChart,
  Minus,
  Table2,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { GlobalFilters } from '@/components/filters/GlobalFilters';
import { useFilters } from '@/components/filters/FiltersContext';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/tables/DataTable';
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback/States';
import { metricsApi } from '@/lib/api/endpoints';
import { toApiError } from '@/lib/api/client';
import { METRIC_STATUS_HINT, METRIC_STATUS_LABELS } from '@/constants/metrics';
import { CHANNEL_LABELS, SOURCE_LABELS } from '@/constants/labels';
import {
  formatDate,
  formatDateTime,
  formatPercent,
  formatShortDate,
  formatSignedPercent,
  formatUnit,
} from '@/lib/formatters';
import { cn } from '@/lib/utils/cn';
import type { MetricStatus } from '@/types/api';

const STATUS_TONE: Record<MetricStatus, 'ok' | 'warn' | 'bad' | 'idle'> = {
  normal: 'ok',
  warning: 'warn',
  critical: 'bad',
  no_data: 'idle',
};

const GROUP_LABELS: Record<string, string> = {
  department: 'По подразделениям',
  product: 'По продуктам',
  order: 'По заказам',
  channel: 'По каналам',
  campaign: 'По кампаниям',
  cause: 'По причинам',
};

const INTERVALS: { code: 'day' | 'week' | 'month'; label: string }[] = [
  { code: 'day', label: 'День' },
  { code: 'week', label: 'Неделя' },
  { code: 'month', label: 'Месяц' },
];

/** Простой SVG-график без сторонних библиотек: линия факта + пунктир плана. */
function HistoryChart({
  points,
  unit,
}: {
  points: { period_start: string; actual: number | null; target: number | null }[];
  unit: string;
}) {
  const width = 720;
  const height = 200;
  const padding = { top: 12, right: 12, bottom: 22, left: 12 };
  const values = points.flatMap((point) => [point.actual, point.target]).filter((value): value is number => value !== null);
  if (values.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-lg border border-ink-700/60 bg-ink-850/40 text-xs text-ink-400">
        Нет числовых значений для построения графика
      </div>
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || Math.abs(max) || 1;
  const stepX = points.length > 1 ? (width - padding.left - padding.right) / (points.length - 1) : 0;
  const y = (value: number) =>
    height - padding.bottom - ((value - min) / span) * (height - padding.top - padding.bottom);
  const x = (index: number) => padding.left + index * stepX;

  const actualPath = points
    .map((point, index) =>
      point.actual === null ? null : `${index === 0 || points[index - 1]?.actual === null ? 'M' : 'L'}${x(index).toFixed(1)},${y(point.actual).toFixed(1)}`,
    )
    .filter(Boolean)
    .join(' ');

  const targetPath = points
    .map((point, index) =>
      point.target === null ? null : `${index === 0 || points[index - 1]?.target === null ? 'M' : 'L'}${x(index).toFixed(1)},${y(point.target).toFixed(1)}`,
    )
    .filter(Boolean)
    .join(' ');

  return (
    <div className="rounded-lg border border-ink-700/60 bg-ink-850/40 p-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[200px] w-full" role="img" aria-label="Динамика показателя">
        <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke="#242c3d" />
        <path d={targetPath} fill="none" stroke="#6b7893" strokeWidth="1.5" strokeDasharray="5 4" />
        <path d={actualPath} fill="none" stroke="#2cc5b0" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((point, index) =>
          point.actual === null ? null : (
            <circle key={point.period_start} cx={x(index)} cy={y(point.actual)} r="2.5" fill="#57dbc5" />
          ),
        )}
        {points.length > 1 && (
          <>
            <text x={padding.left} y={height - 6} fontSize="9" fill="#6b7893">
              {formatShortDate(points[0]?.period_start)}
            </text>
            <text x={width - padding.right} y={height - 6} fontSize="9" fill="#6b7893" textAnchor="end">
              {formatShortDate(points[points.length - 1]?.period_start)}
            </text>
          </>
        )}
      </svg>
      <div className="flex items-center gap-4 px-2 pb-1 text-[0.625rem] text-ink-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-accent-400" /> факт ({unit})
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-ink-300" style={{ borderTop: '1px dashed' }} /> план
        </span>
        <span className="ml-auto">точек: {points.length}</span>
      </div>
    </div>
  );
}

export function MetricDetailPage() {
  const { code } = useParams<{ code: string }>();
  const { queryParams } = useFilters();
  const [interval, setInterval] = useState<'day' | 'week' | 'month'>('week');
  const [groupBy, setGroupBy] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const metric = useQuery({
    queryKey: ['metric', code, queryParams],
    queryFn: async () => (await metricsApi.get(code as string, queryParams)).data,
    enabled: Boolean(code),
  });

  const history = useQuery({
    queryKey: ['metric-history', code, queryParams, interval],
    queryFn: async () => metricsApi.history(code as string, { ...queryParams, interval, page_size: 120 }),
    enabled: Boolean(code),
  });

  const effectiveGroupBy = groupBy ?? metric.data?.supported_group_by[0] ?? 'department';

  const breakdown = useQuery({
    queryKey: ['metric-breakdown', code, queryParams, effectiveGroupBy, page],
    queryFn: async () =>
      metricsApi.breakdown(code as string, { ...queryParams, group_by: effectiveGroupBy, page, page_size: 15 }),
    enabled: Boolean(code) && Boolean(metric.data),
  });

  if (metric.isLoading) return <LoadingState label="Загружаем показатель…" />;
  if (metric.error) {
    return <ErrorState message={toApiError(metric.error).message} onRetry={() => void metric.refetch()} />;
  }

  const kpi = metric.data;
  if (!kpi) return null;

  const tone = STATUS_TONE[kpi.status];
  const goodDeviation =
    kpi.deviation_percent === null
      ? null
      : kpi.direction === 'lower_is_better'
        ? kpi.deviation_percent <= 0
        : kpi.deviation_percent >= 0;

  return (
    <div className="space-y-4">
      <PageHeader
        title={kpi.name}
        description={kpi.description ?? undefined}
        meta={
          <>
            <Badge tone={tone} dot title={METRIC_STATUS_HINT[kpi.status]}>
              {METRIC_STATUS_LABELS[kpi.status]}
            </Badge>
            <Badge tone="idle">
              {formatDate(kpi.context.date_from)} — {formatDate(kpi.context.date_to)}
            </Badge>
            <Badge tone="info">{kpi.formula_version}</Badge>
            {kpi.context.ignored_filters.length > 0 && (
              <Badge tone="warn">Фильтры проигнорированы: {kpi.context.ignored_filters.join(', ')}</Badge>
            )}
          </>
        }
        actions={
          <>
            <Link to="/dashboard">
              <Button variant="ghost" size="sm" icon={<ArrowLeft className="h-3.5 w-3.5" />}>
                К обзору
              </Button>
            </Link>
            {kpi.status === 'critical' && (
              <Link to={`/alerts?status=active`}>
                <Button variant="danger" size="sm" icon={<AlertTriangle className="h-3.5 w-3.5" />}>
                  Отклонения по показателю
                </Button>
              </Link>
            )}
          </>
        }
      />

      <GlobalFilters />

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 xl:grid-cols-5">
        <div className="rounded-lg border border-ink-700/70 bg-ink-850/60 p-3">
          <p className="text-[0.6875rem] uppercase tracking-[0.08em] text-ink-400">Факт</p>
          <p className="mt-1 truncate text-lg font-semibold leading-none text-ink-50">{formatUnit(kpi.actual, kpi.unit)}</p>
        </div>
        <div className="rounded-lg border border-ink-700/70 bg-ink-850/60 p-3">
          <p className="text-[0.6875rem] uppercase tracking-[0.08em] text-ink-400">План</p>
          <p className="mt-1 truncate text-lg font-semibold leading-none text-ink-50">{formatUnit(kpi.target, kpi.unit)}</p>
        </div>
        <div className="rounded-lg border border-ink-700/70 bg-ink-850/60 p-3">
          <p className="text-[0.6875rem] uppercase tracking-[0.08em] text-ink-400">Выполнение</p>
          <p className="mt-1 truncate text-lg font-semibold leading-none text-ink-50">
            {formatPercent(kpi.achievement_percent)}
          </p>
        </div>
        <div className="rounded-lg border border-ink-700/70 bg-ink-850/60 p-3">
          <p className="text-[0.6875rem] uppercase tracking-[0.08em] text-ink-400">Отклонение</p>
          <p
            className={cn(
              'mt-1 flex items-center gap-1 truncate text-lg font-semibold leading-none',
              goodDeviation === null ? 'text-ink-300' : goodDeviation ? 'text-signal-ok' : 'text-signal-bad',
            )}
          >
            {kpi.deviation_percent === null ? (
              <Minus className="h-4 w-4" />
            ) : kpi.deviation_percent > 0 ? (
              <ArrowUpRight className="h-4 w-4" />
            ) : (
              <ArrowDownRight className="h-4 w-4" />
            )}
            {formatSignedPercent(kpi.deviation_percent)}
          </p>
        </div>
        <div className="rounded-lg border border-ink-700/70 bg-ink-850/60 p-3">
          <p className="text-[0.6875rem] uppercase tracking-[0.08em] text-ink-400">Прогноз</p>
          <p className="mt-1 truncate text-lg font-semibold leading-none text-accent-300">
            {formatUnit(kpi.forecast, kpi.unit)}
          </p>
          <p className="mt-1 text-[0.625rem] text-ink-500">{kpi.forecast_method ?? 'метод не применялся'}</p>
        </div>
      </div>

      {kpi.reason && (
        <div className="flex items-start gap-2 rounded-lg border border-signal-warn/40 bg-signal-warn/10 p-3 text-[0.6875rem] leading-relaxed text-ink-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-signal-warn" aria-hidden />
          <p>
            <span className="font-semibold text-signal-warn">Причина статуса:</span> {kpi.reason}
            {kpi.reason_code && <span className="ml-1 font-mono text-[0.625rem] text-ink-400">({kpi.reason_code})</span>}
          </p>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2 p-0">
          <div className="p-4 pb-0">
            <CardHeader
              title="Динамика показателя"
              subtitle="Значения рассчитаны Backend по каждому интервалу"
              icon={<LineChart className="h-4 w-4" />}
              action={
                <div className="flex gap-1">
                  {INTERVALS.map((item) => (
                    <Button
                      key={item.code}
                      size="sm"
                      variant={interval === item.code ? 'primary' : 'ghost'}
                      onClick={() => setInterval(item.code)}
                    >
                      {item.label}
                    </Button>
                  ))}
                </div>
              }
            />
          </div>
          <div className="p-4">
            {history.isLoading && <p className="py-10 text-center text-xs text-ink-400">Строим историю…</p>}
            {history.error && (
              <ErrorState
                title="История недоступна"
                message={toApiError(history.error).message}
                onRetry={() => void history.refetch()}
              />
            )}
            {history.data && (
              <>
                <HistoryChart points={history.data.items} unit={kpi.unit} />
                <div className="mt-3 max-h-64 overflow-auto">
                  <table className="table-shell min-w-full">
                    <thead>
                      <tr>
                        <th>Период</th>
                        <th className="text-right">Факт</th>
                        <th className="text-right">План</th>
                        <th>Статус</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...history.data.items].reverse().map((point) => (
                        <tr key={point.period_start}>
                          <td className="whitespace-nowrap text-[0.6875rem] text-ink-300">
                            {formatDate(point.period_start)} — {formatDate(point.period_end)}
                          </td>
                          <td className="whitespace-nowrap text-right text-xs">{formatUnit(point.actual, kpi.unit)}</td>
                          <td className="whitespace-nowrap text-right text-xs text-ink-300">
                            {formatUnit(point.target, kpi.unit)}
                          </td>
                          <td>
                            <Badge tone={STATUS_TONE[point.status]}>{METRIC_STATUS_LABELS[point.status]}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Методика расчёта" subtitle="Формула и источники" icon={<BookOpen className="h-4 w-4" />} />
          <dl className="space-y-3 text-[0.6875rem]">
            <div>
              <dt className="text-[0.625rem] uppercase tracking-[0.08em] text-ink-400">Формула</dt>
              <dd className="mt-0.5 rounded-md bg-ink-850/60 p-2 font-mono text-[0.625rem] leading-relaxed text-ink-200">
                {kpi.formula}
              </dd>
            </div>
            <div>
              <dt className="text-[0.625rem] uppercase tracking-[0.08em] text-ink-400">Источники</dt>
              <dd className="mt-0.5 flex flex-wrap gap-1">
                {kpi.source.map((source) => (
                  <Badge key={source} tone="info">
                    {SOURCE_LABELS[source] ?? source}
                  </Badge>
                ))}
              </dd>
            </div>
            <div>
              <dt className="text-[0.625rem] uppercase tracking-[0.08em] text-ink-400">Категория</dt>
              <dd className="mt-0.5 text-ink-200">{kpi.category}</dd>
            </div>
            <div>
              <dt className="text-[0.625rem] uppercase tracking-[0.08em] text-ink-400">Направление</dt>
              <dd className="mt-0.5 text-ink-200">
                {kpi.direction === 'higher_is_better'
                  ? 'Чем выше, тем лучше'
                  : kpi.direction === 'lower_is_better'
                    ? 'Чем ниже, тем лучше'
                    : kpi.direction === 'range'
                      ? 'Допустимый коридор'
                      : 'Без оценки направления'}
              </dd>
            </div>
            <div>
              <dt className="text-[0.625rem] uppercase tracking-[0.08em] text-ink-400">Данные источника</dt>
              <dd className="mt-0.5 text-ink-200">{formatDateTime(kpi.source_updated_at)}</dd>
            </div>
            <div>
              <dt className="text-[0.625rem] uppercase tracking-[0.08em] text-ink-400">Расчёт выполнен</dt>
              <dd className="mt-0.5 text-ink-200">{formatDateTime(kpi.updated_at)}</dd>
            </div>
          </dl>
          {kpi.notices.length > 0 && (
            <ul className="mt-3 space-y-1 border-t border-ink-800/80 pt-2">
              {kpi.notices.map((notice) => (
                <li key={notice} className="text-[0.625rem] leading-relaxed text-ink-400">
                  • {notice}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="p-0">
        <div className="p-4 pb-0">
          <CardHeader
            title="Детализация"
            subtitle={
              kpi.supported_group_by.length > 0
                ? 'Разрезы, поддерживаемые формулой показателя'
                : 'Для этого показателя детализация не предусмотрена'
            }
            icon={<Table2 className="h-4 w-4" />}
            action={
              kpi.supported_group_by.length > 0 ? (
                <select
                  value={effectiveGroupBy}
                  onChange={(event) => {
                    setGroupBy(event.target.value);
                    setPage(1);
                  }}
                  aria-label="Разрез детализации"
                  className="h-8 rounded-md border border-ink-600 bg-ink-850 px-2 text-xs text-ink-100"
                >
                  {kpi.supported_group_by.map((code) => (
                    <option key={code} value={code}>
                      {GROUP_LABELS[code] ?? code}
                    </option>
                  ))}
                </select>
              ) : null
            }
          />
        </div>

        {kpi.supported_group_by.length === 0 ? (
          <EmptyState
            title="Детализация недоступна"
            description="Показатель агрегируется на уровне компании и не поддерживает группировку."
            icon={<Database className="h-5 w-5" />}
          />
        ) : (
          <>
            {breakdown.isLoading && <p className="py-8 text-center text-xs text-ink-400">Загрузка детализации…</p>}
            {breakdown.error && (
              <ErrorState
                title="Детализация недоступна"
                message={toApiError(breakdown.error).message}
                onRetry={() => void breakdown.refetch()}
              />
            )}
            {breakdown.data && breakdown.data.items.length === 0 && (
              <EmptyState title="Нет строк" description="В выбранном разрезе нет данных за период." />
            )}
            {breakdown.data && breakdown.data.items.length > 0 && (
              <div className="overflow-x-auto">
                <table className="table-shell min-w-[860px]">
                  <thead>
                    <tr>
                      <th>{GROUP_LABELS[effectiveGroupBy] ?? effectiveGroupBy}</th>
                      <th className="text-right">Факт</th>
                      <th className="text-right">План</th>
                      <th className="text-right">Отклонение</th>
                      <th className="text-right">Записей источника</th>
                      <th>Причина</th>
                      <th>Связи</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdown.data.items.map((row) => (
                      <tr key={row.key}>
                        <td className="text-xs font-medium text-ink-100">
                          {effectiveGroupBy === 'channel' ? CHANNEL_LABELS[row.name] ?? row.name : row.name}
                        </td>
                        <td className="whitespace-nowrap text-right text-xs">{formatUnit(row.actual, kpi.unit)}</td>
                        <td className="whitespace-nowrap text-right text-xs text-ink-300">
                          {formatUnit(row.target, kpi.unit)}
                        </td>
                        <td
                          className={cn(
                            'whitespace-nowrap text-right text-xs',
                            row.deviation_percent === null
                              ? 'text-ink-500'
                              : row.deviation_percent < 0
                                ? 'text-signal-bad'
                                : 'text-signal-ok',
                          )}
                        >
                          {formatSignedPercent(row.deviation_percent)}
                        </td>
                        <td className="text-right text-xs text-ink-300">{row.source_records_count}</td>
                        <td className="max-w-[220px] text-[0.6875rem] text-ink-300">
                          {row.cause ?? <span className="text-ink-500">—</span>}
                          {row.cause_status === 'requires_review' && (
                            <Badge tone="warn" className="ml-1">
                              проверить
                            </Badge>
                          )}
                        </td>
                        <td className="text-[0.6875rem]">
                          {row.links.length === 0 ? (
                            <span className="text-ink-500">—</span>
                          ) : (
                            row.links.map((link) => (
                              <Link
                                key={`${link.object_type}-${link.object_id}`}
                                to={link.object_type === 'order' ? `/orders/${link.object_id}` : '#'}
                                className="link-quiet"
                              >
                                {link.label}
                              </Link>
                            ))
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {breakdown.data && (
              <Pagination
                page={breakdown.data.page}
                pages={breakdown.data.pages}
                total={breakdown.data.total}
                pageSize={breakdown.data.page_size}
                onPageChange={setPage}
              />
            )}
          </>
        )}
      </Card>

      <p className="px-1 text-[0.6875rem] text-ink-500">
        Контекст: {formatDate(kpi.context.date_from)} — {formatDate(kpi.context.date_to)}, часовой пояс{' '}
        {kpi.context.timezone}. Все расчёты выполняются на стороне Backend; интерфейс не пересчитывает значения.
      </p>
    </div>
  );
}
