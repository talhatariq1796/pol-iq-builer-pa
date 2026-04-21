// types/project-config.ts
import { LayerConfig, LayerGroup, ProjectLayerConfig } from './layers';

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  category: 'industry' | 'use-case' | 'custom';
  tags: string[];
  author: string;
  version: string;
  createdAt: string;
  updatedAt: string;
  isPublic: boolean;
  configuration: ProjectConfiguration;
  previewImage?: string;
  documentation?: string;
}

export interface ProjectConfiguration {
  id: string;
  name: string;
  description: string;
  version: string;
  layers: Record<string, EnhancedLayerConfig | ServiceDerivedLayer>;
  groups: LayerGroupConfiguration[];
  conceptMappings: ConceptMappingConfiguration;
  dependencies: DependencyConfiguration;
  settings: ProjectSettings;
  metadata: ProjectMetadata;
  services: {
    arcgis: ArcGISService[];
    microservices?: MicroserviceConfiguration[];
  };
  serviceOperations?: {
    autoSync: boolean;
    syncInterval?: number; // minutes
    conflictResolution: 'service' | 'local' | 'prompt';
    bulkOperations: {
      enabled: boolean;
      allowedOperations: ('update' | 'delete' | 'create')[];
    };
  };
}

export interface LayerConfigurationSet {
  [layerId: string]: EnhancedLayerConfig;
}

export interface EnhancedLayerConfig {
  // Base layer configuration properties
  id: string;
  name: string;
  type: string;
  url: string;
  group?: string;
  description?: string;
  status: 'active' | 'inactive' | 'deprecated';
  fields?: ArcGISField[];
  metadata?: any;
  
  // Field configuration
  fieldConfiguration?: Record<string, LayerFieldConfiguration>;
  
  // Layer capabilities
  maxRecordCount?: number;
  geometryType?: string;
  supportsQuery?: boolean;
  supportsStatistics?: boolean;
  supportsPagination?: boolean;
  whereClause?: string;
  
  // Additional configuration for project-specific overrides
  projectOverrides?: {
    name?: string;
    description?: string;
    isVisible?: boolean;
    group?: string;
    priority?: number;
    customFields?: Record<string, any>;
  };
  // Dependency tracking
  dependencies?: {
    requiredLayers: string[];
    optionalLayers: string[];
    conflictingLayers: string[];
  };
  // Usage analytics
  usage?: {
    queryFrequency: number;
    lastUsed: string;
    popularCombinations: string[];
  };
}

export interface LayerFieldConfiguration {
  visible?: boolean;
  alias?: string;
  description?: string;
  searchable?: boolean;
  filterable?: boolean;
  sortable?: boolean;
  required?: boolean;
  defaultValue?: any;
  format?: string;
  validation?: {
    type?: 'string' | 'number' | 'date' | 'email' | 'url';
    min?: number;
    max?: number;
    pattern?: string;
    required?: boolean;
  };
}

export interface LayerGroupConfiguration {
  id: string;
  name: string;
  description?: string;
  layers: string[]; // Layer IDs
  isCollapsed: boolean;
  priority: number;
  color?: string;
  icon?: string;
  customProperties?: Record<string, any>;
}

export interface ConceptMappingConfiguration {
  layerMappings: Record<string, string[]>; // concept -> layer IDs
  fieldMappings: Record<string, string>; // concept -> field name
  synonyms: Record<string, string[]>; // primary term -> synonyms
  weights: Record<string, number>; // concept -> weight
  customConcepts: ConceptDefinition[];
  // Additional mappings for advanced functionality
  groupMappings?: Record<string, string[]>; // concept -> group IDs
  connections?: ConceptMapping[];
}

export interface ConceptMapping {
  id: string;
  conceptId: string;
  targetId: string;
  targetType: 'group' | 'layer';
  strength: number;
  confidence: number;
  reasoning: string;
  isActive: boolean;
  createdAt: string;
  lastUsed?: string;
}

export interface AIConceptDefinition extends ConceptDefinition {
  keywords: string[];
  synonyms: string[];
  relatedConcepts: string[];
  queryPatterns: string[];
  examples: string[];
  confidence: number;
}

export interface ConceptLayerRelationship {
  conceptId: string;
  layerId: string;
  strength: number;
  type: 'primary' | 'secondary' | 'related';
  confidence: number;
}

