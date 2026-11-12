import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Factory, Gauge, Printer, Timer, Wrench } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { GlobalFilters } from '@/components/filters/GlobalFilters';
import { useFilters } from '@/components/filters/FiltersContext';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CardSkeletonGrid, EmptyState, ErrorState } from '@/components/feedback/States';
import { Pagination } from '@/components/tables/DataTable';
import { productionApi } from '@/lib/api/endpoints';
import { toApiError } from '@/lib/api/client';
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONES, PRODUCTION_LABELS } from '@/constants/labels';
import { formatDate, formatDateTime, formatDurationMinutes, formatNumber, formatPercent } from '@/lib/formatters';
import { cn } from '@/lib/utils/cn';

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'ok' | 'warn' | 'bad';
}) {
  return (
    <div className="rounded-lg border border-ink-700/70 bg-ink-850/60 p-3">
      <p className="text-[0.6875rem] uppercase tracking-[0.08em] text-ink-400">{label}</p>
      <p
        className={cn(
          'mt-1 text-lg font-semibold leading-none',
          tone === 'ok' && 'text-signal-ok',
          tone === 'warn' && 'text-signal-warn',
          tone === 'bad' && 'text-signal-bad',
          !tone && 'text-ink-50',
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-[0.625rem] text-ink-500">{hint}</p>}
    </div>
  );
}

export function ProductionPage() {
  const { queryParams } = useFilters();
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<'records' | 'queue'>('records');

  const summary = useQuery({
    queryKey: ['production-summary', queryParams],
    queryFn: async () => (await productionApi.summary(queryParams)).data,
  });

  const records = useQuery({
    queryKey: ['production-records', queryParams, page],
    queryFn: async () => productionApi.records({ ...queryParams, page, page_size: 15 }),
  });

  const queue = useQuery({
    queryKey: ['production-queue', queryParams, page],
    queryFn: async () => productionApi.queue({ ...queryParams, page, page_size: 15 }),
    enabled: tab === 'queue',
  });

  const error = summary.error ? toApiError(summary.error) : null;
  const data = summary.data;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Производство и качество"
        description="Производственные записи — за выбранный период. Очередь показывает заказы, ожидающие запуска или уже находящиеся в работе; показатели выпуска, загрузки, простоев и качества можно проверить в деталях ниже."
        meta={
          data ? (
            <>
              <Badge tone="idle">
                {formatDate(data.context.date_from)} — {formatDate(data.context.date_to)}
              </Badge>
              <Badge tone="accent" dot>
                Обновлено {formatDateTime(data.updated_at)}
              </Badge>
            </>
          ) : null
        }
      />

      <GlobalFilters />

      {summary.isLoading && <CardSkeletonGrid count={8} />}
      {error && <ErrorState message={error.message} onRetry={() => void summary.refetch()} />}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
            <div className="rounded-lg border border-ink-700/70 bg-ink-850/60 p-3">
              <p className="text-[0.6875rem] uppercase tracking-[0.08em] text-ink-400">Выпуск за период</p>
              <div className="mt-2 grid grid-cols-3 divide-x divide-ink-700/70">
                <div className="pr-2">
                  <p className="text-[0.625rem] text-ink-400">План</p>
                  <p className="mt-1 text-sm font-semibold leading-none text-ink-50">{data.planned_quantity === null ? '—' : `${formatNumber(data.planned_quantity)} ед.`}</p>
                </div>
                <div className="px-2">
                  <p className="text-[0.625rem] text-ink-400">Факт</p>
                  <p className="mt-1 text-sm font-semibold leading-none text-ink-50">{data.actual_quantity === null ? '—' : `${formatNumber(data.actual_quantity)} ед.`}</p>
                </div>
                <div className="pl-2">
                  <p className="text-[0.625rem] text-ink-400">Выполнение</p>
                  <p className={cn(
                    'mt-1 text-sm font-semibold leading-none',
                    data.plan_achievement_percent === null
                      ? 'text-ink-50'
                      : data.plan_achievement_percent >= 95
                        ? 'text-signal-ok'
                        : data.plan_achievement_percent >= 85
                          ? 'text-signal-warn'
                          : 'text-signal-bad',
                  )}>{formatPercent(data.plan_achievement_percent)}</p>
                </div>
              </div>
              <p className="mt-2 text-[0.625rem] text-ink-500">{formatDate(data.context.date_from)} — {formatDate(data.context.date_to)}</p>
            </div>
            <Stat label="Очередь заказов" value={`${formatNumber(data.queue_quantity)} ед.`} hint="Ожидают запуска или в работе" />
            <Stat
              label="Средний lead time"
              value={data.average_lead_time_hours === null ? '—' : `${formatNumber(data.average_lead_time_hours, 1)} ч`}
            />
            <Stat
              label="Загрузка мощности"
              value={formatPercent(data.capacity_utilization_percent)}
              hint={`${formatNumber(data.actual_load_hours, 1)} / ${formatNumber(data.available_capacity_hours, 1)} н/ч`}
              tone={
                data.capacity_utilization_percent === null
                  ? undefined
                  : data.capacity_utilization_percent > 110
                    ? 'bad'
                    : data.capacity_utilization_percent < 70
                      ? 'warn'
                      : 'ok'
              }
            />
            <Stat label="Простои" value={formatDurationMinutes(data.downtime_minutes)} tone="warn" />
            <Stat
              label="Доля брака"
              value={formatPercent(data.defect_rate_percent)}
              hint={`${formatNumber(data.defective_quantity)} брак · ${formatNumber(data.reprint_quantity)} перепечаток`}
              tone={
                data.defect_rate_percent === null
                  ? undefined
                  : data.defect_rate_percent > 6
                    ? 'bad'
                    : data.defect_rate_percent > 4.5
                      ? 'warn'
                      : 'ok'
              }
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={tab === 'records' ? 'primary' : 'ghost'}
              icon={<Factory className="h-3.5 w-3.5" />}
              onClick={() => {
                setTab('records');
                setPage(1);
              }}
            >
              Производственные записи
            </Button>
            <Button
              size="sm"
              variant={tab === 'queue' ? 'primary' : 'ghost'}
              icon={<Timer className="h-3.5 w-3.5" />}
              onClick={() => {
                setTab('queue');
                setPage(1);
              }}
            >
              Очередь заказов
            </Button>
          </div>

          {tab === 'records' && (
            <Card className="p-0">
              <div className="p-4 pb-0">
                <CardHeader
                  title="Производственные данные за период"
                  subtitle={`${formatDate(data.context.date_from)} — ${formatDate(data.context.date_to)} · очередь ожидающих и выполняемых заказов — во вкладке «Очередь заказов»`}
                  icon={<Printer className="h-4 w-4" />}
                />
              </div>
              {records.isLoading && <p className="py-8 text-center text-xs text-ink-400">Загрузка записей…</p>}
              {records.error && (
                <ErrorState
                  title="Записи недоступны"
                  message={toApiError(records.error).message}
                  onRetry={() => void records.refetch()}
                />
              )}
              {records.data && records.data.items.length === 0 && (
                <EmptyState title="Записей нет" description="Измените период или фильтр подразделения." />
              )}
              {records.data && records.data.items.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="table-shell min-w-[900px]">
                    <thead>
                      <tr>
                        <th>Дата</th>
                        <th>Подразделение</th>
                        <th>Продукт</th>
                        <th className="text-right">План</th>
                        <th className="text-right">Факт</th>
                        <th className="text-right">Брак</th>
                        <th className="text-right">Перепечатки</th>
                        <th className="text-right">Загрузка</th>
                        <th>Причина</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.data.items.map((record) => (
                        <tr key={record.id}>
                          <td className="whitespace-nowrap text-xs">{formatDate(record.production_date)}</td>
                          <td className="text-xs text-ink-300">{record.department_name}</td>
                          <td className="text-xs">{record.product_name}</td>
                          <td className="text-right text-xs">{formatNumber(record.planned_quantity)}</td>
                          <td className="text-right text-xs">{formatNumber(record.actual_quantity)}</td>
                          <td className="text-right text-xs">
                            <span className={record.defective_quantity > 0 ? 'text-signal-bad' : 'text-ink-300'}>
                              {formatNumber(record.defective_quantity)}
                            </span>
                          </td>
                          <td className="text-right text-xs">{formatNumber(record.reprint_quantity)}</td>
                          <td className="text-right text-xs">
                            {formatNumber(record.actual_load, 1)} / {formatNumber(record.planned_capacity, 1)} н/ч
                          </td>
                          <td className="text-[0.6875rem] text-ink-300">
                            {record.cause ?? <span className="text-ink-500">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {records.data && (
                <Pagination
                  page={records.data.page}
                  pages={records.data.pages}
                  total={records.data.total}
                  pageSize={records.data.page_size}
                  onPageChange={setPage}
                />
              )}
            </Card>
          )}

          {tab === 'queue' && (
            <Card className="p-0">
              <div className="p-4 pb-0">
                <CardHeader
                  title="Очередь производства"
                  subtitle="Активные заказы в статусах queued / in_progress"
                  icon={<Gauge className="h-4 w-4" />}
                />
              </div>
              {queue.isLoading && <p className="py-8 text-center text-xs text-ink-400">Загрузка очереди…</p>}
              {queue.data && queue.data.items.length === 0 && (
                <EmptyState title="Очередь пуста" description="Все заказы завершены или отменены." />
              )}
              {queue.data && queue.data.items.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="table-shell min-w-[820px]">
                    <thead>
                      <tr>
                        <th>Заказ</th>
                        <th>Клиент</th>
                        <th>Продукт</th>
                        <th className="text-right">Количество</th>
                        <th>Производство</th>
                        <th>Статус заказа</th>
                        <th>Срок</th>
                      </tr>
                    </thead>
                    <tbody>
                      {queue.data.items.map((order) => (
                        <tr key={order.id}>
                          <td>
                            <Link to={`/orders/${order.id}`} className="link-quiet font-mono text-xs">
                              {order.order_number}
                            </Link>
                          </td>
                          <td className="text-xs">
                            <Link to={`/customers/${order.customer_id}`} className="link-quiet">
                              {order.customer_name}
                            </Link>
                          </td>
                          <td className="text-xs">{order.product_name}</td>
                          <td className="text-right text-xs">{formatNumber(order.quantity)}</td>
                          <td>
                            <Badge tone={order.production_status === 'blocked' ? 'bad' : 'info'}>
                              {PRODUCTION_LABELS[order.production_status]}
                            </Badge>
                          </td>
                          <td>
                            <Badge tone={ORDER_STATUS_TONES[order.status]}>{ORDER_STATUS_LABELS[order.status]}</Badge>
                          </td>
                          <td className="whitespace-nowrap text-xs text-ink-300">{formatDate(order.due_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {queue.data && (
                <Pagination
                  page={queue.data.page}
                  pages={queue.data.pages}
                  total={queue.data.total}
                  pageSize={queue.data.page_size}
                  onPageChange={setPage}
                />
              )}
            </Card>
          )}

          <Card>
            <CardHeader
              title="Детализация отклонений производства"
              subtitle="Переход к показателю и исходным записям"
              icon={<Wrench className="h-4 w-4" />}
            />
            <div className="flex flex-wrap gap-2">
              <Link to="/metrics/defect_rate">
                <Button variant="outline" size="sm">
                  Доля брака: детализация
                </Button>
              </Link>
              <Link to="/metrics/capacity_utilization">
                <Button variant="outline" size="sm">
                  Загрузка мощностей: детализация
                </Button>
              </Link>
              <Link to="/metrics/on_time_orders">
                <Button variant="outline" size="sm">
                  Заказы в срок
                </Button>
              </Link>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
