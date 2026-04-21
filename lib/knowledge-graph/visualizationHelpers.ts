/**
 * Knowledge Graph Visualization Helpers
 * Phase 16 Implementation
 *
 * Provides force-directed layout calculations and styling utilities
 * for rendering the knowledge graph as an interactive visualization.
 */

import type { Entity, EntityType, Relationship, RelationshipType } from './types';

// ============================================================================
// Types for Visualization
// ============================================================================

export interface GraphNode {
  id: string;
  type: EntityType;
  label: string;
  x: number;
  y: number;
  vx: number; // Velocity for force simulation
  vy: number;
  fx?: number | null; // Fixed position (when dragging)
  fy?: number | null;
  metadata?: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: RelationshipType;
  label: string;
  weight?: number;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface ForceSimulationConfig {
  centerForce: number;
  chargeForce: number;
  linkDistance: number;
  linkStrength: number;
  collisionRadius: number;
  alpha: number;
  alphaDecay: number;
}

// ============================================================================
// Node Styling Configuration
// ============================================================================

export const NODE_STYLES: Record<EntityType, {
  color: string;
  bgColor: string;
  borderColor: string;
  icon: string;
  size: number;
}> = {
  candidate: {
    color: '#1e40af',
    bgColor: '#dbeafe',
    borderColor: '#3b82f6',
    icon: '👤',
    size: 48,
  },
  office: {
    color: '#7c2d12',
    bgColor: '#fed7aa',
    borderColor: '#ea580c',
    icon: '🏛️',
    size: 44,
  },
  party: {
    color: '#166534',
    bgColor: '#dcfce7',
    borderColor: '#22c55e',
    icon: '🎪',
    size: 40,
  },
  jurisdiction: {
    color: '#6b21a8',
    bgColor: '#f3e8ff',
    borderColor: '#a855f7',
    icon: '🗺️',
    size: 44,
  },
  precinct: {
    color: '#0e7490',
    bgColor: '#cffafe',
    borderColor: '#06b6d4',
    icon: '📍',
    size: 36,
  },
  issue: {
    color: '#b91c1c',
    bgColor: '#fecaca',
    borderColor: '#ef4444',
    icon: '📌',
    size: 36,
  },
  organization: {
    color: '#4338ca',
    bgColor: '#e0e7ff',
    borderColor: '#6366f1',
    icon: '🏢',
    size: 40,
  },
  event: {
    color: '#0369a1',
    bgColor: '#e0f2fe',
    borderColor: '#0ea5e9',
    icon: '📅',
    size: 36,
  },
  poll: {
    color: '#a21caf',
    bgColor: '#fae8ff',
    borderColor: '#d946ef',
    icon: '📊',
    size: 36,
  },
  election: {
    color: '#b45309',
    bgColor: '#fef3c7',
    borderColor: '#f59e0b',
    icon: '🗳️',
    size: 44,
  },
};

// ============================================================================
// Edge Styling Configuration
// ============================================================================

export const EDGE_STYLES: Partial<Record<RelationshipType, {
  color: string;
  dashArray?: string;
  arrowHead: boolean;
  label: string;
}>> = {
  RUNNING_FOR: { color: '#3b82f6', arrowHead: true, label: 'running for' },
  MEMBER_OF: { color: '#22c55e', arrowHead: true, label: 'member of' },
  ENDORSED_BY: { color: '#f59e0b', arrowHead: true, label: 'endorsed by' },
  SUPPORTS: { color: '#22c55e', arrowHead: true, label: 'supports' },
  OPPOSES: { color: '#ef4444', dashArray: '5,5', arrowHead: true, label: 'opposes' },
  REPRESENTS: { color: '#8b5cf6', arrowHead: true, label: 'represents' },
  CONTAINS: { color: '#6b7280', arrowHead: false, label: 'contains' },
  PART_OF: { color: '#6b7280', dashArray: '3,3', arrowHead: true, label: 'part of' },
  FUNDED_BY: { color: '#10b981', arrowHead: true, label: 'funded by' },
  GOVERNS: { color: '#8b5cf6', arrowHead: true, label: 'governs' },
  INCUMBENT: { color: '#3b82f6', arrowHead: true, label: 'incumbent' },
  WON: { color: '#22c55e', arrowHead: true, label: 'won' },
  LOST: { color: '#ef4444', dashArray: '5,5', arrowHead: true, label: 'lost' },
  SALIENT_IN: { color: '#ef4444', arrowHead: true, label: 'salient in' },
  SUPPORTS_ISSUE: { color: '#22c55e', arrowHead: true, label: 'supports' },
  OPPOSES_ISSUE: { color: '#ef4444', dashArray: '5,5', arrowHead: true, label: 'opposes' },
};

const DEFAULT_EDGE_STYLE: {
  color: string;
  dashArray?: string;
  arrowHead: boolean;
  label: string;
} = {
  color: '#9ca3af',
  arrowHead: true,
  label: '',
};

// ============================================================================
// Force Simulation
// ============================================================================

const DEFAULT_CONFIG: ForceSimulationConfig = {
  centerForce: 0.1,
  chargeForce: -300,
  linkDistance: 120,
  linkStrength: 0.7,
  collisionRadius: 50,
  alpha: 1,
  alphaDecay: 0.02,
};

/**
 * Convert entities and relationships to graph data
 */
export function toGraphData(
  entities: Entity[],
  relationships: Relationship[],
  width: number,
  height: number
): GraphData {
  const nodes: GraphNode[] = entities.map((entity, index) => {
    // Initialize with random positions around center
    const angle = (index / entities.length) * 2 * Math.PI;
    const radius = Math.min(width, height) * 0.3;

    return {
      id: entity.id,
      type: entity.type,
      label: entity.name,
      x: width / 2 + Math.cos(angle) * radius,
      y: height / 2 + Math.sin(angle) * radius,
      vx: 0,
      vy: 0,
      metadata: entity.metadata,
    };
  });

  const nodeIds = new Set(entities.map(e => e.id));
  const edges: GraphEdge[] = relationships
    .filter(rel => nodeIds.has(rel.sourceId) && nodeIds.has(rel.targetId))
    .map(rel => ({
      id: rel.id,
      source: rel.sourceId,
      target: rel.targetId,
      type: rel.type,
      label: EDGE_STYLES[rel.type]?.label || rel.type.toLowerCase().replace(/_/g, ' '),
      weight: rel.weight,
    }));

  return { nodes, edges };
}

/**
 * Simple force-directed layout simulation step
 */
export function simulateForces(
  data: GraphData,
  width: number,
  height: number,
  config: Partial<ForceSimulationConfig> = {}
): GraphData {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const nodes = data.nodes.map(n => ({ ...n }));
  const edges = data.edges;

  // Create node lookup
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  // Apply forces
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.fx !== undefined && node.fx !== null) continue; // Skip fixed nodes

