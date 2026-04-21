/**
 * ErrorRecovery - Intelligent error recovery and retry system
 * 
 * Features:
 * - Exponential backoff with jitter
 * - Circuit breaker pattern
 * - Error classification and handling
 * - Retry policies per endpoint
 * - Graceful degradation strategies
 */
export class ErrorRecovery {
  private retryPolicies: Map<string, RetryPolicy> = new Map();
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private errorHistory: ErrorHistoryEntry[] = [];
  private config: ErrorRecoveryConfig;

  constructor(config: Partial<ErrorRecoveryConfig> = {}) {
    this.config = {
      maxRetries: config.maxRetries || 3,
      baseDelay: config.baseDelay || 1000, // 1 second
      maxDelay: config.maxDelay || 30000, // 30 seconds
      jitterFactor: config.jitterFactor || 0.1,
      circuitBreakerThreshold: config.circuitBreakerThreshold || 5,
      circuitBreakerTimeout: config.circuitBreakerTimeout || 60000, // 1 minute
      errorHistorySize: config.errorHistorySize || 1000
    };

    this.initializeRetryPolicies();
  }

  /**
   * Execute request with error recovery
   */
  async executeWithRecovery<T>(
    key: string,
    operation: () => Promise<T>,
    options: RecoveryOptions = {}
  ): Promise<T> {
    const policy = this.getRetryPolicy(key);
    const circuitBreaker = this.getCircuitBreaker(key);

    // Check circuit breaker state
    if (circuitBreaker.isOpen()) {
      const error = new Error(`Circuit breaker is open for ${key}`);
      this.recordError(key, error, 'circuit_breaker_open');
      throw error;
    }

    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt <= policy.maxRetries) {
      try {
        // Record attempt
        if (attempt > 0) {
          console.log(`[ErrorRecovery] Retry attempt ${attempt} for ${key}`);
        }

        const result = await operation();
        
        // Success - reset circuit breaker
        circuitBreaker.recordSuccess();
        
        if (attempt > 0) {
          console.log(`[ErrorRecovery] Recovery successful for ${key} after ${attempt} attempts`);
        }
        
        return result;

      } catch (error) {
        lastError = error as Error;
        attempt++;

        // Record failure
        circuitBreaker.recordFailure();
        this.recordError(key, lastError, this.classifyError(lastError));

        // Check if we should retry
        if (!this.shouldRetry(lastError, attempt, policy)) {
          break;
        }

        // Apply graceful degradation if available
        if (options.fallbackStrategy) {
          try {
            const fallbackResult = await this.applyFallbackStrategy<T>(key, lastError, options.fallbackStrategy);
            console.log(`[ErrorRecovery] Fallback strategy succeeded for ${key}`);
            return fallbackResult;
          } catch (fallbackError) {
            console.warn(`[ErrorRecovery] Fallback strategy failed for ${key}:`, fallbackError);
          }
        }

        // Wait before retry
        if (attempt <= policy.maxRetries) {
          const delay = this.calculateDelay(attempt, policy);
          console.log(`[ErrorRecovery] Waiting ${delay}ms before retry ${attempt} for ${key}`);
          await this.delay(delay);
        }
      }
    }

