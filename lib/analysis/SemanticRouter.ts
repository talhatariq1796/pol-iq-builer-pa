/**
 * SemanticRouter - Semantic similarity-based query routing
 * 
 * Replaces EnhancedQueryAnalyzer with semantic embeddings for more robust
 * and accurate query-to-endpoint routing.
 */

import { endpointEmbeddings } from '../embedding/EndpointEmbeddings';
import { SimilarityResult } from '../embedding/VectorUtils';

export interface RouteResult {
  endpoint: string;
  confidence: number;
  reason: string;
  alternativeEndpoints?: { endpoint: string; confidence: number }[];
  processingTime: number;
  fallbackUsed: boolean;
}

export interface RoutingOptions {
  minConfidence?: number;
  maxAlternatives?: number;
  enableFallback?: boolean;
  timeout?: number;
}

export class SemanticRouter {
  private static readonly DEFAULT_OPTIONS: Required<RoutingOptions> = {
    minConfidence: 0.3,
    maxAlternatives: 2,
    enableFallback: true,
    timeout: 100 // 100ms timeout for routing decisions
  };

  /**
   * Route a user query to the best matching endpoint
   */
  async route(query: string, options: RoutingOptions = {}): Promise<RouteResult> {
    const opts = { ...SemanticRouter.DEFAULT_OPTIONS, ...options };
    const startTime = performance.now();

    try {
      // Attempt semantic routing with timeout
      const semanticResult = await this.withTimeout(
        this.semanticRoute(query, opts),
        opts.timeout
      );

      if (semanticResult) {
        return semanticResult;
      }
    } catch (error) {
      console.warn('[SemanticRouter] Semantic routing failed, falling back to keyword routing:', error);
    }

    // Fallback to keyword-based routing if enabled
    if (opts.enableFallback) {
      const fallbackResult = this.keywordFallbackRoute(query, opts);
      return {
        ...fallbackResult,
        fallbackUsed: true,
        processingTime: performance.now() - startTime
      };
    }

    // Final fallback to analyze endpoint
    return {
      endpoint: '/analyze',
      confidence: 0.5,
      reason: 'Fallback to general analysis due to routing failure',
      processingTime: performance.now() - startTime,
      fallbackUsed: true
    };
  }

  /**
   * Perform semantic routing using embeddings
   */
  private async semanticRoute(query: string, options: Required<RoutingOptions>): Promise<RouteResult | null> {
    // Find best matching endpoints
    const matches = await endpointEmbeddings.findBestEndpoint(
      query,
      options.maxAlternatives + 1,
      options.minConfidence
    );

    if (matches.length === 0) {
      return null;
    }

    const bestMatch = matches[0];
    const alternatives = matches.slice(1).map(match => ({
      endpoint: match.id,
      confidence: match.score
    }));

    return {
      endpoint: bestMatch.id,
      confidence: bestMatch.score,
      reason: `Semantic similarity: ${(bestMatch.score * 100).toFixed(1)}% match`,
      alternativeEndpoints: alternatives.length > 0 ? alternatives : undefined,
      processingTime: bestMatch.metadata?.processingTime || 0,
      fallbackUsed: false
    };
  }

