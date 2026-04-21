'use client';

/**
 * GraphNode - Individual node in the knowledge graph visualization
 * Phase 16 Implementation
 */

import React, { useState } from 'react';
import type { EntityType } from '@/lib/knowledge-graph/types';
import type { GraphNode as GraphNodeType } from '@/lib/knowledge-graph/visualizationHelpers';
import { getNodeStyle } from '@/lib/knowledge-graph/visualizationHelpers';

interface GraphNodeProps {
  node: GraphNodeType;
  isSelected: boolean;
  isHighlighted: boolean;
  onSelect: (nodeId: string) => void;
  onDragStart: (nodeId: string, e: React.MouseEvent) => void;
  onHover: (nodeId: string | null) => void;
}

export function GraphNode({
  node,
  isSelected,
  isHighlighted,
  onSelect,
  onDragStart,
  onHover,
}: GraphNodeProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const style = getNodeStyle(node.type);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    onDragStart(node.id, e);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!e.defaultPrevented) {
      onSelect(node.id);
    }
  };

  return (
    <g
      transform={`translate(${node.x}, ${node.y})`}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onMouseEnter={() => {
        setShowTooltip(true);
        onHover(node.id);
      }}
      onMouseLeave={() => {
        setShowTooltip(false);
        onHover(null);
      }}
      style={{ cursor: 'pointer' }}
    >
      {/* Selection ring */}
      {isSelected && (
        <circle
          r={style.size / 2 + 6}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={3}
          className="animate-pulse"
        />
      )}

      {/* Highlight ring */}
      {isHighlighted && !isSelected && (
        <circle
          r={style.size / 2 + 4}
          fill="none"
          stroke={style.borderColor}
          strokeWidth={2}
          opacity={0.5}
        />
      )}

      {/* Node background */}
      <circle
        r={style.size / 2}
        fill={style.bgColor}
        stroke={style.borderColor}
        strokeWidth={2}
      />

      {/* Node icon */}
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={style.size * 0.4}
        style={{ userSelect: 'none', pointerEvents: 'none' }}
      >
        {style.icon}
      </text>

      {/* Node label */}
      <text
        y={style.size / 2 + 14}
        textAnchor="middle"
        fontSize={11}
        fontWeight={500}
        fill={style.color}
        style={{ userSelect: 'none', pointerEvents: 'none' }}
      >
        {truncateLabel(node.label, 15)}
      </text>

      {/* Tooltip */}
      {showTooltip && (
        <g transform={`translate(${style.size / 2 + 10}, -${style.size / 2})`}>
          <rect
            x={0}
            y={0}
            width={180}
            height={getTooltipHeight(node)}
            rx={6}
            fill="#1e293b"
            opacity={0.95}
          />
          <text x={10} y={18} fontSize={12} fontWeight={600} fill="white">
            {node.label}
          </text>
          <text x={10} y={34} fontSize={10} fill="#94a3b8">
            Type: {formatEntityType(node.type)}
          </text>
          {node.metadata && (
            <>
              {renderMetadataLines(node.metadata, 50)}
            </>
          )}
        </g>
      )}
    </g>
  );
}

function truncateLabel(label: string, maxLength: number): string {
  if (label.length <= maxLength) return label;
  return label.slice(0, maxLength - 1) + '…';
}

function formatEntityType(type: EntityType): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function getTooltipHeight(node: GraphNodeType): number {
  let height = 45;
  if (node.metadata) {
    const keys = Object.keys(node.metadata).slice(0, 4);
    height += keys.length * 14;
  }
  return height;
}

function renderMetadataLines(metadata: Record<string, unknown>, startY: number) {
  const lines: React.ReactNode[] = [];
  const entries = Object.entries(metadata).slice(0, 4);

  entries.forEach(([key, value], index) => {
    if (value === undefined || value === null) return;

    let displayValue = String(value);
    if (typeof value === 'number') {
      displayValue = value.toLocaleString();
    } else if (Array.isArray(value)) {
      displayValue = `${value.length} items`;
    } else if (typeof value === 'object') {
      return; // Skip nested objects
    }

    if (displayValue.length > 20) {
      displayValue = displayValue.slice(0, 17) + '...';
    }

    const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());

    lines.push(
      <text
        key={key}
        x={10}
        y={startY + index * 14}
        fontSize={9}
        fill="#cbd5e1"
      >
        {formattedKey}: {displayValue}
      </text>
    );
  });

  return lines;
}

export default GraphNode;
