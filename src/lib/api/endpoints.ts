import type {
  Alert,
  AlertDetail,
  AlertStatus,
  AuditLog,
  AuthUser,
  ChangeEvent,
  Customer,
  DashboardResponse,
  DataQualityIssue,
  DataQualityOverview,
  DataSource,
  Decision,
  Department,
  FinanceSummary,
  ForecastResponse,
  HrSummary,
  Kpi,
  ListParams,
  LoginResponse,
  MetabaseEmbed,
  MetricBreakdownResponse,
  MetricHistoryResponse,
  Order,
  OrderEvent,
  Paginated,
  Product,
  ProductionSummary,
  Reconciliation,
  SalesFunnel,
  SalesSummary,
  Task,
  TaskStatus,
  User,
} from '@/types/api';
import type { ImpactAnalysis, ImpactGraph, ImpactNode, ImpactPath } from '@/features/impact-map/types';
import { http, createIdempotencyKey } from './client';

export interface ProductionRecordDto {
  id: string;
  external_id: string;
  order_id: string | null;
  product_id: string;
  product_name: string;
  department_id: string;
  department_name: string;
  production_date: string;
  planned_quantity: number;
  actual_quantity: number;
  defective_quantity: number;
  reprint_quantity: number;
  queue_quantity: number;
  downtime_minutes: number;
  planned_capacity: number;
  actual_load: number;
  lead_time_hours: number;
  cause: string | null;
}

export interface DealDto {
  id: string;
  external_id: string;
  customer_id: string;
  customer_name: string;
  product_id: string | null;
  department_id: string;
  campaign_id: string | null;
  channel: string;
  segment: string;
  stage: 'new' | 'qualified' | 'proposal' | 'won' | 'lost';
  expected_amount: number;
  currency: 'BYN';
  order_id: string | null;
  created_at: string;
  updated_at: string;
}

type Params = Record<string, unknown> | ListParams | undefined;

export const authApi = {
  login(email: string, password: string) {
    return http.post<{ data: LoginResponse }>('/auth/login', { body: { email, password } });
  },
  refresh() {
    return http.post<{ data: { access_token: string; token_type: string; expires_in: number } }>('/auth/refresh');
  },
  me() {
    return http.get<{ data: AuthUser }>('/auth/me');
  },
  logout() {
    return http.post<{ data: { success: boolean } }>('/auth/logout');
  },
};

export const dashboardApi = {
  get(params?: Params) {
    return http.get<{ data: DashboardResponse }>('/dashboard', { params });
  },
};

export const metricsApi = {
  list(params?: Params) {
    return http.get<Paginated<Kpi>>('/metrics', { params });
  },
  get(code: string, params?: Params) {
    return http.get<{ data: Kpi }>(`/metrics/${code}`, { params });
  },
  history(code: string, params?: Params) {
    return http.get<MetricHistoryResponse>(`/metrics/${code}/history`, { params });
  },
  breakdown(code: string, params?: Params) {
    return http.get<MetricBreakdownResponse>(`/metrics/${code}/breakdown`, { params });
  },
  recalculate(params?: Params) {
    return http.post<{ data: { calculated_at: string; metric_values_updated: number; alerts_created: number; alerts_updated: number } }>(
      '/metrics/recalculate',
      { params },
    );
  },
};

export const ordersApi = {
  list(params?: Params) {
    return http.get<Paginated<Order>>('/orders', { params });
  },
  get(id: string) {
    return http.get<{ data: Order }>(`/orders/${id}`);
  },
  events(id: string, params?: Params) {
    return http.get<Paginated<OrderEvent>>(`/orders/${id}/events`, { params });
  },
  update(id: string, body: Record<string, unknown>) {
    return http.patch<{ data: Order }>(`/orders/${id}`, { body });
  },
};

export const customersApi = {
  list(params?: Params) {
    return http.get<Paginated<Customer>>('/customers', { params });
  },
  get(id: string) {
    return http.get<{ data: Customer & { orders: Order[] } }>(`/customers/${id}`);
  },
};

export const catalogApi = {
  products() {
    return http.get<{ data: Product[] }>('/products');
  },
  departments() {
    return http.get<{ data: Department[] }>('/departments');
  },
};

export const salesApi = {
  summary(params?: Params) {
    return http.get<{ data: SalesSummary }>('/sales/summary', { params });
  },
  funnel(params?: Params) {
    return http.get<{ data: SalesFunnel }>('/sales/funnel', { params });
  },
  deals(params?: Params) {
    return http.get<Paginated<DealDto>>('/sales/deals', { params });
  },
};

export const productionApi = {
  summary(params?: Params) {
    return http.get<{ data: ProductionSummary }>('/production/summary', { params });
  },
  records(params?: Params) {
    return http.get<Paginated<ProductionRecordDto>>('/production/records', { params });
  },
  queue(params?: Params) {
    return http.get<Paginated<Order>>('/production/queue', { params });
  },
};

export const financeApi = {
  summary(params?: Params) {
    return http.get<{ data: FinanceSummary }>('/finance/summary', { params });
  },
  hrSummary(params?: Params) {
    return http.get<{ data: HrSummary }>('/hr/summary', { params });
  },
};

