import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowRight, Compass, Focus, GitBranch, Lightbulb, Network, RotateCcw, Search, ShieldCheck, ZoomIn, ZoomOut } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { GlobalFilters } from '@/components/filters/GlobalFilters';
import { useFilters } from '@/components/filters/FiltersContext';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback/States';
import { impactMapApi } from '@/lib/api/endpoints';
import { toApiError, USE_MOCKS } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDate, formatDateTime, formatUnit } from '@/lib/formatters';
import { cn } from '@/lib/utils/cn';
import type { EvidenceType, ImpactDirection, ImpactEdge, ImpactEdgeType, ImpactGraph, ImpactNode, ImpactPath } from './types';

const KIND_LABEL: Record<ImpactNode['type'], string> = {
  source: 'Источник', department: 'Подразделение', process: 'Процесс', entity: 'Объект',
  event: 'Событие', metric: 'Показатель', risk: 'Риск', decision: 'Решение',
};
const RELATION_LABEL: Record<ImpactEdgeType, string> = {
  feeds: 'передаёт данные', belongs_to: 'относится к', depends_on: 'зависит от',
  may_affect: 'может влиять на', produces: 'формирует', mitigated_by: 'связано с действием',
};
const EVIDENCE_LABEL: Record<EvidenceType, string> = {
  verified: 'Подтверждённая связь', calculated: 'Расчётная связь', correlated: 'Корреляция', hypothesis: 'Гипотеза',
};
const EDGE_TYPES: ImpactEdgeType[] = ['feeds', 'belongs_to', 'depends_on', 'may_affect', 'produces', 'mitigated_by'];
const EVIDENCE_COLOR: Record<EvidenceType, string> = {
  verified: '#8190a8', calculated: '#5b8df7', correlated: '#a78bfa', hypothesis: '#e8a34a',
};
const KIND_COLOR: Record<ImpactNode['type'], string> = {
  source: '#5b8df7', department: '#7b8798', process: '#40b6aa', entity: '#6bb7a3',
  event: '#a78bfa', metric: '#91a9ff', risk: '#e8a34a', decision: '#7ec7ea',
};
const NODE_W = 194;
const NODE_H = 100;
const CANVAS_W = 1600;
const CANVAS_H = 920;

