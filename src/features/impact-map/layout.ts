import type { ImpactGraph, ImpactNode } from './types';

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

/** Shared with mock transport: geometry belongs to the frontend, not the API. */
export function layoutOverviewNodes(nodes: ImpactNode[]): ImpactNode[] {
  const rowsByColumn = new Map<number, number>();
  const metricCount = nodes.filter((node) => node.type === 'metric').length;
  let metricIndex = 0;
  return nodes.map((node) => {
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
}

export function layoutFocusedGraph(graph: ImpactGraph, rootId: string, maxDepth: number): ImpactGraph {
  const upstream = new Map<string, number>();
  const downstream = new Map<string, number>();
  const connected = new Map<string, number>();
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
  const queue = [rootId];
  connected.set(rootId, 0);
  while (queue.length) {
    const current = queue.shift()!;
    const distance = connected.get(current)!;
    if (distance >= maxDepth) continue;
    for (const edge of graph.edges) {
      const next = edge.source === current ? edge.target : edge.target === current ? edge.source : null;
      if (next && !connected.has(next)) { connected.set(next, distance + 1); queue.push(next); }
    }
  }
  const xForNode = (node: ImpactNode) => {
    if (node.id === rootId) return 800;
    const up = upstream.get(node.id);
    const down = downstream.get(node.id);
    const distance = up !== undefined ? up : down !== undefined ? down : connected.get(node.id) ?? 1;
    const side = up !== undefined ? -1 : down !== undefined ? 1 : connected.get(node.id) !== undefined ? -1 : 1;
    return 800 + side * distance * 235;
  };
  const nodesByLane = new Map<number, ImpactNode[]>();
  graph.nodes.forEach((node) => {
    const x = xForNode(node);
    const lane = nodesByLane.get(x) ?? [];
    lane.push(node);
    nodesByLane.set(x, lane);
  });
  const positions = new Map<string, { x: number; y: number }>();
  nodesByLane.forEach((lane, x) => {
    const ordered = lane.filter((node) => node.id !== rootId).sort((a, b) => a.type.localeCompare(b.type) || a.label.localeCompare(b.label));
    ordered.forEach((node, index) => positions.set(node.id, { x, y: 460 + (index - (ordered.length - 1) / 2) * 145 }));
  });
  positions.set(rootId, { x: 800, y: 460 });
  const nodes = graph.nodes.map((node) => ({ ...node, position: positions.get(node.id) ?? { x: 800, y: 460 } }));
  return { ...graph, nodes };
}
