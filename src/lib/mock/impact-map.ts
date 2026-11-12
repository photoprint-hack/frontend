import type { ImpactContext, ImpactDirection, ImpactEdge, ImpactEdgeType, ImpactGraph, ImpactNode, ImpactPath } from '@/features/impact-map/types';
import { getRevision, listMetrics, MockHttpError, type MockContext } from './handlers';

type NodeSeed = Pick<ImpactNode, 'id' | 'type' | 'label' | 'description'> & Partial<Pick<ImpactNode, 'entity_ref' | 'status' | 'updated_at' | 'context' | 'allowed_actions'>>;
type EdgeSeed = Omit<ImpactEdge, 'id'>;

const POSITIONS: Record<ImpactNode['type'], { x: number; column: number }> = {
  source: { x: 130, column: 0 },
  process: { x: 390, column: 1 },
  department: { x: 650, column: 2 },
  metric: { x: 910, column: 3 },
  risk: { x: 1450, column: 5 },
  entity: { x: 1450, column: 5 },
  event: { x: 390, column: 1 },
  decision: { x: 1450, column: 5 },
};

function edge(source: string, target: string, type: ImpactEdgeType, evidence_type: ImpactEdge['evidence_type'], description: string, source_label: string, evidence_ref: string): EdgeSeed {
  return { source, target, type, evidence_type, description, source_label, evidence_refs: [evidence_ref] };
}

