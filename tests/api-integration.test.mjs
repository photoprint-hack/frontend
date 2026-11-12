import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { after, test } from 'node:test';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = await mkdtemp(path.join(tmpdir(), 'photoprint-api-'));
const requests = [];
let handle = () => ({ data: {} });
const server = createServer(async (request, response) => {
  let body = '';
  for await (const chunk of request) body += chunk;
  const entry = { url: new URL(request.url, 'http://localhost'), method: request.method,
    headers: request.headers, body: body ? JSON.parse(body) : null };
  requests.push(entry);
  try {
    const result = await handle(entry);
    response.writeHead(result.status ?? 200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(result.body ?? result));
  } catch (error) {
    response.writeHead(500, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ detail: { code: 'TEST_FAILURE', message: error.message } }));
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
await build({
  stdin: { contents: "export * from './src/features/analytics/chart-data'; export * from './src/lib/api/endpoints'; export * from './src/lib/api/client'; export { tokenStore } from './src/lib/auth/token-store';", resolveDir: root, loader: 'ts' },
  absWorkingDir: root, tsconfig: path.join(root, 'tsconfig.json'), bundle: true,
  platform: 'node', format: 'cjs', outfile: path.join(output, 'api.cjs'),
  define: { 'import.meta.env': JSON.stringify({ VITE_API_URL: `http://127.0.0.1:${address.port}/api/v1`, VITE_USE_MOCKS: 'false' }) },
});
const api = createRequire(import.meta.url)(path.join(output, 'api.cjs'));
// Render the actual production canvas in Node; export its existing local function
// only in this test bundle. No browser session or copied renderer is involved.
const canvasDir = path.join(root, 'src/features/impact-map');
await build({
  stdin: { contents: (await readFile(path.join(canvasDir, 'ImpactMapPage.tsx'), 'utf8')) + "\nexport { ImpactCanvas }; export { createElement } from 'react'; export { renderToStaticMarkup } from 'react-dom/server';", resolveDir: canvasDir, loader: 'tsx' },
  absWorkingDir: root, tsconfig: path.join(root, 'tsconfig.json'), bundle: true,
  platform: 'node', format: 'cjs', outfile: path.join(output, 'canvas.cjs'),
  define: { 'import.meta.env': JSON.stringify({ VITE_API_URL: 'http://localhost/api/v1', VITE_USE_MOCKS: 'false' }) },
});
const canvas = createRequire(import.meta.url)(path.join(output, 'canvas.cjs'));
function assertCanvasDraws(graph) {
  const markup = canvas.renderToStaticMarkup(canvas.createElement(canvas.ImpactCanvas, {
    graph, selectedNode: null, selectedEdge: null, showAllEdges: true, path: null,
    onNode() {}, onEdge() {},
  }));
  assert.equal((markup.match(/data-map-node="true"/g) ?? []).length, graph.nodes.length,
    'Every API node must reach the real SVG renderer');
  assert.equal((markup.match(/data-map-edge="true"/g) ?? []).length, graph.edges.length,
    'Every valid API edge must reach the real SVG renderer');
  assert.doesNotMatch(markup, /NaN|Infinity/);
}

after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); await rm(output, { recursive: true, force: true }); });
const page = (items, number = 1, pages = 1) => ({ items, total: pages === 1 ? items.length : 101, page: number, page_size: 100, pages });
const node = { id: 'metric-node', type: 'metric', label: 'Revenue', description: 'Revenue',
  entity_ref: { type: 'metric', id: 'revenue' }, context: { date_from: '2026-11-01' },
  metadata: { actual: 1200, unit: 'BYN' }, allowed_actions: ['read', 'analyze'] };
const graph = { nodes: [node], edges: [{ id: 'edge', source: 'metric-node', target: 'risk-node',
  type: 'may_affect', evidence_type: 'hypothesis', description: 'Review', evidence_source: 'ERP', evidence_refs: [] }],
  context: { date_from: '2026-11-01', date_to: '2026-11-12', department_id: null, product_id: null },
  graph_revision: 'revision', generated_at: '2026-11-12T09:00:00Z', truncated: false };

test('catalogs exhaust pagination and expose the existing data envelope', async () => {
  handle = ({ url }) => page([{ id: `${url.pathname}-${url.searchParams.get('page')}` }], Number(url.searchParams.get('page')), 2);
  for (const load of [api.catalogApi.products, api.catalogApi.departments]) {
    const response = await load();
    assert.equal(response.data.length, 2);
    assert.match(response.data[1].id, /-2$/);
  }
});

