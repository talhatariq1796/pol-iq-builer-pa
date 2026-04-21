// types/geospatial-ai-types.ts
import type { LayerConfig } from '../types/layers';
import type FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import type Extent from '@arcgis/core/geometry/Extent';
export type { LayerConfig };

// Data Source and Retrieval Types
export interface DataSourceConfig {
  layerId?: string;
  serviceUrl?: string;
  maxFeatures?: number;
  filters?: Record<string, any>;
}

export interface DataRetrievalService {
  fetchData(config: DataSourceConfig): Promise<GeospatialFeature[]>;
}

export class DataRetrievalError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
    public url?: string
  ) {
    super(message);
    this.name = 'DataRetrievalError';
  }
}

// Geospatial Feature Types
export interface GeospatialFeature {
  id: string;
  type: string;
  geometry: GeometryObject;
  properties: {
    [key: string]: any;
    layerId?: string;
    layerName?: string;
    layerType?: string;
    rendererField?: string;
  };
  originalGeometry?: __esri.Geometry;
}

// Chat Interface Types
export interface ChatMessage {
  id: string;
  type: 'user' | 'ai' | 'error';
  content: string;
  timestamp: number;
  features?: GeospatialFeature[];
  sqlQuery?: string;
  layerIds?: string[];
  matchMethod?: 'ai' | 'rules' | string;
  confidence?: number;
  reasoning?: string;
  error?: boolean;
  layerExtent: __esri.Extent | null;
  visualizations?: React.ReactNode[];
}

export interface LayerMatch {
  layerId: string;
  layer: __esri.FeatureLayer;
  extent: __esri.Extent;
  relevance: number;
  field?: string;
  matchMethod: 'ai' | 'rules';
  confidence: number;
  reasoning?: string;
  visualizationMode?: 'distribution' | 'point' | 'point-in-polygon' | 'correlation';
  pointLayerId?: string;
  polygonLayerId?: string;
}

export interface LayerQueryConfig {
  layer: LayerConfig;
  constraints?: Record<string, any>;
}

export interface EnhancedGeospatialChatProps {
  agentType: string;
  dataSource: {
    serviceUrl: string;
    layerId: string;
  };
  onFeaturesFound: (features: GeospatialFeature[], isComposite?: boolean) => void;
  onError: (error: Error) => void;
  onVisualizationLayerCreated?: (layer: __esri.FeatureLayer, shouldReplace?: boolean) => void;
  mapView: __esri.MapView;
}

export interface DebugInfo {
  layerMatches: LayerMatch[];
  sqlQuery: string;
  features: any[];
  timing: Record<string, number>;
  error?: string;
}

// AI Analysis Types
export interface AIAnalysisRequest {
  prompt: string;
  features?: GeospatialFeature[];
  context?: any;
  layerId?: string;
  options?: {
    maxTokens?: number;
    temperature?: number;
    includeVisualization?: boolean;
  };
}

export interface Visualization {
  type: 'chart' | 'map' | 'table' | 'text';
  data: any;
  options?: {
    title?: string;
    description?: string;
    style?: {
      width?: number | string;
      height?: number | string;
      colors?: string[];
      theme?: 'light' | 'dark';
    };
  };
}

export interface AIAnalysisResult {
  analysis: {
    summary: string;
    details?: string;
    confidence?: number;
    recommendations?: string[];
    metadata?: {
      processingTime?: number;
      dataPoints?: number;
      modelVersion?: string;
    };
  };
  visualizations?: Visualization[];
  error?: {
    message: string;
    code: string;
    details?: any;
  };
  raw?: {
    features?: GeospatialFeature[];
    statistics?: Record<string, any>;
    query?: string;
  };
}

export interface AIServiceConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  apiKey?: string;
}

export class AIAnalysisError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AIAnalysisError';
  }
}

// Layer Configuration Types
export interface BaseLayerConfig {
  url: string;
  type: string;
  geometryType?: 'Point' | 'LineString' | 'Polygon';
  performance?: {
    maxFeatures?: number;
    cacheTimeout?: number;
    priority?: number;
  };
  permissions?: {
    read?: string[];
    write?: string[];
    delete?: string[];
    roles?: string[];
  };
}