function demoGraph(params: URLSearchParams, ctx: MockContext): ImpactGraph {
  const user = ctx.store.users.find((candidate) => candidate.id === ctx.userId);
  const departmentId = user?.role === 'manager' ? user.department_id : params.get('department_id');
  const safeParams = new URLSearchParams(params);
  if (departmentId) safeParams.set('department_id', departmentId);
  safeParams.set('page_size', '50');
  const metrics = listMetrics(safeParams, ctx).items;
  const departments = ctx.store.departments;
  const allowedDept = departments.find((department) => department.id === departmentId);
  const nodes: NodeSeed[] = [
    { id: 'source:crm', type: 'source', label: 'CRM', description: 'Клиенты, сделки и каналы продаж', status: 'Демо-данные', entity_ref: { type: 'source', code: 'crm' } },
    { id: 'source:erp', type: 'source', label: 'ERP', description: 'Заказы и производственные события', status: 'Демо-данные', entity_ref: { type: 'source', code: 'erp' } },
    { id: 'source:finance', type: 'source', label: 'Финансы', description: 'Плановые и фактические суммы', status: 'Демо-данные', entity_ref: { type: 'source', code: 'finance' } },
    { id: 'source:support', type: 'source', label: 'Поддержка', description: 'Обращения клиентов и время реакции', status: 'Демо-данные', entity_ref: { type: 'source', code: 'support' } },
    { id: 'source:hr', type: 'source', label: 'HR', description: 'Снимки по численности и подразделениям', status: 'Демо-данные', entity_ref: { type: 'source', code: 'hr' } },
    { id: 'source:mary', type: 'source', label: 'Mary · демо', description: 'Синтетические события адаптера Mary; реального подключения нет', status: 'Симуляция', entity_ref: { type: 'source', code: 'mary' } },
    { id: 'process:sales', type: 'process', label: 'Продажи', description: 'От первого обращения до подтверждённого заказа', entity_ref: { type: 'process', code: 'sales' } },
    { id: 'process:production', type: 'process', label: 'Производство', description: 'Планирование загрузки, печать и выпуск заказа', entity_ref: { type: 'process', code: 'production' } },
    { id: 'process:quality', type: 'process', label: 'Контроль качества', description: 'Проверка результата и фиксация брака', entity_ref: { type: 'process', code: 'quality' } },
    { id: 'process:delivery', type: 'process', label: 'Доставка', description: 'Передача готового заказа клиенту', entity_ref: { type: 'process', code: 'delivery' } },
    { id: 'process:support', type: 'process', label: 'Поддержка клиентов', description: 'Ответы на вопросы и обработка обращений', entity_ref: { type: 'process', code: 'support' } },
    ...departments.map((department) => ({ id: `department:${department.id}`, type: 'department' as const, label: department.name, description: department.description ?? `Подразделение ${department.name}`, status: departmentId === department.id ? 'Выбрано' : null, entity_ref: { type: 'department', id: department.id } })),
    { id: 'risk:delivery', type: 'risk', label: 'Риск срыва срока', description: 'Возможное влияние отклонений в производстве на соблюдение срока заказа', status: 'Гипотеза', entity_ref: { type: 'risk', code: 'delivery_delay' } },
    { id: 'risk:quality', type: 'risk', label: 'Рост повторного брака', description: 'Возможное влияние качества печати на затраты и срок выполнения', status: 'Гипотеза', entity_ref: { type: 'risk', code: 'repeat_defect' } },
    { id: 'event:mary-lead', type: 'event', label: 'Квалификация лида', description: 'Симулированное событие из адаптера Mary', status: 'Синтетическое событие', entity_ref: { type: 'mary_event', code: 'lead_qualified' } },
  ];

  metrics.forEach((metric) => {
    nodes.push({
      id: `metric:${metric.code}`,
      type: 'metric',
      label: metric.name,
      description: metric.description ?? metric.formula,
      status: metric.status,
      updated_at: metric.updated_at,
      entity_ref: { type: 'metric', id: metric.id, code: metric.code },
      context: {
        actual: metric.actual,
        target: metric.target,
        forecast: metric.forecast,
        deviation_percent: metric.deviation_percent,
        achievement_percent: metric.achievement_percent,
        unit: metric.unit,
        formula: metric.formula,
        source: metric.source,
        source_updated_at: metric.source_updated_at,
        ignored_filters: metric.context.ignored_filters,
        department_id: metric.context.department_id,
        product_id: metric.context.product_id,
      },
    });
  });

  const tasks = ctx.store.tasks.filter((task) => {
    if (user?.role === 'employee') return task.assignee_id === user.id;
    if (user?.role === 'manager' && user.department_id) return task.department_id === user.department_id;
    return !departmentId || task.department_id === departmentId;
  }).slice(0, 3);
  tasks.forEach((task) => nodes.push({
    id: `entity:task:${task.id}`,
    type: 'entity',
    label: task.title,
    description: task.description,
    status: task.status,
    updated_at: task.updated_at,
    entity_ref: { type: 'task', id: task.id },
    allowed_actions: task.allowed_actions,
    context: { department_id: task.department_id, deadline: task.deadline, priority: task.priority },
  }));

  const scopedAlerts = ctx.store.alerts.filter((alert) => !departmentId || alert.department_id === departmentId).slice(0, 2);
  scopedAlerts.forEach((alert) => nodes.push({
    id: `entity:alert:${alert.id}`,
    type: 'entity',
    label: alert.title,
    description: alert.description,
    status: alert.status,
    updated_at: alert.updated_at,
    entity_ref: { type: 'alert', id: alert.id },
    allowed_actions: alert.allowed_actions,
    context: { metric_code: alert.metric_code, department_id: alert.department_id, deviation_percent: alert.deviation_percent },
  }));

  if (user?.role === 'employee') {
    // Employee views only their own task subgraph and directly linked records; no general KPI nodes.
    const taskNodeIds = new Set(tasks.map((task) => `entity:task:${task.id}`));
    const processId = user.department_id === departments.find((item) => item.code === 'sales')?.id
      ? 'process:sales'
      : user.department_id === departments.find((item) => item.code === 'support')?.id
        ? 'process:support'
        : 'process:production';
    const retained = new Set<string>([processId, `department:${user.department_id}`]);
    taskNodeIds.forEach((id) => retained.add(id));
    tasks.forEach((task) => {
      if (task.order_id) {
        const order = ctx.store.orders.find((item) => item.id === task.order_id);
        if (order) {
          const id = `entity:order:${order.id}`;
          retained.add(id);
          nodes.push({ id, type: 'entity', label: order.order_number, description: `Заказ · ${order.product_name}`, status: order.status, updated_at: order.updated_at, entity_ref: { type: 'order', id: order.id }, allowed_actions: ['read'], context: { department_id: order.department_id, due_at: order.due_at } });
        }
      }
      if (task.decision_id) {
        const decision = ctx.store.decisions.find((item) => item.id === task.decision_id);
        if (decision) {
          const id = `decision:${decision.id}`;
          retained.add(id);
          nodes.push({ id, type: 'decision', label: decision.title, description: decision.problem, status: decision.status, updated_at: decision.updated_at, entity_ref: { type: 'decision', id: decision.id }, allowed_actions: ['read'] });
        }
      }
    });
    const employeeEdges: EdgeSeed[] = [
      edge(`department:${user.department_id}`, processId, 'belongs_to', 'verified', 'Рабочий процесс относится к вашему подразделению.', 'Рабочая область', `department:${user.department_id}`),
      ...tasks.map((task) => edge(processId, `entity:task:${task.id}`, 'produces', 'verified', 'Задача назначена вам.', 'Мои задачи', `task:${task.id}`)),
    ];
    tasks.forEach((task) => {
      if (task.order_id && retained.has(`entity:order:${task.order_id}`)) employeeEdges.push(edge(`entity:task:${task.id}`, `entity:order:${task.order_id}`, 'depends_on', 'verified', 'Задача связана с этим заказом.', 'Карточка задачи', `task:${task.id}`));
      if (task.decision_id && retained.has(`decision:${task.decision_id}`)) employeeEdges.push(edge(`entity:task:${task.id}`, `decision:${task.decision_id}`, 'mitigated_by', 'verified', 'Задача связана с этим решением.', 'Карточка задачи', `task:${task.id}`));
    });
    return finishGraph(nodes.filter((node) => retained.has(node.id)), employeeEdges, params, departmentId, ctx);
  }

  const edges: EdgeSeed[] = [
    edge('source:crm', 'process:sales', 'feeds', 'verified', 'CRM передаёт события по сделкам в процесс продаж.', 'CRM', 'crm:deal-events'),
    edge('source:erp', 'process:production', 'feeds', 'verified', 'ERP передаёт заказы и события выполнения.', 'ERP', 'erp:order-events'),
    edge('source:erp', 'process:quality', 'feeds', 'verified', 'ERP содержит события выпуска и контроля качества.', 'ERP', 'erp:production-records'),
    edge('source:finance', 'process:sales', 'feeds', 'calculated', 'Финансовые факты используются при расчёте выручки.', 'Финансы', 'finance:revenue-facts'),
    edge('source:support', 'process:support', 'feeds', 'verified', 'Источник содержит обращения клиентов.', 'Поддержка', 'support:ticket-records'),
    edge('source:hr', 'process:production', 'feeds', 'calculated', 'Снимки HR используются для оценки укомплектованности.', 'HR', 'hr:department-snapshots'),
    edge('source:mary', 'event:mary-lead', 'produces', 'verified', 'Событие сгенерировано демонстрационным адаптером.', 'Mary · симуляция', 'mary:synthetic-event'),
    edge('event:mary-lead', 'process:sales', 'feeds', 'verified', 'Симулированная квалификация лида относится к процессу продаж.', 'Mary · симуляция', 'mary:synthetic-event'),
    edge('process:sales', `department:${departments.find((item) => item.code === 'sales')?.id}`, 'belongs_to', 'verified', 'Процесс закреплён за подразделением продаж.', 'Конфигурация процессов', 'config:sales-owner'),
    edge('process:production', `department:${departments.find((item) => item.code === 'production')?.id}`, 'belongs_to', 'verified', 'Производственный процесс закреплён за подразделением.', 'Конфигурация процессов', 'config:production-owner'),
    edge('process:quality', `department:${departments.find((item) => item.code === 'production')?.id}`, 'belongs_to', 'verified', 'Контроль качества выполняется производством.', 'Конфигурация процессов', 'config:quality-owner'),
    edge('process:delivery', `department:${departments.find((item) => item.code === 'production')?.id}`, 'belongs_to', 'verified', 'Подготовка заказа к доставке связана с выпуском.', 'Конфигурация процессов', 'config:delivery-owner'),
    edge('process:support', `department:${departments.find((item) => item.code === 'support')?.id}`, 'belongs_to', 'verified', 'Обращения клиентов обрабатывает поддержка.', 'Конфигурация процессов', 'config:support-owner'),
    edge('process:sales', 'metric:revenue', 'produces', 'calculated', 'Выручка рассчитывается из данных о продажах и финансовых фактов.', 'Расчёт KPI', 'metric:revenue:formula'),
    edge('process:production', 'metric:on_time_orders', 'produces', 'calculated', 'Срок выполнения рассчитывается по событиям заказа.', 'Расчёт KPI', 'metric:on_time_orders:formula'),
    edge('process:quality', 'metric:defect_rate', 'produces', 'calculated', 'Доля брака рассчитывается по записям производства.', 'Расчёт KPI', 'metric:defect_rate:formula'),
    edge('process:support', 'metric:support_sla', 'produces', 'calculated', 'SLA поддержки рассчитывается по обращениям.', 'Расчёт KPI', 'metric:support_sla:formula'),
    edge('process:production', 'metric:capacity_utilization', 'produces', 'calculated', 'Загрузка сравнивает спрос с доступной мощностью.', 'Расчёт KPI', 'metric:capacity_utilization:formula'),
    edge('metric:on_time_orders', 'risk:delivery', 'may_affect', 'hypothesis', 'Связь отражает возможный риск и сама по себе не доказывает причину.', 'Гипотеза для проверки', 'hypothesis:delivery-risk'),
    edge('metric:defect_rate', 'risk:quality', 'may_affect', 'hypothesis', 'Связь отражает возможный риск и требует проверки по заказам.', 'Гипотеза для проверки', 'hypothesis:quality-risk'),
    edge('risk:delivery', 'process:delivery', 'depends_on', 'hypothesis', 'Риск срока требует проверки очереди и этапов заказа.', 'Сценарий исследования', 'scenario:delivery-chain'),
    edge('risk:quality', 'process:quality', 'depends_on', 'hypothesis', 'Риск качества требует проверки производственных событий.', 'Сценарий исследования', 'scenario:quality-chain'),
  ];

  const firstTask = tasks[0];
  if (firstTask) edges.push(edge('process:production', `entity:task:${firstTask.id}`, 'mitigated_by', 'verified', 'Связанное поручение может помочь проверить производственную проблему.', 'Существующая задача', `task:${firstTask.id}`));
  const firstAlert = scopedAlerts[0];
  if (firstAlert) edges.push(edge(`entity:alert:${firstAlert.id}`, `metric:${firstAlert.metric_code}`, 'belongs_to', 'verified', 'Отклонение относится к этому показателю.', 'Существующее отклонение', `alert:${firstAlert.id}`));

  const actualTypes = new Set(nodes.map((node) => node.id));
  const filteredEdges = edges.filter((item) => actualTypes.has(item.source) && actualTypes.has(item.target));
  const departmentCode = allowedDept?.code;
  const managerScope = departmentCode === 'sales'
    ? { processes: ['process:sales'], sources: ['source:crm', 'source:finance', 'source:mary', 'event:mary-lead'], metrics: ['revenue', 'new_customers', 'active_customers', 'repeat_purchase_rate', 'sales_plan_achievement'], risks: [] }
    : departmentCode === 'support'
      ? { processes: ['process:support'], sources: ['source:support'], metrics: ['support_sla'], risks: [] }
      : { processes: ['process:production', 'process:quality', 'process:delivery'], sources: ['source:erp', 'source:hr'], metrics: ['on_time_orders', 'defect_rate', 'capacity_utilization', 'staffing_coverage'], risks: ['risk:delivery', 'risk:quality'] };
  const allowedNodes = user?.role === 'manager'
    ? nodes.filter((node) => {
        if (node.type === 'department') return node.id === `department:${allowedDept?.id}`;
        if (node.type === 'source') return managerScope.sources.includes(node.id);
        if (node.type === 'process') return managerScope.processes.includes(node.id);
        if (node.type === 'event') return managerScope.sources.includes(node.id);
        if (node.type === 'metric') return managerScope.metrics.includes(node.entity_ref?.code ?? '');
        if (node.type === 'risk') return managerScope.risks.includes(node.id);
        return true;
      })
    : nodes;
  const allowedIds = new Set(allowedNodes.map((node) => node.id));
  const scopedEdges = filteredEdges.filter((item) => allowedIds.has(item.source) && allowedIds.has(item.target));
  return finishGraph(allowedNodes, scopedEdges, params, departmentId, ctx, metrics[0]?.context.ignored_filters ?? []);
}

