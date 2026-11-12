import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertTriangle, CalendarClock, CheckCircle2, ListChecks, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, Pagination, type Column } from '@/components/tables/DataTable';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { FieldShell, Input, Select, Textarea, SearchInput } from '@/components/ui/Field';
import { ErrorState } from '@/components/feedback/States';
import { catalogApi, tasksApi, usersApi, type AssigneeDto } from '@/lib/api/endpoints';
import { createIdempotencyKey, toApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/auth-context';
import {
  PRIORITY_LABELS,
  PRIORITY_TONES,
  ROLE_LABELS,
  TASK_STATUS_LABELS,
  TASK_STATUS_TONES,
} from '@/constants/labels';
import { formatDate, formatDateTime, formatDaysLeft } from '@/lib/formatters';
import { cn } from '@/lib/utils/cn';
import type { Priority, Task, TaskStatus } from '@/types/api';

const STATUSES: TaskStatus[] = ['new', 'in_progress', 'completed', 'cancelled'];
const PRIORITIES: Priority[] = ['critical', 'high', 'medium', 'low'];

const createSchema = z.object({
  title: z.string().trim().min(5, 'Минимум 5 символов').max(200, 'Максимум 200 символов'),
  description: z.string().trim().max(1000, 'Максимум 1000 символов').optional(),
  assignee_id: z.string().min(1, 'Выберите исполнителя'),
  department_id: z.string().min(1, 'Выберите подразделение'),
  deadline: z.string().min(1, 'Укажите срок'),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
});

type CreateValues = z.infer<typeof createSchema>;

function defaultDeadline(): string {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}

export function TasksPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const mine = searchParams.get('mine') === 'true';
  const overdueParam = searchParams.get('overdue') === 'true';
  const [status, setStatus] = useState(searchParams.get('status') ?? '');
  const [priority, setPriority] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [createOpen, setCreateOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() => createIdempotencyKey());

  const query = useQuery({
    queryKey: ['tasks', status, priority, search, mine, overdueParam, page, pageSize],
    queryFn: async () =>
      tasksApi.list({
        page,
        page_size: pageSize,
        ...(status ? { status } : {}),
        ...(priority ? { priority } : {}),
        ...(search ? { search } : {}),
        ...(mine ? { mine: true } : {}),
        ...(overdueParam ? { overdue: true } : {}),
      }),
    placeholderData: (previous) => previous,
  });

  const assigneesQuery = useQuery({
    queryKey: ['assignees'],
    queryFn: async () => usersApi.list({ page_size: 100 }),
    enabled: can('tasks.write'),
  });

  const departmentsQuery = useQuery({
    queryKey: ['departments', user?.role],
    queryFn: async () => (await catalogApi.departments()).data,
    enabled: can('tasks.write'),
  });

  const assignees = useMemo(
    () => (assigneesQuery.data?.items ?? []) as AssigneeDto[],
    [assigneesQuery.data],
  );
  const departments = departmentsQuery.data ?? [];

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { title: '', description: '', assignee_id: '', department_id: '', deadline: defaultDeadline(), priority: 'medium' },
  });

  useEffect(() => {
    if (user?.role === 'manager' && user.department_id) {
      setValue('department_id', user.department_id, { shouldValidate: true });
    }
  }, [user?.role, user?.department_id, setValue]);

  const createMutation = useMutation({
    mutationFn: async (values: CreateValues) =>
      tasksApi.create(
        {
          title: values.title,
          description: values.description ?? '',
          assignee_id: values.assignee_id,
          department_id: values.department_id,
          deadline: values.deadline,
          priority: values.priority,
          decision_id: null,
          alert_id: null,
          order_id: null,
        },
        idempotencyKey,
      ),
    onSuccess: () => {
      toast.success('Задача создана');
      setCreateOpen(false);
      setFormError(null);
      setIdempotencyKey(createIdempotencyKey());
      reset({ title: '', description: '', assignee_id: '', department_id: '', deadline: defaultDeadline(), priority: 'medium' });
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error) => {
      const apiError = toApiError(error);
      setFormError(apiError.message);
      Object.entries(apiError.fields).forEach(([field, message]) => {
        if (field in createSchema.shape) setError(field as keyof CreateValues, { type: 'server', message });
      });
      toast.error(apiError.message);
    },
  });

  const columns = useMemo<Column<Task>[]>(
    () => [
      {
        key: 'title',
        header: 'Задача',
        render: (row) => (
          <div className="min-w-0 max-w-sm">
            <p className="truncate text-xs font-medium text-ink-50">{row.title}</p>
            <p className="mt-0.5 truncate text-[11px] text-ink-400">
              {row.decision_title ?? row.alert_title ?? row.department_name}
            </p>
          </div>
        ),
      },
      {
        key: 'status',
        header: 'Статус',
        render: (row) => (
          <div className="flex flex-col items-start gap-1">
            <Badge tone={TASK_STATUS_TONES[row.status]} dot>
              {TASK_STATUS_LABELS[row.status]}
            </Badge>
            {row.is_overdue && <Badge tone="bad">просрочена</Badge>}
          </div>
        ),
      },
      {
        key: 'priority',
        header: 'Приоритет',
        render: (row) => <Badge tone={PRIORITY_TONES[row.priority]}>{PRIORITY_LABELS[row.priority]}</Badge>,
      },
      {
        key: 'assignee',
        header: 'Исполнитель',
        render: (row) => (
          <div className="min-w-0">
            <p className="truncate text-xs text-ink-100">{row.assignee.full_name}</p>
            <p className="truncate text-[10px] text-ink-500">{row.department_name}</p>
          </div>
        ),
      },
      {
        key: 'deadline',
        header: 'Срок',
        render: (row) => (
          <div className="whitespace-nowrap">
            <p className="text-xs text-ink-200">{formatDate(row.deadline)}</p>
            <p className={cn('text-[10px]', row.is_overdue ? 'text-signal-bad' : 'text-ink-500')}>
              {formatDaysLeft(row.deadline)}
            </p>
          </div>
        ),
      },
      {
        key: 'created_at',
        header: 'Создана',
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

  const setFlag = (key: 'mine' | 'overdue', value: boolean) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, 'true');
    else params.delete(key);
    setSearchParams(params, { replace: true });
    setPage(1);
  };

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    createMutation.mutate(values);
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Задачи"
        description="Конкретные действия исполнителей по решениям и отклонениям. Статусы: новая → в работе → завершена, либо отмена с комментарием."
        meta={
          query.data ? (
            <>
              <Badge tone="idle">Всего {query.data.total}</Badge>
              {mine && (
                <Badge tone="accent" dot>
                  Только мои задачи
                </Badge>
              )}
              {overdueParam && <Badge tone="bad">Только просроченные</Badge>}
            </>
          ) : null
        }
        actions={
          can('tasks.write') ? (
            <Button
              variant="primary"
              size="sm"
              icon={createOpen ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              onClick={() => setCreateOpen((prev) => !prev)}
            >
              {createOpen ? 'Скрыть форму' : 'Новая задача'}
            </Button>
          ) : (
            <Badge tone="idle">Только просмотр</Badge>
          )
        }
      />

      {createOpen && can('tasks.write') && (
        <Card>
          <CardHeader
            title="Новая задача"
            subtitle="Задача создаётся в статусе «Новая» с версией 1"
            icon={<ListChecks className="h-4 w-4" />}
          />
          <form onSubmit={onSubmit} className="space-y-3" noValidate>
            <FieldShell label="Название" htmlFor="task-title" required error={errors.title?.message}>
              <Input id="task-title" placeholder="Что нужно сделать" {...register('title')} />
            </FieldShell>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <FieldShell label="Исполнитель" htmlFor="task-assignee" required error={errors.assignee_id?.message}>
                <Select id="task-assignee" {...register('assignee_id')}>
                  <option value="">Выберите исполнителя</option>
                  {assignees.map((assignee) => (
                    <option key={assignee.id} value={assignee.id}>
                      {assignee.full_name} · {ROLE_LABELS[assignee.role]}
                    </option>
                  ))}
                </Select>
              </FieldShell>
              <FieldShell label="Подразделение" htmlFor="task-department" required error={errors.department_id?.message}>
                <Select id="task-department" disabled={user?.role === 'manager'} {...register('department_id')}>
                  <option value="">Выберите подразделение</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </Select>
              </FieldShell>
              <FieldShell label="Срок" htmlFor="task-deadline" required error={errors.deadline?.message}>
                <Input id="task-deadline" type="date" {...register('deadline')} />
              </FieldShell>
              <FieldShell label="Приоритет" htmlFor="task-priority" required error={errors.priority?.message}>
                <Select id="task-priority" {...register('priority')}>
                  {PRIORITIES.map((code) => (
                    <option key={code} value={code}>
                      {PRIORITY_LABELS[code]}
                    </option>
                  ))}
                </Select>
              </FieldShell>
            </div>
            <FieldShell label="Описание" htmlFor="task-description" error={errors.description?.message}>
              <Textarea id="task-description" placeholder="Критерии выполнения, ссылки на объекты" {...register('description')} />
            </FieldShell>
            {formError && (
              <div className="rounded-lg border border-signal-bad/40 bg-signal-bad/10 px-3 py-2 text-xs text-signal-bad" role="alert">
                {formError}
              </div>
            )}
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setCreateOpen(false)}>
                Отмена
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={isSubmitting || createMutation.isPending}
                icon={<CheckCircle2 className="h-3.5 w-3.5" />}
              >
                Создать задачу
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Поиск по названию, описанию, исполнителю"
          className="w-full sm:w-80"
        />
        <Select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
          aria-label="Статус задачи"
          className="w-full sm:w-48"
        >
          <option value="">Все статусы</option>
          {STATUSES.map((code) => (
            <option key={code} value={code}>
              {TASK_STATUS_LABELS[code]}
            </option>
          ))}
        </Select>
        <Select
          value={priority}
          onChange={(event) => {
            setPriority(event.target.value);
            setPage(1);
          }}
          aria-label="Приоритет задачи"
          className="w-full sm:w-40"
        >
          <option value="">Все приоритеты</option>
          {PRIORITIES.map((code) => (
            <option key={code} value={code}>
              {PRIORITY_LABELS[code]}
            </option>
          ))}
        </Select>
        <Button
          size="sm"
          variant={mine ? 'primary' : 'outline'}
          onClick={() => setFlag('mine', !mine)}
        >
          Мои задачи
        </Button>
        <Button
          size="sm"
          variant={overdueParam ? 'danger' : 'outline'}
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
          onClick={() => setFlag('overdue', !overdueParam)}
        >
          Просроченные
        </Button>
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
          onRowClick={(row) => navigate(`/tasks/${row.id}`)}
          emptyTitle="Задач не найдено"
          emptyDescription={
            mine
              ? 'У вас нет активных задач по выбранным фильтрам.'
              : 'Измените фильтры или создайте задачу по решению.'
          }
          emptyAction={
            <Link to="/decisions">
              <Button variant="outline" size="sm" icon={<CalendarClock className="h-3.5 w-3.5" />}>
                Перейти к решениям
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
    </div>
  );
}
