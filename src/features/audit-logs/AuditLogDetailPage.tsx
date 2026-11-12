import { Link, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, FileClock, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { ErrorState, LoadingState } from '@/components/feedback/States';
import { auditLogsApi } from '@/lib/api/endpoints';
import { toApiError } from '@/lib/api/client';
import { AUDIT_ACTION_LABELS } from '@/constants/labels';
import { formatDateTime } from '@/lib/formatters';

function DetailField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0 rounded-lg border border-ink-700/60 bg-ink-850/45 p-3">
      <dt className="text-[0.625rem] font-medium uppercase tracking-[0.08em] text-ink-400">{label}</dt>
      <dd className={`mt-1 break-words text-xs text-ink-100 ${mono ? 'font-mono' : 'font-medium'}`}>{value}</dd>
    </div>
  );
}

function JsonPanel({ title, data }: { title: string; data: Record<string, unknown> | null }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-ink-700/70 bg-ink-900/50">
      <h3 className="border-b border-ink-700/60 px-3 py-2 text-[0.6875rem] font-semibold text-ink-200">{title}</h3>
      {data ? (
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all p-3 font-mono text-[0.6875rem] leading-relaxed text-ink-300">
          {JSON.stringify(data, null, 2)}
        </pre>
      ) : (
        <p className="p-3 text-xs text-ink-500">Для этой записи нет данных.</p>
      )}
    </section>
  );
}

export function AuditLogDetailPage() {
  const { id = '' } = useParams();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/audit-logs';
  const query = useQuery({
    queryKey: ['audit-log', id],
    queryFn: async () => (await auditLogsApi.get(id)).data,
    enabled: Boolean(id),
  });

  if (query.isLoading) return <LoadingState label="Загружаем запись аудита…" />;
  if (query.error) return <ErrorState message={toApiError(query.error).message} onRetry={() => void query.refetch()} />;
  const log = query.data;
  if (!log) return <ErrorState title="Запись не найдена" message="Проверьте ссылку или вернитесь в журнал действий." />;

  const actionLabel = AUDIT_ACTION_LABELS[log.action] ?? log.action;

  return (
    <div className="space-y-4">
      <PageHeader
        title={actionLabel}
        description="Подробная запись неизменяемого журнала аудита."
        meta={
          <>
            <Badge tone={log.status === 'success' ? 'ok' : 'bad'} dot>{log.status === 'success' ? 'Успешно' : 'Ошибка'}</Badge>
            <Badge tone="idle">{formatDateTime(log.created_at)}</Badge>
          </>
        }
        actions={
          <Link to={from}>
            <Button variant="outline" size="sm" icon={<ArrowLeft className="h-3.5 w-3.5" />}>К журналу</Button>
          </Link>
        }
      />

      <Card>
        <CardHeader title="Событие" subtitle={log.object_name ?? 'Системное действие'} icon={<FileClock className="h-4 w-4" />} />
        <dl className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <DetailField label="Пользователь" value={log.actor?.full_name ?? 'Система'} />
          <DetailField label="Тип актора" value={log.actor_type === 'system' ? 'Система' : 'Пользователь'} />
          <DetailField label="Тип объекта" value={log.object_type} />
          <DetailField label="ID объекта" value={log.object_id ?? '—'} mono />
          <DetailField label="Код действия" value={log.action} mono />
          <DetailField label="Время" value={formatDateTime(log.created_at)} />
          <DetailField label="IP-адрес" value={log.ip_address ?? '—'} mono />
          <DetailField label="Request ID" value={log.request_id} mono />
        </dl>
        {log.error_message && (
          <div className="mt-3 rounded-lg border border-signal-bad/30 bg-signal-bad/8 p-3">
            <p className="text-[0.625rem] font-medium uppercase tracking-wide text-signal-bad">Сообщение об ошибке</p>
            <p className="mt-1 text-xs text-ink-200">{log.error_message}</p>
          </div>
        )}
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        <JsonPanel title="До изменения" data={log.old_values} />
        <JsonPanel title="После изменения" data={log.new_values} />
      </div>

      <Card>
        <CardHeader title="Служебные данные" subtitle="Контекст запроса и дополнительные сведения" icon={<ShieldCheck className="h-4 w-4" />} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-[0.625rem] font-medium uppercase tracking-wide text-ink-400">Детали</p>
            <pre className="mt-1 max-h-56 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-ink-700/60 bg-ink-950/50 p-3 font-mono text-[0.6875rem] leading-relaxed text-ink-300">
              {log.details ? JSON.stringify(log.details, null, 2) : 'Дополнительных данных нет.'}
            </pre>
          </div>
          <div>
            <p className="text-[0.625rem] font-medium uppercase tracking-wide text-ink-400">Браузер / источник</p>
            <p className="mt-1 min-h-20 break-words rounded-lg border border-ink-700/60 bg-ink-950/50 p-3 text-[0.6875rem] leading-relaxed text-ink-300">
              {log.user_agent ?? 'Не указан'}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
