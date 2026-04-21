import { LayerConfig } from './layers';

export type FeedbackSource = 'explicit' | 'implicit' | 'automated';

export type VisualizationType = 
  | 'choropleth'
  | 'heatmap'
  | 'cluster'
  | 'categorical'
  | 'graduated'
  | '3d-extrusion'
  | 'bivariate'
  | 'dot-density'
  | 'temporal'
  | 'relationship'
  | 'single-layer';

export interface DataCharacteristics {
  dataType: string;
  distribution: string;
  featureCount: number;
  spatialExtent?: {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
  };
  temporalExtent?: {
    start: string;
    end: string;
  };
}

export interface UserInteractionMetrics {
  timeSpent: number;
  interactionCount: number;
  exportCount: number;
  modificationCount: number;
}

export interface LearningSignal {
  score: number;
  confidence: number;
  timestamp: string;
}

export interface VisualizationFeedback {
  visualizationType: VisualizationType;
  timestamp: Date;
  userId: string;
  score: number;
  source?: FeedbackSource;
  explicitRating?: number;
  comments?: string;
  interactionMetrics: UserInteractionMetrics;
  dataCharacteristics: DataCharacteristics;
}

export interface SupportingEvidence {
  context: DataCharacteristics;
  signal: LearningSignal;
  timestamp: string;
}

export interface VisualizationPreference {
  type: VisualizationType;
  confidence: number;
  lastUsed: Date;
  successRate: number;
  score: number;
  supportingEvidence?: SupportingEvidence[];
  parameters?: {
    colorScheme?: string;
    classification?: string;
    breakCount?: number;
    opacity?: number;
    [key: string]: any;
  };
}

export interface VisualizationMetrics {
  interactionCount: number;
  averageViewDuration: number;
  clickThroughRate: number;
  feedbackScore: number;
}

export interface VisualizationLearningState {
  userPreferences: Map<string, VisualizationPreference[]>;
  globalPreferences: VisualizationPreference[];
  feedbackHistory: VisualizationFeedback[];
  confidenceScores: Map<VisualizationType, number>;
}

export interface UserProfile {
  userId: string;
  visualizationPreferences: Map<VisualizationType, VisualizationPreference>;
  devicePreferences: Map<string, Map<VisualizationType, VisualizationPreference>>;
  rolePreferences: Map<string, Map<VisualizationType, VisualizationPreference>>;
} 