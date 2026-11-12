import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Filter } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, Pagination, type Column } from '@/components/tables/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SearchInput, Select } from '@/components/ui/Field';
import { ErrorState } from '@/components/feedback/States';
import { auditLogsApi } from '@/lib/api/endpoints';
import { toApiError } from '@/lib/api/client';
import { AUDIT_ACTION_LABELS } from '@/constants/labels';
import { formatDateTime } from '@/lib/formatters';
import type { AuditLog } from '@/types/api';

const OBJECT_TYPES = ['decision', 'task', 'alert', 'order', 'user', 'metric', 'source', 'session'];

export function AuditLogsPage() {
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [objectType, setObjectType] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const navigate = useNavigate();
  const location = useLocation();

  const query = useQuery({
    queryKey: ['audit-logs', search, action, objectType, status, page, pageSize],
    queryFn: async () =>
      auditLogsApi.list({
        page,
        page_size: pageSize,
        ...(search ? { search } : {}),
        ...(action ? { action } : {}),
        ...(objectType ? { object_type: objectType } : {}),
        ...(status ? { status } : {}),
      }),
    placeholderData: (previous) => previous,
  });

  const columns: Column<AuditLog>[] = [
    {
      key: 'created_at',
      header: 'Время',
      render: (row) => (
        <span className="whitespace-nowrap text-[0.6875rem] text-ink-300">{formatDateTime(row.created_at)}</span>
      ),
    },
    {
      key: 'actor',
      header: 'Пользователь',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-xs text-ink-100">{row.actor?.full_name ?? 'Система'}</p>
          <p className="truncate text-[0.625rem] text-ink-500">{row.actor_type === 'system' ? 'автоматически' : row.ip_address}</p>
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Действие',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-xs text-ink-100">{AUDIT_ACTION_LABELS[row.action] ?? row.action}</p>
          <p className="truncate font-mono text-[0.625rem] text-ink-500">{row.action}</p>
        </div>
      ),
    },
    {
      key: 'object',
      header: 'Объект',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-xs text-ink-200">{row.object_name ?? '—'}</p>
          <p className="truncate font-mono text-[0.625rem] text-ink-500">{row.object_type}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Результат',
      render: (row) => (
        <Badge tone={row.status === 'success' ? 'ok' : 'bad'} dot>
          {row.status === 'success' ? 'успешно' : 'ошибка'}
        </Badge>
      ),
    },
    {
      key: 'request_id',
      header: 'Request ID',
      render: (row) => (
        <span className="font-mono text-[0.625rem] text-ink-500">{row.request_id.slice(0, 8)}</span>
      ),
    },
    {
      key: 'details',
      header: '',
      align: 'right',
      render: () => (
        <span className="inline-flex items-center gap-1 text-[0.6875rem] font-medium text-accent-300">
          Открыть <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </span>
      ),
    },
  ];

  const error = query.error ? toApiError(query.error) : null;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Журнал действий"
        description="Неизменяемый аудит: кто, когда и что изменил. Нажмите на строку или «Открыть», чтобы перейти к полной записи. Доступен администратору и директору."
        meta={
          query.data ? (
            <>
              <Badge tone="idle">Записей {query.data.total}</Badge>
              <Badge tone="accent" dot>
                Только чтение
              </Badge>
            </>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Поиск по объекту или действию"
          className="w-full sm:w-72"
        />
        <Select
          value={action}
          onChange={(event) => {
            setAction(event.target.value);
            setPage(1);
          }}
          aria-label="Тип действия"
          className="w-full sm:w-64"
        >
          <option value="">Все действия</option>
          {Object.entries(AUDIT_ACTION_LABELS).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </Select>
        <Select
          value={objectType}
          onChange={(event) => {
            setObjectType(event.target.value);
            setPage(1);
          }}
          aria-label="Тип объекта"
          className="w-full sm:w-44"
        >
          <option value="">Все объекты</option>
          {OBJECT_TYPES.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </Select>
        <Select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
          aria-label="Результат действия"
          className="w-full sm:w-40"
        >
          <option value="">Любой результат</option>
          <option value="success">Успешно</option>
          <option value="failure">Ошибка</option>
        </Select>
        {(search || action || objectType || status) && (
          <Button
            variant="ghost"
            size="sm"
            icon={<Filter className="h-3.5 w-3.5" />}
            onClick={() => {
              setSearch('');
              setAction('');
              setObjectType('');
              setStatus('');
              setPage(1);
            }}
          >
            Сбросить
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
          onRowClick={(row) => navigate(`/audit-logs/${row.id}`, { state: { from: `${location.pathname}${location.search}` } })}
          emptyTitle="Записей нет"
          emptyDescription="Измените фильтры — журнал заполняется автоматически при действиях в системе."
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

    </div>
  );
}
