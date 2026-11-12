import { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Activity, ArrowRight, CheckCircle2, KeyRound, Mail, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FieldShell, Input } from '@/components/ui/Field';
import { useAuth } from '@/lib/auth/auth-context';
import { toApiError, USE_MOCKS } from '@/lib/api/client';
import { homeRoute } from '@/lib/auth/rbac';
import { ROLE_LABELS } from '@/constants/labels';
import { cn } from '@/lib/utils/cn';
import type { Role } from '@/types/api';

const schema = z.object({
  email: z.string().min(1, 'Укажите корпоративную почту').email('Некорректный формат почты'),
  password: z.string().min(1, 'Введите пароль'),
});

type FormValues = z.infer<typeof schema>;

const DEMO_ACCOUNTS: { role: Role; email: string }[] = [
  { role: 'director', email: 'director@photoprint.by' },
  { role: 'manager', email: 'manager@photoprint.by' },
  { role: 'analyst', email: 'analyst@photoprint.by' },
  { role: 'employee', email: 'employee@photoprint.by' },
  { role: 'admin', email: 'admin@photoprint.by' },
];

const DEMO_PASSWORD = 'Demo12345678';

export function LoginPage() {
  const { login, status, home } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  if (status === 'authenticated') {
    return <Navigate to={home} replace />;
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setFieldErrors({});
    try {
      const user = await login(values.email, values.password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from !== '/login' ? from : homeRoute(user.role), { replace: true });
    } catch (error) {
      const apiError = toApiError(error);
      if (apiError.status === 422 || Object.keys(apiError.fields).length > 0) {
        setFieldErrors(apiError.fields);
      }
      setFormError(apiError.message);
    }
  });

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 top-1/4 h-[520px] w-[520px] rounded-full bg-accent-500/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 bottom-0 h-[420px] w-[420px] rounded-full bg-signal-info/10 blur-3xl"
      />

      <div className="relative grid w-full max-w-5xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="hidden flex-col justify-between rounded-2xl border border-ink-700/70 bg-ink-900/60 p-8 shadow-card lg:flex">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-500/15 ring-1 ring-accent-400/40">
                <Activity className="h-5 w-5 text-accent-300" />
              </div>
              <div>
                <p className="text-base font-semibold tracking-tight text-ink-50">Единая система управления</p>
                <p className="text-[0.6875rem] uppercase tracking-[0.16em] text-ink-400">ООО «Фотопринт»</p>
              </div>
            </div>

            <h2 className="mt-10 max-w-md text-balance text-2xl font-semibold leading-snug tracking-tight text-ink-50">
              От показателя к решению — весь управленческий цикл в одном окне
            </h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-300">
              Показатель → отклонение → причина → решение → ответственный → срок → контроль результата.
            </p>

            <ul className="mt-8 space-y-2.5 text-sm text-ink-200">
              {[
                '12 KPI компании с планом, фактом и прогнозом',
                'Реестр решений и задач с историей изменений',
                'Прогноз спроса и мощностей на 4 недели',
                'Контроль качества данных и журнал действий',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-300" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-10 flex items-center gap-2 rounded-lg border border-ink-700/70 bg-ink-850/60 px-3 py-2 text-[0.6875rem] text-ink-400">
            <ShieldAlert className="h-3.5 w-3.5 text-signal-warn" aria-hidden />
            Синтетические демонстрационные данные. Реальные персональные данные не используются.
          </div>
        </div>

        <div className="surface p-6 sm:p-8">
          <div className="lg:hidden">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-500/15 ring-1 ring-accent-400/40">
                <Activity className="h-4 w-4 text-accent-300" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink-50">Единая система управления</p>
                <p className="text-[0.625rem] uppercase tracking-[0.16em] text-ink-400">ООО «Фотопринт»</p>
              </div>
            </div>
          </div>

          <h1 className="mt-6 text-lg font-semibold tracking-tight text-ink-50 lg:mt-0">Вход в платформу</h1>
          <p className="mt-1 text-xs text-ink-300">
            Используйте корпоративную учётную запись. Самостоятельная регистрация не предусмотрена.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
            <FieldShell label="Корпоративная почта" htmlFor="email" required error={errors.email?.message ?? fieldErrors.email}>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  placeholder="director@photoprint.by"
                  className="pl-8"
                  {...register('email')}
                />
              </div>
            </FieldShell>

            <FieldShell label="Пароль" htmlFor="password" required error={errors.password?.message ?? fieldErrors.password}>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••••"
                  className="pl-8"
                  {...register('password')}
                />
              </div>
            </FieldShell>

            {formError && (
              <div className="rounded-lg border border-signal-bad/40 bg-signal-bad/10 px-3 py-2 text-xs text-signal-bad" role="alert">
                {formError}
              </div>
            )}

            <Button type="submit" variant="primary" size="lg" className="w-full" loading={isSubmitting}>
              Войти
              {!isSubmitting && <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>

          {USE_MOCKS && (
            <div className="mt-6 rounded-lg border border-ink-700/70 bg-ink-850/50 p-3">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-ink-300">
                Демонстрационные роли
              </p>
              <p className="mt-1 text-[0.6875rem] text-ink-400">
                Пароль для всех учётных записей: <span className="font-mono text-accent-300">{DEMO_PASSWORD}</span>
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {DEMO_ACCOUNTS.map((account) => (
                  <button
                    key={account.role}
                    type="button"
                    onClick={() => {
                      setValue('email', account.email, { shouldValidate: true });
                      setValue('password', DEMO_PASSWORD, { shouldValidate: true });
                    }}
                    className={cn(
                      'rounded-md border border-ink-600 bg-ink-800/60 px-2 py-1 text-[0.6875rem] text-ink-200 transition',
                      'hover:border-accent-400/50 hover:text-accent-200',
                    )}
                  >
                    {ROLE_LABELS[account.role]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
