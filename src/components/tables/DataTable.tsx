import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Button } from '../ui/Button';
import { EmptyState } from '../feedback/States';
import { formatNumber } from '@/lib/formatters';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  selectedRowKey?: string;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  footer?: ReactNode;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSortChange?: (key: string, order: 'asc' | 'desc') => void;
  className?: string;
  dense?: boolean;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  selectedRowKey,
  loading,
  emptyTitle = 'Ничего не найдено',
  emptyDescription = 'Измените фильтры или период, чтобы увидеть записи.',
  emptyAction,
  footer,
  sortBy,
  sortOrder,
  onSortChange,
  className,
  dense,
}: DataTableProps<T>) {
  if (!loading && (!rows || rows.length === 0)) {
    return (
      <div className={cn('surface overflow-hidden', className)}>
        <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
      </div>
    );
  }

  return (
    <div className={cn('surface overflow-hidden', className)}>
      <div className="overflow-x-auto">
        <table className="table-shell min-w-full">
          <thead>
            <tr>
              {columns.map((column) => {
                const active = sortBy === column.key;
                return (
                  <th
                    key={column.key}
                    scope="col"
                    className={cn(
                      column.headerClassName,
                      column.align === 'right' && 'text-right',
                      column.align === 'center' && 'text-center',
                    )}
                  >
                    {column.sortable && onSortChange ? (
                      <button
                        type="button"
                        className={cn(
                          'inline-flex items-center gap-1 transition hover:text-ink-100',
                          active && 'text-accent-300',
                        )}
                        onClick={() => onSortChange(column.key, active && sortOrder === 'desc' ? 'asc' : 'desc')}
                      >
                        {column.header}
                        <span aria-hidden className="text-[0.5625rem]">
                          {active ? (sortOrder === 'desc' ? '▼' : '▲') : '⇅'}
                        </span>
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading && !rows
              ? Array.from({ length: 6 }).map((_, rowIndex) => (
                  <tr key={`skeleton-${rowIndex}`}>
                    {columns.map((column) => (
                      <td key={column.key} className={dense ? 'py-2' : undefined}>
                        <div className="h-3 w-full max-w-[140px] animate-pulse rounded bg-ink-700/70" />
                      </td>
                    ))}
                  </tr>
                ))
              : rows?.map((row) => (
                  <tr
                    key={rowKey(row)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    onKeyDown={
                      onRowClick
                        ? (event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              onRowClick(row);
                            }
                          }
                        : undefined
                    }
                    tabIndex={onRowClick ? 0 : undefined}
                    role={onRowClick ? 'button' : undefined}
                    className={cn(
                      onRowClick && 'cursor-pointer transition-colors hover:bg-ink-800/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-400',
                      selectedRowKey === rowKey(row) && 'bg-accent-500/10 ring-1 ring-inset ring-accent-400/35',
                      dense && '[&>td]:py-2',
                      loading && 'opacity-60',
                    )}
                  >
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={cn(
                          column.className,
                          column.align === 'right' && 'text-right',
                          column.align === 'center' && 'text-center',
                        )}
                      >
                        {column.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
      {footer}
    </div>
  );
}

export interface PaginationProps {
  page: number;
  pages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  className?: string;
}

export function Pagination({
  page,
  pages,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
  className,
}: PaginationProps) {
  const safePages = Math.max(1, pages);
  const windowStart = Math.max(1, Math.min(page - 1, safePages - 2));
  const visible = Array.from({ length: Math.min(3, safePages) }, (_, index) => windowStart + index).filter(
    (value) => value <= safePages,
  );

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 border-t border-ink-700/70 px-3 py-2.5 text-xs text-ink-300',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <span>
          Всего: <span className="font-medium text-ink-100">{formatNumber(total)}</span>
        </span>
        <span className="hidden sm:inline">
          Страница {page} из {safePages}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {onPageSizeChange && (
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            aria-label="Размер страницы"
            className="h-8 rounded-md border border-ink-600 bg-ink-850 px-2 text-xs text-ink-100"
          >
            {[10, 20, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size} / стр.
              </option>
            ))}
          </select>
        )}
        <Button
          size="icon"
          variant="ghost"
          aria-label="Предыдущая страница"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {visible.map((value) => (
          <Button
            key={value}
            size="sm"
            variant={value === page ? 'primary' : 'ghost'}
            aria-current={value === page ? 'page' : undefined}
            onClick={() => onPageChange(value)}
            className="min-w-8"
          >
            {value}
          </Button>
        ))}
        <Button
          size="icon"
          variant="ghost"
          aria-label="Следующая страница"
          disabled={page >= safePages}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
