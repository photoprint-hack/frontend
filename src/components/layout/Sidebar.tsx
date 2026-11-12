import { NavLink } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CalendarClock,
  ClipboardCheck,
  Database,
  FileClock,
  Gauge,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Network,
  ShieldCheck,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { cn } from '@/lib/utils/cn';
import { useAuth } from '@/lib/auth/auth-context';
import { navVisibility } from '@/lib/auth/rbac';
import { ROLE_LABELS } from '@/constants/labels';
import { initials } from '@/lib/formatters';
import { CompassMark } from '@/components/brand/CompassMark';

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  visible: boolean;
}

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, role, logout } = useAuth();
  const visibility = navVisibility(role);

  const groups: { title: string; items: NavItem[] }[] = [
    {
      title: 'Управление',
      items: [
        { to: '/dashboard', label: 'Обзор компании', icon: LayoutDashboard, visible: visibility.dashboard },
        { to: '/analytics', label: 'Аналитика', icon: BarChart3, visible: visibility.analytics },
        { to: '/impact-map', label: 'Карта влияния', icon: Network, visible: visibility.impactMap },
      ],
    },
    {
      title: 'Показатели',
      items: [
        { to: '/sales', label: 'Продажи и клиенты', icon: TrendingUp, visible: visibility.sales },
        { to: '/production', label: 'Производство и качество', icon: Gauge, visible: visibility.production },
        { to: '/finance-hr', label: 'Финансы и персонал', icon: Building2, visible: visibility.financeHr },
        { to: '/forecast', label: 'Прогноз мощностей', icon: CalendarClock, visible: visibility.forecast },
      ],
    },
    {
      title: 'Управленческий цикл',
      items: [
        { to: '/alerts', label: 'Отклонения', icon: AlertTriangle, visible: visibility.alerts },
        { to: '/decisions', label: 'Управленческие решения', icon: ShieldCheck, visible: visibility.decisions },
        { to: '/tasks', label: 'Задачи', icon: ListChecks, visible: visibility.tasks },
      ],
    },
    {
      title: 'Данные и контроль',
      items: [
        { to: '/data-quality', label: 'Качество данных', icon: Database, visible: visibility.dataQuality },
        { to: '/audit-logs', label: 'Журнал действий', icon: FileClock, visible: visibility.auditLogs },
        { to: '/users', label: 'Пользователи', icon: Users, visible: visibility.users },
      ],
    },
  ];

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-40 bg-ink-950/75 transition-opacity lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-ink-700/70 bg-ink-900 transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:shrink-0 lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="Основная навигация"
      >
        <div className="flex h-14 items-center justify-between gap-2 border-b border-ink-700/70 px-4">
          <div className="flex items-center gap-2.5">
            <CompassMark className="h-8 w-8" />
            <div className="leading-tight">
              <p className="text-sm font-semibold tracking-tight text-ink-50">Компас</p>
              <p className="text-[0.625rem] text-ink-400">ООО «Фотопринт»</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-ink-300 hover:bg-ink-800 hover:text-ink-100 lg:hidden"
            aria-label="Закрыть навигацию"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-2.5 py-4">
          {groups.map((group) => {
            const items = group.items.filter((item) => item.visible);
            if (items.length === 0) return null;
            return (
              <div key={group.title}>
                <p className="label-caps px-2 pb-1.5">{group.title}</p>
                <ul className="space-y-0.5">
                  {items.map((item) => (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        onClick={onClose}
                        className={({ isActive }) =>
                          cn(
                            'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[0.8125rem] font-medium transition-colors',
                            isActive
                              ? 'bg-accent-500/12 text-accent-200 ring-1 ring-inset ring-accent-400/30'
                              : 'text-ink-200 hover:bg-ink-800/70 hover:text-ink-50',
                          )
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <item.icon
                              className={cn('h-4 w-4 shrink-0', isActive ? 'text-accent-300' : 'text-ink-400')}
                            />
                            <span className="truncate">{item.label}</span>
                          </>
                        )}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-ink-700/70 p-3">
          <div className="flex items-center gap-2.5 rounded-lg bg-ink-850/70 p-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-500/15 text-[0.6875rem] font-semibold text-accent-200 ring-1 ring-accent-400/30">
              {initials(user?.full_name ?? '—')}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-xs font-medium text-ink-50">{user?.full_name}</p>
              <p className="truncate text-[0.625rem] text-ink-400">{role ? ROLE_LABELS[role] : ''}</p>
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              className="rounded-md p-1.5 text-ink-400 transition hover:bg-ink-800 hover:text-signal-bad"
              aria-label="Выйти из системы"
              title="Выйти"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 flex items-start gap-1.5 px-1 text-[0.625rem] leading-relaxed text-ink-500">
            <ClipboardCheck className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            Синтетические демонстрационные данные
          </p>
        </div>
      </aside>
    </>
  );
}
