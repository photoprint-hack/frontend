export type ImpactNodeType = 'source' | 'department' | 'process' | 'entity' | 'event' | 'metric' | 'risk' | 'decision';
export type ImpactEdgeType = 'feeds' | 'belongs_to' | 'depends_on' | 'may_affect' | 'produces' | 'mitigated_by';
export type EvidenceType = 'verified' | 'calculated' | 'correlated' | 'hypothesis';

export interface ImpactEntityRef {
  type: string;
  id?: string;
  code?: string;
}

export interface ImpactNode {
  id: string;
  type: ImpactNodeType;
  label: string;
  description: string;
  entity_ref?: ImpactEntityRef | null;
  status?: string | null;
  context?: Record<string, unknown>;
  updated_at?: string | null;
  allowed_actions: string[];
  metadata?: Record<string, unknown>;
  position?: { x: number; y: number };
}

export interface ImpactEdge {
  id: string;
  source: string;
  target: string;
  type: ImpactEdgeType;
  evidence_type: EvidenceType;
  description: string;
  source_label: string;
  evidence_refs: string[];
  valid_from?: string | null;
  valid_to?: string | null;
}

export interface ImpactContext {
  date_from: string;
  date_to: string;
  timezone: 'Europe/Minsk' | string;
  department_id: string | null;
  product_id: string | null;
  ignored_filters?: string[];
}

export interface ImpactGraph {
  nodes: ImpactNode[];
  edges: ImpactEdge[];
  context: ImpactContext;
  graph_revision: string;
  generated_at: string;
  truncated: boolean;
}

export interface ImpactPath {
  nodes: ImpactNode[];
  edges: ImpactEdge[];
  found: boolean;
  graph_revision: string;
}

export interface ImpactAnalysisItem {
  text: string;
  refs: string[];
}

export interface ImpactAnalysis {
  summary: string;
  changes: ImpactAnalysisItem[];
  verified_facts: ImpactAnalysisItem[];
  calculated_dependencies: ImpactAnalysisItem[];
  correlations: ImpactAnalysisItem[];
  hypotheses: ImpactAnalysisItem[];
  possible_impacts: ImpactAnalysisItem[];
  recommendations: ImpactAnalysisItem[];
  data_gaps: ImpactAnalysisItem[];
  suggested_responsible: { id: string; full_name: string } | null;
  context: ImpactContext;
  graph_revision: string;
  model: string;
  generated_at: string;
  cached: boolean;
}

export type ImpactDirection = 'in' | 'out' | 'both';