export interface ConceptDefinition {
  id: string;
  name: string;
  terms: string[];
  weight: number;
  category: string;
  description?: string;
}

export interface DependencyConfiguration {
  files: FileDependency[];
  services: ServiceDependency[];
  components: ComponentDependency[];
}

export interface FileDependency {
  path: string;
  type: 'config' | 'component' | 'service' | 'utility';
  layerReferences: LayerReference[];
  updateStrategy: 'auto' | 'manual' | 'prompt';
}

export interface LayerReference {
  layerId: string;
  referenceType: 'import' | 'hardcoded' | 'dynamic';
  location: {
    line?: number;
    column?: number;
    context: string;
  };
}

export interface ServiceDependency {
  name: string;
  endpoint?: string;
  layerDependencies: string[];
  configPath?: string;
}

export interface ComponentDependency {
  name: string;
  path: string;
  layerProps: string[];
  configProps: string[];
}

export interface ProjectSettings {
  defaultVisibility: Record<string, boolean>;
  defaultCollapsed: Record<string, boolean>;
  globalSettings: {
    defaultOpacity: number;
    maxVisibleLayers: number;
    performanceMode: 'standard' | 'optimized';
    autoSave: boolean;
    previewMode: boolean;
  };
  ui: {
    theme: 'light' | 'dark' | 'auto';
    compactMode: boolean;
    showAdvanced: boolean;
  };
}

export interface ProjectMetadata {
  industry?: string;
  useCase?: string;
  targetAudience?: string[];
  dataRequirements?: string[];
  performanceRequirements?: {
    maxLoadTime: number;
    maxLayers: number;
    memoryLimit: number;
  };
  integrations?: string[];
}

// Configuration Management Types
export interface ConfigurationManager {
  loadConfiguration(id: string): Promise<ProjectConfiguration>;
  saveConfiguration(config: ProjectConfiguration): Promise<void>;
  validateConfiguration(config: ProjectConfiguration): ValidationResult;
  deployConfiguration(config: ProjectConfiguration): Promise<DeploymentResult>;
  analyzeImpact(config: ProjectConfiguration, changes: ConfigurationChange[]): ImpactAnalysis;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: ValidationSuggestion[];
}

export interface ValidationError {
  type: 'missing_layer' | 'invalid_url' | 'circular_dependency' | 'configuration_conflict';
  message: string;
  path: string;
  severity: 'error' | 'warning';
  autoFixAvailable: boolean;
}

export interface ValidationWarning {
  type: 'performance' | 'deprecation' | 'best_practice';
  message: string;
  path: string;
  recommendation?: string;
}

export interface ValidationSuggestion {
  type: 'optimization' | 'enhancement' | 'simplification';
  message: string;
  implementation?: string;
  impact: 'low' | 'medium' | 'high';
}

export interface DeploymentResult {
  success: boolean;
  filesUpdated: string[];
  errors: DeploymentError[];
  warnings?: string[];
  rollbackAvailable: boolean;
  deploymentId: string;
  simulationMode?: boolean;
  queryTestingEnabled?: boolean;
  dependencyTestResults?: {
    success: boolean;
    results: {
      coreConfiguration: { passed: number; failed: number; errors: string[] };
      frontendComponents: { passed: number; failed: number; errors: string[] };
      utilityServices: { passed: number; failed: number; errors: string[] };
      apiRoutes: { passed: number; failed: number; errors: string[] };
      serviceLayer: { passed: number; failed: number; errors: string[] };
      microserviceIntegration: { passed: number; failed: number; errors: string[] };
      typeDefinitions: { passed: number; failed: number; errors: string[] };
      configurationFiles: { passed: number; failed: number; errors: string[] };
    };
    totalFiles: number;
    passedFiles: number;
    failedFiles: number;
    criticalFailures: string[];
  };
  queryTestResults?: {
    totalTests: number;
    passed: number;
    failed: number;
    criticalTestsPassed: boolean;
    overallSuccessRate: number;
    failedTests: Array<{
      testQuery: {
        query: string;
        priority: 'critical' | 'important' | 'optional';
      };
      pipelineStage: 'parsing' | 'classification' | 'visualization' | 'display' | 'complete';
    }>;
    recommendations: string[];
    pipelineHealthReport: {
      parsingSuccessRate: number;
      classificationSuccessRate: number;
      visualizationSuccessRate: number;
      displaySuccessRate: number;
    };
  };
}

