/**
 * CacheManager - Intelligent caching system for analysis requests
 * 
 * Features:
 * - TTL (Time To Live) based expiration
 * - LRU (Least Recently Used) eviction
 * - Smart cache keys based on request parameters
 * - Configurable cache sizes per endpoint
 * - Cache invalidation strategies
 */
export class CacheManager {
  private cache: Map<string, CacheEntry> = new Map();
  private accessOrder: string[] = [];
  private maxSize: number;
  private defaultTTL: number;
  private endpointTTLs: Map<string, number> = new Map();
  private endpointMaxSizes: Map<string, number> = new Map();
  private hitCount: number = 0;
  private missCount: number = 0;

  constructor(config: CacheConfig = {}) {
    this.maxSize = config.maxSize || 1000;
    this.defaultTTL = config.defaultTTL || 300000; // 5 minutes
    this.initializeEndpointConfigs();
  }

  /**
   * Get cached result if available and not expired
   */
  get(key: string): any | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.missCount++;
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      this.missCount++;
      return null;
    }

    // Update access order for LRU
    this.updateAccessOrder(key);
    this.hitCount++;
    
    return entry.data;
  }

  /**
   * Store result in cache with endpoint-specific TTL
   */
  set(key: string, data: any, endpoint?: string): void {
    const ttl = this.getTTLForEndpoint(endpoint);
    const maxSize = this.getMaxSizeForEndpoint(endpoint);
    
    // Check if we need to evict based on endpoint-specific limits
    this.enforceMaxSize(maxSize);
    
    const entry: CacheEntry = {
      data,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttl,
      endpoint: endpoint || 'unknown',
      accessCount: 1,
      lastAccessed: Date.now()
    };

    this.cache.set(key, entry);
    this.updateAccessOrder(key);
  }

  /**
   * Generate smart cache key from request parameters
   */
  generateKey(endpoint: string, payload: any, options?: any): string {
    // Create deterministic key from request parameters
    const keyData = {
      endpoint,
      payload: this.normalizePayload(payload),
      options: options || {}
    };
    
    return this.hashObject(keyData);
  }

  /**
   * Invalidate cache entries by pattern or endpoint
   */
  invalidate(pattern?: string | RegExp, endpoint?: string): number {
    let invalidatedCount = 0;
    const keysToDelete: string[] = [];

    Array.from(this.cache.entries()).forEach(([key, entry]) => {
      let shouldInvalidate = false;

      // Invalidate by endpoint
      if (endpoint && entry.endpoint === endpoint) {
        shouldInvalidate = true;
      }

      // Invalidate by pattern
      if (pattern) {
        if (typeof pattern === 'string' && key.includes(pattern)) {
          shouldInvalidate = true;
        } else if (pattern instanceof RegExp && pattern.test(key)) {
          shouldInvalidate = true;
        }
      }

      if (shouldInvalidate) {
        keysToDelete.push(key);
        invalidatedCount++;
      }
    });

    // Remove invalidated entries
    keysToDelete.forEach(key => {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
    });

    return invalidatedCount;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.hitCount + this.missCount;
    const hitRate = totalRequests > 0 ? (this.hitCount / totalRequests) * 100 : 0;
    
    const endpointBreakdown = new Map<string, EndpointCacheStats>();
    
    // Calculate per-endpoint statistics
    Array.from(this.cache.entries()).forEach(([key, entry]) => {
      const endpoint = entry.endpoint;
      if (!endpointBreakdown.has(endpoint)) {
        endpointBreakdown.set(endpoint, {
          entryCount: 0,
          totalSize: 0,
          oldestEntry: Date.now(),
          newestEntry: 0
        });
      }
      
      const stats = endpointBreakdown.get(endpoint)!;
      stats.entryCount++;
      stats.totalSize += this.estimateSize(entry.data);
      stats.oldestEntry = Math.min(stats.oldestEntry, entry.createdAt);
      stats.newestEntry = Math.max(stats.newestEntry, entry.createdAt);
    });

    return {
      totalEntries: this.cache.size,
      maxSize: this.maxSize,
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate,
      memoryUsage: this.estimateMemoryUsage(),
      endpointBreakdown: Object.fromEntries(endpointBreakdown)
    };
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    this.hitCount = 0;
    this.missCount = 0;
  }

  /**
   * Perform cache maintenance (remove expired entries)
   */
  maintenance(): number {
    const now = Date.now();
    let removedCount = 0;
    const expiredKeys: string[] = [];

    Array.from(this.cache.entries()).forEach(([key, entry]) => {
      if (now > entry.expiresAt) {
        expiredKeys.push(key);
        removedCount++;
      }
    });

    expiredKeys.forEach(key => {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
    });

    return removedCount;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private initializeEndpointConfigs(): void {
    // Configure TTLs for different endpoint types
    this.endpointTTLs.set('/analyze', 300000); // 5 minutes
    this.endpointTTLs.set('/spatial-clusters', 600000); // 10 minutes (clustering is expensive)
    this.endpointTTLs.set('/competitive-analysis', 180000); // 3 minutes (more dynamic data)
    this.endpointTTLs.set('/correlation-analysis', 300000); // 5 minutes
    this.endpointTTLs.set('/demographic-insights', 1800000); // 30 minutes (demographic data changes slowly)
    
    // Configure max sizes per endpoint
    this.endpointMaxSizes.set('/analyze', 200);
    this.endpointMaxSizes.set('/spatial-clusters', 100); // Cluster results are larger
    this.endpointMaxSizes.set('/competitive-analysis', 150);
    this.endpointMaxSizes.set('/correlation-analysis', 200);
    this.endpointMaxSizes.set('/demographic-insights', 300);
  }

  private getTTLForEndpoint(endpoint?: string): number {
    if (!endpoint) return this.defaultTTL;
    return this.endpointTTLs.get(endpoint) || this.defaultTTL;
  }

  private getMaxSizeForEndpoint(endpoint?: string): number {
    if (!endpoint) return this.maxSize;
    return this.endpointMaxSizes.get(endpoint) || 100;
  }

  private enforceMaxSize(maxSize: number): void {
    while (this.cache.size >= maxSize && this.accessOrder.length > 0) {
      // Remove least recently used entry
      const lruKey = this.accessOrder.shift()!;
      this.cache.delete(lruKey);
    }
  }

  private updateAccessOrder(key: string): void {
    // Remove from current position
    this.removeFromAccessOrder(key);
    // Add to end (most recently used)
    this.accessOrder.push(key);
  }

  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  private normalizePayload(payload: any): any {
    if (!payload || typeof payload !== 'object') return payload;
    
    // Sort object keys for consistent hashing
    const sortedPayload: any = {};
    const keys = Object.keys(payload).sort();
    
    for (const key of keys) {
      sortedPayload[key] = payload[key];
    }
    
    return sortedPayload;
  }

  private hashObject(obj: any): string {
    // Simple hash function for cache keys
    const str = JSON.stringify(obj);
    let hash = 0;
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return `cache_${Math.abs(hash).toString(36)}`;
  }

  private estimateSize(data: any): number {
    // Rough estimation of data size in bytes
    const str = JSON.stringify(data);
    return str.length * 2; // Approximate UTF-16 encoding
  }

  private estimateMemoryUsage(): number {
    let totalSize = 0;
    
    Array.from(this.cache.values()).forEach(entry => {
      totalSize += this.estimateSize(entry);
    });
    
    return totalSize;
  }
}

// ============================================================================
// INTERFACES AND TYPES
// ============================================================================

interface CacheEntry {
  data: any;
  createdAt: number;
  expiresAt: number;
  endpoint: string;
  accessCount: number;
  lastAccessed: number;
}

interface CacheConfig {
  maxSize?: number;
  defaultTTL?: number;
}

interface CacheStats {
  totalEntries: number;
  maxSize: number;
  hitCount: number;
  missCount: number;
  hitRate: number;
  memoryUsage: number;
  endpointBreakdown: Record<string, EndpointCacheStats>;
}

interface EndpointCacheStats {
  entryCount: number;
  totalSize: number;
  oldestEntry: number;
  newestEntry: number;
} 