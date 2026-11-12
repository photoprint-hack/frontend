/** Форматирование для отображения. Деньги остаются числами в бизнес-логике. */

const moneyFormatter = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const moneyCompactFormatter = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

const intFormatter = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });

export function formatMoney(value: number | null | undefined, currency = 'BYN'): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${moneyFormatter.format(value)} ${currency}`;
}

export function formatMoneyCompact(value: number | null | undefined, currency = 'BYN'): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${moneyCompactFormatter.format(value / 1_000_000)} млн ${currency}`;
  if (abs >= 10_000) return `${moneyCompactFormatter.format(value / 1_000)} тыс. ${currency}`;
  return `${intFormatter.format(value)} ${currency}`;
}

export function formatNumber(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const formatted = new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
  return `${formatted}%`;
}

export function formatSignedPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${formatPercent(value, digits)}`;
}

export function formatUnit(value: number | null | undefined, unit: string): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  if (unit === 'BYN') return formatMoney(value);
  if (unit === '%') return formatPercent(value);
  if (unit === 'standard_hour') return `${formatNumber(value, 1)} н/ч`;
  return `${formatNumber(value, Number.isInteger(value) ? 0 : 1)} ${unit}`;
}

const dateFormatter = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
const dateTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const shortDateFormatter = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short' });
const timeFormatter = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return dateFormatter.format(date);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return dateTimeFormatter.format(date);
}

export function formatShortDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return shortDateFormatter.format(date);
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return timeFormatter.format(date);
}

export function formatDateRange(from: string | null | undefined, to: string | null | undefined): string {
  if (!from || !to) return '—';
  return `${formatDate(from)} — ${formatDate(to)}`;
}

export function formatRelative(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (Math.abs(minutes) < 1) return 'только что';
  if (Math.abs(minutes) < 60) return `${minutes} мин назад`;
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return `${hours} ч назад`;
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return `${days} дн назад`;
  return formatDate(value);
}

export function toDateInputValue(value: string | null | undefined): string {
  if (!value) return '';
  return value.slice(0, 10);
}

export function formatHours(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${formatNumber(value, 1)} н/ч`;
}

export function formatDurationMinutes(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  if (value < 60) return `${formatNumber(value, 0)} мин`;
  const hours = Math.floor(value / 60);
  const minutes = Math.round(value % 60);
  return minutes ? `${hours} ч ${minutes} мин` : `${hours} ч`;
}

export function formatDaysLeft(deadline: string | null | undefined): string {
  if (!deadline) return '—';
  const diff = new Date(deadline).getTime() - Date.now();
  const days = Math.ceil(diff / 86_400_000);
  if (days < 0) return `просрочено на ${Math.abs(days)} дн`;
  if (days === 0) return 'срок сегодня';
  if (days === 1) return 'остался 1 день';
  return `осталось ${days} дн`;
}

export function initials(fullName: string): string {
  return fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
