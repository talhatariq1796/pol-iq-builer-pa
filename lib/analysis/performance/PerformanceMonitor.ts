/**
 * PerformanceMonitor - Comprehensive performance monitoring and metrics collection
 * 
 * Features:
 * - Real-time performance metrics
 * - Response time tracking
 * - Throughput monitoring
 * - Resource utilization tracking
 * - Alert system for performance issues
 * - Historical performance data
 */
export class PerformanceMonitor {
  private metrics: PerformanceMetrics;
  private responseTimeHistory: ResponseTimeEntry[] = [];
  private throughputHistory: ThroughputEntry[] = [];
  private alertHandlers: AlertHandler[] = [];
  private config: MonitorConfig;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<MonitorConfig> = {}) {
    this.config = {
      historySize: config.historySize || 1000,
      alertThresholds: {
        responseTime: config.alertThresholds?.responseTime || 10000, // 10 seconds
        errorRate: config.alertThresholds?.errorRate || 0.1, // 10%
        throughput: config.alertThresholds?.throughput || 0.1 // requests/second
      },
      monitoringIntervalMs: config.monitoringIntervalMs || 30000 // 30 seconds
    };

    this.metrics = this.initializeMetrics();
    this.startMonitoring();
  }

  /**
   * Record a request start
   */
  startRequest(requestId: string, endpoint: string, options: RequestOptions = {}): RequestTracker {
    const tracker: RequestTracker = {
      requestId,
      endpoint,
      startTime: Date.now(),
      priority: options.priority || 'normal',
      cached: options.cached || false
    };

    this.metrics.totalRequests++;
    this.metrics.activeRequests++;

    return tracker;
  }

  /**
   * Record a request completion
   */
  endRequest(tracker: RequestTracker, success: boolean, dataSize?: number): void {
    const endTime = Date.now();
    const responseTime = endTime - tracker.startTime;

    // Update metrics
    this.metrics.activeRequests = Math.max(0, this.metrics.activeRequests - 1);
    
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }

    // Record response time
    this.recordResponseTime(tracker.endpoint, responseTime, success, tracker.cached);

    // Record throughput
    this.recordThroughput(tracker.endpoint, endTime);

    // Update endpoint-specific metrics
    this.updateEndpointMetrics(tracker.endpoint, responseTime, success, dataSize);

    // Check for alerts
    this.checkAlerts(tracker.endpoint, responseTime, success);
  }

  /**
   * Record cache hit/miss
   */
  recordCacheEvent(endpoint: string, hit: boolean): void {
    if (!this.metrics.cacheMetrics.has(endpoint)) {
      this.metrics.cacheMetrics.set(endpoint, {
        hits: 0,
        misses: 0,
        hitRate: 0
      });
    }

    const cacheMetrics = this.metrics.cacheMetrics.get(endpoint)!;
    
    if (hit) {
      cacheMetrics.hits++;
    } else {
      cacheMetrics.misses++;
    }

    const total = cacheMetrics.hits + cacheMetrics.misses;
    cacheMetrics.hitRate = total > 0 ? cacheMetrics.hits / total : 0;
  }

  /**
   * Record batch operation
   */
  recordBatchOperation(batchSize: number, responseTime: number, success: boolean): void {
    this.metrics.batchMetrics.totalBatches++;
    this.metrics.batchMetrics.totalRequestsInBatches += batchSize;
    this.metrics.batchMetrics.avgBatchSize = 
      this.metrics.batchMetrics.totalRequestsInBatches / this.metrics.batchMetrics.totalBatches;

    if (success) {
      this.metrics.batchMetrics.successfulBatches++;
    } else {
      this.metrics.batchMetrics.failedBatches++;
    }

    // Update average batch response time
    const totalTime = this.metrics.batchMetrics.avgBatchResponseTime * (this.metrics.batchMetrics.totalBatches - 1) + responseTime;
    this.metrics.batchMetrics.avgBatchResponseTime = totalTime / this.metrics.batchMetrics.totalBatches;
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return {
      ...this.metrics,
      timestamp: Date.now(),
      errorRate: this.calculateErrorRate(),
      currentThroughput: this.calculateCurrentThroughput(),
      avgResponseTime: this.calculateAverageResponseTime()
    };
  }

  /**
   * Get performance summary for a specific endpoint
   */
  getEndpointSummary(endpoint: string): EndpointSummary {
    const endpointMetrics = this.metrics.endpointMetrics.get(endpoint);
    const cacheMetrics = this.metrics.cacheMetrics.get(endpoint);
    
    const recentResponses = this.responseTimeHistory
      .filter(entry => entry.endpoint === endpoint && Date.now() - entry.timestamp < 3600000) // Last hour
      .map(entry => entry.responseTime);

    const avgResponseTime = recentResponses.length > 0 
      ? recentResponses.reduce((sum, time) => sum + time, 0) / recentResponses.length 
      : 0;

    const p95ResponseTime = this.calculatePercentile(recentResponses, 0.95);
    const p99ResponseTime = this.calculatePercentile(recentResponses, 0.99);

    return {
      endpoint,
      totalRequests: endpointMetrics?.requests || 0,
      successRate: endpointMetrics ? endpointMetrics.successes / endpointMetrics.requests : 0,
      avgResponseTime,
      p95ResponseTime,
      p99ResponseTime,
      cacheHitRate: cacheMetrics?.hitRate || 0,
      avgDataSize: endpointMetrics?.avgDataSize || 0,
      lastActivity: endpointMetrics?.lastActivity || 0
    };
  }

  /**
   * Get performance trends over time
   */
  getPerformanceTrends(timeRangeMs: number = 3600000): PerformanceTrends {
    const cutoffTime = Date.now() - timeRangeMs;
    
    const recentResponseTimes = this.responseTimeHistory
      .filter(entry => entry.timestamp > cutoffTime);
    
    const recentThroughput = this.throughputHistory
      .filter(entry => entry.timestamp > cutoffTime);

    // Calculate trends
    const responseTimeTrend = this.calculateTrend(
      recentResponseTimes.map(entry => ({ time: entry.timestamp, value: entry.responseTime }))
    );

    const throughputTrend = this.calculateTrend(
      recentThroughput.map(entry => ({ time: entry.timestamp, value: entry.requestCount }))
    );

    const errorRateTrend = this.calculateErrorRateTrend(recentResponseTimes);

    return {
      timeRange: timeRangeMs,
      responseTimeTrend,
      throughputTrend,
      errorRateTrend,
      dataPoints: recentResponseTimes.length
    };
  }

  /**
   * Add alert handler
   */
  addAlertHandler(handler: AlertHandler): void {
    this.alertHandlers.push(handler);
  }

  /**
   * Generate performance report
   */
  generateReport(): PerformanceReport {
    const metrics = this.getMetrics();
    const trends = this.getPerformanceTrends();
    
    const endpointSummaries = Array.from(this.metrics.endpointMetrics.keys())
      .map(endpoint => this.getEndpointSummary(endpoint));

    const issues = this.identifyPerformanceIssues();

    return {
      timestamp: Date.now(),
      overview: {
        totalRequests: metrics.totalRequests,
        errorRate: metrics.errorRate,
        avgResponseTime: metrics.avgResponseTime,
        currentThroughput: metrics.currentThroughput,
        activeRequests: metrics.activeRequests
      },
      endpoints: endpointSummaries,
      trends,
      cachePerformance: {
        overallHitRate: this.calculateOverallCacheHitRate(),
        topCachedEndpoints: this.getTopCachedEndpoints()
      },
      batchPerformance: metrics.batchMetrics,
      issues,
      recommendations: this.generateRecommendations(issues)
    };
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private initializeMetrics(): PerformanceMetrics {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      activeRequests: 0,
      errorRate: 0,
      currentThroughput: 0,
      avgResponseTime: 0,
      timestamp: Date.now(),
      endpointMetrics: new Map(),
      cacheMetrics: new Map(),
      batchMetrics: {
        totalBatches: 0,
        successfulBatches: 0,
        failedBatches: 0,
        totalRequestsInBatches: 0,
        avgBatchSize: 0,
        avgBatchResponseTime: 0
      }
    };
  }

  private recordResponseTime(endpoint: string, responseTime: number, success: boolean, cached: boolean): void {
    const entry: ResponseTimeEntry = {
      endpoint,
      responseTime,
      success,
      cached,
      timestamp: Date.now()
    };

    this.responseTimeHistory.push(entry);

    // Maintain history size
    if (this.responseTimeHistory.length > this.config.historySize) {
      this.responseTimeHistory.shift();
    }
  }

  private recordThroughput(endpoint: string, timestamp: number): void {
    // Group requests by time windows (per minute)
    const timeWindow = Math.floor(timestamp / 60000) * 60000;
    
    let throughputEntry = this.throughputHistory.find(
      entry => entry.endpoint === endpoint && entry.timestamp === timeWindow
    );

    if (!throughputEntry) {
      throughputEntry = {
        endpoint,
        timestamp: timeWindow,
        requestCount: 0
      };
      this.throughputHistory.push(throughputEntry);
    }

    throughputEntry.requestCount++;

    // Maintain history size
    if (this.throughputHistory.length > this.config.historySize) {
      this.throughputHistory.shift();
    }
  }

  private updateEndpointMetrics(endpoint: string, responseTime: number, success: boolean, dataSize?: number): void {
    if (!this.metrics.endpointMetrics.has(endpoint)) {
      this.metrics.endpointMetrics.set(endpoint, {
        requests: 0,
        successes: 0,
        failures: 0,
        totalResponseTime: 0,
        avgResponseTime: 0,
        avgDataSize: 0,
        totalDataSize: 0,
        lastActivity: 0
      });
    }

    const endpointMetrics = this.metrics.endpointMetrics.get(endpoint)!;
    
    endpointMetrics.requests++;
    endpointMetrics.totalResponseTime += responseTime;
    endpointMetrics.avgResponseTime = endpointMetrics.totalResponseTime / endpointMetrics.requests;
    endpointMetrics.lastActivity = Date.now();

    if (success) {
      endpointMetrics.successes++;
    } else {
      endpointMetrics.failures++;
    }

    if (dataSize) {
      endpointMetrics.totalDataSize += dataSize;
      endpointMetrics.avgDataSize = endpointMetrics.totalDataSize / endpointMetrics.requests;
    }
  }

  private calculateErrorRate(): number {
    const total = this.metrics.totalRequests;
    return total > 0 ? this.metrics.failedRequests / total : 0;
  }

  private calculateCurrentThroughput(): number {
    const recentRequests = this.responseTimeHistory.filter(
      entry => Date.now() - entry.timestamp < 60000 // Last minute
    );
    
    return recentRequests.length / 60; // Requests per second
  }

  private calculateAverageResponseTime(): number {
    const recentResponses = this.responseTimeHistory.filter(
      entry => Date.now() - entry.timestamp < 300000 // Last 5 minutes
    );

    if (recentResponses.length === 0) return 0;
    
    return recentResponses.reduce((sum, entry) => sum + entry.responseTime, 0) / recentResponses.length;
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * percentile) - 1;
    
    return sorted[Math.max(0, index)];
  }

  private calculateTrend(dataPoints: Array<{ time: number; value: number }>): number {
    if (dataPoints.length < 2) return 0;

    // Simple linear regression for trend calculation
    const n = dataPoints.length;
    const sumX = dataPoints.reduce((sum, point) => sum + point.time, 0);
    const sumY = dataPoints.reduce((sum, point) => sum + point.value, 0);
    const sumXY = dataPoints.reduce((sum, point) => sum + point.time * point.value, 0);
    const sumXX = dataPoints.reduce((sum, point) => sum + point.time * point.time, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    
    return slope; // Positive = increasing, Negative = decreasing
  }

  private calculateErrorRateTrend(responses: ResponseTimeEntry[]): number {
    if (responses.length < 10) return 0;

    // Calculate error rate trend over time
    const timeWindows = new Map<number, { total: number; errors: number }>();
    
    responses.forEach(response => {
      const window = Math.floor(response.timestamp / 300000) * 300000; // 5-minute windows
      
      if (!timeWindows.has(window)) {
        timeWindows.set(window, { total: 0, errors: 0 });
      }
      
      const windowData = timeWindows.get(window)!;
      windowData.total++;
      if (!response.success) {
        windowData.errors++;
      }
    });

    const errorRates = Array.from(timeWindows.entries()).map(([time, data]) => ({
      time,
      value: data.total > 0 ? data.errors / data.total : 0
    }));

    return this.calculateTrend(errorRates);
  }

  private checkAlerts(endpoint: string, responseTime: number, success: boolean): void {
    const alerts: PerformanceAlert[] = [];

    // Response time alert
    if (responseTime > this.config.alertThresholds.responseTime) {
      alerts.push({
        type: 'high_response_time',
        endpoint,
        message: `Response time ${responseTime}ms exceeds threshold ${this.config.alertThresholds.responseTime}ms`,
        severity: responseTime > this.config.alertThresholds.responseTime * 2 ? 'critical' : 'warning',
        value: responseTime,
        threshold: this.config.alertThresholds.responseTime,
        timestamp: Date.now()
      });
    }

    // Error rate alert
    const errorRate = this.calculateErrorRate();
    if (errorRate > this.config.alertThresholds.errorRate) {
      alerts.push({
        type: 'high_error_rate',
        endpoint: 'global',
        message: `Error rate ${(errorRate * 100).toFixed(1)}% exceeds threshold ${(this.config.alertThresholds.errorRate * 100).toFixed(1)}%`,
        severity: errorRate > this.config.alertThresholds.errorRate * 2 ? 'critical' : 'warning',
        value: errorRate,
        threshold: this.config.alertThresholds.errorRate,
        timestamp: Date.now()
      });
    }

    // Trigger alert handlers
    alerts.forEach(alert => {
      this.alertHandlers.forEach(handler => {
        try {
          handler(alert);
        } catch (error) {
          console.error('[PerformanceMonitor] Alert handler failed:', error);
        }
      });
    });
  }

  private identifyPerformanceIssues(): PerformanceIssue[] {
    const issues: PerformanceIssue[] = [];
    const metrics = this.getMetrics();

    // High error rate
    if (metrics.errorRate > 0.05) { // 5%
      issues.push({
        type: 'high_error_rate',
        severity: metrics.errorRate > 0.1 ? 'critical' : 'warning',
        description: `Error rate is ${(metrics.errorRate * 100).toFixed(1)}%`,
        recommendation: 'Check error logs and implement additional error handling'
      });
    }

    // Slow response times
    if (metrics.avgResponseTime > 5000) { // 5 seconds
      issues.push({
        type: 'slow_response_time',
        severity: metrics.avgResponseTime > 10000 ? 'critical' : 'warning',
        description: `Average response time is ${(metrics.avgResponseTime / 1000).toFixed(1)}s`,
        recommendation: 'Consider implementing caching, optimizing queries, or scaling resources'
      });
    }

    // Low cache hit rate
    const overallCacheHitRate = this.calculateOverallCacheHitRate();
    if (overallCacheHitRate < 0.5 && overallCacheHitRate > 0) { // 50%
      issues.push({
        type: 'low_cache_hit_rate',
        severity: 'warning',
        description: `Cache hit rate is ${(overallCacheHitRate * 100).toFixed(1)}%`,
        recommendation: 'Review cache configuration and consider adjusting TTL values'
      });
    }

    return issues;
  }

  private generateRecommendations(issues: PerformanceIssue[]): string[] {
    const recommendations: string[] = [];
    
    issues.forEach(issue => {
      recommendations.push(issue.recommendation);
    });

    // General recommendations based on metrics
    const metrics = this.getMetrics();
    
    if (metrics.batchMetrics.avgBatchSize < 2) {
      recommendations.push('Consider increasing batch sizes to improve throughput');
    }

    if (metrics.activeRequests > 10) {
      recommendations.push('High number of active requests - consider implementing request queuing');
    }

    return Array.from(new Set(recommendations)); // Remove duplicates
  }

  private calculateOverallCacheHitRate(): number {
    let totalHits = 0;
    let totalRequests = 0;

    this.metrics.cacheMetrics.forEach(metrics => {
      totalHits += metrics.hits;
      totalRequests += metrics.hits + metrics.misses;
    });

    return totalRequests > 0 ? totalHits / totalRequests : 0;
  }

  private getTopCachedEndpoints(): Array<{ endpoint: string; hitRate: number }> {
    return Array.from(this.metrics.cacheMetrics.entries())
      .map(([endpoint, metrics]) => ({ endpoint, hitRate: metrics.hitRate }))
      .sort((a, b) => b.hitRate - a.hitRate)
      .slice(0, 5);
  }

  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.performPeriodicChecks();
    }, this.config.monitoringIntervalMs);
  }

  private performPeriodicChecks(): void {
    // Cleanup old data
    this.cleanupOldData();
    
    // Check for system-wide performance issues
    const metrics = this.getMetrics();
    
    console.log(`[PerformanceMonitor] Status: ${metrics.totalRequests} total requests, ${(metrics.errorRate * 100).toFixed(1)}% error rate, ${metrics.avgResponseTime.toFixed(0)}ms avg response time`);
  }

  private cleanupOldData(): void {
    const cutoffTime = Date.now() - 3600000; // Keep last hour
    
    this.responseTimeHistory = this.responseTimeHistory.filter(
      entry => entry.timestamp > cutoffTime
    );
    
    this.throughputHistory = this.throughputHistory.filter(
      entry => entry.timestamp > cutoffTime
    );
  }

  /**
   * Stop monitoring and cleanup
   */
  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }
}

