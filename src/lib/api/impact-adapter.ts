import type { ImpactAnalysis, ImpactContext, ImpactEdge, ImpactGraph, ImpactNode } from '@/features/impact-map/types';

export type ServerNode = Omit<ImpactNode, 'entity_ref'> & {
  entity_ref: { type: string; id: string } | null;
};
export type ServerGraph = Omit<ImpactGraph, 'nodes' | 'edges'> & {
  nodes: ServerNode[];
  edges: (Omit<ImpactEdge, 'source_label'> & { evidence_source: string })[];
};
export interface ServerNodeDetail { node: ServerNode }
export interface ServerAnalysis {
  id: string;
  analysis: Omit<ImpactAnalysis, 'context' | 'graph_revision' | 'model' | 'generated_at' | 'cached'>;
  context: ImpactContext;
  graph_revision: string;
  model: string;
  generated_at: string;
  cached: boolean;
}

export function businessContext(context: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(['date_from', 'date_to', 'department_id', 'product_id']
    .filter((key) => context[key] !== undefined)
    .map((key) => [key, context[key]]));
}

export function graphParams(params?: Record<string, unknown>): Record<string, unknown> {
  const result = { ...params };
  if (typeof result.edge_types === 'string') {
    result.edge_types = result.edge_types ? result.edge_types.split(',') : [];
  }
  return result;
}

export function adaptNode(node: ServerNode): ImpactNode {
  return {
    ...node,
    entity_ref: node.entity_ref?.type === 'metric'
      ? { ...node.entity_ref, code: node.entity_ref.id }
      : node.entity_ref,
    // KPI facts are server metadata; keep the selected business context too.
    context: { ...node.context, ...node.metadata },
  };
}

export function adaptGraph(graph: ServerGraph): ImpactGraph {
  return {
    ...graph,
    nodes: graph.nodes.map(adaptNode),
    edges: graph.edges.map((edge) => ({ ...edge, source_label: edge.evidence_source })),
  };
}

export function adaptAnalysis(response: ServerAnalysis): ImpactAnalysis {
  return { ...response.analysis, context: response.context, graph_revision: response.graph_revision,
    model: response.model, generated_at: response.generated_at, cached: response.cached };
}