function finishGraph(nodes: NodeSeed[], edgeSeeds: EdgeSeed[], params: URLSearchParams, departmentId: string | null, ctx: MockContext, ignored_filters: string[] = []): ImpactGraph {
  const rowsByColumn = new Map<number, number>();
  const metricCount = nodes.filter((node) => node.type === 'metric').length;
  let metricIndex = 0;
  const positioned: ImpactNode[] = nodes.map((node) => {
    const column = POSITIONS[node.type].column;
    let row = rowsByColumn.get(column) ?? 0;
    let x = POSITIONS[node.type].x;
    if (node.type === 'metric' && metricCount > 6) {
      metricIndex += 1;
      const secondColumn = metricIndex > Math.ceil(metricCount / 2);
      row = secondColumn ? metricIndex - Math.ceil(metricCount / 2) - 1 : metricIndex - 1;
      x = secondColumn ? 1170 : 910;
    }
    rowsByColumn.set(column, row + 1);
    return {
      ...node,
      allowed_actions: node.allowed_actions ?? ['read'],
      position: { x, y: 100 + row * 142 },
    };
  });
  const context: ImpactContext = {
    date_from: params.get('date_from') ?? '',
    date_to: params.get('date_to') ?? '',
    timezone: 'Europe/Minsk',
    department_id: departmentId,
    product_id: params.get('product_id') || null,
    ignored_filters,
  };
  return {
    nodes: positioned,
    edges: edgeSeeds.map((item, index) => ({ ...item, id: `edge:${index + 1}:${item.source}:${item.target}` })),
    context,
    graph_revision: `mock-${getRevision()}-${ctx.store.referenceDate}`,
    generated_at: new Date().toISOString(),
    truncated: false,
  };
}

