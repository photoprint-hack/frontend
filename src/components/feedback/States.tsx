import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, Loader2, Lock, RefreshCw, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Button } from '../ui/Button';

export function LoadingState({ label = 'Загрузка данных…', className }: { label?: string; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-12 text-ink-300', className)} role="status">
      <Loader2 className="h-6 w-6 animate-spin text-accent-400" aria-hidden />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div className={cn('relative overflow-hidden rounded-lg bg-ink-800/70', className)}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-ink-700/60 to-transparent" />
    </div>
  );
}

export function CardSkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 min-[2100px]:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="surface space-y-3 p-4">
          <SkeletonBlock className="h-3 w-24" />
          <SkeletonBlock className="h-7 w-32" />
          <SkeletonBlock className="h-2.5 w-full" />
          <SkeletonBlock className="h-2.5 w-2/3" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  title = 'Нет данных',
  description,
  action,
  icon,
  className,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 px-4 py-12 text-center', className)}>
      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-ink-600 bg-ink-800/60 text-ink-300">
        {icon ?? <Inbox className="h-5 w-5" aria-hidden />}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-ink-100">{title}</p>
        {description && <p className="mx-auto max-w-md text-xs leading-relaxed text-ink-300">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({
  title = 'Не удалось загрузить данные',
  message,
  onRetry,
  className,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center gap-3 px-4 py-12 text-center', className)}
      role="alert"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-signal-bad/40 bg-signal-bad/10 text-signal-bad">
        <AlertTriangle className="h-5 w-5" aria-hidden />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-ink-100">{title}</p>
        {message && <p className="mx-auto max-w-md text-xs leading-relaxed text-ink-300">{message}</p>}
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={onRetry}>
          Повторить запрос
        </Button>
      )}
    </div>
  );
}

export function ForbiddenState({
  title = 'Недостаточно прав',
  message = 'Раздел недоступен для вашей роли. Обратитесь к администратору платформы.',
}: {
  title?: string;
  message?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-signal-warn/40 bg-signal-warn/10 text-signal-warn">
        <Lock className="h-5 w-5" aria-hidden />
      </div>
      <div className="space-y-1">
        <p className="text-base font-semibold text-ink-50">{title}</p>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-ink-300">{message}</p>
      </div>
    </div>
  );
}

export function OfflineState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-signal-bad/40 bg-signal-bad/10 text-signal-bad">
        <WifiOff className="h-5 w-5" aria-hidden />
      </div>
      <div className="space-y-1">
        <p className="text-base font-semibold text-ink-50">Нет соединения с API</p>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-ink-300">{message}</p>
      </div>
    </div>
  );
}
