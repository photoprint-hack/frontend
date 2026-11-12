/* Типы соответствуют API-контракту 1.2 (snake_case, UTC ISO, {data}/{items}). */

export type Role = 'admin' | 'director' | 'manager' | 'analyst' | 'employee';

export type MetricStatus = 'normal' | 'warning' | 'critical' | 'no_data';

export type Priority = 'low' | 'medium' | 'high' | 'critical';

export type DecisionStatus = 'new' | 'in_progress' | 'needs_review' | 'completed' | 'cancelled';
export type TaskStatus = 'new' | 'in_progress' | 'completed' | 'cancelled';
export type AlertStatus = 'active' | 'acknowledged' | 'resolved';
export type OrderStatus = 'new' | 'in_progress' | 'completed' | 'cancelled';
export type ModerationStatus = 'pending' | 'approved' | 'rejected' | 'revision_required';
export type ProductionStatus = 'queued' | 'in_progress' | 'completed' | 'blocked';
export type DeliveryStatus = 'not_started' | 'in_transit' | 'delivered' | 'delayed' | 'returned';

export interface ApiErrorDetail {
  code: string;
  message: string;
  fields?: Record<string, string>;
  request_id?: string;
}

export interface ApiEnvelope<T> {
  data: T;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  department_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Assignee {
  id: string;
  full_name: string;
  role: Role;
  department_id: string | null;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  external_id: string;
  name: string;
  segment: string;
  source: string;
  customer_type: 'b2b' | 'b2c';
  acquisition_channel: string;
  first_order_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  external_id: string | null;
  code: string;
  name: string;
  category: string;
  standard_price: number;
  currency: 'BYN';
  standard_hours_per_unit: number;
  is_active: boolean;
  created_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  customer_name: string;
  product_id: string;
  product_name: string;
  department_id: string;
  department_name: string;
  amount: number;
  currency: 'BYN';
  status: OrderStatus;
  channel: string;
  quantity: number;
  standard_hours_per_unit: number;
  created_at: string;
  due_at: string;
  completed_at: string | null;
  updated_at: string;
  has_defect: boolean;
  source_system: string;
  moderation_status: ModerationStatus;
  production_status: ProductionStatus;
  delivery_status: DeliveryStatus;
  campaign_id: string | null;
  crm_deal_id: string | null;
  version: number;
  allowed_actions: string[];
}

export interface OrderEvent {
  id: string;
  order_id: string;
  event_type: string;
  result: string;
  occurred_at: string;
  source_system: string;
  old_status: string | null;
  new_status: string | null;
  actor: { id: string; full_name: string } | null;
  department_id: string | null;
  description: string | null;
  cause: string | null;
  created_at: string;
}

export interface MetricContext {
  date_from: string;
  date_to: string;
  timezone: string;
  department_id: string | null;
  product_id: string | null;
  ignored_filters: string[];
}

export interface Kpi {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string;
  unit: string;
  direction: 'higher_is_better' | 'lower_is_better' | 'range' | 'none';
  actual: number | null;
  target: number | null;
  forecast: number | null;
  achievement_percent: number | null;
  deviation_percent: number | null;
  status: MetricStatus;
  currency: 'BYN' | null;
  source: string[];
  formula: string;
  formula_version: string;
  forecast_method: string | null;
  reason_code: string | null;
  reason: string | null;
  source_updated_at: string | null;
  updated_at: string | null;
  context: MetricContext;
  notices: string[];
  supported_group_by: string[];
}

export interface MetricHistoryPoint {
  period_start: string;
  period_end: string;
  actual: number | null;
  target: number | null;
  forecast: number | null;
  status: MetricStatus;
  updated_at: string | null;
}

export interface MetricHistoryResponse extends Paginated<MetricHistoryPoint> {
  metric_code: string;
  context: MetricContext;
}

export interface MetricBreakdownRow {
  key: string;
  name: string;
  actual: number | null;
  target: number | null;
  deviation_percent: number | null;
  source_records_count: number;
  cause: string | null;
  cause_status: 'known' | 'requires_review';
  links: { object_type: string; object_id: string; label: string }[];
}

export interface MetricBreakdownResponse extends Paginated<MetricBreakdownRow> {
  metric_code: string;
  group_by: string;
  context: MetricContext;
}

export interface DashboardResponse {
  period: { date_from: string; date_to: string };
  filters: { department_id: string | null; product_id: string | null };
  kpis: Kpi[];
  active_alerts_count: number;
  critical_alerts_count: number;
  active_decisions_count: number;
  active_tasks_count: number;
  overdue_tasks_count: number;
  recent_alerts: Alert[];
  recent_decisions: Decision[];
  recent_tasks: Task[];
  updated_at: string;
}

export interface Alert {
  id: string;
  metric_value_id: string | null;
  title: string;
  description: string;
  severity: 'critical';
  deviation_percent: number | null;
  status: AlertStatus;
  department_id: string | null;
  department_name: string | null;
  created_at: string;
  updated_at: string;
  metric_code: string;
  metric_name: string;
  product_id: string | null;
  product_name: string | null;
  period_start: string;
  period_end: string;
  actual: number | null;
  target: number | null;
  opening_actual: number | null;
  opening_target: number | null;
  has_decision: boolean;
  allowed_actions: string[];
}

export interface AlertDetail {
  alert: Alert;
  metric: Kpi;
  decisions: { id: string; name: string }[];
  tasks: { id: string; name: string }[];
  causes: { text: string; confirmed: boolean }[];
  related_orders: { id: string; label: string; amount: number | null }[];
  breakdown_url: string;
}

export interface ChangeEvent {
  id: string;
  object_type: string;
  object_id: string;
  action: string;
  changed_by: { id: string; full_name: string } | null;
  old_values: Record<string, unknown>;
  new_values: Record<string, unknown>;
  comment: string | null;
  created_at: string;
}

export interface Decision {
  id: string;
  title: string;
  problem: string;
  impact: string;
  cause: string;
  action: string;
  department_id: string | null;
  department_name: string | null;
  owner_id: string;
  owner: { id: string; full_name: string };
  created_by: string;
  creator: { id: string; full_name: string };
  alert_id: string | null;
  alert_title: string | null;
  deadline: string;
  priority: Priority;
  status: DecisionStatus;
  expected_result: string;
  actual_result: string | null;
  verification_note: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  version: number;
  allowed_actions: string[];
}

export interface Task {
  id: string;
  title: string;
  description: string;
  assignee_id: string;
  assignee: { id: string; full_name: string };
  created_by: string;
  creator: { id: string; full_name: string };
  department_id: string;
  department_name: string;
  decision_id: string | null;
  decision_title: string | null;
  alert_id: string | null;
  alert_title: string | null;
  order_id: string | null;
  deadline: string;
  priority: Priority;
  status: TaskStatus;
  is_overdue: boolean;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  version: number;
  allowed_actions: string[];
}

export interface ForecastWeek {
  week_start: string;
  week_end: string;
  demand: number | null;
  available_capacity: number | null;
  deficit: number | null;
  reserve: number | null;
  utilization_percent: number | null;
  is_deficit: boolean;
  status: 'normal' | 'deficit' | 'no_data';
}

export interface ForecastResponse {
  status: 'ready' | 'no_data';
  reason: string | null;
  method: 'four_week_average' | null;
  unit: 'standard_hour';
  as_of: string;
  generated_at: string;
  department_id: string | null;
  product_id: string | null;
  horizon_weeks: number;
  items: ForecastWeek[];
  first_deficit_week: string | null;
}

export interface SalesSummary {
  context: MetricContext;
  currency: 'BYN';
  revenue: number | null;
  orders_count: number;
  average_check: number | null;
  new_customers: number | null;
  active_customers: number | null;
  repeat_purchase_rate: number | null;
  sales_plan_achievement: number | null;
  conversion_percent: number | null;
  channels: { code: string; name: string; orders_count: number; revenue: number; active_customers: number }[];
  segments: { code: string; name: string; orders_count: number; revenue: number; active_customers: number }[];
  updated_at: string;
}

export interface SalesFunnelStage {
  code: string;
  name: string;
  count: number;
  conversion_from_previous_percent: number | null;
}

export interface SalesFunnel {
  context: MetricContext;
  cohort_count: number;
  stages: SalesFunnelStage[];
  conversion_percent: number | null;
  updated_at: string;
}

export interface Deal {
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

export interface ProductionSummary {
  context: MetricContext;
  planned_quantity: number | null;
  actual_quantity: number | null;
  plan_achievement_percent: number | null;
  queue_quantity: number | null;
  average_lead_time_hours: number | null;
  actual_load_hours: number | null;
  available_capacity_hours: number | null;
  capacity_utilization_percent: number | null;
  downtime_minutes: number | null;
  defective_quantity: number | null;
  reprint_quantity: number | null;
  defect_rate_percent: number | null;
  updated_at: string;
}

export interface ProductionRecord {
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

export interface PlanFactRow {
  plan: number | null;
  fact: number | null;
  deviation: number | null;
  achievement_percent: number | null;
}

export interface FinanceSummary {
  currency: 'BYN';
  revenue: number | null;
  gross_profit: number | null;
  gross_margin_percent: number | null;
  direct_cost: number | null;
  operating_cost: number | null;
  bdr: { revenue: PlanFactRow; direct_cost: PlanFactRow; operating_cost: PlanFactRow; profit: PlanFactRow };
  bdds: { inflow: PlanFactRow; outflow: PlanFactRow; net: PlanFactRow };
  context: MetricContext;
  bdr_context: MetricContext;
  bdds_context: MetricContext;
  updated_at: string;
}

export interface HrSummary {
  context: MetricContext;
  planned_headcount: number | null;
  actual_headcount: number | null;
  available_headcount: number | null;
  required_headcount: number | null;
  vacancies_count: number | null;
  absences_count: number | null;
  staffing_coverage_percent: number | null;
  snapshot_dates: string[];
  updated_at: string;
}

export interface DataSource {
  id: string;
  code: 'crm' | 'erp' | 'finance' | 'support' | 'hr';
  name: string;
  source_type: string;
  status: 'healthy' | 'warning' | 'error' | 'not_loaded';
  last_sync_at: string | null;
  last_attempt_at: string | null;
  last_success_at: string | null;
  is_stale: boolean;
  records_count: number;
  records_received: number;
  records_inserted: number;
  records_updated: number;
  records_skipped: number;
  records_failed: number;
  missing_count: number;
  duplicate_count: number;
  error_count: number;
}

export interface DataQualityIssue {
  id: string;
  source: string;
  check_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affected_records: number;
  status: 'open' | 'resolved';
  department_id: string | null;
  checked_at: string;
}

export interface Reconciliation {
  period: { date_from: string; date_to: string };
  source_a: { name: string; amount: number | null };
  source_b: { name: string; amount: number | null };
  difference: number | null;
  difference_percent: number | null;
  status: 'normal' | 'warning' | 'critical' | 'no_data';
  currency: 'BYN';
  checked_at: string;
  context: MetricContext;
}

export interface DataQualityOverview {
  checked_at: string;
  sources_total: number;
  healthy_sources: number;
  stale_sources: number;
  open_issues: number;
  critical_issues: number;
  reconciliation: Reconciliation;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  actor: { id: string; full_name: string } | null;
  actor_type: 'user' | 'system';
  action: string;
  object_type: string;
  object_id: string | null;
  object_name: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  status: 'success' | 'failure';
  error_message: string | null;
  request_id: string;
  created_at: string;
}

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  department_id: string | null;
  is_active: boolean;
}

export interface LoginResponse {
  access_token: string;
  token_type: 'bearer';
  expires_in: number;
  user: AuthUser;
}

export interface MetabaseEmbed {
  embed_url: string;
  expires_at: string;
}

export interface ListParams {
  page?: number;
  page_size?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  search?: string;
  [key: string]: string | number | boolean | undefined | null;
}