function edgeTouches(edgeItem: ImpactEdge, id: string, direction: ImpactDirection): string | null {
  if ((direction === 'out' || direction === 'both') && edgeItem.source === id) return edgeItem.target;
  if ((direction === 'in' || direction === 'both') && edgeItem.target === id) return edgeItem.source;
  return null;
}

export function getImpactGraph(params: URLSearchParams, ctx: MockContext): ImpactGraph {
  return demoGraph(params, ctx);
}

export function getImpactNode(id: string, params: URLSearchParams, ctx: MockContext): ImpactNode {
  const node = demoGraph(params, ctx).nodes.find((item) => item.id === id);
  if (!node) throw new MockHttpError(404, 'RESOURCE_NOT_FOUND', 'Узел недоступен');
  return node;
}

export function getImpactNeighbors(id: string, params: URLSearchParams, ctx: MockContext): ImpactGraph {
  const graph = demoGraph(params, ctx);
  if (!graph.nodes.some((node) => node.id === id)) throw new MockHttpError(404, 'RESOURCE_NOT_FOUND', 'Узел недоступен');
  const depth = Math.min(3, Math.max(1, Number(params.get('depth') ?? 1)));
  const direction = (params.get('direction') ?? 'both') as ImpactDirection;
  const typeFilter = new Set((params.get('edge_types') ?? '').split(',').filter(Boolean));
  const adjacencyEdges = graph.edges.filter((item) => typeFilter.size === 0 || typeFilter.has(item.type));
  const distance = new Map<string, number>([[id, 0]]);
  const queue = [id];
  while (queue.length) {
    const current = queue.shift()!;
    const currentDepth = distance.get(current)!;
    if (currentDepth >= depth) continue;
    for (const item of adjacencyEdges) {
      const next = edgeTouches(item, current, direction);
      if (next && !distance.has(next)) {
        distance.set(next, currentDepth + 1);
        queue.push(next);
      }
    }
  }
  const ids = new Set(distance.keys());
  const nodes = graph.nodes.filter((node) => ids.has(node.id));
  const edges = adjacencyEdges.filter((item) => ids.has(item.source) && ids.has(item.target));
  return layoutFocusedGraph({ ...graph, nodes, edges }, id, depth);
}

