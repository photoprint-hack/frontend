import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Banknote, Building2, PieChart, Users, Wallet } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { GlobalFilters } from '@/components/filters/GlobalFilters';
import { useFilters } from '@/components/filters/FiltersContext';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CardSkeletonGrid, ErrorState } from '@/components/feedback/States';
import { financeApi } from '@/lib/api/endpoints';
import { toApiError } from '@/lib/api/client';
import { formatDate, formatDateTime, formatMoney, formatNumber, formatPercent } from '@/lib/formatters';
import { cn } from '@/lib/utils/cn';
import type { PlanFactRow } from '@/types/api';

type Block = 'bdr' | 'bdds';

function achievementTone(value: number | null): 'ok' | 'warn' | 'bad' | 'idle' {
  if (value === null) return 'idle';
  if (value >= 95) return 'ok';
  if (value >= 85) return 'warn';
  return 'bad';
}

function PlanFactTable({
  title,
  subtitle,
  icon,
  rows,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  rows: { label: string; row: PlanFactRow; emphasis?: boolean }[];
}) {
  return (
    <Card className="p-0">
      <div className="p-4 pb-0">
        <CardHeader title={title} subtitle={subtitle} icon={icon} />
      </div>
      <div className="overflow-x-auto">
        <table className="table-shell min-w-[640px]">
          <thead>
            <tr>
              <th>Статья</th>
              <th className="text-right">План</th>
              <th className="text-right">Факт</th>
              <th className="text-right">Отклонение</th>
              <th className="text-right">Выполнение</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ label, row, emphasis }) => (
              <tr key={label} className={cn(emphasis && 'bg-ink-850/60')}>
                <td className={cn('text-xs', emphasis ? 'font-semibold text-ink-50' : 'text-ink-200')}>{label}</td>
                <td className="whitespace-nowrap text-right text-xs text-ink-300">{formatMoney(row.plan)}</td>
                <td className="whitespace-nowrap text-right text-xs font-medium">{formatMoney(row.fact)}</td>
                <td
                  className={cn(
                    'whitespace-nowrap text-right text-xs',
                    row.deviation === null
                      ? 'text-ink-500'
                      : row.deviation < 0
                        ? 'text-signal-bad'
                        : 'text-signal-ok',
                  )}
                >
                  {row.deviation === null ? '—' : formatMoney(row.deviation)}
                </td>
                <td className="text-right">
                  <Badge tone={achievementTone(row.achievement_percent)}>
                    {formatPercent(row.achievement_percent)}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="px-4 py-2.5 text-[11px] text-ink-500">
        План берётся из таблицы планов периода. Значения отображаются как есть, без пересчёта на клиенте.
      </p>
    </Card>
  );
}

