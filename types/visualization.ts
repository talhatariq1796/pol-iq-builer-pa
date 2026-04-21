export type VisualizationType = 'default' | 'correlation' | 'ranking' | 'distribution' | 'timeseries' | 'comparison' | 'outlier' | 'scenario' | 'interaction' | 'threshold' | 'segment' | 'comparative_analysis';

export interface MetricConfig {
  name: string;
  value: number | string;
  unit?: string;
  color?: string;
  format?: (value: number) => string;
  trend?: {
    direction: 'up' | 'down' | 'stable';
    value: number;
  };
  threshold?: {
    warning?: number;
    critical?: number;
  };
  aggregation?: 'sum' | 'average' | 'max' | 'min';
}

export interface VisualizationOptions {
  // Display options
  opacity?: number;
  blendMode?: 'source-over' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten' | 'color-dodge' | 'color-burn' | 'hard-light' | 'soft-light' | 'difference' | 'exclusion';
  
  // Chart elements
  showInteractions?: boolean;
  showLegend?: boolean;
  showTooltips?: boolean;
  showLabels?: boolean;
  showGrid?: boolean;
  showAxes?: boolean;
  showTitle?: boolean;
  showDescription?: boolean;
  showSource?: boolean;
  showTimestamp?: boolean;
  
  // Controls
  showControls?: boolean;
  showFilters?: boolean;
  showSearch?: boolean;
  showExport?: boolean;
  showShare?: boolean;
  showFullscreen?: boolean;
  showHelp?: boolean;
  showSettings?: boolean;
  
  // Analytics
  showAnalytics?: boolean;
  showMetrics?: boolean;
  showTrends?: boolean;
  showCorrelations?: boolean;
  showOutliers?: boolean;
  showAnomalies?: boolean;
  showPredictions?: boolean;
  showForecasts?: boolean;
  
  // Data visualization
  showVisualizations?: boolean;
  showMaps?: boolean;
  showCharts?: boolean;
  showGraphs?: boolean;
  showTables?: boolean;
  
  // Performance
  showPerformance?: boolean;
  showDebug?: boolean;
  showStats?: boolean;
  showInfo?: boolean;
  showErrors?: boolean;
  showWarnings?: boolean;
  showLogs?: boolean;
}

export interface VisualizationData {
  type: VisualizationType;
  data: any[];
  options?: VisualizationOptions;
  metrics?: MetricConfig[];
}

export interface Feature {
  attributes: {
    [key: string]: string | number | boolean;
  };
}

export interface VisualizationStrategy {
  title: string;
  description: string;
  targetVariable?: string;
  correlationField?: string;
  rankingField?: string;
  distributionField?: string;
}

export interface LegendConfig {
  title: string;
  description: string;
  showLegend: boolean;
  legendPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export interface PopupConfig {
  title: string;
  content: Array<{
    type: 'text' | 'fields';
    text?: string;
    fieldInfos?: Array<{
      fieldName: string;
      label: string;
      visible: boolean;
    }>;
  }>;
}

export interface VisualizationConfig {
  type: VisualizationType;
  title: string;
  description: string;
  legendConfig: LegendConfig;
  popupConfig: PopupConfig;
} 