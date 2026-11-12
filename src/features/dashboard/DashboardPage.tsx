import { Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  ArrowRight,
  CheckCircle2,
  ChevronUp,
  CircleSlash,
  Clock,
  Info,
  ListChecks,
  Minus,
  ShieldCheck,
  FileText,
  BarChart3,
  Calculator,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { GlobalFilters } from '@/components/filters/GlobalFilters';
import { useFilters } from '@/components/filters/FiltersContext';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CardSkeletonGrid, EmptyState, ErrorState } from '@/components/feedback/States';
import { dashboardApi } from '@/lib/api/endpoints';
import { toApiError } from '@/lib/api/client';
import {
  ALERT_STATUS_LABELS,
  ALERT_STATUS_TONES,
  DECISION_STATUS_LABELS,
  DECISION_STATUS_TONES,
  PRIORITY_LABELS,
  PRIORITY_TONES,
  TASK_STATUS_LABELS,
  TASK_STATUS_TONES,
} from '@/constants/labels';
import { formatDate, formatDateTime, formatPercent, formatSignedPercent, formatUnit, formatDaysLeft } from '@/lib/formatters';
import { cn } from '@/lib/utils/cn';
import { METRIC_STATUS_LABELS } from '@/constants/metrics';
import type { Alert, Decision, Kpi, Task } from '@/types/api';

const KPI_TONE = {
  normal: { line: 'bg-signal-ok', text: 'text-signal-ok', soft: 'bg-signal-ok/10' },
  warning: { line: 'bg-signal-warn', text: 'text-signal-warn', soft: 'bg-signal-warn/10' },
  critical: { line: 'bg-signal-bad', text: 'text-signal-bad', soft: 'bg-signal-bad/10' },
  no_data: { line: 'bg-ink-500', text: 'text-ink-400', soft: 'bg-ink-700/50' },
} as const;

function KpiTableRow({ kpi }: { kpi: Kpi }) {
  const tone = KPI_TONE[kpi.status];
  const progress = kpi.achievement_percent === null ? null : Math.max(0, Math.min(100, kpi.achievement_percent));
  const goodDeviation = kpi.deviation_percent === null
    ? null
    : kpi.direction === 'lower_is_better'
      ? kpi.deviation_percent <= 0
      : kpi.deviation_percent >= 0;

  return (
    <tr className="group border-l-2 border-l-transparent transition hover:border-l-accent-400 hover:bg-ink-800/35">
      <td className="min-w-[220px]">
        <Link to={`/metrics/${kpi.code}`} className="block min-w-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400">
          <span className="flex items-center gap-2">
            <span aria-hidden className={cn('h-2 w-2 shrink-0 rounded-full', tone.line)} />
            <span className="font-medium text-ink-50 group-hover:text-accent-200">{kpi.name}</span>
          </span>
          <span className={cn('ml-4 mt-1 inline-flex rounded-full px-2 py-0.5 text-[0.625rem] font-medium', tone.soft, tone.text)}>
            {METRIC_STATUS_LABELS[kpi.status]}
          </span>
          {kpi.notices.length > 0 && <span className="ml-2 text-[0.625rem] text-ink-400">{kpi.notices[0]}</span>}
        </Link>
      </td>
      <td className="whitespace-nowrap font-semibold text-ink-50">{formatUnit(kpi.actual, kpi.unit)}</td>
      <td className="whitespace-nowrap text-ink-300">{kpi.target === null ? 'Не задан' : formatUnit(kpi.target, kpi.unit)}</td>
      <td className="whitespace-nowrap">
        {kpi.deviation_percent === null || kpi.direction === 'none' ? (
          <span className="text-ink-500">—</span>
        ) : (
          <span className={cn('inline-flex items-center gap-1 font-medium', goodDeviation ? 'text-signal-ok' : 'text-signal-bad')}>
            {kpi.deviation_percent > 0 ? <ArrowUpRight className="h-3.5 w-3.5" aria-hidden /> : kpi.deviation_percent < 0 ? <ArrowDownRight className="h-3.5 w-3.5" aria-hidden /> : <Minus className="h-3.5 w-3.5" aria-hidden />}
            {formatSignedPercent(kpi.deviation_percent)}
          </span>
        )}
      </td>
      <td className="min-w-[150px]">
        <div className="flex items-center gap-2">
          <span className="w-12 shrink-0 text-ink-300">{kpi.achievement_percent === null ? '—' : formatPercent(kpi.achievement_percent)}</span>
          <div className="h-1.5 min-w-16 flex-1 overflow-hidden rounded-full bg-ink-700" aria-hidden>
            <div className={cn('h-full rounded-full', tone.line)} style={{ width: `${progress ?? 0}%` }} />
          </div>
        </div>
      </td>
      <td className="min-w-[180px] text-[0.6875rem] text-ink-300">
        {kpi.forecast !== null ? (
          <span className="inline-flex items-center gap-1 text-accent-300"><TrendingUp className="h-3.5 w-3.5" aria-hidden /> Прогноз {formatUnit(kpi.forecast, kpi.unit)}</span>
        ) : kpi.forecast_method === null && kpi.code === 'revenue' ? (
          <span className="inline-flex items-center gap-1" title="Прогноз недоступен для выбранного периода"><Info className="h-3.5 w-3.5" aria-hidden /> Без прогноза</span>
        ) : (
          <span className="inline-flex items-center gap-1"><TrendingDown className="h-3.5 w-3.5" aria-hidden /> Динамика по источнику</span>
        )}
      </td>
      <td className="min-w-[150px] text-[0.6875rem] text-ink-400">{kpi.source.join(', ') || '—'}</td>
      <td className="whitespace-nowrap text-[0.6875rem] text-ink-400">{formatDateTime(kpi.updated_at)}</td>
    </tr>
  );
}

