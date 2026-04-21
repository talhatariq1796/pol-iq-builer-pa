/**
 * MapCommandBridge
 *
 * Bridge between AI responses and ArcGIS map operations.
 * Translates high-level map commands from AI into ArcGIS API calls.
 *
 * Key Responsibilities:
 * 1. Parse map commands from AI responses
 * 2. Execute map operations (zoom, pan, highlight, filter)
 * 3. Manage map state for AI context
 * 4. Queue commands for sequential execution
 */

import type { MapCommand, MapStyle } from './types';

// ============================================================================
// Types
// ============================================================================

export interface MapState {
  center: [number, number];
  zoom: number;
  highlightedFeatures: string[];
  activeFilters: Map<string, unknown>;
  visibleLayers: Set<string>;
  currentHeatmapMetric?: string;
}

export interface MapBridgeConfig {
  defaultCenter: [number, number];
  defaultZoom: number;
  animationDuration: number;
  maxHighlightedFeatures: number;
}

export type MapEventType =
  | 'command-executed'
  | 'state-changed'
  | 'error'
  | 'feature-selected'
  | 'bounds-changed';

export interface MapEvent {
  type: MapEventType;
  command?: MapCommand;
  data?: Record<string, unknown>;
  error?: Error;
}

export type MapEventHandler = (event: MapEvent) => void;

// ArcGIS map view interface (minimal for typing)
export interface ArcGISMapView {
  goTo: (target: unknown, options?: unknown) => Promise<void>;
  center: { longitude: number; latitude: number };
  zoom: number;
  extent: unknown;
  graphics: {
    removeAll: () => void;
    add: (graphic: unknown) => void;
  };
  map: {
    layers: {
      find: (predicate: (layer: unknown) => boolean) => unknown;
      forEach: (callback: (layer: unknown) => void) => void;
    };
    findLayerById: (id: string) => unknown;
  };
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: MapBridgeConfig = {
  // Ingham County, Michigan center
  defaultCenter: [-84.555, 42.732],
  defaultZoom: 10,
  animationDuration: 1000,
  maxHighlightedFeatures: 100,
};

// Precinct boundaries for Ingham County (approximate)
const INGHAM_COUNTY_BOUNDS: [number, number, number, number] = [
  -84.85, // west
  42.42,  // south
  -84.15, // east
  43.00,  // north
];

// Known jurisdiction centroids (for flyTo commands)
const JURISDICTION_CENTROIDS: Record<string, [number, number]> = {
  'lansing': [-84.5555, 42.7325],
  'east_lansing': [-84.4839, 42.7369],
  'meridian': [-84.4134, 42.7019],
  'delhi': [-84.5864, 42.6339],
  'williamston': [-84.2831, 42.6889],
  'mason': [-84.4434, 42.5792],
  'holt': [-84.5153, 42.6406],
  'okemos': [-84.4275, 42.7219],
  'haslett': [-84.4008, 42.7494],
};

// ============================================================================
// MapCommandBridge Implementation
// ============================================================================

export class MapCommandBridge {
  private static instance: MapCommandBridge;
  private mapView: ArcGISMapView | null = null;
  private config: MapBridgeConfig;
  private state: MapState;
  private commandQueue: MapCommand[] = [];
  private isProcessing = false;
  private eventHandlers: Map<MapEventType, Set<MapEventHandler>> = new Map();

  private constructor(config: Partial<MapBridgeConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = {
      center: this.config.defaultCenter,
      zoom: this.config.defaultZoom,
      highlightedFeatures: [],
      activeFilters: new Map(),
      visibleLayers: new Set(),
    };
  }

  static getInstance(config?: Partial<MapBridgeConfig>): MapCommandBridge {
    if (!MapCommandBridge.instance) {
      MapCommandBridge.instance = new MapCommandBridge(config);
    }
    return MapCommandBridge.instance;
  }

  // ---------------------------------------------------------------------------
  // Map View Management
  // ---------------------------------------------------------------------------

  /**
   * Register the ArcGIS map view
   */
  setMapView(view: ArcGISMapView): void {
    this.mapView = view;
    this.syncStateFromView();
    this.emit({ type: 'state-changed', data: { state: this.state } });
  }