function layoutFocusedGraph(graph: ImpactGraph, rootId: string, maxDepth: number): ImpactGraph {
  const upstream = new Map<string, number>();
  const downstream = new Map<string, number>();
  const walk = (distances: Map<string, number>, forward: boolean) => {
    distances.set(rootId, 0);
    const queue = [rootId];
    while (queue.length) {
      const current = queue.shift()!;
      const distance = distances.get(current)!;
      if (distance >= maxDepth) continue;
      for (const edge of graph.edges) {
        const next = forward ? (edge.source === current ? edge.target : null) : (edge.target === current ? edge.source : null);
        if (next && !distances.has(next)) { distances.set(next, distance + 1); queue.push(next); }
      }
    }
  };
  walk(upstream, false);
  walk(downstream, true);
  const rows = new Map<string, number>();
  const nodes = graph.nodes.map((node) => {
    if (node.id === rootId) return { ...node, position: { x: 800, y: 460 } };
    const up = upstream.get(node.id);
    const down = downstream.get(node.id);
    const direction = up !== undefined && down === undefined ? 'up' : down !== undefined && up === undefined ? 'down' : up !== undefined ? 'up' : 'other';
    const distance = direction === 'up' ? up! : direction === 'down' ? down! : 1;
    const key = `${direction}:${distance}`;
    const row = rows.get(key) ?? 0;
    rows.set(key, row + 1);
    const x = direction === 'other' ? node.position?.x ?? 1450 : 800 + (direction === 'up' ? -1 : 1) * distance * 235;
    return { ...node, position: { x, y: direction === 'other' ? node.position?.y ?? 820 : 460 + (row - Math.max(0, (graph.nodes.length / 2) - 1)) * 120 } };
  });
  return { ...graph, nodes };
}

