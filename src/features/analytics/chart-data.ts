import type { MetricHistoryPoint } from '@/types/api';

export function historyInterval(from: string, to: string): 'day' | 'week' | 'month' {
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
  return days <= 31 ? 'day' : days <= 180 ? 'week' : 'month';
}

export function lineGeometry(points: Pick<MetricHistoryPoint, 'actual' | 'target'>[]) {
  const values = points.flatMap((point) => [point.actual, point.target]).filter((value): value is number => value !== null && Number.isFinite(value));
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values) || 1;
  const x = (index: number) => points.length === 1 ? 380 : 95 + index / (points.length - 1) * 570;
  const y = (value: number) => 194 - (value - min) / (max - min) * 174;
  const series = (key: 'actual' | 'target') => {
    let gap = true;
    return points.map((point, index) => {
      const value = point[key];
      if (value === null || !Number.isFinite(value)) { gap = true; return ''; }
      const command = gap ? 'M' : 'L';
      gap = false;
      return `${command}${x(index).toFixed(2)},${y(value).toFixed(2)}`;
    }).join(' ');
  };
  return { hasData: values.length > 0, min, max, x, y, actual: series('actual'), target: series('target') };
}
