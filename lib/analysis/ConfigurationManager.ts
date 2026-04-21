/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { EndpointConfiguration, VisualizationType, AnalysisEngineConfig } from './types';
import { RankingDetector, RankingRequest } from './utils/RankingDetector';

/**
 * Enhanced ConfigurationManager - Advanced configuration management (Singleton)
 * 
 * Provides centralized configuration management for all 16 endpoints
 * with validation, caching, hot-reloading, and environment-specific configs.
 * 
 * Singleton pattern prevents multiple instances and redundant configuration loading.
 */
export class ConfigurationManager {
  private static instance: ConfigurationManager | null = null;
  
  private endpointConfigs: Map<string, EndpointConfiguration> = new Map();
  private visualizationConfigs: Map<string, VisualizationConfiguration> = new Map();
  private environmentConfigs: Map<string, any> = new Map();
  private configCache: Map<string, any> = new Map();
  private initialized: boolean = false;
  private lastLoadTime: number = 0;
  private configValidators: Map<string, ConfigValidator> = new Map();

  private constructor() {
    this.initializeValidators();
  }

  /**
   * Get the singleton instance of ConfigurationManager
   * Ensures only one instance exists and configurations are loaded once
   */
  public static getInstance(): ConfigurationManager {
    if (!ConfigurationManager.instance) {
      console.log('[ConfigurationManager] Creating singleton instance...');
      ConfigurationManager.instance = new ConfigurationManager();
      ConfigurationManager.instance.loadConfiguration();
    }
    return ConfigurationManager.instance;
  }

  /**
   * Reset the singleton instance (for testing purposes only)
   */
  public static resetInstance(): void {
    ConfigurationManager.instance = null;
  }

  /**
   * Load all configurations with validation (singleton ensures this runs only once)
   */
  loadConfiguration(): void {
    if (this.initialized) {
      console.log('[ConfigurationManager] Configurations already loaded, skipping...');
      return;
    }
    
    try {
      console.log('[ConfigurationManager] Loading configurations...');
      
      this.loadEndpointConfigurations();
      this.loadVisualizationConfigurations();
      this.loadEnvironmentConfigurations();
      this.validateAllConfigurations();
      
      this.initialized = true;
      this.lastLoadTime = Date.now();
      
      console.log(`[ConfigurationManager] ✅ Singleton loaded configurations for ${this.endpointConfigs.size} endpoints`);
    } catch (error) {
      console.error('[ConfigurationManager] Failed to load configurations:', error);
      throw new Error(`Configuration loading failed: ${error}`);
    }
  }

  /**
   * Get endpoint configuration by ID with validation
   */
  getEndpointConfig(endpointId: string): EndpointConfiguration | null {
    const config = this.endpointConfigs.get(endpointId);
    
    if (!config) {
      console.warn(`[ConfigurationManager] No configuration found for endpoint: ${endpointId}`);
      return null;
    }
    
    // Validate configuration before returning
    if (!this.validateEndpointConfig(config)) {
      console.error(`[ConfigurationManager] Invalid configuration for endpoint: ${endpointId}`);
      return null;
    }
    
    return config;
  }

  /**
   * Get all endpoint configurations
   */
  getEndpointConfigurations(): EndpointConfiguration[] {
    return Array.from(this.endpointConfigs.values())
      .filter(config => this.validateEndpointConfig(config));
  }

  /**
   * Get endpoints by category with caching
   */
  getEndpointsByCategory(category: string): EndpointConfiguration[] {
    const cacheKey = `category_${category}`;
    
    if (this.configCache.has(cacheKey)) {
      return this.configCache.get(cacheKey);
    }
    
    const endpoints = this.getEndpointConfigurations()
      .filter(config => config.category === category);
    
    this.configCache.set(cacheKey, endpoints);
    return endpoints;
  }

  /**
   * Get visualization configuration for an endpoint
   */
  getVisualizationConfig(endpointId: string): VisualizationConfiguration | null {
    const endpointConfig = this.getEndpointConfig(endpointId);
    if (!endpointConfig) return null;
    
    return this.visualizationConfigs.get(endpointConfig.defaultVisualization) || null;
  }