function StatTile({
  label,
  value,
  tone,
  icon,
  to,
}: {
  label: string;
  value: number;
  tone: 'bad' | 'warn' | 'accent' | 'ok';
  icon: React.ReactNode;
  to: string;
}) {
  const toneClass = {
    bad: 'text-signal-bad border-signal-bad/30 bg-signal-bad/8',
    warn: 'text-signal-warn border-signal-warn/30 bg-signal-warn/8',
    accent: 'text-accent-300 border-accent-400/30 bg-accent-500/8',
    ok: 'text-signal-ok border-signal-ok/30 bg-signal-ok/8',
  }[tone];

  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-xl border border-ink-700/80 bg-ink-900/60 p-3 transition hover:border-accent-400/40 hover:bg-ink-850/70"
    >
      <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg border', toneClass)}>{icon}</span>
      <div className="min-w-0">
        <p className="text-lg font-semibold leading-none text-ink-50">{value}</p>
        <p className="mt-1 text-[0.625rem] leading-snug text-ink-300 line-clamp-2">{label}</p>
      </div>
      <ArrowRight className="ml-auto h-3.5 w-3.5 shrink-0 text-ink-500 transition group-hover:text-accent-300" />
    </Link>
  );
}

function AlertRow({ alert }: { alert: Alert }) {
  return (
    <Link
      to={`/alerts/${alert.id}`}
      className="group flex flex-col gap-1.5 rounded-lg border border-ink-700/60 bg-ink-850/50 p-2.5 transition hover:border-signal-bad/40 hover:bg-ink-800/60"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-xs font-medium text-ink-50">{alert.title}</p>
        <Badge tone={ALERT_STATUS_TONES[alert.status]} dot className="shrink-0">
          {ALERT_STATUS_LABELS[alert.status]}
        </Badge>
      </div>
      <p className="line-clamp-2 text-[0.6875rem] leading-snug text-ink-400">{alert.description}</p>
      <div className="flex flex-wrap items-center gap-2 text-[0.625rem] text-ink-500">
        <span className="text-signal-bad">{formatSignedPercent(alert.deviation_percent)}</span>
        <span>·</span>
        <span>{alert.department_name ?? 'Компания'}</span>
        <span>·</span>
        <span>
          {formatDate(alert.period_start)} — {formatDate(alert.period_end)}
        </span>
        {alert.has_decision && (
          <Badge tone="accent" className="ml-auto">
            есть решение
          </Badge>
        )}
      </div>
    </Link>
  );
}

function DecisionRow({ decision }: { decision: Decision }) {
  return (
    <Link
      to={`/decisions/${decision.id}`}
      className="flex items-start justify-between gap-2 rounded-lg border border-ink-700/60 bg-ink-850/50 p-2.5 transition hover:border-accent-400/40 hover:bg-ink-800/60"
    >
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-ink-50">{decision.title}</p>
        <p className="mt-0.5 truncate text-[0.6875rem] text-ink-400">
          {decision.owner.full_name} · срок {formatDate(decision.deadline)}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <Badge tone={DECISION_STATUS_TONES[decision.status]}>{DECISION_STATUS_LABELS[decision.status]}</Badge>
        <Badge tone={PRIORITY_TONES[decision.priority]}>{PRIORITY_LABELS[decision.priority]}</Badge>
      </div>
    </Link>
  );
}

