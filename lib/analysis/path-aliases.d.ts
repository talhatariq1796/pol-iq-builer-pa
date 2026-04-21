declare module '@/lib/clustering/types' {
  export interface ClusterConfig { [key: string]: unknown }
}

declare module '@/components/filtering/types' {
  export interface FieldFilterConfig { [key: string]: unknown }
  export interface VisualizationConfig { [key: string]: unknown }
  export interface PerformanceConfig { [key: string]: unknown }
}

export {};
