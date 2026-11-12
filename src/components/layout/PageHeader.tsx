import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export function PageHeader({
  title,
  description,
  actions,
  meta,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-4 flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <h1 className="text-lg font-semibold tracking-tight text-ink-50 sm:text-xl">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-xs leading-relaxed text-ink-300 sm:text-sm">{description}</p>}
        {meta && <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
