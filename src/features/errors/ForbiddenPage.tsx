import { Link } from 'react-router-dom';
import { Home, Lock, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/auth/auth-context';
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from '@/constants/labels';

export function ForbiddenPage() {
  const { role, home, status } = useAuth();

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-signal-warn/40 bg-signal-warn/10 text-signal-warn">
        <Lock className="h-6 w-6" aria-hidden />
      </div>
      <div className="space-y-1.5">
        <p className="font-mono text-3xl font-semibold tracking-tight text-ink-50">403</p>
        <p className="text-sm font-medium text-ink-100">Раздел недоступен для вашей роли</p>
        <p className="mx-auto max-w-md text-xs leading-relaxed text-ink-400">
          {role
            ? `Вы вошли как «${ROLE_LABELS[role]}»: ${ROLE_DESCRIPTIONS[role]}. Обратитесь к администратору платформы, если нужен расширенный доступ.`
            : 'Требуется вход в систему с корпоративной учётной записью.'}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Link to={status === 'authenticated' ? home : '/login'}>
          <Button variant="primary" size="sm" icon={<Home className="h-3.5 w-3.5" />}>
            {status === 'authenticated' ? 'Вернуться к работе' : 'Перейти ко входу'}
          </Button>
        </Link>
        <Link to="/tasks">
          <Button variant="outline" size="sm" icon={<ShieldCheck className="h-3.5 w-3.5" />}>
            Мои задачи
          </Button>
        </Link>
      </div>
    </div>
  );
}
