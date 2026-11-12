import type { MetricStatus } from '@/types/api';

export type MetricDirection = 'higher_is_better' | 'lower_is_better' | 'range' | 'none';

export interface MetricDefinition {
  code: string;
  name: string;
  description: string;
  unit: string;
  direction: MetricDirection;
  category: string;
  formula: string;
  source: string[];
  targetPercent: number | null;
  supportedGroupBy: string[];
  formulaVersion: string;
}

export const METRIC_CATALOG: MetricDefinition[] = [
  {
    code: 'revenue',
    name: 'Оборот',
    description: 'Сумма выручки по завершённым и неотменённым заказам за выбранный период.',
    unit: 'BYN',
    direction: 'higher_is_better',
    category: 'sales',
    formula: 'SUM(orders.amount) по заказам со status=completed и completed_at в периоде',
    source: ['erp', 'finance'],
    targetPercent: null,
    supportedGroupBy: ['department', 'product', 'order', 'channel', 'cause'],
    formulaVersion: 'v1.2',
  },
  {
    code: 'gross_margin',
    name: 'Валовая маржа',
    description: 'Доля валовой прибыли в выручке завершённых заказов.',
    unit: '%',
    direction: 'higher_is_better',
    category: 'finance',
    formula: '(revenue − direct_cost) / revenue × 100',
    source: ['finance', 'erp'],
    targetPercent: 42,
    supportedGroupBy: ['department', 'product'],
    formulaVersion: 'v1.2',
  },
  {
    code: 'on_time_orders',
    name: 'Заказы, выполненные в срок',
    description: 'Доля заказов, завершённых не позже плановой даты.',
    unit: '%',
    direction: 'higher_is_better',
    category: 'production',
    formula: 'completed_at <= due_at / все завершённые заказы × 100',
    source: ['erp'],
    targetPercent: 92,
    supportedGroupBy: ['department', 'product'],
    formulaVersion: 'v1.2',
  },
  {
    code: 'defect_rate',
    name: 'Доля брака',
    description: 'Отношение бракованных единиц к произведённым.',
    unit: '%',
    direction: 'lower_is_better',
    category: 'quality',
    formula: 'defective_quantity / actual_quantity × 100',
    source: ['erp'],
    targetPercent: 4.5,
    supportedGroupBy: ['department', 'product', 'cause'],
    formulaVersion: 'v1.2',
  },
  {
    code: 'new_customers',
    name: 'Новые клиенты',
    description: 'Клиенты, чья первая завершённая покупка попала в выбранный период.',
    unit: 'клиентов',
    direction: 'higher_is_better',
    category: 'sales',
    formula: 'COUNT(DISTINCT customer) с первой завершённой покупкой в периоде',
    source: ['crm', 'erp'],
    targetPercent: null,
    supportedGroupBy: ['department', 'product', 'channel'],
    formulaVersion: 'v1.2',
  },
  {
    code: 'active_customers',
    name: 'Активные клиенты',
    description: 'Уникальные клиенты с завершённым заказом за период.',
    unit: 'клиентов',
    direction: 'higher_is_better',
    category: 'sales',
    formula: 'COUNT(DISTINCT customer) с завершённым заказом в периоде',
    source: ['crm', 'erp'],
    targetPercent: null,
    supportedGroupBy: ['department', 'product', 'channel'],
    formulaVersion: 'v1.2',
  },
  {
    code: 'repeat_purchase_rate',
    name: 'Повторные покупки',
    description: 'Доля активных клиентов с двумя и более завершёнными заказами.',
    unit: '%',
    direction: 'higher_is_better',
    category: 'sales',
    formula: 'клиенты с ≥2 заказами / активные клиенты × 100',
    source: ['crm', 'erp'],
    targetPercent: 38,
    supportedGroupBy: ['department', 'product'],
    formulaVersion: 'v1.2',
  },
  {
    code: 'support_sla',
    name: 'Соблюдение SLA поддержки',
    description: 'Доля закрытых обращений, закрытых в пределах SLA.',
    unit: '%',
    direction: 'higher_is_better',
    category: 'support',
    formula: 'closed_at <= sla_deadline / обращения с SLA × 100',
    source: ['support'],
    targetPercent: 94,
    supportedGroupBy: ['department', 'order', 'cause'],
    formulaVersion: 'v1.2',
  },
  {
    code: 'capacity_utilization',
    name: 'Загрузка производственных мощностей',
    description: 'Отношение фактической загрузки к доступной мощности.',
    unit: '%',
    direction: 'range',
    category: 'production',
    formula: 'actual_load_hours / available_capacity_hours × 100',
    source: ['erp'],
    targetPercent: 85,
    supportedGroupBy: ['department', 'product'],
    formulaVersion: 'v1.2',
  },
  {
    code: 'staffing_coverage',
    name: 'Обеспеченность персоналом',
    description: 'Доступные сотрудники к плановой потребности по последнему снимку.',
    unit: '%',
    direction: 'higher_is_better',
    category: 'hr',
    formula: 'available_headcount / required_headcount × 100',
    source: ['hr'],
    targetPercent: 95,
    supportedGroupBy: ['department'],
    formulaVersion: 'v1.2',
  },
  {
    code: 'sales_plan_achievement',
    name: 'Выполнение плана продаж',
    description: 'Фактическая выручка к плановой выручке периода.',
    unit: '%',
    direction: 'higher_is_better',
    category: 'sales',
    formula: 'revenue / plan_revenue × 100',
    source: ['crm', 'erp', 'finance'],
    targetPercent: 100,
    supportedGroupBy: ['department', 'product', 'channel'],
    formulaVersion: 'v1.2',
  },
  {
    code: 'critical_alerts_count',
    name: 'Критические отклонения',
    description: 'Количество критических сигналов в статусе active/acknowledged.',
    unit: 'шт.',
    direction: 'none',
    category: 'system',
    formula: 'COUNT(alerts) со severity=critical и status in (active, acknowledged)',
    source: ['system'],
    targetPercent: null,
    supportedGroupBy: [],
    formulaVersion: 'v1.2',
  },
];

export const METRIC_BY_CODE = new Map(METRIC_CATALOG.map((metric) => [metric.code, metric]));

export const METRIC_STATUS_LABELS: Record<MetricStatus, string> = {
  normal: 'Норма',
  warning: 'Предупреждение',
  critical: 'Критическое отклонение',
  no_data: 'Нет данных',
};

export const METRIC_STATUS_HINT: Record<MetricStatus, string> = {
  normal: 'Отклонение в пределах допустимого',
  warning: 'Отклонение требует внимания',
  critical: 'Критическое отклонение, требуется решение',
  no_data: 'Недостаточно данных для расчёта',
};
