import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowRight, Filter, TrendingUp, Users } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { GlobalFilters } from '@/components/filters/GlobalFilters';
import { useFilters } from '@/components/filters/FiltersContext';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CardSkeletonGrid, EmptyState, ErrorState } from '@/components/feedback/States';
import { salesApi } from '@/lib/api/endpoints';
import { toApiError } from '@/lib/api/client';
import { CHANNEL_LABELS, DEAL_STAGE_LABELS, SEGMENT_LABELS } from '@/constants/labels';
import { formatDate, formatDateTime, formatMoney, formatNumber, formatPercent } from '@/lib/formatters';
import { cn } from '@/lib/utils/cn';

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-ink-700/70 bg-ink-850/60 p-3">
      <p className="text-[0.6875rem] uppercase tracking-[0.08em] text-ink-400">{label}</p>
      <p className="mt-1 text-lg font-semibold leading-none text-ink-50">{value}</p>
      {hint && <p className="mt-1 text-[0.625rem] text-ink-500">{hint}</p>}
    </div>
  );
}

export function SalesPage() {
  const { queryParams } = useFilters();
  const [dealStage, setDealStage] = useState('');

  const summary = useQuery({
    queryKey: ['sales-summary', queryParams],
    queryFn: async () => (await salesApi.summary(queryParams)).data,
  });
  const funnel = useQuery({
    queryKey: ['sales-funnel', queryParams],
    queryFn: async () => (await salesApi.funnel(queryParams)).data,
  });
  const deals = useQuery({
    queryKey: ['sales-deals', queryParams, dealStage],
    queryFn: async () => salesApi.deals({ ...queryParams, page_size: 10, ...(dealStage ? { stage: dealStage } : {}) }),
  });

  const error = summary.error ? toApiError(summary.error) : null;
  const data = summary.data;
  const funnelStages = funnel.data?.stages ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Продажи и клиенты"
        description="Воронка CRM, каналы привлечения, средний чек и повторные покупки. Все значения рассчитываются на стороне Backend."
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
        actions={
          <Link to="/orders">
            <Button variant="outline" size="sm">
              Реестр заказов <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        }
      />

      <GlobalFilters />

      {summary.isLoading && <CardSkeletonGrid count={8} />}
      {error && <ErrorState message={error.message} onRetry={() => void summary.refetch()} />}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-4">
            <Metric label="Оборот" value={formatMoney(data.revenue)} hint="Завершённые заказы периода" />
            <Metric label="Заказов" value={formatNumber(data.orders_count)} hint="Завершённые в периоде" />
            <Metric label="Средний чек" value={formatMoney(data.average_check)} hint="Backend-расчёт" />
            <Metric
              label="Выполнение плана"
              value={formatPercent(data.sales_plan_achievement)}
              hint="Факт / план продаж"
            />
            <Metric label="Новые клиенты" value={formatNumber(data.new_customers)} hint="Первая покупка в периоде" />
            <Metric label="Активные клиенты" value={formatNumber(data.active_customers)} hint="Уникальные клиенты" />
            <Metric
              label="Повторные покупки"
              value={formatPercent(data.repeat_purchase_rate)}
              hint="≥2 завершённых заказа"
            />
            <Metric
              label="Конверсия CRM"
              value={formatPercent(data.conversion_percent)}
              hint="won / когорта сделок"
            />
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            <Card>
              <CardHeader
                title="Воронка продаж"
                subtitle={`Когорта сделок: ${funnel.data?.cohort_count ?? 0} · рассчитана по сопоставимой когорте CRM`}
                icon={<TrendingUp className="h-4 w-4" />}
              />
              {funnel.isLoading && <p className="py-6 text-center text-xs text-ink-400">Загрузка воронки…</p>}
              {funnel.error && (
                <ErrorState
                  title="Воронка недоступна"
                  message={toApiError(funnel.error).message}
                  onRetry={() => void funnel.refetch()}
                />
              )}
              {funnel.data && (
                <div className="space-y-1" role="group" aria-label="Воронка сделок по этапам">
                  {funnelStages.map((stage, index) => {
                    const max = funnelStages[0]?.count ?? 0;
                    const width = max > 0 ? Math.max(28, (stage.count / max) * 100) : 28;
                    const stageColor = index === funnelStages.length - 1
                      ? 'from-signal-ok/90 to-signal-ok/65'
                      : index === 0
                        ? 'from-accent-500/85 to-accent-500/55'
                        : 'from-accent-400/90 to-accent-500/65';
                    return (
                      <div key={stage.code} className="flex flex-col items-center">
                        <div className="mb-1 flex w-full items-center justify-between gap-2 px-1 text-[0.6875rem]">
                          <span className="min-w-0 truncate text-ink-200">
                            <span className="mr-1.5 text-ink-500">{index + 1}.</span>{stage.name}
                          </span>
                          <span className="shrink-0 font-semibold tabular-nums text-ink-50">{formatNumber(stage.count)}</span>
                        </div>
                        <div
                          className={cn('flex h-10 items-center justify-center bg-gradient-to-r text-[0.6875rem] font-medium text-white shadow-sm transition-[width] duration-300', stageColor)}
                          style={{ width: `${width}%`, clipPath: 'polygon(7% 0, 93% 0, 83% 100%, 17% 100%)' }}
                          title={`${stage.name}: ${formatNumber(stage.count)} сделок${stage.conversion_from_previous_percent === null ? '' : ` · ${formatPercent(stage.conversion_from_previous_percent)} от предыдущего этапа`}`}
                        >
                          {stage.conversion_from_previous_percent === null
                            ? 'Старт'
                            : formatPercent(stage.conversion_from_previous_percent)}
                        </div>
                        {index < funnelStages.length - 1 && (
                          <ArrowDown className="my-0.5 h-3.5 w-3.5 text-ink-500" aria-hidden />
                        )}
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between border-t border-ink-800 pt-2 text-[0.6875rem] text-ink-400">
                    <span>Общая конверсия когорты</span>
                    <span className="font-semibold text-signal-ok">
                      {formatPercent(funnel.data.conversion_percent)}
                    </span>
                  </div>
                </div>
              )}
            </Card>

            <Card>
              <CardHeader
                title="Каналы и сегменты"
                subtitle="Срез по завершённым заказам периода"
                icon={<Users className="h-4 w-4" />}
              />
              <div className="overflow-x-auto">
                <table className="table-shell min-w-full">
                  <thead>
                    <tr>
                      <th>Канал</th>
                      <th className="text-right">Заказы</th>
                      <th className="text-right">Оборот</th>
                      <th className="text-right">Клиенты</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.channels.map((channel) => (
                      <tr key={channel.code}>
                        <td className="text-xs">{CHANNEL_LABELS[channel.code] ?? channel.code}</td>
                        <td className="text-right text-xs">{formatNumber(channel.orders_count)}</td>
                        <td className="text-right text-xs">{formatMoney(channel.revenue)}</td>
                        <td className="text-right text-xs">{formatNumber(channel.active_customers)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {data.segments.map((segment) => (
                  <div key={segment.code} className="rounded-md border border-ink-700/60 bg-ink-850/50 p-2">
                    <p className="truncate text-[0.625rem] text-ink-400">{SEGMENT_LABELS[segment.code] ?? segment.code}</p>
                    <p className="mt-0.5 text-sm font-semibold text-ink-50">{formatNumber(segment.orders_count)}</p>
                    <p className="text-[0.625rem] text-ink-500">{formatMoney(segment.revenue)}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader
              title="CRM-сделки"
              subtitle="Стадии сделок хранятся в источнике CRM; выигранная сделка связана с заказом"
              icon={<Filter className="h-4 w-4" />}
              action={
                <select
                  value={dealStage}
                  onChange={(event) => setDealStage(event.target.value)}
                  aria-label="Фильтр по стадии сделки"
                  className="h-8 rounded-md border border-ink-600 bg-ink-850 px-2 text-xs text-ink-100"
                >
                  <option value="">Все стадии</option>
                  {Object.entries(DEAL_STAGE_LABELS).map(([code, label]) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
                </select>
              }
            />
            {deals.isLoading && <p className="py-6 text-center text-xs text-ink-400">Загрузка сделок…</p>}
            {deals.data && deals.data.items.length === 0 && (
              <EmptyState
                title="Сделки не найдены"
                description="Измените период или стадию сделки, чтобы увидеть записи."
              />
            )}
            {deals.data && deals.data.items.length > 0 && (
              <div className="overflow-x-auto">
                <table className="table-shell min-w-[760px]">
                  <thead>
                    <tr>
                      <th>Сделка</th>
                      <th>Клиент</th>
                      <th>Канал</th>
                      <th>Стадия</th>
                      <th className="text-right">Ожидаемая сумма</th>
                      <th>Создана</th>
                      <th>Заказ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deals.data.items.map((deal) => (
                      <tr key={deal.id}>
                        <td className="text-xs font-medium text-ink-100">{deal.external_id}</td>
                        <td className="text-xs">
                          <Link to={`/customers/${deal.customer_id}`} className="link-quiet">
                            {deal.customer_name}
                          </Link>
                        </td>
                        <td className="text-xs text-ink-300">{CHANNEL_LABELS[deal.channel] ?? deal.channel}</td>
                        <td>
                          <Badge
                            tone={deal.stage === 'won' ? 'ok' : deal.stage === 'lost' ? 'idle' : 'info'}
                          >
                            {DEAL_STAGE_LABELS[deal.stage] ?? deal.stage}
                          </Badge>
                        </td>
                        <td className="text-right text-xs">{formatMoney(deal.expected_amount)}</td>
                        <td className="whitespace-nowrap text-xs text-ink-400">{formatDate(deal.created_at)}</td>
                        <td className="text-xs">
                          {deal.order_id ? (
                            <Link to={`/orders/${deal.order_id}`} className="link-quiet">
                              открыть
                            </Link>
                          ) : (
                            <span className="text-ink-500">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