export interface PointLayerConfig extends BaseLayerConfig {
  geometryType: 'Point';
  pointSymbol?: {
    color?: string;
    size?: number;
  };
}

export interface LineLayerConfig extends BaseLayerConfig {
  geometryType: 'LineString';
  lineSymbol?: {
    color?: string;
    width?: number;
  };
}

export interface PolygonLayerConfig extends BaseLayerConfig {
  geometryType: 'Polygon';
  fillSymbol?: {
    color?: string;
    opacity?: number;
  };
}

export interface SQLConversionResult {
  sql: string;
  confidence: number;
  metadata: {
    model: string;
    processingTime: number;
  };
}

export interface CompositeFeature extends __esri.Graphic {
  attributes: {
    [key: string]: any;
    compositeIndex: number;
  };
}

export interface GeometryObject {
  type: string;
  coordinates: number[] | number[][] | number[][][];
}

export interface LayerResult {
  layer: {
    id: string;
    name: string;
    type: string;
    rendererField?: string;
    visualizationMode?: string;
  };
  features: any[];
  weight?: number;
}

export interface BaseVisualizationOptions {
  title?: string;
  opacity?: number;
  visible?: boolean;
  mode?: 'highlight' | 'distribution';
}

export interface VisualizationOptions {
  title?: string;
  description?: string;
  style?: {
    width?: number | string;
    height?: number | string;
    color?: string;
    opacity?: number;
  };
  query?: string;
  primaryField?: string;
  comparisonField?: string;
  comparisonParty?: string;
  isCrossGeography?: boolean;
  layerId?: string;
  extent?: __esri.Extent;
  filters?: Record<string, any>;
  statistics?: {
    count?: number;
    min?: number;
    max?: number;
    mean?: number;
    stddev?: number;
  };
}

export interface SingleLayerData {
  features: any[];
  layerName: string;
  rendererField: string;
}

export interface PointVisualizationData {
  features: any[];
  layerName: string;
  rendererField?: string;
  spatialReference?: __esri.SpatialReference;
  layerConfig?: {
    fields: Array<{
      name: string;
      label?: string;
      alias?: string;
      type: string;
    }>;
  };
}

// The primary LayerField interface used throughout the application
export interface LayerField {
  name: string;
  type: "string" | "oid" | "small-integer" | "integer" | "single" | "double" | "long" | "date" | "big-integer" | "date-only" | "time-only" | "timestamp-offset" | "geometry" | "blob" | "raster" | "guid" | "global-id" | "xml";
  label?: string;
  alias?: string;
  alternateNames?: string[];
  description?: string;
  format?: {
    places?: number;
    digitSeparator?: boolean;
    prefix?: string;
    suffix?: string;
  };
  range?: {
    min: number;
    max: number;
  };
}

// New interface for processed layer results passed to visualization factory
export interface LocalGeospatialFeature {
  type: "Feature";
  geometry: {
    type: string;
    coordinates: number[] | number[][] | number[][][];
  };
  originalGeometry?: __esri.Geometry;
  properties: Record<string, any>;
  id?: string;
}

export interface AnalysisResult {
  type: 'correlation' | 'topN' | 'joint' | 'single';
  summary: string;
  details?: string;
  confidence?: number;
  recommendations?: string[];
  metadata?: {
    processingTime?: number;
    dataPoints?: number;
    modelVersion?: string;
  };
}

export interface VisualizationResult {
  layer: __esri.FeatureLayer;
  extent: __esri.Extent;
  validIdentifiers: string[];
  featureType: 'point' | 'polygon' | 'line';
  sourceLayerIdForClickable: string;
  sourceIdentifierFieldForClickable: string;
}

export interface ProcessedLayerResult {
  layerId: string;
  layerName: string;
  layerType: string;
  layer: LayerConfig;
  features: __esri.Graphic[];
  extent: __esri.Extent | null;
  fields: __esri.Field[];
  geometryType: 'point' | 'polygon' | 'line' | 'unknown';
  statistics?: {
    count: number;
    min?: number;
    max?: number;
    mean?: number;
    stddev?: number;
  };
}