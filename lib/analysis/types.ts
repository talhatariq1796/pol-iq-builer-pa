/* eslint-disable @typescript-eslint/no-explicit-any */
// Core Analysis Engine Types and Interfaces
// Enhanced with Multi-Endpoint Analysis Support

import { ClusterConfig } from '@/lib/clustering/types';
import { FieldFilterConfig, VisualizationConfig as FilterVisualizationConfig, PerformanceConfig } from '@/components/filtering/types';

// ============================================================================
// ANALYSIS ENGINE CORE TYPES
// ============================================================================

export interface AnalysisOptions {
  endpoint?: string;
  targetVariable?: string;
  sampleSize?: number;
  forceRefresh?: boolean;
  visualizationType?: string;

  // Scope options
  analysisScope?: string;
  scope?: string;
  forceProjectScope?: boolean;

  // Drill-down controls
  viewMode?: 'aggregate' | 'detail';
  drilldownKey?: string;
  
  // Clustering options
  clusterConfig?: ClusterConfig;
  
  // Field filtering options (Phase 2)
  fieldFilters?: FieldFilterConfig;
  
  // Visualization customization options (Phase 3)
  visualizationConfig?: FilterVisualizationConfig;
  
  // Performance optimization options (Phase 4)
  performanceConfig?: PerformanceConfig;
  
  // Spatial filtering options (NEW)
  spatialFilterIds?: string[];      // Feature IDs to include
  spatialFilterGeometry?: unknown;      // Original geometry for reference
  spatialFilterMethod?: string;     // How geometry was selected
  
  // CMA-specific options (deployment fix)
  geometry?: any;                   // Geographic bounds for CMA analysis
  filters?: any;                    // Property filters for CMA analysis
  target_variable?: string;         // Target variable for analysis
  sample_size?: number;             // Sample size for analysis
  metadata?: any;                   // Additional metadata
  
  // AI Persona selection
  persona?: string;                  // Selected AI persona for analysis
  
  // Multi-endpoint options
  endpoints?: string[];
  combinationStrategy?: 'overlay' | 'comparison' | 'sequential' | 'correlation';
  forceMultiEndpoint?: boolean;
  disableMultiEndpoint?: boolean;
  maxEndpoints?: number;
  multiEndpointThreshold?: number; // Confidence threshold for auto-detection
  mergeOptions?: {
    locationField?: string;
    includePartialRecords?: boolean;
    fieldPrefixes?: boolean;
    qualityThreshold?: number;
  };
}

export interface AnalysisResult {
  endpoint: string;
  data: ProcessedAnalysisData;
  visualization?: VisualizationResult;
  success: boolean;
  error?: string;
  metadata?: AnalysisMetadata;
}

export interface AnalysisMetadata {
  executionTime: number;
  dataPointCount: number;
  confidenceScore?: number;
  timestamp: string;
  errorMessage?: string;
  
  // Model performance information
  modelInfo?: {
    target_variable: string;
    feature_count: number;
    accuracy?: number;
  r2?: number;
  r2_score?: number;
    rmse?: number;
    mae?: number;
  model_type?: string;
  };
  
  // Multi-endpoint metadata
  isMultiEndpoint?: boolean;
  endpointsUsed?: string[];
  mergeStrategy?: string;
  strategicInsights?: unknown;
  performanceMetrics?: {
    totalAnalysisTime: number;
    dataLoadingTime: number;
    processingTime: number;
    visualizationTime: number;
    endpointLoadTimes: Record<string, number>;
  };
  qualityMetrics?: {
    dataCompleteness: number;
    analysisConfidence: number;
    spatialCoverage: number;
  };
}

// ============================================================================
// RAW DATA TYPES (from microservice)
// ============================================================================

export interface RawAnalysisResult {
  success: boolean;
  results: unknown[];
  feature_importance?: Array<{
    feature: string;
    importance: number;
  }>;
  model_info?: {
    target_variable: string;
    feature_count: number;
    accuracy?: number;
  r2?: number;
  r2_score?: number;
    rmse?: number;
    mae?: number;
  model_type?: string;
  };
  summary?: string;
  error?: string;
  total_records?: number;
  progressive_processed?: boolean;
  final_memory_mb?: number;
  correlation_metadata?: unknown;
  metadata?: any; // Additional metadata for CMA and other analysis types
  geometry?: any; // Geographic geometry for spatial analysis
  filters?: any; // Analysis filters
}

