/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { EndpointConfiguration, VisualizationType, AnalysisEngineConfig } from './types';
import { 
  AnalysisContext, 
  FieldMappings, 
  Terminology, 
  ScoreRange,
  ScoreRanges,
  SummaryTemplates,
  ProcessorConfig
} from '../../config/analysis-contexts/base-context';
import { 
  getAnalysisContext, 
  isProjectTypeSupported, 
  getAvailableProjectTypes,
  REAL_ESTATE_CONTEXT 
} from '../../config/analysis-contexts';

/**
 * Unified Configuration Manager
 * 
 * Consolidates all configuration management into a single, coherent system:
 * - Endpoint configurations (from ConfigurationManager)
 * - Context-aware field mappings (from AnalysisConfigurationManager)
 * - Centralized field mappings (from FieldMappingConfig)
 * - Hardcoded definitions (from HardcodedFieldDefs)
 * 
 * This eliminates duplication and provides a single source of truth.
 */
export class UnifiedConfigurationManager {
  private static instance: UnifiedConfigurationManager | null = null;
  
  // Endpoint and project configuration
  private endpointConfigs: Map<string, EndpointConfiguration> = new Map();
  private currentContext: AnalysisContext;
  private currentProjectType: string;
  
  // Caching and validation
  private configCache: Map<string, any> = new Map();
  private initialized: boolean = false;
  private lastLoadTime: number = 0;

  private constructor() {
    // Default to real estate for this project
    this.currentProjectType = 'real_estate';
    this.currentContext = REAL_ESTATE_CONTEXT;
    this.initializeConfiguration();
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): UnifiedConfigurationManager {
    if (!UnifiedConfigurationManager.instance) {
      console.log('[UnifiedConfigurationManager] Creating singleton instance...');
      UnifiedConfigurationManager.instance = new UnifiedConfigurationManager();
    }
    return UnifiedConfigurationManager.instance;
  }

  /**
   * Reset the singleton instance (for testing)
   */
  public static resetInstance(): void {
    UnifiedConfigurationManager.instance = null;
  }

  /**
   * Initialize all configuration data
   */
  private initializeConfiguration(): void {
    if (this.initialized) return;
    
    try {
      console.log('[UnifiedConfigurationManager] Loading unified configurations...');
      this.loadEndpointConfigurations();
      this.initialized = true;
      this.lastLoadTime = Date.now();
      
      console.log(`[UnifiedConfigurationManager] ✅ Loaded configurations for ${this.endpointConfigs.size} endpoints`);
    } catch (error) {
      console.error('[UnifiedConfigurationManager] Failed to load configurations:', error);
      throw new Error(`Configuration loading failed: ${error}`);
    }
  }

  // ============================================================================
  // PROJECT TYPE AND CONTEXT MANAGEMENT
  // ============================================================================

  /**
   * Set the current project type and switch context
   */
  public setProjectType(projectType: string): void {
    if (!isProjectTypeSupported(projectType)) {
      console.warn(`[UnifiedConfigurationManager] Unsupported project type: ${projectType}`);
      console.log(`[UnifiedConfigurationManager] Available types: ${getAvailableProjectTypes().join(', ')}`);
      return;
    }

    this.currentProjectType = projectType;
    this.currentContext = getAnalysisContext(projectType);
    this.clearCache();
    
    console.log(`[UnifiedConfigurationManager] Switched to project type: ${projectType}`);
  }

  /**
   * Get the current analysis context
   */
  public getCurrentContext(): AnalysisContext {
    return this.currentContext;
  }

  /**
   * Get the current project type
   */
  public getCurrentProjectType(): string {
    return this.currentProjectType;
  }

  // ============================================================================
  // UNIFIED FIELD MAPPING SYSTEM
  // ============================================================================

