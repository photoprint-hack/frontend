import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export function FieldShell({
  label,
  hint,
  error,
  required,
  htmlFor,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="block text-xs font-medium text-ink-200">
          {label}
          {required && <span className="ml-0.5 text-signal-bad">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-[11px] font-medium text-signal-bad" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="text-[11px] text-ink-300">{hint}</p>
      )}
    </div>
  );
}

const baseInput =
  'w-full rounded-lg border border-ink-600 bg-ink-850/80 px-3 text-sm text-ink-50 placeholder:text-ink-400 transition ' +
  'hover:border-ink-500 focus:border-accent-400 focus:bg-ink-850 disabled:cursor-not-allowed disabled:opacity-60';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(baseInput, 'h-9', className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(baseInput, 'min-h-[84px] py-2 leading-relaxed', className)} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...props },
  ref,
) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(baseInput, 'h-9 appearance-none pr-8', className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
    </div>
  );
});

export function SearchInput({
  value,
  onChange,
  placeholder = 'Поиск…',
  className,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        className={cn(baseInput, 'h-9 pl-8')}
      />
    </div>
  );
}