function textValue(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function nodeHref(node: ImpactNode): string | null {
  const ref = node.entity_ref;
  if (!ref) return null;
  if (ref.type === 'metric' && ref.code) return `/metrics/${ref.code}`;
  if (ref.type === 'alert' && ref.id) return `/alerts/${ref.id}`;
  if (ref.type === 'task' && ref.id) return `/tasks/${ref.id}`;
  if (ref.type === 'order' && ref.id) return `/orders/${ref.id}`;
  if (ref.type === 'decision' && ref.id) return `/decisions/${ref.id}`;
  if (ref.type === 'department') return '/production';
  if (ref.type === 'source') return '/data-quality';
  return null;
}

function EvidenceBadge({ type }: { type: EvidenceType }) {
  return <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-200"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: EVIDENCE_COLOR[type] }} />{EVIDENCE_LABEL[type]}</span>;
}

function relationPath(source: ImpactNode, target: ImpactNode): string {
  const dx = target.position!.x - source.position!.x;
  const dy = target.position!.y - source.position!.y;
  const sx = source.position!.x + Math.sign(dx || 1) * NODE_W / 2;
  const tx = target.position!.x - Math.sign(dx || 1) * NODE_W / 2;
  const curve = Math.max(44, Math.abs(dx) * 0.42);
  return `M ${sx} ${source.position!.y} C ${sx + Math.sign(dx || 1) * curve} ${source.position!.y + dy * 0.08}, ${tx - Math.sign(dx || 1) * curve} ${target.position!.y - dy * 0.08}, ${tx} ${target.position!.y}`;
}

function impactSides(graph: ImpactGraph, root: string | null) {
  const walk = (forward: boolean) => {
    const visited = new Set<string>();
    const queue = [root].filter((id): id is string => Boolean(id)).map((id) => ({ id, depth: 0 }));
    while (queue.length) {
      const current = queue.shift()!;
      if (current.depth >= 3) continue;
      for (const edge of graph.edges) {
        const next = forward ? (edge.source === current.id ? edge.target : null) : (edge.target === current.id ? edge.source : null);
        if (next && !visited.has(next) && next !== root) {
          visited.add(next);
          queue.push({ id: next, depth: current.depth + 1 });
        }
      }
    }
    return visited;
  };
  return { upstream: walk(false), downstream: walk(true) };
}

function ImpactCanvas({ graph, selectedNode, selectedEdge, showAllEdges, path, onNode, onEdge }: {
  graph: ImpactGraph; selectedNode: string | null; selectedEdge: string | null;
  showAllEdges: boolean;
  path: ImpactPath | null; onNode: (node: ImpactNode) => void; onEdge: (edge: ImpactEdge) => void;
}) {
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const [drag, setDrag] = useState<{ pointerId: number; x: number; y: number } | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const nodeMap = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node])), [graph.nodes]);
  const pathNodeIds = new Set(path?.nodes.map((node) => node.id) ?? []);
  const pathEdgeIds = new Set(path?.edges.map((edge) => edge.id) ?? []);
  const { upstream, downstream } = impactSides(graph, selectedNode);
  const directUpstream = new Set(graph.edges.filter((edge) => edge.target === selectedNode).map((edge) => edge.source));
  const directDownstream = new Set(graph.edges.filter((edge) => edge.source === selectedNode).map((edge) => edge.target));
  const edgeSource = graph.edges.find((edge) => edge.id === selectedEdge)?.source;
  const edgeTarget = graph.edges.find((edge) => edge.id === selectedEdge)?.target;
  const visibleEdgeIds = new Set<string>();
  if (selectedNode && !showAllEdges) {
    const visited = new Set([selectedNode]);
    const queue = [selectedNode];
    while (queue.length) {
      const current = queue.shift()!;
      graph.edges.forEach((edge) => {
        if (edge.source !== current && edge.target !== current) return;
        const next = edge.source === current ? edge.target : edge.source;
        if (edge.source === selectedNode || edge.target === selectedNode) visibleEdgeIds.add(edge.id);
        if (!visited.has(next)) { visited.add(next); visibleEdgeIds.add(edge.id); queue.push(next); }
      });
    }
  }
  const renderEdges = selectedNode && !showAllEdges ? graph.edges.filter((edge) => visibleEdgeIds.has(edge.id)) : graph.edges;
  const scaleBy = (delta: number) => setView((current) => ({ ...current, scale: Math.max(0.55, Math.min(1.65, current.scale + delta)) }));

  return (
    <div className="relative h-[560px] overflow-hidden rounded-xl border border-ink-700 bg-[#090d14] sm:h-[650px] xl:h-[min(74vh,820px)]" ref={host}>
      <div className="pointer-events-none absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(#52627a 0.7px, transparent 0.7px)', backgroundSize: '22px 22px' }} />
      <svg
        className={cn('absolute inset-0 h-full w-full touch-none', drag ? 'cursor-grabbing' : 'cursor-grab')}
        viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
        role="img"
        aria-label="Интерактивная карта связей показателей, процессов и рисков"
        onWheel={(event) => { event.preventDefault(); scaleBy(event.deltaY < 0 ? 0.07 : -0.07); }}
        onPointerDown={(event) => {
          const target = event.target as Element;
          if (target.closest('[data-map-node="true"], [data-map-edge="true"]')) return;
          setDrag({ pointerId: event.pointerId, x: event.clientX, y: event.clientY });
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!drag || drag.pointerId !== event.pointerId) return;
          const box = host.current?.getBoundingClientRect();
          if (!box) return;
          const dx = (event.clientX - drag.x) * CANVAS_W / box.width;
          const dy = (event.clientY - drag.y) * CANVAS_H / box.height;
          setView((current) => ({ ...current, x: current.x + dx, y: current.y + dy }));
          setDrag({ ...drag, x: event.clientX, y: event.clientY });
        }}
        onPointerUp={() => setDrag(null)}
        onPointerCancel={() => setDrag(null)}
      >
        <defs>
          <filter id="map-glow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          {Object.entries(EVIDENCE_COLOR).map(([evidence, color]) => <marker key={evidence} id={`arrow-${evidence}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 1 L 9 5 L 0 9 z" fill={color} /></marker>)}
        </defs>
        <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
          {renderEdges.map((edge) => {
            const source = nodeMap.get(edge.source); const target = nodeMap.get(edge.target);
            if (!source?.position || !target?.position) return null;
            const onPath = pathEdgeIds.has(edge.id);
            const leadsToFocus = Boolean(selectedNode && edge.target === selectedNode);
            const flowsFromFocus = Boolean(selectedNode && edge.source === selectedNode);
            const relationColor = selectedEdge === edge.id || onPath ? '#8db0ff' : leadsToFocus ? '#f2a65a' : flowsFromFocus ? '#53d3c2' : EVIDENCE_COLOR[edge.evidence_type];
            const active = selectedEdge === edge.id || onPath;
            const dimmed = Boolean(path && !onPath);
            return <g key={edge.id} data-map-edge="true" opacity={dimmed ? 0.12 : 1} onClick={(event) => { event.stopPropagation(); onEdge(edge); }} className="cursor-pointer transition-opacity">
              <path d={relationPath(source, target)} fill="none" stroke="transparent" strokeWidth="18" />
              <path d={relationPath(source, target)} fill="none" stroke={relationColor} strokeWidth={selectedEdge === edge.id ? 5 : onPath ? 3.5 : leadsToFocus || flowsFromFocus ? 2.6 : 1.5} strokeOpacity={active || leadsToFocus || flowsFromFocus ? 0.95 : 0.38} strokeDasharray={edge.evidence_type === 'hypothesis' ? '7 6' : edge.evidence_type === 'correlated' ? '3 5' : undefined} markerEnd={`url(#arrow-${edge.evidence_type})`} filter={active ? 'url(#map-glow)' : undefined} />
              {(selectedEdge === edge.id || onPath) && <text fontSize="11" fontWeight="700" paintOrder="stroke" stroke="#080d16" strokeWidth="4" fill="#e5edff" textAnchor="middle" x={(source.position.x + target.position.x) / 2} y={(source.position.y + target.position.y) / 2 - 9}>{RELATION_LABEL[edge.type]}</text>}
            </g>;
          })}
          {graph.nodes.map((node) => {
            const position = node.position;
            if (!position) return null;
            const active = selectedNode === node.id;
            const edgeEndpoint = node.id === edgeSource || node.id === edgeTarget;
            const onPath = pathNodeIds.has(node.id);
            const inUpstream = directUpstream.has(node.id);
            const inDownstream = directDownstream.has(node.id);
            const indirect = upstream.has(node.id) || downstream.has(node.id);
            const dimmed = Boolean(path && !onPath) || Boolean(selectedNode && !active && !indirect);
            const relationColor = inUpstream && inDownstream ? '#c3a0ff' : inUpstream ? '#f2a65a' : '#53d3c2';
            const actual = node.type === 'metric' ? node.context?.actual : null;
            const target = node.type === 'metric' ? node.context?.target : null;
            const unit = node.type === 'metric' ? textValue(node.context?.unit) : '';
            const valueText = actual === null || actual === undefined ? '' : `${formatUnit(typeof actual === 'number' ? actual : null, unit)}${target === null || target === undefined ? '' : ` / ${formatUnit(typeof target === 'number' ? target : null, unit)}`}`;
            return <g key={node.id} data-map-node="true" opacity={dimmed ? 0.24 : 1} transform={`translate(${position.x - NODE_W / 2},${position.y - NODE_H / 2})`} className="cursor-pointer transition-opacity" onClick={(event) => { event.stopPropagation(); onNode(node); }} role="button" tabIndex={0} aria-label={`${KIND_LABEL[node.type]}: ${node.label}`} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onNode(node); } }}>
              {(active || edgeEndpoint || inUpstream || inDownstream) && <rect x="-7" y="-7" width={NODE_W + 14} height={NODE_H + 14} rx="18" fill={active ? '#5790ff' : edgeEndpoint ? '#8db0ff' : relationColor} fillOpacity={active || edgeEndpoint ? '.16' : '.08'} stroke={active ? '#83a9ff' : edgeEndpoint ? '#b8ceff' : relationColor} strokeWidth={active || edgeEndpoint ? 2.5 : 1.4} />}
              <rect width={NODE_W} height={NODE_H} rx="13" fill={active ? '#182947' : edgeEndpoint ? '#22324d' : inUpstream || inDownstream ? '#17242d' : '#111925'} stroke={active || edgeEndpoint || onPath ? '#8fb0ff' : inUpstream || inDownstream ? relationColor : KIND_COLOR[node.type]} strokeWidth={active || edgeEndpoint ? 4 : onPath ? 3 : inUpstream || inDownstream ? 2.5 : 1.2} strokeOpacity={active || edgeEndpoint || onPath || inUpstream || inDownstream ? 1 : 0.58} filter={active || edgeEndpoint ? 'url(#map-glow)' : undefined} />
              <rect x="1" y="1" width="4" height={NODE_H - 2} rx="2" fill={KIND_COLOR[node.type]} />
              <circle cx="19" cy="20" r="4" fill={KIND_COLOR[node.type]} />
              <text x="30" y="24" fontSize="10" letterSpacing=".5" fill="#9ba8bc">{KIND_LABEL[node.type].toLocaleUpperCase('ru-RU')}</text>
              <text x="15" y="48" fontSize="13" fontWeight="600" fill="#f1f5fb">{node.label.length > 23 ? `${node.label.slice(0, 22)}…` : node.label}</text>
              <text x="15" y="68" fontSize="10.5" fill={valueText ? '#9bb6ff' : '#93a0b4'}>{valueText || (node.status ? `${node.status} · ${node.description.slice(0, 22)}` : node.description.slice(0, 26))}</text>
              {node.status && node.type === 'metric' && <text x={NODE_W - 12} y="24" fontSize="9" fill={node.status === 'critical' ? '#f08b7c' : node.status === 'warning' ? '#e9b360' : '#73c5a0'} textAnchor="end">{node.status === 'critical' ? 'КРИТИЧНО' : node.status === 'warning' ? 'ВНИМАНИЕ' : node.status === 'no_data' ? 'НЕТ ДАННЫХ' : 'НОРМА'}</text>}
            </g>;
          })}
        </g>
      </svg>
      <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-lg border border-ink-700 bg-ink-900/95 p-1 shadow-lg">
        <button className="rounded-md p-2 text-ink-200 hover:bg-ink-800" aria-label="Уменьшить масштаб" onClick={() => scaleBy(-0.12)}><ZoomOut className="h-4 w-4" /></button>
        <span className="w-12 text-center text-[11px] tabular-nums text-ink-300">{Math.round(view.scale * 100)}%</span>
        <button className="rounded-md p-2 text-ink-200 hover:bg-ink-800" aria-label="Увеличить масштаб" onClick={() => scaleBy(0.12)}><ZoomIn className="h-4 w-4" /></button>
        <span className="mx-1 h-5 w-px bg-ink-700" />
        <button className="rounded-md p-2 text-ink-200 hover:bg-ink-800" aria-label="Сбросить перемещение и масштаб" onClick={() => setView({ x: 0, y: 0, scale: 1 })}><Focus className="h-4 w-4" /></button>
      </div>
      <div className="absolute left-3 top-3 rounded-lg border border-ink-700 bg-ink-900/90 px-2.5 py-1.5 text-[10px] text-ink-400">Перемещайте карту мышью · масштаб — колёсиком</div>
    </div>
  );
}

