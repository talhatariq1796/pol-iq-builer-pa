/**
 * Error Tracking for PDF Generation V1 vs V2 Comparison
 *
 * Tracks error rates, types, and patterns to monitor quality
 * during V2 rollout.
 */

interface ErrorEvent {
  requestId: string;
  timestamp: number;
  version: 'v1' | 'v2';

  // Error details
  error: {
    message: string;
    stack?: string;
    code?: string;
    page?: number;
  };

  // Context
  context: {
    flags: any;
    dataSize?: number;
    complexity?: string;
  };

  // Recovery
  recovered: boolean;
  recoveryAction?: string;
}

interface ErrorStats {
  totalErrors: number;
  errorRate: number; // Errors per 100 requests
  errorsByType: Record<string, number>;
  errorsByPage: Record<string, number>;
  recoveryRate: number; // Percentage of errors recovered
}

export class ErrorTracker {
  private errors: ErrorEvent[] = [];
  private requestCount: { v1: number; v2: number } = { v1: 0, v2: 0 };
  private enabled: boolean = true;
  private maxSize: number = 500;

  constructor(enabled: boolean = true) {
    this.enabled = enabled;
  }

  /**
   * Track a request (for calculating error rates)
   */
  trackRequest(version: 'v1' | 'v2'): void {
    if (!this.enabled) return;
    this.requestCount[version]++;
  }

  /**
   * Track an error
   */
  trackError(
    requestId: string,
    version: 'v1' | 'v2',
    error: Error,
    context: {
      flags?: any;
      page?: number;
      dataSize?: number;
      complexity?: string;
    } = {}
  ): void {
    if (!this.enabled) return;

    const errorEvent: ErrorEvent = {
      requestId,
      timestamp: Date.now(),
      version,
      error: {
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
        page: context.page,
      },
      context: {
        flags: context.flags,
        dataSize: context.dataSize,
        complexity: context.complexity,
      },
      recovered: false,
    };

    this.errors.push(errorEvent);

    // Keep only recent errors
    if (this.errors.length > this.maxSize) {
      this.errors = this.errors.slice(-this.maxSize);
    }

    // Log error in development/staging
    if (process.env.NODE_ENV !== 'production') {
      this.logError(errorEvent);
    }
  }

  /**
   * Mark an error as recovered
   */
  markRecovered(requestId: string, recoveryAction: string): void {
    if (!this.enabled) return;

    const error = this.errors.find((e) => e.requestId === requestId && !e.recovered);

    if (error) {
      error.recovered = true;
      error.recoveryAction = recoveryAction;
    }
  }

  /**
   * Get error statistics for a version
   */
  getStats(version: 'v1' | 'v2'): ErrorStats {
    const versionErrors = this.errors.filter((e) => e.version === version);
    const requestCount = this.requestCount[version] || 1;

    const errorsByType: Record<string, number> = {};
    const errorsByPage: Record<string, number> = {};
    let recoveredCount = 0;

    versionErrors.forEach((error) => {
      // Count by error type (first word of message)
      const errorType = error.error.message.split(' ')[0] || 'Unknown';
      errorsByType[errorType] = (errorsByType[errorType] || 0) + 1;

      // Count by page
      if (error.error.page) {
        const pageKey = `page${error.error.page}`;
        errorsByPage[pageKey] = (errorsByPage[pageKey] || 0) + 1;
      }

      // Count recovered errors
      if (error.recovered) {
        recoveredCount++;
      }
    });

    return {
      totalErrors: versionErrors.length,
      errorRate: (versionErrors.length / requestCount) * 100,
      errorsByType,
      errorsByPage,
      recoveryRate: versionErrors.length > 0
        ? (recoveredCount / versionErrors.length) * 100
        : 0,
    };
  }

  /**
   * Compare error rates between versions
   */
  compareVersions(): {
    v1Stats: ErrorStats;
    v2Stats: ErrorStats;
    improvement: number; // Percentage improvement in error rate
  } {
    const v1Stats = this.getStats('v1');
    const v2Stats = this.getStats('v2');

    const improvement = v1Stats.errorRate > 0
      ? ((v1Stats.errorRate - v2Stats.errorRate) / v1Stats.errorRate) * 100
      : 0;

    return {
      v1Stats,
      v2Stats,
      improvement,
    };
  }

  /**
   * Get recent errors
   */
  getRecentErrors(count: number = 10, version?: 'v1' | 'v2'): ErrorEvent[] {
    let filtered = this.errors;

    if (version) {
      filtered = filtered.filter((e) => e.version === version);
    }

    return filtered.slice(-count).reverse();
  }

  /**
   * Check if error rate is acceptable
   */
  isErrorRateAcceptable(version: 'v1' | 'v2', threshold: number = 5): boolean {
    const stats = this.getStats(version);
    return stats.errorRate <= threshold;
  }

  /**
   * Log error to console
   */
  private logError(error: ErrorEvent): void {
    console.error('PDF Generation Error:');
    console.error(`  Request ID: ${error.requestId}`);
    console.error(`  Version: ${error.version}`);
    console.error(`  Message: ${error.error.message}`);

    if (error.error.page) {
      console.error(`  Page: ${error.error.page}`);
    }

    if (error.error.stack) {
      console.error(`  Stack: ${error.error.stack}`);
    }

    console.error(`  Flags:`, error.context.flags);
  }

  /**
   * Export all errors
   */
  exportAll(): ErrorEvent[] {
    return [...this.errors];
  }

  /**
   * Clear all errors
   */
  clear(): void {
    this.errors = [];
    this.requestCount = { v1: 0, v2: 0 };
  }

  /**
   * Get error patterns (for identifying systemic issues)
   */
  getErrorPatterns(): {
    mostCommonErrors: Array<{ type: string; count: number }>;
    problematicPages: Array<{ page: number; count: number }>;
    timeDistribution: Record<string, number>; // Errors by hour of day
  } {
    const errorTypes = new Map<string, number>();
    const pageErrors = new Map<number, number>();
    const hourlyErrors = new Map<number, number>();

    this.errors.forEach((error) => {
      // Track error types
      const type = error.error.message.split(' ')[0] || 'Unknown';
      errorTypes.set(type, (errorTypes.get(type) || 0) + 1);

      // Track page errors
      if (error.error.page) {
        pageErrors.set(error.error.page, (pageErrors.get(error.error.page) || 0) + 1);
      }

      // Track hourly distribution
      const hour = new Date(error.timestamp).getHours();
      hourlyErrors.set(hour, (hourlyErrors.get(hour) || 0) + 1);
    });

    return {
      mostCommonErrors: Array.from(errorTypes.entries())
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),

      problematicPages: Array.from(pageErrors.entries())
        .map(([page, count]) => ({ page, count }))
        .sort((a, b) => b.count - a.count),

      timeDistribution: Object.fromEntries(hourlyErrors),
    };
  }
}

/**
 * Global error tracker instance
 */
export const globalErrorTracker = new ErrorTracker(
  process.env.PDF_ERROR_TRACKING !== 'false'
);