    // Center force
    node.vx += (width / 2 - node.x) * cfg.centerForce;
    node.vy += (height / 2 - node.y) * cfg.centerForce;

    // Charge (repulsion) force between all nodes
    for (let j = 0; j < nodes.length; j++) {
      if (i === j) continue;
      const other = nodes[j];

      const dx = node.x - other.x;
      const dy = node.y - other.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      if (dist < cfg.collisionRadius * 3) {
        const force = cfg.chargeForce / (dist * dist);
        node.vx += (dx / dist) * force * 0.1;
        node.vy += (dy / dist) * force * 0.1;
      }
    }
  }

  // Link forces
  for (const edge of edges) {
    const source = nodeMap.get(edge.source);
    const target = nodeMap.get(edge.target);
    if (!source || !target) continue;

    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    const force = (dist - cfg.linkDistance) * cfg.linkStrength;

    const fx = (dx / dist) * force;
    const fy = (dy / dist) * force;

    if (source.fx === undefined || source.fx === null) {
      source.vx += fx;
      source.vy += fy;
    }
    if (target.fx === undefined || target.fx === null) {
      target.vx -= fx;
      target.vy -= fy;
    }
  }

  // Update positions and apply velocity decay
  const decay = 1 - cfg.alphaDecay;
  for (const node of nodes) {
    if (node.fx !== undefined && node.fx !== null) {
      node.x = node.fx;
      node.y = node.fy!;
      node.vx = 0;
      node.vy = 0;
    } else {
      node.vx *= decay;
      node.vy *= decay;
      node.x += node.vx;
      node.y += node.vy;

      // Boundary constraints
      const margin = 50;
      node.x = Math.max(margin, Math.min(width - margin, node.x));
      node.y = Math.max(margin, Math.min(height - margin, node.y));
    }
  }

  return { nodes, edges };
}

