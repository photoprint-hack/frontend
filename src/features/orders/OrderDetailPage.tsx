import { Link, useParams } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CalendarClock, CheckCircle2, CircleDashed, Package, Truck, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ErrorState, LoadingState } from '@/components/feedback/States';
import { ordersApi } from '@/lib/api/endpoints';
import { toApiError } from '@/lib/api/client';
import {
  CHANNEL_LABELS,
  DELIVERY_LABELS,
  MODERATION_LABELS,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONES,
  PRODUCTION_LABELS,
} from '@/constants/labels';
import { formatDate, formatDateTime, formatMoney, formatNumber } from '@/lib/formatters';
import { cn } from '@/lib/utils/cn';
import type { OrderEvent } from '@/types/api';

const PROCESS_STAGES = [
  { key: 'created', label: 'Заказ создан', icon: Package },
  { key: 'moderation', label: 'Модерация', icon: CheckCircle2 },
  { key: 'production', label: 'Производство', icon: CircleDashed },
  { key: 'delivery', label: 'Доставка', icon: Truck },
  { key: 'support', label: 'Поддержка', icon: CalendarClock },
] as const;

function stageState(events: OrderEvent[], key: (typeof PROCESS_STAGES)[number]['key']) {
  const matchers: Record<string, string[]> = {
    created: ['order_created'],
    moderation: ['moderation_passed'],
    production: ['production_started', 'production_completed'],
    delivery: ['delivered', 'returned'],
    support: ['support_contact', 'returned'],
  };
  const related = events.filter((event) => matchers[key]?.includes(event.event_type));
  if (related.length === 0) return { state: 'empty' as const, event: null };
  return { state: 'done' as const, event: related[related.length - 1] ?? null };
}

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const orderQuery = useQuery({
    queryKey: ['order', id],
    queryFn: async () => (await ordersApi.get(id as string)).data,
    enabled: Boolean(id),
  });

  const eventsQuery = useQuery({
    queryKey: ['order-events', id],
    queryFn: async () => ordersApi.events(id as string, { page_size: 50 }),
    enabled: Boolean(id),
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      const order = orderQuery.data;
      if (!order) throw new Error('Заказ не загружен');
      return ordersApi.update(order.id, {
        version: order.version,
        status: 'completed',
        completed_at: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      toast.success('Заказ завершён, данные обновлены');
      void queryClient.invalidateQueries({ queryKey: ['order', id] });
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error) => {
      const apiError = toApiError(error);
      toast.error(apiError.message);
    },
  });

  if (orderQuery.isLoading) return <LoadingState label="Загружаем карточку заказа…" />;
  if (orderQuery.error) {
    return <ErrorState message={toApiError(orderQuery.error).message} onRetry={() => void orderQuery.refetch()} />;
  }

  const order = orderQuery.data;
  if (!order) return null;
  const events = eventsQuery.data?.items ?? [];
  const canComplete = order.status === 'in_progress' && order.allowed_actions.includes('update');

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Заказ ${order.order_number}`}
        description={`${order.customer_name} · ${order.product_name} · ${order.department_name}`}
        meta={
          <>
            <Badge tone={ORDER_STATUS_TONES[order.status]} dot>
              {ORDER_STATUS_LABELS[order.status]}
            </Badge>
            <Badge tone="idle">{CHANNEL_LABELS[order.channel] ?? order.channel}</Badge>
            <Badge tone="info">v{order.version}</Badge>
          </>
        }
        actions={
          <>
            <Link to="/orders">
              <Button variant="ghost" size="sm" icon={<ArrowLeft className="h-3.5 w-3.5" />}>
                К реестру
              </Button>
            </Link>
            {canComplete && (
              <Button
                variant="primary"
                size="sm"
                loading={completeMutation.isPending}
                icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                onClick={() => completeMutation.mutate()}
              >
                Завершить заказ
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Основные данные" icon={<Package className="h-4 w-4" />} />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs sm:grid-cols-3">
            {([
              [
                'Клиент',
                <Link key="customer" to={`/customers/${order.customer_id}`} className="link-quiet">
                  {order.customer_name}
                </Link>,
              ],
              ['Продукт', order.product_name],
              ['Подразделение', order.department_name],
              ['Количество', `${formatNumber(order.quantity)} ед.`],
              ['Норматив', `${order.standard_hours_per_unit} н/ч на единицу`],
              ['Сумма', formatMoney(order.amount)],
              ['Создан', formatDateTime(order.created_at)],
              ['Плановый срок', formatDateTime(order.due_at)],
              ['Завершён', order.completed_at ? formatDateTime(order.completed_at) : '—'],
              ['Канал', CHANNEL_LABELS[order.channel] ?? order.channel],
              ['Источник', order.source_system],
              ['Обновлён', formatDateTime(order.updated_at)],
            ] as [string, ReactNode][]).map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-[10px] uppercase tracking-[0.08em] text-ink-400">{label}</dt>
                <dd className="mt-0.5 truncate font-medium text-ink-100">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card>
          <CardHeader title="Этапы процесса" subtitle="Статусы берутся из источника" />
          <div className="space-y-2">
            {[
              ['Модерация', MODERATION_LABELS[order.moderation_status], order.moderation_status === 'approved'],
              ['Производство', PRODUCTION_LABELS[order.production_status], order.production_status === 'completed'],
              ['Доставка', DELIVERY_LABELS[order.delivery_status], order.delivery_status === 'delivered'],
            ].map(([label, value, done]) => (
              <div
                key={label as string}
                className="flex items-center justify-between rounded-md border border-ink-700/60 bg-ink-850/50 px-2.5 py-1.5"
              >
                <span className="text-[11px] text-ink-300">{label}</span>
                <Badge tone={done ? 'ok' : 'info'}>{value as string}</Badge>
              </div>
            ))}
            {order.has_defect && (
              <div className="flex items-center gap-1.5 rounded-md border border-signal-warn/40 bg-signal-warn/10 px-2.5 py-1.5 text-[11px] text-signal-warn">
                <XCircle className="h-3.5 w-3.5" /> Заказ с браком — доступна перепечатка
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Сквозной процесс"
          subtitle="Сигнал спроса → клиент → заказ → модерация → производство → доставка → поддержка"
        />
        <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {PROCESS_STAGES.map((stage, index) => {
            const info = stageState(events, stage.key);
            const Icon = stage.icon;
            return (
              <li
                key={stage.key}
                className={cn(
                  'rounded-lg border p-2.5',
                  info.state === 'done'
                    ? 'border-signal-ok/30 bg-signal-ok/8'
                    : 'border-ink-700/60 bg-ink-850/40',
                )}
              >
                <div className="flex items-center gap-1.5">
                  <Icon
                    className={cn('h-3.5 w-3.5', info.state === 'done' ? 'text-signal-ok' : 'text-ink-400')}
                    aria-hidden
                  />
                  <span className="text-[11px] font-medium text-ink-100">
                    {index + 1}. {stage.label}
                  </span>
                </div>
                {info.event ? (
                  <>
                    <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-ink-300">{info.event.result}</p>
                    <p className="mt-0.5 text-[10px] text-ink-500">{formatDateTime(info.event.occurred_at)}</p>
                  </>
                ) : (
                  <p className="mt-1 text-[10px] text-ink-500">Нет данных</p>
                )}
              </li>
            );
          })}
        </ol>
      </Card>

      <Card>
        <CardHeader
          title="История событий"
          subtitle={`${events.length} событий · сортировка по времени`}
          icon={<CalendarClock className="h-4 w-4" />}
        />
        {eventsQuery.isLoading && <p className="py-6 text-center text-xs text-ink-400">Загрузка событий…</p>}
        {eventsQuery.error && (
          <ErrorState
            title="События недоступны"
            message={toApiError(eventsQuery.error).message}
            onRetry={() => void eventsQuery.refetch()}
          />
        )}
        {events.length === 0 && !eventsQuery.isLoading && (
          <p className="py-6 text-center text-xs text-ink-400">События по заказу отсутствуют в источнике.</p>
        )}
        <ol className="relative space-y-3 border-l border-ink-700/70 pl-4">
          {events.map((event) => (
            <li key={event.id} className="relative">
              <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-accent-400 ring-4 ring-ink-900" />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium text-ink-50">{event.result}</p>
                <span className="text-[10px] text-ink-500">{formatDateTime(event.occurred_at)}</span>
              </div>
              <p className="mt-0.5 text-[11px] text-ink-400">
                {event.event_type} · источник: {event.source_system}
                {event.actor ? ` · ${event.actor.full_name}` : ''}
              </p>
              {event.description && <p className="mt-0.5 text-[11px] text-ink-300">{event.description}</p>}
              {event.cause && (
                <p className="mt-0.5 text-[11px] text-signal-warn">Причина: {event.cause}</p>
              )}
              {event.old_status && event.new_status && (
                <p className="mt-0.5 font-mono text-[10px] text-ink-500">
                  {event.old_status} → {event.new_status}
                </p>
              )}
            </li>
          ))}
        </ol>
      </Card>

      <p className="px-1 text-[11px] text-ink-500">
        Срок: {formatDate(order.due_at)}. Изменения выполняются через API с передачей version.
      </p>
    </div>
  );
}
