import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, ArrowRight, FileText, Info } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { FieldShell, Input, Select, Textarea } from '@/components/ui/Field';
import { ErrorState } from '@/components/feedback/States';
import { alertsApi, catalogApi, decisionsApi, usersApi, type AssigneeDto } from '@/lib/api/endpoints';
import { createIdempotencyKey, toApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/auth-context';
import { PRIORITY_LABELS, ROLE_LABELS } from '@/constants/labels';
import { formatDate, formatDateTime, formatUnit } from '@/lib/formatters';
import type { Priority } from '@/types/api';

const schema = z.object({
  title: z.string().trim().min(5, 'Минимум 5 символов').max(200, 'Максимум 200 символов'),
  problem: z.string().trim().min(10, 'Опишите проблему подробнее'),
  impact: z.string().trim().min(3, 'Укажите эффект или потери'),
  cause: z.string().trim().min(3, 'Укажите причину'),
  action: z.string().trim().min(5, 'Опишите действие'),
  expected_result: z.string().trim().min(3, 'Опишите ожидаемый результат'),
  department_id: z.string().optional(),
  owner_id: z.string().min(1, 'Выберите ответственного'),
  deadline: z.string().min(1, 'Укажите срок'),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
});

type FormValues = z.infer<typeof schema>;

function defaultDeadline(): string {
  const date = new Date();
  date.setDate(date.getDate() + 14);
  return date.toISOString().slice(0, 10);
}

export function DecisionCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const alertId = searchParams.get('alert_id');
  const { user, role } = useAuth();
  const [idempotencyKey] = useState(() => createIdempotencyKey());
  const [formError, setFormError] = useState<string | null>(null);

  const departmentsQuery = useQuery({
    queryKey: ['departments', role],
    queryFn: async () => (await catalogApi.departments()).data,
    staleTime: 10 * 60_000,
  });
  const departments = departmentsQuery.data ?? [];

  const alertQuery = useQuery({
    queryKey: ['alert', alertId],
    queryFn: async () => (await alertsApi.get(alertId as string)).data,
    enabled: Boolean(alertId),
  });

  const assigneesQuery = useQuery({
    queryKey: ['assignees', role],
    queryFn: async () => usersApi.list({ page_size: 100 }),
  });

  const assignees = useMemo<AssigneeDto[]>(() => {
    const items = (assigneesQuery.data?.items ?? []) as AssigneeDto[];
    return items.filter((item) => item.role !== 'employee');
  }, [assigneesQuery.data]);

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      problem: '',
      impact: '',
      cause: '',
      action: '',
      expected_result: '',
      department_id: '',
      owner_id: '',
      deadline: defaultDeadline(),
      priority: 'high',
    },
  });

  const alert = alertQuery.data?.alert;

  useEffect(() => {
    if (!alert) return;
    setValue('title', `Решение по отклонению: ${alert.title}`);
    setValue('problem', alert.description);
    setValue(
      'impact',
      `Отклонение ${alert.deviation_percent === null ? '' : `${alert.deviation_percent.toFixed(1)}% `}по показателю «${alert.metric_name}» за период ${formatDate(alert.period_start)} — ${formatDate(alert.period_end)}.`,
    );
    setValue('department_id', alert.department_id ?? '');
  }, [alert, setValue]);

  useEffect(() => {
    if (!user) return;
    if (role === 'manager' && user.department_id) {
      setValue('department_id', user.department_id);
    }
    if (!watch('owner_id')) setValue('owner_id', user.id);
  }, [user, role, setValue, watch]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) =>
      decisionsApi.create(
        {
          title: values.title,
          problem: values.problem,
          impact: values.impact,
          cause: values.cause,
          action: values.action,
          expected_result: values.expected_result,
          department_id: values.department_id || null,
          owner_id: values.owner_id,
          alert_id: alertId,
          deadline: values.deadline,
          priority: values.priority,
        },
        idempotencyKey,
      ),
    onSuccess: (response) => {
      toast.success('Решение создано');
      navigate(`/decisions/${response.data.id}`);
    },
    onError: (error) => {
      const apiError = toApiError(error);
      setFormError(apiError.message);
      Object.entries(apiError.fields).forEach(([field, message]) => {
        if (field in schema.shape) {
          setError(field as keyof FormValues, { type: 'server', message });
        }
      });
      toast.error(apiError.message);
    },
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    mutation.mutate(values);
  });

  if (assigneesQuery.error) {
    return (
      <ErrorState
        title="Не удалось загрузить ответственных"
        message={toApiError(assigneesQuery.error).message}
        onRetry={() => void assigneesQuery.refetch()}
      />
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Новое управленческое решение"
        description="Зафиксируйте проблему, причину, действие и ответственного. Решение получит статус «Новое» и версию 1."
        meta={
          alert ? <Badge tone="bad">По отклонению: {alert.metric_name}</Badge> : null
        }
        actions={
          <Link to="/decisions">
            <Button variant="ghost" size="sm" icon={<ArrowLeft className="h-3.5 w-3.5" />}>
              К реестру
            </Button>
          </Link>
        }
      />

      {alertQuery.error && (
        <ErrorState
          title="Отклонение недоступно"
          message={toApiError(alertQuery.error).message}
          onRetry={() => void alertQuery.refetch()}
        />
      )}

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Карточка решения"
            subtitle="Все поля обязательны, кроме подразделения"
            icon={<FileText className="h-4 w-4" />}
          />
          <form onSubmit={onSubmit} className="space-y-3" noValidate>
            <FieldShell label="Название решения" htmlFor="title" required error={errors.title?.message}>
              <Input id="title" placeholder="Например: снизить долю брака на линии цифровой печати" {...register('title')} />
            </FieldShell>

            <div className="grid gap-3 sm:grid-cols-2">
              <FieldShell label="Подразделение" htmlFor="department_id" error={errors.department_id?.message}>
                <Select id="department_id" {...register('department_id')} disabled={role === 'manager'}>
                  <option value="">Компания целиком</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </Select>
              </FieldShell>

              <FieldShell label="Ответственный" htmlFor="owner_id" required error={errors.owner_id?.message}>
                <Select id="owner_id" {...register('owner_id')}>
                  <option value="">Выберите ответственного</option>
                  {assignees.map((assignee) => (
                    <option key={assignee.id} value={assignee.id}>
                      {assignee.full_name} · {ROLE_LABELS[assignee.role]}
                    </option>
                  ))}
                </Select>
              </FieldShell>

              <FieldShell label="Срок" htmlFor="deadline" required error={errors.deadline?.message}>
                <Input id="deadline" type="date" {...register('deadline')} />
              </FieldShell>

              <FieldShell label="Приоритет" htmlFor="priority" required error={errors.priority?.message}>
                <Select id="priority" {...register('priority')}>
                  {(Object.keys(PRIORITY_LABELS) as Priority[]).map((priority) => (
                    <option key={priority} value={priority}>
                      {PRIORITY_LABELS[priority]}
                    </option>
                  ))}
                </Select>
              </FieldShell>
            </div>

            <FieldShell label="Проблема" htmlFor="problem" required error={errors.problem?.message}>
              <Textarea id="problem" placeholder="Что происходит и где это видно" {...register('problem')} />
            </FieldShell>

            <FieldShell label="Влияние на бизнес" htmlFor="impact" required error={errors.impact?.message}>
              <Textarea id="impact" placeholder="Потери, риски, затронутые процессы" {...register('impact')} />
            </FieldShell>

            <FieldShell
              label="Причина"
              htmlFor="cause"
              required
              error={errors.cause?.message}
              hint="Причина должна быть подтверждена данными источника"
            >
              <Textarea id="cause" placeholder="Например: износ оборудования и отсутствие калибровки" {...register('cause')} />
            </FieldShell>

            <FieldShell label="Действие" htmlFor="action" required error={errors.action?.message}>
              <Textarea id="action" placeholder="Что конкретно будет сделано" {...register('action')} />
            </FieldShell>

            <FieldShell
              label="Ожидаемый результат"
              htmlFor="expected_result"
              required
              error={errors.expected_result?.message}
              hint="Измеримый результат: значение показателя и срок"
            >
              <Textarea
                id="expected_result"
                placeholder="Например: доля брака ≤ 4,5% к концу периода"
                {...register('expected_result')}
              />
            </FieldShell>

            {formError && (
              <div
                className="rounded-lg border border-signal-bad/40 bg-signal-bad/10 px-3 py-2 text-xs text-signal-bad"
                role="alert"
              >
                {formError}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-ink-800/80 pt-3">
              <Link to="/decisions">
                <Button type="button" variant="ghost" size="sm">
                  Отмена
                </Button>
              </Link>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={isSubmitting || mutation.isPending}
                icon={<ArrowRight className="h-3.5 w-3.5" />}
              >
                Создать решение
              </Button>
            </div>
          </form>
        </Card>

        <div className="space-y-3">
          {alert && (
            <Card>
              <CardHeader
                title="Исходное отклонение"
                subtitle={alert.department_name ?? 'Компания'}
                icon={<Info className="h-4 w-4" />}
              />
              <p className="text-xs font-medium text-ink-100">{alert.title}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-400">{alert.description}</p>
              <dl className="mt-3 space-y-2 text-[11px]">
                {[
                  ['Показатель', alertQuery.data?.metric.name ?? alert.metric_name],
                  ['Факт', formatUnit(alert.actual, alertQuery.data?.metric.unit ?? '%')],
                  ['План', formatUnit(alert.target, alertQuery.data?.metric.unit ?? '%')],
                  ['Отклонение', alert.deviation_percent === null ? '—' : `${alert.deviation_percent.toFixed(1)}%`],
                  ['Создано', formatDateTime(alert.created_at)],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-2">
                    <dt className="text-ink-400">{label}</dt>
                    <dd className="text-right font-medium text-ink-100">{value}</dd>
                  </div>
                ))}
              </dl>
              <Link to={`/alerts/${alert.id}`} className="link-quiet mt-3 inline-block text-[11px]">
                Открыть карточку отклонения
              </Link>
            </Card>
          )}

          <Card>
            <CardHeader title="Как заполнять" subtitle="Подсказки по методике" />
            <ul className="space-y-2 text-[11px] leading-relaxed text-ink-300">
              <li>
                <span className="font-medium text-ink-100">Проблема</span> — факт из данных, без оценок и эмоций.
              </li>
              <li>
                <span className="font-medium text-ink-100">Причина</span> — подтверждённая гипотеза; если причина не
                найдена, укажите, какие данные нужны.
              </li>
              <li>
                <span className="font-medium text-ink-100">Действие</span> — конкретный шаг с владельцем процесса.
              </li>
              <li>
                <span className="font-medium text-ink-100">Результат</span> — измеримое целевое значение показателя.
              </li>
            </ul>
            <p className="mt-3 rounded-md bg-ink-850/60 p-2 text-[10px] leading-relaxed text-ink-500">
              После создания решение проходит проверку результата: перед завершением потребуется комментарий
              верификации, а перед отправкой на проверку — фактический результат.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
