/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { AnalysisOptions, RawAnalysisResult } from './types';
import { ConfigurationManager } from './ConfigurationManager';
import { CacheManager, RequestBatcher, ErrorRecovery, PerformanceMonitor, PERFORMANCE_FEATURES } from './performance';

/**
 * Enhanced EndpointRouter - Smart routing with performance optimization
 * 
 * Now includes:
 * - Intelligent caching
 * - Request batching and deduplication
 * - Error recovery with circuit breakers
 * - Performance monitoring
 */
export class EndpointRouter {
  private configManager: ConfigurationManager;
  private cacheManager: CacheManager;
  private requestBatcher: RequestBatcher;
  private errorRecovery: ErrorRecovery;
  private performanceMonitor: PerformanceMonitor;

  constructor(configManager: ConfigurationManager) {
    this.configManager = configManager;
    
    // Initialize performance modules
    this.cacheManager = new CacheManager();
    this.requestBatcher = new RequestBatcher();
    this.errorRecovery = new ErrorRecovery();
    this.performanceMonitor = new PerformanceMonitor();
    
    console.log('[EndpointRouter] Initialized with performance optimization');
  }

  /**
   * Enhanced endpoint selection with performance awareness
   */
  async selectEndpoint(query: string, options?: AnalysisOptions): Promise<string> {
    const startTime = Date.now();
    
    try {
      // If endpoint is explicitly specified, use it
      if (options?.endpoint) {
        return options.endpoint;
      }

      // Use intelligent endpoint suggestion
      const suggestedEndpoint = this.suggestEndpoint(query);
      
      console.log(`[EndpointRouter] Selected endpoint: ${suggestedEndpoint} for query: "${query}"`);
      return suggestedEndpoint;
      
    } finally {
      const responseTime = Date.now() - startTime;
      console.log(`[EndpointRouter] Endpoint selection took ${responseTime}ms`);
    }
  }

  /**
   * Enhanced API call with full performance optimization
   */
  async callEndpoint(endpoint: string, payload: any, options?: AnalysisOptions): Promise<RawAnalysisResult> {
    // Start performance tracking
    const tracker = this.performanceMonitor.startRequest(
      this.generateRequestId(),
      endpoint,
      { 
        priority: options?.forceRefresh ? 'high' : 'normal',
        cached: false
      }
    );

    try {
      // Check cache first (unless force refresh is requested)
      if (PERFORMANCE_FEATURES.CACHING_ENABLED && !options?.forceRefresh) {
        const cacheKey = this.cacheManager.generateKey(endpoint, payload, options);
        const cachedResult = this.cacheManager.get(cacheKey);
        
        if (cachedResult) {
          this.performanceMonitor.recordCacheEvent(endpoint, true);
          this.performanceMonitor.endRequest(tracker, true);
          console.log(`[EndpointRouter] Cache hit for ${endpoint}`);
          return cachedResult;
        }
        
        this.performanceMonitor.recordCacheEvent(endpoint, false);
      }

      // Execute request with performance optimization
      let result: RawAnalysisResult;

      if (PERFORMANCE_FEATURES.BATCHING_ENABLED) {
        // Use request batching
        result = await this.executeWithBatching(endpoint, payload, options);
      } else if (PERFORMANCE_FEATURES.ERROR_RECOVERY_ENABLED) {
        // Use error recovery without batching
        result = await this.executeWithErrorRecovery(endpoint, payload, options);
      } else {
        // Direct execution
        result = await this.executeDirectRequest(endpoint, payload, options);
      }

      // Cache successful results
      if (PERFORMANCE_FEATURES.CACHING_ENABLED && result.success) {
        const cacheKey = this.cacheManager.generateKey(endpoint, payload, options);
        this.cacheManager.set(cacheKey, result, endpoint);
      }

      // Record successful completion
      this.performanceMonitor.endRequest(tracker, result.success, this.estimateDataSize(result));
      
      return result;

    } catch (error) {
      // Record failed completion
      this.performanceMonitor.endRequest(tracker, false);
      throw error;
    }
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): any {
    return {
      cache: this.cacheManager.getStats(),
      batching: this.requestBatcher.getMetrics(),
      errorRecovery: this.errorRecovery.getErrorStats(),
      monitoring: this.performanceMonitor.getMetrics()
    };
  }

  /**
   * Generate performance report
   */
  generatePerformanceReport(): any {
    return this.performanceMonitor.generateReport();
  }

