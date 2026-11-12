import { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, KeyRound, Mail, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FieldShell, Input } from '@/components/ui/Field';
import { useAuth } from '@/lib/auth/auth-context';
import { toApiError, USE_MOCKS } from '@/lib/api/client';
import { homeRoute } from '@/lib/auth/rbac';
import { ROLE_LABELS } from '@/constants/labels';
import { cn } from '@/lib/utils/cn';
import type { Role } from '@/types/api';
import { CompassMark } from '@/components/brand/CompassMark';

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
    <div className="relative flex min-h-[100svh] items-center justify-center overflow-x-hidden px-4 py-4 sm:py-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 top-1/4 h-[520px] w-[520px] rounded-full bg-accent-500/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 bottom-0 h-[420px] w-[420px] rounded-full bg-signal-info/10 blur-3xl"
      />

      <div className="relative grid w-full max-w-4xl gap-4 lg:grid-cols-[1fr_0.92fr]">
        <div className="hidden flex-col justify-between rounded-2xl border border-ink-700/70 bg-ink-900/60 p-6 shadow-card lg:flex xl:p-7">
          <div>
            <div className="flex items-center gap-2.5">
              <CompassMark className="h-10 w-10" />
              <div>
                <p className="text-base font-semibold tracking-tight text-ink-50">Компас</p>
                <p className="text-[0.6875rem] text-ink-400">Система управления компанией</p>
              </div>
            </div>

            <h2 className="mt-8 max-w-md text-balance text-2xl font-semibold leading-snug tracking-tight text-ink-50">
              Видеть главное. Двигаться уверенно.
            </h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-300">
              Показатели, причины и решения — в одном рабочем пространстве.
            </p>
          </div>

          <div className="mt-8 flex items-center gap-2 text-[0.6875rem] text-ink-500">
            <ShieldAlert className="h-3.5 w-3.5 text-signal-warn" aria-hidden />
            Демонстрационный контур · ООО «Фотопринт»
          </div>
        </div>

        <div className="surface p-5 sm:p-6">
          <div className="lg:hidden">
            <div className="flex items-center gap-2.5">
              <CompassMark className="h-9 w-9" />
              <div>
                <p className="text-sm font-semibold text-ink-50">Компас</p>
                <p className="text-[0.625rem] text-ink-400">Видеть главное. Двигаться уверенно.</p>
              </div>
            </div>
          </div>

          <h1 className="mt-5 text-lg font-semibold tracking-tight text-ink-50 lg:mt-0">Вход в систему</h1>
          <p className="mt-1 text-xs text-ink-300">
            Используйте корпоративную учётную запись. Самостоятельная регистрация не предусмотрена.
          </p>

          <form onSubmit={onSubmit} className="mt-4 space-y-3" noValidate>
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
            <details className="mt-4 rounded-lg border border-ink-700/70 bg-ink-850/40 p-3">
              <summary className="cursor-pointer text-[0.6875rem] font-medium text-ink-300 marker:text-ink-500">
                Демонстрационные аккаунты
              </summary>
              <p className="mt-2 text-[0.6875rem] text-ink-400">
                Пароль для всех ролей: <span className="font-mono text-accent-300">{DEMO_PASSWORD}</span>
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
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
