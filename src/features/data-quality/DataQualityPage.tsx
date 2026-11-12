import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Database, RefreshCw, Scale, ServerCog } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { GlobalFilters } from '@/components/filters/GlobalFilters';
import { useFilters } from '@/components/filters/FiltersContext';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback/States';
import { dataQualityApi } from '@/lib/api/endpoints';
import { toApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/auth-context';
import { CHECK_TYPE_LABELS, SOURCE_LABELS } from '@/constants/labels';
import { formatDateTime, formatMoney, formatNumber, formatPercent, formatRelative } from '@/lib/formatters';
import { cn } from '@/lib/utils/cn';
import type { DataSource } from '@/types/api';

const SOURCE_STATUS: Record<DataSource['status'], { label: string; tone: 'ok' | 'warn' | 'bad' | 'idle' }> = {
  healthy: { label: 'В норме', tone: 'ok' },
  warning: { label: 'Предупреждение', tone: 'warn' },
  error: { label: 'Ошибка', tone: 'bad' },
  not_loaded: { label: 'Не загружен', tone: 'idle' },
};

const SEVERITY_TONE = { warning: 'warn', low: 'idle', medium: 'info', high: 'warn', critical: 'bad' } as const;
const SEVERITY_LABEL = { warning: 'Предупреждение', low: 'Низкая', medium: 'Средняя', high: 'Высокая', critical: 'Критическая' } as const;

export function DataQualityPage() {
  const { queryParams } = useFilters();
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const [issueSource, setIssueSource] = useState('');

  const overview = useQuery({
    queryKey: ['dq-overview', queryParams],
    queryFn: async () => (await dataQualityApi.overview(queryParams)).data,
  });

  const sources = useQuery({
    queryKey: ['dq-sources', queryParams],
    queryFn: async () => dataQualityApi.sources({ page_size: 20 }),
  });

  const issues = useQuery({
    queryKey: ['dq-issues', issueSource],
    queryFn: async () => dataQualityApi.issues({ page_size: 20, ...(issueSource ? { source: issueSource } : {}) }),
  });

  const reconciliation = useQuery({
    queryKey: ['dq-reconciliation', queryParams],
    queryFn: async () => (await dataQualityApi.reconciliation(queryParams)).data,
  });

  const runCheck = useMutation({
    mutationFn: async () => dataQualityApi.runCheck(),
    onSuccess: (response) => {
      toast.success(
        `Проверка выполнена: ${response.data.checks_run} проверок, открыто ${response.data.issues_opened}, закрыто ${response.data.issues_resolved}`,
      );
      void queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith('dq-') });
    },
    onError: (error) => toast.error(toApiError(error).message),
  });


  const error = overview.error ? toApiError(overview.error) : sources.error ? toApiError(sources.error) : null;
  const data = overview.data;
  const recon = reconciliation.data;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Качество данных"
        description="Состояние источников, полнота и дубликаты, открытые проверки и финансовая сверка ERP ↔ Finance."
        meta={
          data ? (
            <>
              <Badge tone="accent" dot>
                Проверено {formatDateTime(data.checked_at)}
              </Badge>
              <Badge tone={data.critical_issues > 0 ? 'bad' : 'ok'}>
                Критических проблем: {data.critical_issues}
              </Badge>
              <Badge tone="warn">Открытых проблем: {data.open_issues}</Badge>
            </>
          ) : null
        }
        actions={
          can('dataQuality.run') ? (
            <Button
              variant="primary"
              size="sm"
              icon={<RefreshCw className={cn('h-3.5 w-3.5', runCheck.isPending && 'animate-spin')} />}
              loading={runCheck.isPending}
              onClick={() => runCheck.mutate()}
            >
              Запустить проверку
            </Button>
          ) : (
            <Badge tone="idle">Только просмотр</Badge>
          )
        }
      />

      <GlobalFilters />

      {overview.isLoading && <LoadingState label="Загружаем состояние источников…" />}
      {error && <ErrorState message={error.message} onRetry={() => void overview.refetch()} />}

      {data && (
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          {[
            { label: 'Источников', value: formatNumber(data.sources_total), tone: 'text-ink-50' },
            { label: 'В норме', value: formatNumber(data.healthy_sources), tone: 'text-signal-ok' },
            { label: 'Устаревших', value: formatNumber(data.stale_sources), tone: 'text-signal-warn' },
            { label: 'Открытых проблем', value: formatNumber(data.open_issues), tone: 'text-signal-bad' },
          ].map((tile) => (
            <div key={tile.label} className="rounded-lg border border-ink-700/70 bg-ink-850/60 p-3">
              <p className="text-[0.6875rem] uppercase tracking-[0.08em] text-ink-400">{tile.label}</p>
              <p className={cn('mt-1 text-lg font-semibold leading-none', tile.tone)}>{tile.value}</p>
            </div>
          ))}
        </div>
      )}

      <Card className="p-0">
        <div className="p-4 pb-0">
          <CardHeader
            title="Источники данных"
            subtitle="Состояние синхронизации и статистика импорта"
            icon={<Database className="h-4 w-4" />}
          />
        </div>
        {sources.isLoading && <p className="py-6 text-center text-xs text-ink-400">Загрузка источников…</p>}
        {sources.data && sources.data.items.length === 0 && (
          <EmptyState title="Источники не настроены" description="Обратитесь к администратору платформы." />
        )}
        {sources.data && sources.data.items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="table-shell min-w-[980px]">
              <thead>
                <tr>
                  <th>Источник</th>
                  <th>Статус</th>
                  <th>Последняя синхронизация</th>
                  <th className="text-right">Записей</th>
                  <th className="text-right">Пропущено</th>
                  <th className="text-right">Дубликаты</th>
                  <th className="text-right">Ошибки</th>
                </tr>
              </thead>
              <tbody>
                {sources.data.items.map((source) => (
                  <tr key={source.id}>
                    <td>
                      <p className="text-xs font-medium text-ink-100">{source.name}</p>
                      <p className="text-[0.625rem] text-ink-500">
                        {SOURCE_LABELS[source.code] ?? source.code} · {source.source_type}
                      </p>
                    </td>
                    <td>
                      <div className="flex flex-col items-start gap-1">
                        <Badge tone={SOURCE_STATUS[source.status].tone} dot>
                          {SOURCE_STATUS[source.status].label}
                        </Badge>
                        {source.is_stale && <Badge tone="warn">устарел</Badge>}
                      </div>
                    </td>
                    <td className="whitespace-nowrap text-xs text-ink-300">
                      {source.last_sync_at ? formatRelative(source.last_sync_at) : 'не загружался'}
                    </td>
                    <td className="text-right text-xs">{formatNumber(source.records_count)}</td>
                    <td className="text-right text-xs">{formatNumber(source.records_skipped)}</td>
                    <td className="text-right text-xs">
                      <span className={source.duplicate_count > 0 ? 'text-signal-warn' : 'text-ink-300'}>
                        {formatNumber(source.duplicate_count)}
                      </span>
                    </td>
                    <td className="text-right text-xs">
                      <span className={source.error_count > 0 ? 'text-signal-bad' : 'text-ink-300'}>
                        {formatNumber(source.error_count)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Финансовая сверка"
            subtitle="Сравнение суммы заказов ERP и проводок финансов"
            icon={<Scale className="h-4 w-4" />}
          />
          {reconciliation.isLoading && <p className="py-4 text-center text-xs text-ink-400">Сверка выполняется…</p>}
          {reconciliation.error && (
            <ErrorState
              title="Сверка недоступна"
              message={toApiError(reconciliation.error).message}
              onRetry={() => void reconciliation.refetch()}
            />
          )}
          {recon && (
            <>
              <dl className="space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-ink-400">{recon.source_a.name}</dt>
                  <dd className="font-medium text-ink-100">{formatMoney(recon.source_a.amount)}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-ink-400">{recon.source_b.name}</dt>
                  <dd className="font-medium text-ink-100">{formatMoney(recon.source_b.amount)}</dd>
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-ink-800/80 pt-2">
                  <dt className="text-ink-400">Расхождение</dt>
                  <dd className="font-semibold text-ink-50">{formatMoney(recon.difference)}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-ink-400">Расхождение, %</dt>
                  <dd className="font-medium text-ink-100">{formatPercent(recon.difference_percent, 4)}</dd>
                </div>
              </dl>
              <div className="mt-3 flex items-center justify-between gap-2">
                <Badge
                  tone={recon.status === 'normal' ? 'ok' : recon.status === 'warning' ? 'warn' : recon.status === 'critical' ? 'bad' : 'idle'}
                  dot
                >
                  {recon.status === 'normal'
                    ? 'Расхождений нет'
                    : recon.status === 'warning'
                      ? 'Допустимое расхождение'
                      : recon.status === 'critical'
                        ? 'Критическое расхождение'
                        : 'Нет данных'}
                </Badge>
                <span className="text-[0.625rem] text-ink-500">Проверено {formatDateTime(recon.checked_at)}</span>
              </div>
              <p className="mt-2 text-[0.6875rem] leading-relaxed text-ink-500">
                Период сверки: {recon.period.date_from} — {recon.period.date_to}. Порог: до 1% — предупреждение, свыше
                1% — критическое расхождение.
              </p>
            </>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Проблемы качества"
            subtitle="Открытые проверки по источникам"
            icon={<AlertTriangle className="h-4 w-4" />}
            action={
              <select
                value={issueSource}
                onChange={(event) => setIssueSource(event.target.value)}
                aria-label="Источник проблем"
                className="h-8 rounded-md border border-ink-600 bg-ink-850 px-2 text-xs text-ink-100"
              >
                <option value="">Все источники</option>
                {Object.entries(SOURCE_LABELS)
                  .filter(([code]) => code !== 'system')
                  .map(([code, label]) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
              </select>
            }
          />
          {issues.isLoading && <p className="py-4 text-center text-xs text-ink-400">Загрузка проблем…</p>}
          {issues.data && issues.data.items.length === 0 && (
            <EmptyState title="Проблем нет" description="Все проверки качества данных пройдены." icon={<CheckCircle2 className="h-5 w-5 text-signal-ok" />} />
          )}
          <ul className="space-y-2">
            {issues.data?.items.map((issue) => (
              <li
                key={issue.id}
                className="rounded-lg border border-ink-700/60 bg-ink-850/50 p-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-medium text-ink-100">
                    {CHECK_TYPE_LABELS[issue.check_type] ?? issue.check_type}
                  </p>
                  <div className="flex shrink-0 items-center gap-1">
                    <Badge tone={SEVERITY_TONE[issue.severity]}>{SEVERITY_LABEL[issue.severity]}</Badge>
                    <Badge tone={issue.status === 'open' ? 'warn' : 'ok'}>
                      {issue.status === 'open' ? 'открыта' : 'закрыта'}
                    </Badge>
                  </div>
                </div>
                <p className="mt-1 text-[0.6875rem] leading-relaxed text-ink-300">{issue.description}</p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-[0.625rem] text-ink-500">
                  <span className="inline-flex items-center gap-1">
                    <ServerCog className="h-3 w-3" aria-hidden />
                    {SOURCE_LABELS[issue.source] ?? issue.source}
                  </span>
                  <span>·</span>
                  <span>затронуто записей: {formatNumber(issue.affected_records)}</span>
                  <span>·</span>
                  <span>{formatDateTime(issue.checked_at)}</span>
                </p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <p className="px-1 text-[0.6875rem] text-ink-500">
        Проверки выполняются на стороне Backend по расписанию и вручную. Импорт источника доступен только
        администратору, запуск проверки — администратору и аналитику.
      </p>
    </div>
  );
}
