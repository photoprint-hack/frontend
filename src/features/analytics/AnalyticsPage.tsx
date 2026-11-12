import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownRight, ArrowUpRight, BarChart3, ExternalLink, Lock, Minus, RefreshCw, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { GlobalFilters } from '@/components/filters/GlobalFilters';
import { useFilters } from '@/components/filters/FiltersContext';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CardSkeletonGrid, EmptyState, ErrorState } from '@/components/feedback/States';
import { analyticsApi, metricsApi } from '@/lib/api/endpoints';
import { toApiError, USE_MOCKS } from '@/lib/api/client';
import { METRIC_STATUS_LABELS } from '@/constants/metrics';
import { formatDateTime, formatSignedPercent, formatUnit } from '@/lib/formatters';
import { cn } from '@/lib/utils/cn';

const CATEGORY_LABELS: Record<string, string> = {
  sales: 'Продажи',
  finance: 'Финансы',
  production: 'Производство',
  quality: 'Качество',
  support: 'Поддержка',
  hr: 'Персонал',
  system: 'Система',
};

const STATUS_TONE = {
  normal: 'ok',
  warning: 'warn',
  critical: 'bad',
  no_data: 'idle',
} as const;

/** Демо-контент вместо iframe, когда mock-API не выдаёт реальный signed URL. */
function MockBiPreview() {
  const bars = [
    { label: 'Январь', value: 62 },
    { label: 'Февраль', value: 71 },
    { label: 'Март', value: 58 },
    { label: 'Апрель', value: 83 },
    { label: 'Май', value: 76 },
    { label: 'Июнь', value: 91 },
    { label: 'Июль', value: 68 },
    { label: 'Август', value: 87 },
  ];
  return (
    <div className="rounded-lg border border-ink-700/70 bg-ink-850/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-ink-100">Дашборд Metabase · «Оборот и маржа по месяцам»</p>
          <p className="mt-0.5 text-[0.6875rem] text-ink-400">
            Демонстрационный график. После подключения Metabase здесь появится актуальная аналитика.
          </p>
        </div>
        <Badge tone="warn" dot>
          Демо-режим
        </Badge>
      </div>
      <div className="mt-4 flex h-44 items-end gap-2">
        {bars.map((bar) => (
          <div key={bar.label} className="flex flex-1 flex-col items-center gap-1.5">
            <div className="flex w-full flex-1 items-end">
              <div
                className="w-full rounded-t-sm bg-accent-500"
                style={{ height: `${bar.value}%` }}
                aria-hidden
              />
            </div>
            <span className="text-[0.625rem] text-ink-400">{bar.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AnalyticsPage() {
  const { queryParams } = useFilters();
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  const embed = useQuery({
    queryKey: ['metabase-embed', queryParams],
    queryFn: async () => {
      const response = await analyticsApi.metabaseEmbed(queryParams);
      setExpiresAt(response.data.expires_at);
      return response.data;
    },
    staleTime: 4 * 60_000,
    retry: false,
  });

  const metrics = useQuery({
    queryKey: ['metrics-analytics', queryParams],
    queryFn: async () => metricsApi.list({ ...queryParams, page_size: 50 }),
  });

  const grouped = useMemo(() => {
    const map = new Map<string, NonNullable<typeof metrics.data>['items']>();
    (metrics.data?.items ?? []).forEach((kpi) => {
      const list = map.get(kpi.category) ?? [];
      list.push(kpi);
      map.set(kpi.category, list);
    });
    return [...map.entries()];
  }, [metrics.data]);

  const embedError = embed.error ? toApiError(embed.error) : null;
  const embedUrl = embed.data?.embed_url ?? '';
  const isPlaceholder = USE_MOCKS || embedUrl.startsWith('about:blank');

  return (
    <div className="space-y-4">
      <PageHeader
        title="Аналитика"
        description="Встроенная BI-аналитика Metabase по подписанной ссылке и сводка показателей по категориям."
        meta={
          <>
            <Badge tone="accent" dot>
              Защищённое подключение
            </Badge>
            {expiresAt && <Badge tone="idle">Ссылка действует до {formatDateTime(expiresAt)}</Badge>}
          </>
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            icon={<RefreshCw className={cn('h-3.5 w-3.5', embed.isFetching && 'animate-spin')} />}
            loading={embed.isFetching}
            onClick={() => void embed.refetch()}
          >
            Обновить встраивание
          </Button>
        }
      />

      <GlobalFilters />

      <Card className="p-0">
        <div className="p-4 pb-0">
          <CardHeader
            title="Дашборд Metabase"
            subtitle="Отчёты обновляются с учётом выбранного периода и подразделения"
            icon={<BarChart3 className="h-4 w-4" />}
            action={
              <span className="flex items-center gap-1.5 text-[0.6875rem] text-ink-400">
                <Lock className="h-3 w-3" aria-hidden /> защищённый контур
              </span>
            }
          />
        </div>

        <div className="px-4 pb-4">
          {embed.isLoading && (
            <div className="flex h-56 items-center justify-center rounded-lg border border-ink-700/70 bg-ink-850/40 text-xs text-ink-400">
              Запрашиваем подписанную ссылку…
            </div>
          )}

          {embedError && (
            <div className="rounded-lg border border-signal-warn/40 bg-signal-warn/10 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-signal-warn">
                    <ShieldCheck className="h-4 w-4" aria-hidden />
                    {embedError.status === 503 ? 'BI-сервис временно недоступен' : 'Встраивание недоступно'}
                  </p>
                  <p className="mt-1 max-w-xl text-xs leading-relaxed text-ink-200">{embedError.message}</p>
                  <p className="mt-1.5 text-[0.6875rem] text-ink-400">
                    Публичная резервная ссылка намеренно не используется: дашборд доступен только по подписанному
                    URL. Повторите запрос позже или обратитесь к администратору.
                  </p>
                  {embedError.requestId && (
                    <p className="mt-1 font-mono text-[0.625rem] text-ink-500">request_id: {embedError.requestId}</p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  icon={<RefreshCw className="h-3.5 w-3.5" />}
                  loading={embed.isFetching}
                  onClick={() => void embed.refetch()}
                >
                  Повторить
                </Button>
              </div>
            </div>
          )}

          {embed.data && !embedError && (
            <div className="space-y-2">
              {isPlaceholder ? (
                <MockBiPreview />
              ) : (
                <iframe
                  title="BI-дашборд Metabase"
                  src={embedUrl}
                  className="h-[520px] w-full rounded-lg border border-ink-700/70 bg-ink-900"
                  referrerPolicy="no-referrer"
                  sandbox="allow-scripts allow-same-origin allow-popups"
                />
              )}
              <div className="flex flex-wrap items-center justify-between gap-2 text-[0.6875rem] text-ink-500">
                <span>
                  Срок действия ссылки: {formatDateTime(embed.data.expires_at)}. После истечения обновите встраивание.
                </span>
                {!isPlaceholder && (
                  <a
                    href={embedUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="link-quiet inline-flex items-center gap-1"
                  >
                    Открыть в новой вкладке <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </Card>

      {metrics.isLoading && <CardSkeletonGrid count={6} />}
      {metrics.error && (
        <ErrorState message={toApiError(metrics.error).message} onRetry={() => void metrics.refetch()} />
      )}

      {metrics.data && grouped.length === 0 && (
        <EmptyState
          title="Показатели не рассчитаны"
          description="Для выбранного контекста нет значений KPI. Измените период или фильтры."
        />
      )}

      {grouped.map(([category, items]) => (
        <Card key={category} className="p-0">
          <div className="p-4 pb-0">
            <CardHeader
              title={CATEGORY_LABELS[category] ?? category}
              subtitle={`${items.length} показателей в категории`}
              icon={<BarChart3 className="h-4 w-4" />}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="table-shell min-w-[720px]">
              <thead>
                <tr>
                  <th>Показатель</th>
                  <th className="text-right">Факт</th>
                  <th className="text-right">План</th>
                  <th className="text-right">Динамика к плану</th>
                  <th className="text-right">Прогноз</th>
                  <th>Статус</th>
                  <th>Источник</th>
                </tr>
              </thead>
              <tbody>
                {items.map((kpi) => (
                  <tr key={kpi.code}>
                    <td>
                      <Link to={`/metrics/${kpi.code}`} className="link-quiet text-xs font-medium">
                        {kpi.name}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap text-right text-xs font-medium">
                      {formatUnit(kpi.actual, kpi.unit)}
                    </td>
                    <td className="whitespace-nowrap text-right text-xs text-ink-300">
                      {formatUnit(kpi.target, kpi.unit)}
                    </td>
                    <td className="whitespace-nowrap text-right text-xs">
                      {kpi.deviation_percent === null || kpi.direction === 'none' ? (
                        <span className="text-ink-500">—</span>
                      ) : (
                        <span
                          className={cn(
                            'inline-flex items-center justify-end gap-1 font-medium',
                            (kpi.direction === 'lower_is_better'
                              ? kpi.deviation_percent <= 0
                              : kpi.deviation_percent >= 0)
                              ? 'text-signal-ok'
                              : 'text-signal-bad',
                          )}
                          title="Изменение факта относительно плана за выбранный период"
                        >
                          {kpi.deviation_percent > 0 ? (
                            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                          ) : kpi.deviation_percent < 0 ? (
                            <ArrowDownRight className="h-3.5 w-3.5" aria-hidden />
                          ) : (
                            <Minus className="h-3.5 w-3.5" aria-hidden />
                          )}
                          {formatSignedPercent(kpi.deviation_percent)}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap text-right text-xs text-accent-300">
                      {formatUnit(kpi.forecast, kpi.unit)}
                    </td>
                    <td>
                      <Badge tone={STATUS_TONE[kpi.status]} dot>
                        {METRIC_STATUS_LABELS[kpi.status]}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap text-[0.6875rem] text-ink-400">{kpi.source.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </div>
  );
}