  /**
   * Unregister the map view
   */
  clearMapView(): void {
    this.mapView = null;
  }

  /**
   * Check if map view is available
   */
  isReady(): boolean {
    return this.mapView !== null;
  }

  /**
   * Sync internal state from map view
   */
  private syncStateFromView(): void {
    if (!this.mapView) return;
    this.state.center = [
      this.mapView.center.longitude,
      this.mapView.center.latitude,
    ];
    this.state.zoom = this.mapView.zoom;
  }

  // ---------------------------------------------------------------------------
  // Command Execution
  // ---------------------------------------------------------------------------

  /**
   * Execute a single map command
   */
  async executeCommand(command: MapCommand): Promise<void> {
    this.commandQueue.push(command);
    await this.processQueue();
  }

  /**
   * Execute multiple map commands in sequence
   */
  async executeCommands(commands: MapCommand[]): Promise<void> {
    this.commandQueue.push(...commands);
    await this.processQueue();
  }

  /**
   * Process the command queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.commandQueue.length === 0) return;

    this.isProcessing = true;

    while (this.commandQueue.length > 0) {
      const command = this.commandQueue.shift();
      if (!command) continue;

      try {
        await this.executeCommandInternal(command);
        this.emit({ type: 'command-executed', command });
      } catch (error) {
        this.emit({
          type: 'error',
          command,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    }

    this.isProcessing = false;
  }

  /**
   * Execute a single command (internal)
   */
  private async executeCommandInternal(command: MapCommand): Promise<void> {
    switch (command.type) {
      case 'zoom':
        await this.handleZoom(command);
        break;
      case 'pan':
        await this.handlePan(command);
        break;
      case 'flyTo':
        await this.handleFlyTo(command);
        break;
      case 'highlight':
        await this.handleHighlight(command);
        break;
      case 'clearHighlight':
        await this.handleClearHighlight();
        break;
      case 'filter':
        await this.handleFilter(command);
        break;
      case 'clearFilter':
        await this.handleClearFilter(command);
        break;
      case 'showLayer':
        await this.handleShowLayer(command);
        break;
      case 'hideLayer':
        await this.handleHideLayer(command);
        break;
      case 'showHeatmap':
        await this.handleShowHeatmap(command);
        break;
      case 'showChoropleth':
        await this.handleShowChoropleth(command);
        break;
      case 'clear':
        await this.handleClear();
        break;
      default:
        console.warn('Unknown map command type:', command.type);
    }
  }

  // ---------------------------------------------------------------------------
  // Command Handlers
  // ---------------------------------------------------------------------------

  private async handleZoom(command: MapCommand): Promise<void> {
    if (!this.mapView) return;

    const zoom = command.zoom ?? this.state.zoom + 1;
    await this.mapView.goTo(
      { zoom },
      { duration: command.animation !== false ? this.config.animationDuration : 0 }
    );
    this.state.zoom = zoom;
  }

  private async handlePan(command: MapCommand): Promise<void> {
    if (!this.mapView || !command.center) return;

    await this.mapView.goTo(
      { center: command.center },
      { duration: command.animation !== false ? this.config.animationDuration : 0 }
    );
    this.state.center = command.center;
  }

  private async handleFlyTo(command: MapCommand): Promise<void> {
    if (!this.mapView) return;

    let center = command.center;
    let zoom = command.zoom ?? 12;

    // If target is a jurisdiction name, look up centroid
    if (command.target && typeof command.target === 'string') {
      const key = command.target.toLowerCase().replace(/\s+/g, '_');
      if (JURISDICTION_CENTROIDS[key]) {
        center = JURISDICTION_CENTROIDS[key];
      }
    }

    // If bounds provided, use them
    if (command.bounds) {
      const [west, south, east, north] = command.bounds;
      center = [(west + east) / 2, (south + north) / 2];
      // Calculate appropriate zoom from bounds (approximate)
      const latDiff = north - south;
      zoom = Math.round(8 - Math.log2(latDiff / 0.5));
    }

    if (!center) {
      center = this.config.defaultCenter;
    }

    await this.mapView.goTo(
      { center, zoom },
      { duration: command.animation !== false ? this.config.animationDuration : 0 }
    );

    this.state.center = center;
    this.state.zoom = zoom;
  }

