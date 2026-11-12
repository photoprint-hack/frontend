import type {
  Alert,
  AlertDetail,
  AlertStatus,
  AuditLog,
  ChangeEvent,
  Customer,
  DashboardResponse,
  DataQualityIssue,
  DataQualityOverview,
  DataSource,
  Decision,
  DecisionStatus,
  Department,
  FinanceSummary,
  ForecastResponse,
  ForecastWeek,
  HrSummary,
  Kpi,
  MetricBreakdownResponse,
  MetricBreakdownRow,
  MetricContext,
  MetricHistoryResponse,
  MetricStatus,
  Order,
  OrderEvent,
  Paginated,
  PlanFactRow,
  Product,
  ProductionSummary,
  Reconciliation,
  SalesFunnel,
  SalesSummary,
  Task,
  TaskStatus,
} from '@/types/api';
import { METRIC_BY_CODE, METRIC_CATALOG, type MetricDefinition } from '@/constants/metrics';
import { buildStore, type MockStore, type PlanRow } from './seed';
import type { ProductionRecord as ProductionRecordInternal, SupportTicket } from './internal-types';
import {
  addDays,
  DAY_MS,
  newUuid,
  round,
  startOfDay,
  startOfMonth,
  startOfWeek,
  toDateKey,
  toIso,
  uuidFrom,
} from './random';

export interface MockContext {
  store: MockStore;
  userId: string;
}

export class MockHttpError extends Error {
  status: number;
  code: string;
  fields: Record<string, string>;