  /**
   * Extract primary metric from record using unified field mapping logic
   * Combines logic from AnalysisConfigurationManager and hardcoded definitions
   */
  public extractPrimaryMetric(record: any, analysisType?: string): number {
    // Try analysis-type specific mapping first
    if (analysisType) {
      const typeSpecificField = this.getPrimaryScoreField(analysisType);
      if (record[typeSpecificField] !== undefined && record[typeSpecificField] !== null) {
        const value = Number(record[typeSpecificField]);
        if (!isNaN(value)) return value;
      }
    }

    // Try context-configured primary metric fields
    const primaryFields = this.getFieldMapping('primaryMetric');
    for (const field of primaryFields) {
      if (record[field] !== undefined && record[field] !== null) {
        const value = Number(record[field]);
        if (!isNaN(value)) return value;
      }
    }

    // Fallback to common patterns
    const fallbackFields = ['value', 'score', 'analysis_score', 'thematic_value'];
    for (const field of fallbackFields) {
      if (record[field] !== undefined && record[field] !== null) {
        const value = Number(record[field]);
        if (!isNaN(value)) return value;
      }
    }

    console.warn('[UnifiedConfigurationManager] No primary metric found in record', {
      availableFields: Object.keys(record),
      analysisType,
      expectedFields: primaryFields
    });

    return 0;
  }

  /**
   * Get primary score field for an analysis type
   * Combines logic from HardcodedFieldDefs and FieldMappingConfig
   */
  public getPrimaryScoreField(analysisType: string, metadata?: Record<string, unknown>): string {
    // Check metadata override first
    if (metadata && typeof metadata['targetVariable'] === 'string') {
      return metadata['targetVariable'] as string;
    }

    const normalizedType = analysisType.toLowerCase().replace(/-/g, '_');
    
    // Unified field mapping (combines HardcodedFieldDefs logic)
    const fieldMappings: Record<string, string> = {
      // Real Estate Analysis
      'market_trend_analysis': 'market_trend_score',
      'price_prediction_analysis': 'price_prediction_score', 
      'rental_market_analysis': 'rental_analysis_score',
      'investment_opportunities': 'investment_opportunity_score',
      'comparative_market_analysis': 'cma_analysis_score',
      
      // Core Analysis Types
      'strategic_analysis': 'strategic_analysis_score',
      'strategic': 'strategic_analysis_score',
      'analyze': 'analysis_score',
      'competitive_analysis': 'competitive_analysis_score',
      'competitive': 'competitive_analysis_score',
      'demographic_insights': 'demographic_insights_score',
      'demographic_analysis': 'demographic_insights_score',
      'demographic': 'demographic_insights_score',
      'trend_analysis': 'trend_analysis_score',
      'trend': 'trend_analysis_score',
      'correlation_analysis': 'correlation_analysis_score',
      'spatial_clusters': 'spatial_clusters_score',
      'cluster': 'spatial_clusters_score',
      'brand_difference': 'brand_difference_score',
      'anomaly_detection': 'anomaly_detection_score',
      'outlier_detection': 'outlier_detection_score',
      'predictive_modeling': 'predictive_modeling_score',
      'customer_profile': 'customer_profile_score',
      'scenario_analysis': 'scenario_analysis_score',
      'segment_profiling': 'segment_profiling_score',
      'comparative_analysis': 'comparison_score',
      'feature_interactions': 'feature_interactions_score',
      'consensus_analysis': 'consensus_analysis_score',
      'sensitivity_analysis': 'sensitivity_analysis_score',
      
      // Advanced Analysis Types
      'nonlinear_analysis': 'nonlinear_analysis_score',
      'similarity_analysis': 'similarity_analysis_score',
      'feature_selection_analysis': 'feature_selection_score',
      'interpretability_analysis': 'interpretability_score',
      'speed_optimized_analysis': 'speed_optimized_score'
    };

    return fieldMappings[normalizedType] || 'value';
  }

  /**
   * Get field mappings for data extraction (from context)
   */
  public getFieldMappings(): FieldMappings {
    return this.currentContext.fieldMappings;
  }

  /**
   * Get specific field mapping category
   */
  public getFieldMapping(category: keyof FieldMappings): string[] {
    return this.currentContext.fieldMappings[category] || [];
  }

