// src/types/metrics.ts

export interface ProcessingMetrics {
    traditionalDuration: number;
    aiDuration: number;
    integrationDuration: number;
    totalDuration: number;
  }
  
  export interface AnalysisMetrics {
    accuracy: number;
    confidence: number;
    processingTime: number;
    dataPoints: number;
    timestamp: number;
  }
  
  export type AgentType = 'visualization' | 'customerInsights' | 'marketAnalysis' | 'siteAnalysis';
  
  export interface AgentResponse {
    type: AgentType;
    result: any;
    confidence: number;
    metadata?: {
      source?: string[];
      confidence?: number;
      processingTime?: number;
    };
  }
  
  export interface AIProcessingResult {
    insights: string[];
    patterns: any[];
    confidence: number;
    processingDuration: number;
    agentResponses: AgentResponse[];
    confidenceScores: Record<AgentType, number>;
    trends: Record<string, any>;
    processingTime: number;
    usedAgents: AgentType[];
  }
  
  export interface Query {
    type: string;
    data: any;
    complexity: number;
    spatialIntensity: number;
    requiresPrecision?: boolean;
    requiresAgents?: AgentType[];
    parameters?: Record<string, any>;
  }