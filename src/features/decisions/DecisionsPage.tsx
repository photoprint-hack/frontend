import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, Plus, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { GlobalFilters } from '@/components/filters/GlobalFilters';
import { useFilters } from '@/components/filters/FiltersContext';
import { DataTable, Pagination, type Column } from '@/components/tables/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SearchInput, Select } from '@/components/ui/Field';
import { ErrorState } from '@/components/feedback/States';
import { decisionsApi } from '@/lib/api/endpoints';
import { toApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/auth-context';
import {
  DECISION_STATUS_LABELS,
  DECISION_STATUS_TONES,
  PRIORITY_LABELS,
  PRIORITY_TONES,
} from '@/constants/labels';
import { formatDate, formatDateTime, formatDaysLeft } from '@/lib/formatters';
import { cn } from '@/lib/utils/cn';
import type { Decision, DecisionStatus, Priority } from '@/types/api';

const STATUSES: DecisionStatus[] = ['new', 'in_progress', 'needs_review', 'completed', 'cancelled'];
const PRIORITIES: Priority[] = ['critical', 'high', 'medium', 'low'];

export function DecisionsPage() {
  const { queryParams } = useFilters();
  const navigate = useNavigate();
  const { can } = useAuth();
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const query = useQuery({
    queryKey: ['decisions', queryParams, status, priority, search, page, pageSize, sortBy, sortOrder],
    queryFn: async () =>
      decisionsApi.list({
        ...queryParams,
        page,
        page_size: pageSize,
        sort_by: sortBy,
        sort_order: sortOrder,
        ...(status ? { status } : {}),
        ...(priority ? { priority } : {}),
        ...(search ? { search } : {}),
      }),
    placeholderData: (previous) => previous,
  });

  const columns = useMemo<Column<Decision>[]>(
    () => [
      {
        key: 'title',
        header: 'Решение',
        render: (row) => (
          <div className="min-w-0 max-w-md">
            <p className="truncate text-xs font-medium text-ink-50">{row.title}</p>
            <p className="mt-0.5 line-clamp-1 text-[11px] text-ink-400">{row.problem}</p>
          </div>
        ),
      },
      {
        key: 'status',
        header: 'Статус',
        render: (row) => (
          <Badge tone={DECISION_STATUS_TONES[row.status]} dot>
            {DECISION_STATUS_LABELS[row.status]}
          </Badge>
        ),
      },
      {
        key: 'priority',
        header: 'Приоритет',
        render: (row) => <Badge tone={PRIORITY_TONES[row.priority]}>{PRIORITY_LABELS[row.priority]}</Badge>,
      },
      {
        key: 'owner',
        header: 'Ответственный',
        render: (row) => (
          <div className="min-w-0">
            <p className="truncate text-xs text-ink-100">{row.owner.full_name}</p>
            <p className="truncate text-[10px] text-ink-500">{row.department_name ?? 'Компания'}</p>
          </div>
        ),
      },
      {
        key: 'deadline',
        header: 'Срок',
        sortable: true,
        render: (row) => {
          const overdue =
            new Date(row.deadline).getTime() < Date.now() && !['completed', 'cancelled'].includes(row.status);
          return (
            <div className="whitespace-nowrap">
              <p className="text-xs text-ink-200">{formatDate(row.deadline)}</p>
              <p className={cn('text-[10px]', overdue ? 'text-signal-bad' : 'text-ink-500')}>
                {formatDaysLeft(row.deadline)}
              </p>
            </div>
          );
        },
      },
      {
        key: 'alert_title',
        header: 'Отклонение',
        render: (row) =>
          row.alert_id ? (
            <Link
              to={`/alerts/${row.alert_id}`}
              onClick={(event) => event.stopPropagation()}
              className="link-quiet line-clamp-1 max-w-[180px] text-[11px]"
            >
              {row.alert_title}
            </Link>
          ) : (
            <span className="text-[11px] text-ink-500">—</span>
          ),
      },
      {
        key: 'created_at',
        header: 'Создано',
        sortable: true,
        render: (row) => (
          <span className="whitespace-nowrap text-[11px] text-ink-500">{formatDateTime(row.created_at)}</span>
        ),
      },
      {
        key: 'version',
        header: 'Версия',
        align: 'right',
        render: (row) => <span className="font-mono text-[11px] text-ink-400">v{row.version}</span>,
      },
    ],
    [],
  );

  const error = query.error ? toApiError(query.error) : null;
  const activeCount = query.data?.items.filter((item) => !['completed', 'cancelled'].includes(item.status)).length ?? 0;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Управленческие решения"
        description="Реестр решений: проблема, причина, действие, ответственный и срок. Решение проходит путь «новое → в работе → на проверке → выполнено»."
        meta={
          query.data ? (
            <>
              <Badge tone="idle">Всего {query.data.total}</Badge>
              <Badge tone="accent">В работе на странице: {activeCount}</Badge>
            </>
          ) : null
        }
        actions={
          can('decisions.write') ? (
            <Link to="/decisions/new">
              <Button variant="primary" size="sm" icon={<Plus className="h-3.5 w-3.5" />}>
                Новое решение
              </Button>
            </Link>
          ) : (
            <Badge tone="idle">Только просмотр</Badge>
          )
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
          placeholder="Поиск по названию, проблеме, ответственному"
          className="w-full sm:w-80"
        />
        <Select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
          aria-label="Статус решения"
          className="w-full sm:w-52"
        >
          <option value="">Все статусы</option>
          {STATUSES.map((code) => (
            <option key={code} value={code}>
              {DECISION_STATUS_LABELS[code]}
            </option>
          ))}
        </Select>
        <Select
          value={priority}
          onChange={(event) => {
            setPriority(event.target.value);
            setPage(1);
          }}
          aria-label="Приоритет решения"
          className="w-full sm:w-44"
        >
          <option value="">Все приоритеты</option>
          {PRIORITIES.map((code) => (
            <option key={code} value={code}>
              {PRIORITY_LABELS[code]}
            </option>
          ))}
        </Select>
        {(search || status || priority) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch('');
              setStatus('');
              setPriority('');
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
          onRowClick={(row) => navigate(`/decisions/${row.id}`)}
          emptyTitle="Решений не найдено"
          emptyDescription="Измените фильтры или создайте решение по критическому отклонению."
          emptyAction={
            can('decisions.write') ? (
              <Link to="/decisions/new">
                <Button variant="outline" size="sm" icon={<ShieldCheck className="h-3.5 w-3.5" />}>
                  Создать решение
                </Button>
              </Link>
            ) : null
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

      <div className="flex items-start gap-2 rounded-lg border border-ink-700/70 bg-ink-900/50 p-3 text-[11px] leading-relaxed text-ink-400">
        <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-300" aria-hidden />
        <p>
          Изменение решения требует передачи текущей версии записи. При одновременном редактировании возвращается
          ошибка <span className="font-mono text-ink-200">VERSION_CONFLICT</span> — данные нужно перечитать, введённые
          значения сохраняются в форме.
        </p>
      </div>
    </div>
  );
}