  /**
   * Extract geographic ID from record using unified logic
   */
  public extractGeographicId(record: any): string {
    const geoFields = this.getFieldMapping('geographicId');
    
    for (const field of geoFields) {
      if (record[field] !== undefined && record[field] !== null) {
        return String(record[field]);
      }
    }
    
    return 'unknown';
  }

  /**
   * Extract descriptive name from record using unified logic
   */
  public extractDescriptiveName(record: any): string {
    const descriptiveFields = this.getFieldMapping('descriptiveFields');
    
    for (const field of descriptiveFields) {
      if (record[field] !== undefined && record[field] !== null) {
        const value = String(record[field]);
        if (value.trim() && !value.toLowerCase().includes('unknown')) {
          return value;
        }
      }
    }
    
    return this.extractGeographicId(record);
  }

  /**
   * Extract field value with multiple field name options
   */
  public extractFieldValue(record: any, fieldNames: string[]): any {
    for (const fieldName of fieldNames) {
      if (record[fieldName] !== undefined && record[fieldName] !== null) {
        return record[fieldName];
      }
      // Also check properties object if it exists
      if (record.properties?.[fieldName] !== undefined && record.properties[fieldName] !== null) {
        return record.properties[fieldName];
      }
    }
    return null;
  }

  /**
   * Extract numeric field value with fallbacks and default
   */
  public extractNumericValue(record: any, fieldNames: string[], defaultValue: number = 0): number {
    const value = this.extractFieldValue(record, fieldNames);
    if (value !== null) {
      const numValue = Number(value);
      return isNaN(numValue) ? defaultValue : numValue;
    }
    return defaultValue;
  }

  // ============================================================================
  // ENDPOINT CONFIGURATION MANAGEMENT
  // ============================================================================

  /**
   * Get endpoint configuration by ID
   */
  public getEndpointConfig(endpointId: string): EndpointConfiguration | null {
    return this.endpointConfigs.get(endpointId) || null;
  }

  /**
   * Get all endpoint configurations
   */
  public getEndpointConfigurations(): EndpointConfiguration[] {
    return Array.from(this.endpointConfigs.values());
  }

  /**
   * Get endpoints by category
   */
  public getEndpointsByCategory(category: string): EndpointConfiguration[] {
    const cacheKey = `category_${category}`;
    
    if (this.configCache.has(cacheKey)) {
      return this.configCache.get(cacheKey);
    }
    
    const endpoints = this.getEndpointConfigurations()
      .filter(config => config.category === category);
    
    this.configCache.set(cacheKey, endpoints);
    return endpoints;
  }

  // ============================================================================
  // CONTEXT-AWARE CONFIGURATION
  // ============================================================================

  /**
   * Get terminology configuration
   */
  public getTerminology(): Terminology {
    return this.currentContext.terminology;
  }

  /**
   * Get score interpretation for a given score
   */
  public getScoreInterpretation(score: number): ScoreRange {
    const ranges = this.currentContext.scoreRanges;
    
    if (score >= ranges.excellent.min) return ranges.excellent;
    if (score >= ranges.good.min) return ranges.good;
    if (score >= ranges.moderate.min) return ranges.moderate;
    return ranges.poor;
  }

  /**
   * Get all score ranges
   */
  public getScoreRanges(): ScoreRanges {
    return this.currentContext.scoreRanges;
  }

  /**
   * Get summary templates
   */
  public getSummaryTemplates(): SummaryTemplates {
    return this.currentContext.summaryTemplates;
  }

  /**
   * Get processor-specific configuration
   */
  public getProcessorConfig(): ProcessorConfig {
    return this.currentContext.processorConfig;
  }

