import { VisualizationType } from '@/config/dynamic-layers';

export type QueryIntent = {
  type: string;
  fields: string[];
  geometryType?: 'point' | 'line' | 'polygon';
  filters?: Record<string, unknown>;
};

export type VisualizationSuggestion = {
  type: VisualizationType;
  confidence: number;
  reason: string;
};

const QUERY_TYPE_TO_VISUALIZATION: Record<string, VisualizationSuggestion> = {
  correlation: {
    type: VisualizationType.CORRELATION,
    confidence: 0.85,
    reason: 'Correlation queries compare relationships between fields.',
  },
  distribution: {
    type: VisualizationType.CHOROPLETH,
    confidence: 0.8,
    reason: 'Distribution queries are best shown as area intensity.',
  },
  ranking: {
    type: VisualizationType.TOP_N,
    confidence: 0.85,
    reason: 'Ranking queries need ordered top or bottom areas.',
  },
  spatial: {
    type: VisualizationType.JOINT_HIGH,
    confidence: 0.75,
    reason: 'Spatial queries benefit from highlighting matching geographies.',
  },
  difference: {
    type: VisualizationType.DIFFERENCE,
    confidence: 0.85,
    reason: 'Difference queries compare two measures directly.',
  },
  joint_high: {
    type: VisualizationType.JOINT_HIGH,
    confidence: 0.85,
    reason: 'Joint-high queries ask for areas meeting multiple criteria.',
  },
};

export function mapQueryToVisualizations(intent: QueryIntent): VisualizationSuggestion[] {
  const primary = QUERY_TYPE_TO_VISUALIZATION[intent.type] ?? {
    type: VisualizationType.SINGLE_LAYER,
    confidence: 0.65,
    reason: 'Single-layer visualization is the safest fallback for general queries.',
  };

  return [
    primary,
    {
      type: VisualizationType.CHOROPLETH,
      confidence: primary.type === VisualizationType.CHOROPLETH ? primary.confidence : 0.55,
      reason: 'Choropleth maps are broadly useful for polygon-based geographic data.',
    },
    {
      type: VisualizationType.SINGLE_LAYER,
      confidence: 0.5,
      reason: 'Single-layer rendering provides a simple fallback.',
    },
  ];
}
