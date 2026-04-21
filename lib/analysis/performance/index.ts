// Export all performance optimization modules
export { CacheManager } from './CacheManager';
export { RequestBatcher } from './RequestBatcher';
export { ErrorRecovery } from './ErrorRecovery';
export { PerformanceMonitor } from './PerformanceMonitor';

/**
 * Performance optimization constants and utilities
 */
export const PERFORMANCE_DEFAULTS = {
  CACHE_TTL: {
    ANALYZE: 300000, // 5 minutes
    CLUSTER: 600000, // 10 minutes
    COMPETITIVE: 180000, // 3 minutes
    DEMOGRAPHIC: 1800000, // 30 minutes
    DEFAULT: 300000
  },
  BATCH_CONFIG: {
    MAX_SIZE: 5,
    TIMEOUT: 100, // 100ms
    MAX_CONCURRENT: 3
  },
  RETRY_CONFIG: {
    MAX_RETRIES: 3,
    BASE_DELAY: 1000, // 1 second
    MAX_DELAY: 30000, // 30 seconds
    JITTER_FACTOR: 0.1
  },
  MONITOR_CONFIG: {
    HISTORY_SIZE: 1000,
    ALERT_THRESHOLDS: {
      RESPONSE_TIME: 10000, // 10 seconds
      ERROR_RATE: 0.1, // 10%
      THROUGHPUT: 0.1 // requests/second
    }
  }
} as const;

/**
 * Performance optimization feature flags
 */
export const PERFORMANCE_FEATURES = {
  CACHING_ENABLED: true,
  BATCHING_ENABLED: true,
  ERROR_RECOVERY_ENABLED: true,
  MONITORING_ENABLED: true,
  ADAPTIVE_PERFORMANCE: true
} as const; 