// ============================================================================
// INTERFACES AND TYPES
// ============================================================================

interface MonitorConfig {
  historySize: number;
  alertThresholds: {
    responseTime: number;
    errorRate: number;
    throughput: number;
  };
  monitoringIntervalMs: number;
}

interface RequestOptions {
  priority?: 'high' | 'normal' | 'low';
  cached?: boolean;
}

interface RequestTracker {
  requestId: string;
  endpoint: string;
  startTime: number;
  priority: 'high' | 'normal' | 'low';
  cached: boolean;
}

interface PerformanceMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  activeRequests: number;
  errorRate: number;
  currentThroughput: number;
  avgResponseTime: number;
  timestamp: number;
  endpointMetrics: Map<string, EndpointMetrics>;
  cacheMetrics: Map<string, CacheMetrics>;
  batchMetrics: BatchMetrics;
}

interface EndpointMetrics {
  requests: number;
  successes: number;
  failures: number;
  totalResponseTime: number;
  avgResponseTime: number;
  avgDataSize: number;
  totalDataSize: number;
  lastActivity: number;
}

interface CacheMetrics {
  hits: number;
  misses: number;
  hitRate: number;
}

interface BatchMetrics {
  totalBatches: number;
  successfulBatches: number;
  failedBatches: number;
  totalRequestsInBatches: number;
  avgBatchSize: number;
  avgBatchResponseTime: number;
}