  private async handleHighlight(command: MapCommand): Promise<void> {
    if (!this.mapView) return;

    const targets = Array.isArray(command.target)
      ? command.target
      : command.target
        ? [command.target]
        : [];

    // Limit number of highlighted features
    const limitedTargets = targets.slice(0, this.config.maxHighlightedFeatures);

    // Store highlighted feature IDs
    this.state.highlightedFeatures = limitedTargets;

    // In a real implementation, this would:
    // 1. Find the feature layer
    // 2. Apply highlight effect to matching features
    // For now, emit an event that the map component can handle
    this.emit({
      type: 'state-changed',
      data: {
        highlightedFeatures: limitedTargets,
        style: command.style,
      },
    });
  }

  private async handleClearHighlight(): Promise<void> {
    this.state.highlightedFeatures = [];
    if (this.mapView) {
      this.mapView.graphics.removeAll();
    }
    this.emit({
      type: 'state-changed',
      data: { highlightedFeatures: [] },
    });
  }

  private async handleFilter(command: MapCommand): Promise<void> {
    if (!command.metric || !command.data) return;

    this.state.activeFilters.set(command.metric, command.data);

    this.emit({
      type: 'state-changed',
      data: {
        filters: Object.fromEntries(this.state.activeFilters),
      },
    });
  }

  private async handleClearFilter(command: MapCommand): Promise<void> {
    if (command.metric) {
      this.state.activeFilters.delete(command.metric);
    } else {
      this.state.activeFilters.clear();
    }

    this.emit({
      type: 'state-changed',
      data: {
        filters: Object.fromEntries(this.state.activeFilters),
      },
    });
  }

  private async handleShowLayer(command: MapCommand): Promise<void> {
    if (!command.layer) return;
    this.state.visibleLayers.add(command.layer);

    this.emit({
      type: 'state-changed',
      data: { visibleLayers: Array.from(this.state.visibleLayers) },
    });
  }

  private async handleHideLayer(command: MapCommand): Promise<void> {
    if (!command.layer) return;
    this.state.visibleLayers.delete(command.layer);

    this.emit({
      type: 'state-changed',
      data: { visibleLayers: Array.from(this.state.visibleLayers) },
    });
  }

  private async handleShowHeatmap(command: MapCommand): Promise<void> {
    this.state.currentHeatmapMetric = command.metric;

    this.emit({
      type: 'state-changed',
      data: {
        heatmap: {
          metric: command.metric,
          layer: command.layer,
          style: command.style,
        },
      },
    });
  }

  private async handleShowChoropleth(command: MapCommand): Promise<void> {
    this.emit({
      type: 'state-changed',
      data: {
        choropleth: {
          metric: command.metric,
          layer: command.layer,
          style: command.style,
        },
      },
    });
  }

  private async handleClear(): Promise<void> {
    await this.handleClearHighlight();
    await this.handleClearFilter({} as MapCommand);
    this.state.currentHeatmapMetric = undefined;

    // Reset to default view
    if (this.mapView) {
      await this.mapView.goTo({
        center: this.config.defaultCenter,
        zoom: this.config.defaultZoom,
      });
    }

    this.state.center = this.config.defaultCenter;
    this.state.zoom = this.config.defaultZoom;

    this.emit({ type: 'state-changed', data: { state: this.state } });
  }

  // ---------------------------------------------------------------------------
  // Event Handling
  // ---------------------------------------------------------------------------

