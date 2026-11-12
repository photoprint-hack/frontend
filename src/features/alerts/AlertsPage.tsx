import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, BellRing, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { GlobalFilters } from '@/components/filters/GlobalFilters';
import { useFilters } from '@/components/filters/FiltersContext';
import { DataTable, Pagination, type Column } from '@/components/tables/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SearchInput, Select } from '@/components/ui/Field';
import { ErrorState } from '@/components/feedback/States';
import { alertsApi } from '@/lib/api/endpoints';
import { toApiError } from '@/lib/api/client';
import { ALERT_STATUS_LABELS, ALERT_STATUS_TONES } from '@/constants/labels';
import { formatDate, formatDateTime, formatPercent, formatSignedPercent } from '@/lib/formatters';
import type { Alert, AlertStatus } from '@/types/api';

const STATUS_ORDER: AlertStatus[] = ['active', 'acknowledged', 'resolved'];

export function AlertsPage() {
  const { queryParams } = useFilters();
  const navigate = useNavigate();
  const [status, setStatus] = useState<string>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const query = useQuery({
    queryKey: ['alerts', queryParams, status, search, page, pageSize],
    queryFn: async () =>
      alertsApi.list({
        ...queryParams,
        page,
        page_size: pageSize,
        ...(status ? { status } : {}),
        ...(search ? { search } : {}),
      }),
    placeholderData: (previous) => previous,
  });

  const counts = useQuery({
    queryKey: ['alerts-counts', queryParams],
    queryFn: async () => {
      const response = await alertsApi.list({ ...queryParams, page_size: 100 });
      return response.items.reduce<Record<string, number>>((acc, alert) => {
        acc[alert.status] = (acc[alert.status] ?? 0) + 1;
        return acc;
      }, {});
    },
  });

  const columns: Column<Alert>[] = [
    {
      key: 'title',
      header: 'Отклонение',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-ink-50">{row.title}</p>
          <p className="mt-0.5 line-clamp-1 text-[0.6875rem] text-ink-400">{row.description}</p>
        </div>
      ),
    },
    {
      key: 'metric_name',
      header: 'Показатель',
      render: (row) => (
        <Link
          to={`/metrics/${row.metric_code}`}
          onClick={(event) => event.stopPropagation()}
          className="link-quiet text-xs"
        >
          {row.metric_name}
        </Link>
      ),
    },
    {
      key: 'deviation_percent',
      header: 'Отклонение',
      align: 'right',
      render: (row) => (
        <span className="whitespace-nowrap text-xs font-semibold text-signal-bad">
          {formatSignedPercent(row.deviation_percent)}
        </span>
      ),
    },
    {
      key: 'values',
      header: 'Факт / план',
      align: 'right',
      render: (row) => (
        <span className="whitespace-nowrap text-xs text-ink-300">
          {formatPercent(row.actual)} / {formatPercent(row.target)}
        </span>
      ),
    },
    {
      key: 'department_name',
      header: 'Подразделение',
      render: (row) => <span className="text-xs text-ink-300">{row.department_name ?? 'Компания'}</span>,
    },
    {
      key: 'period',
      header: 'Период',
      render: (row) => (
        <span className="whitespace-nowrap text-[0.6875rem] text-ink-400">
          {formatDate(row.period_start)} — {formatDate(row.period_end)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Статус',
      render: (row) => (
        <div className="flex flex-col items-start gap-1">
          <Badge tone={ALERT_STATUS_TONES[row.status]} dot>
            {ALERT_STATUS_LABELS[row.status]}
          </Badge>
          {row.has_decision && <Badge tone="accent">есть решение</Badge>}
        </div>
      ),
    },
    {
      key: 'created_at',
      header: 'Создано',
      render: (row) => (
        <span className="whitespace-nowrap text-[0.6875rem] text-ink-500">{formatDateTime(row.created_at)}</span>
      ),
    },
  ];

  const error = query.error ? toApiError(query.error) : null;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Отклонения показателей"
        description="Критические сигналы платформы: что вышло за границы, на сколько, в каком подразделении и есть ли уже решение."
        meta={
          query.data ? (
            <>
              <Badge tone="idle">Найдено {query.data.total}</Badge>
              {STATUS_ORDER.map((code) => (
                <Badge key={code} tone={ALERT_STATUS_TONES[code]}>
                  {ALERT_STATUS_LABELS[code]}: {counts.data?.[code] ?? 0}
                </Badge>
              ))}
            </>
          ) : null
        }
        actions={
          <Link to="/decisions/new">
            <Button variant="primary" size="sm" icon={<ShieldCheck className="h-3.5 w-3.5" />}>
              Создать решение
            </Button>
          </Link>
        }
      />

      <GlobalFilters />

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Поиск по названию или описанию"
          className="w-full sm:w-80"
        />
        <Select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
          aria-label="Статус отклонения"
          className="w-full sm:w-56"
        >
          <option value="">Все статусы</option>
          {STATUS_ORDER.map((code) => (
            <option key={code} value={code}>
              {ALERT_STATUS_LABELS[code]}
            </option>
          ))}
        </Select>
        {(search || status) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch('');
              setStatus('');
              setPage(1);
            }}
          >
            Сбросить
          </Button>
        )}
        <span className="ml-auto inline-flex items-center gap-1.5 text-[0.6875rem] text-ink-500">
          <BellRing className="h-3 w-3" aria-hidden />
          Статус меняется из карточки отклонения
        </span>
      </div>

      {error && <ErrorState message={error.message} onRetry={() => void query.refetch()} />}

      {!error && (
        <DataTable
          columns={columns}
          rows={query.data?.items}
          rowKey={(row) => row.id}
          loading={query.isLoading}
          onRowClick={(row) => navigate(`/alerts/${row.id}`)}
          emptyTitle="Отклонений нет"
          emptyDescription="В выбранном контексте показатели находятся в пределах допустимых значений."
          emptyAction={
            <Link to="/dashboard">
              <Button variant="outline" size="sm" icon={<ArrowRight className="h-3.5 w-3.5" />}>
                К обзору компании
              </Button>
            </Link>
          }
          footer={
            query.data ? (
              <Pagination
                page={query.data.page}
                pages={query.data.pages}
                total={query.data.total}
                pageSize={query.data.page_size}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
              />
            ) : null
          }
        />
      )}

      <CardNote />
    </div>
  );
}

function CardNote() {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-ink-700/70 bg-ink-900/50 p-3 text-[0.6875rem] leading-relaxed text-ink-400">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-signal-warn" aria-hidden />
      <p>
        Отклонение создаётся автоматически при выходе показателя за допустимый коридор. Значения «факт / план»
        фиксируются на момент открытия сигнала и не пересчитываются задним числом. Счётчики в шапке показывают
        количество сигналов по статусам.
      </p>
    </div>
  );
}