interface ResponseTimeEntry {
  endpoint: string;
  responseTime: number;
  success: boolean;
  cached: boolean;
  timestamp: number;
}

interface ThroughputEntry {
  endpoint: string;
  timestamp: number;
  requestCount: number;
}

interface EndpointSummary {
  endpoint: string;
  totalRequests: number;
  successRate: number;
  avgResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  cacheHitRate: number;
  avgDataSize: number;
  lastActivity: number;
}

interface PerformanceTrends {
  timeRange: number;
  responseTimeTrend: number;
  throughputTrend: number;
  errorRateTrend: number;
  dataPoints: number;
}

interface PerformanceAlert {
  type: string;
  endpoint: string;
  message: string;
  severity: 'warning' | 'critical';
  value: number;
  threshold: number;
  timestamp: number;
}

interface PerformanceIssue {
  type: string;
  severity: 'warning' | 'critical';
  description: string;
  recommendation: string;
}

interface PerformanceReport {
  timestamp: number;
  overview: {
    totalRequests: number;
    errorRate: number;
    avgResponseTime: number;
    currentThroughput: number;
    activeRequests: number;
  };
  endpoints: EndpointSummary[];
  trends: PerformanceTrends;
  cachePerformance: {
    overallHitRate: number;
    topCachedEndpoints: Array<{ endpoint: string; hitRate: number }>;
  };
  batchPerformance: BatchMetrics;
  issues: PerformanceIssue[];
  recommendations: string[];
}

type AlertHandler = (alert: PerformanceAlert) => void; 