// ============================================================================
// PROCESSED DATA TYPES (standardized format)
// ============================================================================

export interface DrilldownDescriptor {
  mode: 'points' | 'polygons' | 'table';
  keyField?: string;
  rendererHint?: string;
  title?: string;
  description?: string;
}

export interface ProcessedAnalysisData {
  type: string;
  records: GeographicDataPoint[];
  totalRecords?: number;
  summary: string;
  featureImportance?: FeatureImportance[];
  statistics: AnalysisStatistics;
  
  // Multi-target variable support
  targetVariable: string; // Primary target variable (backward compatibility)
  targetVariables?: MultiTargetAnalysisData; // Extended multi-target support
  
  renderer?: unknown; // Optional direct renderer (bypasses complex rendering chain)
  legend?: unknown; // Optional direct legend (bypasses complex legend generation)
  extent?: __esri.Extent | null; // Optional extent for map zooming
  shouldZoom?: boolean; // Whether to zoom to features extent
  clusterAnalysis?: ClusterAnalysisMetadata; // Optional cluster-specific metadata
  competitiveAnalysis?: CompetitiveAnalysisMetadata; // Optional competitive-specific metadata
  cmaAnalysis?: unknown; // Optional CMA-specific metadata
  demographicAnalysis?: unknown; // Optional demographic-specific metadata
  trendAnalysis?: unknown; // Optional trend-specific metadata
  correlationMatrix?: unknown; // Optional correlation-specific metadata
  riskAssessment?: unknown; // Optional risk-specific metadata
  customerProfileAnalysis?: unknown; // Optional customer profile-specific metadata
  correlationAnalysis?: unknown; // Optional correlation-specific metadata
  brandAnalysis?: unknown; // Optional brand comparison-specific metadata
  brandComparison?: unknown; // Optional brand comparison data
  
  // Real estate specific analysis types
  realEstateAnalysis?: RealEstateAnalysisMetadata; // FSA-enriched analysis metadata
  investmentMetrics?: {
    avgROI: string;
    avgRisk: string;
    riskAdjustedReturn: number;
  }; // Investment analysis specific metadata
  trendMetrics?: {
    avgTimeOnMarket: string;
    avgPriceChange: string;
    marketVolatility: number;
  }; // Market trend analysis specific metadata
  rentalMetrics?: {
    avgRentalYield: string;
    avgVacancyRate: string;
    marketStability: number;
  }; // Rental market analysis specific metadata

  // Clustering-related fields
  isClustered?: boolean; // Whether this data has been processed by clustering
  clusters?: unknown[]; // Array of cluster information when available
  
  // Spatial filtering metadata
  metadata?: {
    spatialFilterApplied?: boolean;
    spatialFilterCount?: number;
    fsaEnrichmentApplied?: boolean; // FSA demographic enrichment status
    multiTargetAnalysis?: boolean; // Multi-target analysis performed
    [key: string]: unknown;
  };

  // Drill-down support metadata
  supportsDrilldown?: boolean;
  drilldownDescriptor?: DrilldownDescriptor;
}

export interface GeographicDataPoint {
  area_id: string;
  area_name: string;
  value: number;
  rank?: number;
  category?: string;
  coordinates?: [number, number];
  properties: Record<string, unknown>;
  shapValues?: Record<string, number>;
  geometry?: unknown; // GeoJSON geometry (Point, Polygon, etc.)
  // Clustering-related fields
  cluster_id?: number; // Cluster assignment when data is clustered
  cluster_name?: string; // Human-readable cluster name
}

export interface FeatureImportance {
  feature: string;
  importance: number;
  description?: string;
}