export interface DeploymentError {
  file: string;
  error: string;
  critical: boolean;
}

export interface ImpactAnalysis {
  affectedFiles: string[];
  affectedComponents: string[];
  affectedServices: string[];
  riskLevel: 'low' | 'medium' | 'high';
  estimatedDowntime: number;
  rollbackComplexity: 'simple' | 'moderate' | 'complex';
  recommendations: string[];
  breakingChanges: BreakingChange[];
}

export interface BreakingChange {
  type: 'layer_removal' | 'layer_modification' | 'service_change' | 'config_change';
  description: string;
  affectedFiles: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  autoFixAvailable: boolean;
  recommendation: string;
}

export interface ConfigurationChange {
  type: 'add' | 'remove' | 'modify';
  target: 'layer' | 'layers' | 'group' | 'concept' | 'setting' | 'service' | 'conceptMapping';
  path: string;
  oldValue?: any;
  newValue?: any;
  reason?: string;
}

// UI State Management
export interface ProjectConfigUIState {
  activeTab: 'services' | 'layers' | 'groups' | 'concepts' | 'dependencies' | 'settings' | 'preview';
  selectedLayer?: string;
  selectedGroup?: string;
  editMode: boolean;
  previewMode: boolean;
  unsavedChanges: boolean;
  validationStatus: ValidationResult | null;
  deploymentStatus: 'idle' | 'validating' | 'deploying' | 'success' | 'error';
}

// Database Schema Types
export interface ProjectConfigurationRecord {
  id: string;
  name: string;
  description: string;
  configuration: ProjectConfiguration;
  template_id?: string;
  user_id: string;
  organization_id?: string;
  is_active: boolean;
  is_template: boolean;
  created_at: string;
  updated_at: string;
  version: number;
  tags: string[];
}

export interface TemplateRecord {
  id: string;
  name: string;
  description: string;
  category: string;
  configuration: ProjectConfiguration;
  author_id: string;
  is_public: boolean;
  download_count: number;
  rating: number;
  created_at: string;
  updated_at: string;
  version: string;
  preview_image?: string;
  documentation?: string;
  tags: string[];
}

// ArcGIS Service-Based Configuration
export interface ArcGISService {
  id: string;
  name: string;
  description?: string;
  baseUrl: string; // e.g., "https://services8.arcgis.com/.../FeatureServer"
  serviceType: 'FeatureServer' | 'MapServer' | 'ImageServer';
  metadata?: {
    serviceItemId?: string;
    maxRecordCount?: number;
    hasVersionedData?: boolean;
    spatialReference?: number;
    extent?: {
      xmin: number;
      ymin: number;
      xmax: number;
      ymax: number;
    };
  };
  authentication?: {
    type: 'none' | 'token' | 'oauth';
    credentials?: any;
  };
  layerDiscovery: {
    autoDiscover: boolean;
    lastDiscovered?: string;
    layerCount?: number;
    excludeLayerIds?: number[];
    includeOnlyLayerIds?: number[];
  };
  bulkSettings: {
    defaultGroup?: string;
    defaultStatus?: 'active' | 'inactive' | 'deprecated';
    defaultOpacity?: number;
    applyToAll?: boolean;
  };
}

export interface ServiceDerivedLayer extends EnhancedLayerConfig {
  serviceId: string;
  serviceLayerId: number; // The ID within the service (0, 1, 2, etc.)
  derivedFrom: {
    serviceUrl: string;
    layerIndex: number;
    autoGenerated: boolean;
    lastSynced?: string;
  };
  serviceMetadata?: {
    name?: string;
    description?: string;
    geometryType?: string;
    fields?: ArcGISField[];
    capabilities?: string[];
  };
}

export interface ArcGISField {
  name: string;
  type: string;
  alias?: string;
  length?: number;
  nullable?: boolean;
  editable?: boolean;
  domain?: any;
}

// Live Preview System Types
export interface LivePreviewConfiguration {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  previewMode: PreviewMode;
  comparisonConfig?: ComparisonConfiguration;
  realTimeUpdates: boolean;
  autoRefresh: boolean;
  refreshInterval: number; // seconds
  previewSettings: PreviewSettings;
  mapConfiguration: MapPreviewConfiguration;
  dataConfiguration: DataPreviewConfiguration;
  performanceMetrics: PreviewPerformanceMetrics;
  createdAt: string;
  updatedAt: string;
}

