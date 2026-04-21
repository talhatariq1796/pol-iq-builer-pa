/**
 * Performance Monitoring for PDF Generation
 *
 * Tracks generation times, memory usage, and file sizes.
 */

interface PerformanceMetrics {
  requestId: string;
  timestamp: number;
  version: 'v2';

  // Timing metrics (milliseconds)
  totalDuration: number;
  pageTimings: {
    page1?: number;
    page2?: number;
    page3?: number;
    page4?: number;
    page5?: number;
    page6?: number;
    page7?: number;
  };

  // Resource metrics
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };

  // Output metrics
  fileSize: number; // bytes
  pageCount: number;

  // Additional context
  dataSize?: number; // Size of input data
  complexity?: string; // 'simple' | 'medium' | 'complex'
}

export class PerformanceMonitor {
  private startTime: number = 0;
  private pageStartTimes: Map<string, number> = new Map();
  private metrics: Partial<PerformanceMetrics> = {};
  private enabled: boolean = false;

  constructor(
    private requestId: string,
    private version: 'v2',
    enabled: boolean = true
  ) {
    this.enabled = enabled;
    this.metrics = {
      requestId,
      version,
      timestamp: Date.now(),
      pageTimings: {},
    };
  }

  /**
   * Start overall performance tracking
   */
  start(): void {
    if (!this.enabled) return;

    this.startTime = performance.now();
    this.metrics.memoryUsage = this.getMemoryUsage();
  }

  /**
   * Start tracking a specific page
   */
  startPage(pageNumber: number): void {
    if (!this.enabled) return;

    const key = `page${pageNumber}`;
    this.pageStartTimes.set(key, performance.now());
  }

  /**
   * End tracking a specific page
   */
  endPage(pageNumber: number): void {
    if (!this.enabled) return;

    const key = `page${pageNumber}`;
    const startTime = this.pageStartTimes.get(key);

    if (startTime) {
      const duration = performance.now() - startTime;
      (this.metrics.pageTimings as any)[key] = Math.round(duration);
      this.pageStartTimes.delete(key);
    }
  }

  /**
   * End overall performance tracking
   */
  end(pdfBuffer: Buffer): PerformanceMetrics {
    if (!this.enabled) {
      return this.metrics as PerformanceMetrics;
    }

    const endTime = performance.now();
    const endMemory = this.getMemoryUsage();

    this.metrics.totalDuration = Math.round(endTime - this.startTime);
    this.metrics.fileSize = pdfBuffer.length;
    this.metrics.memoryUsage = endMemory;

    return this.metrics as PerformanceMetrics;
  }

  /**
   * Set additional context
   */
  setContext(context: { dataSize?: number; complexity?: string; pageCount?: number }): void {
    if (!this.enabled) return;

    Object.assign(this.metrics, context);
  }

  /**
   * Get current memory usage
   */
  private getMemoryUsage() {
    const mem = process.memoryUsage();
    return {
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      external: mem.external,
    };
  }

  /**
   * Log metrics to console (development/staging only)
   */
  log(): void {
    if (!this.enabled) return;

    console.log('PDF Generation Performance Metrics:');
    console.log(`  Request ID: ${this.metrics.requestId}`);
    console.log(`  Version: ${this.metrics.version}`);
    console.log(`  Total Duration: ${this.metrics.totalDuration}ms`);
    console.log(`  File Size: ${this.formatBytes(this.metrics.fileSize || 0)}`);
    console.log(`  Memory Used: ${this.formatBytes(this.metrics.memoryUsage?.heapUsed || 0)}`);
    console.log(`  Page Timings:`);

    Object.entries(this.metrics.pageTimings || {}).forEach(([page, duration]) => {
      console.log(`    ${page}: ${duration}ms`);
    });

  }

  /**
   * Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Export metrics for external logging/monitoring
   */
  export(): PerformanceMetrics {
    return this.metrics as PerformanceMetrics;
  }

  /**
   * Compare with another metric set (for A/B testing)
   */
  static compare(v1Metrics: PerformanceMetrics, v2Metrics: PerformanceMetrics): ComparisonResult {
    return {
      durationImprovement: this.calculateImprovement(v1Metrics.totalDuration, v2Metrics.totalDuration),
      fileSizeImprovement: this.calculateImprovement(v1Metrics.fileSize, v2Metrics.fileSize),
      memoryImprovement: this.calculateImprovement(
        v1Metrics.memoryUsage.heapUsed,
        v2Metrics.memoryUsage.heapUsed
      ),
      pageImprovements: this.comparePageTimings(v1Metrics.pageTimings, v2Metrics.pageTimings),
    };
  }

  private static calculateImprovement(baseline: number, current: number): number {
    return ((baseline - current) / baseline) * 100;
  }

  private static comparePageTimings(
    v1Timings: PerformanceMetrics['pageTimings'],
    v2Timings: PerformanceMetrics['pageTimings']
  ): Record<string, number> {
    const improvements: Record<string, number> = {};

    Object.keys(v1Timings).forEach((page) => {
      const v1Time = (v1Timings as any)[page];
      const v2Time = (v2Timings as any)[page];

      if (v1Time && v2Time) {
        improvements[page] = this.calculateImprovement(v1Time, v2Time);
      }
    });

    return improvements;
  }
}

interface ComparisonResult {
  durationImprovement: number; // Percentage improvement (positive = faster)
  fileSizeImprovement: number; // Percentage improvement (positive = smaller)
  memoryImprovement: number;   // Percentage improvement (positive = less memory)
  pageImprovements: Record<string, number>; // Per-page improvements
}

/**
 * Aggregate metrics collector for analytics
 */
export class MetricsAggregator {
  private metrics: PerformanceMetrics[] = [];
  private maxSize: number = 1000;

  add(metric: PerformanceMetrics): void {
    this.metrics.push(metric);

    // Keep only recent metrics
    if (this.metrics.length > this.maxSize) {
      this.metrics = this.metrics.slice(-this.maxSize);
    }
  }

  /**
   * Get average metrics by version
   */
  getAverages(version: 'v1' | 'v2'): Partial<PerformanceMetrics> {
    const versionMetrics = this.metrics.filter((m) => m.version === version);

    if (versionMetrics.length === 0) {
      return {};
    }

    const avg = {
      totalDuration: this.average(versionMetrics.map((m) => m.totalDuration)),
      fileSize: this.average(versionMetrics.map((m) => m.fileSize)),
      memoryUsage: {
        heapUsed: this.average(versionMetrics.map((m) => m.memoryUsage.heapUsed)),
        heapTotal: this.average(versionMetrics.map((m) => m.memoryUsage.heapTotal)),
        external: this.average(versionMetrics.map((m) => m.memoryUsage.external)),
      },
    };

    return avg;
  }

  private average(numbers: number[]): number {
    return numbers.reduce((a, b) => a + b, 0) / numbers.length;
  }

  /**
   * Export all metrics
   */
  exportAll(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = [];
  }
}