  /**
   * Apply template substitutions using context
   */
  public applyTemplate(template: string, substitutions: Record<string, any>): string {
    let result = template;
    
    // Apply terminology substitutions
    const terminology = this.getTerminology();
    result = result.replace(/\{metricName\}/g, terminology.metricName);
    result = result.replace(/\{entityType\}/g, terminology.entityType);
    result = result.replace(/\{scoreDescription\}/g, terminology.scoreDescription);
    result = result.replace(/\{comparisonContext\}/g, terminology.comparisonContext);
    
    // Apply custom substitutions
    Object.entries(substitutions).forEach(([key, value]) => {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      result = result.replace(regex, String(value));
    });
    
    return result;
  }

  // ============================================================================
  // MULTI-TARGET ANALYSIS SUPPORT
  // ============================================================================

  /**
   * Check if multi-target analysis is enabled for current project
   */
  public isMultiTargetEnabled(): boolean {
    return this.currentProjectType === 'real_estate';
  }

  /**
   * Get default target variables for current project
   */
  public getDefaultTargetVariables(): string[] {
    if (this.currentProjectType === 'real_estate') {
      return ['time_on_market', 'avg_sold_price', 'avg_rent_price', 'price_delta'];
    }
    return ['value'];
  }

  /**
   * Extract multiple target values from a record
   */
  public extractMultiTargetValues(record: any, targetVariables: string[]): Record<string, number> {
    const values: Record<string, number> = {};

    targetVariables.forEach(target => {
      const targetFields = this.getTargetVariableFields(target);
      for (const field of targetFields) {
        if (record[field] !== undefined && record[field] !== null) {
          const value = Number(record[field]);
          if (!isNaN(value)) {
            values[target] = value;
            break;
          }
        }
      }
    });

    return values;
  }

  /**
   * Get field mappings for a specific target variable
   */
  public getTargetVariableFields(targetVariable: string): string[] {
    // Real estate specific mappings
    const realEstateTargetMappings: Record<string, string[]> = {
      'time_on_market': ['time_on_market', 'days_on_market', 'dom', 'time_to_sale'],
      'avg_sold_price': ['avg_sold_price', 'average_sold_price', 'mean_sold_price', 'sold_price_avg'],
      'avg_rent_price': ['avg_rent_price', 'average_rent_price', 'mean_rent_price', 'rent_price_avg'],
      'price_delta': ['price_delta', 'asking_sold_delta', 'price_difference', 'sale_price_variance'],
      'market_velocity': ['market_velocity', 'turnover_rate', 'sales_velocity', 'market_activity'],
      'appreciation_rate': ['appreciation_rate', 'value_growth', 'price_appreciation', 'growth_rate']
    };

    return realEstateTargetMappings[targetVariable] || [targetVariable];
  }

  // ============================================================================
  // PRIVATE IMPLEMENTATION
  // ============================================================================