    // All retries exhausted
    const finalError = new Error(`All ${policy.maxRetries} retry attempts failed for ${key}. Last error: ${lastError?.message}`);
    this.recordError(key, finalError, 'retry_exhausted');
    throw finalError;
  }

  /**
   * Get error recovery statistics
   */
  getErrorStats(key?: string): ErrorStats {
    const relevantErrors = key 
      ? this.errorHistory.filter(e => e.key === key)
      : this.errorHistory;

    const now = Date.now();
    const lastHour = relevantErrors.filter(e => now - e.timestamp < 3600000);
    const lastDay = relevantErrors.filter(e => now - e.timestamp < 86400000);

    const errorTypes = new Map<string, number>();
    relevantErrors.forEach(e => {
      errorTypes.set(e.type, (errorTypes.get(e.type) || 0) + 1);
    });

    return {
      totalErrors: relevantErrors.length,
      errorsLastHour: lastHour.length,
      errorsLastDay: lastDay.length,
      errorTypes: Object.fromEntries(errorTypes),
      circuitBreakerStates: this.getCircuitBreakerStates(),
      avgRetryCount: this.calculateAverageRetryCount(relevantErrors)
    };
  }

  /**
   * Reset circuit breaker for a specific key
   */
  resetCircuitBreaker(key: string): void {
    const circuitBreaker = this.circuitBreakers.get(key);
    if (circuitBreaker) {
      circuitBreaker.reset();
      console.log(`[ErrorRecovery] Circuit breaker reset for ${key}`);
    }
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus(key: string): CircuitBreakerStatus {
    const circuitBreaker = this.circuitBreakers.get(key);
    if (!circuitBreaker) {
      return { state: 'closed', failureCount: 0, lastFailure: null };
    }

    return {
      state: circuitBreaker.getState(),
      failureCount: circuitBreaker.getFailureCount(),
      lastFailure: circuitBreaker.getLastFailureTime()
    };
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private initializeRetryPolicies(): void {
    // Configure retry policies for different endpoint types
    this.retryPolicies.set('/analyze', {
      maxRetries: 3,
      retryableErrors: ['timeout', 'server_error', 'rate_limit'],
      exponentialBackoff: true,
      jitter: true
    });

    this.retryPolicies.set('/spatial-clusters', {
      maxRetries: 2, // Expensive operation, fewer retries
      retryableErrors: ['timeout', 'server_error'],
      exponentialBackoff: true,
      jitter: true
    });

    this.retryPolicies.set('/competitive-analysis', {
      maxRetries: 4, // More dynamic data, more retries
      retryableErrors: ['timeout', 'server_error', 'rate_limit', 'network_error'],
      exponentialBackoff: true,
      jitter: true
    });

    // Default policy
    this.retryPolicies.set('default', {
      maxRetries: this.config.maxRetries,
      retryableErrors: ['timeout', 'server_error', 'rate_limit', 'network_error'],
      exponentialBackoff: true,
      jitter: true
    });
  }

  private getRetryPolicy(key: string): RetryPolicy {
    return this.retryPolicies.get(key) || this.retryPolicies.get('default')!;
  }

  private getCircuitBreaker(key: string): CircuitBreaker {
    if (!this.circuitBreakers.has(key)) {
      this.circuitBreakers.set(key, new CircuitBreaker({
        threshold: this.config.circuitBreakerThreshold,
        timeout: this.config.circuitBreakerTimeout
      }));
    }
    return this.circuitBreakers.get(key)!;
  }

  private shouldRetry(error: Error, attempt: number, policy: RetryPolicy): boolean {
    if (attempt > policy.maxRetries) return false;

    const errorType = this.classifyError(error);
    return policy.retryableErrors.includes(errorType);
  }

  private classifyError(error: Error): ErrorType {
    const message = error.message.toLowerCase();
    
    if (message.includes('timeout') || message.includes('timed out')) {
      return 'timeout';
    }
    
    if (message.includes('network') || message.includes('connection')) {
      return 'network_error';
    }
    
    if (message.includes('rate limit') || message.includes('too many requests')) {
      return 'rate_limit';
    }
    
    if (message.includes('500') || message.includes('internal server error')) {
      return 'server_error';
    }
    
    if (message.includes('400') || message.includes('bad request')) {
      return 'client_error';
    }
    
    if (message.includes('401') || message.includes('unauthorized')) {
      return 'auth_error';
    }
    
    if (message.includes('404') || message.includes('not found')) {
      return 'not_found';
    }

    return 'unknown_error';
  }

  private calculateDelay(attempt: number, policy: RetryPolicy): number {
    let delay = this.config.baseDelay;

    if (policy.exponentialBackoff) {
      delay = this.config.baseDelay * Math.pow(2, attempt - 1);
    }

    // Apply jitter to prevent thundering herd
    if (policy.jitter) {
      const jitter = delay * this.config.jitterFactor * Math.random();
      delay += jitter;
    }

    return Math.min(delay, this.config.maxDelay);
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private recordError(key: string, error: Error, type: ErrorType): void {
    const entry: ErrorHistoryEntry = {
      key,
      error: error.message,
      type,
      timestamp: Date.now()
    };

    this.errorHistory.push(entry);

    // Maintain history size limit
    if (this.errorHistory.length > this.config.errorHistorySize) {
      this.errorHistory.shift();
    }
  }

  private async applyFallbackStrategy<T>(
    key: string, 
    error: Error, 
    strategy: FallbackStrategy
  ): Promise<T> {
    switch (strategy.type) {
      case 'cached_response':
        if (!strategy.getCachedResponse) {
          throw new Error('getCachedResponse method not provided for cached_response strategy');
        }
        return strategy.getCachedResponse(key);
      
      case 'default_response':
        if (!strategy.getDefaultResponse) {
          throw new Error('getDefaultResponse method not provided for default_response strategy');
        }
        return strategy.getDefaultResponse(key);
      
      case 'alternative_endpoint':
        if (!strategy.callAlternativeEndpoint) {
          throw new Error('callAlternativeEndpoint method not provided for alternative_endpoint strategy');
        }
        return strategy.callAlternativeEndpoint(key, error);
      
      case 'degraded_service':
        if (!strategy.provideDegradedService) {
          throw new Error('provideDegradedService method not provided for degraded_service strategy');
        }
        return strategy.provideDegradedService(key, error);
      
      default:
        throw new Error(`Unknown fallback strategy: ${strategy.type}`);
    }
  }

  private getCircuitBreakerStates(): Record<string, string> {
    const states: Record<string, string> = {};
    
    Array.from(this.circuitBreakers.entries()).forEach(([key, circuitBreaker]) => {
      states[key] = circuitBreaker.getState();
    });
    
    return states;
  }

  private calculateAverageRetryCount(errors: ErrorHistoryEntry[]): number {
    if (errors.length === 0) return 0;
    
    // Group errors by similar timestamps (likely same operation)
    const operations = new Map<string, number>();
    
    errors.forEach(error => {
      const opKey = `${error.key}_${Math.floor(error.timestamp / 1000)}`; // Group by second
      operations.set(opKey, (operations.get(opKey) || 0) + 1);
    });
    
    const retryCounts = Array.from(operations.values());
    return retryCounts.reduce((sum, count) => sum + (count - 1), 0) / retryCounts.length;
  }
}

// ============================================================================
// CIRCUIT BREAKER IMPLEMENTATION
// ============================================================================

class CircuitBreaker {
  private state: CircuitBreakerState = 'closed';
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private config: CircuitBreakerConfig;

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
  }

  isOpen(): boolean {
    if (this.state === 'open') {
      // Check if timeout period has passed
      if (Date.now() - this.lastFailureTime > this.config.timeout) {
        this.state = 'half-open';
        console.log('[CircuitBreaker] Transitioning to half-open state');
      }
    }
    
    return this.state === 'open';
  }

  recordSuccess(): void {
    this.failureCount = 0;
    this.state = 'closed';
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.config.threshold) {
      this.state = 'open';
      console.log(`[CircuitBreaker] Circuit breaker opened after ${this.failureCount} failures`);
    }
  }

  reset(): void {
    this.failureCount = 0;
    this.state = 'closed';
    this.lastFailureTime = 0;
  }

  getState(): CircuitBreakerState {
    return this.state;
  }

  getFailureCount(): number {
    return this.failureCount;
  }

  getLastFailureTime(): number | null {
    return this.lastFailureTime || null;
  }
}

