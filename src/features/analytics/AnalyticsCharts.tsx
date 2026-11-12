import { useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, TrendingUp } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { FieldShell, Select } from '@/components/ui/Field';
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback/States';
import { metricsApi, productionApi, salesApi } from '@/lib/api/endpoints';
import { toApiError } from '@/lib/api/client';
import { formatDate, formatNumber, formatUnit } from '@/lib/formatters';
import type { Kpi, MetricHistoryPoint } from '@/types/api';
import { historyInterval, lineGeometry } from './chart-data';

function HistoryChart({ points, unit, name }: { points: MetricHistoryPoint[]; unit: string; name: string }) {
  const id = useId();
  const geometry = lineGeometry(points);
  if (!geometry.hasData) return <EmptyState title="Нет данных для графика" description="За выбранный период значения показателя и плана отсутствуют." />;
  const tickStep = Math.max(1, Math.ceil(points.length / 6));
  return <div>
    <div className="flex flex-wrap gap-4 text-[0.6875rem] text-ink-300"><span>Сплошная линия — факт</span><span>Пунктир — план</span><span>Пробел — нет данных</span></div>
    <svg viewBox="0 0 680 240" className="mt-3 w-full" role="img" aria-labelledby={`${id}-title ${id}-description`}>
      <title id={`${id}-title`}>{name}: факт и план за выбранный период</title>
      <desc id={`${id}-description`}>Значения и даты приведены в раскрывающейся таблице под графиком. Отсутствующие значения не соединяются линией.</desc>
      {[0, 1, 2, 3].map((step) => <g key={step}>
        <line x1="95" x2="665" y1={20 + step * 58} y2={20 + step * 58} stroke="currentColor" className="text-ink-700" />
        <text x="88" y={24 + step * 58} textAnchor="end" fill="currentColor" className="text-ink-400" fontSize="10">{formatNumber(geometry.max - step / 3 * (geometry.max - geometry.min), 1)}</text>
      </g>)}
      <path d={geometry.target} fill="none" stroke="currentColor" className="text-ink-400" strokeWidth="1.5" strokeDasharray="5 4" />
      <path d={geometry.actual} fill="none" stroke="currentColor" className="text-accent-300" strokeWidth="2.5" />
      {points.map((point, index) => <g key={point.period_start}>
        {point.actual !== null && <circle cx={geometry.x(index)} cy={geometry.y(point.actual)} r="3" fill="currentColor" className="text-accent-300"><title>{formatDate(point.period_start)}: {formatUnit(point.actual, unit)}</title></circle>}
        {point.target !== null && <circle cx={geometry.x(index)} cy={geometry.y(point.target)} r="2" fill="currentColor" className="text-ink-400" />}
        {(index % tickStep === 0 || index === points.length - 1) && <text x={geometry.x(index)} y="225" textAnchor="middle" fill="currentColor" className="text-ink-400" fontSize="10">{point.period_start.slice(8, 10)}.{point.period_start.slice(5, 7)}</text>}
      </g>)}
    </svg>
    <p className="text-[0.6875rem] text-ink-400">Единица измерения: {unit}</p>
    <details className="mt-3 rounded-lg border border-ink-700 p-3">
      <summary className="cursor-pointer text-xs text-ink-200">Значения графика в таблице</summary>
      <div className="mt-2 overflow-x-auto"><table className="table-shell w-full"><caption className="sr-only">{name}: значения по периодам</caption><thead><tr><th scope="col">Период</th><th scope="col">Факт</th><th scope="col">План</th></tr></thead><tbody>{points.map((point) => <tr key={point.period_start}><th scope="row" className="text-left text-xs font-normal">{formatDate(point.period_start)} — {formatDate(point.period_end)}</th><td className="text-xs">{formatUnit(point.actual, unit)}</td><td className="text-xs">{formatUnit(point.target, unit)}</td></tr>)}</tbody></table></div>
    </details>
  </div>;
}

function Bars({ rows, unit }: { rows: { key: string; label: string; value: number | null }[]; unit: string }) {
  const max = Math.max(1, ...rows.flatMap((row) => row.value === null ? [] : [row.value]));
  if (!rows.length || rows.every((row) => row.value === null)) return <EmptyState title="Нет данных для графика" description="В выбранном контексте источник не содержит значений." />;
  return <ul className="space-y-4">{rows.map((row) => <li key={row.key}>
    <div className="mb-1.5 flex items-start justify-between gap-3 text-xs"><span className="text-ink-200">{row.label}</span><span className="whitespace-nowrap font-medium text-ink-100">{formatUnit(row.value, unit)}</span></div>
    <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-ink-800"><div className="h-full rounded-full bg-accent-400" style={{ width: `${row.value === null ? 0 : Math.max(0, row.value) / max * 100}%` }} /></div>
  </li>)}</ul>;
}

export function AnalyticsCharts({ params, kpis }: { params: Record<string, string>; kpis: Kpi[] }) {
  const [metricCode, setMetricCode] = useState('revenue');
  const metric = kpis.find((item) => item.code === metricCode);
  const interval = historyInterval(params.date_from, params.date_to);
  const history = useQuery({ queryKey: ['analytics-history', metricCode, params, interval], queryFn: () => metricsApi.history(metricCode, { ...params, interval }), enabled: Boolean(metric) });
  const sales = useQuery({ queryKey: ['sales-summary', params], queryFn: async () => (await salesApi.summary(params)).data });
  const production = useQuery({ queryKey: ['production-summary', params], queryFn: async () => (await productionApi.summary(params)).data });
  return <div className="space-y-4">
    <Card>
      <CardHeader title="Динамика показателя" subtitle={interval === 'day' ? 'По дням' : interval === 'week' ? 'По неделям' : 'По месяцам'} icon={<TrendingUp className="h-4 w-4" />} />
      <div className="mb-4 max-w-sm"><FieldShell label="Показатель" htmlFor="analytics-metric"><Select id="analytics-metric" value={metricCode} onChange={(event) => setMetricCode(event.target.value)}>{kpis.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</Select></FieldShell></div>
      {history.isLoading ? <LoadingState label="Загружаем динамику…" /> : history.error ? <ErrorState message={toApiError(history.error).message} onRetry={() => void history.refetch()} /> : history.data && metric ? <HistoryChart points={history.data.items} unit={metric.unit} name={metric.name} /> : null}
    </Card>
    <div className="grid gap-4 lg:grid-cols-2">
      <Card><CardHeader title="Оборот по каналам" subtitle="Выручка завершённых заказов за выбранный период, BYN" icon={<BarChart3 className="h-4 w-4" />} />{sales.isLoading ? <LoadingState label="Загружаем продажи…" /> : sales.error ? <ErrorState message={toApiError(sales.error).message} onRetry={() => void sales.refetch()} /> : sales.data ? <Bars unit="BYN" rows={sales.data.channels.map((row) => ({ key: row.code, label: row.name, value: row.revenue }))} /> : null}</Card>
      <Card><CardHeader title="Выпуск продукции" subtitle="План и факт за выбранный период" icon={<BarChart3 className="h-4 w-4" />} />{production.isLoading ? <LoadingState label="Загружаем производство…" /> : production.error ? <ErrorState message={toApiError(production.error).message} onRetry={() => void production.refetch()} /> : production.data ? <Bars unit="шт." rows={[{ key: 'plan', label: 'План', value: production.data.planned_quantity }, { key: 'actual', label: 'Факт', value: production.data.actual_quantity }]} /> : null}</Card>
    </div>
  </div>;
}
