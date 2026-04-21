import type { LayerConfig } from './layers';
import { ProcessedLayerResult as BaseProcessedLayerResult } from './geospatial-chat';

/**
 * Extended ProcessedLayerResult used by the dynamic layer system
 * Adds the layerConfig property required by visualization components
 */
export interface ProcessedLayerResult extends BaseProcessedLayerResult {
  layerConfig: LayerConfig;
  rendererField?: string;
}

/**
 * Visualization type used by the component system
 */
export type ComponentVisualizationType = 
  'choropleth' | 
  'heatmap' | 
  'scatter' | 
  'cluster' | 
  'categorical' | 
  'trends' | 
  'correlation' | 
  'joint_high' | 
  'proportional_symbol' | 
  'comparison';

/**
 * Layer match result from component layer matching
 */
export interface ComponentLayerMatch {
  layerId: string;
  relevance: number;
  reasons: string[];
  field?: string;
  matchMethod?: 'ai' | 'rules';
  confidence?: number;
  visualizationMode?: string;
  threshold?: string;
  pointLayerId?: string;
  polygonLayerId?: string;
}

/**
 * Layer metadata used by the component system
 */
export interface ComponentLayerMetadata {
  id: string;
  name: string;
  description?: string;
  url?: string;
  fields?: Array<{
    name: string;
    alias?: string;
    type: string;
  }>;
}

/**
 * Alias for ESRI MapView type
 */
export type ComponentMapView = __esri.MapView;

/**
 * Alias for ESRI FeatureLayer type
 */
export type ComponentFeatureLayer = __esri.FeatureLayer;

/**
 * Simple layer match for local use
 */
export interface LocalLayerMatch {
  id: string;
  name: string;
  relevance: number;
}

/**
 * Layer metadata used within the system
 */
export interface LayerMetadata {
  id: string;
  name: string;
  description?: string;
  url?: string;
}

/**
 * MapView with additional properties for type safety
 */
export interface MapViewWithView extends __esri.MapView {
  view: __esri.MapView;
}

/**
 * Visualization with additional properties for type safety
 */
export interface VisualizationWithView {
  view: __esri.MapView;
}

/**
 * Layer with additional metadata
 */
export interface LayerWithMetadata extends __esri.FeatureLayer {
  metadata: LayerMetadata;
} 