export interface AnalysisStatistics {
  total: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  stdDev: number;
  // Optional extended statistics for different analysis types
  percentile25?: number;
  percentile75?: number;
  iqr?: number;
  outlierCount?: number;
  clusterCount?: number;
  avgClusterSize?: number;
  avgSimilarity?: number;
  // Competitive analysis specific fields
  marketConcentration?: number;
  competitiveIntensity?: number;
  avgMarketShare?: number;
  // Quintile information for proper classification
  quintiles?: {
    competitive?: number[];
    marketShare?: number[];
  };
  // Correlation-specific
  correlationStrength?: number;
  significanceLevel?: number;
  // Risk-specific
  riskLevel?: 'low' | 'medium' | 'high';
  confidenceInterval?: [number, number];
  // Demographic-specific
  avgIncome?: number;
  medianAge?: number;
  diversityIndex?: number;
  // Trend-specific
  avgGrowthRate?: number;
  avgMomentum?: number;
  trendVolatility?: number;
  // Risk-specific
  avgVolatility?: number;
  avgUncertainty?: number;
  // Customer Profile specific
  avgDemographicAlignment?: number;
  avgLifestyleScore?: number;
  avgBehavioralScore?: number;
  avgTargetConfidence?: number;
  strongCorrelations?: number;
  correlationMatrix?: unknown;
}

// ============================================================================
// VISUALIZATION TYPES
// ============================================================================

export interface VisualizationResult {
  type: VisualizationType;
  config: VisualizationConfig;
  renderer: unknown; // ArcGIS renderer object
  popupTemplate: unknown; // ArcGIS popup template
  legend: LegendConfig;
  
  // Result status properties
  success?: boolean;
  error?: string;
  fallback?: string;
  visualizationType?: string;
  metadata?: any;
  
  // Enhanced effects integration
  _pendingEffects?: {
    enabled: boolean;
    rendererFlags: unknown;
    visualizationData: ProcessedAnalysisData;
    config: VisualizationConfig;
  };
  _enhancedEffects?: unknown; // Effects metadata from renderers
  _pointRendering?: boolean; // Flag to indicate point rendering mode
}

export type VisualizationType = 
  | 'choropleth'
  | 'cluster' 
  | 'symbol'
  | 'heatmap'
  | 'categorical'
  | 'network'
  | 'multi-symbol'
  | 'bivariate'
  | 'graduated-symbols'
  | 'risk-gradient'
  | 'competitive'
  | 'multi_endpoint_overlay'
  | 'multi_endpoint_comparison'
  | 'multi_endpoint_sequential'
  | 'multi_endpoint_correlation';

export interface VisualizationConfig {
  colorScheme: string;
  opacity: number;
  strokeWidth: number;
  symbolSize?: number;
  valueField: string;
  labelField: string;
  popupFields: string[];
  classificationMethod?: 'natural-breaks' | 'equal-interval' | 'quantile' | 'manual' | 'categorical' | 'graduated' | string;
  classBreaks?: number[];
  // Allow additional properties for specialized renderers
  [key: string]: unknown;
}

export interface LegendConfig {
  title: string;
  items: LegendItem[];
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | string;
}

export interface LegendItem {
  label: string;
  color: string;
  value?: number;
  symbol?: string;
}

// ============================================================================
// ENDPOINT CONFIGURATION
// ============================================================================

export interface EndpointConfiguration {
  id: string;
  name: string;
  description: string;
  category: 'core' | 'geographic' | 'demographic' | 'economic' | 'competitive' | 'temporal' | 'strategic' | 'detection' | 'advanced' | 'comparative' | 'predictive' | 'segmentation' | 'real_estate' | 'explanatory' | 'urgent';
  url: string;
  defaultVisualization: VisualizationType;
  payloadTemplate: Record<string, unknown>;
  responseProcessor: string; // processor class name
  keywords: string[];
}

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

export type ProcessingStep = 
  | 'analyzing_query'
  | 'calling-endpoint' 
  | 'processing-data'
  | 'creating-visualization'
  | 'updating-state'
  | 'error'
  | null;

export type ProcessingStepKey = keyof ProcessingStep | string;

export interface ErrorState {
  hasError?: boolean;
  message: string;
  details?: unknown;
  timestamp: string;
}

export interface AnalysisState {
  // Analysis data
  currentAnalysis: ProcessedAnalysisData | null;
  currentVisualization: VisualizationResult | null;
  
  // UI state
  processingStatus: {
    isProcessing: boolean;
    currentStep: ProcessingStep | null;
    progress: number;
  };
  errorState: ErrorState | null;
  
  // Query and endpoint state
  lastQuery: string | null;
  selectedEndpoint?: string;
  lastAnalysisMetadata?: unknown;
  
  // History
  history: AnalysisHistoryItem[];
}

