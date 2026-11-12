import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, ShieldCheck, UserPlus, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, Pagination, type Column } from '@/components/tables/DataTable';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { FieldShell, Input, SearchInput, Select } from '@/components/ui/Field';
import { ErrorState } from '@/components/feedback/States';
import { catalogApi, usersApi } from '@/lib/api/endpoints';
import { toApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/auth-context';
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from '@/constants/labels';
import { formatDateTime, initials } from '@/lib/formatters';
import { cn } from '@/lib/utils/cn';
import type { Role, User } from '@/types/api';

const ROLES: Role[] = ['admin', 'director', 'manager', 'analyst', 'employee'];

const createBaseSchema = z.object({
  full_name: z.string().trim().min(3, 'Укажите ФИО'),
  email: z.string().trim().email('Некорректный email'),
  role: z.enum(['admin', 'director', 'manager', 'analyst', 'employee']),
  department_id: z.string().optional(),
  temporary_password: z.string().min(12, 'Минимум 12 символов'),
});

const createSchema = createBaseSchema.superRefine((values, context) => {
  if (['manager', 'employee'].includes(values.role) && !values.department_id) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['department_id'], message: 'Выберите подразделение для этой роли' });
  }
});

type CreateValues = z.infer<typeof createSchema>;

export function UsersPage() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [isActive, setIsActive] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editValues, setEditValues] = useState({ full_name: '', role: 'employee' as Role, department_id: '' });
  const [formError, setFormError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['users', search, role, isActive, page, pageSize],
    queryFn: async () =>
      usersApi.list({
        page,
        page_size: pageSize,
        ...(search ? { search } : {}),
        ...(role ? { role } : {}),
        ...(isActive ? { is_active: isActive } : {}),
      }),
    placeholderData: (previous) => previous,
  });

  const departmentsQuery = useQuery({
    queryKey: ['departments', currentUser?.role],
    queryFn: async () => (await catalogApi.departments()).data,
    staleTime: 10 * 60_000,
  });
  const departments = departmentsQuery.data ?? [];

  const users = useMemo(() => (query.data?.items ?? []) as User[], [query.data]);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { full_name: '', email: '', role: 'employee', department_id: '', temporary_password: '' },
  });

  const selectedRole = watch('role');

  const createMutation = useMutation({
    mutationFn: async (values: CreateValues) =>
      usersApi.create({
        full_name: values.full_name,
        email: values.email,
        role: values.role,
        department_id: values.department_id || null,
        temporary_password: values.temporary_password,
      }),
    onSuccess: () => {
      toast.success('Пользователь создан');
      setCreateOpen(false);
      setFormError(null);
      reset({ full_name: '', email: '', role: 'employee', department_id: '', temporary_password: '' });
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error) => {
      const apiError = toApiError(error);
      setFormError(apiError.message);
      Object.entries(apiError.fields).forEach(([field, message]) => {
        if (field in createBaseSchema.shape) setError(field as keyof CreateValues, { type: 'server', message });
      });
      toast.error(apiError.message);
    },
  });

  const patchMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, unknown> }) => usersApi.update(id, body),
    onSuccess: () => {
      toast.success('Пользователь обновлён');
      setEditingUser(null);
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error) => toast.error(toApiError(error).message),
  });

  const columns: Column<User>[] = [
    {
      key: 'full_name',
      header: 'Сотрудник',
      render: (row) => (
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-500/15 text-[10px] font-semibold text-accent-200 ring-1 ring-accent-400/30">
            {initials(row.full_name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-ink-50">{row.full_name}</p>
            <p className="truncate text-[10px] text-ink-500">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Роль',
      render: (row) => (
        <div className="min-w-0">
          <Badge tone={row.role === 'admin' ? 'violet' : row.role === 'director' ? 'accent' : 'info'}>
            {ROLE_LABELS[row.role]}
          </Badge>
          <p className="mt-1 line-clamp-1 text-[10px] text-ink-500">{ROLE_DESCRIPTIONS[row.role]}</p>
        </div>
      ),
    },
    {
      key: 'department',
      header: 'Подразделение',
      render: (row) => (
        <span className="text-xs text-ink-300">
          {departments.find((department) => department.id === row.department_id)?.name ?? '—'}
        </span>
      ),
    },
    {
      key: 'is_active',
      header: 'Доступ',
      render: (row) => (
        <Badge tone={row.is_active ? 'ok' : 'idle'} dot>
          {row.is_active ? 'активен' : 'деактивирован'}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      header: 'Создан',
      render: (row) => (
        <span className="whitespace-nowrap text-[11px] text-ink-500">{formatDateTime(row.created_at)}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) => {
        const isSelf = row.id === currentUser?.id;
        return (
          <div className="flex justify-end gap-1.5">
            <Button
              size="sm"
              variant="outline"
              disabled={patchMutation.isPending}
              onClick={(event) => {
                event.stopPropagation();
                setEditingUser(row);
                setEditValues({ full_name: row.full_name, role: row.role, department_id: row.department_id ?? '' });
              }}
            >
              Изменить
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={isSelf || patchMutation.isPending}
              onClick={(event) => {
                event.stopPropagation();
                patchMutation.mutate({ id: row.id, body: { is_active: !row.is_active } });
              }}
            >
              {row.is_active ? 'Деактивировать' : 'Активировать'}
            </Button>
          </div>
        );
      },
    },
  ];

  const error = query.error ? toApiError(query.error) : null;

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    createMutation.mutate(values);
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Управление пользователями"
        description="Роли и доступы платформы. Самостоятельная регистрация не предусмотрена: учётные записи создаёт администратор."
        meta={
          query.data ? (
            <>
              <Badge tone="idle">Всего {query.data.total}</Badge>
              <Badge tone="accent" dot>
                {users.filter((item) => item.is_active).length} активных на странице
              </Badge>
            </>
          ) : null
        }
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={createOpen ? <X className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
            onClick={() => setCreateOpen((prev) => !prev)}
          >
            {createOpen ? 'Скрыть форму' : 'Новый пользователь'}
          </Button>
        }
      />

      {createOpen && (
        <Card>
          <CardHeader
            title="Новый пользователь"
            subtitle="Пароль выдаётся сотруднику и требует смены при первом входе (в реальном Backend)"
            icon={<Plus className="h-4 w-4" />}
          />
          <form onSubmit={onSubmit} className="space-y-3" noValidate>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <FieldShell label="ФИО" htmlFor="full_name" required error={errors.full_name?.message}>
                <Input id="full_name" placeholder="Иванов Иван" {...register('full_name')} />
              </FieldShell>
              <FieldShell label="Корпоративная почта" htmlFor="email" required error={errors.email?.message}>
                <Input id="email" type="email" placeholder="user@photoprint.by" {...register('email')} />
              </FieldShell>
              <FieldShell label="Роль" htmlFor="role" required error={errors.role?.message}>
                <Select id="role" {...register('role')}>
                  {ROLES.map((code) => (
                    <option key={code} value={code}>
                      {ROLE_LABELS[code]}
                    </option>
                  ))}
                </Select>
              </FieldShell>
              <FieldShell
                label="Подразделение"
                htmlFor="department_id"
                error={errors.department_id?.message}
                hint={['manager', 'employee'].includes(selectedRole) ? 'Обязательно для этой роли' : 'Необязательно'}
              >
                <Select id="department_id" {...register('department_id')}>
                  <option value="">Не назначено</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </Select>
              </FieldShell>
              <FieldShell
                label="Временный пароль"
                htmlFor="temporary_password"
                required
                error={errors.temporary_password?.message}
                hint="Минимум 12 символов"
              >
                <Input id="temporary_password" type="password" autoComplete="new-password" {...register('temporary_password')} />
              </FieldShell>
            </div>
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
                icon={<UserPlus className="h-3.5 w-3.5" />}
              >
                Создать
              </Button>
            </div>
          </form>
        </Card>
      )}

      {editingUser && (
        <Card>
          <CardHeader title={`Изменение доступа · ${editingUser.full_name}`} subtitle="Новые права вступят в силу после подтверждения Backend" />
          <form
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (editValues.full_name.trim().length < 3) {
                toast.error('Укажите ФИО не короче трёх символов');
                return;
              }
              if (['manager', 'employee'].includes(editValues.role) && !editValues.department_id) {
                toast.error('Выберите подразделение для этой роли');
                return;
              }
              patchMutation.mutate({
                id: editingUser.id,
                body: {
                  full_name: editValues.full_name.trim(),
                  role: editValues.role,
                  department_id: editValues.department_id || null,
                },
              });
            }}
          >
            <FieldShell label="ФИО" htmlFor="edit-user-name" required>
              <Input id="edit-user-name" value={editValues.full_name} onChange={(event) => setEditValues((current) => ({ ...current, full_name: event.target.value }))} />
            </FieldShell>
            <FieldShell label="Роль" htmlFor="edit-user-role" required>
              <Select id="edit-user-role" value={editValues.role} onChange={(event) => setEditValues((current) => ({ ...current, role: event.target.value as Role }))}>
                {ROLES.map((code) => <option key={code} value={code}>{ROLE_LABELS[code]}</option>)}
              </Select>
            </FieldShell>
            <FieldShell label="Подразделение" htmlFor="edit-user-department">
              <Select id="edit-user-department" value={editValues.department_id} onChange={(event) => setEditValues((current) => ({ ...current, department_id: event.target.value }))}>
                <option value="">Не назначено</option>
                {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
              </Select>
            </FieldShell>
            <div className="flex items-end justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setEditingUser(null)}>Отмена</Button>
              <Button type="submit" variant="primary" loading={patchMutation.isPending}>Сохранить</Button>
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
          placeholder="Поиск по ФИО или почте"
          className="w-full sm:w-72"
        />
        <Select
          value={role}
          onChange={(event) => {
            setRole(event.target.value);
            setPage(1);
          }}
          aria-label="Роль"
          className="w-full sm:w-56"
        >
          <option value="">Все роли</option>
          {ROLES.map((code) => (
            <option key={code} value={code}>
              {ROLE_LABELS[code]}
            </option>
          ))}
        </Select>
        <Select
          value={isActive}
          onChange={(event) => {
            setIsActive(event.target.value);
            setPage(1);
          }}
          aria-label="Статус доступа"
          className="w-full sm:w-44"
        >
          <option value="">Любой доступ</option>
          <option value="true">Активные</option>
          <option value="false">Деактивированные</option>
        </Select>
        {(search || role || isActive) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch('');
              setRole('');
              setIsActive('');
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
          rows={users}
          rowKey={(row) => row.id}
          loading={query.isLoading}
          emptyTitle="Пользователи не найдены"
          emptyDescription="Измените фильтры или создайте нового пользователя."
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

      <Card>
        <CardHeader title="Матрица ролей" subtitle="Права определяются на Backend, интерфейс только скрывает недоступное" icon={<Users className="h-4 w-4" />} />
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {ROLES.map((code) => (
            <div
              key={code}
              className={cn(
                'rounded-lg border p-2.5',
                code === 'admin' ? 'border-signal-violet/40 bg-signal-violet/8' : 'border-ink-700/60 bg-ink-850/50',
              )}
            >
              <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-50">
                <ShieldCheck className="h-3.5 w-3.5 text-accent-300" aria-hidden />
                {ROLE_LABELS[code]}
              </p>
              <p className="mt-1 text-[10px] leading-relaxed text-ink-400">{ROLE_DESCRIPTIONS[code]}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-ink-500">
          Нельзя изменить собственную роль и деактивировать последнего администратора — Backend возвращает 409
          INVALID_STATUS_TRANSITION.
        </p>
      </Card>
    </div>
  );
}
