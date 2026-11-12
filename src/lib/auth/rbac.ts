import type { Role } from '@/types/api';

/** Матрица прав из API-контракта 4.2 — используется только для UI. */
export type Capability =
  | 'analytics.view'
  | 'sales.view'
  | 'production.view'
  | 'finance.view'
  | 'orders.read'
  | 'orders.write'
  | 'decisions.read'
  | 'decisions.write'
  | 'decisions.verify'
  | 'tasks.read'
  | 'tasks.write'
  | 'tasks.archive'
  | 'users.manage'
  | 'assignees.read'
  | 'audit.read'
  | 'integrations.import'
  | 'metrics.recalculate'
  | 'dataQuality.view'
  | 'dataQuality.run'
  | 'forecast.view'
  | 'bi.view'
  | 'impactMap.view';

const STAFF: Role[] = ['admin', 'director', 'manager', 'analyst'];

const MATRIX: Record<Capability, Role[]> = {
  'analytics.view': STAFF,
  'sales.view': STAFF,
  'production.view': STAFF,
  'finance.view': STAFF,
  'orders.read': ['admin', 'director', 'manager', 'analyst', 'employee'],
  'orders.write': ['admin', 'director', 'manager'],
  'decisions.read': ['admin', 'director', 'manager', 'analyst', 'employee'],
  'decisions.write': ['admin', 'director', 'manager'],
  'decisions.verify': ['admin', 'director', 'manager'],
  'tasks.read': ['admin', 'director', 'manager', 'analyst', 'employee'],
  'tasks.write': ['admin', 'director', 'manager'],
  'tasks.archive': ['admin'],
  'users.manage': ['admin'],
  'assignees.read': STAFF,
  'audit.read': ['admin', 'director'],
  'integrations.import': ['admin'],
  'metrics.recalculate': ['admin'],
  'dataQuality.view': ['admin', 'analyst', 'director'],
  'dataQuality.run': ['admin', 'analyst'],
  'forecast.view': ['admin', 'director', 'manager', 'analyst'],
  'bi.view': STAFF,
  'impactMap.view': ['admin', 'director', 'manager', 'analyst', 'employee'],
};

export function can(role: Role | undefined | null, capability: Capability): boolean {
  if (!role) return false;
  return MATRIX[capability].includes(role);
}

export function isReadOnly(role: Role | undefined | null): boolean {
  return role === 'analyst';
}

export function homeRoute(role: Role | undefined | null): string {
  return role === 'employee' ? '/tasks' : '/dashboard';
}

export interface NavVisibility {
  dashboard: boolean;
  sales: boolean;
  production: boolean;
  financeHr: boolean;
  analytics: boolean;
  impactMap: boolean;
  alerts: boolean;
  decisions: boolean;
  tasks: boolean;
  forecast: boolean;
  dataQuality: boolean;
  auditLogs: boolean;
  users: boolean;
}

export function navVisibility(role: Role | undefined | null): NavVisibility {
  return {
    dashboard: can(role, 'analytics.view'),
    sales: can(role, 'sales.view'),
    production: can(role, 'production.view'),
    financeHr: can(role, 'finance.view'),
    analytics: can(role, 'bi.view'),
    impactMap: can(role, 'impactMap.view'),
    alerts: can(role, 'analytics.view'),
    decisions: can(role, 'decisions.read'),
    tasks: can(role, 'tasks.read'),
    forecast: can(role, 'forecast.view'),
    dataQuality: can(role, 'dataQuality.view'),
    auditLogs: can(role, 'audit.read'),
    users: can(role, 'users.manage'),
  };
}