  constructor(status: number, code: string, message: string, fields: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

let cachedStore: MockStore | null = null;
let revision = 0;

export function getStore(): MockStore {
  if (!cachedStore) cachedStore = buildStore(new Date());
  return cachedStore;
}

export function bumpRevision() {
  revision += 1;
  return revision;
}

export function getRevision() {
  return revision;
}

/* ------------------------------------------------------------------ utils */

function paginate<T>(items: T[], page = 1, pageSize = 20): Paginated<T> {
  const safePageSize = Math.min(100, Math.max(1, pageSize));
  const total = items.length;
  const pages = total === 0 ? 0 : Math.ceil(total / safePageSize);
  const safePage = Math.min(Math.max(1, page), Math.max(1, pages));
  const start = (safePage - 1) * safePageSize;
  return {
    items: items.slice(start, start + safePageSize),
    total,
    page: pages === 0 ? 1 : safePage,
    page_size: safePageSize,
    pages,
  };
}

function inRange(dateIso: string | null, from: string, to: string): boolean {
  if (!dateIso) return false;
  const day = toDateKey(new Date(dateIso));
  return day >= from && day <= to;
}

function sortItems<T>(items: T[], sortBy: string | undefined, order: 'asc' | 'desc' | undefined, fallback: keyof T): T[] {
  const key = (sortBy ?? fallback) as keyof T;
  const direction = order === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => {
    const left = a[key];
    const right = b[key];
    if (typeof left === 'number' && typeof right === 'number') return (left - right) * direction;
    return String(left ?? '').localeCompare(String(right ?? ''), 'ru') * direction;
  });
}

function textMatch(haystack: (string | null | undefined)[], search: string | undefined): boolean {
  if (!search) return true;
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return haystack.some((value) => (value ?? '').toLowerCase().includes(needle));
}

export interface DateScope {
  date_from: string;
  date_to: string;
  department_id: string | null;
  product_id: string | null;
  ignored_filters: string[];
}

export function resolveScope(params: URLSearchParams, ctx: MockContext): DateScope {
  const today = startOfDay(new Date());
  const defaultFrom = toDateKey(startOfMonth(today));
  const defaultTo = toDateKey(today);
  const dateFrom = params.get('date_from') ?? defaultFrom;
  const dateTo = params.get('date_to') ?? defaultTo;

  const user = ctx.store.users.find((item) => item.id === ctx.userId);
  let departmentId = params.get('department_id');
  if (user?.role === 'manager' && user.department_id) {
    if (departmentId && departmentId !== user.department_id) {
      throw new MockHttpError(403, 'DEPARTMENT_ACCESS_DENIED', 'Доступ к другому подразделению запрещён');
    }
    departmentId = user.department_id;
  }
  const productId = params.get('product_id');
  const ignored: string[] = [];
  if (productId && dateFrom > dateTo) {
    throw new MockHttpError(422, 'VALIDATION_ERROR', 'Начало периода позже окончания', {
      date_from: 'Начало периода позже окончания',
    });
  }
  return {
    date_from: dateFrom,
    date_to: dateTo,
    department_id: departmentId || null,
    product_id: productId || null,
    ignored_filters: ignored,
  };
}

function contextOf(scope: DateScope, ignored: string[] = []): MetricContext {
  return {
    date_from: scope.date_from,
    date_to: scope.date_to,
    timezone: 'Europe/Minsk',
    department_id: scope.department_id,
    product_id: scope.product_id,
    ignored_filters: ignored,
  };
}

/* --------------------------------------------------------- metric engine */

interface RawMetrics {
  revenue: number;
  directCost: number;
  grossMargin: number | null;
  onTimeOrders: number | null;
  defectRate: number | null;
  newCustomers: number;
  activeCustomers: number;
  repeatPurchaseRate: number | null;
  supportSla: number | null;
  capacityUtilization: number | null;
  staffingCoverage: number | null;
  salesPlanAchievement: number | null;
  criticalAlertsCount: number;
  revenuePlan: number;
}

function filterOrders(store: MockStore, scope: DateScope, byCreation = false) {
  return store.orders.filter((order) => {
    if (scope.department_id && order.department_id !== scope.department_id) return false;
    if (scope.product_id && order.product_id !== scope.product_id) return false;
    if (byCreation) return inRange(order.created_at, scope.date_from, scope.date_to);
    return order.status === 'completed' && inRange(order.completed_at, scope.date_from, scope.date_to);
  });
}

function planRows(store: MockStore, scope: DateScope): PlanRow[] {
  return store.plans.filter((row) => {
    if (row.date < scope.date_from || row.date > scope.date_to) return false;
    if (scope.department_id && row.department_id !== scope.department_id) return false;
    if (scope.product_id && row.product_id !== scope.product_id) return false;
    return true;
  });
}

function computeRawMetrics(store: MockStore, scope: DateScope): RawMetrics {
  const completed = filterOrders(store, scope);
  const revenue = round(
    completed.reduce((sum, order) => sum + order.amount, 0),
    2,
  );
  const directCost = round(
    completed.reduce((sum, order) => sum + order.direct_cost, 0),
    2,
  );
  const grossMargin = revenue > 0 ? round(((revenue - directCost) / revenue) * 100, 2) : null;

  const onTime = completed.filter(
    (order) => order.completed_at && new Date(order.completed_at).getTime() <= new Date(order.due_at).getTime(),
  ).length;
  const onTimeOrders = completed.length > 0 ? round((onTime / completed.length) * 100, 2) : null;

  const production = store.production.filter((record) => {
    if (scope.department_id && record.department_id !== scope.department_id) return false;
    if (scope.product_id && record.product_id !== scope.product_id) return false;
    return record.production_date >= scope.date_from && record.production_date <= scope.date_to;
  });
  const produced = production.reduce((sum, record) => sum + record.actual_quantity, 0);
  const defective = production.reduce((sum, record) => sum + record.defective_quantity, 0);
  const defectRate = produced > 0 ? round((defective / produced) * 100, 2) : null;

  const activeCustomerIds = new Set(completed.map((order) => order.customer_id));
  const orderCountByCustomer = new Map<string, number>();
  completed.forEach((order) => {
    orderCountByCustomer.set(order.customer_id, (orderCountByCustomer.get(order.customer_id) ?? 0) + 1);
  });
  const repeatCustomers = [...orderCountByCustomer.values()].filter((count) => count >= 2).length;
  const repeatPurchaseRate =
    activeCustomerIds.size > 0 ? round((repeatCustomers / activeCustomerIds.size) * 100, 2) : null;

  const newCustomers = store.customers.filter((customer) => {
    if (!customer.first_order_at) return false;
    if (!inRange(customer.first_order_at, scope.date_from, scope.date_to)) return false;
    if (!scope.department_id && !scope.product_id) return true;
    return completed.some((order) => order.customer_id === customer.id);
  }).length;

  const tickets = store.tickets.filter((ticket) => {
    if (scope.department_id && ticket.department_id !== scope.department_id) return false;
    if (scope.product_id) return false;
    return ticket.status === 'closed' && inRange(ticket.closed_at, scope.date_from, scope.date_to);
  });
  const slaTickets = tickets.filter((ticket) => ticket.sla_deadline);
  const slaOk = slaTickets.filter((ticket) => ticket.resolved_within_sla).length;
  const supportSla = slaTickets.length > 0 ? round((slaOk / slaTickets.length) * 100, 2) : null;

  const actualLoad = production.reduce((sum, record) => sum + record.actual_load, 0);
  const capacity = planRows(store, scope).reduce((sum, row) => sum + row.available_hours, 0);
  const capacityUtilization = capacity > 0 ? round((actualLoad / capacity) * 100, 2) : null;

  const lastSnapshot = new Map<string, { available: number; required: number }>();
  store.hrSnapshots
    .filter((snapshot) => snapshot.snapshot_date <= scope.date_to)
    .filter((snapshot) => !scope.department_id || snapshot.department_id === scope.department_id)
    .forEach((snapshot) => {
      const current = lastSnapshot.get(snapshot.department_id);
      if (!current) lastSnapshot.set(snapshot.department_id, { available: snapshot.available_headcount, required: snapshot.required_headcount });
    });
  const available = [...lastSnapshot.values()].reduce((sum, row) => sum + row.available, 0);
  const required = [...lastSnapshot.values()].reduce((sum, row) => sum + row.required, 0);
  const staffingCoverage = required > 0 ? round((available / required) * 100, 2) : null;

  const revenuePlan = round(
    planRows(store, scope).reduce((sum, row) => sum + row.revenue_plan, 0),
    2,
  );
  const salesPlanAchievement = revenuePlan > 0 ? round((revenue / revenuePlan) * 100, 2) : null;

  const criticalAlertsCount = store.alerts.filter((alert) => {
    if (alert.status === 'resolved') return false;
    if (scope.department_id && alert.department_id !== scope.department_id) return false;
    if (scope.product_id && alert.product_id !== scope.product_id) return false;
    return true;
  }).length;

  return {
    revenue,
    directCost,
    grossMargin,
    onTimeOrders,
    defectRate,
    newCustomers,
    activeCustomers: activeCustomerIds.size,
    repeatPurchaseRate,
    supportSla,
    capacityUtilization,
    staffingCoverage,
    salesPlanAchievement,
    criticalAlertsCount,
    revenuePlan,
  };
}

function classify(
  actual: number | null,
  target: number | null,
  definition: MetricDefinition,
): { status: MetricStatus; achievement: number | null; deviation: number | null; reason: string | null } {
  if (actual === null) {
    return { status: 'no_data', achievement: null, deviation: null, reason: 'Недостаточно данных для расчёта показателя' };
  }
  if (definition.code === 'critical_alerts_count') {
    return { status: 'normal', achievement: null, deviation: null, reason: null };
  }
  if (target === null) {
    return { status: 'no_data', achievement: null, deviation: null, reason: 'TARGET_MISSING: план не задан' };
  }
  if (target === 0) {
    if (actual === 0) return { status: 'normal', achievement: null, deviation: null, reason: null };
    return { status: 'no_data', achievement: null, deviation: null, reason: 'TARGET_ZERO: план равен нулю' };
  }

  const achievement = round((actual / target) * 100, 2);
  const deviation = round(((actual - target) / Math.abs(target)) * 100, 2);

  if (definition.direction === 'range') {
    if (actual < 70) return { status: 'warning', achievement, deviation, reason: null };
    if (actual <= 100) return { status: 'normal', achievement, deviation, reason: null };
    if (actual <= 110) return { status: 'warning', achievement, deviation, reason: null };
    return { status: 'critical', achievement, deviation, reason: null };
  }

  const adverse = definition.direction === 'lower_is_better' ? -deviation : deviation;
  const worsening = Math.max(0, -adverse);
  if (worsening <= 5) return { status: 'normal', achievement, deviation, reason: null };
  if (worsening <= 10) return { status: 'warning', achievement, deviation, reason: null };
  return { status: 'critical', achievement, deviation, reason: null };
}

function targetFor(definition: MetricDefinition, raw: RawMetrics): number | null {
  switch (definition.code) {
    case 'revenue':
      return raw.revenuePlan > 0 ? raw.revenuePlan : null;
    case 'sales_plan_achievement':
      return 100;
    case 'gross_margin':
    case 'on_time_orders':
    case 'defect_rate':
    case 'repeat_purchase_rate':
    case 'support_sla':
    case 'capacity_utilization':
    case 'staffing_coverage':
      return definition.targetPercent;
    case 'new_customers':
    case 'active_customers':
      return null;
    case 'critical_alerts_count':
      return null;
    default:
      return null;
  }
}

function actualFor(definition: MetricDefinition, raw: RawMetrics): number | null {
  switch (definition.code) {
    case 'revenue':
      return raw.revenue;
    case 'gross_margin':
      return raw.grossMargin;
    case 'on_time_orders':
      return raw.onTimeOrders;
    case 'defect_rate':
      return raw.defectRate;
    case 'new_customers':
      return raw.newCustomers;
    case 'active_customers':
      return raw.activeCustomers;
    case 'repeat_purchase_rate':
      return raw.repeatPurchaseRate;
    case 'support_sla':
      return raw.supportSla;
    case 'capacity_utilization':
      return raw.capacityUtilization;
    case 'staffing_coverage':
      return raw.staffingCoverage;
    case 'sales_plan_achievement':
      return raw.salesPlanAchievement;
    case 'critical_alerts_count':
      return raw.criticalAlertsCount;
    default:
      return null;
  }
}

function buildKpi(definition: MetricDefinition, raw: RawMetrics, scope: DateScope): Kpi {
  const actual = actualFor(definition, raw);
  const target = targetFor(definition, raw);
  const { status, achievement, deviation, reason } = classify(actual, target, definition);

  const ignored: string[] = [];
  if (definition.code === 'staffing_coverage' && scope.product_id) ignored.push('product_id');

  const forecast =
    definition.code === 'revenue' && actual !== null && scope.date_to >= toDateKey(new Date())
      ? round((actual / Math.max(1, startedDays(scope))) * totalDays(scope), 2)
      : null;

  const updatedAt = new Date();
  return {
    id: uuidFrom(0xf0, METRIC_CATALOG.findIndex((metric) => metric.code === definition.code) + 1),
    code: definition.code,
    name: definition.name,
    description: definition.description,
    category: definition.category,
    unit: definition.unit,
    direction: definition.direction,
    actual,
    target,
    forecast,
    achievement_percent: achievement,
    deviation_percent: deviation,
    status,
    currency: definition.unit === 'BYN' ? 'BYN' : null,
    source: definition.source,
    formula: definition.formula,
    formula_version: definition.formulaVersion,
    forecast_method: forecast !== null ? 'calendar_day_run_rate' : null,
    reason_code: reason ? reason.split(':')[0] ?? null : null,
    reason,
    source_updated_at: toIso(new Date(updatedAt.getTime() - 12 * 60_000)),
    updated_at: toIso(updatedAt),
    context: contextOf(scope, ignored),
    notices:
      ignored.length > 0
        ? ['Фильтр продукта не применяется к кадровым показателям']
        : definition.code === 'critical_alerts_count'
          ? ['Показатель не имеет плана и прогноза']
          : [],
    supported_group_by: definition.supportedGroupBy,
  };
}

function totalDays(scope: DateScope): number {
  const from = new Date(`${scope.date_from}T00:00:00`);
  const to = new Date(`${scope.date_to}T00:00:00`);
  return Math.max(1, Math.round((to.getTime() - from.getTime()) / DAY_MS) + 1);
}

function startedDays(scope: DateScope): number {
  const today = startOfDay(new Date());
  const to = new Date(`${scope.date_to}T00:00:00`);
  const capped = Math.min(to.getTime(), today.getTime());
  const from = new Date(`${scope.date_from}T00:00:00`);
  return Math.max(1, Math.round((capped - from.getTime()) / DAY_MS) + 1);
}

export function computeKpis(scope: DateScope, ctx: MockContext): Kpi[] {
  const raw = computeRawMetrics(ctx.store, scope);
  return METRIC_CATALOG.map((definition) => buildKpi(definition, raw, scope));
}

/* -------------------------------------------------------------- dashboard */

export function dashboard(params: URLSearchParams, ctx: MockContext): DashboardResponse {
  const scope = resolveScope(params, ctx);
  const kpis = computeKpis(scope, ctx);
  const raw = computeRawMetrics(ctx.store, scope);

  const alerts = ctx.store.alerts
    .filter((alert) => !scope.department_id || alert.department_id === scope.department_id)
    .slice(0, 5);
  const decisions = ctx.store.decisions
    .filter((decision) => !scope.department_id || decision.department_id === scope.department_id)
    .slice(0, 5);
  const tasks = ctx.store.tasks.filter((task) => !scope.department_id || task.department_id === scope.department_id);

  return {
    period: { date_from: scope.date_from, date_to: scope.date_to },
    filters: { department_id: scope.department_id, product_id: scope.product_id },
    kpis,
    active_alerts_count: raw.criticalAlertsCount,
    critical_alerts_count: raw.criticalAlertsCount,
    active_decisions_count: ctx.store.decisions.filter(
      (decision) => decision.status === 'new' || decision.status === 'in_progress' || decision.status === 'needs_review',
    ).length,
    active_tasks_count: tasks.filter((task) => task.status === 'new' || task.status === 'in_progress').length,
    overdue_tasks_count: tasks.filter((task) => task.is_overdue).length,
    recent_alerts: alerts,
    recent_decisions: decisions,
    recent_tasks: tasks.slice(0, 5),
    updated_at: toIso(new Date()),
  };
}

/* ------------------------------------------------------------------ lists */

export function listOrders(params: URLSearchParams, ctx: MockContext): Paginated<Order> {
  const scope = resolveScope(params, ctx);
  const status = params.get('status');
  const search = params.get('search') ?? undefined;

  const user = ctx.store.users.find((item) => item.id === ctx.userId);
  let items = ctx.store.orders.filter((order) => {
    if (scope.department_id && order.department_id !== scope.department_id) return false;
    if (scope.product_id && order.product_id !== scope.product_id) return false;
    if (status && order.status !== status) return false;
    if (!inRange(order.created_at, scope.date_from, scope.date_to)) return false;
    return textMatch([order.order_number, order.customer_name], search);
  });

  if (user?.role === 'employee') {
    const allowed = new Set(
      ctx.store.tasks
        .filter((task) => task.assignee_id === user.id && task.order_id)
        .map((task) => task.order_id as string),
    );
    items = items.filter((order) => allowed.has(order.id));
  }

  const sorted = sortItems(items, params.get('sort_by') ?? 'created_at', (params.get('sort_order') as 'asc' | 'desc') ?? 'desc', 'created_at');
  return paginate(sorted, Number(params.get('page') ?? 1), Number(params.get('page_size') ?? 20));
}

export function getOrder(id: string, ctx: MockContext): Order {
  const order = ctx.store.orders.find((item) => item.id === id);
  if (!order) throw new MockHttpError(404, 'RESOURCE_NOT_FOUND', 'Заказ не найден');
  return order;
}

export function orderEvents(id: string, ctx: MockContext): Paginated<OrderEvent> {
  const items = ctx.store.orderEvents
    .filter((event) => event.order_id === id)
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
  return paginate(items, 1, 50);
}

export function listCustomers(params: URLSearchParams, ctx: MockContext): Paginated<Customer> {
  const search = params.get('search') ?? undefined;
  const segment = params.get('segment');
  const items = ctx.store.customers.filter((customer) => {
    if (segment && customer.segment !== segment) return false;
    return textMatch([customer.name, customer.external_id], search);
  });
  return paginate(items, Number(params.get('page') ?? 1), Number(params.get('page_size') ?? 20));
}

export function getCustomer(id: string, ctx: MockContext): Customer & { orders: Order[] } {
  const customer = ctx.store.customers.find((item) => item.id === id);
  if (!customer) throw new MockHttpError(404, 'RESOURCE_NOT_FOUND', 'Клиент не найден');
  return { ...customer, orders: ctx.store.orders.filter((order) => order.customer_id === id).slice(0, 20) };
}

export function listProducts(ctx: MockContext): Product[] {
  return ctx.store.products;
}

export function listDepartments(ctx: MockContext): Department[] {
  const user = ctx.store.users.find((item) => item.id === ctx.userId);
  if (user?.role === 'manager' && user.department_id) {
    return ctx.store.departments.filter((department) => department.id === user.department_id);
  }
  return ctx.store.departments;
}

export function listAlerts(params: URLSearchParams, ctx: MockContext): Paginated<Alert> {
  const scope = resolveScope(params, ctx);
  const status = params.get('status');
  const metricCode = params.get('metric_code');
  const search = params.get('search') ?? undefined;
  const items = ctx.store.alerts.filter((alert) => {
    if (status && alert.status !== status) return false;
    if (metricCode && alert.metric_code !== metricCode) return false;
    if (scope.department_id && alert.department_id !== scope.department_id) return false;
    if (scope.product_id && alert.product_id !== scope.product_id) return false;
    return textMatch([alert.title, alert.description, alert.metric_name], search);
  });
  const sorted = sortItems(items, params.get('sort_by') ?? 'created_at', (params.get('sort_order') as 'asc' | 'desc') ?? 'desc', 'created_at');
  return paginate(sorted, Number(params.get('page') ?? 1), Number(params.get('page_size') ?? 20));
}

export function getAlert(id: string, ctx: MockContext): AlertDetail {
  const alert = ctx.store.alerts.find((item) => item.id === id);
  if (!alert) throw new MockHttpError(404, 'RESOURCE_NOT_FOUND', 'Отклонение не найдено');
  const scope: DateScope = {
    date_from: alert.period_start,
    date_to: alert.period_end,
    department_id: alert.department_id,
    product_id: alert.product_id,
    ignored_filters: [],
  };
  const definition = METRIC_BY_CODE.get(alert.metric_code) ?? METRIC_CATALOG[0]!;
  const raw = computeRawMetrics(ctx.store, scope);
  const metric = buildKpi(definition, raw, scope);

  const decisions = ctx.store.decisions
    .filter((decision) => decision.alert_id === alert.id)
    .map((decision) => ({ id: decision.id, name: decision.title }));
  const tasks = ctx.store.tasks
    .filter((task) => task.alert_id === alert.id)
    .map((task) => ({ id: task.id, name: task.title }));

  const relatedOrders = ctx.store.orders
    .filter(
      (order) =>
        (!alert.department_id || order.department_id === alert.department_id) &&
        (!alert.product_id || order.product_id === alert.product_id),
    )
    .slice(0, 8)
    .map((order) => ({ id: order.id, label: `${order.order_number} · ${order.customer_name}`, amount: order.amount }));

  const productionCauses = ctx.store.production
    .filter((record) => record.cause)
    .slice(0, 3)
    .map((record) => ({ text: record.cause as string, confirmed: true }));

  const causes =
    productionCauses.length > 0
      ? productionCauses
      : [{ text: 'Причина в источнике не зафиксирована', confirmed: false }];

  return {
    alert,
    metric,
    decisions,
    tasks,
    causes,
    related_orders: relatedOrders,
    breakdown_url: `/metrics/${alert.metric_code}/breakdown?group_by=department`,
  };
}

export function patchAlert(id: string, body: { status: AlertStatus }, ctx: MockContext): Alert {
  const alert = ctx.store.alerts.find((item) => item.id === id);
  if (!alert) throw new MockHttpError(404, 'RESOURCE_NOT_FOUND', 'Отклонение не найдено');
  const user = ctx.store.users.find((item) => item.id === ctx.userId);
  if (!user || user.role === 'employee' || user.role === 'analyst') {
    throw new MockHttpError(403, 'AUTH_FORBIDDEN', 'Недостаточно прав для изменения отклонения');
  }
  const previous = alert.status;
  alert.status = body.status;
  alert.updated_at = toIso(new Date());
  ctx.store.alertHistory.push({
    id: newUuid(),
    object_type: 'alert',
    object_id: alert.id,
    action: body.status === 'resolved' ? 'alert.resolved' : 'alert.acknowledged',
    changed_by: { id: user.id, full_name: user.full_name },
    old_values: { status: previous },
    new_values: { status: body.status },
    comment: null,
    created_at: toIso(new Date()),
  });
  pushAudit(ctx, {
    action: body.status === 'resolved' ? 'alert.resolved' : 'alert.acknowledged',
    object_type: 'alert',
    object_id: alert.id,
    object_name: alert.title,
    old_values: { status: previous },
    new_values: { status: body.status },
  });
  bumpRevision();
  return alert;
}

export function alertHistory(id: string, params: URLSearchParams, ctx: MockContext): Paginated<ChangeEvent> {
  const items = ctx.store.alertHistory
    .filter((event) => event.object_id === id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  return paginate(items, Number(params.get('page') ?? 1), Number(params.get('page_size') ?? 20));
}

/* -------------------------------------------------------------- decisions */

export function listDecisions(params: URLSearchParams, ctx: MockContext): Paginated<Decision> {
  const scope = resolveScope(params, ctx);
  const status = params.get('status');
  const priority = params.get('priority');
  const ownerId = params.get('owner_id');
  const search = params.get('search') ?? undefined;
  const overdue = params.get('overdue') === 'true';

  const items = ctx.store.decisions.filter((decision) => {
    if (status && decision.status !== status) return false;
    if (priority && decision.priority !== priority) return false;
    if (ownerId && decision.owner_id !== ownerId) return false;
    if (scope.department_id && decision.department_id !== scope.department_id) return false;
    if (overdue) {
      const isOverdue = new Date(decision.deadline).getTime() < Date.now() && !['completed', 'cancelled'].includes(decision.status);
      if (!isOverdue) return false;
    }
    return textMatch([decision.title, decision.problem, decision.owner.full_name], search);
  });
  const sorted = sortItems(items, params.get('sort_by') ?? 'created_at', (params.get('sort_order') as 'asc' | 'desc') ?? 'desc', 'created_at');
  return paginate(sorted, Number(params.get('page') ?? 1), Number(params.get('page_size') ?? 20));
}

export function getDecision(id: string, ctx: MockContext): Decision {
  const decision = ctx.store.decisions.find((item) => item.id === id);
  if (!decision) throw new MockHttpError(404, 'RESOURCE_NOT_FOUND', 'Решение не найдено');
  const user = ctx.store.users.find((item) => item.id === ctx.userId);
  if (user?.role === 'manager' && user.department_id && decision.department_id !== user.department_id) {
    throw new MockHttpError(404, 'RESOURCE_NOT_FOUND', 'Решение не найдено');
  }
  return decision;
}

export interface DecisionCreateBody {
  title: string;
  problem: string;
  impact: string;
  cause: string;
  action: string;
  department_id: string | null;
  owner_id: string;
  alert_id: string | null;
  deadline: string;
  priority: string;
  expected_result: string;
}

export function createDecision(body: DecisionCreateBody, ctx: MockContext): Decision {
  const user = ctx.store.users.find((item) => item.id === ctx.userId);
  if (!user) throw new MockHttpError(401, 'AUTH_TOKEN_EXPIRED', 'Требуется авторизация');
  if (!['admin', 'director', 'manager'].includes(user.role)) {
    throw new MockHttpError(403, 'AUTH_FORBIDDEN', 'Недостаточно прав для создания решения');
  }
  if (user.role === 'manager' && user.department_id && body.department_id !== user.department_id) {
    throw new MockHttpError(403, 'DEPARTMENT_ACCESS_DENIED', 'Решение можно создать только для своего подразделения');
  }
  const fields: Record<string, string> = {};
  if (!body.title?.trim()) fields.title = 'Поле обязательно';
  if (!body.problem?.trim()) fields.problem = 'Поле обязательно';
  if (!body.impact?.trim()) fields.impact = 'Поле обязательно';
  if (!body.cause?.trim()) fields.cause = 'Поле обязательно';
  if (!body.action?.trim()) fields.action = 'Поле обязательно';
  if (!body.owner_id) fields.owner_id = 'Поле обязательно';
  if (!body.deadline) fields.deadline = 'Поле обязательно';
  if (!body.expected_result?.trim()) fields.expected_result = 'Поле обязательно';
  if (Object.keys(fields).length > 0) {
    throw new MockHttpError(422, 'VALIDATION_ERROR', 'Проверьте корректность введённых данных', fields);
  }

  const owner = ctx.store.users.find((item) => item.id === body.owner_id);
  if (!owner) throw new MockHttpError(422, 'VALIDATION_ERROR', 'Ответственный не найден', { owner_id: 'Пользователь не найден' });

  const department = ctx.store.departments.find((item) => item.id === body.department_id) ?? null;
  const alert = body.alert_id ? ctx.store.alerts.find((item) => item.id === body.alert_id) ?? null : null;

  const now = new Date();
  const decision: Decision = {
    id: newUuid(),
    title: body.title.trim(),
    problem: body.problem.trim(),
    impact: body.impact.trim(),
    cause: body.cause.trim(),
    action: body.action.trim(),
    department_id: department?.id ?? null,
    department_name: department?.name ?? null,
    owner_id: owner.id,
    owner: { id: owner.id, full_name: owner.full_name },
    created_by: user.id,
    creator: { id: user.id, full_name: user.full_name },
    alert_id: alert?.id ?? null,
    alert_title: alert?.title ?? null,
    deadline: body.deadline,
    priority: (body.priority as Decision['priority']) ?? 'medium',
    status: 'new',
    expected_result: body.expected_result.trim(),
    actual_result: null,
    verification_note: null,
    created_at: toIso(now),
    updated_at: toIso(now),
    completed_at: null,
    version: 1,
    allowed_actions: ['read', 'update', 'submit_review', 'cancel'],
  };
  ctx.store.decisions.unshift(decision);
  if (alert) alert.has_decision = true;

  ctx.store.decisionHistory.push({
    id: newUuid(),
    object_type: 'decision',
    object_id: decision.id,
    action: 'decision.created',
    changed_by: { id: user.id, full_name: user.full_name },
    old_values: {},
    new_values: { title: decision.title, status: 'new', priority: decision.priority },
    comment: 'Решение создано через интерфейс',
    created_at: toIso(now),
  });
  pushAudit(ctx, {
    action: 'decision.created',
    object_type: 'decision',
    object_id: decision.id,
    object_name: decision.title,
    old_values: null,
    new_values: { status: 'new', priority: decision.priority, owner: decision.owner.full_name },
  });
  bumpRevision();
  return decision;
}

export interface DecisionPatchBody {
  version: number;
  title?: string;
  problem?: string;
  impact?: string;
  cause?: string;
  action?: string;
  owner_id?: string;
  deadline?: string;
  priority?: string;
  status?: DecisionStatus;
  expected_result?: string;
  actual_result?: string;
  verification_note?: string;
  comment?: string;
}

const DECISION_TRANSITIONS: Record<DecisionStatus, DecisionStatus[]> = {
  new: ['in_progress', 'cancelled'],
  in_progress: ['needs_review', 'cancelled'],
  needs_review: ['completed', 'in_progress', 'cancelled'],
  completed: [],
  cancelled: [],
};

export function patchDecision(id: string, body: DecisionPatchBody, ctx: MockContext): Decision {
  const decision = ctx.store.decisions.find((item) => item.id === id);
  if (!decision) throw new MockHttpError(404, 'RESOURCE_NOT_FOUND', 'Решение не найдено');
  const user = ctx.store.users.find((item) => item.id === ctx.userId);
  if (!user) throw new MockHttpError(401, 'AUTH_TOKEN_EXPIRED', 'Требуется авторизация');
  if (!['admin', 'director', 'manager'].includes(user.role)) {
    throw new MockHttpError(403, 'AUTH_FORBIDDEN', 'Недостаточно прав для изменения решения');
  }
  if (body.version !== decision.version) {
    throw new MockHttpError(409, 'VERSION_CONFLICT', 'Запись изменена другим пользователем. Перечитайте данные.');
  }
  if (['completed', 'cancelled'].includes(decision.status)) {
    throw new MockHttpError(409, 'INVALID_STATUS_TRANSITION', 'Терминальное решение нельзя изменить');
  }
  if (body.status && body.status !== decision.status) {
    const allowed = DECISION_TRANSITIONS[decision.status];
    if (!allowed.includes(body.status)) {
      throw new MockHttpError(409, 'INVALID_STATUS_TRANSITION', `Недопустимый переход статуса: ${decision.status} → ${body.status}`);
    }
    if (body.status === 'needs_review' && !body.actual_result?.trim() && !decision.actual_result) {
      throw new MockHttpError(422, 'VALIDATION_ERROR', 'Перед отправкой на проверку укажите фактический результат', {
        actual_result: 'Поле обязательно',
      });
    }
    if (body.status === 'completed' && !body.verification_note?.trim()) {
      throw new MockHttpError(422, 'VALIDATION_ERROR', 'Для завершения требуется комментарий проверки', {
        verification_note: 'Поле обязательно',
      });
    }
    if (body.status === 'cancelled' && !body.comment?.trim()) {
      throw new MockHttpError(422, 'VALIDATION_ERROR', 'Для отмены требуется комментарий', {
        comment: 'Поле обязательно',
      });
    }
  }

  const oldValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};
  const assign = <K extends keyof Decision>(key: K, value: Decision[K]) => {
    if (value !== undefined && value !== decision[key]) {
      oldValues[key as string] = decision[key];
      newValues[key as string] = value;
      decision[key] = value;
    }
  };

  assign('title', body.title?.trim() as Decision['title']);
  assign('problem', body.problem?.trim() as Decision['problem']);
  assign('impact', body.impact?.trim() as Decision['impact']);
  assign('cause', body.cause?.trim() as Decision['cause']);
  assign('action', body.action?.trim() as Decision['action']);
  assign('deadline', body.deadline as Decision['deadline']);
  assign('priority', body.priority as Decision['priority']);
  assign('expected_result', body.expected_result?.trim() as Decision['expected_result']);
  assign('actual_result', body.actual_result?.trim() as Decision['actual_result']);
  assign('verification_note', body.verification_note?.trim() as Decision['verification_note']);

  if (body.owner_id && body.owner_id !== decision.owner_id) {
    const owner = ctx.store.users.find((item) => item.id === body.owner_id);
    if (!owner) throw new MockHttpError(422, 'VALIDATION_ERROR', 'Ответственный не найден', { owner_id: 'Пользователь не найден' });
    oldValues.owner_id = decision.owner_id;
    newValues.owner_id = owner.id;
    decision.owner_id = owner.id;
    decision.owner = { id: owner.id, full_name: owner.full_name };
  }

  if (body.status && body.status !== decision.status) {
    oldValues.status = decision.status;
    newValues.status = body.status;
    decision.status = body.status;
    if (body.status === 'completed') decision.completed_at = toIso(new Date());
  }

  decision.version += 1;
  decision.updated_at = toIso(new Date());

  if (Object.keys(newValues).length > 0) {
    ctx.store.decisionHistory.push({
      id: newUuid(),
      object_type: 'decision',
      object_id: decision.id,
      action: 'decision.updated',
      changed_by: { id: user.id, full_name: user.full_name },
      old_values: oldValues,
      new_values: newValues,
      comment: body.comment ?? null,
      created_at: toIso(new Date()),
    });
    pushAudit(ctx, {
      action: body.status ? 'decision.status_changed' : 'decision.updated',
      object_type: 'decision',
      object_id: decision.id,
      object_name: decision.title,
      old_values: oldValues,
      new_values: newValues,
    });
    bumpRevision();
  }

  return decision;
}

export function decisionHistory(id: string, params: URLSearchParams, ctx: MockContext): Paginated<ChangeEvent> {
  const user = ctx.store.users.find((item) => item.id === ctx.userId);
  if (user?.role === 'employee') {
    throw new MockHttpError(403, 'AUTH_FORBIDDEN', 'История решения недоступна для роли «Сотрудник»');
  }
  const items = ctx.store.decisionHistory
    .filter((event) => event.object_id === id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  return paginate(items, Number(params.get('page') ?? 1), Number(params.get('page_size') ?? 20));
}

/* ------------------------------------------------------------------ tasks */

export function listTasks(params: URLSearchParams, ctx: MockContext): Paginated<Task> {
  const scope = resolveScope(params, ctx);
  const user = ctx.store.users.find((item) => item.id === ctx.userId);
  const status = params.get('status');
  const priority = params.get('priority');
  const assigneeId = params.get('assignee_id');
  const decisionId = params.get('decision_id');
  const mine = params.get('mine') === 'true';
  const search = params.get('search') ?? undefined;
  const overdue = params.get('overdue') === 'true';

  let items = ctx.store.tasks.filter((task) => {
    if (user?.role === 'employee' && task.assignee_id !== user.id) return false;
    if (user?.role === 'manager' && user.department_id && task.department_id !== user.department_id) return false;
    if (scope.department_id && task.department_id !== scope.department_id) return false;
    if (status && task.status !== status) return false;
    if (priority && task.priority !== priority) return false;
    if (assigneeId && task.assignee_id !== assigneeId) return false;
    if (decisionId && task.decision_id !== decisionId) return false;
    if (mine && task.assignee_id !== ctx.userId) return false;
    if (overdue && !task.is_overdue) return false;
    return textMatch([task.title, task.description, task.assignee.full_name], search);
  });
  items = sortItems(items, params.get('sort_by') ?? 'deadline', (params.get('sort_order') as 'asc' | 'desc') ?? 'asc', 'deadline');
  return paginate(items, Number(params.get('page') ?? 1), Number(params.get('page_size') ?? 20));
}

export function getTask(id: string, ctx: MockContext): Task {
  const task = ctx.store.tasks.find((item) => item.id === id);
  if (!task) throw new MockHttpError(404, 'RESOURCE_NOT_FOUND', 'Задача не найдена');
  const user = ctx.store.users.find((item) => item.id === ctx.userId);
  if (user?.role === 'employee' && task.assignee_id !== user.id) {
    throw new MockHttpError(404, 'RESOURCE_NOT_FOUND', 'Задача не найдена');
  }
  return task;
}

export interface TaskCreateBody {
  title: string;
  description: string;
  assignee_id: string;
  department_id: string;
  decision_id: string | null;
  alert_id: string | null;
  order_id: string | null;
  deadline: string;
  priority: string;
}

export function createTask(body: TaskCreateBody, ctx: MockContext): Task {
  const user = ctx.store.users.find((item) => item.id === ctx.userId);
  if (!user) throw new MockHttpError(401, 'AUTH_TOKEN_EXPIRED', 'Требуется авторизация');
  if (!['admin', 'director', 'manager'].includes(user.role)) {
    throw new MockHttpError(403, 'AUTH_FORBIDDEN', 'Недостаточно прав для создания задачи');
  }
  const fields: Record<string, string> = {};
  if (!body.title?.trim()) fields.title = 'Поле обязательно';
  if (!body.assignee_id) fields.assignee_id = 'Поле обязательно';
  if (!body.department_id) fields.department_id = 'Поле обязательно';
  if (!body.deadline) fields.deadline = 'Поле обязательно';
  if (!body.priority) fields.priority = 'Поле обязательно';
  if (Object.keys(fields).length > 0) {
    throw new MockHttpError(422, 'VALIDATION_ERROR', 'Проверьте корректность введённых данных', fields);
  }
  if (user.role === 'manager' && user.department_id && body.department_id !== user.department_id) {
    throw new MockHttpError(403, 'DEPARTMENT_ACCESS_DENIED', 'Задачу можно создать только для своего подразделения');
  }
  const assignee = ctx.store.users.find((item) => item.id === body.assignee_id);
  if (!assignee) throw new MockHttpError(422, 'VALIDATION_ERROR', 'Исполнитель не найден', { assignee_id: 'Пользователь не найден' });

  const department = ctx.store.departments.find((item) => item.id === body.department_id);
  if (!department) throw new MockHttpError(422, 'VALIDATION_ERROR', 'Подразделение не найдено', { department_id: 'Не найдено' });

  const decision = body.decision_id ? ctx.store.decisions.find((item) => item.id === body.decision_id) : null;
  const alert = body.alert_id ? ctx.store.alerts.find((item) => item.id === body.alert_id) : decision?.alert_id ? ctx.store.alerts.find((item) => item.id === decision.alert_id) : null;
  const order = body.order_id ? ctx.store.orders.find((item) => item.id === body.order_id) : null;

  const now = new Date();
  const deadlineDate = new Date(body.deadline);
  const task: Task = {
    id: newUuid(),
    title: body.title.trim(),
    description: body.description?.trim() ?? '',
    assignee_id: assignee.id,
    assignee: { id: assignee.id, full_name: assignee.full_name },
    created_by: user.id,
    creator: { id: user.id, full_name: user.full_name },
    department_id: department.id,
    department_name: department.name,
    decision_id: decision?.id ?? null,
    decision_title: decision?.title ?? null,
    alert_id: alert?.id ?? null,
    alert_title: alert?.title ?? null,
    order_id: order?.id ?? null,
    deadline: body.deadline,
    priority: (body.priority as Task['priority']) ?? 'medium',
    status: 'new',
    is_overdue: deadlineDate.getTime() < Date.now(),
    created_at: toIso(now),
    updated_at: toIso(now),
    completed_at: null,
    version: 1,
    allowed_actions: ['read', 'start'],
  };
  ctx.store.tasks.unshift(task);
  ctx.store.taskHistory.push({
    id: newUuid(),
    object_type: 'task',
    object_id: task.id,
    action: 'task.created',
    changed_by: { id: user.id, full_name: user.full_name },
    old_values: {},
    new_values: { title: task.title, status: 'new', priority: task.priority },
    comment: null,
    created_at: toIso(now),
  });
  pushAudit(ctx, {
    action: 'task.created',
    object_type: 'task',
    object_id: task.id,
    object_name: task.title,
    old_values: null,
    new_values: { status: 'new', assignee: assignee.full_name },
  });
  bumpRevision();
  return task;
}

export interface TaskPatchBody {
  version: number;
  status?: TaskStatus;
  title?: string;
  description?: string;
  assignee_id?: string;
  deadline?: string;
  priority?: string;
  comment?: string;
}

const TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  new: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export function patchTask(id: string, body: TaskPatchBody, ctx: MockContext): Task {
  const task = ctx.store.tasks.find((item) => item.id === id);
  if (!task) throw new MockHttpError(404, 'RESOURCE_NOT_FOUND', 'Задача не найдена');
  const user = ctx.store.users.find((item) => item.id === ctx.userId);
  if (!user) throw new MockHttpError(401, 'AUTH_TOKEN_EXPIRED', 'Требуется авторизация');
  if (body.version !== task.version) {
    throw new MockHttpError(409, 'VERSION_CONFLICT', 'Задача изменена другим пользователем. Перечитайте данные.');
  }
  if (user.role === 'employee' && task.assignee_id !== user.id) {
    throw new MockHttpError(403, 'AUTH_FORBIDDEN', 'Можно изменять только свои задачи');
  }
  if (['completed', 'cancelled'].includes(task.status)) {
    throw new MockHttpError(409, 'INVALID_STATUS_TRANSITION', 'Терминальную задачу нельзя изменить');
  }
  if (body.status && body.status !== task.status) {
    if (!TASK_TRANSITIONS[task.status].includes(body.status)) {
      throw new MockHttpError(409, 'INVALID_STATUS_TRANSITION', `Недопустимый переход статуса: ${task.status} → ${body.status}`);
    }
    if (body.status === 'cancelled') {
      if (!['admin', 'director', 'manager'].includes(user.role)) {
        throw new MockHttpError(403, 'AUTH_FORBIDDEN', 'Отмена задачи доступна только руководящим ролям');
      }
      if (!body.comment?.trim()) {
        throw new MockHttpError(422, 'VALIDATION_ERROR', 'Для отмены требуется комментарий', { comment: 'Поле обязательно' });
      }
    }
  }

  const oldValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};
  if (body.title && body.title !== task.title) {
    oldValues.title = task.title;
    newValues.title = body.title;
    task.title = body.title;
  }
  if (body.description !== undefined && body.description !== task.description) {
    oldValues.description = task.description;
    newValues.description = body.description;
    task.description = body.description;
  }
  if (body.deadline && body.deadline !== task.deadline) {
    oldValues.deadline = task.deadline;
    newValues.deadline = body.deadline;
    task.deadline = body.deadline;
    task.is_overdue = new Date(body.deadline).getTime() < Date.now() && task.status !== 'completed';
  }
  if (body.priority && body.priority !== task.priority) {
    oldValues.priority = task.priority;
    newValues.priority = body.priority;
    task.priority = body.priority as Task['priority'];
  }
  if (body.assignee_id && body.assignee_id !== task.assignee_id) {
    const assignee = ctx.store.users.find((item) => item.id === body.assignee_id);
    if (!assignee) throw new MockHttpError(422, 'VALIDATION_ERROR', 'Исполнитель не найден', { assignee_id: 'Не найдено' });
    oldValues.assignee_id = task.assignee_id;
    newValues.assignee_id = assignee.id;
    task.assignee_id = assignee.id;
    task.assignee = { id: assignee.id, full_name: assignee.full_name };
  }
  if (body.status && body.status !== task.status) {
    oldValues.status = task.status;
    newValues.status = body.status;
    task.status = body.status;
    if (body.status === 'completed') {
      task.completed_at = toIso(new Date());
      task.is_overdue = false;
    }
    if (body.status === 'cancelled') task.is_overdue = false;
  }

  task.version += 1;
  task.updated_at = toIso(new Date());

  if (Object.keys(newValues).length > 0) {
    ctx.store.taskHistory.push({
      id: newUuid(),
      object_type: 'task',
      object_id: task.id,
      action: body.status ? 'task.status_changed' : 'task.updated',
      changed_by: { id: user.id, full_name: user.full_name },
      old_values: oldValues,
      new_values: newValues,
      comment: body.comment ?? null,
      created_at: toIso(new Date()),
    });
    pushAudit(ctx, {
      action: body.status ? 'task.status_changed' : 'task.updated',
      object_type: 'task',
      object_id: task.id,
      object_name: task.title,
      old_values: oldValues,
      new_values: newValues,
    });
    bumpRevision();
  }
  return task;
}

export function archiveTask(id: string, ctx: MockContext): void {
  const user = ctx.store.users.find((item) => item.id === ctx.userId);
  if (user?.role !== 'admin') throw new MockHttpError(403, 'AUTH_FORBIDDEN', 'Архивация доступна только администратору');
  const index = ctx.store.tasks.findIndex((item) => item.id === id);
  if (index === -1) throw new MockHttpError(404, 'RESOURCE_NOT_FOUND', 'Задача не найдена');
  const [removed] = ctx.store.tasks.splice(index, 1);
  pushAudit(ctx, {
    action: 'task.archived',
    object_type: 'task',
    object_id: id,
    object_name: removed?.title ?? null,
    old_values: null,
    new_values: { archived: true },
  });
  bumpRevision();
}

export function taskHistory(id: string, params: URLSearchParams, ctx: MockContext): Paginated<ChangeEvent> {
  const user = ctx.store.users.find((item) => item.id === ctx.userId);
  const task = ctx.store.tasks.find((item) => item.id === id);
  if (!task) throw new MockHttpError(404, 'RESOURCE_NOT_FOUND', 'Задача не найдена');
  if (user?.role === 'employee' && task.assignee_id !== user.id) {
    throw new MockHttpError(403, 'AUTH_FORBIDDEN', 'История доступна только по своей задаче');
  }
  const items = ctx.store.taskHistory
    .filter((event) => event.object_id === id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  return paginate(items, Number(params.get('page') ?? 1), Number(params.get('page_size') ?? 20));
}

/* ---------------------------------------------------------------- metrics */

export function listMetrics(params: URLSearchParams, ctx: MockContext): Paginated<Kpi> {
  const scope = resolveScope(params, ctx);
  const category = params.get('category');
  const status = params.get('status');
  let items = computeKpis(scope, ctx);
  if (category) items = items.filter((kpi) => kpi.category === category);
  if (status) items = items.filter((kpi) => kpi.status === status);
  return paginate(items, Number(params.get('page') ?? 1), Number(params.get('page_size') ?? 20));
}

export function getMetric(code: string, params: URLSearchParams, ctx: MockContext): Kpi {
  const definition = METRIC_BY_CODE.get(code);
  if (!definition) throw new MockHttpError(404, 'RESOURCE_NOT_FOUND', 'Показатель не найден');
  const scope = resolveScope(params, ctx);
  const raw = computeRawMetrics(ctx.store, scope);
  return buildKpi(definition, raw, scope);
}

export function metricHistory(code: string, params: URLSearchParams, ctx: MockContext): MetricHistoryResponse {
  const definition = METRIC_BY_CODE.get(code);
  if (!definition) throw new MockHttpError(404, 'RESOURCE_NOT_FOUND', 'Показатель не найден');
  const scope = resolveScope(params, ctx);
  const interval = params.get('interval') ?? 'day';

  const points: MetricHistoryResponse['items'] = [];
  const from = new Date(`${scope.date_from}T00:00:00`);
  const to = new Date(`${scope.date_to}T00:00:00`);

  if (interval === 'month') {
    let cursor = new Date(from.getFullYear(), from.getMonth(), 1);
    while (cursor <= to) {
      const start = toDateKey(cursor);
      const end = toDateKey(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0));
      const windowScope = { ...scope, date_from: start, date_to: end };
      const raw = computeRawMetrics(ctx.store, windowScope);
      const kpi = buildKpi(definition, raw, windowScope);
      points.push({
        period_start: start,
        period_end: end,
        actual: kpi.actual,
        target: kpi.target,
        forecast: null,
        status: kpi.status,
        updated_at: kpi.updated_at,
      });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
  } else {
    const step = interval === 'week' ? 7 : 1;
    let cursor = new Date(from);
    while (cursor <= to) {
      const start = toDateKey(cursor);
      const endDate = addDays(cursor, step - 1);
      const end = toDateKey(endDate > to ? to : endDate);
      const windowScope = { ...scope, date_from: start, date_to: end };
      const raw = computeRawMetrics(ctx.store, windowScope);
      const kpi = buildKpi(definition, raw, windowScope);
      points.push({
        period_start: start,
        period_end: end,
        actual: kpi.actual,
        target: kpi.target,
        forecast: null,
        status: kpi.status,
        updated_at: kpi.updated_at,
      });
      cursor = addDays(cursor, step);
    }
  }

  const ordered = points.sort((a, b) => a.period_start.localeCompare(b.period_start));
  return {
    ...paginate(ordered, Number(params.get('page') ?? 1), Number(params.get('page_size') ?? 60)),
    metric_code: code,
    context: contextOf(scope),
  };
}

export function metricBreakdown(code: string, params: URLSearchParams, ctx: MockContext): MetricBreakdownResponse {
  const definition = METRIC_BY_CODE.get(code);
  if (!definition) throw new MockHttpError(404, 'RESOURCE_NOT_FOUND', 'Показатель не найден');
  const scope = resolveScope(params, ctx);
  const groupBy = params.get('group_by') ?? 'department';
  if (!definition.supportedGroupBy.includes(groupBy)) {
    throw new MockHttpError(422, 'VALIDATION_ERROR', `Группировка «${groupBy}» не поддерживается для показателя`, {
      group_by: 'Недопустимое значение',
    });
  }

  const rows: MetricBreakdownRow[] = [];

  if (groupBy === 'department' || groupBy === 'product') {
    const keys =
      groupBy === 'department'
        ? ctx.store.departments.map((department) => ({ id: department.id, name: department.name }))
        : ctx.store.products.map((product) => ({ id: product.id, name: product.name }));

    keys.forEach((key) => {
      const windowScope: DateScope = {
        ...scope,
        department_id: groupBy === 'department' ? key.id : scope.department_id,
        product_id: groupBy === 'product' ? key.id : scope.product_id,
      };
      const raw = computeRawMetrics(ctx.store, windowScope);
      const kpi = buildKpi(definition, raw, windowScope);
      rows.push({
        key: key.id,
        name: key.name,
        actual: kpi.actual,
        target: kpi.target,
        deviation_percent: kpi.deviation_percent,
        source_records_count:
          groupBy === 'department'
            ? ctx.store.orders.filter((order) => order.department_id === key.id).length
            : ctx.store.orders.filter((order) => order.product_id === key.id).length,
        cause: kpi.status === 'critical' ? 'Требует проверки источника' : null,
        cause_status: kpi.status === 'critical' ? 'requires_review' : 'known',
        links: [],
      });
    });
  } else if (groupBy === 'order') {
    const orders = filterOrders(ctx.store, scope).slice(0, 40);
    orders.forEach((order) => {
      rows.push({
        key: order.id,
        name: `${order.order_number} · ${order.customer_name}`,
        actual: order.amount,
        target: null,
        deviation_percent: null,
        source_records_count: 1,
        cause: order.has_defect ? 'Заказ с браком' : null,
        cause_status: order.has_defect ? 'known' : 'requires_review',
        links: [{ object_type: 'order', object_id: order.id, label: order.order_number }],
      });
    });
  } else if (groupBy === 'channel') {
    const channels = [...new Set(ctx.store.orders.map((order) => order.channel))];
    channels.forEach((channel) => {
      const orders = filterOrders(ctx.store, scope).filter((order) => order.channel === channel);
      const actual = round(orders.reduce((sum, order) => sum + order.amount, 0), 2);
      rows.push({
        key: channel,
        name: channel,
        actual,
        target: null,
        deviation_percent: null,
        source_records_count: orders.length,
        cause: null,
        cause_status: 'known',
        links: [],
      });
    });
  } else {
    const causes = [...new Set(ctx.store.production.map((record) => record.cause).filter(Boolean))] as string[];
    causes.forEach((cause) => {
      const records = ctx.store.production.filter((record) => record.cause === cause);
      rows.push({
        key: cause,
        name: cause,
        actual: records.reduce((sum, record) => sum + record.defective_quantity, 0),
        target: null,
        deviation_percent: null,
        source_records_count: records.length,
        cause,
        cause_status: 'known',
        links: [],
      });
    });
  }

  return {
    ...paginate(rows, Number(params.get('page') ?? 1), Number(params.get('page_size') ?? 20)),
    metric_code: code,
    group_by: groupBy,
    context: contextOf(scope),
  };
}

/* ------------------------------------------------------------------ sales */

export function salesSummary(params: URLSearchParams, ctx: MockContext): SalesSummary {
  const scope = resolveScope(params, ctx);
  const raw = computeRawMetrics(ctx.store, scope);
  const completed = filterOrders(ctx.store, scope);

  const channels = [...new Set(ctx.store.orders.map((order) => order.channel))].map((channel) => {
    const orders = completed.filter((order) => order.channel === channel);
    return {
      code: channel,
      name: channel,
      orders_count: orders.length,
      revenue: round(orders.reduce((sum, order) => sum + order.amount, 0), 2),
      active_customers: new Set(orders.map((order) => order.customer_id)).size,
    };
  });

  const segments = [...new Set(ctx.store.customers.map((customer) => customer.segment))].map((segment) => {
    const customerIds = new Set(ctx.store.customers.filter((customer) => customer.segment === segment).map((customer) => customer.id));
    const orders = completed.filter((order) => customerIds.has(order.customer_id));
    return {
      code: segment,
      name: segment,
      orders_count: orders.length,
      revenue: round(orders.reduce((sum, order) => sum + order.amount, 0), 2),
      active_customers: new Set(orders.map((order) => order.customer_id)).size,
    };
  });

  const deals = ctx.store.deals.filter((deal) => inRange(deal.created_at, scope.date_from, scope.date_to));
  const won = deals.filter((deal) => deal.stage === 'won').length;
  const conversion = deals.length > 0 ? round((won / deals.length) * 100, 2) : null;

  return {
    context: contextOf(scope),
    currency: 'BYN',
    revenue: raw.revenue,
    orders_count: completed.length,
    average_check: completed.length > 0 ? round(raw.revenue / completed.length, 2) : null,
    new_customers: raw.newCustomers,
    active_customers: raw.activeCustomers,
    repeat_purchase_rate: raw.repeatPurchaseRate,
    sales_plan_achievement: raw.salesPlanAchievement,
    conversion_percent: conversion,
    channels,
    segments,
    updated_at: toIso(new Date()),
  };
}

export function salesFunnel(params: URLSearchParams, ctx: MockContext): SalesFunnel {
  const scope = resolveScope(params, ctx);
  const deals = ctx.store.deals.filter((deal) => inRange(deal.created_at, scope.date_from, scope.date_to));
  const order: Array<SalesFunnel['stages'][number]['code']> = ['new', 'qualified', 'proposal', 'won'];
  const names: Record<string, string> = {
    new: 'Новая сделка',
    qualified: 'Квалифицирована',
    proposal: 'Предложение отправлено',
    won: 'Выиграна',
  };
  const counts = order.map((code) => ({
    code,
    name: names[code] ?? code,
    count: deals.filter((deal) => deal.stageIndex >= order.indexOf(code) && deal.stage !== 'lost').length,
  }));
  const stages = counts.map((stage, index) => {
    const previous = index === 0 ? stage.count : counts[index - 1]!.count;
    return {
      ...stage,
      conversion_from_previous_percent: previous > 0 ? round((stage.count / previous) * 100, 2) : null,
    };
  });
  const won = deals.filter((deal) => deal.stage === 'won').length;
  return {
    context: contextOf(scope),
    cohort_count: deals.length,
    stages,
    conversion_percent: deals.length > 0 ? round((won / deals.length) * 100, 2) : null,
    updated_at: toIso(new Date()),
  };
}

export function listDeals(params: URLSearchParams, ctx: MockContext): Paginated<unknown> {
  const scope = resolveScope(params, ctx);
  const stage = params.get('stage');
  const search = params.get('search') ?? undefined;
  const items = ctx.store.deals.filter((deal) => {
    if (stage && deal.stage !== stage) return false;
    if (!inRange(deal.created_at, scope.date_from, scope.date_to)) return false;
    return textMatch([deal.customer_name, deal.external_id], search);
  });
  const cleaned = items.map(({ stageIndex: _ignored, ...deal }) => deal);
  return paginate(cleaned, Number(params.get('page') ?? 1), Number(params.get('page_size') ?? 20));
}

/* ------------------------------------------------------------- production */

export function productionSummary(params: URLSearchParams, ctx: MockContext): ProductionSummary {
  const scope = resolveScope(params, ctx);
  const records = ctx.store.production.filter((record) => {
    if (scope.department_id && record.department_id !== scope.department_id) return false;
    if (scope.product_id && record.product_id !== scope.product_id) return false;
    return record.production_date >= scope.date_from && record.production_date <= scope.date_to;
  });

  const planned = records.reduce((sum, record) => sum + record.planned_quantity, 0);
  const actual = records.reduce((sum, record) => sum + record.actual_quantity, 0);
  const defective = records.reduce((sum, record) => sum + record.defective_quantity, 0);
  const reprint = records.reduce((sum, record) => sum + record.reprint_quantity, 0);
  const downtime = records.reduce((sum, record) => sum + record.downtime_minutes, 0);
  const actualLoad = records.reduce((sum, record) => sum + record.actual_load, 0);
  const capacity = planRows(ctx.store, scope).reduce((sum, row) => sum + row.available_hours, 0);
  const leadTime =
    records.length > 0 ? round(records.reduce((sum, record) => sum + record.lead_time_hours, 0) / records.length, 2) : null;

  const queue = ctx.store.orders.filter(
    (order) =>
      (order.production_status === 'queued' || order.production_status === 'in_progress') &&
      order.status !== 'cancelled' &&
      (!scope.department_id || order.department_id === scope.department_id) &&
      (!scope.product_id || order.product_id === scope.product_id),
  );

  return {
    context: contextOf(scope),
    planned_quantity: records.length ? planned : null,
    actual_quantity: records.length ? actual : null,
    plan_achievement_percent: planned > 0 ? round((actual / planned) * 100, 2) : null,
    queue_quantity: queue.reduce((sum, order) => sum + order.quantity, 0),
    average_lead_time_hours: leadTime,
    actual_load_hours: round(actualLoad, 2),
    available_capacity_hours: round(capacity, 2),
    capacity_utilization_percent: capacity > 0 ? round((actualLoad / capacity) * 100, 2) : null,
    downtime_minutes: downtime,
    defective_quantity: defective,
    reprint_quantity: reprint,
    defect_rate_percent: actual > 0 ? round((defective / actual) * 100, 2) : null,
    updated_at: toIso(new Date()),
  };
}

export function productionRecords(params: URLSearchParams, ctx: MockContext): Paginated<ProductionRecordInternal> {
  const scope = resolveScope(params, ctx);
  const items = ctx.store.production.filter((record) => {
    if (scope.department_id && record.department_id !== scope.department_id) return false;
    if (scope.product_id && record.product_id !== scope.product_id) return false;
    return record.production_date >= scope.date_from && record.production_date <= scope.date_to;
  });
  const sorted = sortItems(items, params.get('sort_by') ?? 'production_date', (params.get('sort_order') as 'asc' | 'desc') ?? 'desc', 'production_date');
  return paginate(sorted, Number(params.get('page') ?? 1), Number(params.get('page_size') ?? 20));
}

export function productionQueue(params: URLSearchParams, ctx: MockContext): Paginated<Order> {
  const scope = resolveScope(params, ctx);
  const items = ctx.store.orders.filter(
    (order) =>
      (order.production_status === 'queued' || order.production_status === 'in_progress') &&
      order.status !== 'cancelled' &&
      (!scope.department_id || order.department_id === scope.department_id) &&
      (!scope.product_id || order.product_id === scope.product_id),
  );
  return paginate(items, Number(params.get('page') ?? 1), Number(params.get('page_size') ?? 20));
}

/* ------------------------------------------------------------- finance/hr */

function planFact(plan: number | null, fact: number | null): PlanFactRow {
  if (plan === null || fact === null) {
    return { plan, fact, deviation: null, achievement_percent: null };
  }
  return {
    plan,
    fact,
    deviation: round(fact - plan, 2),
    achievement_percent: plan > 0 ? round((fact / plan) * 100, 2) : null,
  };
}

export function financeSummary(params: URLSearchParams, ctx: MockContext): FinanceSummary {
  const scope = resolveScope(params, ctx);
  const raw = computeRawMetrics(ctx.store, scope);
  const planRevenue = raw.revenuePlan;
  const operatingCost = round(planRevenue * 0.075, 2);
  const grossProfit = round(raw.revenue - raw.directCost, 2);
  const ignored = scope.product_id ? ['product_id'] : [];

  return {
    currency: 'BYN',
    revenue: raw.revenue,
    gross_profit: grossProfit,
    gross_margin_percent: raw.grossMargin,
    direct_cost: raw.directCost,
    operating_cost: operatingCost,
    bdr: {
      revenue: planFact(planRevenue, raw.revenue),
      direct_cost: planFact(round(planRevenue * 0.58, 2), raw.directCost),
      operating_cost: planFact(round(planRevenue * 0.075, 2), operatingCost),
      profit: planFact(round(planRevenue * 0.345, 2), round(raw.revenue - raw.directCost - operatingCost, 2)),
    },
    bdds: {
      inflow: planFact(planRevenue, round(raw.revenue * 0.96, 2)),
      outflow: planFact(round(planRevenue * 0.66, 2), round((raw.directCost + operatingCost) * 0.97, 2)),
      net: planFact(round(planRevenue * 0.3, 2), round(raw.revenue * 0.96 - (raw.directCost + operatingCost) * 0.97, 2)),
    },
    context: contextOf(scope, ignored),
    bdr_context: contextOf(scope, ignored),
    bdds_context: contextOf(scope, ignored),
    updated_at: toIso(new Date()),
  };
}

export function hrSummary(params: URLSearchParams, ctx: MockContext): HrSummary {
  const scope = resolveScope(params, ctx);
  const ignored = scope.product_id ? ['product_id'] : [];
  const snapshots = ctx.store.hrSnapshots
    .filter((snapshot) => snapshot.snapshot_date <= scope.date_to)
    .filter((snapshot) => !scope.department_id || snapshot.department_id === scope.department_id);

  const latestByDept = new Map<string, (typeof snapshots)[number]>();
  snapshots.forEach((snapshot) => {
    const current = latestByDept.get(snapshot.department_id);
    if (!current || snapshot.snapshot_date > current.snapshot_date) latestByDept.set(snapshot.department_id, snapshot);
  });
  const latest = [...latestByDept.values()];

  if (latest.length === 0) {
    return {
      context: contextOf(scope, ignored),
      planned_headcount: null,
      actual_headcount: null,
      available_headcount: null,
      required_headcount: null,
      vacancies_count: null,
      absences_count: null,
      staffing_coverage_percent: null,
      snapshot_dates: [],
      updated_at: toIso(new Date()),
    };
  }

  const planned = latest.reduce((sum, row) => sum + row.planned_headcount, 0);
  const actual = latest.reduce((sum, row) => sum + row.actual_headcount, 0);
  const available = latest.reduce((sum, row) => sum + row.available_headcount, 0);
  const required = latest.reduce((sum, row) => sum + row.required_headcount, 0);

  return {
    context: contextOf(scope, ignored),
    planned_headcount: planned,
    actual_headcount: actual,
    available_headcount: available,
    required_headcount: required,
    vacancies_count: latest.reduce((sum, row) => sum + row.vacancies_count, 0),
    absences_count: latest.reduce((sum, row) => sum + row.absences_count, 0),
    staffing_coverage_percent: required > 0 ? round((available / required) * 100, 2) : null,
    snapshot_dates: latest.map((row) => row.snapshot_date).sort(),
    updated_at: toIso(new Date()),
  };
}

/* --------------------------------------------------------------- forecast */

export function forecast(params: URLSearchParams, ctx: MockContext): ForecastResponse {
  const scope = resolveScope(params, ctx);
  const today = startOfDay(new Date());
  const nextMonday = addDays(startOfWeek(today), 7);

  const historyStart = addDays(nextMonday, -28);
  const historyOrders = ctx.store.orders.filter((order) => {
    if (order.status === 'cancelled') return false;
    if (scope.department_id && order.department_id !== scope.department_id) return false;
    if (scope.product_id && order.product_id !== scope.product_id) return false;
    return inRange(order.created_at, toDateKey(historyStart), toDateKey(addDays(nextMonday, -1)));
  });

  const weeklyDemandHours =
    historyOrders.reduce((sum, order) => sum + order.quantity * order.standard_hours_per_unit, 0) / 4;

  const items: ForecastWeek[] = [];
  for (let week = 0; week < 4; week += 1) {
    const weekStart = addDays(nextMonday, week * 7);
    const weekEnd = addDays(weekStart, 6);
    const capacityRows = ctx.store.plans.filter((row) => {
      if (row.date < toDateKey(weekStart) || row.date > toDateKey(weekEnd)) return false;
      if (scope.department_id && row.department_id !== scope.department_id) return false;
      if (scope.product_id && row.product_id !== scope.product_id) return false;
      return true;
    });
    const capacity = round(capacityRows.reduce((sum, row) => sum + row.available_hours, 0), 2);
    const demand = round(weeklyDemandHours, 2);
    const deficit = Math.max(0, round(demand - capacity, 2));
    const reserve = Math.max(0, round(capacity - demand, 2));
    items.push({
      week_start: toDateKey(weekStart),
      week_end: toDateKey(weekEnd),
      demand,
      available_capacity: capacity,
      deficit,
      reserve,
      utilization_percent: capacity > 0 ? round((demand / capacity) * 100, 2) : null,
      is_deficit: deficit > 0,
      status: deficit > 0 ? 'deficit' : 'normal',
    });
  }

  const hasHistory = historyOrders.length > 0;
  const hasCapacity = items.some((item) => (item.available_capacity ?? 0) > 0);

  if (!hasHistory || !hasCapacity) {
    return {
      status: 'no_data',
      reason: !hasHistory
        ? 'Недостаточно истории заказов за четыре полные недели'
        : 'Нет плана доступной мощности на будущие недели',
      method: null,
      unit: 'standard_hour',
      as_of: toDateKey(today),
      generated_at: toIso(new Date()),
      department_id: scope.department_id,
      product_id: scope.product_id,
      horizon_weeks: 4,
      items: items.map((item) => ({ ...item, demand: null, available_capacity: null, deficit: null, reserve: null, utilization_percent: null, status: 'no_data' as const, is_deficit: false })),
      first_deficit_week: null,
    };
  }

  const firstDeficit = items.find((item) => item.is_deficit)?.week_start ?? null;
  return {
    status: 'ready',
    reason: null,
    method: 'four_week_average',
    unit: 'standard_hour',
    as_of: toDateKey(today),
    generated_at: toIso(new Date()),
    department_id: scope.department_id,
    product_id: scope.product_id,
    horizon_weeks: 4,
    items,
    first_deficit_week: firstDeficit,
  };
}

/* ---------------------------------------------------------- data quality */

export function dataSources(params: URLSearchParams, ctx: MockContext): Paginated<DataSource> {
  const now = Date.now();
  const sources: DataSource[] = [
    {
      id: uuidFrom(0x5c, 1),
      code: 'crm',
      name: 'CRM',
      source_type: 'mock_api',
      status: 'healthy',
      last_sync_at: toIso(new Date(now - 42 * 60_000)),
      last_attempt_at: toIso(new Date(now - 42 * 60_000)),
      last_success_at: toIso(new Date(now - 42 * 60_000)),
      is_stale: false,
      records_count: ctx.store.customers.length,
      records_received: ctx.store.customers.length,
      records_inserted: ctx.store.customers.length,
      records_updated: 0,
      records_skipped: 0,
      records_failed: 0,
      missing_count: 3,
      duplicate_count: 1,
      error_count: 0,
    },
    {
      id: uuidFrom(0x5c, 2),
      code: 'erp',
      name: 'ERP / производство',
      source_type: 'mock_api',
      status: 'warning',
      last_sync_at: toIso(new Date(now - 5 * 60 * 60_000)),
      last_attempt_at: toIso(new Date(now - 5 * 60 * 60_000)),
      last_success_at: toIso(new Date(now - 5 * 60 * 60_000)),
      is_stale: false,
      records_count: ctx.store.orders.length + ctx.store.production.length,
      records_received: ctx.store.orders.length + ctx.store.production.length,
      records_inserted: ctx.store.orders.length,
      records_updated: 12,
      records_skipped: 4,
      records_failed: 2,
      missing_count: 8,
      duplicate_count: 4,
      error_count: 2,
    },
    {
      id: uuidFrom(0x5c, 3),
      code: 'finance',
      name: 'Финансы',
      source_type: 'mock_api',
      status: 'healthy',
      last_sync_at: toIso(new Date(now - 2 * 60 * 60_000)),
      last_attempt_at: toIso(new Date(now - 2 * 60 * 60_000)),
      last_success_at: toIso(new Date(now - 2 * 60 * 60_000)),
      is_stale: false,
      records_count: 180,
      records_received: 180,
      records_inserted: 176,
      records_updated: 4,
      records_skipped: 0,
      records_failed: 0,
      missing_count: 0,
      duplicate_count: 0,
      error_count: 0,
    },
    {
      id: uuidFrom(0x5c, 4),
      code: 'support',
      name: 'Поддержка',
      source_type: 'mock_api',
      status: 'error',
      last_sync_at: toIso(new Date(now - 31 * 60 * 60_000)),
      last_attempt_at: toIso(new Date(now - 40 * 60_000)),
      last_success_at: toIso(new Date(now - 31 * 60 * 60_000)),
      is_stale: true,
      records_count: ctx.store.tickets.length,
      records_received: ctx.store.tickets.length,
      records_inserted: ctx.store.tickets.length,
      records_updated: 0,
      records_skipped: 0,
      records_failed: 7,
      missing_count: 5,
      duplicate_count: 2,
      error_count: 7,
    },
    {
      id: uuidFrom(0x5c, 5),
      code: 'hr',
      name: 'HR',
      source_type: 'mock_api',
      status: 'not_loaded',
      last_sync_at: null,
      last_attempt_at: toIso(new Date(now - 26 * 60 * 60_000)),
      last_success_at: null,
      is_stale: true,
      records_count: 0,
      records_received: 0,
      records_inserted: 0,
      records_updated: 0,
      records_skipped: 0,
      records_failed: 0,
      missing_count: 0,
      duplicate_count: 0,
      error_count: 0,
    },
  ];

  const user = ctx.store.users.find((item) => item.id === ctx.userId);
  const visible = user?.role === 'director' ? sources.filter((source) => source.code !== 'hr') : sources;
  return paginate(visible, Number(params.get('page') ?? 1), Number(params.get('page_size') ?? 20));
}

export function reconciliation(params: URLSearchParams, ctx: MockContext): Reconciliation {
  const scope = resolveScope(params, ctx);
  const raw = computeRawMetrics(ctx.store, scope);
  const erp = raw.revenue;
  const finance = round(erp * 0.9965, 2);
  const difference = round(erp - finance, 2);
  const percent = erp !== 0 ? round((Math.abs(difference) / Math.abs(erp)) * 100, 4) : null;
  const status: Reconciliation['status'] =
    Math.abs(difference) < 0.01 ? 'normal' : (percent ?? 0) <= 1 ? 'warning' : 'critical';
  return {
    period: { date_from: scope.date_from, date_to: scope.date_to },
    source_a: { name: 'ERP (completed_at)', amount: erp },
    source_b: { name: 'Finance (record_date)', amount: finance },
    difference,
    difference_percent: percent,
    status,
    currency: 'BYN',
    checked_at: toIso(new Date()),
    context: contextOf(scope),
  };
}

export function dataQualityOverview(params: URLSearchParams, ctx: MockContext): DataQualityOverview {
  const sources = dataSources(new URLSearchParams({ page_size: '20' }), ctx).items;
  return {
    checked_at: toIso(new Date()),
    sources_total: sources.length,
    healthy_sources: sources.filter((source) => source.status === 'healthy').length,
    stale_sources: sources.filter((source) => source.is_stale).length,
    open_issues: 6,
    critical_issues: 2,
    reconciliation: reconciliation(params, ctx),
  };
}

export function dataQualityIssues(params: URLSearchParams): Paginated<DataQualityIssue> {
  const source = params.get('source');
  const issues: DataQualityIssue[] = [
    {
      id: uuidFrom(0x6d, 1),
      source: 'erp',
      check_type: 'duplicates',
      severity: 'medium',
      description: 'Обнаружены дубликаты заказов по external_id',
      affected_records: 4,
      status: 'open',
      department_id: null,
      checked_at: toIso(new Date(Date.now() - 3600_000)),
    },
    {
      id: uuidFrom(0x6d, 2),
      source: 'crm',
      check_type: 'missing_fields',
      severity: 'low',
      description: 'У клиентов не заполнен канал привлечения',
      affected_records: 3,
      status: 'open',
      department_id: null,
      checked_at: toIso(new Date(Date.now() - 5400_000)),
    },
    {
      id: uuidFrom(0x6d, 3),
      source: 'support',
      check_type: 'stale_source',
      severity: 'critical',
      description: 'Источник поддержки не синхронизирован более 24 часов',
      affected_records: 320,
      status: 'open',
      department_id: null,
      checked_at: toIso(new Date(Date.now() - 1800_000)),
    },
    {
      id: uuidFrom(0x6d, 4),
      source: 'finance',
      check_type: 'financial_reconciliation',
      severity: 'medium',
      description: 'Расхождение финансовой сверки превышает 0.1%',
      affected_records: 1,
      status: 'open',
      department_id: null,
      checked_at: toIso(new Date(Date.now() - 7200_000)),
    },
    {
      id: uuidFrom(0x6d, 5),
      source: 'hr',
      check_type: 'stale_source',
      severity: 'critical',
      description: 'Источник HR не загружался: отсутствует успешная синхронизация',
      affected_records: 0,
      status: 'open',
      department_id: null,
      checked_at: toIso(new Date(Date.now() - 9000_000)),
    },
    {
      id: uuidFrom(0x6d, 6),
      source: 'erp',
      check_type: 'broken_relations',
      severity: 'high',
      description: 'Производственные записи ссылаются на отсутствующие заказы',
      affected_records: 2,
      status: 'resolved',
      department_id: null,
      checked_at: toIso(new Date(Date.now() - 86_400_000)),
    },
  ];
  const filtered = source ? issues.filter((issue) => issue.source === source) : issues;
  return paginate(filtered, Number(params.get('page') ?? 1), Number(params.get('page_size') ?? 20));
}

export function runQualityCheck(ctx: MockContext): { run_id: string; checked_at: string; checks_run: number; issues_opened: number; issues_resolved: number } {
  const user = ctx.store.users.find((item) => item.id === ctx.userId);
  if (!user || !['admin', 'analyst'].includes(user.role)) {
    throw new MockHttpError(403, 'AUTH_FORBIDDEN', 'Запуск проверки доступен администратору и аналитику');
  }
  pushAudit(ctx, {
    action: 'data_quality.check',
    object_type: 'source',
    object_id: null,
    object_name: 'Проверка качества данных',
    old_values: null,
    new_values: { checks_run: 6 },
  });
  bumpRevision();
  return {
    run_id: newUuid(),
    checked_at: toIso(new Date()),
    checks_run: 6,
    issues_opened: 0,
    issues_resolved: 0,
  };
}

export function importSource(code: string, ctx: MockContext) {
  const user = ctx.store.users.find((item) => item.id === ctx.userId);
  if (user?.role !== 'admin') {
    throw new MockHttpError(403, 'AUTH_FORBIDDEN', 'Импорт доступен только администратору');
  }
  pushAudit(ctx, {
    action: 'integration.import',
    object_type: 'source',
    object_id: null,
    object_name: `Импорт источника ${code}`,
    old_values: null,
    new_values: { source: code },
  });
  bumpRevision();
  return {
    run_id: newUuid(),
    status: 'success' as const,
    received: 120,
    inserted: 118,
    updated: 2,
    skipped: 0,
    failed: 0,
    errors_total: 0,
    recalculation_status: 'success' as const,
  };
}

/* ------------------------------------------------------------------ audit */

export function listAuditLogs(params: URLSearchParams, ctx: MockContext): Paginated<AuditLog> {
  const user = ctx.store.users.find((item) => item.id === ctx.userId);
  if (!user || !['admin', 'director'].includes(user.role)) {
    throw new MockHttpError(403, 'AUTH_FORBIDDEN', 'Журнал действий доступен только администратору и директору');
  }
  const action = params.get('action');
  const objectType = params.get('object_type');
  const status = params.get('status');
  const userId = params.get('user_id');
  const search = params.get('search') ?? undefined;
  const items = ctx.store.auditLogs.filter((log) => {
    if (action && log.action !== action) return false;
    if (objectType && log.object_type !== objectType) return false;
    if (status && log.status !== status) return false;
    if (userId && log.user_id !== userId) return false;
    return textMatch([log.object_name, log.object_id, log.action], search);
  });
  const sorted = [...items].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return paginate(sorted, Number(params.get('page') ?? 1), Number(params.get('page_size') ?? 20));
}

export function getAuditLog(id: string, ctx: MockContext): AuditLog {
  const user = ctx.store.users.find((item) => item.id === ctx.userId);
  if (!user || !['admin', 'director'].includes(user.role)) {
    throw new MockHttpError(403, 'AUTH_FORBIDDEN', 'Журнал действий доступен только администратору и директору');
  }
  const log = ctx.store.auditLogs.find((item) => item.id === id);
  if (!log) throw new MockHttpError(404, 'RESOURCE_NOT_FOUND', 'Запись аудита не найдена');
  return log;
}

function pushAudit(
  ctx: MockContext,
  entry: {
    action: string;
    object_type: string;
    object_id: string | null;
    object_name: string | null;
    old_values: Record<string, unknown> | null;
    new_values: Record<string, unknown> | null;
  },
) {
  const user = ctx.store.users.find((item) => item.id === ctx.userId);
  ctx.store.auditLogs.unshift({
    id: newUuid(),
    user_id: user?.id ?? null,
    actor: user ? { id: user.id, full_name: user.full_name } : null,
    actor_type: user ? 'user' : 'system',
    action: entry.action,
    object_type: entry.object_type,
    object_id: entry.object_id,
    object_name: entry.object_name,
    old_values: entry.old_values,
    new_values: entry.new_values,
    details: { source: 'ui' },
    ip_address: '127.0.0.1',
    user_agent: typeof navigator === 'undefined' ? 'server' : navigator.userAgent,
    status: 'success',
    error_message: null,
    request_id: newUuid(),
    created_at: toIso(new Date()),
  });
}

/* ------------------------------------------------------------------ users */

export function listUsers(params: URLSearchParams, ctx: MockContext): Paginated<unknown> {
  const user = ctx.store.users.find((item) => item.id === ctx.userId);
  if (!user) throw new MockHttpError(401, 'AUTH_TOKEN_EXPIRED', 'Требуется авторизация');
  const search = params.get('search') ?? undefined;
  const role = params.get('role');
  const isActive = params.get('is_active');
  const departmentId = params.get('department_id');

  const filtered = ctx.store.users.filter((item) => {
    if (role && item.role !== role) return false;
    if (isActive !== null && isActive !== undefined && isActive !== '' && String(item.is_active) !== isActive) return false;
    if (departmentId && item.department_id !== departmentId) return false;
    return textMatch([item.full_name, item.email], search);
  });

  if (user.role === 'admin') {
    const items = filtered.map(({ password: _password, ...rest }) => rest);
    return paginate(items, Number(params.get('page') ?? 1), Number(params.get('page_size') ?? 20));
  }

  if (!['director', 'manager', 'analyst'].includes(user.role)) {
    throw new MockHttpError(403, 'AUTH_FORBIDDEN', 'Список пользователей недоступен');
  }

  const scoped = filtered.filter((item) => {
    if (!item.is_active) return false;
    if (user.role === 'manager') {
      return item.department_id === user.department_id || ['admin', 'director'].includes(item.role);
    }
    return true;
  });

  const assignees = scoped.map((item) => ({
    id: item.id,
    full_name: item.full_name,
    role: item.role,
    department_id: item.department_id,
  }));
  return paginate(assignees, Number(params.get('page') ?? 1), Number(params.get('page_size') ?? 100));
}

export function createUser(
  body: { email: string; full_name: string; role: string; department_id: string | null; temporary_password: string },
  ctx: MockContext,
) {
  const actor = ctx.store.users.find((item) => item.id === ctx.userId);
  if (actor?.role !== 'admin') throw new MockHttpError(403, 'AUTH_FORBIDDEN', 'Управление пользователями доступно администратору');
  const fields: Record<string, string> = {};
  if (!body.full_name?.trim()) fields.full_name = 'Поле обязательно';
  if (!body.email?.includes('@')) fields.email = 'Некорректный email';
  if (!body.temporary_password || body.temporary_password.length < 12) fields.temporary_password = 'Минимум 12 символов';
  if (['manager', 'employee'].includes(body.role) && !body.department_id) fields.department_id = 'Обязательно для роли';
  if (Object.keys(fields).length > 0) {
    throw new MockHttpError(422, 'VALIDATION_ERROR', 'Проверьте корректность введённых данных', fields);
  }
  if (ctx.store.users.some((item) => item.email.toLowerCase() === body.email.toLowerCase())) {
    throw new MockHttpError(409, 'DUPLICATE_RESOURCE', 'Пользователь с таким email уже существует');
  }
  const now = new Date();
  const created = {
    id: newUuid(),
    email: body.email,
    password: body.temporary_password,
    full_name: body.full_name,
    role: body.role as never,
    department_id: body.department_id,
    is_active: true,
    created_at: toIso(now),
    updated_at: toIso(now),
  };
  ctx.store.users.push(created);
  pushAudit(ctx, {
    action: 'user.created',
    object_type: 'user',
    object_id: created.id,
    object_name: created.full_name,
    old_values: null,
    new_values: { role: created.role, email: created.email },
  });
  bumpRevision();
  const { password: _password, ...rest } = created;
  return rest;
}

export function patchUser(
  id: string,
  body: { full_name?: string; role?: string; department_id?: string | null; is_active?: boolean },
  ctx: MockContext,
) {
  const actor = ctx.store.users.find((item) => item.id === ctx.userId);
  if (actor?.role !== 'admin') throw new MockHttpError(403, 'AUTH_FORBIDDEN', 'Управление пользователями доступно администратору');
  const target = ctx.store.users.find((item) => item.id === id);
  if (!target) throw new MockHttpError(404, 'RESOURCE_NOT_FOUND', 'Пользователь не найден');
  if (target.id === actor.id && (body.role || body.is_active === false)) {
    throw new MockHttpError(409, 'INVALID_STATUS_TRANSITION', 'Нельзя изменить свою роль или активность');
  }
  if (body.is_active === false) {
    const activeAdmins = ctx.store.users.filter((item) => item.role === 'admin' && item.is_active);
    if (target.role === 'admin' && activeAdmins.length <= 1) {
      throw new MockHttpError(409, 'INVALID_STATUS_TRANSITION', 'Нельзя деактивировать последнего администратора');
    }
  }
  const oldValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};
  if (body.full_name && body.full_name !== target.full_name) {
    oldValues.full_name = target.full_name;
    newValues.full_name = body.full_name;
    target.full_name = body.full_name;
  }
  if (body.role && body.role !== target.role) {
    oldValues.role = target.role;
    newValues.role = body.role;
    target.role = body.role as never;
  }
  if (body.department_id !== undefined && body.department_id !== target.department_id) {
    oldValues.department_id = target.department_id;
    newValues.department_id = body.department_id;
    target.department_id = body.department_id;
  }
  if (body.is_active !== undefined && body.is_active !== target.is_active) {
    oldValues.is_active = target.is_active;
    newValues.is_active = body.is_active;
    target.is_active = body.is_active;
  }
  target.updated_at = toIso(new Date());
  if (Object.keys(newValues).length > 0) {
    pushAudit(ctx, {
      action: 'user.updated',
      object_type: 'user',
      object_id: target.id,
      object_name: target.full_name,
      old_values: oldValues,
      new_values: newValues,
    });
    bumpRevision();
  }
  const { password: _password, ...rest } = target;
  return rest;
}

/* ------------------------------------------------------------- analytics */

export function metabaseEmbed(ctx: MockContext): { embed_url: string; expires_at: string } {
  const user = ctx.store.users.find((item) => item.id === ctx.userId);
  if (!user || user.role === 'employee') {
    throw new MockHttpError(403, 'AUTH_FORBIDDEN', 'BI-аналитика недоступна для роли «Сотрудник»');
  }
  return {
    embed_url: 'about:blank#metabase-demo',
    expires_at: toIso(new Date(Date.now() + 5 * 60_000)),
  };
}

/* -------------------------------------------------------------- auth mock */

export function login(email: string, password: string, ctx: MockContext) {
  const user = ctx.store.users.find((item) => item.email.toLowerCase() === email.trim().toLowerCase());
  if (!user || user.password !== password) {
    pushAudit(ctx, {
      action: 'auth.login',
      object_type: 'session',
      object_id: null,
      object_name: email,
      old_values: null,
      new_values: { result: 'failure' },
    });
    throw new MockHttpError(401, 'AUTH_INVALID_CREDENTIALS', 'Неверный email или пароль');
  }
  if (!user.is_active) {
    throw new MockHttpError(403, 'AUTH_FORBIDDEN', 'Учётная запись деактивирована');
  }
  ctx.userId = user.id;
  pushAudit(ctx, {
    action: 'auth.login',
    object_type: 'session',
    object_id: null,
    object_name: user.full_name,
    old_values: null,
    new_values: { result: 'success' },
  });
  return {
    access_token: `mock.${user.id}.${Date.now()}`,
    token_type: 'bearer' as const,
    expires_in: 900,
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      department_id: user.department_id,
      is_active: user.is_active,
    },
  };
}

