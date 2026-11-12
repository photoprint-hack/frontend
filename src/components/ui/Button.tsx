import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-accent-500 text-ink-950 hover:bg-accent-400 active:bg-accent-600 border border-accent-400/40 shadow-[0_6px_20px_-8px_rgba(44,197,176,.7)]',
  secondary: 'bg-ink-700/80 text-ink-50 hover:bg-ink-600 border border-ink-600',
  ghost: 'bg-transparent text-ink-200 hover:bg-ink-800/80 hover:text-ink-50 border border-transparent',
  danger: 'bg-signal-bad/15 text-signal-bad hover:bg-signal-bad/25 border border-signal-bad/40',
  outline: 'bg-transparent text-ink-100 hover:bg-ink-800 border border-ink-600',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-2.5 text-xs gap-1.5 rounded-lg',
  md: 'h-9 px-3.5 text-sm gap-2 rounded-lg',
  lg: 'h-11 px-5 text-sm gap-2 rounded-xl',
  icon: 'h-9 w-9 justify-center rounded-lg',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'secondary', size = 'md', loading, icon, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center justify-center font-medium transition-colors duration-150',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});
