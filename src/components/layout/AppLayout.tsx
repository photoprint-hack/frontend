import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { FiltersProvider } from '@/components/filters/FiltersContext';
import { catalogApi } from '@/lib/api/endpoints';
import { useAuth } from '@/lib/auth/auth-context';
import type { Department, Product } from '@/types/api';

/** Разделы, где глобальные фильтры применимы (ТЗ 5). */
const FILTER_ROUTES = [
  '/dashboard',
  '/sales',
  '/orders',
  '/production',
  '/finance-hr',
  '/analytics',
  '/impact-map',
  '/alerts',
  '/decisions',
  '/data-quality',
  '/metrics',
  '/forecast',
];

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const previousLocation = useRef(location);
  const { role, user } = useAuth();

  // Keep the current reporting context when following links between related screens.
  useEffect(() => {
    const previous = previousLocation.current;
    const filterKeys = ['date_from', 'date_to', 'preset', 'department_id', 'product_id'];
    const previousParams = new URLSearchParams(previous.search);
    const currentParams = new URLSearchParams(location.search);
    const cameFromReportingPage = FILTER_ROUTES.some((route) => previous.pathname.startsWith(route));
    const enteredReportingPage = FILTER_ROUTES.some((route) => location.pathname.startsWith(route));
    const currentHasFilters = filterKeys.some((key) => currentParams.has(key));
    const previousHasFilters = filterKeys.some((key) => previousParams.has(key));

    if (previous.pathname !== location.pathname && cameFromReportingPage && enteredReportingPage && !currentHasFilters && previousHasFilters) {
      filterKeys.forEach((key) => {
        const value = previousParams.get(key);
        if (value !== null) currentParams.set(key, value);
      });
      navigate({ pathname: location.pathname, search: `?${currentParams.toString()}` }, { replace: true });
    }
    previousLocation.current = location;
  }, [location, navigate]);

  const { data: departments } = useQuery({
    queryKey: ['departments', role],
    queryFn: async () => (await catalogApi.departments()).data,
    staleTime: 10 * 60_000,
  });

  const { data: products } = useQuery({
    queryKey: ['products', role],
    queryFn: async () => (await catalogApi.products()).data,
    staleTime: 10 * 60_000,
  });

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const content = (
    <div className="flex min-h-screen">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="min-w-0 flex-1 px-3 py-4 sm:px-5 sm:py-5 xl:px-8 xl:py-7">
          <div className="mx-auto w-full max-w-[1680px]">
            <Outlet />
          </div>
        </main>
        <footer className="border-t border-ink-800/70 px-4 py-3 text-[0.6875rem] text-ink-500">
          Компас · Управление компанией · ООО «Фотопринт» · Демонстрационные данные
        </footer>
      </div>
    </div>
  );

  const needsFilters = FILTER_ROUTES.some((route) => location.pathname.startsWith(route));

  if (!needsFilters) return content;

  return (
    <FiltersProvider
      departments={(departments ?? []) as Department[]}
      products={(products ?? []) as Product[]}
      fixedDepartmentId={role === 'manager' ? (user?.department_id ?? '') : undefined}
    >
      {content}
    </FiltersProvider>
  );
}
