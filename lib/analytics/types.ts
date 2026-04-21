export interface LayerResult {
  layerId: string;
  layerName: string;
  layerType: string;
  layer: any;
  features: any[];
  extent: any;
  esriLayer?: any;
}

export interface AnalysisResult {
  queryType: 'simple' | 'factor' | 'interaction' | 'outlier' | 'scenario' | 'threshold' | 'segment' | 'comparative' | 
             'unknown' | 'correlation' | 'distribution' | 'topN' | 'jointHigh' | 'comparison' | 'simple_display' | 'choropleth' | 'difference' | 'bivariate' | 'hotspot' | 'multivariate';
  visualizationStrategy?: string;
  targetVariable?: string;
  targetField?: string;
  entities: string[];
  intent: 'unknown' | 'trends' | 'correlation' | 'distribution' | 'information' | 'visualization_request' | 'ranking' | 'comparison' | 'location';
  confidence: number;
  layers: Array<{
    layerId: string;
    relevance: number;
    matchMethod: string;
    confidence: number;
    reasons: string[];
  }>;
  timeframe: string;
  searchType: 'web' | 'images' | 'news' | 'youtube' | 'shopping';
  relevantLayers: string[];
  explanation: string;
  relevantFields?: string[];
  comparisonParty?: string;
  topN?: number;
  isCrossGeography?: boolean;
  originalQueryType?: string;
  originalQuery?: string;
  trendsKeyword?: string;
  populationLookup?: Map<string, number>;
  reasoning?: string;
  metrics?: { r: number; pValue?: number };
  correlationMetrics?: { r: number; pValue?: number };
  thresholds?: Record<string, number>;
  category?: string;
  demographic_filters?: { field: string; condition: string }[];

  // Optional fields from data analysis service
  summary?: string;
  feature_importance?: { feature: string; importance: number }[];
  results?: any[];
  error?: string;
  suggestions?: string[];
}

export interface AnalysisContext {
  previousMessages: Array<{
    role: 'user' | 'assistant';
    content: string;
    metadata?: {
      analysisResult?: any;
      context?: string;
    };
  }>;
  currentContext?: string;
}

export interface LayerDataOptions {
  query: string;
  spatialFilter?: any;
  targetFields?: string[];
  sqlWhere?: string;
  minApplications?: number;
  context?: string;
}

export interface AnalysisServiceRequest {
  analysis_type: string;
  query: string;
  minApplications: number;
  target_variable: string;
  conversationContext?: string;
  previousAnalysis?: any[];
  relevantLayers?: string[];
  matchedFields?: string[];
  demographic_filters: any[];
  matched_fields?: string[];
  relevant_layers?: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    analysisResult?: any;
    context?: string;
    totalFeatures?: number;
    visualizationResult?: any;
    debugInfo?: any;
  };
}

export interface ConceptMap {
  matchedLayers: string[];
  matchedFields: string[];
  confidence: number;
  keywords: string[];
  layerScores: Record<string, number>;
  fieldScores: Record<string, number>;
}

export interface GeoProcessingStep {
  id?: string;
  name?: string;
  status: 'pending' | 'processing' | 'complete' | 'error' | 'warning' | 'in-progress';
  message?: string;
  description?: string;
  icon?: React.ReactNode;
}

export interface DebugInfo {
  query?: string;
  timestamp?: string;
  logs?: { step: string; data?: any; timestamp: string }[];
  layerMatches?: string[];
  sqlQuery?: string;
  features?: GeospatialFeature[];
  timing?: Record<string, any>;
  totalFeatures?: number;
  context?: string;
  error?: Error;
}

export interface ChatVisualizationResult {
  layer?: any;
  type?: string;
  data?: any;
  legendInfo?: {
    title: string;
    type: string;
    items: Array<{
      id?: string;
      label: string;
      color: string;
      value?: string | number | boolean | null;
      type?: string;
    }>;
  };
}

export interface GeospatialFeature {
  id?: string;
  type: 'Feature';
  geometry: {
    type: string;
    coordinates: number[];
  };
  properties: Record<string, any>;
  weight?: number;
  
  // Additional fields added during processing
  area_name?: string;        // Area name like "11368 (Corona)" or "Brooklyn" 
  cluster_id?: number;       // Cluster ID for clustered analyses (0, 1, 2, etc.)
  cluster_name?: string;     // Cluster name like "Corona Territory"
}

export interface AnalysisServiceResponse {
  summary: string;
  results: any[];
  visualizationData?: any[];
  error?: string;
  popupConfig?: any;
}

export interface JobStatusResponse {
  job_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: AnalysisServiceResponse;
  error?: string;
}

// Multi-Target Analysis Types
export interface RealEstateTargetDefinition {
  name: string;                    // Target variable name (e.g., 'price', 'days_on_market')
  type: 'numeric' | 'categorical' | 'boolean';
  field: string;                   // Database field name
  description?: string;            // Human-readable description
  weight?: number;                 // Importance weight (0-1)
  transformations?: {
    scale?: 'linear' | 'log' | 'sqrt' | 'standardize';
    binning?: {
      type: 'equal_width' | 'equal_frequency' | 'custom';
      bins?: number;
      customBins?: number[];
    };
  };
  constraints?: {
    min?: number;
    max?: number;
    allowedValues?: string[] | number[];
  };
}

