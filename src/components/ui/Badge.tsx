import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import type { BadgeTone } from '@/constants/labels';

const TONES: Record<BadgeTone, string> = {
  ok: 'bg-signal-ok/12 text-signal-ok border-signal-ok/35',
  warn: 'bg-signal-warn/12 text-signal-warn border-signal-warn/35',
  bad: 'bg-signal-bad/12 text-signal-bad border-signal-bad/35',
  idle: 'bg-ink-600/40 text-ink-200 border-ink-500/60',
  info: 'bg-signal-info/12 text-signal-info border-signal-info/35',
  accent: 'bg-accent-500/12 text-accent-300 border-accent-400/35',
  violet: 'bg-signal-violet/12 text-signal-violet border-signal-violet/35',
};

export interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
  dot?: boolean;
  title?: string;
}

export function Badge({ tone = 'idle', children, icon, className, dot, title }: BadgeProps) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 text-[0.6875rem] font-medium leading-5',
        TONES[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden />}
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
}
