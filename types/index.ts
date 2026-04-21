import Graphic from '@arcgis/core/Graphic';

// Re-export Political Analysis types
export * from './political';

export interface LocalGeospatialFeature {
  id?: string;
  type: 'Feature';
  geometry: {
    type: string;
    coordinates: number[] | number[][] | number[][][];
  };
  properties: {
    thematic_value: number;
    [key: string]: any;
  };
}

export interface LocalChatMessage {
  id: string;
  type: 'user' | 'ai' | 'error' | 'system';
  content: string;
  timestamp: number;
  features?: LocalGeospatialFeature[];
  sqlQuery?: string;
  layerIds?: string[];
  matchMethod?: 'ai' | 'rules' | string;
  confidence?: number;
  reasoning?: string;
  error?: boolean;
  layerExtent: __esri.Extent | null;
  visualizations?: React.ReactNode[];
  correlationResults?: CorrelationResult;
  validIdentifiers?: string[];
  clickableFeatureType?: 'FSA' | 'City' | 'District' | 'ZIP';
  featureType?: 'FSA' | 'City' | 'District' | 'ZIP';
  role?: 'user' | 'assistant';
  sourceLayerId?: string;
  sourceIdentifierField?: string;
}

export interface LayerResult {
  layer: {
    id: string;
    type: string;
    rendererField?: string;
    visualizationMode?: 'distribution' | 'point';
    name: string;
    geographicType?: string;
  };
  features: (LocalGeospatialFeature | Graphic)[];
  weight?: number;
}

export interface QueryResults {
  layerResults: LayerResult[];
  primaryMatch: {
    layerId: string;
    relevance: number;
    matchMethod: string;
    confidence: number;
    reasoning?: string;
  };
  finalMatches: any[];
  query?: string;
}

export interface CorrelationResult {
  primaryField: string;
  correlations: {
    field: string;
    coefficient: number;
    count: number;
    description: string;
  }[];
  joinedFeatures: Graphic[];
}

export interface LayerLegendProps {
  layer: __esri.FeatureLayer;
} 