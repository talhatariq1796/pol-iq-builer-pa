'use client';

/**
 * GraphEdge - Edge/relationship rendering for knowledge graph
 * Phase 16 Implementation
 */

import React from 'react';
import type { GraphNode, GraphEdge as GraphEdgeType } from '@/lib/knowledge-graph/visualizationHelpers';
import {
  getEdgeStyle,
  getNodeStyle,
  calculateEdgePath,
  calculateArrowHead,
  calculateEdgeLabelPosition,
} from '@/lib/knowledge-graph/visualizationHelpers';

interface GraphEdgeProps {
  edge: GraphEdgeType;
  sourceNode: GraphNode;
  targetNode: GraphNode;
  isHighlighted: boolean;
  showLabel: boolean;
  curved?: boolean;
  onHover: (edgeId: string | null) => void;
}

export function GraphEdge({
  edge,
  sourceNode,
  targetNode,
  isHighlighted,
  showLabel,
  curved = true,
  onHover,
}: GraphEdgeProps) {
  const style = getEdgeStyle(edge.type);
  const targetStyle = getNodeStyle(targetNode.type);

  const path = calculateEdgePath(sourceNode, targetNode, curved);
  const arrow = style.arrowHead
    ? calculateArrowHead(sourceNode, targetNode, targetStyle.size / 2 + 4)
    : null;
  const labelPos = calculateEdgeLabelPosition(sourceNode, targetNode);

  const strokeWidth = isHighlighted ? 2.5 : 1.5;
  const opacity = isHighlighted ? 1 : 0.6;

  return (
    <g
      onMouseEnter={() => onHover(edge.id)}
      onMouseLeave={() => onHover(null)}
      style={{ cursor: 'pointer' }}
    >
      {/* Edge path */}
      <path
        d={path}
        fill="none"
        stroke={style.color}
        strokeWidth={strokeWidth}
        strokeDasharray={style.dashArray}
        opacity={opacity}
        markerEnd={style.arrowHead ? `url(#arrow-${edge.type})` : undefined}
      />

      {/* Arrow head (manual drawing for better control) */}
      {arrow && (
        <polygon
          points="-8,-4 0,0 -8,4"
          fill={style.color}
          transform={`translate(${arrow.x}, ${arrow.y}) rotate(${arrow.rotation})`}
          opacity={opacity}
        />
      )}

      {/* Edge label */}
      {showLabel && edge.label && (
        <text
          x={labelPos.x}
          y={labelPos.y - 6}
          textAnchor="middle"
          fontSize={9}
          fill={style.color}
          opacity={isHighlighted ? 1 : 0.7}
          style={{
            userSelect: 'none',
            pointerEvents: 'none',
          }}
          transform={`rotate(${labelPos.rotation}, ${labelPos.x}, ${labelPos.y - 6})`}
        >
          {edge.label}
        </text>
      )}

      {/* Invisible wider path for easier hovering */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={12}
      />
    </g>
  );
}

/**
 * SVG Defs for arrow markers
 */
export function EdgeMarkerDefs() {
  const types = [
    'RUNNING_FOR', 'MEMBER_OF', 'ENDORSED_BY', 'SUPPORTS', 'OPPOSES',
    'REPRESENTS', 'CONTAINS', 'PART_OF', 'FUNDED_BY', 'GOVERNS',
    'INCUMBENT', 'WON', 'LOST', 'SALIENT_IN', 'SUPPORTS_ISSUE', 'OPPOSES_ISSUE',
  ];

  return (
    <defs>
      {types.map(type => {
        const style = getEdgeStyle(type as any);
        return (
          <marker
            key={type}
            id={`arrow-${type}`}
            viewBox="0 -5 10 10"
            refX={8}
            refY={0}
            markerWidth={6}
            markerHeight={6}
            orient="auto"
          >
            <path d="M0,-5L10,0L0,5" fill={style.color} />
          </marker>
        );
      })}
    </defs>
  );
}

export default GraphEdge;