export interface AnalysisHistoryItem {
  id: string;
  query: string;
  endpoint: string;
  timestamp: string;
  success: boolean;
  executionTime: number;
  dataPointCount?: number;
}

// ============================================================================
// STRATEGY PATTERN INTERFACES
// ============================================================================

export interface ProcessingContext {
  query?: string;
  endpoint?: string;
  extractedBrands?: string[];
  analysisOptions?: AnalysisOptions;
  viewMode?: 'aggregate' | 'detail';
  drilldownKey?: string;
}

export interface DataProcessorStrategy {
  process(rawData: RawAnalysisResult, context?: ProcessingContext): ProcessedAnalysisData | Promise<ProcessedAnalysisData>;
  validate(rawData: RawAnalysisResult): boolean;
}

export interface VisualizationRendererStrategy {
  render(data: ProcessedAnalysisData, config: VisualizationConfig): VisualizationResult;
  supportsType(type: VisualizationType): boolean;
}

// ============================================================================
// QUERY ANALYSIS (for endpoint suggestion)
// ============================================================================

export interface QueryAnalysis {
  suggestedEndpoint: string;
  confidence: number;
  keywords: string[];
  intent: QueryIntent;
  extractedParameters: Record<string, unknown>;
}

export type QueryIntent = 
  | 'analysis'
  | 'comparison'
  | 'clustering'
  | 'trends'
  | 'risk-assessment'
  | 'optimization'
  | 'correlation'
  | 'outlier-detection';

// ============================================================================
// EVENT SYSTEM
// ============================================================================

export type StateSubscriber = (state: AnalysisState) => void;

export interface AnalysisEvent {
  type: AnalysisEventType;
  payload: unknown;
  timestamp: string;
}

export type AnalysisEventType = 
  | 'analysis-started' 
  | 'analysis-complete' 
  | 'analysis-error'
  | 'endpoint-selected'
  | 'data-processed'
  | 'project-type-changed'
  | 'visualization-created'
  | 'analysis-completed'
  | 'analysis-failed'
  | 'endpoint-changed';

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

// ============================================================================
// ANALYSIS ENGINE CONFIGURATION
// ============================================================================

export interface AnalysisEngineConfig {
  // Additional configuration options
  apiUrl?: string;
  cacheEnabled?: boolean;
  apiKey?: string;

  debugMode: boolean;
  enableCaching: boolean;
  maxConcurrentRequests: number;
  defaultTimeout: number;
  retryAttempts: number;
  
  // Multi-endpoint configuration
  enableMultiEndpoint?: boolean;
  defaultMultiEndpointThreshold?: number;
  maxEndpointsPerQuery?: number;
  preferredMergeStrategy?: 'overlay' | 'comparison' | 'sequential' | 'correlation';
  multiEndpointVisualizationConfig?: {
    enableInteractivity?: boolean;
    dashboardLayout?: 'map_focused' | 'split_view' | 'tabbed' | 'carousel';
    showPerformanceMetrics?: boolean;
  };
}

export interface EndpointConfig {
  url: string;
  timeout?: number;
  retryAttempts?: number;
  payloadTransformer?: (data: unknown) => unknown;
  responseTransformer?: (data: unknown) => unknown;
} 

// Additional metadata interfaces
export interface ClusterAnalysisMetadata {
  clusters: Array<{
    id: number;
    label: string;
    size: number;
    avgSimilarity: number;
    centroid: Record<string, number>;
    representativeAreas: string[];
  }>;
  totalClusters: number;
  silhouetteScore: number;
}

export interface CompetitiveAnalysisMetadata {
  categories: Array<{
    category: string;
    size: number;
    percentage: number;
    avgCompetitiveScore: number;
    avgMarketShare: number;
    topAreas: Array<{
      name: string;
      score: number;
      marketShare: number;
    }>;
  }>;
  marketLeaders: Array<{
    area: string;
    score: number;
    marketShare: number;
    position: string;
  }>;
  growthOpportunities: Array<{
    area: string;
    currentShare: number;
    brandAwareness: number;
    opportunity: string;
  }>;
  competitiveBalance: string;
}

// ============================================================================
// MULTI-TARGET ANALYSIS INTERFACES
// ============================================================================

