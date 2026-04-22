export interface FieldFilterConfig {
  enabled?: boolean;
  fields?: string[];
}

export interface VisualizationConfig {
  type?: string;
  renderer?: string;
}

export interface PerformanceConfig {
  cache?: boolean;
  maxRecords?: number;
}
