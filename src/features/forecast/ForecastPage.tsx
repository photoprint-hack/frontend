import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CalendarClock, Gauge, Info, TrendingUp } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { GlobalFilters } from '@/components/filters/GlobalFilters';
import { useFilters } from '@/components/filters/FiltersContext';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback/States';
import { forecastApi } from '@/lib/api/endpoints';
import { toApiError } from '@/lib/api/client';
import { formatDate, formatDateTime, formatHours, formatPercent, formatShortDate } from '@/lib/formatters';
import { cn } from '@/lib/utils/cn';
import type { ForecastWeek } from '@/types/api';

function WeekCard({ week, max }: { week: ForecastWeek; max: number }) {
  const demand = week.demand ?? 0;
  const capacity = week.available_capacity ?? 0;
  const scale = max > 0 ? 100 / max : 0;

  return (
    <div
      className={cn(
        'rounded-xl border p-3',
        week.is_deficit ? 'border-signal-bad/40 bg-signal-bad/8' : 'border-ink-700/70 bg-ink-850/50',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.08em] text-ink-400">Неделя</p>
          <p className="mt-0.5 text-sm font-semibold text-ink-50">
            {formatShortDate(week.week_start)} — {formatShortDate(week.week_end)}
          </p>
        </div>
        <Badge tone={week.status === 'deficit' ? 'bad' : week.status === 'no_data' ? 'idle' : 'ok'} dot>
          {week.status === 'deficit' ? 'дефицит' : week.status === 'no_data' ? 'нет данных' : 'норма'}
        </Badge>
      </div>

      <div className="mt-3 space-y-2">
        <div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-ink-300">Спрос (прогноз)</span>
            <span className="font-medium text-ink-100">{formatHours(week.demand)}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-700/60">
            <div className="h-full rounded-full bg-accent-400" style={{ width: `${Math.min(100, demand * scale)}%` }} />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-ink-300">Доступная мощность</span>
            <span className="font-medium text-ink-100">{formatHours(week.available_capacity)}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-700/60">
            <div
              className="h-full rounded-full bg-signal-info"
              style={{ width: `${Math.min(100, capacity * scale)}%` }}
            />
          </div>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-ink-800/80 pt-2 text-[10px]">
        <div>
          <dt className="text-ink-500">Дефицит</dt>
          <dd className={cn('font-semibold', week.is_deficit ? 'text-signal-bad' : 'text-ink-300')}>
            {formatHours(week.deficit)}
          </dd>
        </div>
        <div>
          <dt className="text-ink-500">Резерв</dt>
          <dd className="font-semibold text-signal-ok">{formatHours(week.reserve)}</dd>
        </div>
        <div>
          <dt className="text-ink-500">Загрузка</dt>
          <dd className="font-semibold text-ink-100">{formatPercent(week.utilization_percent)}</dd>
        </div>
      </dl>
    </div>
  );
}

export function ForecastPage() {
  const { queryParams, filters } = useFilters();

  const query = useQuery({
    queryKey: ['forecast', queryParams],
    queryFn: async () => (await forecastApi.get(queryParams)).data,
  });

  const data = query.data;
  const error = query.error ? toApiError(query.error) : null;
  const max = data ? Math.max(...data.items.map((item) => Math.max(item.demand ?? 0, item.available_capacity ?? 0)), 1) : 1;
  const deficitWeeks = data?.items.filter((item) => item.is_deficit) ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Прогноз спроса и мощностей"
        description="Горизонт 4 недели. Метод — среднее за четыре полные недели (four_week_average) в нормо-часах. Дефицит означает, что спрос превышает доступную мощность."
        meta={
          data ? (
            <>
              <Badge tone={data.status === 'ready' ? 'accent' : 'idle'} dot>
                {data.status === 'ready' ? 'Прогноз рассчитан' : 'Нет данных для прогноза'}
              </Badge>
              <Badge tone="idle">На дату {formatDate(data.as_of)}</Badge>
              <Badge tone="info">{data.horizon_weeks} недели</Badge>
              {data.method && <Badge tone="violet">{data.method}</Badge>}
            </>
          ) : null
        }
        actions={
          <Link to="/production">
            <Button variant="outline" size="sm" icon={<Gauge className="h-3.5 w-3.5" />}>
              Производство
            </Button>
          </Link>
        }
      />

      <GlobalFilters />

      {query.isLoading && <LoadingState label="Считаем прогноз мощностей…" />}
      {error && <ErrorState message={error.message} onRetry={() => void query.refetch()} />}

      {data && data.status === 'no_data' && (
        <Card>
          <EmptyState
            title="Прогноз недоступен"
            description={data.reason ?? 'Недостаточно данных для расчёта прогноза.'}
            icon={<Info className="h-5 w-5" />}
            action={
              <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
                Повторить расчёт
              </Button>
            }
          />
          <p className="mt-2 text-center text-[11px] leading-relaxed text-ink-500">
            Прогноз строится только при наличии истории заказов за четыре полные недели и плана доступной мощности
            на будущие недели. Значения не подменяются нулями — интерфейс явно сообщает об отсутствии данных.
          </p>
        </Card>
      )}

      {data && data.status === 'ready' && (
        <>
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
            <div className="rounded-lg border border-ink-700/70 bg-ink-850/60 p-3">
              <p className="text-[11px] uppercase tracking-[0.08em] text-ink-400">Недель с дефицитом</p>
              <p className={cn('mt-1 text-lg font-semibold leading-none', deficitWeeks.length > 0 ? 'text-signal-bad' : 'text-signal-ok')}>
                {deficitWeeks.length} из {data.items.length}
              </p>
            </div>
            <div className="rounded-lg border border-ink-700/70 bg-ink-850/60 p-3">
              <p className="text-[11px] uppercase tracking-[0.08em] text-ink-400">Суммарный спрос</p>
              <p className="mt-1 text-lg font-semibold leading-none text-ink-50">
                {formatHours(data.items.reduce((sum, item) => sum + (item.demand ?? 0), 0))}
              </p>
            </div>
            <div className="rounded-lg border border-ink-700/70 bg-ink-850/60 p-3">
              <p className="text-[11px] uppercase tracking-[0.08em] text-ink-400">Суммарная мощность</p>
              <p className="mt-1 text-lg font-semibold leading-none text-ink-50">
                {formatHours(data.items.reduce((sum, item) => sum + (item.available_capacity ?? 0), 0))}
              </p>
            </div>
            <div className="rounded-lg border border-ink-700/70 bg-ink-850/60 p-3">
              <p className="text-[11px] uppercase tracking-[0.08em] text-ink-400">Первый дефицит</p>
              <p className="mt-1 text-sm font-semibold leading-tight text-ink-50">
                {data.first_deficit_week ? formatDate(data.first_deficit_week) : 'не прогнозируется'}
              </p>
            </div>
          </div>

          {data.first_deficit_week && (
            <div className="flex items-start gap-2 rounded-lg border border-signal-bad/40 bg-signal-bad/10 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-signal-bad" aria-hidden />
              <div>
                <p className="text-xs font-semibold text-signal-bad">
                  Дефицит мощности с недели {formatDate(data.first_deficit_week)}
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-ink-200">
                  Требуется решение: перераспределить смены, добавить оборудование или перенести сроки. Создайте
                  управленческое решение, чтобы зафиксировать ответственного и срок.
                </p>
                <Link to="/decisions/new" className="link-quiet mt-1.5 inline-block text-[11px]">
                  Создать решение по дефициту
                </Link>
              </div>
            </div>
          )}

          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
            {data.items.map((week) => (
              <WeekCard key={week.week_start} week={week} max={max} />
            ))}
          </div>

          <Card className="p-0">
            <div className="p-4 pb-0">
              <CardHeader
                title="Детализация по неделям"
                subtitle="Спрос, мощность, дефицит и резерв в нормо-часах"
                icon={<TrendingUp className="h-4 w-4" />}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="table-shell min-w-[720px]">
                <thead>
                  <tr>
                    <th>Неделя</th>
                    <th className="text-right">Спрос</th>
                    <th className="text-right">Мощность</th>
                    <th className="text-right">Дефицит</th>
                    <th className="text-right">Резерв</th>
                    <th className="text-right">Загрузка</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((week) => (
                    <tr key={week.week_start}>
                      <td className="whitespace-nowrap text-xs">
                        {formatDate(week.week_start)} — {formatDate(week.week_end)}
                      </td>
                      <td className="text-right text-xs">{formatHours(week.demand)}</td>
                      <td className="text-right text-xs">{formatHours(week.available_capacity)}</td>
                      <td className={cn('text-right text-xs', week.is_deficit ? 'text-signal-bad' : 'text-ink-400')}>
                        {formatHours(week.deficit)}
                      </td>
                      <td className="text-right text-xs text-ink-300">{formatHours(week.reserve)}</td>
                      <td className="text-right text-xs">{formatPercent(week.utilization_percent)}</td>
                      <td>
                        <Badge tone={week.status === 'deficit' ? 'bad' : week.status === 'no_data' ? 'idle' : 'ok'}>
                          {week.status === 'deficit' ? 'дефицит' : week.status === 'no_data' ? 'нет данных' : 'норма'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {data && (
        <div className="flex items-start gap-2 rounded-lg border border-ink-700/70 bg-ink-900/50 p-3 text-[11px] leading-relaxed text-ink-400">
          <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-300" aria-hidden />
          <p>
            Метод расчёта: <span className="font-mono text-ink-200">{data.method ?? 'four_week_average'}</span> —
            средненедельный спрос за последние четыре полные недели, спроецированный на будущие недели и сопоставленный
            с планом доступной мощности. Фильтры: {filters.department_id ? 'подразделение' : 'все подразделения'},{' '}
            {filters.product_id ? 'продукт' : 'все продукты'}. Сформировано {formatDateTime(data.generated_at)}.
          </p>
        </div>
      )}
    </div>
  );
}