test('metric history never sends the unsupported page_size=120', async () => {
  handle = ({ url }) => {
    assert.equal(url.searchParams.get('page_size'), '100');
    assert.equal(url.searchParams.get('interval'), 'day');
    return { ...page([{ actual: Number(url.searchParams.get('page')) }], Number(url.searchParams.get('page')), 2), metric_code: 'revenue' };
  };
  const response = await api.metricsApi.history('revenue', { page_size: 120, interval: 'day' });
  assert.deepEqual(response.items.map((item) => item.actual), [1, 2]);
  assert.equal(response.metric_code, 'revenue');
});

test('map preserves server facts and adapts metric references and evidence labels', async () => {
  handle = () => ({ data: graph });
  const response = await api.impactMapApi.get();
  assert.equal(response.data.nodes[0].entity_ref.code, 'revenue');
  assert.equal(response.data.nodes[0].context.actual, 1200);
  assert.equal(response.data.edges[0].source_label, 'ERP');
  assert.equal(response.data.graph_revision, 'revision');
});

test('node detail unwraps data.node', async () => {
  handle = () => ({ data: { node, detail: null, edges: [] } });
  assert.equal((await api.impactMapApi.node(node.id)).data.label, node.label);
});

test('graph filters use repeated edge_types query keys', async () => {
  handle = ({ url }) => {
    assert.deepEqual(url.searchParams.getAll('edge_types'), ['feeds', 'may_affect']);
    assert.equal(url.searchParams.has('edge_types[]'), false);
    return { data: graph };
  };
  await api.impactMapApi.neighbors(node.id, { edge_types: 'feeds,may_affect', depth: 2, direction: 'both' });
});

test('path availability follows the server graph', async () => {
  handle = () => ({ data: { ...graph, nodes: [], edges: [] } });
  const params = { from_node_id: 'first', to_node_id: node.id, depth: 3, direction: 'out' };
  assert.equal((await api.impactMapApi.path(params)).data.found, false);
  handle = () => ({ data: graph });
  assert.equal((await api.impactMapApi.path(params)).data.found, true);
});

test('AI sends request_key and only business context, then unwraps analysis', async () => {
  const requestKey = '661d35ac-05f1-4d34-a77f-9c33253af1bb';
  handle = ({ body }) => {
    assert.equal(body.request_key, requestKey);
    assert.deepEqual(Object.keys(body.context).sort(), ['date_from', 'date_to', 'department_id', 'product_id']);
    return { data: { id: 'analysis', analysis: { summary: 'Server summary', draft_text: 'Server draft', suggested_responsible: 'owner' },
      context: graph.context, graph_revision: 'revision', model: 'free', generated_at: graph.generated_at, cached: false } };
  };
  const response = await api.impactMapApi.analyze({ metric_code: 'revenue', graph_revision: 'revision', context: { ...graph.context, timezone: 'Europe/Minsk', ignored_filters: [] } }, requestKey);
  assert.equal(response.data.summary, 'Server summary');
  assert.equal(response.data.draft_text, 'Server draft');
  assert.equal(response.data.suggested_responsible, 'owner');
});

const unauthorized = { status: 401, body: { detail: { code: 'AUTH_TOKEN_EXPIRED', message: 'Expired' } } };
test('parallel 401s including auth/me share one refresh and retry with the new token', async () => {
  let refreshes = 0;
  api.tokenStore.set('expired');
  handle = async ({ url, headers }) => {
    if (url.pathname.endsWith('/auth/refresh')) {
      refreshes += 1;
      await new Promise((resolve) => setTimeout(resolve, 40));
      return { data: { access_token: 'fresh' } };
    }
    return headers.authorization === 'Bearer fresh' ? { data: { id: 'user' } } : unauthorized;
  };
  const results = await Promise.all([api.authApi.me(), api.ordersApi.get('order')]);
  assert.equal(refreshes, 1);
  assert.equal(results[0].data.id, 'user');
});

test('failed refresh clears the session once; 403 preserves it', async () => {
  let resets = 0;
  api.setUnauthorizedHandler(() => { resets += 1; });
  api.tokenStore.set('expired');
  handle = () => unauthorized;
  await assert.rejects(api.ordersApi.get('order'), { status: 401 });
  assert.equal(resets, 1);
  assert.equal(api.tokenStore.get(), null);
  api.tokenStore.set('valid');
  handle = () => ({ status: 403, body: { detail: { code: 'AUTH_FORBIDDEN', message: 'Forbidden' } } });
  await assert.rejects(api.ordersApi.get('order'), { status: 403 });
  assert.equal(resets, 1);
  assert.equal(api.tokenStore.get(), 'valid');
  api.setUnauthorizedHandler(null);
});

