import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleSlash,
  Clock,
  ListChecks,
  ShieldCheck,
  FileText,
  BarChart3,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { GlobalFilters } from '@/components/filters/GlobalFilters';
import { useFilters } from '@/components/filters/FiltersContext';
import { KpiCard } from '@/components/cards/KpiCard';
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
import { formatDate, formatDateTime, formatSignedPercent, formatUnit, formatDaysLeft } from '@/lib/formatters';
import { cn } from '@/lib/utils/cn';
import type { Alert, Decision, Task } from '@/types/api';

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
  const query = useQuery({
    queryKey: ['dashboard', queryParams],
    queryFn: async () => (await dashboardApi.get(queryParams)).data,
  });

  const data = query.data;
  const error = query.error ? toApiError(query.error) : null;

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
          <>
            <Link to="/forecast">
              <Button variant="outline" size="sm">
                Прогноз мощностей
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
            <Link to="/decisions/new">
              <Button variant="primary" size="sm" icon={<FileText className="h-3.5 w-3.5" />}>
                Новое решение
              </Button>
            </Link>
          </>
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 min-[2100px]:grid-cols-4">
              {data.kpis.map((kpi) => (
                <KpiCard key={kpi.code} kpi={kpi} />
              ))}
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

          <Card>
            <CardHeader
              title="Формулы и источники показателей"
              subtitle="Расчёт выполняется на стороне Backend; интерфейс отображает готовые значения"
              icon={<BarChart3 className="h-4 w-4" />}
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
        </>
      )}
    </div>
  );
}
