import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  AlertTriangle,
  ArrowLeft,
  Archive,
  CalendarClock,
  CheckCircle2,
  History,
  Play,
  Save,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { FieldShell, Input, Select, Textarea } from '@/components/ui/Field';
import { ErrorState, LoadingState } from '@/components/feedback/States';
import { tasksApi, usersApi, type AssigneeDto } from '@/lib/api/endpoints';
import { toApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/auth-context';
import {
  AUDIT_ACTION_LABELS,
  PRIORITY_LABELS,
  PRIORITY_TONES,
  TASK_STATUS_LABELS,
  TASK_STATUS_TONES,
} from '@/constants/labels';
import { formatDate, formatDateTime, formatDaysLeft } from '@/lib/formatters';
import type { Priority, TaskStatus } from '@/types/api';

const schema = z.object({
  title: z.string().trim().min(5, 'Минимум 5 символов'),
  description: z.string().trim().max(1000, 'Максимум 1000 символов').optional(),
  assignee_id: z.string().min(1, 'Выберите исполнителя'),
  deadline: z.string().min(1, 'Укажите срок'),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  comment: z.string().trim().optional(),
});

type FormValues = z.infer<typeof schema>;

const NEXT_STATUS: Partial<Record<TaskStatus, { status: TaskStatus; label: string }>> = {
  new: { status: 'in_progress', label: 'Взять в работу' },
  in_progress: { status: 'completed', label: 'Завершить задачу' },
};

export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can, user, role } = useAuth();
  const [conflict, setConflict] = useState<string | null>(null);
  const [cancelMode, setCancelMode] = useState(false);

  const query = useQuery({
    queryKey: ['task', id],
    queryFn: async () => (await tasksApi.get(id as string)).data,
    enabled: Boolean(id),
  });

  const history = useQuery({
    queryKey: ['task-history', id],
    queryFn: async () => tasksApi.history(id as string, { page_size: 30 }),
    enabled: Boolean(id),
  });

  const assigneesQuery = useQuery({
    queryKey: ['assignees'],
    queryFn: async () => usersApi.list({ page_size: 100 }),
    enabled: can('tasks.write'),
  });

  const assignees = useMemo(
    () => (assigneesQuery.data?.items ?? []) as AssigneeDto[],
    [assigneesQuery.data],
  );

  const {
    register,
    handleSubmit,
    reset,
    setError,
    getValues,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const task = query.data;

  useEffect(() => {
    if (!task) return;
    reset({
      title: task.title,
      description: task.description,
      assignee_id: task.assignee_id,
      deadline: task.deadline.slice(0, 10),
      priority: task.priority,
      comment: '',
    });
  }, [task, reset]);

  const mutation = useMutation({
    mutationFn: async (payload: { values?: FormValues; status?: TaskStatus; comment?: string }) => {
      if (!task) throw new Error('Задача не загружена');
      const values = payload.values ?? getValues();
      return tasksApi.update(task.id, {
        version: task.version,
        title: values.title,
        description: values.description ?? '',
        assignee_id: values.assignee_id,
        deadline: values.deadline,
        priority: values.priority,
        ...(payload.status ? { status: payload.status } : {}),
        ...(payload.comment ?? values.comment ? { comment: payload.comment ?? values.comment } : {}),
      });
    },
    onSuccess: (response, payload) => {
      setConflict(null);
      setCancelMode(false);
      toast.success(payload.status ? `Статус: ${TASK_STATUS_LABELS[response.data.status]}` : 'Задача сохранена');
      void queryClient.invalidateQueries({ queryKey: ['task', id] });
      void queryClient.invalidateQueries({ queryKey: ['task-history', id] });
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error) => {
      const apiError = toApiError(error);
      if (apiError.code === 'VERSION_CONFLICT' || apiError.status === 409) {
        setConflict(apiError.message);
        toast.warning('Конфликт версий: задача перечитана, введённые значения сохранены');
        void query.refetch();
        return;
      }
      Object.entries(apiError.fields).forEach(([field, message]) => {
        if (field in schema.shape) setError(field as keyof FormValues, { type: 'server', message });
      });
      toast.error(apiError.message);
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async () => tasksApi.archive(id as string),
    onSuccess: () => {
      toast.success('Задача перемещена в архив');
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
      navigate('/tasks');
    },
    onError: (error) => toast.error(toApiError(error).message),
  });

  if (query.isLoading) return <LoadingState label="Загружаем задачу…" />;
  if (query.error) {
    return <ErrorState message={toApiError(query.error).message} onRetry={() => void query.refetch()} />;
  }
  if (!task) return null;

  const isTerminal = task.status === 'completed' || task.status === 'cancelled';
  const isAssignee = user?.id === task.assignee_id;
  const canEdit = !isTerminal && (can('tasks.write') || isAssignee);
  const canCancel = !isTerminal && ['admin', 'director', 'manager'].includes(role ?? '');
  const next = NEXT_STATUS[task.status];

  const onSubmit = handleSubmit((values) => mutation.mutate({ values }));

  const onCancel = () => {
    const comment = getValues('comment');
    if (!comment || comment.trim().length === 0) {
      setError('comment', { type: 'manual', message: 'Для отмены требуется комментарий' });
      toast.error('Укажите причину отмены');
      return;
    }
    mutation.mutate({ status: 'cancelled', comment });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={task.title}
        description={`${task.department_name} · исполнитель ${task.assignee.full_name}`}
        meta={
          <>
            <Badge tone={TASK_STATUS_TONES[task.status]} dot>
              {TASK_STATUS_LABELS[task.status]}
            </Badge>
            <Badge tone={PRIORITY_TONES[task.priority]}>{PRIORITY_LABELS[task.priority]}</Badge>
            <Badge tone="info">версия {task.version}</Badge>
            <Badge tone={task.is_overdue ? 'bad' : 'idle'}>{formatDaysLeft(task.deadline)}</Badge>
            {task.decision_id && (
              <Link to={`/decisions/${task.decision_id}`} className="link-quiet text-[0.6875rem]">
                решение
              </Link>
            )}
            {task.alert_id && (
              <Link to={`/alerts/${task.alert_id}`} className="link-quiet text-[0.6875rem]">
                отклонение
              </Link>
            )}
            {task.order_id && (
              <Link to={`/orders/${task.order_id}`} className="link-quiet text-[0.6875rem]">
                заказ
              </Link>
            )}
          </>
        }
        actions={
          <>
            <Link to="/tasks">
              <Button variant="ghost" size="sm" icon={<ArrowLeft className="h-3.5 w-3.5" />}>
                К реестру
              </Button>
            </Link>
            {can('tasks.archive') && (
              <Button
                variant="danger"
                size="sm"
                loading={archiveMutation.isPending}
                icon={<Archive className="h-3.5 w-3.5" />}
                onClick={() => archiveMutation.mutate()}
              >
                В архив
              </Button>
            )}
            {canCancel && (
              <Button
                variant="outline"
                size="sm"
                icon={<XCircle className="h-3.5 w-3.5" />}
                onClick={() => setCancelMode((prev) => !prev)}
              >
                {cancelMode ? 'Отменить отмену' : 'Отменить задачу'}
              </Button>
            )}
            {canEdit && next && (
              <Button
                variant="primary"
                size="sm"
                loading={mutation.isPending}
                icon={next.status === 'completed' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                onClick={() => mutation.mutate({ status: next.status })}
              >
                {next.label}
              </Button>
            )}
          </>
        }
      />

      {conflict && (
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-signal-warn/40 bg-signal-warn/10 p-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-signal-warn">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
              Конфликт версий (409 VERSION_CONFLICT)
            </p>
            <p className="mt-1 text-[0.6875rem] leading-relaxed text-ink-200">
              {conflict} Данные перечитаны, введённые значения сохранены в форме — проверьте и повторите сохранение.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setConflict(null)}>
            Понятно
          </Button>
        </div>
      )}

      {cancelMode && (
        <Card className="border-signal-bad/40">
          <CardHeader title="Отмена задачи" subtitle="Требуется комментарий — он попадёт в историю" icon={<XCircle className="h-4 w-4" />} />
          <FieldShell label="Комментарий" htmlFor="comment" required error={errors.comment?.message}>
            <Textarea id="comment" placeholder="Причина отмены" {...register('comment')} />
          </FieldShell>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setCancelMode(false)}>
              Назад
            </Button>
            <Button variant="danger" size="sm" loading={mutation.isPending} onClick={onCancel}>
              Отменить задачу
            </Button>
          </div>
        </Card>
      )}

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Карточка задачи"
            subtitle={isTerminal ? 'Терминальная задача доступна только для чтения' : 'Изменения сохраняются с проверкой версии'}
            icon={<CalendarClock className="h-4 w-4" />}
            action={
              canEdit ? (
                <Button
                  variant="secondary"
                  size="sm"
                  loading={isSubmitting || mutation.isPending}
                  icon={<Save className="h-3.5 w-3.5" />}
                  disabled={!isDirty}
                  onClick={onSubmit}
                >
                  Сохранить
                </Button>
              ) : null
            }
          />
          <form onSubmit={onSubmit} className="space-y-3" noValidate>
            <FieldShell label="Название" htmlFor="title" required error={errors.title?.message}>
              <Input id="title" disabled={!canEdit} {...register('title')} />
            </FieldShell>
            <div className="grid gap-3 sm:grid-cols-3">
              <FieldShell label="Исполнитель" htmlFor="assignee_id" required error={errors.assignee_id?.message}>
                <Select id="assignee_id" disabled={!can('tasks.write') || isTerminal} {...register('assignee_id')}>
                  {assignees.length === 0 && <option value={task.assignee_id}>{task.assignee.full_name}</option>}
                  {assignees.map((assignee) => (
                    <option key={assignee.id} value={assignee.id}>
                      {assignee.full_name}
                    </option>
                  ))}
                </Select>
              </FieldShell>
              <FieldShell label="Срок" htmlFor="deadline" required error={errors.deadline?.message}>
                <Input id="deadline" type="date" disabled={!canEdit} {...register('deadline')} />
              </FieldShell>
              <FieldShell label="Приоритет" htmlFor="priority" required error={errors.priority?.message}>
                <Select id="priority" disabled={!canEdit} {...register('priority')}>
                  {(Object.keys(PRIORITY_LABELS) as Priority[]).map((priority) => (
                    <option key={priority} value={priority}>
                      {PRIORITY_LABELS[priority]}
                    </option>
                  ))}
                </Select>
              </FieldShell>
            </div>
            <FieldShell label="Описание" htmlFor="description" error={errors.description?.message}>
              <Textarea id="description" rows={5} disabled={!canEdit} {...register('description')} />
            </FieldShell>
            {canEdit && (
              <FieldShell label="Комментарий к изменению" htmlFor="comment" error={errors.comment?.message}>
                <Input id="comment" placeholder="Необязательно" {...register('comment')} />
              </FieldShell>
            )}
            {!canEdit && !isTerminal && (
              <p className="rounded-md bg-ink-850/60 p-2 text-[0.6875rem] text-ink-400">
                Редактирование доступно исполнителю задачи и руководящим ролям.
              </p>
            )}
          </form>
        </Card>

        <Card>
          <CardHeader title="Сводка" />
          <dl className="space-y-2 text-[0.6875rem]">
            {[
              ['Подразделение', task.department_name],
              ['Автор', task.creator.full_name],
              ['Срок', formatDate(task.deadline)],
              ['Просрочена', task.is_overdue ? 'да' : 'нет'],
              ['Создана', formatDateTime(task.created_at)],
              ['Завершена', task.completed_at ? formatDateTime(task.completed_at) : '—'],
              ['Обновлена', formatDateTime(task.updated_at)],
            ].map(([label, value]) => (
              <div key={label} className="flex items-start justify-between gap-2">
                <dt className="text-ink-400">{label}</dt>
                <dd className="text-right font-medium text-ink-100">{value}</dd>
              </div>
            ))}
          </dl>
          {isAssignee && !isTerminal && (
            <p className="mt-3 rounded-md border border-accent-400/30 bg-accent-500/10 p-2 text-[0.625rem] leading-relaxed text-accent-200">
              Вы исполнитель этой задачи: можно взять её в работу и завершить.
            </p>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader
          title="История изменений"
          subtitle="Каждая правка увеличивает версию записи"
          icon={<History className="h-4 w-4" />}
        />
        {history.isLoading && <p className="py-4 text-center text-xs text-ink-400">Загрузка истории…</p>}
        {history.error && (
          <ErrorState
            title="История недоступна"
            message={toApiError(history.error).message}
            onRetry={() => void history.refetch()}
          />
        )}
        {history.data && history.data.items.length === 0 && (
          <p className="py-4 text-center text-xs text-ink-400">Изменений пока нет.</p>
        )}
        {history.data && history.data.items.length > 0 && (
          <ol className="relative space-y-3 border-l border-ink-700/70 pl-4">
            {history.data.items.map((event) => (
              <li key={event.id} className="relative">
                <span className="absolute -left-[1.3125rem] top-1.5 h-2 w-2 rounded-full bg-accent-400 ring-4 ring-ink-900" />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-medium text-ink-50">
                    {AUDIT_ACTION_LABELS[event.action] ?? event.action}
                  </p>
                  <span className="text-[0.625rem] text-ink-500">{formatDateTime(event.created_at)}</span>
                </div>
                <p className="mt-0.5 text-[0.6875rem] text-ink-400">{event.changed_by?.full_name ?? 'Система'}</p>
                {event.comment && <p className="mt-0.5 text-[0.6875rem] text-ink-300">{event.comment}</p>}
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
