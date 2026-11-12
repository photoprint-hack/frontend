import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Department, Product } from '@/types/api';
import { addDays, startOfMonth, startOfWeek, toDateKey } from '@/lib/mock/random';

export type PeriodPreset = 'today' | 'week' | 'month' | 'prev_month' | 'quarter' | 'custom';

export interface FiltersState {
  date_from: string;
  date_to: string;
  department_id: string;
  product_id: string;
  preset: PeriodPreset;
}

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  today: 'Сегодня',
  week: 'Текущая неделя',
  month: 'Текущий месяц',
  prev_month: 'Предыдущий месяц',
  quarter: 'Текущий квартал',
  custom: 'Произвольный период',
};

function presetRange(preset: PeriodPreset): { from: string; to: string } {
  const today = new Date();
  switch (preset) {
    case 'today':
      return { from: toDateKey(today), to: toDateKey(today) };
    case 'week': {
      const start = startOfWeek(today);
      return { from: toDateKey(start), to: toDateKey(addDays(start, 6)) };
    }
    case 'prev_month': {
      const firstOfThis = startOfMonth(today);
      const prevStart = new Date(firstOfThis.getFullYear(), firstOfThis.getMonth() - 1, 1);
      const prevEnd = new Date(firstOfThis.getFullYear(), firstOfThis.getMonth(), 0);
      return { from: toDateKey(prevStart), to: toDateKey(prevEnd) };
    }
    case 'quarter': {
      const quarterStartMonth = Math.floor(today.getMonth() / 3) * 3;
      const start = new Date(today.getFullYear(), quarterStartMonth, 1);
      const end = new Date(today.getFullYear(), quarterStartMonth + 3, 0);
      return { from: toDateKey(start), to: toDateKey(end) };
    }
    case 'month':
    default:
      return { from: toDateKey(startOfMonth(today)), to: toDateKey(today) };
  }
}

export function defaultFilters(): FiltersState {
  const range = presetRange('month');
  return { date_from: range.from, date_to: range.to, department_id: '', product_id: '', preset: 'month' };
}

interface FiltersContextValue {
  filters: FiltersState;
  setFilters: (patch: Partial<FiltersState>) => void;
  applyPreset: (preset: PeriodPreset) => void;
  reset: () => void;
  departments: Department[];
  products: Product[];
  queryParams: Record<string, string>;
}

const FiltersContext = createContext<FiltersContextValue | null>(null);

export function FiltersProvider({
  children,
  departments,
  products,
  fixedDepartmentId,
}: {
  children: ReactNode;
  departments: Department[];
  products: Product[];
  fixedDepartmentId?: string | null;
}) {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo<FiltersState>(() => {
    const defaults = defaultFilters();
    const preset = (searchParams.get('preset') as PeriodPreset | null) ?? defaults.preset;
    return {
      date_from: searchParams.get('date_from') ?? defaults.date_from,
      date_to: searchParams.get('date_to') ?? defaults.date_to,
      department_id: fixedDepartmentId ?? searchParams.get('department_id') ?? '',
      product_id: searchParams.get('product_id') ?? '',
      preset,
    };
  }, [searchParams, fixedDepartmentId]);

  const value = useMemo<FiltersContextValue>(() => {
    const write = (next: FiltersState) => {
      const params = new URLSearchParams(searchParams);
      params.set('date_from', next.date_from);
      params.set('date_to', next.date_to);
      params.set('preset', next.preset);
      const departmentId = fixedDepartmentId ?? next.department_id;
      if (departmentId) params.set('department_id', departmentId);
      else params.delete('department_id');
      if (next.product_id) params.set('product_id', next.product_id);
      else params.delete('product_id');
      setSearchParams(params, { replace: true });
    };

    return {
      filters,
      setFilters: (patch) => write({ ...filters, ...patch }),
      applyPreset: (preset) => {
        if (preset === 'custom') {
          write({ ...filters, preset });
          return;
        }
        const range = presetRange(preset);
        write({ ...filters, preset, date_from: range.from, date_to: range.to });
      },
      reset: () => {
        const params = new URLSearchParams(searchParams);
        ['date_from', 'date_to', 'preset', 'product_id'].forEach((key) => params.delete(key));
        if (fixedDepartmentId) params.set('department_id', fixedDepartmentId);
        else params.delete('department_id');
        setSearchParams(params, { replace: true });
      },
      departments,
      products,
      queryParams: {
        date_from: filters.date_from,
        date_to: filters.date_to,
        ...(filters.department_id ? { department_id: filters.department_id } : {}),
        ...(filters.product_id ? { product_id: filters.product_id } : {}),
      },
    };
  }, [filters, searchParams, setSearchParams, departments, products, fixedDepartmentId]);

  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>;
}

export function useFilters(): FiltersContextValue {
  const context = useContext(FiltersContext);
  if (!context) throw new Error('useFilters должен использоваться внутри FiltersProvider');
  return context;
}
