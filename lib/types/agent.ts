export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ConversationContext {
  conversationHistory: ConversationMessage[];
  lastQuery?: string;
  lastResults?: __esri.Graphic[];
}

export interface AnalysisData {
  features: __esri.Graphic[];
  statistics?: Record<string, number>;
  query?: string;
  analysis?: any;
}

export interface AgentResponse {
  response: string;
  data?: __esri.Graphic[];
  statistics?: Record<string, number>;
  error?: string;
}

export interface QueryStatistics {
  min_value?: number;
  max_value?: number;
  avg_value?: number;
  count?: number;
}

export interface QueryResult {
  features: __esri.Graphic[];
  statistics?: QueryStatistics;
}

// ArcGIS specific types
export interface FeatureAttributes {
  thematic_value: number;
  admin4_name: string;
  admin3_name: string;
  [key: string]: any;
}

export interface QueryOptions {
  whereClause?: string;
  outFields?: string[];
  returnGeometry?: boolean;
  returnStatistics?: boolean;
}

export type NLPResponse = {
  sql: string;
  response: string;
};