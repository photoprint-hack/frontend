import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  History,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { FieldShell, Input, Select, Textarea } from '@/components/ui/Field';
import { ErrorState, LoadingState } from '@/components/feedback/States';
import { decisionsApi, tasksApi, usersApi, type AssigneeDto } from '@/lib/api/endpoints';
import { toApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/auth-context';
import {
  AUDIT_ACTION_LABELS,
  DECISION_STATUS_LABELS,
  DECISION_STATUS_TONES,
  PRIORITY_LABELS,
  PRIORITY_TONES,
  TASK_STATUS_LABELS,
  TASK_STATUS_TONES,
} from '@/constants/labels';
import { formatDate, formatDateTime, formatDaysLeft } from '@/lib/formatters';
import type { DecisionStatus, Priority } from '@/types/api';

const schema = z.object({
  title: z.string().trim().min(5, 'Минимум 5 символов'),
  problem: z.string().trim().min(5, 'Опишите проблему'),
  impact: z.string().trim().min(3, 'Укажите влияние'),
  cause: z.string().trim().min(3, 'Укажите причину'),
  action: z.string().trim().min(3, 'Опишите действие'),
  expected_result: z.string().trim().min(3, 'Опишите ожидаемый результат'),
  actual_result: z.string().trim().optional(),
  verification_note: z.string().trim().optional(),
  comment: z.string().trim().optional(),
  owner_id: z.string().min(1, 'Выберите ответственного'),
  deadline: z.string().min(1, 'Укажите срок'),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
});

type FormValues = z.infer<typeof schema>;

const NEXT_STATUS: Partial<Record<DecisionStatus, { status: DecisionStatus; label: string }>> = {
  new: { status: 'in_progress', label: 'Взять в работу' },
  in_progress: { status: 'needs_review', label: 'Отправить на проверку' },
  needs_review: { status: 'completed', label: 'Завершить решение' },
};

export function DecisionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { can, user } = useAuth();
  const [conflict, setConflict] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['decision', id],
    queryFn: async () => (await decisionsApi.get(id as string)).data,
    enabled: Boolean(id),
  });

  const history = useQuery({
    queryKey: ['decision-history', id],
    queryFn: async () => decisionsApi.history(id as string, { page_size: 30 }),
    enabled: Boolean(id),
  });

  const tasks = useQuery({
    queryKey: ['decision-tasks', id],
    queryFn: async () => tasksApi.list({ decision_id: id, page_size: 20 }),
    enabled: Boolean(id),
  });

  const assigneesQuery = useQuery({
    queryKey: ['assignees'],
    queryFn: async () => usersApi.list({ page_size: 100 }),
  });

  const assignees = useMemo(
    () => ((assigneesQuery.data?.items ?? []) as AssigneeDto[]).filter((item) => item.role !== 'employee'),
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

  const decision = query.data;

  useEffect(() => {
    if (!decision) return;
    reset({
      title: decision.title,
      problem: decision.problem,
      impact: decision.impact,
      cause: decision.cause,
      action: decision.action,
      expected_result: decision.expected_result,
      actual_result: decision.actual_result ?? '',
      verification_note: decision.verification_note ?? '',
      comment: '',
      owner_id: decision.owner_id,
      deadline: decision.deadline.slice(0, 10),
      priority: decision.priority,
    });
  }, [decision, reset]);

  const mutation = useMutation({
    mutationFn: async (payload: { values?: FormValues; status?: DecisionStatus }) => {
      if (!decision) throw new Error('Решение не загружено');
      const values = payload.values ?? getValues();
      return decisionsApi.update(decision.id, {
        version: decision.version,
        title: values.title,
        problem: values.problem,
        impact: values.impact,
        cause: values.cause,
        action: values.action,
        expected_result: values.expected_result,
        owner_id: values.owner_id,
        deadline: values.deadline,
        priority: values.priority,
        ...(values.actual_result ? { actual_result: values.actual_result } : {}),
        ...(values.verification_note ? { verification_note: values.verification_note } : {}),
        ...(values.comment ? { comment: values.comment } : {}),
        ...(payload.status ? { status: payload.status } : {}),
      });
    },
    onSuccess: (response, payload) => {
      setConflict(null);
      toast.success(payload.status ? `Статус: ${DECISION_STATUS_LABELS[response.data.status]}` : 'Решение сохранено');
      void queryClient.invalidateQueries({ queryKey: ['decision', id] });
      void queryClient.invalidateQueries({ queryKey: ['decision-history', id] });
      void queryClient.invalidateQueries({ queryKey: ['decisions'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
    onError: (error) => {
      const apiError = toApiError(error);
      if (apiError.code === 'VERSION_CONFLICT' || apiError.status === 409) {
        setConflict(apiError.message);
        toast.warning('Конфликт версий: данные перечитаны, введённые значения сохранены');
        void query.refetch();
        return;
      }
      Object.entries(apiError.fields).forEach(([field, message]) => {
        if (field in schema.shape) setError(field as keyof FormValues, { type: 'server', message });
      });
      toast.error(apiError.message);
    },
  });

  if (query.isLoading) return <LoadingState label="Загружаем решение…" />;
  if (query.error) {
    return <ErrorState message={toApiError(query.error).message} onRetry={() => void query.refetch()} />;
  }
  if (!decision) return null;

  const canWrite = can('decisions.write');
  const canVerify = can('decisions.verify');
  const isTerminal = decision.status === 'completed' || decision.status === 'cancelled';
  const next = NEXT_STATUS[decision.status];
  const isOwner = user?.id === decision.owner_id;

  const onSubmit = handleSubmit((values) => mutation.mutate({ values }));

  const onTransition = () => {
    if (!next) return;
    if (next.status === 'needs_review' && !getValues('actual_result')) {
      setError('actual_result', { type: 'manual', message: 'Укажите фактический результат перед проверкой' });
      toast.error('Для отправки на проверку нужен фактический результат');
      return;
    }
    if (next.status === 'completed' && !getValues('verification_note')) {
      setError('verification_note', { type: 'manual', message: 'Добавьте комментарий проверки' });
      toast.error('Для завершения нужен комментарий проверки');
      return;
    }
    mutation.mutate({ status: next.status });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={decision.title}
        description={`${decision.department_name ?? 'Компания целиком'} · ответственный ${decision.owner.full_name}`}
        meta={
          <>
            <Badge tone={DECISION_STATUS_TONES[decision.status]} dot>
              {DECISION_STATUS_LABELS[decision.status]}
            </Badge>
            <Badge tone={PRIORITY_TONES[decision.priority]}>{PRIORITY_LABELS[decision.priority]}</Badge>
            <Badge tone="info">версия {decision.version}</Badge>
            <Badge tone="idle">{formatDaysLeft(decision.deadline)}</Badge>
            {decision.alert_id && (
              <Link to={`/alerts/${decision.alert_id}`} className="link-quiet text-[0.6875rem]">
                исходное отклонение
              </Link>
            )}
          </>
        }
        actions={
          <>
            <Link to="/decisions">
              <Button variant="ghost" size="sm" icon={<ArrowLeft className="h-3.5 w-3.5" />}>
                К реестру
              </Button>
            </Link>
            {canWrite && !isTerminal && next && (
              <Button
                variant="primary"
                size="sm"
                loading={mutation.isPending}
                icon={next.status === 'completed' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
                onClick={onTransition}
                disabled={next.status === 'completed' && !canVerify}
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
              {conflict} Данные перечитаны с сервера, ваши введённые значения остались в форме. Проверьте поля и
              сохраните повторно.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            icon={<RefreshCw className="h-3.5 w-3.5" />}
            onClick={() => {
              setConflict(null);
              void query.refetch();
            }}
          >
            Перечитать
          </Button>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Карточка решения"
            subtitle={isTerminal ? 'Терминальное решение доступно только для чтения' : 'Изменения сохраняются с проверкой версии'}
            icon={<ShieldCheck className="h-4 w-4" />}
            action={
              canWrite && !isTerminal ? (
                <Button
                  variant="secondary"
                  size="sm"
                  loading={isSubmitting || mutation.isPending}
                  icon={<Save className="h-3.5 w-3.5" />}
                  onClick={onSubmit}
                  disabled={!isDirty}
                >
                  Сохранить
                </Button>
              ) : null
            }
          />
          <form onSubmit={onSubmit} className="space-y-3" noValidate>
            <FieldShell label="Название" htmlFor="title" required error={errors.title?.message}>
              <Input id="title" disabled={!canWrite || isTerminal} {...register('title')} />
            </FieldShell>

            <div className="grid gap-3 sm:grid-cols-2">
              <FieldShell label="Ответственный" htmlFor="owner_id" required error={errors.owner_id?.message}>
                <Select id="owner_id" disabled={!canWrite || isTerminal} {...register('owner_id')}>
                  {assignees.length === 0 && <option value={decision.owner_id}>{decision.owner.full_name}</option>}
                  {assignees.map((assignee) => (
                    <option key={assignee.id} value={assignee.id}>
                      {assignee.full_name}
                    </option>
                  ))}
                </Select>
              </FieldShell>
              <FieldShell label="Срок" htmlFor="deadline" required error={errors.deadline?.message}>
                <Input id="deadline" type="date" disabled={!canWrite || isTerminal} {...register('deadline')} />
              </FieldShell>
              <FieldShell label="Приоритет" htmlFor="priority" required error={errors.priority?.message}>
                <Select id="priority" disabled={!canWrite || isTerminal} {...register('priority')}>
                  {(Object.keys(PRIORITY_LABELS) as Priority[]).map((priority) => (
                    <option key={priority} value={priority}>
                      {PRIORITY_LABELS[priority]}
                    </option>
                  ))}
                </Select>
              </FieldShell>
              <FieldShell label="Комментарий к изменению" htmlFor="comment" error={errors.comment?.message}>
                <Input id="comment" placeholder="Необязательно" disabled={!canWrite || isTerminal} {...register('comment')} />
              </FieldShell>
            </div>

            <FieldShell label="Проблема" htmlFor="problem" required error={errors.problem?.message}>
              <Textarea id="problem" disabled={!canWrite || isTerminal} {...register('problem')} />
            </FieldShell>
            <FieldShell label="Влияние" htmlFor="impact" required error={errors.impact?.message}>
              <Textarea id="impact" disabled={!canWrite || isTerminal} {...register('impact')} />
            </FieldShell>
            <FieldShell label="Причина" htmlFor="cause" required error={errors.cause?.message}>
              <Textarea id="cause" disabled={!canWrite || isTerminal} {...register('cause')} />
            </FieldShell>
            <FieldShell label="Действие" htmlFor="action" required error={errors.action?.message}>
              <Textarea id="action" disabled={!canWrite || isTerminal} {...register('action')} />
            </FieldShell>
            <FieldShell label="Ожидаемый результат" htmlFor="expected_result" required error={errors.expected_result?.message}>
              <Textarea id="expected_result" disabled={!canWrite || isTerminal} {...register('expected_result')} />
            </FieldShell>
            <FieldShell
              label="Фактический результат"
              htmlFor="actual_result"
              error={errors.actual_result?.message}
              hint="Обязателен перед отправкой на проверку"
            >
              <Textarea
                id="actual_result"
                placeholder="Что получилось по факту, с числами"
                disabled={!canWrite || isTerminal}
                {...register('actual_result')}
              />
            </FieldShell>
            <FieldShell
              label="Комментарий проверки"
              htmlFor="verification_note"
              error={errors.verification_note?.message}
              hint="Обязателен при завершении решения"
            >
              <Textarea
                id="verification_note"
                placeholder="Кто и как проверил результат"
                disabled={!canVerify || isTerminal}
                {...register('verification_note')}
              />
            </FieldShell>

            {!canWrite && (
              <p className="rounded-md bg-ink-850/60 p-2 text-[0.6875rem] text-ink-400">
                Ваша роль позволяет просматривать решение, но не изменять его.
              </p>
            )}
          </form>
        </Card>

        <div className="space-y-3">
          <Card>
            <CardHeader title="Сводка" icon={<CalendarClock className="h-4 w-4" />} />
            <dl className="space-y-2 text-[0.6875rem]">
              {[
                ['Создано', formatDateTime(decision.created_at)],
                ['Автор', decision.creator.full_name],
                ['Срок', formatDate(decision.deadline)],
                ['Завершено', decision.completed_at ? formatDateTime(decision.completed_at) : '—'],
                ['Обновлено', formatDateTime(decision.updated_at)],
                ['Подразделение', decision.department_name ?? 'Компания'],
              ].map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-2">
                  <dt className="text-ink-400">{label}</dt>
                  <dd className="text-right font-medium text-ink-100">{value}</dd>
                </div>
              ))}
            </dl>
            {isOwner && !isTerminal && (
              <p className="mt-3 flex items-start gap-1.5 rounded-md border border-accent-400/30 bg-accent-500/10 p-2 text-[0.625rem] leading-relaxed text-accent-200">
                <UserRound className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                Вы ответственный по этому решению. Перед проверкой заполните фактический результат.
              </p>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Задачи по решению"
              subtitle={`${tasks.data?.total ?? 0} задач`}
              icon={<CheckCircle2 className="h-4 w-4" />}
            />
            {tasks.isLoading && <p className="py-3 text-center text-[0.6875rem] text-ink-400">Загрузка задач…</p>}
            {tasks.data && tasks.data.items.length === 0 && (
              <p className="py-3 text-center text-[0.6875rem] text-ink-400">Задачи не создавались.</p>
            )}
            <ul className="space-y-1.5">
              {tasks.data?.items.map((task) => (
                <li key={task.id}>
                  <Link
                    to={`/tasks/${task.id}`}
                    className="flex items-center justify-between gap-2 rounded-md border border-ink-700/60 bg-ink-850/50 px-2 py-1.5 text-[0.6875rem] transition hover:border-accent-400/40"
                  >
                    <span className="truncate text-ink-100">{task.title}</span>
                    <Badge tone={TASK_STATUS_TONES[task.status]}>{TASK_STATUS_LABELS[task.status]}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader
          title="История изменений"
          subtitle="Каждая правка увеличивает версию записи и попадает в журнал"
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
                {Object.keys(event.new_values).length > 0 && (
                  <p className="mt-0.5 font-mono text-[0.625rem] leading-relaxed text-ink-500">
                    {Object.entries(event.new_values)
                      .map(([key, value]) => `${key}: ${String(value)}`)
                      .join(' · ')}
                  </p>
                )}
                {event.comment && <p className="mt-0.5 text-[0.6875rem] text-ink-300">{event.comment}</p>}
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
