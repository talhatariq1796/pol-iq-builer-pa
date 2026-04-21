import { ReactNode } from 'react';
import type { LocalGeospatialFeature } from '@/types/index';
import type { Visualization, LayerMatch } from '@/types/geospatial-chat';
import type { LayerMetadata as ImportedLayerMetadata } from '@/types/layers';
import type { LayerConfig } from '@/types/layers';

export type ArcGISGeometryType = "point" | "multipoint" | "polyline" | "polygon" | "mesh" | "extent";

export interface LegendItem {
  label: string;
  color: string;
  minValue?: number;
  maxValue?: number;
}

export interface ChatVisualizationResult {
  layer: __esri.FeatureLayer | null;
  extent: __esri.Extent | null;
  visualizationType?: string;
  title?: string;
  description?: string;
  metrics?: any;
}

export interface ProcessedLayerResult {
  layerId: string;
  layerName: string;
  layerType: string;
  layerConfig: LayerConfig;
  features: LocalGeospatialFeature[];
  extent: __esri.Extent | null;
  fields?: __esri.Field[];
  geometryType?: 'point' | 'polygon' | 'line' | 'unknown';
  statistics?: {
    count: number;
    min?: number;
    max?: number;
    mean?: number;
    stddev?: number;
  };
  esriLayer?: __esri.FeatureLayer;
}

export interface VisualizationResult {
  layer: __esri.FeatureLayer | null;
  extent: __esri.Extent | null;
  renderer?: __esri.Renderer;
  legendInfo?: any;
  validIdentifiers?: string[];
  featureType?: 'point' | 'polygon' | 'line';
  sourceLayerIdForClickable?: string;
  sourceIdentifierFieldForClickable?: string;
}

export interface VisualizationOptions {
  title?: string;
  opacity?: number;
  visible?: boolean;
  mode?: 'highlight' | 'distribution' | 'density' | 'correlation' | 'topN';
  filterLayer?: {
    features: any[];
    field: string;
    threshold: 'top10percent' | number;
  };
  symbolConfig?: {
    color?: [number, number, number, number];
    size?: number;
    outline?: {
      color: [number, number, number, number];
      width: number;
    };
  };
  outline?: __esri.SimpleLineSymbolProperties | null;
  breaks?: number[];
  colorScheme?: string;
  labels?: boolean;
  query?: string; 
  primaryField?: string;
  comparisonField?: string;
  comparisonParty?: string;
}

export interface DebugInfo {
  layerMatches: LocalLayerMatch[];
  sqlQuery: string;
  features: any[];
  timing?: Record<string, number>;
  error?: string;
}

export interface GeoProcessingStep {
  id: string;
  status: 'pending' | 'processing' | 'complete' | 'error';
  message: string;
  icon?: React.ReactNode;
}

export interface LocalChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'loading' | 'error' | 'notification';
  content: string | React.ReactNode;
  timestamp: Date;
  processed?: boolean;
  metadata?: Record<string, any>;
  features?: LocalGeospatialFeature[];
  processing?: GeoProcessingStep[];
}

export interface ComponentVisualization extends Visualization {
  layer: __esri.FeatureLayer;
  extent: __esri.Extent;
  view?: __esri.MapView;
}

export interface ComponentLayerMatch extends LayerMatch {
  layer: __esri.FeatureLayer;
  extent: __esri.Extent;
  view?: __esri.MapView;
}

export interface ComponentLayerMetadata {
  description?: string;
  tags?: string[];
  category?: string;
}

export interface ComponentMapView extends __esri.MapView {
  extent: __esri.Extent;
  center: __esri.Point;
  zoom: number;
  scale: number;
  width: number;
  height: number;
  spatialReference: __esri.SpatialReference;
  ready: boolean;
  stationary: boolean;
  view?: __esri.MapView;
}

export interface ComponentFeatureLayer extends __esri.FeatureLayer {
  rendererField?: string;
  visualizationMode?: string;
}

export interface EnhancedGeospatialChatProps {
  agentType: 'geospatial' | 'general' | 'trends';
  dataSource: {
    serviceUrl: string;
    layerId: string;
  };
  onFeaturesFound: (features: LocalGeospatialFeature[], isComposite?: boolean) => void;
  onError: (error: Error) => void;
  onVisualizationLayerCreated?: (layer: ComponentFeatureLayer | null, shouldReplace?: boolean) => void;
  mapView: ComponentMapView | __esri.SceneView | null;
  setFormattedLegendData?: React.Dispatch<React.SetStateAction<LegendItem[] | null>>;
  setVisualizationResult?: React.Dispatch<React.SetStateAction<ChatVisualizationResult | null>>;
}

export interface LocalLayerMatch {
  layer: ComponentFeatureLayer;
  extent: __esri.Extent;
  view?: __esri.MapView;
  layerId?: string;
  relevance?: number;
  confidence?: number;
  reasoning?: string;
  matchMethod?: string;
  field?: string;
  threshold?: 'top10percent' | 'top25percent' | 'above75' | 'above50';
  visualizationMode?: 'point' | 'distribution' | 'point-in-polygon' | 'correlation';
  pointLayerId?: string;
  polygonLayerId?: string;
}

export type VisualizationType = string | number | bigint | boolean | ReactNode | null | undefined;

export interface ConceptDefinition {
  terms: string[];
  weight?: number;
}

export interface LayerMetadata {
  provider: string;
  updateFrequency: string;
  lastUpdate: Date;
  version: string;
  description?: string;
  tags?: string[];
  category?: string;
  concepts?: Record<string, ConceptDefinition>;
  valueType?: 'percentage' | 'index' | 'count' | 'currency';
}

export interface MapViewWithView extends __esri.MapView {
  view?: __esri.MapView;
}

export interface VisualizationWithView extends Visualization {
  view?: __esri.MapView;
}

export interface LayerWithMetadata extends __esri.FeatureLayer {
  metadata?: LayerMetadata;
}

export interface LayerField {
  name: string;
  type: "string" | "oid" | "small-integer" | "integer" | "single" | "double" | "long" | "date" | "big-integer" | "date-only" | "time-only" | "timestamp-offset" | "geometry" | "blob" | "raster" | "guid" | "global-id" | "xml";
  label?: string;
  alias?: string;
  isPrimaryDisplay?: boolean;
  alternateNames?: string[];
  description?: string;
  format?: {
    places?: number;
    digitSeparator?: boolean;
  };
  range?: {
    min: number;
    max: number;
  };
} 