export interface CrossTargetCorrelation {
  target1: string;
  target2: string;
  correlation: number;
  pValue?: number;
  significance: 'high' | 'medium' | 'low' | 'none';
  relationship: 'positive' | 'negative' | 'none';
  description?: string;
}

export interface MultiTargetStatistics {
  targetCorrelations: CrossTargetCorrelation[];
  featureImportance: {
    [targetName: string]: Array<{
      feature: string;
      importance: number;
      rank: number;
    }>;
  };
  crossTargetInsights: {
    dominantTarget?: string;
    conflictingTargets?: string[];
    synergisticTargets?: string[];
  };
  modelPerformance?: {
    [targetName: string]: {
      r2?: number;
      mae?: number;
      rmse?: number;
      accuracy?: number;
    };
  };
}

export interface MultiTargetAnalysisServiceRequest extends Omit<AnalysisServiceRequest, 'target_variable'> {
  targets: RealEstateTargetDefinition[];
  multiTargetStrategy?: 'independent' | 'joint' | 'hierarchical' | 'weighted';
  correlationThreshold?: number;
  includeCorrelationAnalysis?: boolean;
  targetPriority?: string[];  // Order of importance for targets
}

export interface MultiTargetMicroserviceResponse extends AnalysisServiceResponse {
  multiTargetResults?: {
    [targetName: string]: {
      summary: string;
      predictions?: any[];
      metrics?: any;
      featureImportance?: Array<{
        feature: string;
        importance: number;
      }>;
    };
  };
  crossTargetAnalysis?: MultiTargetStatistics;
  targetDefinitions?: RealEstateTargetDefinition[];
  strategy?: string;
}

// Utility Types for Target Variable Detection
export type TargetVariableType = 'price' | 'days_on_market' | 'appreciation' | 'rental_yield' | 
                                 'cap_rate' | 'cash_flow' | 'roi' | 'market_value' | 'custom';

export interface TargetVariableDetectionResult {
  detectedTargets: Array<{
    name: string;
    type: TargetVariableType;
    confidence: number;
    field: string;
    reasoning: string;
  }>;
  suggestedCombinations?: Array<{
    targets: string[];
    strategy: 'independent' | 'joint' | 'hierarchical';
    reasoning: string;
  }>;
}

// Extended existing interfaces for backward compatibility
export interface EnhancedAnalysisResult extends AnalysisResult {
  // Multi-target specific fields
  primaryTarget?: string;
  secondaryTargets?: string[];
  targetCorrelations?: CrossTargetCorrelation[];
  multiTargetStrategy?: string;
  
  // Enhanced metrics for multi-target scenarios
  crossTargetMetrics?: {
    correlationMatrix?: Record<string, Record<string, number>>;
    featureSharing?: Record<string, string[]>;
    conflictResolution?: string;
  };
}

export interface EnhancedAnalysisServiceRequest extends AnalysisServiceRequest {
  // Optional multi-target fields for backward compatibility
  additionalTargets?: string[];
  targetWeights?: Record<string, number>;
  enableMultiTarget?: boolean;
}

// Type guards for runtime type checking
export function isMultiTargetRequest(
  request: AnalysisServiceRequest | MultiTargetAnalysisServiceRequest
): request is MultiTargetAnalysisServiceRequest {
  return 'targets' in request && Array.isArray(request.targets);
}

export function isMultiTargetResponse(
  response: AnalysisServiceResponse | MultiTargetMicroserviceResponse
): response is MultiTargetMicroserviceResponse {
  return 'multiTargetResults' in response || 'crossTargetAnalysis' in response;
}

// Common real estate target configurations
export const COMMON_REAL_ESTATE_TARGETS: Record<TargetVariableType, RealEstateTargetDefinition> = {
  price: {
    name: 'Property Price',
    type: 'numeric',
    field: 'price',
    description: 'Current market price of the property',
    transformations: { scale: 'log' }
  },
  days_on_market: {
    name: 'Days on Market',
    type: 'numeric',
    field: 'days_on_market',
    description: 'Number of days the property has been listed',
    constraints: { min: 0 }
  },
  appreciation: {
    name: 'Price Appreciation',
    type: 'numeric',
    field: 'appreciation_rate',
    description: 'Annual price appreciation rate as percentage'
  },
  rental_yield: {
    name: 'Rental Yield',
    type: 'numeric',
    field: 'rental_yield',
    description: 'Annual rental income as percentage of property value'
  },
  cap_rate: {
    name: 'Capitalization Rate',
    type: 'numeric',
    field: 'cap_rate',
    description: 'Net operating income divided by property value'
  },
  cash_flow: {
    name: 'Cash Flow',
    type: 'numeric',
    field: 'monthly_cash_flow',
    description: 'Monthly net cash flow from property'
  },
  roi: {
    name: 'Return on Investment',
    type: 'numeric',
    field: 'roi',
    description: 'Return on investment percentage'
  },
  market_value: {
    name: 'Market Value',
    type: 'numeric',
    field: 'market_value',
    description: 'Current estimated market value'
  },
  custom: {
    name: 'Custom Target',
    type: 'numeric',
    field: 'custom_target',
    description: 'User-defined target variable'
  }
};