export function FinanceHrPage() {
  const { queryParams } = useFilters();
  const [block, setBlock] = useState<Block>('bdr');

  const finance = useQuery({
    queryKey: ['finance-summary', queryParams],
    queryFn: async () => (await financeApi.summary(queryParams)).data,
  });

  const hr = useQuery({
    queryKey: ['hr-summary', queryParams],
    queryFn: async () => (await financeApi.hrSummary(queryParams)).data,
  });

  const error = finance.error ? toApiError(finance.error) : hr.error ? toApiError(hr.error) : null;
  const data = finance.data;
  const hrData = hr.data;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Финансы и персонал"
        description="БДР и БДДС план/факт, валовая маржа, операционные расходы и обеспеченность персоналом по последнему снимку HR."
        meta={
          data ? (
            <>
              <Badge tone="idle">
                {formatDate(data.context.date_from)} — {formatDate(data.context.date_to)}
              </Badge>
              <Badge tone="accent" dot>
                Обновлено {formatDateTime(data.updated_at)}
              </Badge>
              {data.context.ignored_filters.includes('product_id') && (
                <Badge tone="warn" title="Финансовые блоки не детализируются по продукту">
                  Фильтр продукта не применён
                </Badge>
              )}
            </>
          ) : null
        }
      />

      <GlobalFilters />

      {(finance.isLoading || hr.isLoading) && <CardSkeletonGrid count={6} />}
      {error && (
        <ErrorState
          message={error.message}
          onRetry={() => {
            void finance.refetch();
            void hr.refetch();
          }}
        />
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-5">
            {[
              { label: 'Оборот', value: formatMoney(data.revenue) },
              { label: 'Валовая прибыль', value: formatMoney(data.gross_profit) },
              { label: 'Валовая маржа', value: formatPercent(data.gross_margin_percent) },
              { label: 'Прямые затраты', value: formatMoney(data.direct_cost) },
              { label: 'Операционные расходы', value: formatMoney(data.operating_cost) },
            ].map((tile) => (
              <div key={tile.label} className="rounded-lg border border-ink-700/70 bg-ink-850/60 p-3">
                <p className="text-[11px] uppercase tracking-[0.08em] text-ink-400">{tile.label}</p>
                <p className="mt-1 truncate text-base font-semibold leading-none text-ink-50">{tile.value}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={block === 'bdr' ? 'primary' : 'ghost'}
              icon={<PieChart className="h-3.5 w-3.5" />}
              onClick={() => setBlock('bdr')}
            >
              БДР — доходы и расходы
            </Button>
            <Button
              size="sm"
              variant={block === 'bdds' ? 'primary' : 'ghost'}
              icon={<Wallet className="h-3.5 w-3.5" />}
              onClick={() => setBlock('bdds')}
            >
              БДДС — движение денег
            </Button>
            <Link to="/metrics/gross_margin" className="ml-auto">
              <Button size="sm" variant="outline">
                Детализация маржи
              </Button>
            </Link>
          </div>

          {block === 'bdr' ? (
            <PlanFactTable
              title="БДР: план и факт"
              subtitle="Доходы, прямые и операционные расходы, прибыль"
              icon={<Banknote className="h-4 w-4" />}
              rows={[
                { label: 'Выручка', row: data.bdr.revenue },
                { label: 'Прямые затраты', row: data.bdr.direct_cost },
                { label: 'Операционные расходы', row: data.bdr.operating_cost },
                { label: 'Прибыль', row: data.bdr.profit, emphasis: true },
              ]}
            />
          ) : (
            <PlanFactTable
              title="БДДС: план и факт"
              subtitle="Поступления, выплаты и чистый денежный поток"
              icon={<Wallet className="h-4 w-4" />}
              rows={[
                { label: 'Поступления', row: data.bdds.inflow },
                { label: 'Выплаты', row: data.bdds.outflow },
                { label: 'Чистый поток', row: data.bdds.net, emphasis: true },
              ]}
            />
          )}
        </>
      )}

      {hrData && (
        <Card>
          <CardHeader
            title="Персонал и обеспеченность"
            subtitle={
              hrData.snapshot_dates.length > 0
                ? `Последний снимок HR: ${formatDate(hrData.snapshot_dates[hrData.snapshot_dates.length - 1])}`
                : 'Снимки HR за выбранный период отсутствуют'
            }
            icon={<Users className="h-4 w-4" />}
            action={
              <Link to="/metrics/staffing_coverage">
                <Button size="sm" variant="outline">
                  Показатель
                </Button>
              </Link>
            }
          />
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
            {[
              { label: 'План штата', value: formatNumber(hrData.planned_headcount) },
              { label: 'Факт штата', value: formatNumber(hrData.actual_headcount) },
              { label: 'Доступно', value: formatNumber(hrData.available_headcount) },
              { label: 'Требуется', value: formatNumber(hrData.required_headcount) },
              { label: 'Вакансии', value: formatNumber(hrData.vacancies_count) },
              { label: 'Отсутствия', value: formatNumber(hrData.absences_count) },
            ].map((tile) => (
              <div key={tile.label} className="rounded-lg border border-ink-700/70 bg-ink-850/60 p-2.5">
                <p className="text-[10px] uppercase tracking-[0.08em] text-ink-400">{tile.label}</p>
                <p className="mt-1 text-base font-semibold leading-none text-ink-50">{tile.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink-700/70 bg-ink-850/50 p-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-accent-300" aria-hidden />
              <span className="text-xs text-ink-200">Обеспеченность персоналом</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-40 overflow-hidden rounded-full bg-ink-700/70">
                <div
                  className={cn(
                    'h-full rounded-full',
                    (hrData.staffing_coverage_percent ?? 0) >= 95
                      ? 'bg-signal-ok'
                      : (hrData.staffing_coverage_percent ?? 0) >= 85
                        ? 'bg-signal-warn'
                        : 'bg-signal-bad',
                  )}
                  style={{ width: `${Math.min(100, Math.max(0, hrData.staffing_coverage_percent ?? 0))}%` }}
                />
              </div>
              <Badge
                tone={
                  hrData.staffing_coverage_percent === null
                    ? 'idle'
                    : hrData.staffing_coverage_percent >= 95
                      ? 'ok'
                      : hrData.staffing_coverage_percent >= 85
                        ? 'warn'
                        : 'bad'
                }
              >
                {formatPercent(hrData.staffing_coverage_percent)}
              </Badge>
            </div>
          </div>

          {hrData.context.ignored_filters.includes('product_id') && (
            <p className="mt-2 text-[11px] text-ink-500">
              Кадровые показатели не детализируются по продукту — фильтр продукта игнорируется.
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