test('data-quality overview sends no unsupported period query', async () => {
  handle = ({ url }) => { assert.equal(url.search, ''); return { data: {} }; };
  await api.dataQualityApi.overview({ date_from: '2026-11-01', product_id: 'product' });
});

test('workflow uses nested references and serializes dates at the end of Minsk day', async () => {
  handle = ({ method, body }) => {
    if (method === 'POST' || method === 'PATCH') assert.equal(body.deadline, '2026-12-01T23:59:59.999+03:00');
    return { data: { id: 'task', department: { id: 'department', name: 'Production' }, decision: { id: 'decision', name: 'Review' }, alert_title: 'Stored alert' } };
  };
  const task = await api.tasksApi.create({ deadline: '2026-12-01' });
  assert.equal(task.data.department_name, 'Production');
  assert.equal(task.data.decision_title, 'Review');
  const decision = await api.decisionsApi.update('decision', { version: 1, deadline: '2026-12-01' });
  assert.equal(decision.data.department_name, 'Production');
  assert.equal(decision.data.alert_title, 'Stored alert');
});

test('customer detail fetches all real orders instead of expecting inline mock orders', async () => {
  handle = ({ url }) => url.pathname.includes('/customers/')
    ? { data: { customer: { id: 'customer', source: 'crm', name: 'Customer' }, orders_url: '/api/v1/orders?customer_id=customer' } }
    : (assert.equal(url.searchParams.get('customer_id'), 'customer'), page([{ id: 'order' }]));
  const response = await api.customersApi.get('customer');
  assert.equal(response.data.name, 'Customer');
  assert.equal(response.data.source, 'crm');
  assert.equal(response.data.orders[0].id, 'order');
});

test('forecast and current queue send only their supported filters', async () => {
  handle = ({ url }) => {
    assert.equal(url.searchParams.has('date_from'), false);
    assert.equal(url.searchParams.get('department_id'), 'department');
    return { data: {} };
  };
  await api.forecastApi.get({ date_from: '2026-11-01', department_id: 'department' });
  await api.productionApi.queue({ date_from: '2026-11-01', department_id: 'department' });
});

test('alert closing carries the user comment', async () => {
  handle = ({ body }) => { assert.deepEqual(body, { status: 'resolved', comment: 'Checked by operator' }); return { data: {} }; };
  await api.alertsApi.updateStatus('alert', 'resolved', 'Checked by operator');
});

test('chart ranges match backend limits and zero is retained while null creates a gap', () => {
  assert.equal(api.historyInterval('2026-01-01', '2026-01-31'), 'day');
  assert.equal(api.historyInterval('2026-01-01', '2026-02-01'), 'week');
  assert.equal(api.historyInterval('2026-01-01', '2026-12-31'), 'month');
  const graph = api.lineGeometry([{ actual: 0, target: 10 }, { actual: null, target: 10 }, { actual: -5, target: 10 }]);
  assert.equal(graph.hasData, true);
  assert.equal((graph.actual.match(/M/g) ?? []).length, 2);
  assert.equal(graph.actual.includes('NaN'), false);
  assert.equal(api.lineGeometry([{ actual: null, target: null }]).hasData, false);
});


test('API overview without positions renders its nodes and edges in the real canvas', async () => {
  const wire = { ...graph, nodes: [node, { ...node, id: 'risk-node', type: 'risk', label: 'Risk', entity_ref: null }] };
  handle = () => ({ data: wire });
  const response = await api.impactMapApi.get();
  assertCanvasDraws(response.data);
});

test('API neighborhood reuses the focused layout with the chosen KPI visible', async () => {
  const wire = { ...graph, nodes: [node, { ...node, id: 'risk-node', type: 'risk', label: 'Risk', entity_ref: null }] };
  handle = () => ({ data: wire });
  const response = await api.impactMapApi.neighbors(node.id, { depth: 2 });
  assertCanvasDraws(response.data);
  assert.deepEqual(response.data.nodes.find((item) => item.id === node.id).position, { x: 800, y: 460 });
});

test('API path nodes have usable positions and preserve server IDs and edges', async () => {
  const wire = { ...graph, nodes: [node, { ...node, id: 'risk-node', type: 'risk', label: 'Risk', entity_ref: null }] };
  handle = () => ({ data: wire });
  const response = await api.impactMapApi.path({ from_node_id: node.id, to_node_id: 'risk-node', depth: 2, direction: 'out' });
  assert.equal(response.data.found, true);
  assert.deepEqual(response.data.nodes.map((item) => item.id), wire.nodes.map((item) => item.id));
  assertCanvasDraws(response.data);
});