  /**
   * Clear performance caches and reset
   */
  clearPerformanceCache(): void {
    this.cacheManager.clear();
    this.requestBatcher.clear();
    console.log('[EndpointRouter] Performance caches cleared');
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private async executeWithBatching(endpoint: string, payload: any, options?: AnalysisOptions): Promise<RawAnalysisResult> {
    const batchKey = this.generateBatchKey(endpoint, payload);
    const priority = options?.forceRefresh ? 'high' : 'normal';

    return await this.requestBatcher.addRequest(
      batchKey,
      {
        endpoint,
        payload,
        options
      },
      priority
    );
  }

  private async executeWithErrorRecovery(endpoint: string, payload: any, options?: AnalysisOptions): Promise<RawAnalysisResult> {
    const recoveryKey = endpoint;
    
    return await this.errorRecovery.executeWithRecovery(
      recoveryKey,
      () => this.executeDirectRequest(endpoint, payload, options),
      {
        fallbackStrategy: this.createFallbackStrategy(endpoint),
        priority: options?.forceRefresh ? 'high' : 'normal'
      }
    );
  }

  private async executeDirectRequest(endpoint: string, payload: any, options?: AnalysisOptions): Promise<RawAnalysisResult> {
    // Prepare request payload
    const requestPayload = this.preparePayload(endpoint, payload);
    
    // Get API configuration
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api/analysis';
    const apiKey = process.env.ANALYSIS_API_KEY || 'development-key';
    
    console.log(`[EndpointRouter] Calling ${endpoint} with payload:`, requestPayload);

    // Make the API call
    const response = await fetch(`${apiUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify(requestPayload),
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API call failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    console.log(`[EndpointRouter] ${endpoint} response:`, { 
      success: result.success, 
      recordCount: result.results?.length || 0 
    });

    return result;
  }

  private suggestEndpoint(query: string): string {
    const lowerQuery = query.toLowerCase();
    const endpoints = this.configManager.getEndpointConfigurations();
    
    let bestMatch = { endpoint: '/analyze', score: 0 };
    
    for (const config of endpoints) {
      let score = 0;
      
      // Check keyword matches
      for (const keyword of config.keywords) {
        if (lowerQuery.includes(keyword.toLowerCase())) {
          score += 1;
        }
      }
      
      // Boost score for exact matches
      if (config.keywords.some(keyword => lowerQuery === keyword.toLowerCase())) {
        score += 2;
      }
      
      if (score > bestMatch.score) {
        bestMatch = { endpoint: config.id, score };
      }
    }
    
    return bestMatch.endpoint;
  }

  private preparePayload(endpoint: string, payload: any): any {
    const config = this.configManager.getEndpointConfig(endpoint);
    
    if (!config) {
      throw new Error(`No configuration found for endpoint: ${endpoint}`);
    }
    
    // Merge with template and apply defaults
    const mergedPayload = {
      ...config.payloadTemplate,
      ...payload
    };
    
    // Validate required fields
    if (config.requiredFields) {
      for (const field of config.requiredFields) {
        if (mergedPayload[field] === undefined || mergedPayload[field] === '') {
          throw new Error(`Required field '${field}' is missing for endpoint ${endpoint}`);
        }
      }
    }
    
    return mergedPayload;
  }

  private generateBatchKey(endpoint: string, payload: any): string {
    // Create batch key based on endpoint and target variable
    return `${endpoint}_${payload.target_variable || 'default'}`;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private createFallbackStrategy(endpoint: string): any {
    return {
      type: 'cached_response',
      getCachedResponse: async (key: string) => {
        // Try to get any cached response for this endpoint
        const cacheStats = this.cacheManager.getStats();
        console.log(`[EndpointRouter] Attempting fallback with cached data for ${endpoint}`);
        
        // Return a minimal valid response structure
        return {
          success: true,
          results: [],
          summary: `Fallback response for ${endpoint} due to service unavailability`,
          feature_importance: [],
          model_info: { target_variable: 'fallback' }
        };
      }
    };
  }

  private estimateDataSize(result: RawAnalysisResult): number {
    return JSON.stringify(result).length;
  }

  /**
   * Cleanup method for proper shutdown
   */
  destroy(): void {
    this.performanceMonitor.stop();
    this.requestBatcher.clear();
    console.log('[EndpointRouter] Performance modules shut down');
  }
} 