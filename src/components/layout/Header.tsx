import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut, Menu, RefreshCw, ShieldCheck, UserRound } from 'lucide-react';
import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils/cn';
import { useAuth } from '@/lib/auth/auth-context';
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from '@/constants/labels';
import { Badge } from '@/components/ui/Badge';
import { initials } from '@/lib/formatters';
import { USE_MOCKS } from '@/lib/api/client';

const TITLES: Record<string, string> = {
  '/dashboard': 'Обзор компании',
  '/sales': 'Продажи и клиенты',
  '/orders': 'Реестр заказов',
  '/production': 'Производство и качество',
  '/finance-hr': 'Финансы и персонал',
  '/analytics': 'Аналитика',
  '/impact-map': 'Карта влияния',
  '/alerts': 'Отклонения',
  '/decisions': 'Управленческие решения',
  '/tasks': 'Задачи',
  '/forecast': 'Прогноз спроса и мощностей',
  '/data-quality': 'Качество данных',
  '/audit-logs': 'Журнал действий',
  '/users': 'Управление пользователями',
};

function titleFor(pathname: string): string {
  if (TITLES[pathname]) return TITLES[pathname] as string;
  const base = `/${pathname.split('/')[1] ?? ''}`;
  if (TITLES[base]) return TITLES[base] as string;
  return 'Управленческая платформа';
}

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, role, logout } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const fetching = useIsFetching();
  const queryClient = useQueryClient();
  const subtitle = useMemo(() => (role ? ROLE_LABELS[role] : 'Рабочая область'), [role]);

  return (
    <header className="sticky top-0 z-30 border-b border-ink-700 bg-ink-950">
      <div className="flex h-14 items-center gap-3 px-3 sm:px-5">
        <button
          type="button"
          onClick={onMenuClick}
          className="rounded-lg p-2 text-ink-200 transition hover:bg-ink-800 hover:text-ink-50 lg:hidden"
          aria-label="Открыть навигацию"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold tracking-tight text-ink-50 sm:text-base">
            {titleFor(location.pathname)}
          </h1>
          <p className="hidden truncate text-[0.6875rem] text-ink-400 sm:block">
            {subtitle} · ООО «Фотопринт»
          </p>
        </div>

        <div className="hidden items-center gap-2 sm:flex">
          <Badge tone="idle" title="Демонстрационный контур">
            Синтетические данные
          </Badge>
          {USE_MOCKS && (
            <Badge tone="accent" dot title="Данные формируются встроенным mock-API">
              Mock API
            </Badge>
          )}
          <Badge tone={fetching > 0 ? 'info' : 'ok'} dot>
            {fetching > 0 ? 'Обновление' : 'Готово'}
          </Badge>
        </div>

        <button
          type="button"
          onClick={() => void queryClient.invalidateQueries()}
          className="rounded-lg p-2 text-ink-300 transition hover:bg-ink-800 hover:text-ink-50"
          aria-label="Обновить данные"
          title="Обновить данные"
        >
          <RefreshCw className={cn('h-4 w-4', fetching > 0 && 'animate-spin text-accent-300')} />
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setProfileOpen((prev) => !prev)}
            className="flex items-center gap-2 rounded-lg border border-ink-700 bg-ink-850/70 py-1 pl-1 pr-2 transition hover:border-ink-600"
            aria-haspopup="menu"
            aria-expanded={profileOpen}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-500/15 text-[0.625rem] font-semibold text-accent-200 ring-1 ring-accent-400/30">
              {initials(user?.full_name ?? '—')}
            </span>
            <span className="hidden max-w-[130px] truncate text-xs font-medium text-ink-100 md:block">
              {user?.full_name}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-ink-400" />
          </button>

          {profileOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setProfileOpen(false)} aria-hidden />
              <div
                className="absolute right-0 top-[calc(100%+8px)] z-20 w-72 animate-fade-in rounded-xl border border-ink-700 bg-ink-900 p-3 shadow-card"
                role="menu"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-500/15 text-xs font-semibold text-accent-200 ring-1 ring-accent-400/30">
                    {initials(user?.full_name ?? '—')}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink-50">{user?.full_name}</p>
                    <p className="truncate text-[0.6875rem] text-ink-400">{user?.email}</p>
                  </div>
                </div>
                <div className="mt-3 space-y-1.5 rounded-lg bg-ink-850/70 p-2.5">
                  <p className="flex items-center gap-1.5 text-[0.6875rem] font-medium text-accent-300">
                    <ShieldCheck className="h-3.5 w-3.5" /> {role ? ROLE_LABELS[role] : '—'}
                  </p>
                  <p className="text-[0.6875rem] leading-relaxed text-ink-300">{role ? ROLE_DESCRIPTIONS[role] : ''}</p>
                </div>
                <div className="mt-2 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      navigate('/tasks?mine=true');
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-ink-200 transition hover:bg-ink-800 hover:text-ink-50"
                    role="menuitem"
                  >
                    <UserRound className="h-3.5 w-3.5" /> Мои задачи
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      void logout();
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-signal-bad transition hover:bg-signal-bad/10"
                    role="menuitem"
                  >
                    <LogOut className="h-3.5 w-3.5" /> Выйти из системы
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
