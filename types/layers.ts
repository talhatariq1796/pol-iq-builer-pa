// src/types/layers.ts

import { LayerField } from './geospatial-ai-types';
import type MapView from '@arcgis/core/views/MapView';
import type FeatureLayer from '@arcgis/core/layers/FeatureLayer';
// import FeatureLayer from '@arcgis/core/layers/FeatureLayer';

export type { LayerField };

// Fundamental Type Definitions
export type LayerType = 'point' | 'index' | 'percentage' | 'feature-service' | 'wms' | 'wfs' | 'xyz' | 'geojson' | 'amount' | 'client-side-composite';
export type LayerStatus = 'active' | 'inactive' | 'deprecated' | 'pending';
export type UpdateFrequency = 'realtime' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';
export type ProcessingStrategy = 'traditional' | 'hybrid' | 'ai' | 'batch';
export type AccessLevel = 'read' | 'write' | 'admin';
export type CacheStrategy = 'memory' | 'redis' | 'hybrid' | 'none';
export type GeographicLevel = 'national' | 'provincial' | 'regional' | 'local' | 'postal';

// Field Formatting and Display Configurations
export interface LayerFieldFormat {
  digitSeparator?: boolean;
  places?: number;
  prefix?: string;
  suffix?: string;
  nullDisplay?: string;
}

// Popup Configuration Interfaces
export interface PopupFieldInfo {
  fieldName: string;
  label: string;
  visible: boolean;
  format?: LayerFieldFormat;
}

export interface PopupContentBase {
  type: 'fields' | 'text' | 'media';
}

export interface PopupContentFields extends PopupContentBase {
  type: 'fields';
  fieldInfos: PopupFieldInfo[];
}

export interface PopupContentText extends PopupContentBase {
  type: 'text';
  text: string;
  format?: {
    bold?: boolean;
    italic?: boolean;
    color?: string;
  };
}

export interface PopupContentMedia extends PopupContentBase {
  type: 'media';
  mediaInfos: {
    type: 'image' | 'chart' | 'video';
    url: string;
    caption?: string;
    altText?: string;
  }[];
}

export type PopupContent = PopupContentFields | PopupContentText | PopupContentMedia;

export interface PopupTemplateConfig {
  title?: string;
  content?: string | string[];
  fieldInfos?: {
    fieldName: string;
    label: string;
    format?: {
      places?: number;
      digitSeparator?: boolean;
      dateFormat?: string;
    };
  }[];
  actions?: {
    title: string;
    id: string;
    className?: string;
  }[];
}

// Metadata Configuration
export interface LayerMetadata {
  provider: string;
  updateFrequency: UpdateFrequency;
  lastUpdate?: Date;
  version?: string;
  tags?: string[];
  accuracy?: number;
  coverage?: {
    spatial?: string;
    temporal?: string;
  };
  sourceSystems?: string[];
  dataQuality?: {
    completeness?: number;
    consistency?: number;
    validationDate?: Date;
  };
  isHidden?: boolean;
  geometryType?: 'point' | 'multipoint' | 'polyline' | 'polygon' | 'multipolygon' | 'extent';
  valueType?: 'percentage' | 'index' | 'count' | 'currency';
  visualizationType?: 'unique-value' | 'choropleth' | 'point';
  rendererConfig?: {
    field: string;
    colors?: Record<string, [number, number, number]>;
  };
  concepts?: Record<string, {
    terms: string[];
    weight?: number;
  }>;
  geographicType: 'census' | 'postal' | 'custom' | 'ZIP' | 'FSA' | 'dma';
  geographicLevel: GeographicLevel;
  description?: string;
  microserviceField?: string;
}

// Symbol Configuration for Point Layers
export interface PointSymbolConfig {
  color: [number, number, number, number];
  size?: number;
  outline?: {
    color: [number, number, number, number];
    width: number;
  };
  opacity?: number;
  shape?: 'circle' | 'square' | 'triangle' | 'diamond';
}

// Clustering Configuration for Point Layers
export interface LayerClusterConfig {
  enabled: boolean;
  radius?: number;
  minSize?: number;
  maxSize?: number;
  colors?: number[][];
  labelingEnabled?: boolean;
  popupTemplate?: PopupTemplateConfig;
}