function NodeDetails({ node, edges, graph, onClose, onAnalyze }: { node: ImpactNode | null; edges: ImpactEdge[]; graph: ImpactGraph; onClose: () => void; onAnalyze: () => void }) {
  if (!node) return <Card className="flex min-h-52 flex-col items-center justify-center text-center"><Compass className="mb-3 h-6 w-6 text-accent-300" /><p className="text-sm font-medium text-ink-100">Выберите элемент карты</p><p className="mt-1 max-w-xs text-xs text-ink-400">Здесь появятся факты, связи, источник и переход к исходной карточке.</p></Card>;
  const facts = node.context ?? {};
  const href = nodeHref(node);
  return <Card className="space-y-4">
    <div className="flex items-start justify-between gap-3"><div><Badge tone="accent">{KIND_LABEL[node.type]}</Badge><h2 className="mt-2 text-base font-semibold text-ink-50">{node.label}</h2></div><button className="rounded-md px-2 py-1 text-xs text-ink-400 hover:bg-ink-800" onClick={onClose}>Снять выбор</button></div>
    <p className="text-xs leading-relaxed text-ink-300">{node.description}</p>
    {node.status && <p className="text-xs text-ink-300">Статус: <span className="font-medium text-ink-100">{node.status}</span></p>}
    {node.type === 'metric' && <dl className="grid grid-cols-2 gap-2 rounded-lg border border-ink-700 bg-ink-850 p-3 text-xs">
      {[['Факт', facts.actual === null ? 'Нет данных' : formatUnit(typeof facts.actual === 'number' ? facts.actual : null, textValue(facts.unit))], ['План', facts.target === null ? 'Нет данных' : formatUnit(typeof facts.target === 'number' ? facts.target : null, textValue(facts.unit))], ['Отклонение', facts.deviation_percent == null ? '—' : `${textValue(facts.deviation_percent)}%`], ['Источник', Array.isArray(facts.source) ? facts.source.join(', ') : '—']].map(([label, value]) => <div key={label}><dt className="text-ink-500">{label}</dt><dd className="mt-1 font-medium text-ink-100">{value}</dd></div>)}
    </dl>}
    {node.updated_at && <p className="text-[11px] text-ink-500">Обновлено {formatDateTime(node.updated_at)}</p>}
    {href && <Link to={href} className="inline-flex items-center gap-1.5 text-xs font-medium text-accent-300 hover:text-accent-200">Открыть исходную карточку <ArrowRight className="h-3.5 w-3.5" /></Link>}
    {node.type === 'metric' && <Button variant="outline" className="w-full" icon={<Lightbulb className="h-4 w-4" />} onClick={onAnalyze}>Разобрать показатель</Button>}
    <div className="border-t border-ink-800 pt-3"><h3 className="mb-2 text-xs font-semibold text-ink-200">Связи · {edges.length}</h3>{edges.length ? <ul className="space-y-2">{edges.map((edge) => <li key={edge.id} className="rounded-lg border border-ink-800 bg-ink-850/70 p-2.5"><div className="flex items-center justify-between gap-2"><span className="text-[11px] text-ink-200">{RELATION_LABEL[edge.type]}</span><EvidenceBadge type={edge.evidence_type} /></div><p className="mt-1 text-[11px] leading-relaxed text-ink-400">{edge.description}</p><p className="mt-1 text-[10px] text-ink-500">Источник: {edge.source_label}</p></li>)}</ul> : <p className="text-[11px] text-ink-500">Связи в выбранном контексте не найдены.</p>}</div>
    {graph.truncated && <p className="text-[11px] text-signal-warn">Показана часть доступных связей. Уточните исследование.</p>}
  </Card>;
}