/**
 * Run simulation until stable
 */
export function runSimulation(
  data: GraphData,
  width: number,
  height: number,
  iterations: number = 100,
  config?: Partial<ForceSimulationConfig>
): GraphData {
  let result = data;
  for (let i = 0; i < iterations; i++) {
    result = simulateForces(result, width, height, config);
  }
  return result;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get node style by entity type
 */
export function getNodeStyle(type: EntityType) {
  return NODE_STYLES[type] || NODE_STYLES.candidate;
}

/**
 * Get edge style by relationship type
 */
export function getEdgeStyle(type: RelationshipType) {
  return EDGE_STYLES[type] || DEFAULT_EDGE_STYLE;
}

/**
 * Calculate edge path between two nodes
 */
export function calculateEdgePath(
  source: GraphNode,
  target: GraphNode,
  curved: boolean = true
): string {
  const dx = target.x - source.x;
  const dy = target.y - source.y;

  if (!curved) {
    return `M ${source.x} ${source.y} L ${target.x} ${target.y}`;
  }

  // Curved path using quadratic bezier
  const midX = (source.x + target.x) / 2;
  const midY = (source.y + target.y) / 2;

  // Perpendicular offset for curve
  const dist = Math.sqrt(dx * dx + dy * dy);
  const offset = Math.min(30, dist * 0.1);

  // Perpendicular direction
  const px = -dy / dist * offset;
  const py = dx / dist * offset;

  return `M ${source.x} ${source.y} Q ${midX + px} ${midY + py} ${target.x} ${target.y}`;
}

/**
 * Calculate arrow head position and rotation
 */
export function calculateArrowHead(
  source: GraphNode,
  target: GraphNode,
  nodeRadius: number
): { x: number; y: number; rotation: number } {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;

  // Position at edge of target node
  const x = target.x - (dx / dist) * nodeRadius;
  const y = target.y - (dy / dist) * nodeRadius;

  // Rotation in degrees
  const rotation = Math.atan2(dy, dx) * (180 / Math.PI);

  return { x, y, rotation };
}

/**
 * Calculate label position along edge
 */
export function calculateEdgeLabelPosition(
  source: GraphNode,
  target: GraphNode
): { x: number; y: number; rotation: number } {
  const midX = (source.x + target.x) / 2;
  const midY = (source.y + target.y) / 2;

  const dx = target.x - source.x;
  const dy = target.y - source.y;
  let rotation = Math.atan2(dy, dx) * (180 / Math.PI);

  // Keep text readable (not upside down)
  if (rotation > 90 || rotation < -90) {
    rotation += 180;
  }

  return { x: midX, y: midY, rotation };
}

/**
 * Find nodes within a radius of a point
 */
export function findNodesInRadius(
  nodes: GraphNode[],
  x: number,
  y: number,
  radius: number
): GraphNode[] {
  return nodes.filter(node => {
    const dx = node.x - x;
    const dy = node.y - y;
    return Math.sqrt(dx * dx + dy * dy) <= radius;
  });
}

/**
 * Generate a summary of the graph for AI responses
 */
export function summarizeGraph(data: GraphData): string {
  const nodesByType: Record<string, number> = {};
  for (const node of data.nodes) {
    nodesByType[node.type] = (nodesByType[node.type] || 0) + 1;
  }

  const edgesByType: Record<string, number> = {};
  for (const edge of data.edges) {
    edgesByType[edge.type] = (edgesByType[edge.type] || 0) + 1;
  }

  const parts: string[] = [
    `**Graph Summary**: ${data.nodes.length} entities, ${data.edges.length} relationships`,
    '',
    '**Entity Types**:',
  ];

  for (const [type, count] of Object.entries(nodesByType)) {
    const style = NODE_STYLES[type as EntityType];
    parts.push(`- ${style?.icon || '•'} ${type}: ${count}`);
  }

  if (Object.keys(edgesByType).length > 0) {
    parts.push('', '**Key Relationships**:');
    for (const [type, count] of Object.entries(edgesByType).slice(0, 5)) {
      parts.push(`- ${type.replace(/_/g, ' ')}: ${count}`);
    }
  }

  return parts.join('\n');
}