// Base Layer Configuration
export interface BaseLayerConfig {
  id: string;
  name: string;
  description?: string;
  url: string;
  type: LayerType;
  status: LayerStatus;
  group: string;
  visible?: boolean;
  opacity?: number;
  style?: any;
  params?: Record<string, any>;
  metadata: LayerMetadata;
  processing: Record<string, any>;
  caching: Record<string, any>;
  performance: Record<string, any>;
  security: Record<string, any>;
  analysis?: Partial<LayerAnalysisConfig>;
  definitionExpression?: string;
  queryConfig?: {
    where: string;
    outFields: string[];
    returnGeometry: boolean;
    maxFeatures: number;
  };
  joinConfig?: {
    targetLayer: string;
    joinField: string;
    targetField: string;
    joinType: 'left' | 'right' | 'inner' | 'outer';
    outFields: string[];
  };
  displayField?: string;
  identifierField?: string;
  geometryType?: 'Point' | 'LineString' | 'Polygon';
  permissions?: {
    read?: string[];
    write?: string[];
    delete?: string[];
    roles?: string[];
  };
  fields: LayerField[];
  microserviceField?: string;
  geographicType: 'census' | 'postal' | 'custom' | 'ZIP' | 'FSA' | 'dma';
  geographicLevel: GeographicLevel;
  rendererField?: string;
  filterField?: string;
  filterThreshold?: number;
  linkField?: string;
  sourceSR?: number;
  skipLayerList?: boolean;
  dataStructure?: 'separate' | 'field-based';
  fieldMappings?: Record<string, string>;
}

// Extended Layer Configuration
export interface ExtendedLayerConfig {
  processing: Partial<LayerProcessingConfig>;
  caching: Partial<LayerCachingConfig>;
  performance: Partial<LayerPerformanceConfig>;
  security: Partial<LayerSecurityConfig>;
  errorHandling?: Partial<LayerErrorHandlingConfig>;
  analysis?: Partial<LayerAnalysisConfig>;
  validation?: LayerValidationRule[];
  status: LayerStatus;
  nameField?: string;
  typeField?: string;
  typeValue?: string;
  isPrimary?: boolean;
  skipLayerList?: boolean;
  crossGeoOnly?: boolean;
  isTrends?: boolean;
  joinConfig?: {
    targetLayer: string;
    joinField: string;
    targetField: string;
    joinType: 'left' | 'right' | 'inner' | 'outer';
    outFields: string[];
  };
  description?: string;
  isVisible?: boolean;
  virtualLayers?: { field: string; name: string }[];
}

// Specific Layer Configurations
export interface PointLayerConfig extends BaseLayerConfig {
  type: 'point';
  symbolConfig: PointSymbolConfig;
  rendererField?: string;
  fields: LayerField[];
  cluster?: LayerClusterConfig;
}

export interface IndexLayerConfig extends BaseLayerConfig {
  type: 'index';
  rendererField?: string;
  visualizationMode?: 'distribution' | 'point';
  indexField?: string;
  fields: LayerField[];
  nameField?: string;
  typeField?: string;
  typeValue?: string;
  isPrimary?: boolean;
  crossGeoOnly?: boolean;
  definitionExpression?: string;
  queryConfig?: {
    where: string;
    outFields: string[];
    returnGeometry: boolean;
    maxFeatures: number;
  };
  virtualLayers?: { field: string; name: string }[];
}

export interface PercentageLayerConfig extends BaseLayerConfig {
  type: 'percentage';
  rendererField: string;
  fields: LayerField[];
}

export interface FeatureServiceLayerConfig extends BaseLayerConfig {
  type: 'feature-service';
  rendererField?: string;
  fields: LayerField[];
  symbolConfig?: PointSymbolConfig;
}

export interface WebServiceLayerConfig extends BaseLayerConfig {
  type: 'wms' | 'wfs' | 'xyz' | 'geojson';
  params?: Record<string, any>;
}

// Amount Layer Configuration
export interface AmountLayerConfig extends BaseLayerConfig {
  type: 'amount';
  rendererField?: string;
  fields: LayerField[];
}

// Client-Side Composite Index Layer Configuration
export interface ClientSideCompositeLayerConfig extends BaseLayerConfig {
  type: 'client-side-composite';
  rendererField: string;
  fields: LayerField[];
  clientSideConfig: {
    indexField: string;
    displayName: string;
    baseGeometryLayer: string; // Reference to layer ID that provides geometry
    colorScheme: string;
    legendTitle: string;
  };
}

// Consolidated Layer Configuration Type
export type LayerConfig = (PercentageLayerConfig | IndexLayerConfig | PointLayerConfig | FeatureServiceLayerConfig | WebServiceLayerConfig | AmountLayerConfig | ClientSideCompositeLayerConfig) & ExtendedLayerConfig;

// Virtual Layer Configuration
export interface VirtualLayerConfig {
  field: string;
  name: string;
}

// Update ProjectLayerConfig to include virtualLayers
export interface ProjectLayerConfig {
  layers: Record<string, LayerConfig>;
  groups: LayerGroup[];
  defaultVisibility: Record<string, boolean>;
  defaultCollapsed: Record<string, boolean>;
  globalSettings: {
    defaultOpacity: number;
    maxVisibleLayers: number;
    performanceMode?: 'standard' | 'optimized';
  };
  virtualLayers?: VirtualLayerConfig[];
}

