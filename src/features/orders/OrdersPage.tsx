import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Download, Package } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { GlobalFilters } from '@/components/filters/GlobalFilters';
import { useFilters } from '@/components/filters/FiltersContext';
import { DataTable, Pagination, type Column } from '@/components/tables/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SearchInput, Select } from '@/components/ui/Field';
import { ErrorState } from '@/components/feedback/States';
import { ordersApi } from '@/lib/api/endpoints';
import { toApiError } from '@/lib/api/client';
import { CHANNEL_LABELS, ORDER_STATUS_LABELS, ORDER_STATUS_TONES } from '@/constants/labels';
import { formatDate, formatMoney } from '@/lib/formatters';
import type { Order } from '@/types/api';

export function OrdersPage() {
  const { queryParams } = useFilters();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const query = useQuery({
    queryKey: ['orders', queryParams, search, status, page, pageSize, sortBy, sortOrder],
    queryFn: async () =>
      ordersApi.list({
        ...queryParams,
        page,
        page_size: pageSize,
        sort_by: sortBy,
        sort_order: sortOrder,
        ...(search ? { search } : {}),
        ...(status ? { status } : {}),
      }),
    placeholderData: (previous) => previous,
  });

  const columns = useMemo<Column<Order>[]>(
    () => [
      {
        key: 'order_number',
        header: 'Номер',
        sortable: true,
        render: (row) => <span className="font-mono text-xs font-medium text-accent-300">{row.order_number}</span>,
      },
      {
        key: 'customer_name',
        header: 'Клиент',
        render: (row) => (
          <Link
            to={`/customers/${row.customer_id}`}
            onClick={(event) => event.stopPropagation()}
            className="link-quiet text-xs"
          >
            {row.customer_name}
          </Link>
        ),
      },
      { key: 'product_name', header: 'Продукт', render: (row) => <span className="text-xs">{row.product_name}</span> },
      {
        key: 'department_name',
        header: 'Подразделение',
        render: (row) => <span className="text-xs text-ink-300">{row.department_name}</span>,
      },
      {
        key: 'channel',
        header: 'Канал',
        render: (row) => <span className="text-xs text-ink-300">{CHANNEL_LABELS[row.channel] ?? row.channel}</span>,
      },
      {
        key: 'amount',
        header: 'Сумма',
        sortable: true,
        align: 'right',
        render: (row) => <span className="whitespace-nowrap text-xs font-medium">{formatMoney(row.amount)}</span>,
      },
      {
        key: 'created_at',
        header: 'Создан',
        sortable: true,
        render: (row) => <span className="whitespace-nowrap text-xs text-ink-300">{formatDate(row.created_at)}</span>,
      },
      {
        key: 'due_at',
        header: 'Срок',
        sortable: true,
        render: (row) => <span className="whitespace-nowrap text-xs text-ink-300">{formatDate(row.due_at)}</span>,
      },
      {
        key: 'completed_at',
        header: 'Завершён',
        render: (row) => (
          <span className="whitespace-nowrap text-xs text-ink-300">
            {row.completed_at ? formatDate(row.completed_at) : '—'}
          </span>
        ),
      },
      {
        key: 'status',
        header: 'Статус',
        render: (row) => (
          <Badge tone={ORDER_STATUS_TONES[row.status]} dot>
            {ORDER_STATUS_LABELS[row.status]}
          </Badge>
        ),
      },
    ],
    [],
  );

  const error = query.error ? toApiError(query.error) : null;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Реестр заказов"
        description="Сквозной процесс заказа: от создания до производства, доставки и поддержки. Карточка содержит историю событий."
        meta={
          query.data ? (
            <Badge tone="idle">
              Найдено {query.data.total} · стр. {query.data.page} из {Math.max(1, query.data.pages)}
            </Badge>
          ) : null
        }
        actions={
          <Button variant="outline" size="sm" icon={<Download className="h-3.5 w-3.5" />} disabled title="Экспорт в MVP не предусмотрен">
            Экспорт
          </Button>
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
          placeholder="Поиск по номеру или клиенту"
          className="w-full sm:w-72"
        />
        <Select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
          aria-label="Статус заказа"
          className="w-full sm:w-48"
        >
          <option value="">Все статусы</option>
          {Object.entries(ORDER_STATUS_LABELS).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
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
            Очистить фильтры
          </Button>
        )}
      </div>

      {error && <ErrorState message={error.message} onRetry={() => void query.refetch()} />}

      {!error && (
        <DataTable
          columns={columns}
          rows={query.data?.items}
          rowKey={(row) => row.id}
          loading={query.isLoading}
          onRowClick={(row) => navigate(`/orders/${row.id}`)}
          emptyTitle="Заказы не найдены"
          emptyDescription="Измените период, статус или поисковый запрос."
          emptyAction={
            <Button variant="outline" size="sm" icon={<Package className="h-3.5 w-3.5" />} onClick={() => setStatus('')}>
              Сбросить статус
            </Button>
          }
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={(key, order) => {
            setSortBy(key);
            setSortOrder(order);
          }}
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

      <p className="px-1 text-[11px] text-ink-500">
        Статусы модерации, производства и доставки отображаются в карточке заказа отдельно от общего статуса.
      </p>
    </div>
  );
}
