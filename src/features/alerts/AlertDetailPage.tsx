import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BellRing, CheckCircle2, Eye, Gauge, Lightbulb, ListChecks, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ErrorState, LoadingState } from '@/components/feedback/States';
import { alertsApi } from '@/lib/api/endpoints';
import { toApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/auth-context';
import { ALERT_STATUS_LABELS, ALERT_STATUS_TONES, AUDIT_ACTION_LABELS } from '@/constants/labels';
import { METRIC_STATUS_LABELS, METRIC_STATUS_HINT } from '@/constants/metrics';
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatPercent,
  formatSignedPercent,
  formatUnit,
} from '@/lib/formatters';
import type { AlertStatus } from '@/types/api';

const STATUS_TONE = { normal: 'ok', warning: 'warn', critical: 'bad', no_data: 'idle' } as const;

export function AlertDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { can } = useAuth();

  const query = useQuery({
    queryKey: ['alert', id],
    queryFn: async () => (await alertsApi.get(id as string)).data,
    enabled: Boolean(id),
  });

  const history = useQuery({
    queryKey: ['alert-history', id],
    queryFn: async () => alertsApi.history(id as string, { page_size: 30 }),
    enabled: Boolean(id),
  });

  const mutation = useMutation({
    mutationFn: async (status: AlertStatus) => alertsApi.updateStatus(id as string, status),
    onSuccess: (response) => {
      toast.success(`Статус изменён: ${ALERT_STATUS_LABELS[response.data.status]}`);
      void queryClient.invalidateQueries({ queryKey: ['alert', id] });
      void queryClient.invalidateQueries({ queryKey: ['alert-history', id] });
      void queryClient.invalidateQueries({ queryKey: ['alerts'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error) => toast.error(toApiError(error).message),
  });

  if (query.isLoading) return <LoadingState label="Загружаем карточку отклонения…" />;
  if (query.error) {
    return <ErrorState message={toApiError(query.error).message} onRetry={() => void query.refetch()} />;
  }

  const detail = query.data;
  if (!detail) return null;
  const { alert, metric } = detail;
  const canManage = can('decisions.write');
  const isTerminal = alert.status === 'resolved';

  return (
    <div className="space-y-4">
      <PageHeader
        title={alert.title}
        description={alert.description}
        meta={
          <>
            <Badge tone={ALERT_STATUS_TONES[alert.status]} dot>
              {ALERT_STATUS_LABELS[alert.status]}
            </Badge>
            <Badge tone="bad">{formatSignedPercent(alert.deviation_percent)} к плану</Badge>
            <Badge tone="idle">{alert.department_name ?? 'Компания'}</Badge>
            {alert.product_name && <Badge tone="info">{alert.product_name}</Badge>}
          </>
        }
        actions={
          <>
            <Link to="/alerts">
              <Button variant="ghost" size="sm" icon={<ArrowLeft className="h-3.5 w-3.5" />}>
                К реестру
              </Button>
            </Link>
            {canManage && alert.status === 'active' && (
              <Button
                variant="secondary"
                size="sm"
                loading={mutation.isPending}
                icon={<Eye className="h-3.5 w-3.5" />}
                onClick={() => mutation.mutate('acknowledged')}
              >
                Подтвердить ознакомление
              </Button>
            )}
            {canManage && !isTerminal && (
              <Button
                variant="primary"
                size="sm"
                loading={mutation.isPending}
                icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                onClick={() => mutation.mutate('resolved')}
              >
                Отметить устранённым
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Показатель и контекст отклонения"
            subtitle="Значения фиксируются на момент открытия сигнала"
            icon={<Gauge className="h-4 w-4" />}
          />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs sm:grid-cols-3">
            {[
              ['Показатель', metric.name],
              ['Единица', metric.unit],
              ['Период', `${formatDate(alert.period_start)} — ${formatDate(alert.period_end)}`],
              ['Факт на момент открытия', formatUnit(alert.opening_actual, metric.unit)],
              ['План на момент открытия', formatUnit(alert.opening_target, metric.unit)],
              ['Отклонение', formatSignedPercent(alert.deviation_percent)],
              ['Факт (актуальный)', formatUnit(alert.actual, metric.unit)],
              ['План (актуальный)', formatUnit(alert.target, metric.unit)],
              ['Статус показателя', METRIC_STATUS_LABELS[metric.status]],
              ['Подразделение', alert.department_name ?? 'Компания'],
              ['Продукт', alert.product_name ?? 'Все продукты'],
              ['Создано', formatDateTime(alert.created_at)],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-[0.625rem] uppercase tracking-[0.08em] text-ink-400">{label}</dt>
                <dd className="mt-0.5 truncate font-medium text-ink-100">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-ink-800/80 pt-3">
            <Badge tone={STATUS_TONE[metric.status]} title={METRIC_STATUS_HINT[metric.status]}>
              {METRIC_STATUS_LABELS[metric.status]}
            </Badge>
            <span className="text-[0.6875rem] text-ink-400">{metric.formula}</span>
            <Link to={`/metrics/${metric.code}`} className="link-quiet ml-auto text-[0.6875rem]">
              Открыть показатель
            </Link>
          </div>
        </Card>

        <Card>
          <CardHeader title="Причины и гипотезы" icon={<Lightbulb className="h-4 w-4" />} />
          <ul className="space-y-2">
            {detail.causes.map((cause) => (
              <li
                key={cause.text}
                className="rounded-md border border-ink-700/60 bg-ink-850/50 p-2.5 text-[0.6875rem] leading-relaxed text-ink-200"
              >
                <div className="flex items-start justify-between gap-2">
                  <span>{cause.text}</span>
                  <Badge tone={cause.confirmed ? 'ok' : 'warn'}>{cause.confirmed ? 'подтверждена' : 'требует проверки'}</Badge>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-3 space-y-2">
            <Link to={`/decisions/new?alert_id=${alert.id}`}>
              <Button variant="primary" size="sm" className="w-full" icon={<ShieldCheck className="h-3.5 w-3.5" />}>
                Создать решение по отклонению
              </Button>
            </Link>
            <Link to={`/metrics/${metric.code}`}>
              <Button variant="outline" size="sm" className="w-full">
                Детализация показателя
              </Button>
            </Link>
          </div>
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Связанные решения"
            subtitle={`${detail.decisions.length} решений по этому сигналу`}
            icon={<ShieldCheck className="h-4 w-4" />}
          />
          {detail.decisions.length === 0 ? (
            <p className="py-4 text-center text-xs text-ink-400">
              Решение ещё не создано. Отклонение без решения остаётся открытым.
            </p>
          ) : (
            <ul className="space-y-2">
              {detail.decisions.map((decision) => (
                <li key={decision.id}>
                  <Link
                    to={`/decisions/${decision.id}`}
                    className="flex items-center justify-between gap-2 rounded-md border border-ink-700/60 bg-ink-850/50 px-2.5 py-2 text-xs transition hover:border-accent-400/40 hover:text-accent-200"
                  >
                    <span className="truncate text-ink-100">{decision.name}</span>
                    <Badge tone="accent">открыть</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Связанные задачи"
            subtitle={`${detail.tasks.length} задач по этому сигналу`}
            icon={<ListChecks className="h-4 w-4" />}
          />
          {detail.tasks.length === 0 ? (
            <p className="py-4 text-center text-xs text-ink-400">Задачи по этому отклонению не создавались.</p>
          ) : (
            <ul className="space-y-2">
              {detail.tasks.map((task) => (
                <li key={task.id}>
                  <Link
                    to={`/tasks/${task.id}`}
                    className="flex items-center justify-between gap-2 rounded-md border border-ink-700/60 bg-ink-850/50 px-2.5 py-2 text-xs transition hover:border-accent-400/40 hover:text-accent-200"
                  >
                    <span className="truncate text-ink-100">{task.name}</span>
                    <Badge tone="accent">открыть</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Заказы в контексте отклонения"
          subtitle="Записи источника, попавшие в период и фильтры сигнала"
          icon={<BellRing className="h-4 w-4" />}
        />
        {detail.related_orders.length === 0 ? (
          <p className="py-4 text-center text-xs text-ink-400">Связанных заказов не найдено.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-shell min-w-[520px]">
              <thead>
                <tr>
                  <th>Заказ</th>
                  <th className="text-right">Сумма</th>
                  <th className="text-right">Карточка</th>
                </tr>
              </thead>
              <tbody>
                {detail.related_orders.map((order) => (
                  <tr key={order.id}>
                    <td className="text-xs">{order.label}</td>
                    <td className="whitespace-nowrap text-right text-xs">{formatMoney(order.amount)}</td>
                    <td className="text-right">
                      <Link to={`/orders/${order.id}`} className="link-quiet text-xs">
                        открыть
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          title="История изменения статуса"
          subtitle="Все действия по сигналу фиксируются в журнале"
        />
        {history.isLoading && <p className="py-4 text-center text-xs text-ink-400">Загрузка истории…</p>}
        {history.error && (
          <ErrorState
            title="История недоступна"
            message={toApiError(history.error).message}
            onRetry={() => void history.refetch()}
          />
        )}
        {history.data && history.data.items.length === 0 && (
          <p className="py-4 text-center text-xs text-ink-400">Изменений ещё не было.</p>
        )}
        {history.data && history.data.items.length > 0 && (
          <ol className="relative space-y-3 border-l border-ink-700/70 pl-4">
            {history.data.items.map((event) => (
              <li key={event.id} className="relative">
                <span className="absolute -left-[1.3125rem] top-1.5 h-2 w-2 rounded-full bg-accent-400 ring-4 ring-ink-900" />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-medium text-ink-50">
                    {AUDIT_ACTION_LABELS[event.action] ?? event.action}
                  </p>
                  <span className="text-[0.625rem] text-ink-500">{formatDateTime(event.created_at)}</span>
                </div>
                <p className="mt-0.5 text-[0.6875rem] text-ink-400">
                  {event.changed_by?.full_name ?? 'Система'}
                  {event.old_values.status ? ` · ${String(event.old_values.status)} → ${String(event.new_values.status)}` : ''}
                </p>
                {event.comment && <p className="mt-0.5 text-[0.6875rem] text-ink-300">{event.comment}</p>}
              </li>
            ))}
          </ol>
        )}
      </Card>

      <p className="px-1 text-[0.6875rem] text-ink-500">
        Отклонение {alert.status === 'resolved' ? 'закрыто' : 'остаётся открытым'} · обновлено{' '}
        {formatDateTime(alert.updated_at)} · фактическое значение показателя: {formatUnit(alert.actual, metric.unit)}
        {alert.deviation_percent !== null && ` (${formatPercent(alert.deviation_percent)} от плана)`}
      </p>
    </div>
  );
}
