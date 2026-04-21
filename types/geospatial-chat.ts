import type Graphic from '@arcgis/core/Graphic';
import type MapView from '@arcgis/core/views/MapView';
import type FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import type Extent from '@arcgis/core/geometry/Extent';
import type SimpleRenderer from '@arcgis/core/renderers/SimpleRenderer';
import type { LayerConfig } from '@/types/layers';
import type { LocalGeospatialFeature } from './index';
// import type { getLayerConstraints } from '@/config/layers';

// Original types commented out for reference
// export type VisualizationType = 'distribution' | 'correlation' | 'highlight';

// Simplified types for this project
export type VisualizationType = 'single-layer' | 'correlation';

export type ProcessingStepStatus = 'pending' | 'processing' | 'complete' | 'error' | 'skipped';

export interface ProcessingStep {
  id: string;
  status: ProcessingStepStatus;
  icon: React.ReactNode;
  message: string;
  children?: React.ReactNode;
  timestamp?: number;
  details?: any;
  progress?: number;
  estimatedTimeRemaining?: number;
}

export interface LocalChatMessage {
  id: string;
  type: 'user' | 'ai' | 'error';
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  layerExtent: Extent | null;
  visualizations?: React.ReactNode[];
}

export interface ProcessedLayerResult {
  layerId: string;
  layerName: string;
  layerType: string;
  layer: LayerConfig;
  features: LocalGeospatialFeature[];
  extent: Extent | null;
  renderer?: SimpleRenderer;
  type?: VisualizationType;
  field?: string;
  error?: string;
  esriLayer?: __esri.FeatureLayer;
  fields?: any[];
  analysisText?: string;
  dataAttributes?: {
    [key: string]: any;
  };
}

export interface Visualization {
  layer: FeatureLayer | null;
  extent: Extent | null;
}

export interface LayerDebugProps {
  layerId: string;
  mapView: MapView;
}

export interface DebugInfo {
  layerMatches: LayerMatch[];
  sqlQuery: string;
  features: any[];
  timing: Record<string, number>;
  error?: string;
}

export interface ChartDataPoint {
  name: string;
  value: number;
}

export interface LayerMatch {
  layerId: string;
  relevance: number;
  matchMethod: string;
  confidence: number;
  reasoning?: string;
  field?: string;
}

export interface EnhancedGeospatialChatProps {
  agentType: string;
  dataSource: {
    serviceUrl: string;
    layerId: string;
  };
  onFeaturesFound: (features: LocalGeospatialFeature[], isComposite?: boolean) => void;
  onError: (error: Error) => void;
  onVisualizationLayerCreated?: (layer: FeatureLayer, shouldReplace?: boolean) => void;
  mapView: MapView;
}

export interface LayerQueryConfig {
  layer: LayerConfig;
  constraints: any;
}

export interface QueryAnalysis {
  intent: string;
  relevantLayers: string[];
  relevantFields: string[];
  queryType: 'point' | 'area' | 'distribution';
  confidence: number;
  explanation: string;
}

export interface AnalysisResponse {
  content: string;
  error?: string;
  validIdentifiers?: string[];
  clickableFeatureType?: 'FSA' | 'City' | 'District' | 'ZIP' | 'Cluster';
  sourceLayerIdForClickable?: string;
  sourceIdentifierFieldForClickable?: string;
  clusters?: Array<{id: string, name: string, zipCodes: string[]}>;
}

export interface QueryResults {
  layerId: string;
  layerName: string;
  featureCount: number;
  extent: Extent | null;
}

export interface VisualizationFactoryOptions {
  mapView: MapView;
  onVisualizationLayerCreated?: (layer: FeatureLayer, shouldReplace: boolean) => void;
}

export interface VisualizationResult {
  layer: FeatureLayer | null;
  extent: Extent | null;
  FeedbackComponent?: React.FC<any> | null;
}

export interface GeometryWithRings extends __esri.Geometry {
  rings?: number[][][];
}

export interface GeometryWithPaths extends __esri.Geometry {
  paths?: number[][][];
}

export interface GeometryWithCoords extends __esri.Geometry {
  x: number;
  y: number;
}

export type ArcGISGeometryType = "point" | "multipoint" | "polyline" | "polygon" | "mesh" | "extent";

export interface GoToOptions {
  animate: boolean;
  duration: number;
  easing: "out-cubic" | "in-out-cubic";
  signal: AbortSignal;
}

export interface SceneViewOptions {
  container: HTMLDivElement;
  basemap: __esri.Basemap;
  environment: {
    lighting: {
      directShadowsEnabled: boolean;
      date: Date;
    };
    starsEnabled: boolean;
    atmosphereEnabled: boolean;
  };
  ui: {
    components: string[];
  };
}

export interface EnhancedAnalysisResult {
  queryType: string;
  relevantLayers: string[];
  relevantFields?: string[];
  demographicFilters?: string[];
  query?: string;
  analysisType?: string;
  targetVariable?: string;
  filters?: Record<string, any>;
  timeRange?: {
    start: string;
    end: string;
  };
  spatialExtent?: __esri.Extent;
  confidence?: number;
  explanation?: string;
} 