export interface PreviewMode {
  type: 'single' | 'comparison' | 'timeline' | 'interactive';
  configuration: SinglePreviewConfig | ComparisonPreviewConfig | TimelinePreviewConfig | InteractivePreviewConfig;
}

export interface SinglePreviewConfig {
  projectConfiguration: ProjectConfiguration;
  viewMode: 'map' | 'data' | 'combined';
  highlightChanges: boolean;
  showMetadata: boolean;
}

export interface ComparisonPreviewConfig {
  baseConfiguration: ProjectConfiguration;
  targetConfiguration: ProjectConfiguration;
  comparisonType: 'side-by-side' | 'overlay' | 'difference';
  highlightDifferences: boolean;
  showOnlyChanges: boolean;
  diffAnalysis: DifferenceAnalysis;
}

export interface TimelinePreviewConfig {
  configurations: TimelineConfigurationPoint[];
  currentIndex: number;
  autoPlay: boolean;
  playbackSpeed: number; // multiplier
  showTransitions: boolean;
}

export interface InteractivePreviewConfig {
  baseConfiguration: ProjectConfiguration;
  allowedModifications: InteractiveModification[];
  constraints: PreviewConstraint[];
  realTimeValidation: boolean;
  undoRedoEnabled: boolean;
}

export interface TimelineConfigurationPoint {
  timestamp: string;
  configuration: ProjectConfiguration;
  changeDescription: string;
  author?: string;
  version: string;
}

export interface InteractiveModification {
  type: 'layer_visibility' | 'layer_opacity' | 'layer_order' | 'group_collapse' | 'filter_change';
  layerId?: string;
  groupId?: string;
  allowedValues?: any[];
  constraints?: any;
}

export interface PreviewConstraint {
  type: 'max_layers' | 'memory_limit' | 'performance_threshold' | 'data_limit';
  value: number;
  description: string;
}

export interface ComparisonConfiguration {
  baselineId: string;
  targetId: string;
  comparisonType: 'configuration' | 'performance' | 'visual' | 'data';
  metrics: ComparisonMetric[];
  thresholds: ComparisonThreshold[];
}

export interface ComparisonMetric {
  name: string;
  type: 'numeric' | 'boolean' | 'categorical' | 'performance';
  unit?: string;
  description: string;
  weight: number; // for overall scoring
}

export interface ComparisonThreshold {
  metric: string;
  operator: 'gt' | 'lt' | 'eq' | 'ne' | 'gte' | 'lte';
  value: number;
  severity: 'info' | 'warning' | 'error';
  message: string;
}

export interface DifferenceAnalysis {
  layerChanges: LayerDifference[];
  groupChanges: GroupDifference[];
  conceptChanges: ConceptDifference[];
  settingChanges: SettingDifference[];
  summary: DifferenceSummary;
}

export interface LayerDifference {
  layerId: string;
  changeType: 'added' | 'removed' | 'modified';
  fieldChanges?: FieldDifference[];
  propertyChanges?: PropertyDifference[];
  impact: 'low' | 'medium' | 'high';
  description: string;
}

export interface GroupDifference {
  groupId: string;
  changeType: 'added' | 'removed' | 'modified' | 'reordered';
  layerChanges?: string[]; // layer IDs that moved in/out
  propertyChanges?: PropertyDifference[];
  impact: 'low' | 'medium' | 'high';
}

export interface ConceptDifference {
  conceptId: string;
  changeType: 'added' | 'removed' | 'modified';
  mappingChanges?: MappingDifference[];
  impact: 'low' | 'medium' | 'high';
}

export interface SettingDifference {
  settingPath: string;
  changeType: 'added' | 'removed' | 'modified';
  oldValue?: any;
  newValue?: any;
  impact: 'low' | 'medium' | 'high';
}

export interface FieldDifference {
  fieldName: string;
  changeType: 'added' | 'removed' | 'modified';
  oldValue?: any;
  newValue?: any;
}

export interface PropertyDifference {
  propertyName: string;
  changeType: 'added' | 'removed' | 'modified';
  oldValue?: any;
  newValue?: any;
}

export interface MappingDifference {
  mappingType: 'layer' | 'field' | 'synonym';
  changeType: 'added' | 'removed' | 'modified';
  oldValue?: any;
  newValue?: any;
}

