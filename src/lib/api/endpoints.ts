// backend wiring
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
import { http, createIdempotencyKey, USE_MOCKS } from './client';
import { adaptGraph, adaptNode, adaptAnalysis, graphParams, businessContext, type ServerGraph, type ServerNodeDetail, type ServerAnalysis } from './impact-adapter';
import { readAllPages } from './pagination';
import { adaptDecision, adaptTask, withDeadline, selectParams, type ServerDecision, type ServerTask } from './workflow-adapter';

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
  planned_capacity: number | null;
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
  async get(params?: Params) {
    if (USE_MOCKS) return http.get<{ data: DashboardResponse }>('/dashboard', { params });
    const response = await http.get<{ data: Omit<DashboardResponse, 'recent_decisions' | 'recent_tasks'> & { recent_decisions: ServerDecision[]; recent_tasks: ServerTask[] } }>('/dashboard', { params });
    return { data: { ...response.data, recent_decisions: response.data.recent_decisions.map(adaptDecision), recent_tasks: response.data.recent_tasks.map(adaptTask) } };
  },
};

export const metricsApi = {
  list(params?: Params) {
    return http.get<Paginated<Kpi>>('/metrics', { params });
  },
  get(code: string, params?: Params) {
    return http.get<{ data: Kpi }>(`/metrics/${code}`, { params });
  },
  async history(code: string, params?: Params) {
    if (USE_MOCKS) return http.get<MetricHistoryResponse>(`/metrics/${code}/history`, { params });
    return readAllPages<MetricHistoryResponse['items'][number]>(`/metrics/${code}/history`, params);
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
  async get(id: string) {
    if (USE_MOCKS) return http.get<{ data: Customer & { orders: Order[] } }>(`/customers/${id}`);
    const response = await http.get<{ data: { customer: Customer; orders_url: string } }>(`/customers/${id}`);
    const orders = await readAllPages<Order>('/orders', { customer_id: id });
    return { data: { ...response.data.customer, orders: orders.items } };
  },
};

export const catalogApi = {
  async products() {
    if (USE_MOCKS) return http.get<{ data: Product[] }>('/products');
    return { data: (await readAllPages<Product>('/products')).items };
  },
  async departments() {
    if (USE_MOCKS) return http.get<{ data: Department[] }>('/departments');
    return { data: (await readAllPages<Department>('/departments')).items };
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
  async records(params?: Params) {
    if (USE_MOCKS) return http.get<Paginated<ProductionRecordDto>>('/production/records', { params });
    const response = await http.get<Paginated<Omit<ProductionRecordDto, 'actual_load'> & { actual_load_hours: number }>>('/production/records', { params });
    return { ...response, items: response.items.map((item) => ({ ...item, actual_load: item.actual_load_hours })) };
  },
  queue(params?: Params) {
    return http.get<Paginated<Order>>('/production/queue', { params: USE_MOCKS ? params : selectParams(params, ['department_id', 'product_id', 'page', 'page_size']) });
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
    return http.get<{ data: ForecastResponse }>('/forecast', { params: USE_MOCKS ? params : selectParams(params, ['department_id', 'product_id', 'weeks']) });
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
  updateStatus(id: string, status: AlertStatus, comment?: string) {
    return http.patch<{ data: Alert }>(`/alerts/${id}`, { body: { status, ...(comment ? { comment } : {}) } });
  },
};

export const decisionsApi = {
  async list(params?: Params) {
    if (USE_MOCKS) return http.get<Paginated<Decision>>('/decisions', { params });
    const response = await http.get<Paginated<ServerDecision>>('/decisions', { params });
    return { ...response, items: response.items.map(adaptDecision) };
  },
  async get(id: string) {
    if (USE_MOCKS) return http.get<{ data: Decision }>(`/decisions/${id}`);
    const response = await http.get<{ data: ServerDecision }>(`/decisions/${id}`);
    return { data: adaptDecision(response.data) };
  },
  history(id: string, params?: Params) {
    return http.get<Paginated<ChangeEvent>>(`/decisions/${id}/history`, { params });
  },
  async create(body: Record<string, unknown>, idempotencyKey = createIdempotencyKey()) {
    const response = await http.post<{ data: ServerDecision & Decision }>('/decisions', {
      body: USE_MOCKS ? body : withDeadline(body),
      headers: { 'Idempotency-Key': idempotencyKey },
    });
    return { data: USE_MOCKS ? response.data : adaptDecision(response.data) };
  },
  async update(id: string, body: Record<string, unknown>) {
    const response = await http.patch<{ data: ServerDecision & Decision }>(`/decisions/${id}`, { body: USE_MOCKS ? body : withDeadline(body) });
    return { data: USE_MOCKS ? response.data : adaptDecision(response.data) };
  },
};

export const tasksApi = {
  async list(params?: Params) {
    if (USE_MOCKS) return http.get<Paginated<Task>>('/tasks', { params });
    const response = await http.get<Paginated<ServerTask>>('/tasks', { params });
    return { ...response, items: response.items.map(adaptTask) };
  },
  async get(id: string) {
    if (USE_MOCKS) return http.get<{ data: Task }>(`/tasks/${id}`);
    const response = await http.get<{ data: ServerTask }>(`/tasks/${id}`);
    return { data: adaptTask(response.data) };
  },
  history(id: string, params?: Params) {
    return http.get<Paginated<ChangeEvent>>(`/tasks/${id}/history`, { params });
  },
  async create(body: Record<string, unknown>, idempotencyKey = createIdempotencyKey()) {
    const response = await http.post<{ data: ServerTask & Task }>('/tasks', {
      body: USE_MOCKS ? body : withDeadline(body),
      headers: { 'Idempotency-Key': idempotencyKey },
    });
    return { data: USE_MOCKS ? response.data : adaptTask(response.data) };
  },
  async update(id: string, body: { version: number; status?: TaskStatus } & Record<string, unknown>) {
    const response = await http.patch<{ data: ServerTask & Task }>(`/tasks/${id}`, { body: USE_MOCKS ? body : withDeadline(body) });
    return { data: USE_MOCKS ? response.data : adaptTask(response.data) };
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
    return http.get<{ data: DataQualityOverview }>('/data-quality/overview', { params: USE_MOCKS ? params : undefined });
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

/** Adapt the server contract to the existing map screen; no visual changes. */
export const impactMapApi = {
  async get(params?: Params) {
    if (USE_MOCKS) return http.get<{ data: ImpactGraph }>('/impact-map', { params });
    const response = await http.get<{ data: ServerGraph }>('/impact-map', { params });
    return { data: adaptGraph(response.data) };
  },
  async node(id: string, params?: Params) {
    if (USE_MOCKS) return http.get<{ data: ImpactNode }>(`/impact-map/nodes/${id}`, { params });
    const response = await http.get<{ data: ServerNodeDetail }>(`/impact-map/nodes/${id}`, { params });
    return { data: adaptNode(response.data.node) };
  },
  async neighbors(id: string, params?: Params) {
    if (USE_MOCKS) return http.get<{ data: ImpactGraph }>(`/impact-map/nodes/${id}/neighbors`, { params });
    const response = await http.get<{ data: ServerGraph }>(`/impact-map/nodes/${id}/neighbors`, { params: graphParams(params) });
    return { data: adaptGraph(response.data, { nodeId: id, depth: Number(params?.depth ?? 1) }) };
  },
  async path(params: { from_node_id: string; to_node_id: string; depth: number; direction: string } & Record<string, unknown>) {
    if (USE_MOCKS) return http.get<{ data: ImpactPath }>('/impact-map/paths', { params });
    const response = await http.get<{ data: ServerGraph }>('/impact-map/paths', { params: graphParams(params) });
    const graph = adaptGraph(response.data);
    return { data: { ...graph, found: graph.nodes.some((node) => node.id === params.to_node_id) } };
  },
  async analyze(body: { metric_code: string; graph_revision: string; context: Record<string, unknown> }, requestKey = createIdempotencyKey()) {
    if (USE_MOCKS) return http.post<{ data: ImpactAnalysis }>('/impact-map/analyze', { body });
    const response = await http.post<{ data: ServerAnalysis }>('/impact-map/analyze', {
      body: { ...body, request_key: requestKey, context: businessContext(body.context) },
      timeout: 120_000,
    });
    return { data: adaptAnalysis(response.data) };
  },
};