  /**
   * Subscribe to map events
   */
  on(eventType: MapEventType, handler: MapEventHandler): () => void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    this.eventHandlers.get(eventType)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.eventHandlers.get(eventType)?.delete(handler);
    };
  }

  /**
   * Emit an event to all subscribers
   */
  private emit(event: MapEvent): void {
    const handlers = this.eventHandlers.get(event.type);
    if (handlers) {
      handlers.forEach(handler => handler(event));
    }
  }

  // ---------------------------------------------------------------------------
  // State Access
  // ---------------------------------------------------------------------------

  /**
   * Get current map state
   */
  getState(): Readonly<MapState> {
    return { ...this.state };
  }

  /**
   * Get highlighted feature IDs
   */
  getHighlightedFeatures(): string[] {
    return [...this.state.highlightedFeatures];
  }

  /**
   * Check if a feature is highlighted
   */
  isHighlighted(featureId: string): boolean {
    return this.state.highlightedFeatures.includes(featureId);
  }

  // ---------------------------------------------------------------------------
  // Utility Methods
  // ---------------------------------------------------------------------------

  /**
   * Create a flyTo command for a jurisdiction
   */
  static createFlyToJurisdiction(
    jurisdiction: string,
    zoom = 12
  ): MapCommand {
    const key = jurisdiction.toLowerCase().replace(/\s+/g, '_');
    const center = JURISDICTION_CENTROIDS[key];

    return {
      type: 'flyTo',
      target: jurisdiction,
      center: center || DEFAULT_CONFIG.defaultCenter,
      zoom,
      animation: true,
    };
  }

  /**
   * Create a highlight command for precincts
   */
  static createHighlightPrecincts(
    precinctIds: string[],
    style?: MapStyle
  ): MapCommand {
    return {
      type: 'highlight',
      target: precinctIds,
      style: style || {
        fillColor: '#3b82f6',
        strokeColor: '#1d4ed8',
        strokeWidth: 2,
        opacity: 0.6,
      },
    };
  }

  /**
   * Create a heatmap command for a metric
   */
  static createHeatmapCommand(
    metric: string,
    layer = 'precincts',
    colorScheme = 'blue'
  ): MapCommand {
    return {
      type: 'showHeatmap',
      metric,
      layer,
      style: {
        colorScale: 'sequential',
        colorScheme,
        opacity: 0.7,
      },
    };
  }

  /**
   * Create a choropleth command for a metric
   */
  static createChoroplethCommand(
    metric: string,
    layer = 'precincts',
    diverging = false
  ): MapCommand {
    return {
      type: 'showChoropleth',
      metric,
      layer,
      style: {
        colorScale: diverging ? 'diverging' : 'sequential',
        opacity: 0.8,
      },
    };
  }

  /**
   * Get bounds for Ingham County
   */
  static getInghamCountyBounds(): [number, number, number, number] {
    return INGHAM_COUNTY_BOUNDS;
  }

  /**
   * Parse map commands from AI response text
   */
  static parseCommandsFromResponse(response: string): MapCommand[] {
    const commands: MapCommand[] = [];

    // Look for [MAP:command] patterns
    const mapCommandRegex = /\[MAP:(\w+)(?:\s+([^\]]+))?\]/gi;
    let match;

    while ((match = mapCommandRegex.exec(response)) !== null) {
      const [, type, params] = match;
      const command = MapCommandBridge.parseCommand(type, params);
      if (command) {
        commands.push(command);
      }
    }

    return commands;
  }

  /**
   * Parse a single command from type and params
   */
  private static parseCommand(
    type: string,
    params?: string
  ): MapCommand | null {
    const normalizedType = type.toLowerCase();

    switch (normalizedType) {
      case 'flyto': {
        const location = params?.trim();
        if (location) {
          return MapCommandBridge.createFlyToJurisdiction(location);
        }
        break;
      }
      case 'highlight': {
        const ids = params?.split(',').map(s => s.trim()).filter(Boolean);
        if (ids && ids.length > 0) {
          return MapCommandBridge.createHighlightPrecincts(ids);
        }
        break;
      }
      case 'heatmap': {
        const metric = params?.trim();
        if (metric) {
          return MapCommandBridge.createHeatmapCommand(metric);
        }
        break;
      }
      case 'clear':
        return { type: 'clear' };
      case 'zoom':
        return { type: 'zoom', zoom: params ? parseInt(params) : undefined };
    }

    return null;
  }
}

// ============================================================================
// Export singleton and utilities
// ============================================================================

export const mapCommandBridge = MapCommandBridge.getInstance();

export default MapCommandBridge;
