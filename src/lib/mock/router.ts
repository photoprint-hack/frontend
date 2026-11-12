import type { MockContext } from './handlers';
import * as handlers from './handlers';
import { findImpactPath, getImpactGraph, getImpactNeighbors, getImpactNode } from './impact-map';

export interface MockRequest {
  method: string;
  path: string;
  params: URLSearchParams;
  body: unknown;
  userId: string | null;
}

export interface MockResponse {
  status: number;
  data: unknown;
}

const MOCK_USER_KEY = 'photoprint.mock.user';

function ctxFor(userId: string | null): MockContext {
  return {
    store: handlers.getStore(),
    userId: userId ?? handlers.seedUserId(),
  };
}

export function mockSessionUserId(): string | null {
  try {
    return sessionStorage.getItem(MOCK_USER_KEY);
  } catch {
    return null;
  }
}

export function setMockSessionUserId(userId: string | null) {
  try {
    if (userId) sessionStorage.setItem(MOCK_USER_KEY, userId);
    else sessionStorage.removeItem(MOCK_USER_KEY);
  } catch {
    /* private mode */
  }
}

function envelope<T>(data: T): { data: T } {
  return { data };
}

/** Эмуляция REST-контракта 1.2 на локальных данных. */
export async function handleMockRequest(request: MockRequest): Promise<MockResponse> {
  const { method, path, params, body, userId } = request;
  const ctx = ctxFor(userId);
  const segments = path.split('/').filter(Boolean);

  // auth
  if (path === '/auth/login' && method === 'POST') {
    const payload = body as { email: string; password: string };
    const result = handlers.login(payload.email, payload.password, ctx);
    setMockSessionUserId(result.user.id);
    return { status: 200, data: envelope(result) };
  }
  if (path === '/auth/refresh' && method === 'POST') {
    const id = mockSessionUserId();
    if (!id) {
      throw new handlers.MockHttpError(401, 'AUTH_TOKEN_EXPIRED', 'Сессия истекла, требуется вход');
    }
    const user = handlers.currentUser(ctxFor(id));
    return {
      status: 200,
      data: envelope({
        access_token: `mock.${user.id}.${Date.now()}`,
        token_type: 'bearer',
        expires_in: 900,
      }),
    };
  }
  if (path === '/auth/logout' && method === 'POST') {
    setMockSessionUserId(null);
    return { status: 200, data: envelope({ success: true }) };
  }
  if (path === '/auth/me' && method === 'GET') {
    return { status: 200, data: envelope(handlers.currentUser(ctx)) };
  }

  if (path === '/dashboard') return { status: 200, data: envelope(handlers.dashboard(params, ctx)) };

  // Business Impact Map v2 mock API; scoped per current mock role.
  if (path === '/impact-map' && method === 'GET') return { status: 200, data: envelope(getImpactGraph(params, ctx)) };
  if (path === '/impact-map/paths' && method === 'GET') return { status: 200, data: envelope(findImpactPath(params, ctx)) };
  if (path === '/impact-map/analyze' && method === 'POST') {
    throw new handlers.MockHttpError(503, 'AI_UNAVAILABLE', 'AI-анализ станет доступен после подключения Backend и OpenRouter. Карта и поиск связей работают в демо-режиме.');
  }
  if (segments[0] === 'impact-map' && segments[1] === 'nodes' && segments[3] === 'neighbors' && method === 'GET') {
    return { status: 200, data: envelope(getImpactNeighbors(segments[2]!, params, ctx)) };
  }
  if (segments[0] === 'impact-map' && segments[1] === 'nodes' && segments.length === 3 && method === 'GET') {
    return { status: 200, data: envelope(getImpactNode(segments[2]!, params, ctx)) };
  }

  if (path === '/orders') return { status: 200, data: handlers.listOrders(params, ctx) };
  if (segments[0] === 'orders' && segments[2] === 'events') {
    return { status: 200, data: handlers.orderEvents(segments[1]!, ctx) };
  }
  if (segments[0] === 'orders' && segments.length === 2) {
    return { status: 200, data: envelope(handlers.getOrder(segments[1]!, ctx)) };
  }

  if (path === '/customers') return { status: 200, data: handlers.listCustomers(params, ctx) };
  if (segments[0] === 'customers' && segments.length === 2) {
    return { status: 200, data: envelope(handlers.getCustomer(segments[1]!, ctx)) };
  }

  if (path === '/products') return { status: 200, data: envelope(handlers.listProducts(ctx)) };
  if (path === '/departments') return { status: 200, data: envelope(handlers.listDepartments(ctx)) };

  if (path === '/alerts') return { status: 200, data: handlers.listAlerts(params, ctx) };
  if (segments[0] === 'alerts' && segments[2] === 'history') {
    return { status: 200, data: handlers.alertHistory(segments[1]!, params, ctx) };
  }
  if (segments[0] === 'alerts' && segments.length === 2) {
    if (method === 'PATCH') {
      return { status: 200, data: envelope(handlers.patchAlert(segments[1]!, body as { status: never }, ctx)) };
    }
    return { status: 200, data: envelope(handlers.getAlert(segments[1]!, ctx)) };
  }

  if (path === '/decisions' && method === 'GET') return { status: 200, data: handlers.listDecisions(params, ctx) };
  if (path === '/decisions' && method === 'POST') {
    return { status: 201, data: envelope(handlers.createDecision(body as never, ctx)) };
  }
  if (segments[0] === 'decisions' && segments[2] === 'history') {
    return { status: 200, data: handlers.decisionHistory(segments[1]!, params, ctx) };
  }
  if (segments[0] === 'decisions' && segments.length === 2) {
    if (method === 'PATCH') {
      return { status: 200, data: envelope(handlers.patchDecision(segments[1]!, body as never, ctx)) };
    }
    return { status: 200, data: envelope(handlers.getDecision(segments[1]!, ctx)) };
  }

  if (path === '/tasks' && method === 'GET') return { status: 200, data: handlers.listTasks(params, ctx) };
  if (path === '/tasks' && method === 'POST') {
    return { status: 201, data: envelope(handlers.createTask(body as never, ctx)) };
  }
  if (segments[0] === 'tasks' && segments[2] === 'history') {
    return { status: 200, data: handlers.taskHistory(segments[1]!, params, ctx) };
  }
  if (segments[0] === 'tasks' && segments.length === 2) {
    if (method === 'PATCH') {
      return { status: 200, data: envelope(handlers.patchTask(segments[1]!, body as never, ctx)) };
    }
    if (method === 'DELETE') {
      handlers.archiveTask(segments[1]!, ctx);
      return { status: 204, data: null };
    }
    return { status: 200, data: envelope(handlers.getTask(segments[1]!, ctx)) };
  }

  if (path === '/metrics') return { status: 200, data: handlers.listMetrics(params, ctx) };
  if (path === '/metrics/recalculate') {
    return { status: 200, data: envelope(handlers.recalculateMetrics(params, ctx)) };
  }
  if (segments[0] === 'metrics' && segments[2] === 'history') {
    return { status: 200, data: handlers.metricHistory(segments[1]!, params, ctx) };
  }
  if (segments[0] === 'metrics' && segments[2] === 'breakdown') {
    return { status: 200, data: handlers.metricBreakdown(segments[1]!, params, ctx) };
  }
  if (segments[0] === 'metrics' && segments.length === 2) {
    return { status: 200, data: envelope(handlers.getMetric(segments[1]!, params, ctx)) };
  }

  if (path === '/sales/summary') return { status: 200, data: envelope(handlers.salesSummary(params, ctx)) };
  if (path === '/sales/funnel') return { status: 200, data: envelope(handlers.salesFunnel(params, ctx)) };
  if (path === '/sales/deals') return { status: 200, data: handlers.listDeals(params, ctx) };

  if (path === '/production/summary') return { status: 200, data: envelope(handlers.productionSummary(params, ctx)) };
  if (path === '/production/records') return { status: 200, data: handlers.productionRecords(params, ctx) };
  if (path === '/production/queue') return { status: 200, data: handlers.productionQueue(params, ctx) };

  if (path === '/finance/summary') return { status: 200, data: envelope(handlers.financeSummary(params, ctx)) };
  if (path === '/hr/summary') return { status: 200, data: envelope(handlers.hrSummary(params, ctx)) };

  if (path === '/forecast') return { status: 200, data: envelope(handlers.forecast(params, ctx)) };

  if (path === '/data-quality/sources') return { status: 200, data: handlers.dataSources(params, ctx) };
  if (path === '/data-quality/overview') return { status: 200, data: envelope(handlers.dataQualityOverview(params, ctx)) };
  if (path === '/data-quality/issues') return { status: 200, data: handlers.dataQualityIssues(params) };
  if (path === '/data-quality/reconciliation') return { status: 200, data: envelope(handlers.reconciliation(params, ctx)) };
  if (path === '/data-quality/check' && method === 'POST') {
    return { status: 200, data: envelope(handlers.runQualityCheck(ctx)) };
  }
  if (segments[0] === 'integrations' && segments[2] === 'import' && method === 'POST') {
    return { status: 200, data: envelope(handlers.importSource(segments[1]!, ctx)) };
  }

  if (path === '/audit-logs') return { status: 200, data: handlers.listAuditLogs(params, ctx) };
  if (segments[0] === 'audit-logs' && segments.length === 2) {
    return { status: 200, data: envelope(handlers.getAuditLog(segments[1]!, ctx)) };
  }

  if (path === '/users' && method === 'GET') return { status: 200, data: handlers.listUsers(params, ctx) };
  if (path === '/users' && method === 'POST') {
    return { status: 201, data: envelope(handlers.createUser(body as never, ctx)) };
  }
  if (segments[0] === 'users' && segments.length === 2 && method === 'PATCH') {
    return { status: 200, data: envelope(handlers.patchUser(segments[1]!, body as never, ctx)) };
  }


  if (path === '/support/interactions') return { status: 200, data: handlers.supportTickets(params, ctx) };
  if (path === '/support/stats') return { status: 200, data: envelope(handlers.supportStats(ctx)) };
  if (path === '/health') return { status: 200, data: envelope(handlers.systemHealth()) };

  throw new handlers.MockHttpError(404, 'RESOURCE_NOT_FOUND', `Мок-маршрут не найден: ${method} ${path}`);
}