export interface DifferenceSummary {
  totalChanges: number;
  layerChanges: number;
  groupChanges: number;
  conceptChanges: number;
  settingChanges: number;
  impactLevel: 'low' | 'medium' | 'high';
  riskAssessment: string;
  recommendations: string[];
}

export interface PreviewSettings {
  mapSettings: {
    initialExtent?: {
      xmin: number;
      ymin: number;
      xmax: number;
      ymax: number;
    };
    basemap: string;
    zoom?: {
      min: number;
      max: number;
      initial: number;
    };
    center?: {
      latitude: number;
      longitude: number;
    };
  };
  layerSettings: {
    defaultOpacity: number;
    maxVisibleLayers: number;
    renderingMode: 'performance' | 'quality' | 'balanced';
    symbolization: 'default' | 'optimized' | 'custom';
  };
  uiSettings: {
    showLegend: boolean;
    showLayerList: boolean;
    showMeasurementTools: boolean;
    showSearchTool: boolean;
    compactMode: boolean;
    theme: 'light' | 'dark' | 'auto';
  };
  dataSettings: {
    maxRecordsPerLayer: number;
    enableCaching: boolean;
    cacheTimeout: number; // minutes
    enableClustering: boolean;
    clusteringDistance: number; // pixels
  };
}

export interface MapPreviewConfiguration {
  mapLibrary: 'arcgis' | 'leaflet' | 'mapbox' | 'openlayers';
  apiKeys: Record<string, string>;
  basemapOptions: BasemapOption[];
  defaultBasemap: string;
  mapExtent: MapExtent;
  projectionSettings: ProjectionSettings;
  renderingSettings: RenderingSettings;
}

export interface BasemapOption {
  id: string;
  name: string;
  url?: string;
  type: 'tile' | 'image' | 'vector';
  attribution?: string;
  thumbnailUrl?: string;
}

export interface MapExtent {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
  spatialReference: {
    wkid: number;
    latestWkid?: number;
  };
}

export interface ProjectionSettings {
  inputProjection: number; // WKID
  outputProjection: number; // WKID
  transformations?: ProjectionTransformation[];
}

export interface ProjectionTransformation {
  from: number;
  to: number;
  transformation: string;
}

export interface RenderingSettings {
  antialiasing: boolean;
  transparency: boolean;
  decluttering: boolean;
  labelingEnabled: boolean;
  symbolQuality: 'low' | 'medium' | 'high';
  textHinting: boolean;
}

export interface DataPreviewConfiguration {
  sampleDataSize: number; // number of records to preview
  enableRealTimeData: boolean;
  dataRefreshInterval: number; // seconds
  dataValidation: DataValidationSettings;
  statisticsCalculation: StatisticsSettings;
  spatialAnalysis: SpatialAnalysisSettings;
}

export interface DataValidationSettings {
  enableValidation: boolean;
  validationRules: DataValidationRule[];
  showValidationErrors: boolean;
  strictMode: boolean;
}

export interface DataValidationRule {
  field: string;
  rule: 'required' | 'type' | 'range' | 'pattern' | 'custom';
  parameters?: any;
  errorMessage: string;
}

export interface StatisticsSettings {
  enableStatistics: boolean;
  autoCalculate: boolean;
  statisticTypes: ('count' | 'sum' | 'avg' | 'min' | 'max' | 'stddev')[];
  groupByFields: string[];
  updateInterval: number; // seconds
}

export interface SpatialAnalysisSettings {
  enableSpatialAnalysis: boolean;
  analysisTypes: ('buffer' | 'intersect' | 'union' | 'clip' | 'dissolve')[];
  defaultBufferDistance: number;
  defaultBufferUnits: string;
  enableGeometryValidation: boolean;
}

export interface PreviewPerformanceMetrics {
  loadTime: number; // milliseconds
  renderTime: number; // milliseconds
  memoryUsage: number; // MB
  networkRequests: number;
  dataTransferred: number; // KB
  errorCount: number;
  warningCount: number;
  lastUpdated: string;
  historicalMetrics: HistoricalMetric[];
}

export interface HistoricalMetric {
  timestamp: string;
  loadTime: number;
  renderTime: number;
  memoryUsage: number;
  errorCount: number;
}

export interface PreviewState {
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  currentConfiguration: ProjectConfiguration | null;
  previewData: PreviewData | null;
  performanceMetrics: PreviewPerformanceMetrics | null;
  validationResults: PreviewValidationResult[];
  userInteractions: PreviewInteraction[];
  lastUpdateTime: string;
}

