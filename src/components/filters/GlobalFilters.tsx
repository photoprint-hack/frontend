import { CalendarRange, Building2, Package, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { cn } from '@/lib/utils/cn';
import { PERIOD_LABELS, useFilters, type PeriodPreset } from './FiltersContext';
import { useAuth } from '@/lib/auth/auth-context';

export function GlobalFilters({ className, compact }: { className?: string; compact?: boolean }) {
  const { filters, setFilters, applyPreset, reset, departments, products } = useFilters();
  const { role } = useAuth();

  return (
    <div className={cn('surface p-3', className)}>
      <div className="flex flex-wrap items-end gap-2.5">
        <div className="min-w-[150px] flex-1 sm:max-w-[190px]">
          <label htmlFor="global-period" className="label-caps mb-1 flex items-center gap-1.5">
            <CalendarRange className="h-3 w-3" aria-hidden /> Период
          </label>
          <Select
            id="global-period"
            value={filters.preset}
            onChange={(event) => applyPreset(event.target.value as PeriodPreset)}
          >
            {(Object.keys(PERIOD_LABELS) as PeriodPreset[]).map((preset) => (
              <option key={preset} value={preset}>
                {PERIOD_LABELS[preset]}
              </option>
            ))}
          </Select>
        </div>

        <div className="min-w-[128px]">
          <label htmlFor="global-date-from" className="label-caps mb-1 block">
            Начало
          </label>
          <Input
            id="global-date-from"
            type="date"
            value={filters.date_from}
            max={filters.date_to}
            onChange={(event) => setFilters({ date_from: event.target.value, preset: 'custom' })}
          />
        </div>
        <div className="min-w-[128px]">
          <label htmlFor="global-date-to" className="label-caps mb-1 block">
            Окончание
          </label>
          <Input
            id="global-date-to"
            type="date"
            value={filters.date_to}
            min={filters.date_from}
            onChange={(event) => setFilters({ date_to: event.target.value, preset: 'custom' })}
          />
        </div>

        <div className="min-w-[160px] flex-1 sm:max-w-[220px]">
          <label htmlFor="global-department" className="label-caps mb-1 flex items-center gap-1.5">
            <Building2 className="h-3 w-3" aria-hidden /> Подразделение
          </label>
          <Select
            id="global-department"
            value={filters.department_id}
            disabled={role === 'manager'}
            onChange={(event) => setFilters({ department_id: event.target.value })}
          >
            <option value="">{role === 'manager' ? 'Подразделение аккаунта' : 'Все доступные'}</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="min-w-[160px] flex-1 sm:max-w-[220px]">
          <label htmlFor="global-product" className="label-caps mb-1 flex items-center gap-1.5">
            <Package className="h-3 w-3" aria-hidden /> Продукт
          </label>
          <Select
            id="global-product"
            value={filters.product_id}
            onChange={(event) => setFilters({ product_id: event.target.value })}
          >
            <option value="">Все продукты</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </Select>
        </div>

        {!compact && (
          <Button
            variant="ghost"
            size="sm"
            icon={<RotateCcw className="h-3.5 w-3.5" />}
            onClick={reset}
            className="mb-0.5"
          >
            Сбросить
          </Button>
        )}
      </div>
    </div>
  );
}