function TaskRow({ task }: { task: Task }) {
  return (
    <Link
      to={`/tasks/${task.id}`}
      className="flex items-start justify-between gap-2 rounded-lg border border-ink-700/60 bg-ink-850/50 p-2.5 transition hover:border-accent-400/40 hover:bg-ink-800/60"
    >
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-ink-50">{task.title}</p>
        <p className="mt-0.5 truncate text-[0.6875rem] text-ink-400">
          {task.assignee.full_name} · {formatDaysLeft(task.deadline)}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <Badge tone={TASK_STATUS_TONES[task.status]}>{TASK_STATUS_LABELS[task.status]}</Badge>
        <Badge tone={PRIORITY_TONES[task.priority]}>{PRIORITY_LABELS[task.priority]}</Badge>
      </div>
    </Link>
  );
}

export function DashboardPage() {
  const { queryParams, filters } = useFilters();
  const [formulasOpen, setFormulasOpen] = useState(false);
  const formulasRef = useRef<HTMLDivElement>(null);
  const query = useQuery({
    queryKey: ['dashboard', queryParams],
    queryFn: async () => (await dashboardApi.get(queryParams)).data,
  });

  const data = query.data;
  const error = query.error ? toApiError(query.error) : null;

  useEffect(() => {
    if (formulasOpen) formulasRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [formulasOpen]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Обзор компании"
        description="Единый управленческий экран: плановые, фактические и прогнозные показатели, критические отклонения и последние решения."
        meta={
          data ? (
            <>
              <Badge tone="idle">
                Период: {formatDate(data.period.date_from)} — {formatDate(data.period.date_to)}
              </Badge>
              <Badge tone="accent" dot>
                Обновлено {formatDateTime(data.updated_at)}
              </Badge>
              {filters.product_id && (
                <Badge tone="warn" title="Фильтр продукта не применяется к HR и общим расходам">
                  Фильтр продукта: применён частично
                </Badge>
              )}
            </>
          ) : null
        }
        actions={
          <div className="ml-auto flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
            <Link to="/forecast">
              <Button variant="outline" size="sm">
                Прогноз мощностей
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
            {data && (
              <Button
                variant="outline"
                size="sm"
                icon={formulasOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <Calculator className="h-3.5 w-3.5" />}
                aria-expanded={formulasOpen}
                onClick={() => setFormulasOpen((open) => !open)}
              >
                {formulasOpen ? 'Скрыть формулы' : 'Формулы KPI'}
              </Button>
            )}
            <Link to="/decisions/new">
              <Button variant="primary" size="sm" icon={<FileText className="h-3.5 w-3.5" />}>
                Новое решение
              </Button>
            </Link>
          </div>
        }
      />

      <GlobalFilters />

      {query.isLoading && <CardSkeletonGrid count={12} />}

      {error && !query.isLoading && (
        <ErrorState message={error.message} onRetry={() => void query.refetch()} />
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <StatTile
              label="Критические отклонения"
              value={data.critical_alerts_count}
              tone="bad"
              icon={<AlertTriangle className="h-4 w-4" />}
              to="/alerts?status=active"
            />
            <StatTile
              label="Активные решения"
              value={data.active_decisions_count}
              tone="accent"
              icon={<ShieldCheck className="h-4 w-4" />}
              to="/decisions"
            />
            <StatTile
              label="Активные задачи"
              value={data.active_tasks_count}
              tone="ok"
              icon={<ListChecks className="h-4 w-4" />}
              to="/tasks"
            />
            <StatTile
              label="Просроченные задачи"
              value={data.overdue_tasks_count}
              tone="warn"
              icon={<Clock className="h-4 w-4" />}
              to="/tasks?overdue=true"
            />
          </div>

          <section aria-label="Показатели компании">
            <div className="mb-2 flex items-end justify-between gap-2">
              <h2 className="text-sm font-semibold tracking-tight text-ink-50">
                Показатели компании
                <span className="ml-2 text-[0.6875rem] font-normal text-ink-400">{data.kpis.length} KPI</span>
              </h2>
              <Link to="/analytics" className="text-[0.6875rem] text-accent-300 hover:text-accent-200">
                Перейти к аналитике
              </Link>
            </div>
            <div className="overflow-x-auto rounded-xl border border-ink-700/80 bg-ink-900/55">
              <table className="table-shell min-w-[1120px]">
                <thead>
                  <tr>
                    <th>Показатель</th>
                    <th>Факт</th>
                    <th>План</th>
                    <th>Отклонение</th>
                    <th>Выполнение</th>
                    <th>Прогноз / динамика</th>
                    <th>Источник</th>
                    <th>Обновлено</th>
                  </tr>
                </thead>
                <tbody>
                  {data.kpis.map((kpi) => <KpiTableRow key={kpi.code} kpi={kpi} />)}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid gap-3 xl:grid-cols-3">
            <Card className="xl:col-span-1">
              <CardHeader
                title="Требуют внимания"
                subtitle="Критические отклонения по выбранному контексту"
                icon={<AlertTriangle className="h-4 w-4" />}
                action={
                  <Link to="/alerts" className="text-[0.6875rem] text-accent-300 hover:text-accent-200">
                    Все отклонения
                  </Link>
                }
              />
              {data.recent_alerts.length === 0 ? (
                <EmptyState
                  title="Критических отклонений нет"
                  description="Все показатели в выбранном контексте находятся в пределах допустимых значений."
                  icon={<CheckCircle2 className="h-5 w-5 text-signal-ok" />}
                />
              ) : (
                <div className="space-y-2">
                  {data.recent_alerts.map((alert) => (
                    <AlertRow key={alert.id} alert={alert} />
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <CardHeader
                title="Последние управленческие решения"
                subtitle="Что уже взято в работу"
                icon={<ShieldCheck className="h-4 w-4" />}
                action={
                  <Link to="/decisions" className="text-[0.6875rem] text-accent-300 hover:text-accent-200">
                    Реестр
                  </Link>
                }
              />
              {data.recent_decisions.length === 0 ? (
                <EmptyState
                  title="Решений пока нет"
                  description="Создайте решение из карточки отклонения, чтобы назначить ответственного и срок."
                  icon={<CircleSlash className="h-5 w-5" />}
                />
              ) : (
                <div className="space-y-2">
                  {data.recent_decisions.map((decision) => (
                    <DecisionRow key={decision.id} decision={decision} />
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <CardHeader
                title="Последние задачи"
                subtitle="Конкретные действия исполнителей"
                icon={<ListChecks className="h-4 w-4" />}
                action={
                  <Link to="/tasks" className="text-[0.6875rem] text-accent-300 hover:text-accent-200">
                    Реестр
                  </Link>
                }
              />
              {data.recent_tasks.length === 0 ? (
                <EmptyState title="Задач пока нет" icon={<CircleSlash className="h-5 w-5" />} />
              ) : (
                <div className="space-y-2">
                  {data.recent_tasks.map((task) => (
                    <TaskRow key={task.id} task={task} />
                  ))}
                </div>
              )}
            </Card>
          </div>

          {formulasOpen && (
            <div ref={formulasRef}>
              <Card>
                <CardHeader
                  title="Формулы и источники показателей"
                  subtitle="Расчёт выполняется на стороне Backend; интерфейс отображает готовые значения"
                  icon={<BarChart3 className="h-4 w-4" />}
                  action={
                    <Button variant="ghost" size="sm" icon={<ChevronUp className="h-3.5 w-3.5" />} onClick={() => setFormulasOpen(false)}>
                      Скрыть
                    </Button>
                  }
                />
                <div className="overflow-x-auto">
                  <table className="table-shell min-w-[720px]">
                    <thead>
                      <tr>
                        <th>KPI</th>
                        <th>Факт</th>
                        <th>План</th>
                        <th>Формула</th>
                        <th>Источник</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.kpis.map((kpi) => (
                        <tr key={kpi.code}>
                          <td>
                            <Link to={`/metrics/${kpi.code}`} className="link-quiet text-xs font-medium">
                              {kpi.name}
                            </Link>
                          </td>
                          <td className="whitespace-nowrap text-xs">{formatUnit(kpi.actual, kpi.unit)}</td>
                          <td className="whitespace-nowrap text-xs text-ink-300">{formatUnit(kpi.target, kpi.unit)}</td>
                          <td className="text-[0.6875rem] leading-snug text-ink-400">{kpi.formula}</td>
                          <td className="whitespace-nowrap text-[0.6875rem] text-ink-400">{kpi.source.join(', ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