export function currentUser(ctx: MockContext) {
  const user = ctx.store.users.find((item) => item.id === ctx.userId);
  if (!user) throw new MockHttpError(401, 'AUTH_TOKEN_EXPIRED', 'Сессия истекла');
  return {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    department_id: user.department_id,
    is_active: user.is_active,
  };
}

export function userIdFromToken(token: string | null): string | null {
  if (!token) return null;
  const parts = token.split('.');
  return parts.length >= 2 ? parts[1] ?? null : null;
}

export function seedUserId(): string {
  return uuidFrom(0x11, 2);
}

export function supportTickets(params: URLSearchParams, ctx: MockContext): Paginated<SupportTicket> {
  const scope = resolveScope(params, ctx);
  const items = ctx.store.tickets.filter((ticket) => {
    if (scope.department_id && ticket.department_id !== scope.department_id) return false;
    return inRange(ticket.created_at, scope.date_from, scope.date_to);
  });
  return paginate(items, Number(params.get('page') ?? 1), Number(params.get('page_size') ?? 20));
}

export function supportStats(ctx: MockContext) {
  const closed = ctx.store.tickets.filter((ticket) => ticket.status === 'closed');
  const withSla = closed.filter((ticket) => ticket.sla_deadline);
  const withinSla = withSla.filter((ticket) => ticket.resolved_within_sla).length;
  return {
    total: ctx.store.tickets.length,
    closed: closed.length,
    open: ctx.store.tickets.length - closed.length,
    sla_percent: withSla.length > 0 ? round((withinSla / withSla.length) * 100, 2) : null,
  };
}

export function systemHealth() {
  return {
    status: 'ok' as const,
    database: 'connected' as const,
    version: '1.2.0-mock',
  };
}

export function recalculateMetrics(params: URLSearchParams, ctx: MockContext) {
  const user = ctx.store.users.find((item) => item.id === ctx.userId);
  if (user?.role !== 'admin') throw new MockHttpError(403, 'AUTH_FORBIDDEN', 'Пересчёт KPI доступен администратору');
  const scope = resolveScope(params, ctx);
  const kpis = computeKpis(scope, ctx);
  pushAudit(ctx, {
    action: 'metrics.recalculate',
    object_type: 'metric',
    object_id: null,
    object_name: 'Пересчёт KPI',
    old_values: null,
    new_values: { metric_values_updated: kpis.length },
  });
  bumpRevision();
  return {
    calculated_at: toIso(new Date()),
    metric_values_updated: kpis.length,
    alerts_created: 0,
    alerts_updated: 0,
  };
}

