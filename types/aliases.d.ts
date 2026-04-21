declare module '@/lib/clustering/types' {
  export interface ClusterConfig { [key: string]: any }
}

declare module '@/components/filtering/types' {
  export interface FieldFilterConfig { [key: string]: any }
  export interface VisualizationConfig { [key: string]: any }
  export interface PerformanceConfig { [key: string]: any }
}

export {};