export function ImpactMapPage() {
  const { queryParams, filters } = useFilters();
  const { role, user, can } = useAuth();
  const [tab, setTab] = useState<'map' | 'analysis'>('map');
  const [search, setSearch] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [depth, setDepth] = useState(2);
  const [pathDirection, setPathDirection] = useState<ImpactDirection>('out');
  const [edgeTypes, setEdgeTypes] = useState<ImpactEdgeType[]>(EDGE_TYPES);
  const [showAllEdges, setShowAllEdges] = useState(false);
  const [path, setPath] = useState<ImpactPath | null>(null);
  const [analysisError, setAnalysisError] = useState('');
  const map = useQuery({ queryKey: ['impact-map', user?.id, role, queryParams], queryFn: async () => (await impactMapApi.get(queryParams)).data, staleTime: 20_000 });
  const nodeQuery = useQuery({ queryKey: ['impact-map-node', user?.id, selectedNodeId, queryParams], queryFn: async () => selectedNodeId ? (await impactMapApi.node(selectedNodeId, queryParams)).data : null, enabled: Boolean(selectedNodeId), staleTime: 15_000 });
  const neighbors = useQuery({ queryKey: ['impact-map-neighbors', user?.id, selectedNodeId, queryParams, depth, edgeTypes], queryFn: async () => selectedNodeId ? (await impactMapApi.neighbors(selectedNodeId, { ...queryParams, depth, direction: 'both', edge_types: edgeTypes.join(',') })).data : null, enabled: Boolean(selectedNodeId), staleTime: 15_000 });
  const pathSearch = useMutation({ mutationFn: async () => { if (!fromId || !toId || fromId === toId) throw new Error('Выберите две разные точки маршрута'); return (await impactMapApi.path({ ...queryParams, from_node_id: fromId, to_node_id: toId, depth, direction: pathDirection, edge_types: edgeTypes.join(',') })).data; }, onSuccess: (result) => { setPath(result); setSelectedNodeId(fromId); } });
  const analyze = useMutation({ mutationFn: async () => { const node = activeGraph?.nodes.find((item) => item.id === selectedNodeId); const code = node?.entity_ref?.code; if (!code) throw new Error('Выберите KPI, чтобы подготовить анализ'); return (await impactMapApi.analyze({ metric_code: code, graph_revision: activeGraph!.graph_revision, context: { ...activeGraph!.context } })).data; }, onSuccess: () => setAnalysisError(''), onError: (error) => setAnalysisError(toApiError(error).message) });

  const activeGraph = neighbors.data ?? map.data;
  const filterKey = JSON.stringify(queryParams);
  useEffect(() => { setPath(null); setSelectedNodeId(null); setSelectedEdgeId(null); }, [filterKey]);
  useEffect(() => { if (map.data?.nodes.length) { const firstKpi = map.data.nodes.find((node) => node.type === 'metric' && node.entity_ref?.code === 'on_time_orders') ?? map.data.nodes.find((node) => node.type === 'metric'); setFromId((current) => map.data!.nodes.some((node) => node.id === current) ? current : firstKpi?.id ?? map.data!.nodes[0]!.id); setToId((current) => map.data!.nodes.some((node) => node.id === current) ? current : map.data!.nodes.find((node) => node.type === 'risk')?.id ?? map.data!.nodes.at(-1)!.id); if (!selectedNodeId && firstKpi) setSelectedNodeId(firstKpi.id); } }, [map.data]);

  const nodes = activeGraph?.nodes ?? [];
  const edges = activeGraph?.edges ?? [];
  const selectedNode = nodeQuery.data ?? nodes.find((node) => node.id === selectedNodeId) ?? null;
  const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId) ?? null;
  const connectedEdges = selectedNodeId ? edges.filter((edge) => edge.source === selectedNodeId || edge.target === selectedNodeId) : [];
  const searchResults = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('ru-RU');
    if (!term) return [];
    return nodes.filter((node) => `${node.label} ${node.description} ${KIND_LABEL[node.type]}`.toLocaleLowerCase('ru-RU').includes(term)).slice(0, 6);
  }, [nodes, search]);

  if (map.isLoading) return <LoadingState label="Собираем карту доступных связей…" />;
  if (map.error) return <ErrorState title="Карта пока недоступна" message={toApiError(map.error).message} onRetry={() => void map.refetch()} />;
  if (!map.data || map.data.nodes.length === 0) return <EmptyState title="В этом контексте пока нет связей" description="Попробуйте изменить период или фильтры. Для сотрудника здесь показываются только назначенные ему задачи." icon={<Network className="h-5 w-5" />} />;

  return <div className="space-y-5">
    <PageHeader title="Карта влияния" description="Выберите KPI, чтобы сразу увидеть, что влияет на него и на что влияет он. Связь сама по себе не доказывает причину." meta={<><Badge tone={USE_MOCKS ? 'warn' : 'ok'} dot>{USE_MOCKS ? 'Демо-данные' : 'Данные сервера'}</Badge><Badge tone="idle">{map.data.nodes.length} элементов · {map.data.edges.length} связей</Badge><Badge tone="idle">Период: {formatDate(filters.date_from)} — {formatDate(filters.date_to)}</Badge></>} actions={<Button variant="outline" size="sm" icon={<RotateCcw className="h-3.5 w-3.5" />} onClick={() => { setPath(null); setSelectedNodeId(null); void map.refetch(); }}>Общий обзор</Button>} />
    {role !== 'employee' && <GlobalFilters />}
    {role === 'employee' && <div className="rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-xs text-ink-300">Показана только ваша рабочая область: назначенные задачи и прямо связанные записи.</div>}

    <div className="flex flex-wrap gap-2 border-b border-ink-800 pb-3" role="tablist" aria-label="Разделы карты влияния">
      {[['map', 'Карта', Network], ['analysis', 'AI-разбор', Lightbulb]].map(([key, label, Icon]) => <button key={key as string} role="tab" aria-selected={tab === key} onClick={() => setTab(key as typeof tab)} className={cn('inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition', tab === key ? 'bg-ink-800 text-ink-50 ring-1 ring-ink-600' : 'text-ink-400 hover:bg-ink-900 hover:text-ink-200')}><Icon className="h-4 w-4" />{label as string}</button>)}
      <span className="ml-auto hidden items-center gap-1.5 self-center text-[11px] text-ink-500 sm:inline-flex"><ShieldCheck className="h-3.5 w-3.5" />Доступные данные вашей роли</span>
    </div>

    {tab === 'analysis' ? <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card><div className="flex items-start justify-between gap-3"><div><h2 className="text-base font-semibold text-ink-50">AI-анализ выбранного KPI</h2><p className="mt-1 text-xs leading-relaxed text-ink-400">Модель может предложить гипотезы, но не меняет связи и не отправляет поручения. Факты и выводы будут показаны отдельно.</p></div><Button variant="primary" size="sm" loading={analyze.isPending} disabled={!can('impactMap.view') || role === 'employee' || !selectedNodeId} icon={<Lightbulb className="h-4 w-4" />} onClick={() => analyze.mutate()}>Подготовить анализ</Button></div>
        {analysisError && <div className="mt-4 rounded-lg border border-signal-warn/30 bg-signal-warn/5 p-3 text-xs text-ink-200"><p className="font-medium">Сервис анализа недоступен</p><p className="mt-1 text-ink-400">{analysisError}</p><p className="mt-2 text-ink-500">Демо API не подменяет ответ модели заранее подготовленным текстом.</p></div>}
        {analyze.data && <div className="mt-4 space-y-3"><p className="rounded-lg bg-ink-850 p-3 text-sm text-ink-100">{analyze.data.summary}</p>{(['verified_facts','calculated_dependencies','correlations','hypotheses','recommendations','data_gaps'] as const).map((field) => <section key={field}><h3 className="text-xs font-semibold text-ink-200">{{ verified_facts: 'Подтверждённые факты', calculated_dependencies: 'Расчётные зависимости', correlations: 'Корреляции', hypotheses: 'Гипотезы', recommendations: 'Предложения', data_gaps: 'Пробелы данных' }[field]}</h3><ul className="mt-1 space-y-1">{analyze.data[field].map((item, index) => <li key={`${field}-${index}`} className="text-xs text-ink-400">{item.text}</li>)}</ul></section>)}</div>}
        {!analysisError && !analyze.data && <EmptyState title="Выберите KPI на карте" description="Затем нажмите «Разобрать показатель». Анализ использует только текущий фильтр и разрешённые связи." icon={<Lightbulb className="h-5 w-5" />} />}
      </Card>
      <NodeDetails node={selectedNode} edges={connectedEdges} graph={activeGraph!} onClose={() => setSelectedNodeId(null)} onAnalyze={() => analyze.mutate()} />
    </div> : <>
      <Card className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_180px_180px_190px_auto] lg:items-end">
        <label className="block"><span className="mb-1.5 block text-xs font-medium text-ink-300">Найти показатель, риск или запись</span><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-500" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Например: срок, брак, выручка" className="h-9 w-full rounded-lg border border-ink-700 bg-ink-950 pl-9 pr-3 text-sm text-ink-100 placeholder:text-ink-500 focus:border-accent-400 focus:outline-none" /></div></label>
        <label className="block text-xs text-ink-400">Начать от<select value={fromId} onChange={(event) => setFromId(event.target.value)} className="mt-1.5 h-9 w-full rounded-lg border border-ink-700 bg-ink-950 px-2 text-xs text-ink-100">{nodes.map((node) => <option key={node.id} value={node.id}>{KIND_LABEL[node.type]} · {node.label}</option>)}</select></label>
        <label className="block text-xs text-ink-400">Найти путь до<select value={toId} onChange={(event) => setToId(event.target.value)} className="mt-1.5 h-9 w-full rounded-lg border border-ink-700 bg-ink-950 px-2 text-xs text-ink-100">{nodes.map((node) => <option key={node.id} value={node.id}>{KIND_LABEL[node.type]} · {node.label}</option>)}</select></label>
        <label className="block text-xs text-ink-400">Направление пути<select value={pathDirection} onChange={(event) => setPathDirection(event.target.value as ImpactDirection)} className="mt-1.5 h-9 w-full rounded-lg border border-ink-700 bg-ink-950 px-2 text-xs text-ink-100"><option value="out">По направлению стрелок</option><option value="in">К источнику</option><option value="both">В обе стороны</option></select></label>
        <Button variant="primary" size="sm" loading={pathSearch.isPending} icon={<GitBranch className="h-4 w-4" />} onClick={() => pathSearch.mutate()}>Найти цепочку</Button>
        {search && <div className="lg:col-span-4"><p className="mb-2 text-[11px] text-ink-500">Совпадения в доступной карте</p>{searchResults.length ? <div className="flex flex-wrap gap-2">{searchResults.map((node) => <button key={node.id} onClick={() => { setSelectedNodeId(node.id); setFromId(node.id); }} className="rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-left hover:border-accent-500/60"><span className="block text-[10px] text-ink-500">{KIND_LABEL[node.type]}</span><span className="text-xs font-medium text-ink-100">{node.label}</span></button>)}</div> : <p className="text-xs text-ink-400">В этой области совпадений нет.</p>}</div>}
        {pathSearch.error && <p className="lg:col-span-4 text-xs text-signal-warn">{toApiError(pathSearch.error).message}</p>}
        {path && <p className={cn('lg:col-span-4 text-xs', path.found ? 'text-signal-ok' : 'text-signal-warn')}>{path.found ? `Показан кратчайший доступный путь: ${path.nodes.length} точек. Это маршрут исследования, а не доказательство причинности.` : 'Путь в выбранном направлении не найден. Измените направление, глубину или тип связей.'}</p>}
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-3">
          <Card className="space-y-3 p-3 sm:p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-semibold text-ink-200">Связи выбранного KPI</span>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-400/30 bg-amber-400/10 px-2 py-1.5 text-[11px] text-amber-200"><i className="h-2 w-2 rounded-full bg-amber-300" />Что влияет на него</span>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-teal-400/30 bg-teal-400/10 px-2 py-1.5 text-[11px] text-teal-200"><i className="h-2 w-2 rounded-full bg-teal-300" />На что влияет он</span>
              <div className="ml-auto inline-flex items-center gap-2 text-[11px] text-ink-400"><span>Связей по цепочке</span><button onClick={() => setDepth((value) => Math.max(1, value - 1))} disabled={depth <= 1} className="h-7 w-7 rounded-md border border-ink-700 disabled:opacity-40" aria-label="Уменьшить глубину">−</button><span className="w-4 text-center font-semibold text-ink-100">{depth}</span><button onClick={() => setDepth((value) => Math.min(3, value + 1))} disabled={depth >= 3} className="h-7 w-7 rounded-md border border-ink-700 disabled:opacity-40" aria-label="Увеличить глубину">+</button></div>
              <button className="rounded-lg border border-ink-700 px-3 py-2 text-[11px] text-ink-300 hover:bg-ink-850" aria-pressed={showAllEdges} onClick={() => setShowAllEdges((value) => !value)}>{showAllEdges ? 'Скрыть лишние стрелки' : 'Показать все стрелки'}</button>
              <details className="relative"><summary className="cursor-pointer list-none rounded-lg border border-ink-700 px-3 py-2 text-[11px] text-ink-300 hover:bg-ink-850">Типы связей · {edgeTypes.length === EDGE_TYPES.length ? 'Все' : edgeTypes.length}</summary><div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-ink-700 bg-ink-900 p-3 shadow-xl"><div className="mb-2 flex justify-between text-[11px]"><span className="font-medium text-ink-100">Оставить на карте</span><button className="text-accent-300" onClick={(event) => { event.preventDefault(); setEdgeTypes(EDGE_TYPES); }}>Выбрать все</button></div>{EDGE_TYPES.map((type) => <label key={type} className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1.5 text-xs text-ink-300 hover:bg-ink-800"><input type="checkbox" checked={edgeTypes.includes(type)} onChange={(event) => setEdgeTypes((current) => event.target.checked ? [...current, type] : current.length > 1 ? current.filter((item) => item !== type) : current)} className="accent-blue-500" />{RELATION_LABEL[type]}</label>)}<p className="mt-2 text-[10px] text-ink-500">Оставьте хотя бы один тип. Фильтр применяется ко всему обходу и поиску пути.</p></div></details>
            </div>
            {neighbors.isFetching && <p className="text-[11px] text-ink-500">Обновляю связи в выбранном направлении…</p>}
            {neighbors.error && <p className="text-xs text-signal-warn">Не удалось раскрыть связи: {toApiError(neighbors.error).message}</p>}
          </Card>
          {selectedNode && <p className="rounded-lg border border-accent-500/20 bg-accent-500/5 px-3 py-2 text-xs text-ink-200">Показаны связи для <b>{selectedNode.label}</b>. <button className="ml-1 text-accent-300 hover:text-accent-200" onClick={() => { setSelectedNodeId(null); setPath(null); setSelectedEdgeId(null); }}>Сбросить фокус</button></p>}
          <ImpactCanvas graph={activeGraph!} selectedNode={selectedNodeId} selectedEdge={selectedEdgeId} showAllEdges={showAllEdges} path={path} onNode={(node) => { setSelectedNodeId(node.id); setSelectedEdgeId(null); setPath(null); }} onEdge={(edge) => { setSelectedEdgeId(edge.id); setPath(null); }} />
          <div className="flex flex-wrap gap-x-4 gap-y-2 px-1">{(['verified','calculated','correlated','hypothesis'] as EvidenceType[]).map((type) => <EvidenceBadge key={type} type={type} />)}</div>
        </div>
        {selectedEdge ? <Card className="space-y-4"><div className="flex items-center justify-between"><h2 className="text-sm font-semibold text-ink-50">Связь</h2><button className="text-xs text-ink-400 hover:text-ink-100" onClick={() => setSelectedEdgeId(null)}>Закрыть</button></div><p className="text-sm text-ink-100">{RELATION_LABEL[selectedEdge.type]}</p><EvidenceBadge type={selectedEdge.evidence_type} /><p className="text-xs leading-relaxed text-ink-300">{selectedEdge.description}</p><div className="rounded-lg border border-ink-800 bg-ink-850 p-3 text-xs"><p className="text-ink-500">Источник связи</p><p className="mt-1 text-ink-100">{selectedEdge.source_label}</p><p className="mt-2 break-all font-mono text-[10px] text-ink-500">{selectedEdge.evidence_refs.join(', ') || 'Нет подтверждающих ссылок'}</p></div><p className="text-[11px] leading-relaxed text-ink-500">Стрелка показывает направление. У гипотезы штриховая линия; она не является подтверждённой причинностью.</p></Card> : <NodeDetails node={selectedNode} edges={connectedEdges} graph={activeGraph!} onClose={() => setSelectedNodeId(null)} onAnalyze={() => { setTab('analysis'); analyze.mutate(); }} />}
      </div>
      {map.data.context.ignored_filters?.length ? <p className="text-[11px] text-signal-warn">Часть фильтров не применяется к выбранным показателям: {map.data.context.ignored_filters.join(', ')}.</p> : null}
      <p className="text-[10px] text-ink-600">Карта обновлена {formatDateTime(map.data.generated_at)} · редакция {map.data.graph_revision}{map.data.truncated ? ' · показана часть разрешённых данных' : ''}</p>
    </>}
  </div>;
}