// Virtual Layer Interface
export interface VirtualLayer {
  id: string;
  name: string;
  sourceLayerId: string;
  rendererField: string;
  visible: boolean;
}

// Layer State Types
export interface LayerState {
  id: string;
  name: string;
  layer: FeatureLayer | null;
  visible: boolean;
  opacity: number;
  order: number;
  group: string;
  loading: boolean;
  filters: any[];
  isVirtual: boolean;
  active: boolean;
}

export interface GroupState {
  id: string;
  expanded: boolean;
  title?: string;
  description?: string;
}

export interface PersistedState {
  layers: Record<string, LayerState>;
  groups: Record<string, GroupState>;
  lastUpdated: string;
}

// Query Types
export interface QueryOptions {
  layers: string[];
  spatialFilter?: {
    type: 'polygon' | 'circle' | 'rectangle';
    coordinates: number[][];
  };
  temporalFilter?: {
    startDate: string;
    endDate: string;
  };
  attributeFilter?: {
    field: string;
    operator: '=' | '>' | '<' | '>=' | '<=' | '!=' | 'like' | 'in';
    value: any;
  }[];
}

export interface QueryResult {
  features: any[];
  total: number;
  time: number;
  extent?: [number, number, number, number];
}

// Layer Group Configuration
export interface LayerGroup {
  id: string;
  title: string;
  description?: string;
  layers?: LayerConfig[];
  subGroups?: LayerGroup[];
  virtualLayers?: { field: string; name: string }[];
}

export interface GlobalSettings {
  defaultOpacity: number;
  maxVisibleLayers: number;
  minZoom?: number;
  maxZoom?: number;
}

export interface LayerProcessingConfig {
  strategy: ProcessingStrategy;
  timeout?: number;
  priority?: number;
  batchSize?: number;
  retryAttempts?: number;
  concurrencyLimit?: number;
  preprocessingSteps?: string[];
}

export interface LayerCachingConfig {
  enabled: boolean;
  ttl: number;
  strategy: CacheStrategy;
  maxEntries?: number;
  prefetch?: boolean;
  stalePeriod?: number;
  invalidationTriggers?: string[];
}

export interface LayerPerformanceConfig {
  maxFeatures?: number;
  maxGeometryComplexity?: number;
  timeoutMs?: number;
  rateLimits?: {
    requestsPerSecond: number;
    burstSize: number;
  };
  optimizationLevel?: 'low' | 'medium' | 'high';
  scalingStrategy?: 'horizontal' | 'vertical';
}

export interface LayerSecurityConfig {
  requiresAuthentication: boolean;
  accessLevels: AccessLevel[];
  ipWhitelist?: string[];
  encryptionRequired?: boolean;
  auditEnabled?: boolean;
  requiredRoles?: string[];
  auditTrail?: {
    enabled: boolean;
    retentionDays?: number;
  };
}

export interface LayerErrorHandlingConfig {
  fallbackStrategy?: ProcessingStrategy;
  retryStrategy?: {
    maxAttempts: number;
    backoffMs: number;
    backoffType?: 'linear' | 'exponential';
  };
  alertThresholds?: {
    errorRate?: number;
    performanceDegradation?: number;
  };
  faultTolerance?: {
    partialResponseAllowed?: boolean;
    degradedModeEnabled?: boolean;
  };
}

export interface LayerAnalysisConfig {
  availableOperations?: string[];
  aggregationMethods?: string[];
  supportedVisualizationTypes?: string[];
  complexityThresholds?: {
    spatialComplexity?: number;
    computationalComplexity?: number;
  };
}

export interface LayerValidationRule {
  field: string;
  type: 'required' | 'min' | 'max' | 'regex' | 'custom';
  value?: any;
  message?: string;
  severity?: 'warning' | 'error' | 'critical';
}

// Note: Helper functions have been moved to config/layers.ts

// Note: Layer configurations have been moved to config/layers.ts
// This file now only contains type definitions

export interface LocalLayerState {
  id: string;
  name: string;
  type: string;
  visible: boolean;
  opacity: number;
  order: number;
  group: string;
  loading: boolean;
  error: string | null;
  data: any | null;
  metadata: Record<string, any>;
  filters?: any[];
  isVirtual?: boolean;
  active?: boolean;
}

export interface LayerControllerRef {
  layerStates: { [key: string]: LayerState };
  isInitialized: boolean;
  setVisibleLayers: (layers: string[]) => void;
  setLayerStates: (states: { [key: string]: LayerState }) => void;
  resetLayers: () => void;
}

export interface LayerControllerProps {
  view: MapView;
  config: ProjectLayerConfig;
  onLayerStatesChange?: (states: { [key: string]: LayerState }) => void;
  onLayerInitializationProgress?: (progress: { loaded: number; total: number }) => void;
  onInitializationComplete?: () => void;
  visible?: boolean;
}