export interface PreviewData {
  layers: PreviewLayerData[];
  groups: PreviewGroupData[];
  statistics: PreviewStatistics;
  spatialExtent: MapExtent;
  dataQuality: DataQualityMetrics;
}

export interface PreviewLayerData {
  layerId: string;
  name: string;
  recordCount: number;
  geometryType: string;
  extent: MapExtent;
  fields: PreviewFieldData[];
  sampleData: any[];
  renderingInfo: LayerRenderingInfo;
  status: 'loaded' | 'loading' | 'error' | 'empty';
  errorMessage?: string;
}

export interface PreviewFieldData {
  name: string;
  type: string;
  alias?: string;
  uniqueValues?: any[];
  statistics?: FieldStatistics;
  nullCount: number;
  sampleValues: any[];
}

export interface FieldStatistics {
  min?: number;
  max?: number;
  avg?: number;
  sum?: number;
  count: number;
  stddev?: number;
}

export interface LayerRenderingInfo {
  renderer: any; // ArcGIS renderer object
  transparency: number;
  visible: boolean;
  minScale: number;
  maxScale: number;
  labelingInfo?: any[];
}

export interface PreviewGroupData {
  groupId: string;
  name: string;
  layerCount: number;
  visibleLayerCount: number;
  totalRecordCount: number;
  isExpanded: boolean;
  status: 'loaded' | 'loading' | 'error' | 'partial';
}

export interface PreviewStatistics {
  totalLayers: number;
  activeLayers: number;
  totalRecords: number;
  averageLoadTime: number;
  dataTransferred: number;
  cacheHitRate: number;
  errorRate: number;
}

export interface DataQualityMetrics {
  completeness: number; // percentage
  accuracy: number; // percentage
  consistency: number; // percentage
  validity: number; // percentage
  issues: DataQualityIssue[];
}

export interface DataQualityIssue {
  type: 'missing_data' | 'invalid_geometry' | 'duplicate_records' | 'inconsistent_format';
  layerId: string;
  fieldName?: string;
  severity: 'low' | 'medium' | 'high';
  count: number;
  description: string;
  suggestedFix?: string;
}

export interface PreviewValidationResult {
  type: 'configuration' | 'data' | 'performance' | 'accessibility';
  status: 'pass' | 'warning' | 'error';
  message: string;
  details?: string;
  suggestion?: string;
  autoFixAvailable: boolean;
}

export interface PreviewInteraction {
  timestamp: string;
  type: 'layer_toggle' | 'zoom' | 'pan' | 'query' | 'filter' | 'identify';
  target?: string; // layer ID or element ID
  parameters?: any;
  duration?: number; // milliseconds
  result?: 'success' | 'error' | 'timeout';
}

// Preview Service Interfaces
export interface PreviewService {
  createPreview(config: ProjectConfiguration): Promise<PreviewState>;
  updatePreview(previewId: string, changes: ConfigurationChange[]): Promise<PreviewState>;
  compareConfigurations(baseConfig: ProjectConfiguration, targetConfig: ProjectConfiguration): Promise<DifferenceAnalysis>;
  validatePreview(previewId: string): Promise<PreviewValidationResult[]>;
  getPreviewMetrics(previewId: string): Promise<PreviewPerformanceMetrics>;
  exportPreview(previewId: string, format: 'json' | 'pdf' | 'html'): Promise<Blob>;
}

export interface PreviewManager {
  activePreviews: Map<string, PreviewState>;
  createLivePreview(config: LivePreviewConfiguration): Promise<string>;
  updateLivePreview(previewId: string, updates: Partial<LivePreviewConfiguration>): Promise<void>;
  destroyPreview(previewId: string): Promise<void>;
  getPreviewState(previewId: string): PreviewState | null;
  subscribeToUpdates(previewId: string, callback: (state: PreviewState) => void): () => void;
}

// Real-time Update Types
export interface RealTimeUpdate {
  previewId: string;
  timestamp: string;
  updateType: 'configuration' | 'data' | 'performance' | 'validation';
  payload: any;
  source: 'user' | 'system' | 'external';
}

export interface RealTimeUpdateHandler {
  handleConfigurationUpdate(update: ConfigurationUpdate): Promise<void>;
  handleDataUpdate(update: DataUpdate): Promise<void>;
  handlePerformanceUpdate(update: PerformanceUpdate): Promise<void>;
  handleValidationUpdate(update: ValidationUpdate): Promise<void>;
}