  /**
   * Keyword-based fallback routing (simplified version of old system)
   */
  private keywordFallbackRoute(query: string, options: Required<RoutingOptions>): Omit<RouteResult, 'processingTime' | 'fallbackUsed'> {
    const queryLower = query.toLowerCase();

    // Simple keyword matching for fallback
    const keywordMappings = {
      '/strategic-analysis': ['strategic', 'expansion', 'investment', 'opportunity'],
      '/comparative-analysis': ['compare', 'comparison', 'between', 'versus', 'vs'],
      '/competitive-analysis': ['market share', 'competitive', 'competitors', 'competitive positioning', 'positioning', 'competitive advantage'],
      '/demographic-insights': ['demographic', 'demographics', 'population', 'age', 'income'],
      '/customer-profile': ['customer persona', 'ideal customer', 'target customer'],
  '/spatial-clusters': ['geographic cluster', 'spatial', 'similar markets', 'cluster', 'clusters', 'similar performing', 'similar performing locations'],
      '/correlation-analysis': ['correlation', 'correlated', 'associated'],
      '/outlier-detection': ['outliers', 'unique characteristics', 'unusual'],
      '/brand-difference': ['brand positioning', 'brand strength', 'strongest brand'],
      '/scenario-analysis': ['what if', 'scenario', 'resilient'],
      '/trend-analysis': ['trends', 'growth', 'momentum'],
      '/feature-interactions': ['interactions', 'between', 'factors'],
      '/predictive-modeling': ['predict', 'forecast', 'likely to grow'],
      '/segment-profiling': ['segmentation', 'customer segments'],
      '/sensitivity-analysis': ['sensitivity', 'adjust', 'weights'],
      '/feature-importance-ranking': ['important factors', 'importance'],
      '/model-performance': ['accurate', 'accuracy', 'performance'],
      '/algorithm-comparison': ['algorithm', 'performs best'],
      '/ensemble-analysis': ['ensemble', 'confidence'],
      '/model-selection': ['optimal', 'best algorithm'],
      '/dimensionality-insights': ['factors explain', 'variation'],
      '/consensus-analysis': ['consensus', 'models agree'],
      '/anomaly-insights': ['anomaly', 'unusual patterns', 'business opportunities'],
      '/cluster-analysis': ['how should we segment', 'targeted strategies'],
      '/analyze': ['comprehensive', 'general', 'overall', 'market insights', 'insights', 'analysis', 'analyze']
    };

    let bestEndpoint = '/analyze';
    let bestScore = 0;
    let matchedKeywords: string[] = [];

    for (const [endpoint, keywords] of Object.entries(keywordMappings)) {
      const matches = keywords.filter(keyword => queryLower.includes(keyword));
      const score = matches.length / keywords.length;

      if (score > bestScore) {
        bestScore = score;
        bestEndpoint = endpoint;
        matchedKeywords = matches;
      }
    }

    const confidence = Math.min(bestScore * 0.8, 0.7); // Cap fallback confidence at 70%

    return {
      endpoint: bestEndpoint,
      confidence,
      reason: `Keyword fallback: matched [${matchedKeywords.join(', ')}]`
    };
  }

  /**
   * Execute a promise with timeout
   */
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * Analyze query routing performance
   */
  async analyzeRouting(queries: string[]): Promise<{
    query: string;
    result: RouteResult;
  }[]> {
    const results = [];

    for (const query of queries) {
      const result = await this.route(query);
      results.push({ query, result });
    }

    return results;
  }

  /**
   * Get routing statistics
   */
  getRoutingStats(results: { query: string; result: RouteResult }[]): {
    averageConfidence: number;
    averageProcessingTime: number;
    fallbackRate: number;
    endpointDistribution: { [endpoint: string]: number };
  } {
    const confidences = results.map(r => r.result.confidence);
    const processingTimes = results.map(r => r.result.processingTime);
    const fallbackCount = results.filter(r => r.result.fallbackUsed).length;

    const endpointCounts: { [endpoint: string]: number } = {};
    for (const result of results) {
      const endpoint = result.result.endpoint;
      endpointCounts[endpoint] = (endpointCounts[endpoint] || 0) + 1;
    }

    return {
      averageConfidence: confidences.reduce((sum, c) => sum + c, 0) / confidences.length,
      averageProcessingTime: processingTimes.reduce((sum, t) => sum + t, 0) / processingTimes.length,
      fallbackRate: fallbackCount / results.length,
      endpointDistribution: endpointCounts
    };
  }

  /**
   * Test semantic router initialization
   */
  async testInitialization(): Promise<{
    isReady: boolean;
    embeddingCount: number;
    qualityMetrics: any;
    testResults: any[];
  }> {
    const isReady = endpointEmbeddings.isReady();
    
    if (!isReady) {
      await endpointEmbeddings.initialize();
    }

    const qualityMetrics = endpointEmbeddings.analyzeEmbeddingQuality();

    // Test with sample queries
    const testQueries = [
      'Show me strategic markets for expansion',
      'Compare performance between cities',
      'Market share analysis',
      'Demographic breakdown',
      'Predict future growth'
    ];

    const testResults = await this.analyzeRouting(testQueries);

    return {
      isReady: endpointEmbeddings.isReady(),
      embeddingCount: qualityMetrics.endpointCount,
      qualityMetrics,
      testResults
    };
  }

  /**
   * Initialize the semantic router
   */
  async initialize(): Promise<void> {
    console.log('[SemanticRouter] Initializing...');
    const startTime = performance.now();

    await endpointEmbeddings.initialize();

    const endTime = performance.now();
    console.log(`[SemanticRouter] Initialized in ${Math.round(endTime - startTime)}ms`);
  }

  /**
   * Check if the router is ready
   */
  isReady(): boolean {
    return endpointEmbeddings.isReady();
  }
}

// Export singleton instance
export const semanticRouter = new SemanticRouter();