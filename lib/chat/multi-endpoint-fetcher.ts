/**
 * Multi-Endpoint Data Fetcher for Chat
 * 
 * Dynamically fetches additional endpoint data when chat conversations
 * require cross-endpoint insights and analysis.
 */

import type { AnalysisResult } from '@/lib/analysis/types';

export interface EndpointDataRequest {
  endpoint: string;
  geography: {
    zipCodes?: string[];
    spatialFilterIds?: string[];
    filterType?: string;
  };
  query: string;
  reason: string;
}

export interface EndpointDataResult {
  endpoint: string;
  success: boolean;
  data?: {
    records: any[];
    statistics?: any;
    metadata?: any;
  };
  error?: string;
  fetchTime: number;
}

export interface MultiEndpointFetchResult {
  primaryData: any; // Original analysis data
  additionalData: EndpointDataResult[];
  totalFetchTime: number;
  success: boolean;
  errors: string[];
}

export class MultiEndpointFetcher {
  private cache = new Map<string, EndpointDataResult>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CONCURRENT_FETCHES = 3;
  private readonly FETCH_TIMEOUT = 15000; // 15 seconds per endpoint

  /**
   * Fetch data from multiple endpoints based on chat context needs
   */
  async fetchAdditionalEndpointData(
    requests: EndpointDataRequest[],
    primaryAnalysisResult: AnalysisResult
  ): Promise<MultiEndpointFetchResult> {
    const startTime = performance.now();
    const errors: string[] = [];
    const additionalData: EndpointDataResult[] = [];

    console.log(`[MultiEndpointFetcher] Fetching data from ${requests.length} additional endpoints:`, 
      requests.map(r => `${r.endpoint} (${r.reason})`));

    // Limit concurrent requests to avoid overwhelming the system
    const limitedRequests = requests.slice(0, this.MAX_CONCURRENT_FETCHES);
    
    // Execute requests in parallel with timeout protection
    const fetchPromises = limitedRequests.map(request => 
      this.fetchSingleEndpoint(request).catch(error => {
        const errorResult: EndpointDataResult = {
          endpoint: request.endpoint,
          success: false,
          error: error.message,
          fetchTime: 0
        };
        errors.push(`${request.endpoint}: ${error.message}`);
        return errorResult;
      })
    );

    try {
      const results = await Promise.allSettled(fetchPromises);
      
      for (const result of results) {
        if (result.status === 'fulfilled') {
          additionalData.push(result.value);
          if (!result.value.success) {
            errors.push(`${result.value.endpoint}: ${result.value.error}`);
          }
        } else {
          errors.push(`Fetch failed: ${result.reason}`);
        }
      }
      
    } catch (error) {
      console.error('[MultiEndpointFetcher] Batch fetch error:', error);
      errors.push(`Batch fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const totalFetchTime = performance.now() - startTime;
    const successfulFetches = additionalData.filter(d => d.success).length;

    console.log(`[MultiEndpointFetcher] Completed: ${successfulFetches}/${limitedRequests.length} endpoints in ${totalFetchTime.toFixed(1)}ms`);

    return {
      primaryData: primaryAnalysisResult,
      additionalData,
      totalFetchTime,
      success: successfulFetches > 0,
      errors
    };
  }

  /**
   * Fetch data from a single endpoint with caching and error handling
   */
  private async fetchSingleEndpoint(request: EndpointDataRequest): Promise<EndpointDataResult> {
    const startTime = performance.now();
    const cacheKey = this.getCacheKey(request);

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && this.isCacheValid(cached)) {
      console.log(`[MultiEndpointFetcher] Cache hit for ${request.endpoint}`);
      return {
        ...cached,
        fetchTime: performance.now() - startTime
      };
    }

    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Timeout after ${this.FETCH_TIMEOUT}ms`)), this.FETCH_TIMEOUT);
      });

      // Build request payload for the endpoint
      const requestPayload = this.buildRequestPayload(request);
      
      // Race between fetch and timeout
      const fetchPromise = fetch('/api/analysis/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload)
      });

      const response = await Promise.race([fetchPromise, timeoutPromise]);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const responseData = await response.json();
      
      if (!responseData.success) {
        throw new Error(responseData.error || 'Analysis failed');
      }

      const result: EndpointDataResult = {
        endpoint: request.endpoint,
        success: true,
        data: {
          records: responseData.data?.records || [],
          statistics: responseData.statistics,
          metadata: responseData.metadata
        },
        fetchTime: performance.now() - startTime
      };

      // Cache successful result
      this.cache.set(cacheKey, result);
      
      console.log(`[MultiEndpointFetcher] Successfully fetched ${result.data?.records.length || 0} records from ${request.endpoint} in ${result.fetchTime.toFixed(1)}ms`);

      return result;

    } catch (error) {
      const errorResult: EndpointDataResult = {
        endpoint: request.endpoint,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        fetchTime: performance.now() - startTime
      };

      console.error(`[MultiEndpointFetcher] Failed to fetch ${request.endpoint}:`, error);
      return errorResult;
    }
  }

  /**
   * Build the request payload for an endpoint
   */
  private buildRequestPayload(request: EndpointDataRequest) {
    // Force specific endpoint instead of routing
    return {
      query: request.query,
      forceEndpoint: request.endpoint,
      options: {
        spatialFilterIds: request.geography.spatialFilterIds,
        filterType: request.geography.filterType,
        zipCodes: request.geography.zipCodes,
        // Optimize for speed - we want basic data, not full analysis
        skipVisualization: true,
        skipNarrative: true,
        quickMode: true
      }
    };
  }

  /**
   * Generate cache key for request
   */
  private getCacheKey(request: EndpointDataRequest): string {
    const geoKey = [
      ...(request.geography.zipCodes || []),
      ...(request.geography.spatialFilterIds || []),
      request.geography.filterType || ''
    ].sort().join('-');
    
    return `${request.endpoint}:${geoKey}`;
  }

  /**
   * Check if cached result is still valid
   */
  private isCacheValid(cached: EndpointDataResult): boolean {
    // For now, simple time-based validation
    // Could be enhanced with data freshness checks
    return true; // Since we're using Map, items are relatively fresh
  }

  /**
   * Convert fetched data to chat-compatible format
   */
  convertToFeatureData(fetchResult: MultiEndpointFetchResult): Array<{
    layerId: string;
    layerName: string;
    layerType: string;
    features: any[];
    metadata?: any;
  }> {
    const featureData = [];

    // Add primary analysis data
    if (fetchResult.primaryData?.data?.records) {
      featureData.push({
        layerId: 'primary_analysis',
        layerName: 'Current Analysis',
        layerType: 'polygon',
        features: fetchResult.primaryData.data.records.map((r: any) => ({ properties: r })),
        metadata: {
          endpoint: fetchResult.primaryData.endpoint,
          isPrimary: true
        }
      });
    }

    // Add additional endpoint data
    for (const additionalData of fetchResult.additionalData) {
      if (additionalData.success && additionalData.data?.records) {
        const endpointName = additionalData.endpoint.replace('/', '').replace(/-/g, '_');
        featureData.push({
          layerId: endpointName,
          layerName: this.getEndpointDisplayName(additionalData.endpoint),
          layerType: 'polygon',
          features: additionalData.data.records.map((r: any) => ({ properties: r })),
          metadata: {
            endpoint: additionalData.endpoint,
            isPrimary: false,
            fetchTime: additionalData.fetchTime
          }
        });
      }
    }

    return featureData;
  }

  /**
   * Get human-readable name for endpoint
   */
  private getEndpointDisplayName(endpoint: string): string {
    const displayNames: Record<string, string> = {
      '/demographic-insights': 'Demographics',
      '/competitive-analysis': 'Competitive Analysis', 
      '/strategic-analysis': 'Strategic Analysis',
      '/brand-difference': 'Brand Analysis',
      '/spatial-clusters': 'Spatial Clusters',
      '/comparative-analysis': 'Comparative Analysis',
      '/correlation-analysis': 'Correlation Analysis',
      '/feature-interactions': 'Feature Interactions'
    };

    return displayNames[endpoint] || endpoint.replace('/', '').replace(/-/g, ' ');
  }

  /**
   * Clear cache (useful for testing or memory management)
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {size: number; endpoints: string[]} {
    return {
      size: this.cache.size,
      endpoints: Array.from(this.cache.keys()).map(key => key.split(':')[0])
    };
  }
}

// Singleton instance
export const multiEndpointFetcher = new MultiEndpointFetcher();