  /**
   * Get environment-specific configuration
   */
  getEnvironmentConfig(key: string): any {
    return this.environmentConfigs.get(key);
  }

  /**
   * Update endpoint configuration (for dynamic updates)
   */
  updateEndpointConfig(endpointId: string, updates: Partial<EndpointConfiguration>): boolean {
    const existing = this.endpointConfigs.get(endpointId);
    if (!existing) {
      console.error(`[ConfigurationManager] Cannot update non-existent endpoint: ${endpointId}`);
      return false;
    }
    
    const updated = { ...existing, ...updates };
    
    if (!this.validateEndpointConfig(updated)) {
      console.error(`[ConfigurationManager] Updated configuration is invalid for: ${endpointId}`);
      return false;
    }
    
    this.endpointConfigs.set(endpointId, updated);
    this.clearCache(); // Clear cache after update
    
    console.log(`[ConfigurationManager] Updated configuration for: ${endpointId}`);
    return true;
  }

  /**
   * Get score configuration for an endpoint
   */
  getScoreConfig(endpointId: string): { targetVariable: string; scoreFieldName: string } | null {
    const config = this.getEndpointConfig(endpointId);
    if (!config || !config.targetVariable || !config.scoreFieldName) {
      console.warn(`[ConfigurationManager] No score configuration found for endpoint: ${endpointId}`);
      return null;
    }
    
    return {
      targetVariable: config.targetVariable,
      scoreFieldName: config.scoreFieldName
    };
  }

