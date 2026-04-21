/**
 * RequestBatcher - Intelligent request batching and queuing system
 * 
 * Features:
 * - Batches similar requests together
 * - Implements request deduplication
 * - Queue management with priority levels
 * - Adaptive batching based on system load
 * - Request coalescing for identical queries
 */
export class RequestBatcher {
  private requestQueue: Map<string, BatchedRequest[]> = new Map();
  private activeBatches: Map<string, Promise<any>> = new Map();
  private batchTimers: Map<string, NodeJS.Timeout> = new Map();
  private config: BatchConfig;
  private metrics: BatchMetrics;

  constructor(config: Partial<BatchConfig> = {}) {
    this.config = {
      maxBatchSize: config.maxBatchSize || 5,
      batchTimeout: config.batchTimeout || 100, // 100ms
      maxConcurrentBatches: config.maxConcurrentBatches || 3,
      priorityLevels: config.priorityLevels || ['high', 'normal', 'low'],
      adaptiveBatching: config.adaptiveBatching !== false
    };

    this.metrics = {
      totalRequests: 0,
      batchedRequests: 0,
      deduplicatedRequests: 0,
      avgBatchSize: 0,
      avgWaitTime: 0
    };
  }

  /**
   * Add request to batch queue
   */
  async addRequest<T>(
    batchKey: string, 
    request: BatchableRequest, 
    priority: Priority = 'normal'
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const batchedRequest: BatchedRequest = {
        id: this.generateRequestId(),
        request,
        priority,
        resolve,
        reject,
        createdAt: Date.now()
      };

      this.metrics.totalRequests++;

      // Check for existing identical request (deduplication)
      const existingRequest = this.findDuplicateRequest(batchKey, request);
      if (existingRequest) {
        this.metrics.deduplicatedRequests++;
        // Attach to existing request
        existingRequest.resolve = (result: any) => {
          resolve(result);
          existingRequest.resolve(result);
        };
        return;
      }

      // Add to queue
      if (!this.requestQueue.has(batchKey)) {
        this.requestQueue.set(batchKey, []);
      }

      const queue = this.requestQueue.get(batchKey)!;
      
      // Insert by priority
      const insertIndex = this.findInsertionIndex(queue, priority);
      queue.splice(insertIndex, 0, batchedRequest);

      // Check if we should process immediately
      if (this.shouldProcessImmediately(batchKey)) {
        this.processBatch(batchKey);
      } else {
        this.scheduleBatchProcessing(batchKey);
      }
    });
  }

  /**
   * Process a batch of requests
   */
  private async processBatch(batchKey: string): Promise<void> {
    const queue = this.requestQueue.get(batchKey);
    if (!queue || queue.length === 0) return;

    // Clear any pending timer
    const timer = this.batchTimers.get(batchKey);
    if (timer) {
      clearTimeout(timer);
      this.batchTimers.delete(batchKey);
    }

    // Extract batch to process
    const batchSize = Math.min(queue.length, this.config.maxBatchSize);
    const batch = queue.splice(0, batchSize);
    
    if (batch.length === 0) return;

    this.metrics.batchedRequests += batch.length;
    this.updateAverageBatchSize(batch.length);

    // Check if there's already an active batch for this key
    if (this.activeBatches.has(batchKey)) {
      // Wait for current batch to complete, then retry
      try {
        await this.activeBatches.get(batchKey);
      } catch (error) {
        // Continue with new batch even if previous failed
      }
    }

    // Process the batch
    const batchPromise = this.executeBatch(batchKey, batch);
    this.activeBatches.set(batchKey, batchPromise);

    try {
      await batchPromise;
    } finally {
      this.activeBatches.delete(batchKey);
      
      // Process remaining items if any
      if (queue.length > 0) {
        setImmediate(() => this.processBatch(batchKey));
      }
    }
  }

  /**
   * Execute a batch of requests
   */
  private async executeBatch(batchKey: string, batch: BatchedRequest[]): Promise<void> {
    const startTime = Date.now();

    try {
      // Determine batch execution strategy
      const strategy = this.getBatchStrategy(batchKey, batch);
      
      let results: any[];
      
      switch (strategy) {
        case 'parallel':
          results = await this.executeParallel(batch);
          break;
        case 'sequential':
          results = await this.executeSequential(batch);
          break;
        case 'combined':
          results = await this.executeCombined(batch);
          break;
        default:
          results = await this.executeParallel(batch);
      }

      // Resolve individual requests
      batch.forEach((batchedRequest, index) => {
        const waitTime = Date.now() - batchedRequest.createdAt;
        this.updateAverageWaitTime(waitTime);
        
        if (results[index] instanceof Error) {
          batchedRequest.reject(results[index]);
        } else {
          batchedRequest.resolve(results[index]);
        }
      });

    } catch (error) {
      // Reject all requests in batch
      batch.forEach(batchedRequest => {
        batchedRequest.reject(error);
      });
    }

    console.log(`[RequestBatcher] Processed batch of ${batch.length} requests in ${Date.now() - startTime}ms`);
  }

  /**
   * Execute requests in parallel
   */
  private async executeParallel(batch: BatchedRequest[]): Promise<any[]> {
    const promises = batch.map(async (batchedRequest) => {
      try {
        return await this.executeRequest(batchedRequest.request);
      } catch (error) {
        return error;
      }
    });

    return Promise.all(promises);
  }

  /**
   * Execute requests sequentially
   */
  private async executeSequential(batch: BatchedRequest[]): Promise<any[]> {
    const results: any[] = [];

    for (const batchedRequest of batch) {
      try {
        const result = await this.executeRequest(batchedRequest.request);
        results.push(result);
      } catch (error) {
        results.push(error);
      }
    }

    return results;
  }

  /**
   * Execute requests as a combined batch (single API call)
   */
  private async executeCombined(batch: BatchedRequest[]): Promise<any[]> {
    try {
      // Combine requests into single payload
      const combinedPayload = this.combineRequests(batch.map(b => b.request));
      
      // Execute combined request
      const combinedResult = await this.executeRequest({
        endpoint: batch[0].request.endpoint,
        payload: combinedPayload,
        options: batch[0].request.options
      });

      // Split result back to individual responses
      return this.splitCombinedResult(combinedResult, batch.length);
      
    } catch (error) {
      // Return error for all requests
      return new Array(batch.length).fill(error);
    }
  }

  /**
   * Execute a single request
   */
  private async executeRequest(request: BatchableRequest): Promise<any> {
    // This would integrate with your API client
    // For now, simulate with a delay
    await new Promise(resolve => setTimeout(resolve, 50));
    
    return {
      endpoint: request.endpoint,
      payload: request.payload,
      timestamp: Date.now(),
      batchId: 'simulated'
    };
  }

  /**
   * Determine optimal batch execution strategy
   */
  private getBatchStrategy(batchKey: string, batch: BatchedRequest[]): BatchStrategy {
    // Analyze request patterns to determine best strategy
    const endpoint = batch[0]?.request.endpoint;
    
    // High-load endpoints benefit from parallel execution
    if (endpoint?.includes('cluster') || endpoint?.includes('competitive')) {
      return batch.length <= 3 ? 'parallel' : 'sequential';
    }
    
    // Similar requests can be combined
    if (this.canCombineRequests(batch)) {
      return 'combined';
    }
    
    return 'parallel';
  }

  /**
   * Check if requests can be combined into single API call
   */
  private canCombineRequests(batch: BatchedRequest[]): boolean {
    if (batch.length <= 1) return false;
    
    const firstRequest = batch[0].request;
    
    // All requests must be for same endpoint
    return batch.every(b => 
      b.request.endpoint === firstRequest.endpoint &&
      this.isSimilarPayload(b.request.payload, firstRequest.payload)
    );
  }

  /**
   * Check if payloads are similar enough to combine
   */
  private isSimilarPayload(payload1: any, payload2: any): boolean {
    // Simple similarity check - same target variable and sample size
    return payload1.target_variable === payload2.target_variable &&
           payload1.sample_size === payload2.sample_size;
  }

  /**
   * Combine multiple requests into single payload
   */
  private combineRequests(requests: BatchableRequest[]): any {
    const basePayload = requests[0].payload;
    
    return {
      ...basePayload,
      batch_mode: true,
      batch_size: requests.length,
      combined_requests: requests.map(r => r.payload)
    };
  }

  /**
   * Split combined result back to individual responses
   */
  private splitCombinedResult(combinedResult: any, batchSize: number): any[] {
    if (combinedResult.batch_results) {
      return combinedResult.batch_results;
    }
    
    // Fallback: return same result for all requests
    return new Array(batchSize).fill(combinedResult);
  }

  /**
   * Find duplicate request for deduplication
   */
  private findDuplicateRequest(batchKey: string, request: BatchableRequest): BatchedRequest | null {
    const queue = this.requestQueue.get(batchKey);
    if (!queue) return null;
    
    return queue.find(existing => 
      existing.request.endpoint === request.endpoint &&
      JSON.stringify(existing.request.payload) === JSON.stringify(request.payload)
    ) || null;
  }

  /**
   * Find insertion index based on priority
   */
  private findInsertionIndex(queue: BatchedRequest[], priority: Priority): number {
    const priorityValue = this.getPriorityValue(priority);
    
    for (let i = 0; i < queue.length; i++) {
      if (this.getPriorityValue(queue[i].priority) < priorityValue) {
        return i;
      }
    }
    
    return queue.length;
  }

  /**
   * Get numeric priority value (higher = more important)
   */
  private getPriorityValue(priority: Priority): number {
    switch (priority) {
      case 'high': return 3;
      case 'normal': return 2;
      case 'low': return 1;
      default: return 2;
    }
  }

  /**
   * Check if batch should be processed immediately
   */
  private shouldProcessImmediately(batchKey: string): boolean {
    const queue = this.requestQueue.get(batchKey);
    if (!queue) return false;
    
    // Process immediately if:
    // 1. Queue is full
    // 2. High priority requests exist
    // 3. System is under low load
    
    const hasHighPriority = queue.some(r => r.priority === 'high');
    const queueFull = queue.length >= this.config.maxBatchSize;
    const lowLoad = this.activeBatches.size < this.config.maxConcurrentBatches;
    
    return queueFull || (hasHighPriority && lowLoad);
  }

  /**
   * Schedule batch processing after timeout
   */
  private scheduleBatchProcessing(batchKey: string): void {
    if (this.batchTimers.has(batchKey)) return;
    
    const timer = setTimeout(() => {
      this.batchTimers.delete(batchKey);
      this.processBatch(batchKey);
    }, this.config.batchTimeout);
    
    this.batchTimers.set(batchKey, timer);
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update average batch size metric
   */
  private updateAverageBatchSize(size: number): void {
    const totalBatches = Math.floor(this.metrics.batchedRequests / this.metrics.avgBatchSize) || 1;
    this.metrics.avgBatchSize = ((this.metrics.avgBatchSize * (totalBatches - 1)) + size) / totalBatches;
  }

  /**
   * Update average wait time metric
   */
  private updateAverageWaitTime(waitTime: number): void {
    const count = this.metrics.totalRequests;
    this.metrics.avgWaitTime = ((this.metrics.avgWaitTime * (count - 1)) + waitTime) / count;
  }

  /**
   * Get batching metrics
   */
  getMetrics(): BatchMetrics {
    return { ...this.metrics };
  }

  /**
   * Clear all pending requests and timers
   */
  clear(): void {
    // Clear all timers
    this.batchTimers.forEach(timer => clearTimeout(timer));
    this.batchTimers.clear();
    
    // Reject all pending requests
    this.requestQueue.forEach(queue => {
      queue.forEach(request => {
        request.reject(new Error('Request batch cleared'));
      });
    });
    
    this.requestQueue.clear();
    this.activeBatches.clear();
  }
}

// ============================================================================
// INTERFACES AND TYPES
// ============================================================================

interface BatchableRequest {
  endpoint: string;
  payload: any;
  options?: any;
}

interface BatchedRequest {
  id: string;
  request: BatchableRequest;
  priority: Priority;
  resolve: (result: any) => void;
  reject: (error: any) => void;
  createdAt: number;
}

interface BatchConfig {
  maxBatchSize: number;
  batchTimeout: number;
  maxConcurrentBatches: number;
  priorityLevels: string[];
  adaptiveBatching: boolean;
}

interface BatchMetrics {
  totalRequests: number;
  batchedRequests: number;
  deduplicatedRequests: number;
  avgBatchSize: number;
  avgWaitTime: number;
}

type Priority = 'high' | 'normal' | 'low';
type BatchStrategy = 'parallel' | 'sequential' | 'combined'; 