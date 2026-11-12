import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('surface p-4 sm:p-5', className)}>{children}</div>;
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
  icon,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
  icon?: ReactNode;
}) {
  return (
    <div className={cn('mb-4 flex items-start justify-between gap-3', className)}>
      <div className="flex min-w-0 items-start gap-2.5">
        {icon && <span className="mt-0.5 text-accent-300">{icon}</span>}
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold tracking-tight text-ink-50">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs leading-relaxed text-ink-300">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function SectionTitle({
  children,
  hint,
  action,
}: {
  children: ReactNode;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="text-base font-semibold tracking-tight text-ink-50">{children}</h2>
        {hint && <p className="mt-0.5 text-xs text-ink-300">{hint}</p>}
      </div>
      {action}
    </div>
  );
}
