import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDownRight, ArrowUpRight, BarChart3, Minus, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { GlobalFilters } from '@/components/filters/GlobalFilters';
import { useFilters } from '@/components/filters/FiltersContext';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CardSkeletonGrid, EmptyState, ErrorState } from '@/components/feedback/States';
import { metricsApi } from '@/lib/api/endpoints';
import { toApiError } from '@/lib/api/client';
import { METRIC_STATUS_LABELS } from '@/constants/metrics';
import { formatSignedPercent, formatUnit } from '@/lib/formatters';
import { cn } from '@/lib/utils/cn';
import { AnalyticsCharts } from './AnalyticsCharts';

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

export function AnalyticsPage() {
  const { queryParams } = useFilters();
  const queryClient = useQueryClient();
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

  return (
    <div className="space-y-4">
      <PageHeader
        title="Аналитика"
        description="Динамика показателей, продажи по каналам и план/факт производства."
        actions={<Button variant="outline" size="sm" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={() => void queryClient.invalidateQueries()}>Обновить данные</Button>}
      />
      <GlobalFilters />
      <AnalyticsCharts params={queryParams} kpis={metrics.data?.items ?? []} />

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