export interface MultiTargetAnalysisData {
  primary: string; // Primary target variable
  targets: TargetVariableAnalysis[]; // Array of all target variables analyzed
  correlations?: TargetCorrelationMatrix; // Cross-target correlations
  summary: MultiTargetSummary;
}

export interface TargetVariableAnalysis {
  variable: string; // Target variable name (e.g., 'time_on_market', 'avg_sold_price')
  type: TargetVariableType;
  statistics: AnalysisStatistics;
  featureImportance?: FeatureImportance[];
  modelInfo?: {
    target_variable: string;
    feature_count: number;
    accuracy?: number;
    r2?: number;
    r2_score?: number;
    rmse?: number;
    mae?: number;
    model_type?: string;
  };
  predictions?: Record<string, number>; // area_id -> predicted value
  confidence?: Record<string, number>; // area_id -> confidence score
}

export type TargetVariableType = 
  | 'time_on_market'      // Days on market
  | 'avg_sold_price'      // Average sold price
  | 'avg_rent_price'      // Average rental price
  | 'price_delta'         // Asking vs sold price difference
  | 'market_velocity'     // Market activity rate
  | 'appreciation_rate'   // Property value appreciation
  | 'inventory_levels'    // Available inventory
  | 'custom';             // Custom target variable

export interface TargetCorrelationMatrix {
  correlations: Array<{
    target1: string;
    target2: string;
    coefficient: number;
    significance: number;
    strength: 'weak' | 'moderate' | 'strong';
  }>;
  heatmapData?: number[][]; // For visualization
  labels: string[];
}

export interface MultiTargetSummary {
  totalTargets: number;
  analysisMode: 'sequential' | 'parallel' | 'hierarchical';
  primaryInsights: string[];
  crossTargetInsights: string[];
  keyFindings: {
    strongestPredictor: string;
    weakestPredictor: string;
    mostCorrelatedTargets: [string, string];
    leastCorrelatedTargets: [string, string];
  };
}

// ============================================================================
// REAL ESTATE ANALYSIS INTERFACES
// ============================================================================

export interface RealEstateAnalysisMetadata {
  fsaEnrichment: FSAEnrichmentMetadata;
  marketAnalysis: MarketAnalysisMetadata;
  propertyAnalysis?: PropertyAnalysisMetadata;
  multiScaleAnalysis?: MultiScaleAnalysisMetadata;
}

export interface FSAEnrichmentMetadata {
  totalProperties: number;
  propertiesWithFSA: number;
  uniqueFSAs: number;
  fsaCoverage: number; // Percentage of properties with valid FSA
  topFSAs: Array<{
    fsa: string;
    propertyCount: number;
    avgPrice?: number;
    avgTimeOnMarket?: number;
  }>;
  enrichmentSource: 'static' | 'database' | 'api';
  processingTimeMs: number;
}

export interface MarketAnalysisMetadata {
  totalMarketValue: number;
  avgPropertyPrice: number;
  avgTimeOnMarket: number;
  avgRentPrice?: number;
  marketSegments: Array<{
    segment: 'below_market' | 'market_rate' | 'above_market';
    count: number;
    percentage: number;
    avgPrice: number;
    avgTimeOnMarket: number;
  }>;
  priceDistribution: {
    min: number;
    max: number;
    median: number;
    q1: number;
    q3: number;
    outliers: number;
  };
}

export interface PropertyAnalysisMetadata {
  propertyTypes: Array<{
    type: string;
    count: number;
    avgPrice: number;
    avgTimeOnMarket: number;
  }>;
  sizeDistribution: Array<{
    bedroomCount: number;
    count: number;
    avgPrice: number;
  }>;
  ageDistribution: Array<{
    yearRange: string;
    count: number;
    avgPrice: number;
  }>;
}

export interface MultiScaleAnalysisMetadata {
  scales: Array<{
    scale: 'individual' | 'fsa' | 'custom_area' | 'radius' | 'city';
    recordCount: number;
    avgValue: number;
    analysis: 'complete' | 'partial' | 'insufficient_data';
  }>;
  aggregationMethod: 'simple_average' | 'weighted_average' | 'median' | 'mode';
  spatialCoverage: {
    totalArea: number; // in km²
    propertyDensity: number; // properties per km²
    fsaDensity: number; // FSAs per km²
  };
} 