export function findImpactPath(params: URLSearchParams, ctx: MockContext): ImpactPath {
  const graph = demoGraph(params, ctx);
  const from = params.get('from_node_id') ?? '';
  const to = params.get('to_node_id') ?? '';
  const depth = Math.min(3, Math.max(1, Number(params.get('depth') ?? 3)));
  const direction = (params.get('direction') ?? 'out') as ImpactDirection;
  const typeFilter = new Set((params.get('edge_types') ?? '').split(',').filter(Boolean));
  const edges = graph.edges.filter((item) => typeFilter.size === 0 || typeFilter.has(item.type));
  const queue = [from];
  const previous = new Map<string, { id: string; edge: ImpactEdge }>();
  const seen = new Set<string>([from]);
  const depths = new Map<string, number>([[from, 0]]);
  while (queue.length && !seen.has(to)) {
    const current = queue.shift()!;
    if ((depths.get(current) ?? 0) >= depth) continue;
    for (const item of edges) {
      const next = edgeTouches(item, current, direction);
      if (next && !seen.has(next)) {
        seen.add(next);
        previous.set(next, { id: current, edge: item });
        depths.set(next, (depths.get(current) ?? 0) + 1);
        queue.push(next);
      }
    }
  }
  if (!seen.has(to)) return { nodes: [], edges: [], found: false, graph_revision: graph.graph_revision };
  const pathNodes = [to];
  const pathEdges: ImpactEdge[] = [];
  let cursor = to;
  while (cursor !== from) {
    const step = previous.get(cursor);
    if (!step) break;
    pathEdges.push(step.edge);
    pathNodes.push(step.id);
    cursor = step.id;
  }
  return {
    nodes: pathNodes.reverse().map((nodeId) => graph.nodes.find((node) => node.id === nodeId)!).filter(Boolean),
    edges: pathEdges.reverse(),
    found: true,
    graph_revision: graph.graph_revision,
  };
}