export interface ConfigurationUpdate {
  changes: ConfigurationChange[];
  impactAnalysis: ImpactAnalysis;
  validationResults: ValidationResult;
}

export interface DataUpdate {
  layerId: string;
  updateType: 'refresh' | 'schema_change' | 'data_change';
  affectedRecords?: number;
  newData?: any[];
}

export interface PerformanceUpdate {
  metrics: PreviewPerformanceMetrics;
  alerts: PerformanceAlert[];
  recommendations: PerformanceRecommendation[];
}

export interface ValidationUpdate {
  results: PreviewValidationResult[];
  criticalIssues: PreviewValidationResult[];
  autoFixesApplied: string[];
}

export interface PerformanceAlert {
  type: 'memory' | 'load_time' | 'render_time' | 'network';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  threshold: number;
  currentValue: number;
  suggestion?: string;
}

export interface PerformanceRecommendation {
  type: 'optimization' | 'configuration' | 'infrastructure';
  priority: 'low' | 'medium' | 'high';
  description: string;
  implementation: string;
  expectedImpact: string;
  estimatedEffort: 'low' | 'medium' | 'high';
}

export interface MicroserviceConfiguration {
  id: string;
  name: string;
  type: 'shap' | 'analytics' | 'custom';
  url: string;
  description?: string;
  status: 'active' | 'inactive' | 'testing';
  apiKey?: string;
  endpoints: {
    health: string;
    main: string;
    [key: string]: string;
  };
  capabilities: string[];
  dataSource?: {
    type: 'arcgis' | 'csv' | 'api';
    source: string;
    lastUpdated: string;
    recordCount: number;
  };
  performance?: {
    avgResponseTime: number;
    uptime: number;
    lastCheck: string;
  };
  metadata: {
    version: string;
    author: string;
    tags: string[];
    documentation?: string;
  };
  // New advanced query configuration
  advancedQueries?: AdvancedQueryConfiguration;
}

export interface AdvancedQueryConfiguration {
  enableOutlierDetection: boolean;
  enableScenarioAnalysis: boolean;
  enableFeatureInteractions: boolean;
  enableThresholdAnalysis: boolean;
  enableSegmentProfiling: boolean;
  enableComparativeAnalysis: boolean;
  
  outlierDetection?: {
    method: 'isolation_forest' | 'iqr' | 'zscore';
    contamination: number;
    explainOutliers: boolean;
  };
  
  scenarioAnalysis?: {
    defaultScenarios: ScenarioTemplate[];
    allowCustomScenarios: boolean;
    maxScenarios: number;
  };
  
  featureInteractions?: {
    maxInteractions: number;
    interactionThreshold: number;
    includeHigherOrder: boolean;
  };

  thresholdAnalysis?: {
    numBins: number;
    minSamplesPerBin: number;
    significanceThreshold: number;
    includeInflectionPoints: boolean;
  };

  segmentProfiling?: {
    defaultMethod: 'percentile' | 'kmeans' | 'custom';
    numSegments: number;
    percentileThresholds: number[];
    minSegmentSize: number;
  };

  comparativeAnalysis?: {
    defaultGroupingFields: string[];
    maxGroups: number;
    includeStatisticalTests: boolean;
    significanceLevel: number;
  };
}

export interface ThresholdAnalysisConfig {
  numBins: number;
  minSamplesPerBin: number;
  significanceThreshold: number;
  includeInflectionPoints: boolean;
}

export interface SegmentProfilingConfig {
  defaultMethod: 'percentile' | 'kmeans' | 'custom';
  numSegments: number;
  percentileThresholds: number[];
  minSegmentSize: number;
}

export interface ComparativeAnalysisConfig {
  defaultGroupingFields: string[];
  maxGroups: number;
  includeStatisticalTests: boolean;
  significanceLevel: number;
}

export interface ScenarioTemplate {
  id: string;
  name: string;
  description: string;
  type: 'percentage' | 'absolute' | 'policy';
  changes: {
    field: string;
    changeType: 'increase' | 'decrease' | 'set';
    value: number;
    unit: 'percent' | 'absolute';
  }[];
  feasibility: 'high' | 'medium' | 'low';
  timeframe: string;
  tags: string[];
} 