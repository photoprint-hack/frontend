/** Внутренние модели mock-хранилища: расширяют wire-типы служебными полями. */
import type {
  Customer,
  Deal,
  Decision,
  Department,
  Order,
  OrderEvent,
  Product,
  Task,
  User as ApiUser,
} from '@/types/api';

export interface User extends ApiUser {
  password: string;
}

/** Заказ + сохранённая прямая себестоимость (для маржи и сверки). */
export type OrderRecord = Order & { direct_cost: number };

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

export interface SupportTicket {
  id: string;
  external_id: string;
  customer_id: string;
  customer_name: string;
  order_id: string | null;
  department_id: string;
  channel: string;
  topic: string;
  status: 'open' | 'in_progress' | 'closed';
  priority: 'low' | 'medium' | 'high';
  created_at: string;
  first_response_at: string | null;
  closed_at: string | null;
  sla_deadline: string | null;
  resolved_within_sla: boolean | null;
  resolution: string | null;
  cause: string | null;
}

export type DealRecord = Deal & { stageIndex: number };

export interface HrSnapshotRaw {
  id: string;
  department_id: string;
  snapshot_date: string;
  planned_headcount: number;
  actual_headcount: number;
  available_headcount: number;
  required_headcount: number;
  vacancies_count: number;
  absences_count: number;
  source_system: string;
  created_at: string;
}

export type {
  Customer,
  Deal,
  Decision,
  Department,
  Order,
  OrderEvent,
  Product,
  Task,
};