// ============================================================================
// INTERFACES AND TYPES
// ============================================================================

interface ErrorRecoveryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  jitterFactor: number;
  circuitBreakerThreshold: number;
  circuitBreakerTimeout: number;
  errorHistorySize: number;
}

interface RetryPolicy {
  maxRetries: number;
  retryableErrors: ErrorType[];
  exponentialBackoff: boolean;
  jitter: boolean;
}

interface RecoveryOptions {
  fallbackStrategy?: FallbackStrategy;
  priority?: 'high' | 'normal' | 'low';
}

interface FallbackStrategy {
  type: 'cached_response' | 'default_response' | 'alternative_endpoint' | 'degraded_service';
  getCachedResponse?: (key: string) => Promise<any>;
  getDefaultResponse?: (key: string) => Promise<any>;
  callAlternativeEndpoint?: (key: string, error: Error) => Promise<any>;
  provideDegradedService?: (key: string, error: Error) => Promise<any>;
}

interface ErrorHistoryEntry {
  key: string;
  error: string;
  type: ErrorType;
  timestamp: number;
}

interface ErrorStats {
  totalErrors: number;
  errorsLastHour: number;
  errorsLastDay: number;
  errorTypes: Record<string, number>;
  circuitBreakerStates: Record<string, string>;
  avgRetryCount: number;
}

interface CircuitBreakerConfig {
  threshold: number;
  timeout: number;
}

interface CircuitBreakerStatus {
  state: CircuitBreakerState;
  failureCount: number;
  lastFailure: number | null;
}

type ErrorType = 
  | 'timeout' 
  | 'network_error' 
  | 'rate_limit' 
  | 'server_error' 
  | 'client_error' 
  | 'auth_error' 
  | 'not_found' 
  | 'circuit_breaker_open' 
  | 'retry_exhausted' 
  | 'unknown_error';

type CircuitBreakerState = 'open' | 'closed' | 'half-open'; 