  /**
   * Get configuration health status
   */
  getConfigurationHealth(): ConfigurationHealth {
    const totalEndpoints = this.endpointConfigs.size;
    const validEndpoints = this.getEndpointConfigurations().length;
    const invalidEndpoints = totalEndpoints - validEndpoints;
    
    return {
      totalEndpoints,
      validEndpoints,
      invalidEndpoints,
      isHealthy: invalidEndpoints === 0,
      lastLoadTime: this.lastLoadTime,
      cacheSize: this.configCache.size,
      issues: this.getConfigurationIssues()
    };
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private initializeValidators(): void {
    // Register validators for different configuration types
    this.configValidators.set('endpoint', new EndpointConfigValidator());
    this.configValidators.set('visualization', new VisualizationConfigValidator());
    this.configValidators.set('environment', new EnvironmentConfigValidator());
  }

  private loadEndpointConfigurations(): void {
    // Real Estate Analysis Endpoints - Only property point data endpoints
    const configs: EndpointConfiguration[] = [
      {
        id: '/strategic-analysis',
        name: 'Strategic Real Estate Market Analysis',
        description: 'Comprehensive strategic analysis for real estate investment decisions, market expansion planning, and portfolio optimization',
        category: 'real_estate',
        url: '/strategic-analysis',
        defaultVisualization: 'choropleth',
        payloadTemplate: {
          target_variable: 'strategic_score',
          sample_size: 5000,
          analysis_depth: 'comprehensive'
        },
        responseProcessor: 'StrategicAnalysisProcessor',
        keywords: ['strategic', 'strategy', 'expansion', 'invest', 'investment', 'growth', 'opportunity', 'top markets', 'best markets', 'strategic markets', 'market expansion', 'strategic value', 'strategic opportunities'],
        targetVariable: 'strategic_analysis_score',
        scoreFieldName: 'strategic_analysis_score',
        requiredFields: ['target_variable'],
        optionalFields: ['sample_size', 'analysis_depth'],
        expectedResponseTime: 20000,
        cacheable: true,
        rateLimit: { requests: 50, window: 3600000 },
        validationRules: {
          maxSampleSize: 10000,
          minSampleSize: 100
        },
        mockResponses: false
      },
      {
        id: '/comparative-market-analysis',
        name: 'Comparative Market Analysis (CMA)',
        description: 'Professional CMA reports comparing property values, market conditions, and pricing trends',
        category: 'real_estate',
        url: '/comparative-market-analysis',
        defaultVisualization: 'bivariate',
        payloadTemplate: {
          target_variable: 'cma_score',
          secondary_targets: ['price_comparison', 'market_position'],
          comparison_properties: [],
          sample_size: 5000,
          analysis_radius: '5_km',
          cma_depth: 'comprehensive'
        },
        responseProcessor: 'CMAProcessor',
        keywords: ['cma', 'comparative market analysis', 'market comparison', 'property comparison', 'comp analysis', 'market value analysis', 'property comps', 'comparable sales'],
        targetVariable: 'cma_analysis_score',
        scoreFieldName: 'cma_analysis_score',
        requiredFields: ['target_variable'],
        optionalFields: ['secondary_targets', 'comparison_properties', 'sample_size', 'analysis_radius', 'cma_depth'],
        expectedResponseTime: 25000,
        cacheable: true,
        rateLimit: { requests: 30, window: 3600000 },
        validationRules: {
          radiusOptions: ['1_km', '2_km', '5_km', '10_km'],
          depthOptions: ['basic', 'standard', 'comprehensive']
        },
        mockResponses: false
      },
      {
        id: '/affordability-analysis',
        name: 'Housing Affordability Analysis',
        description: 'Analyzes housing affordability trends, buyer purchasing power, and market accessibility for different income levels',
        category: 'real_estate',
        url: '/affordability-analysis',
        defaultVisualization: 'choropleth',
        payloadTemplate: {
          target_variable: 'affordability_score',
          sample_size: 5000
        },
        responseProcessor: 'AffordabilityAnalysisProcessor',
        keywords: ['affordability', 'value', 'buyers', 'income', 'accessibility', 'budget'],
        targetVariable: 'affordability_analysis_score',
        scoreFieldName: 'affordability_analysis_score',
        requiredFields: ['target_variable'],
        optionalFields: ['sample_size'],
        expectedResponseTime: 18000,
        cacheable: true,
        rateLimit: { requests: 60, window: 3600000 },
        mockResponses: false
      },
      {
        id: '/demographic-analysis',
        name: 'Demographic Market Analysis',
        description: 'Comprehensive demographic analysis showing population trends, buyer profiles, and market characteristics by area',
        category: 'real_estate',
        url: '/demographic-analysis',
        defaultVisualization: 'choropleth',
        payloadTemplate: { target_variable: 'demographic_score', sample_size: 5000 },
        responseProcessor: 'DemographicAnalysisProcessor',
        keywords: ['demographic', 'demographics', 'population', 'buyers', 'trends', 'profiles', 'characteristics'],
        targetVariable: 'demographic_analysis_score',
        scoreFieldName: 'demographic_analysis_score',
        requiredFields: ['target_variable'],
        optionalFields: ['sample_size'],
        expectedResponseTime: 18000,
        cacheable: true,
        rateLimit: { requests: 60, window: 3600000 },
        mockResponses: false
      },
      {
        id: '/development-potential-analysis',
        name: 'Development Potential Analysis',
        description: 'Evaluates development opportunities, zoning potential, and property development feasibility across different areas',
        category: 'real_estate',
        url: '/development-potential-analysis',
        defaultVisualization: 'choropleth',
        payloadTemplate: { target_variable: 'development_score', sample_size: 5000 },
        responseProcessor: 'DevelopmentPotentialProcessor',
        keywords: ['development', 'construction', 'zoning', 'potential', 'feasibility', 'building'],
        targetVariable: 'development_potential_score',
        scoreFieldName: 'development_potential_score',
        requiredFields: ['target_variable'],
        optionalFields: ['sample_size'],
        expectedResponseTime: 22000,
        cacheable: true,
        rateLimit: { requests: 40, window: 3600000 },
        mockResponses: false
      },
      {
        id: '/gentrification-analysis',
        name: 'Gentrification Analysis',
        description: 'Analyzes gentrification trends, neighborhood changes, and evolving market dynamics affecting property values',
        category: 'real_estate',
        url: '/gentrification-analysis',
        defaultVisualization: 'choropleth',
        payloadTemplate: { target_variable: 'gentrification_score', sample_size: 5000 },
        responseProcessor: 'GentrificationAnalysisProcessor',
        keywords: ['gentrification', 'neighborhood', 'change', 'transformation', 'urban', 'renewal'],
        targetVariable: 'gentrification_analysis_score',
        scoreFieldName: 'gentrification_analysis_score',
        requiredFields: ['target_variable'],
        optionalFields: ['sample_size'],
        expectedResponseTime: 20000,
        cacheable: true,
        rateLimit: { requests: 45, window: 3600000 },
        mockResponses: false
      },
      {
        id: '/growth-potential-analysis',
        name: 'Growth Potential Analysis',
        description: 'Identifies areas with highest growth potential, appreciation prospects, and emerging market opportunities',
        category: 'real_estate',
        url: '/growth-potential-analysis',
        defaultVisualization: 'choropleth',
        payloadTemplate: { target_variable: 'growth_score', sample_size: 5000 },
        responseProcessor: 'GrowthPotentialProcessor',
        keywords: ['growth', 'appreciation', 'potential', 'emerging', 'prospects', 'momentum'],
        targetVariable: 'growth_potential_score',
        scoreFieldName: 'growth_potential_score',
        requiredFields: ['target_variable'],
        optionalFields: ['sample_size'],
        expectedResponseTime: 22000,
        cacheable: true,
        rateLimit: { requests: 40, window: 3600000 },
        mockResponses: false
      },
      {
        id: '/market-liquidity-analysis',
        name: 'Market Liquidity Analysis',
        description: 'Analyzes market liquidity, property turnover rates, and how quickly properties sell in different areas',
        category: 'real_estate',
        url: '/market-liquidity-analysis',
        defaultVisualization: 'choropleth',
        payloadTemplate: { target_variable: 'liquidity_score', sample_size: 5000 },
        responseProcessor: 'MarketLiquidityProcessor',
        keywords: ['liquidity', 'velocity', 'turnover', 'speed', 'market', 'selling'],
        targetVariable: 'market_liquidity_score',
        scoreFieldName: 'market_liquidity_score',
        requiredFields: ['target_variable'],
        optionalFields: ['sample_size'],
        expectedResponseTime: 18000,
        cacheable: true,
        rateLimit: { requests: 50, window: 3600000 },
        mockResponses: false
      },
      {
        id: '/market-saturation-analysis',
        name: 'Market Saturation Analysis',
        description: 'Evaluates market saturation levels, supply-demand balance, and competitive landscape intensity',
        category: 'real_estate',
        url: '/market-saturation-analysis',
        defaultVisualization: 'choropleth',
        payloadTemplate: { target_variable: 'saturation_score', sample_size: 5000 },
        responseProcessor: 'MarketSaturationProcessor',
        keywords: ['saturation', 'supply', 'demand', 'competition', 'balance', 'market'],
        targetVariable: 'market_saturation_score',
        scoreFieldName: 'market_saturation_score',
        requiredFields: ['target_variable'],
        optionalFields: ['sample_size'],
        expectedResponseTime: 20000,
        cacheable: true,
        rateLimit: { requests: 45, window: 3600000 },
        mockResponses: false
      },
      {
        id: '/market-trend-analysis',
        name: 'Market Trend Analysis',
        description: 'Comprehensive analysis of market trends, price movements, and directional indicators for informed decision-making',
        category: 'real_estate',
        url: '/market-trend-analysis',
        defaultVisualization: 'choropleth',
        payloadTemplate: {
          target_variable: 'trend_score',
          secondary_targets: ['time_on_market', 'price_delta'],
          sample_size: 5000,
          analysis_period: '12_months',
          trend_analysis_type: 'comprehensive'
        },
        responseProcessor: 'MarketTrendAnalysisProcessor',
        keywords: ['trends', 'direction', 'momentum', 'patterns', 'forecasting', 'movement'],
        targetVariable: 'market_trend_score',
        scoreFieldName: 'market_trend_score',
        requiredFields: ['target_variable'],
        optionalFields: ['secondary_targets', 'sample_size', 'analysis_period', 'trend_analysis_type'],
        expectedResponseTime: 25000,
        cacheable: true,
        rateLimit: { requests: 40, window: 3600000 },
        validationRules: {
          analysisPeriods: ['6_months', '12_months', '24_months'],
          trendTypes: ['basic', 'comprehensive', 'predictive']
        },
        mockResponses: false
      },
      {
        id: '/neighborhood-quality-analysis',
        name: 'Neighborhood Quality Analysis',
        description: 'Evaluates neighborhood quality factors, amenities, and desirability indicators that affect property values',
        category: 'real_estate',
        url: '/neighborhood-quality-analysis',
        defaultVisualization: 'choropleth',
        payloadTemplate: { target_variable: 'quality_score', sample_size: 5000 },
        responseProcessor: 'NeighborhoodQualityProcessor',
        keywords: ['quality', 'neighborhood', 'amenities', 'desirable', 'lifestyle', 'community'],
        targetVariable: 'neighborhood_quality_score',
        scoreFieldName: 'neighborhood_quality_score',
        requiredFields: ['target_variable'],
        optionalFields: ['sample_size'],
        expectedResponseTime: 20000,
        cacheable: true,
        rateLimit: { requests: 45, window: 3600000 },
        mockResponses: false
      },
      {
        id: '/price-prediction-analysis',
        name: 'Price Prediction Analysis',
        description: 'Advanced predictive modeling for future property values, price forecasting, and market trend predictions',
        category: 'real_estate',
        url: '/price-prediction-analysis',
        defaultVisualization: 'choropleth',
        payloadTemplate: {
          target_variable: 'predicted_price',
          secondary_targets: ['price_confidence', 'price_variance'],
          sample_size: 5000,
          prediction_horizon: '6_months',
          model_type: 'ensemble'
        },
        responseProcessor: 'PricePredictionProcessor',
        keywords: ['prediction', 'forecast', 'future', 'modeling', 'estimates', 'projections'],
        targetVariable: 'price_prediction_score',
        scoreFieldName: 'price_prediction_score',
        requiredFields: ['target_variable'],
        optionalFields: ['secondary_targets', 'sample_size', 'prediction_horizon', 'model_type'],
        expectedResponseTime: 30000,
        cacheable: true,
        rateLimit: { requests: 30, window: 3600000 },
        validationRules: {
          horizons: ['3_months', '6_months', '12_months'],
          modelTypes: ['linear', 'ensemble', 'neural_network']
        },
        mockResponses: false
      },
      {
        id: '/rental-market-analysis',
        name: 'Rental Market Analysis',
        description: 'Comprehensive rental market analysis including rental rates, yield analysis, and investment property performance',
        category: 'real_estate',
        url: '/rental-market-analysis',
        defaultVisualization: 'choropleth',
        payloadTemplate: {
          target_variable: 'rental_yield_index',
          secondary_targets: ['rental_demand', 'tenant_profile'],
          sample_size: 5000,
          rental_analysis_type: 'comprehensive',
          property_types: ['single_family', 'multi_family', 'condo']
        },
        responseProcessor: 'RentalAnalysisProcessor',
        keywords: ['rental', 'yield', 'cash flow', 'cap rate', 'investment', 'income'],
        targetVariable: 'rental_analysis_score',
        scoreFieldName: 'rental_analysis_score',
        requiredFields: ['target_variable'],
        optionalFields: ['secondary_targets', 'sample_size', 'rental_analysis_type', 'property_types'],
        expectedResponseTime: 25000,
        cacheable: true,
        rateLimit: { requests: 35, window: 3600000 },
        validationRules: {
          analysisTypes: ['basic', 'comprehensive', 'detailed'],
          propertyTypes: ['single_family', 'multi_family', 'condo', 'townhouse']
        },
        mockResponses: false
      },
      {
        id: '/risk-assessment-analysis',
        name: 'Real Estate Risk Assessment',
        description: 'Comprehensive risk analysis for real estate investments, market volatility assessment, and risk mitigation strategies',
        category: 'real_estate',
        url: '/risk-assessment-analysis',
        defaultVisualization: 'choropleth',
        payloadTemplate: { target_variable: 'risk_score', sample_size: 5000 },
        responseProcessor: 'RiskAssessmentProcessor',
        keywords: ['risk', 'volatility', 'stability', 'assessment', 'mitigation', 'analysis'],
        targetVariable: 'risk_assessment_score',
        scoreFieldName: 'risk_assessment_score',
        requiredFields: ['target_variable'],
        optionalFields: ['sample_size'],
        expectedResponseTime: 22000,
        cacheable: true,
        rateLimit: { requests: 40, window: 3600000 },
        mockResponses: false
      },
      {
        id: '/competitive-analysis',
        name: 'Competitive Analysis',
        description: 'Competitive market analysis for brand comparison, market positioning, and competitive advantage assessment',
        category: 'competitive',
        url: '/competitive-analysis',
        defaultVisualization: 'multi-symbol',
        payloadTemplate: { target_variable: 'competitive_score', sample_size: 5000 },
        responseProcessor: 'CompetitiveDataProcessor',
        keywords: ['competitive', 'competition', 'brand', 'vs', 'versus', 'compare', 'comparison', 'market position', 'advantage'],
        targetVariable: 'competitive_analysis_score',
        scoreFieldName: 'competitive_analysis_score',
        requiredFields: ['target_variable'],
        optionalFields: ['sample_size'],
        expectedResponseTime: 20000,
        cacheable: true,
        rateLimit: { requests: 45, window: 3600000 },
        mockResponses: false
      }
      // NOTE: All endpoints now focus exclusively on real estate property point data
      // Old brand analysis endpoints (Nike vs Adidas, etc.) have been removed
      // Technical ML endpoints have been removed (not relevant for real estate brokers)
      //   id: '/model-selection',
      //   name: 'Model Selection Analysis',
      //   description: 'Compare and select the best machine learning models for geographic analysis',
      //   category: 'advanced',
      //   url: '/model-selection',
      //   defaultVisualization: 'categorical',
      //   payloadTemplate: { target_variable: '', sample_size: 5000, model_types: [] },
      //   responseProcessor: 'ModelSelectionProcessor',
      //   keywords: ['model', 'algorithm', 'selection', 'compare models', 'best model', 'ml models'],
      //   targetVariable: 'algorithm_category',
      //   scoreFieldName: 'algorithm_category',
      //   requiredFields: ['target_variable'],
      //   optionalFields: ['sample_size', 'model_types'],
      //   expectedResponseTime: 25000,
      //   cacheable: true,
      //   rateLimit: { requests: 30, window: 3600000 },
      //   validationRules: { maxModels: 10 },
    ];

    // Store configurations with validation
    configs.forEach(config => {
      if (this.validateEndpointConfig(config)) {
        this.endpointConfigs.set(config.id, config);
      } else {
        console.error(`[ConfigurationManager] Invalid endpoint configuration: ${config.id}`);
      }
    });
  }

  private loadVisualizationConfigurations(): void {
    const visualizationConfigs: VisualizationConfiguration[] = [
      {
        type: 'choropleth',
        name: 'Choropleth Map',
        description: 'Color-coded areas based on data values',
        defaultColorScheme: 'blue-to-red',
        supportedClassificationMethods: ['natural-breaks', 'equal-interval', 'quantile'],
        requiredFields: ['valueField', 'labelField'],
        optionalFields: ['opacity', 'strokeWidth'],
        performance: { maxRecords: 10000, avgRenderTime: 500 }
      },
      {
        type: 'cluster',
        name: 'Cluster Visualization',
        description: 'Areas grouped by similarity with distinct colors',
        defaultColorScheme: 'categorical',
        supportedClassificationMethods: ['categorical'],
        requiredFields: ['clusterField', 'labelField'],
        optionalFields: ['opacity', 'strokeWidth'],
        performance: { maxRecords: 8000, avgRenderTime: 800 }
      },
      {
        type: 'multi-symbol',
        name: 'Multi-Symbol Map',
        description: 'Multiple symbols representing different data dimensions',
        defaultColorScheme: 'categorical',
        supportedClassificationMethods: ['categorical', 'graduated'],
        requiredFields: ['valueField', 'symbolField'],
        optionalFields: ['symbolSize', 'opacity'],
        performance: { maxRecords: 5000, avgRenderTime: 1200 }
      }
    ];

    visualizationConfigs.forEach(config => {
      this.visualizationConfigs.set(config.type, config);
    });
  }

  private loadEnvironmentConfigurations(): void {
    // Load environment-specific configurations
    const environment = process.env.NODE_ENV || 'development';
    
    const envConfigs = {
      development: {
        apiTimeout: 30000,
        debugMode: true,
        cacheEnabled: false,
        mockResponses: false
      },
      production: {
        apiTimeout: 15000,
        debugMode: false,
        cacheEnabled: true,
        mockResponses: false
      },
      test: {
        apiTimeout: 5000,
        debugMode: true,
        cacheEnabled: false,
        mockResponses: false
      }
    };

    const config = envConfigs[environment as keyof typeof envConfigs] || envConfigs.development;
    
    Object.entries(config).forEach(([key, value]) => {
      this.environmentConfigs.set(key, value);
    });
  }

  private validateAllConfigurations(): void {
    let validationErrors = 0;
    
    // Validate endpoint configurations
    this.endpointConfigs.forEach((config, id) => {
      if (!this.validateEndpointConfig(config)) {
        console.error(`[ConfigurationManager] Validation failed for endpoint: ${id}`);
        validationErrors++;
      }
    });
    
    if (validationErrors > 0) {
      console.warn(`[ConfigurationManager] ${validationErrors} configuration validation errors found`);
    }
  }

  private validateEndpointConfig(config: EndpointConfiguration): boolean {
    const validator = this.configValidators.get('endpoint');
    return validator ? validator.validate(config) : true;
  }

  private getConfigurationIssues(): string[] {
    const issues: string[] = [];
    
    // Check for missing processors
    this.endpointConfigs.forEach((config, id) => {
      if (!config.responseProcessor) {
        issues.push(`Missing response processor for endpoint: ${id}`);
      }
    });
    
    // Check for invalid visualization types
    this.endpointConfigs.forEach((config, id) => {
      if (!this.visualizationConfigs.has(config.defaultVisualization)) {
        issues.push(`Invalid visualization type for endpoint: ${id}`);
      }
    });
    
    return issues;
  }

  private clearCache(): void {
    this.configCache.clear();
  }
  
  /**
   * Analyze query for ranking requests
   */
  detectRanking(query: string): RankingRequest {
    return RankingDetector.detectRanking(query);
  }
  
  /**
   * Prepare features with ranking emphasis
   */
  prepareRankedFeatures(
    features: any[], 
    ranking: RankingRequest, 
    valueField: string = 'value'
  ) {
    return RankingDetector.prepareRankedFeatures(features, ranking, valueField);
  }
}

// ============================================================================
// CONFIGURATION INTERFACES AND VALIDATORS
// ============================================================================

interface VisualizationConfiguration {
  type: VisualizationType;
  name: string;
  description: string;
  defaultColorScheme: string;
  supportedClassificationMethods: string[];
  requiredFields: string[];
  optionalFields: string[];
  performance: {
    maxRecords: number;
    avgRenderTime: number;
  };
}

interface ConfigurationHealth {
  totalEndpoints: number;
  validEndpoints: number;
  invalidEndpoints: number;
  isHealthy: boolean;
  lastLoadTime: number;
  cacheSize: number;
  issues: string[];
}

interface ConfigValidator {
  validate(config: any): boolean;
}

class EndpointConfigValidator implements ConfigValidator {
  validate(config: EndpointConfiguration): boolean {
    // Required fields validation
    if (!config.id || !config.name || !config.url) return false;
    if (!config.category || !config.defaultVisualization) return false;
    if (!Array.isArray(config.keywords)) return false;
    
    // URL format validation
    if (!config.url.startsWith('/')) return false;
    
    // Keywords validation
    if (config.keywords.length === 0) return false;
    
    return true;
  }
}

class VisualizationConfigValidator implements ConfigValidator {
  validate(config: VisualizationConfiguration): boolean {
    if (!config.type || !config.name) return false;
    if (!Array.isArray(config.requiredFields)) return false;
    if (!config.performance?.maxRecords) return false;
    
    return true;
  }
}

class EnvironmentConfigValidator implements ConfigValidator {
  validate(config: any): boolean {
    return config && typeof config === 'object';
  }
}

// Extend the existing types
declare module './types' {
  interface EndpointConfiguration {
    targetVariable?: string;
    scoreFieldName?: string;
    requiredFields?: string[];
    optionalFields?: string[];
    expectedResponseTime?: number;
    cacheable?: boolean;
    rateLimit?: {
      requests: number;
      window: number;
    };
    validationRules?: Record<string, any>;
    mockResponses?: boolean; // Add mockResponses to the interface
  }
} 