  /**
   * Load endpoint configurations (consolidated from ConfigurationManager)
   */
  private loadEndpointConfigurations(): void {
    // Load essential real estate endpoints
    const configs: EndpointConfiguration[] = [
      // Real Estate Specific Endpoints
      {
        id: '/market-trend-analysis',
        name: 'Real Estate Market Trend Analysis',
        description: 'Analyze market trends, price movements, and time-on-market patterns',
        category: 'real_estate',
        url: '/market-trend-analysis',
        defaultVisualization: 'choropleth',
        payloadTemplate: {
          target_variable: 'price_trend_index',
          secondary_targets: ['time_on_market', 'price_delta'],
          sample_size: 5000
        },
        responseProcessor: 'MarketTrendAnalysisProcessor',
        keywords: ['market trend', 'price trend', 'real estate trend', 'property trend'],
        targetVariable: 'market_trend_score',
        scoreFieldName: 'market_trend_score',
        requiredFields: ['target_variable'],
        optionalFields: ['secondary_targets', 'sample_size'],
        expectedResponseTime: 25000,
        cacheable: true,
        rateLimit: { requests: 40, window: 3600000 }
      },
      
      {
        id: '/price-prediction-analysis',
        name: 'Real Estate Price Prediction',
        description: 'Predict property prices using machine learning models',
        category: 'real_estate',
        url: '/price-prediction-analysis',
        defaultVisualization: 'choropleth',
        payloadTemplate: {
          target_variable: 'predicted_price',
          sample_size: 5000,
          prediction_horizon: '6_months'
        },
        responseProcessor: 'PricePredictionProcessor',
        keywords: ['price prediction', 'property price', 'home value', 'price forecast'],
        targetVariable: 'price_prediction_score',
        scoreFieldName: 'price_prediction_score',
        requiredFields: ['target_variable'],
        optionalFields: ['sample_size', 'prediction_horizon'],
        expectedResponseTime: 30000,
        cacheable: true,
        rateLimit: { requests: 30, window: 3600000 }
      },

      {
        id: '/comparative-market-analysis',
        name: 'Comparative Market Analysis (CMA)',
        description: 'Comprehensive CMA analysis comparing properties and market conditions',
        category: 'real_estate',
        url: '/comparative-market-analysis',
        defaultVisualization: 'bivariate',
        payloadTemplate: {
          target_variable: 'cma_score',
          sample_size: 5000,
          analysis_radius: '5_km'
        },
        responseProcessor: 'CMAProcessor',
        keywords: ['cma', 'comparative market analysis', 'market comparison', 'comp analysis'],
        targetVariable: 'cma_analysis_score',
        scoreFieldName: 'cma_analysis_score',
        requiredFields: ['target_variable'],
        optionalFields: ['sample_size', 'analysis_radius'],
        expectedResponseTime: 25000,
        cacheable: true,
        rateLimit: { requests: 30, window: 3600000 }
      },

      // Core Analysis Endpoints
      {
        id: '/analyze',
        name: 'General Analysis',
        description: 'Comprehensive analysis with rankings and insights',
        category: 'core',
        url: '/analyze',
        defaultVisualization: 'choropleth',
        payloadTemplate: {
          target_variable: '',
          sample_size: 5000,
          analysis_depth: 'standard'
        },
        responseProcessor: 'AnalyzeProcessor',
        keywords: ['analyze', 'general', 'overview', 'comprehensive'],
        targetVariable: 'analysis_score',
        scoreFieldName: 'analysis_score',
        requiredFields: ['target_variable'],
        optionalFields: ['sample_size', 'analysis_depth'],
        expectedResponseTime: 15000,
        cacheable: true,
        rateLimit: { requests: 100, window: 3600000 }
      },

      {
        id: '/strategic-analysis',
        name: 'Strategic Market Analysis',
        description: 'Strategic market analysis with comprehensive value scoring',
        category: 'strategic',
        url: '/strategic-analysis',
        defaultVisualization: 'choropleth',
        payloadTemplate: {
          target_variable: 'strategic_value',
          sample_size: 5000,
          analysis_depth: 'comprehensive'
        },
        responseProcessor: 'StrategicAnalysisProcessor',
        keywords: ['strategic', 'strategy', 'investment', 'opportunity'],
        targetVariable: 'strategic_analysis_score',
        scoreFieldName: 'strategic_analysis_score',
        requiredFields: ['target_variable'],
        optionalFields: ['sample_size', 'analysis_depth'],
        expectedResponseTime: 20000,
        cacheable: true,
        rateLimit: { requests: 50, window: 3600000 }
      }
    ];

    // Store configurations
    configs.forEach(config => {
      this.endpointConfigs.set(config.id, config);
    });
  }

  /**
   * Clear all caches
   */
  private clearCache(): void {
    this.configCache.clear();
  }

  /**
   * Get debug information about current configuration
   */
  public getDebugInfo(): any {
    return {
      projectType: this.currentProjectType,
      domain: this.currentContext.domain,
      terminology: this.currentContext.terminology,
      primaryMetricFields: this.getFieldMapping('primaryMetric'),
      endpointCount: this.endpointConfigs.size,
      multiTargetEnabled: this.isMultiTargetEnabled(),
      defaultTargets: this.getDefaultTargetVariables(),
      cacheSize: this.configCache.size
    };
  }
}