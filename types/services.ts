// src/types/services.ts

export interface ServiceConfig {
    id: string;
    url: string;
    type: 'feature' | 'map' | 'image';
    useProxy?: boolean;
    apiKey?: string;
  }
  
  export interface ServiceState {
    isAvailable: boolean;
    lastCheck: Date;
    responseTime?: number;
    error?: string;
  }
  
  export interface ServiceRegistry {
    register(service: ServiceConfig): void;
    unregister(serviceId: string): void;
    getService(serviceId: string): ServiceConfig | undefined;
    getServiceState(serviceId: string): ServiceState;
  }
  
  export interface APIGateway {
    request<T>(
      serviceId: string,
      endpoint: string,
      options?: RequestInit
    ): Promise<T>;
    
    checkHealth(serviceId: string): Promise<ServiceState>;
  }
  
  export interface LoadBalancer {
    getEndpoint(serviceId: string): Promise<string>;
    updateHealth(serviceId: string, health: ServiceState): void;
  }
  
  export interface CircuitBreaker {
    isOpen(serviceId: string): boolean;
    recordSuccess(serviceId: string): void;
    recordFailure(serviceId: string): void;
    reset(serviceId: string): void;
  }
  
  export interface RetryStrategy {
    shouldRetry(attempt: number, error: Error): boolean;
    getDelay(attempt: number): number;
  }
  
  export interface ServiceMonitor {
    startMonitoring(service: ServiceConfig): void;
    stopMonitoring(serviceId: string): void;
    getMetrics(serviceId: string): ServiceMetrics;
  }
  
  export interface ServiceMetrics {
    uptime: number;
    responseTime: {
      avg: number;
      min: number;
      max: number;
    };
    errorRate: number;
    requestCount: number;
    lastError?: {
      timestamp: Date;
      message: string;
    };
  }