export const forecastApi = {
  get(params?: Params) {
    return http.get<{ data: ForecastResponse }>('/forecast', { params });
  },
};

export const alertsApi = {
  list(params?: Params) {
    return http.get<Paginated<Alert>>('/alerts', { params });
  },
  get(id: string) {
    return http.get<{ data: AlertDetail }>(`/alerts/${id}`);
  },
  history(id: string, params?: Params) {
    return http.get<Paginated<ChangeEvent>>(`/alerts/${id}/history`, { params });
  },
  updateStatus(id: string, status: AlertStatus) {
    return http.patch<{ data: Alert }>(`/alerts/${id}`, { body: { status } });
  },
};

export const decisionsApi = {
  list(params?: Params) {
    return http.get<Paginated<Decision>>('/decisions', { params });
  },
  get(id: string) {
    return http.get<{ data: Decision }>(`/decisions/${id}`);
  },
  history(id: string, params?: Params) {
    return http.get<Paginated<ChangeEvent>>(`/decisions/${id}/history`, { params });
  },
  create(body: Record<string, unknown>, idempotencyKey = createIdempotencyKey()) {
    return http.post<{ data: Decision }>('/decisions', {
      body,
      headers: { 'Idempotency-Key': idempotencyKey },
    });
  },
  update(id: string, body: Record<string, unknown>) {
    return http.patch<{ data: Decision }>(`/decisions/${id}`, { body });
  },
};

export const tasksApi = {
  list(params?: Params) {
    return http.get<Paginated<Task>>('/tasks', { params });
  },
  get(id: string) {
    return http.get<{ data: Task }>(`/tasks/${id}`);
  },
  history(id: string, params?: Params) {
    return http.get<Paginated<ChangeEvent>>(`/tasks/${id}/history`, { params });
  },
  create(body: Record<string, unknown>, idempotencyKey = createIdempotencyKey()) {
    return http.post<{ data: Task }>('/tasks', {
      body,
      headers: { 'Idempotency-Key': idempotencyKey },
    });
  },
  update(id: string, body: { version: number; status?: TaskStatus } & Record<string, unknown>) {
    return http.patch<{ data: Task }>(`/tasks/${id}`, { body });
  },
  archive(id: string) {
    return http.delete<null>(`/tasks/${id}`);
  },
};

export const dataQualityApi = {
  sources(params?: Params) {
    return http.get<Paginated<DataSource>>('/data-quality/sources', { params });
  },
  overview(params?: Params) {
    return http.get<{ data: DataQualityOverview }>('/data-quality/overview', { params });
  },
  issues(params?: Params) {
    return http.get<Paginated<DataQualityIssue>>('/data-quality/issues', { params });
  },
  reconciliation(params?: Params) {
    return http.get<{ data: Reconciliation }>('/data-quality/reconciliation', { params });
  },
  runCheck() {
    return http.post<{ data: { run_id: string; checked_at: string; checks_run: number; issues_opened: number; issues_resolved: number } }>(
      '/data-quality/check',
    );
  },
  importSource(code: string) {
    return http.post<{ data: Record<string, unknown> }>(`/integrations/${code}/import`);
  },
};

export const auditLogsApi = {
  list(params?: Params) {
    return http.get<Paginated<AuditLog>>('/audit-logs', { params });
  },
  get(id: string) {
    return http.get<{ data: AuditLog }>(`/audit-logs/${id}`);
  },
};

export interface AssigneeDto {
  id: string;
  full_name: string;
  role: User['role'];
  department_id: string | null;
}

export const usersApi = {
  /** admin получает полный User, остальные роли — сокращённый Assignee. */
  list(params?: Params) {
    return http.get<Paginated<User | AssigneeDto>>('/users', { params });
  },
  create(body: Record<string, unknown>) {
    return http.post<{ data: User }>('/users', { body });
  },
  update(id: string, body: Record<string, unknown>) {
    return http.patch<{ data: User }>(`/users/${id}`, { body });
  },
};

export const analyticsApi = {
  metabaseEmbed(params?: Params) {
    return http.get<{ data: MetabaseEmbed }>('/analytics/metabase-embed', { params });
  },
};

/** Business Impact Map endpoints from the v2 extension contract. */
export const impactMapApi = {
  get(params?: Params) {
    return http.get<{ data: ImpactGraph }>('/impact-map', { params });
  },
  node(id: string, params?: Params) {
    return http.get<{ data: ImpactNode }>(`/impact-map/nodes/${id}`, { params });
  },
  neighbors(id: string, params?: Params) {
    return http.get<{ data: ImpactGraph }>(`/impact-map/nodes/${id}/neighbors`, { params });
  },
  path(params: { from_node_id: string; to_node_id: string; depth: number; direction: string } & Record<string, unknown>) {
    return http.get<{ data: ImpactPath }>('/impact-map/paths', { params });
  },
  analyze(body: { metric_code: string; graph_revision: string; context: Record<string, unknown> }) {
    return http.post<{ data: ImpactAnalysis }>('/impact-map/analyze', {
      body,
      headers: { 'Idempotency-Key': createIdempotencyKey() },
    });
  },
};
