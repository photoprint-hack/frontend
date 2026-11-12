import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Building2, CalendarClock, Package, ReceiptText, UserRound } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ErrorState, LoadingState } from '@/components/feedback/States';
import { customersApi } from '@/lib/api/endpoints';
import { toApiError } from '@/lib/api/client';
import {
  CHANNEL_LABELS,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONES,
  SEGMENT_LABELS,
} from '@/constants/labels';
import { formatDate, formatMoney, formatNumber } from '@/lib/formatters';
import { cn } from '@/lib/utils/cn';

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();

  const query = useQuery({
    queryKey: ['customer', id],
    queryFn: async () => (await customersApi.get(id as string)).data,
    enabled: Boolean(id),
  });

  if (query.isLoading) return <LoadingState label="Загружаем карточку клиента…" />;
  if (query.error) {
    return <ErrorState message={toApiError(query.error).message} onRetry={() => void query.refetch()} />;
  }

  const customer = query.data;
  if (!customer) return null;

  const orders = customer.orders;
  const completed = orders.filter((order) => order.status === 'completed');
  const lifetimeValue = completed.reduce((sum, order) => sum + order.amount, 0);
  const averageCheck = completed.length > 0 ? lifetimeValue / completed.length : null;

  return (
    <div className="space-y-4">
      <PageHeader
        title={customer.name}
        description={`${SEGMENT_LABELS[customer.segment] ?? customer.segment} · ${customer.customer_type === 'b2b' ? 'корпоративный' : 'розничный'} клиент`}
        meta={
          <>
            <Badge tone="accent">{CHANNEL_LABELS[customer.acquisition_channel] ?? customer.acquisition_channel}</Badge>
            <Badge tone="idle">внешний ID: {customer.external_id}</Badge>
            <Badge tone="info">источник: {customer.source}</Badge>
          </>
        }
        actions={
          <Link to="/sales">
            <Button variant="ghost" size="sm" icon={<ArrowLeft className="h-3.5 w-3.5" />}>
              К продажам
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        {[
          { label: 'Заказов всего', value: formatNumber(orders.length) },
          { label: 'Завершено', value: formatNumber(completed.length) },
          { label: 'Оборот клиента', value: formatMoney(lifetimeValue) },
          { label: 'Средний чек', value: formatMoney(averageCheck) },
        ].map((tile) => (
          <div key={tile.label} className="rounded-lg border border-ink-700/70 bg-ink-850/60 p-3">
            <p className="text-[0.6875rem] uppercase tracking-[0.08em] text-ink-400">{tile.label}</p>
            <p className="mt-1 truncate text-lg font-semibold leading-none text-ink-50">{tile.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Card>
          <CardHeader title="Реквизиты клиента" icon={<UserRound className="h-4 w-4" />} />
          <dl className="space-y-2 text-[0.6875rem]">
            {[
              ['Сегмент', SEGMENT_LABELS[customer.segment] ?? customer.segment],
              ['Тип', customer.customer_type === 'b2b' ? 'B2B' : 'B2C'],
              ['Канал привлечения', CHANNEL_LABELS[customer.acquisition_channel] ?? customer.acquisition_channel],
              ['Источник данных', customer.source],
              ['Внешний ID', customer.external_id],
              ['Первый заказ', customer.first_order_at ? formatDate(customer.first_order_at) : 'нет заказов'],
              ['Заведён', formatDate(customer.created_at)],
              ['Обновлён', formatDate(customer.updated_at)],
            ].map(([label, value]) => (
              <div key={label} className="flex items-start justify-between gap-2">
                <dt className="text-ink-400">{label}</dt>
                <dd className="truncate text-right font-medium text-ink-100" title={String(value)}>
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 flex items-start gap-1.5 rounded-md border border-ink-700/60 bg-ink-850/50 p-2 text-[0.625rem] leading-relaxed text-ink-400">
            <Building2 className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            Контактные данные и персональная информация в демонстрационном контуре не используются.
          </p>
        </Card>

        <Card className="lg:col-span-2 p-0">
          <div className="p-4 pb-0">
            <CardHeader
              title="Заказы клиента"
              subtitle={`Последние ${orders.length} записей из источника`}
              icon={<Package className="h-4 w-4" />}
            />
          </div>
          {orders.length === 0 ? (
            <p className="py-8 text-center text-xs text-ink-400">У клиента ещё нет заказов.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-shell min-w-[680px]">
                <thead>
                  <tr>
                    <th>Заказ</th>
                    <th>Продукт</th>
                    <th>Подразделение</th>
                    <th className="text-right">Сумма</th>
                    <th>Создан</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <Link to={`/orders/${order.id}`} className="link-quiet font-mono text-xs">
                          {order.order_number}
                        </Link>
                      </td>
                      <td className="text-xs">{order.product_name}</td>
                      <td className="text-xs text-ink-300">{order.department_name}</td>
                      <td className="whitespace-nowrap text-right text-xs font-medium">{formatMoney(order.amount)}</td>
                      <td className="whitespace-nowrap text-xs text-ink-400">{formatDate(order.created_at)}</td>
                      <td>
                        <Badge tone={ORDER_STATUS_TONES[order.status]}>{ORDER_STATUS_LABELS[order.status]}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <div
        className={cn(
          'flex items-start gap-2 rounded-lg border border-ink-700/70 bg-ink-900/50 p-3 text-[0.6875rem] leading-relaxed text-ink-400',
        )}
      >
        <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-300" aria-hidden />
        <p>
          Оборот и средний чек считаются по завершённым заказам из карточки клиента и могут отличаться от показателей
          периода на странице «Продажи и клиенты», где применяются глобальные фильтры.
        </p>
      </div>

      <p className="flex items-center gap-1.5 px-1 text-[0.6875rem] text-ink-500">
        <ReceiptText className="h-3 w-3" aria-hidden />
        Данные клиента загружаются из CRM и дополняются заказами ERP.
      </p>
    </div>
  );
}
