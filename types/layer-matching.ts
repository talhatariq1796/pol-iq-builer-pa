export interface LayerMatch {
  layerId: string;
  relevance: number;
  confidence: number;
  reasoning?: string;
  matchMethod?: string;
  field?: string;
  threshold?: 'top10percent' | 'top25percent' | 'above75' | 'above50';
  visualizationMode?: 'distribution' | 'point' | 'point-in-polygon' | 'correlation';
  pointLayerId?: string;
  polygonLayerId?: string;
} 