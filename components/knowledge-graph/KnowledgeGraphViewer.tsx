'use client';

/**
 * KnowledgeGraphViewer - Interactive knowledge graph visualization
 * Phase 16 Implementation
 *
 * Features:
 * - Force-directed layout with drag and zoom
 * - Click-to-explore: clicking node queries related data
 * - Multiple entity types with distinct styling
 * - Edge labels showing relationship types
 * - Integration with AI chat for exploration
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { Entity, Relationship, EntityType, RelationshipType } from '@/lib/knowledge-graph/types';
import {
  GraphData,
  GraphNode as GraphNodeType,
  toGraphData,
  runSimulation,
  simulateForces,
  getNodeStyle,
  NODE_STYLES,
  summarizeGraph,
} from '@/lib/knowledge-graph/visualizationHelpers';
import { GraphNode } from './GraphNode';
import { GraphEdge, EdgeMarkerDefs } from './GraphEdge';

// ============================================================================
// Types
// ============================================================================

interface KnowledgeGraphViewerProps {
  entities: Entity[];
  relationships: Relationship[];
  onNodeSelect?: (entity: Entity) => void;
  onExploreRequest?: (entityId: string, query: string) => void;
  selectedNodeId?: string | null;
  width?: number;
  height?: number;
  showLabels?: boolean;
  showLegend?: boolean;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function KnowledgeGraphViewer({
  entities,
  relationships,
  onNodeSelect,
  onExploreRequest,
  selectedNodeId: externalSelectedId,
  width: propWidth,
  height: propHeight,
  showLabels = true,
  showLegend = true,
  className = '',
}: KnowledgeGraphViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Dimensions
  const [dimensions, setDimensions] = useState({ width: propWidth || 800, height: propHeight || 600 });

  // Graph state
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], edges: [] });
  const [isSimulating, setIsSimulating] = useState(false);

  // Interaction state
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(externalSelectedId || null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);

  // Pan and zoom
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  // ============================================================================
  // Effects
  // ============================================================================

  // Update dimensions on resize
  useEffect(() => {
    if (!containerRef.current || propWidth) return;

    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry) {
        setDimensions({
          width: entry.contentRect.width || 800,
          height: entry.contentRect.height || 600,
        });
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [propWidth]);

  // Initialize and simulate graph layout
  useEffect(() => {
    if (entities.length === 0) {
      setGraphData({ nodes: [], edges: [] });
      return;
    }

    setIsSimulating(true);

    // Convert to graph data and run initial simulation
    const initialData = toGraphData(entities, relationships, dimensions.width, dimensions.height);
    const simulatedData = runSimulation(initialData, dimensions.width, dimensions.height, 150);

    setGraphData(simulatedData);
    setIsSimulating(false);
  }, [entities, relationships, dimensions]);

  // Sync external selected node
  useEffect(() => {
    if (externalSelectedId !== undefined) {
      setSelectedNodeId(externalSelectedId);
    }
  }, [externalSelectedId]);

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleNodeSelect = useCallback((nodeId: string) => {
    setSelectedNodeId((prev: string | null) => prev === nodeId ? null : nodeId);

    const entity = entities.find(e => e.id === nodeId);
    if (entity && onNodeSelect) {
      onNodeSelect(entity);
    }
  }, [entities, onNodeSelect]);

  const handleNodeDragStart = useCallback((nodeId: string, e: React.MouseEvent) => {
    e.preventDefault();
    setDraggedNodeId(nodeId);

    // Fix the node position
    setGraphData((prev: GraphData) => ({
      ...prev,
      nodes: prev.nodes.map(n =>
        n.id === nodeId ? { ...n, fx: n.x, fy: n.y } : n
      ),
    }));
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (draggedNodeId) {
      const svg = svgRef.current;
      if (!svg) return;

      const rect = svg.getBoundingClientRect();
      const x = (e.clientX - rect.left - transform.x) / transform.scale;
      const y = (e.clientY - rect.top - transform.y) / transform.scale;

      setGraphData((prev: GraphData) => ({
        ...prev,
        nodes: prev.nodes.map(n =>
          n.id === draggedNodeId ? { ...n, x, y, fx: x, fy: y } : n
        ),
      }));
    } else if (isPanning) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      panStartRef.current = { x: e.clientX, y: e.clientY };

      setTransform((prev: { x: number; y: number; scale: number }) => ({
        ...prev,
        x: prev.x + dx,
        y: prev.y + dy,
      }));
    }
  }, [draggedNodeId, isPanning, transform]);

  const handleMouseUp = useCallback(() => {
    if (draggedNodeId) {
      // Release the fixed position but keep the node where it is
      setGraphData((prev: GraphData) => ({
        ...prev,
        nodes: prev.nodes.map(n =>
          n.id === draggedNodeId ? { ...n, fx: null, fy: null } : n
        ),
      }));
      setDraggedNodeId(null);
    }
    setIsPanning(false);
  }, [draggedNodeId]);

  const handlePanStart = useCallback((e: React.MouseEvent) => {
    // Only start panning if not clicking on a node
    if ((e.target as SVGElement).tagName === 'svg' || (e.target as SVGElement).tagName === 'rect') {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX, y: e.clientY };
    }
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const scaleChange = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(3, Math.max(0.3, transform.scale * scaleChange));

    // Zoom towards mouse position
    const rect = svgRef.current?.getBoundingClientRect();
    if (rect) {
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      setTransform((prev: { x: number; y: number; scale: number }) => ({
        x: mouseX - (mouseX - prev.x) * (newScale / prev.scale),
        y: mouseY - (mouseY - prev.y) * (newScale / prev.scale),
        scale: newScale,
      }));
    }
  }, [transform.scale]);

  const handleExplore = useCallback((nodeId: string) => {
    const node = graphData.nodes.find(n => n.id === nodeId);
    if (node && onExploreRequest) {
      onExploreRequest(nodeId, `Show me relationships for ${node.label}`);
    }
  }, [graphData.nodes, onExploreRequest]);

  const handleResetView = useCallback(() => {
    setTransform({ x: 0, y: 0, scale: 1 });
  }, []);

  // ============================================================================
  // Derived state
  // ============================================================================

  const nodeMap = useMemo(() =>
    new Map(graphData.nodes.map(n => [n.id, n])),
    [graphData.nodes]
  );

  const highlightedNodeIds = useMemo(() => {
    const ids = new Set<string>();
    if (hoveredNodeId) {
      ids.add(hoveredNodeId);
      // Add connected nodes
      graphData.edges.forEach(e => {
        if (e.source === hoveredNodeId) ids.add(e.target);
        if (e.target === hoveredNodeId) ids.add(e.source);
      });
    }
    if (hoveredEdgeId) {
      const edge = graphData.edges.find(e => e.id === hoveredEdgeId);
      if (edge) {
        ids.add(edge.source);
        ids.add(edge.target);
      }
    }
    return ids;
  }, [hoveredNodeId, hoveredEdgeId, graphData.edges]);

  const entityTypes = useMemo(() => {
    const types = new Set<EntityType>();
    graphData.nodes.forEach(n => types.add(n.type));
    return Array.from(types);
  }, [graphData.nodes]);

  // ============================================================================
  // Render
  // ============================================================================

  if (entities.length === 0) {
    return (
      <div className={`flex items-center justify-center bg-slate-50 rounded-lg ${className}`} style={{ height: dimensions.height }}>
        <div className="text-center text-slate-500">
          <div className="text-4xl mb-2">🔗</div>
          <p className="text-sm">No entities to display</p>
          <p className="text-xs mt-1">Ask about candidates, offices, or jurisdictions to build the graph</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative bg-slate-50 rounded-lg overflow-hidden ${className}`}
      style={{ width: propWidth || '100%', height: propHeight || dimensions.height }}
    >
      {/* Loading indicator */}
      {isSimulating && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10">
          <div className="text-slate-600 text-sm">Calculating layout...</div>
        </div>
      )}

      {/* Controls */}
      <div className="absolute top-2 right-2 z-10 flex gap-1">
        <button
          onClick={handleResetView}
          className="px-2 py-1 text-xs bg-white border border-slate-200 rounded hover:bg-slate-50"
          title="Reset view"
        >
          Reset
        </button>
        <button
          onClick={() => setTransform((t: { x: number; y: number; scale: number }) => ({ ...t, scale: Math.min(3, t.scale * 1.2) }))}
          className="px-2 py-1 text-xs bg-white border border-slate-200 rounded hover:bg-slate-50"
        >
          +
        </button>
        <button
          onClick={() => setTransform((t: { x: number; y: number; scale: number }) => ({ ...t, scale: Math.max(0.3, t.scale / 1.2) }))}
          className="px-2 py-1 text-xs bg-white border border-slate-200 rounded hover:bg-slate-50"
        >
          −
        </button>
      </div>

      {/* Legend */}
      {showLegend && entityTypes.length > 0 && (
        <div className="absolute bottom-2 left-2 z-10 bg-white/90 rounded-lg p-2 border border-slate-200">
          <div className="text-xs font-medium text-slate-600 mb-1">Entity Types</div>
          <div className="flex flex-wrap gap-2">
            {entityTypes.map(type => {
              const style = getNodeStyle(type);
              return (
                <div key={type} className="flex items-center gap-1 text-xs">
                  <span
                    className="w-3 h-3 rounded-full border"
                    style={{ backgroundColor: style.bgColor, borderColor: style.borderColor }}
                  />
                  <span className="text-slate-600 capitalize">{type}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Graph summary */}
      <div className="absolute top-2 left-2 z-10 text-xs text-slate-500">
        {graphData.nodes.length} entities • {graphData.edges.length} relationships
      </div>

      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        onMouseDown={handlePanStart}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
      >
        <EdgeMarkerDefs />

        {/* Background for panning */}
        <rect
          width={dimensions.width}
          height={dimensions.height}
          fill="transparent"
        />

        {/* Transformed group */}
        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
          {/* Render edges first (behind nodes) */}
          <g className="edges">
            {graphData.edges.map(edge => {
              const sourceNode = nodeMap.get(edge.source);
              const targetNode = nodeMap.get(edge.target);
              if (!sourceNode || !targetNode) return null;

              const isHighlighted =
                highlightedNodeIds.has(edge.source) && highlightedNodeIds.has(edge.target) ||
                hoveredEdgeId === edge.id;

              return (
                <GraphEdge
                  key={edge.id}
                  edge={edge}
                  sourceNode={sourceNode}
                  targetNode={targetNode}
                  isHighlighted={isHighlighted}
                  showLabel={showLabels && isHighlighted}
                  onHover={setHoveredEdgeId}
                />
              );
            })}
          </g>

          {/* Render nodes on top */}
          <g className="nodes">
            {graphData.nodes.map(node => (
              <GraphNode
                key={node.id}
                node={node}
                isSelected={selectedNodeId === node.id}
                isHighlighted={highlightedNodeIds.has(node.id)}
                onSelect={handleNodeSelect}
                onDragStart={handleNodeDragStart}
                onHover={setHoveredNodeId}
              />
            ))}
          </g>
        </g>
      </svg>

      {/* Selected node actions */}
      {selectedNodeId && (
        <div className="absolute bottom-2 right-2 z-10 bg-white rounded-lg p-3 border border-slate-200 shadow-lg max-w-xs">
          {(() => {
            const node = graphData.nodes.find(n => n.id === selectedNodeId);
            if (!node) return null;
            const style = getNodeStyle(node.type);

            return (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{style.icon}</span>
                  <div>
                    <div className="font-medium text-sm">{node.label}</div>
                    <div className="text-xs text-slate-500 capitalize">{node.type}</div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleExplore(selectedNodeId)}
                    className="flex-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Explore relationships
                  </button>
                  <button
                    onClick={() => setSelectedNodeId(null)}
                    className="px-2 py-1 text-xs bg-slate-100 text-slate-600 rounded hover:bg-slate-200"
                  >
                    ✕
                  </button>
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

export default KnowledgeGraphViewer;
