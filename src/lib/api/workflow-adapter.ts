import type { Decision, Task } from '@/types/api';

type Named = { id: string; name: string };
export type ServerDecision = Omit<Decision, 'department_name' | 'alert_title'> & { department: Named | null; alert_title?: string | null };
export type ServerTask = Omit<Task, 'department_name' | 'decision_title' | 'alert_title'> & { department: Named; decision: Named | null; alert_title?: string | null };

export function adaptDecision(value: ServerDecision): Decision {
  return { ...value, department_name: value.department?.name ?? null, alert_title: value.alert_title ?? null };
}
export function adaptTask(value: ServerTask): Task {
  return { ...value, department_name: value.department.name, decision_title: value.decision?.name ?? null, alert_title: value.alert_title ?? null };
}
/** Date inputs represent the complete selected Minsk calendar day (UTC+03:00). */
export function withDeadline(body: Record<string, unknown>): Record<string, unknown> {
  const deadline = body.deadline;
  return typeof deadline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(deadline)
    ? { ...body, deadline: `${deadline}T23:59:59.999+03:00` }
    : body;
}
export function selectParams(params: Record<string, unknown> | undefined, keys: string[]) {
  return Object.fromEntries(Object.entries(params ?? {}).filter(([key]) => keys.includes(key)));
}
