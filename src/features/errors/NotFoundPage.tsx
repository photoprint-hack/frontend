import { Link } from 'react-router-dom';
import { Compass, Home, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/auth/auth-context';

export function NotFoundPage() {
  const { status, home } = useAuth();

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-ink-600 bg-ink-850/70 text-accent-300">
        <Compass className="h-6 w-6" aria-hidden />
      </div>
      <div className="space-y-1.5">
        <p className="font-mono text-3xl font-semibold tracking-tight text-ink-50">404</p>
        <p className="text-sm font-medium text-ink-100">Страница не найдена</p>
        <p className="mx-auto max-w-md text-xs leading-relaxed text-ink-400">
          Проверьте адрес или вернитесь к работе с показателями. Если вы переходили по ссылке из письма — она могла
          устареть.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Link to={status === 'authenticated' ? home : '/login'}>
          <Button variant="primary" size="sm" icon={<Home className="h-3.5 w-3.5" />}>
            {status === 'authenticated' ? 'На главный экран' : 'Перейти ко входу'}
          </Button>
        </Link>
        {status !== 'authenticated' && (
          <Link to="/login">
            <Button variant="outline" size="sm" icon={<LogIn className="h-3.5 w-3.5" />}>
              Войти в систему
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
