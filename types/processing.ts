import { AgentType } from './metrics';
import { Extent, SpatialReference } from '@arcgis/core/geometry';
import Graphic from '@arcgis/core/Graphic';

export interface ViewState {
  extent: Extent;
  spatialReference: SpatialReference;
}

export interface ProcessedLayerState {
  layer: {
    id: string;
    title: string;
    url?: string;
    geometryType: string;
    fields: {
      name: string;
      type: string;
      alias?: string;
    }[];
  };
  queryResults: {
    features: Graphic[];
    fields: any[];
  };
}

export interface SpatialData {
  type: 'point' | 'polygon' | 'polyline';
  coordinates: number[][];
  properties?: Record<string, any>;
}

export interface ProcessQueryParams {
  query: string;
  layerStates: Record<string, ProcessedLayerState>;
  view?: ViewState;
  strategy?: {
    parallel: boolean;
    processor: 'TRADITIONAL' | 'AI' | 'HYBRID';
    agents: AgentType[];
    cacheable: boolean;
    priority?: 'speed' | 'accuracy';
  };
}

export interface TraditionalResults {
  features?: Graphic[];
  metrics?: Record<string, any>;
  statistics?: Record<string, any>;
  patterns?: string[];
  spatialAnalysis?: {
    intersection?: {
      boundaryContacts?: number;
      overlappingAreas?: number;
    };
    density?: {
      averageDensity?: number;
      clusters?: number;
      hotspots?: number;
    };
    proximity?: {
      averageDistance?: number;
    };
  };
}

export interface AIResults {
  insights?: string[];
  trends?: Record<string, {
    value: number;
    change?: number;
    direction?: 'up' | 'down' | 'stable';
    confidence?: number;
  }>;
  recommendations?: string[];
  confidence?: number;
  metadata?: {
    modelVersion?: string;
    processingTime?: number;
    timestamp?: string;
  };
}

export interface ProcessingResult {
  traditionalResults?: TraditionalResults;
  aiResults?: AIResults;
  metadata: {
    confidence: number;
    processingType: 'TRADITIONAL' | 'AI' | 'HYBRID';
    error: boolean;
    message?: string;
  };
}