/**
 * Settings Types - Phase 17.1
 *
 * Comprehensive type definitions for all application settings.
 * Settings are organized into 7 categories for user configuration.
 */

// =============================================================================
// Campaign Phase Types
// =============================================================================

export type CampaignPhase =
  | 'pre_primary'        // ID and persuasion focus
  | 'primary_gotv'       // Base mobilization
  | 'general_id'         // Expand universe, persuasion
  | 'general_persuasion' // Swing voter focus
  | 'general_gotv'       // Final mobilization
  | 'post_election';     // Analysis and retention

export type PrimaryType = 'open' | 'closed' | 'semi-closed' | 'caucus';

// =============================================================================
// 17.1 Campaign Calendar Settings
// =============================================================================

export interface CustomDeadline {
  id: string;
  name: string;
  date: string; // ISO date string for serialization
  alertDaysBefore: number;
}

export interface CampaignCalendarSettings {
  // Elections
  primaryDate: string | null;
  primaryType: PrimaryType;
  generalElectionDate: string;

  // Key deadlines (auto-calculated but overridable)
  voterRegistrationDeadline: string;
  earlyVotingStart: string | null;
  earlyVotingEnd: string | null;
  absenteeRequestDeadline: string | null;

  // Custom deadlines
  customDeadlines: CustomDeadline[];

  // Phase control
  forcePhase: CampaignPhase | 'auto';
}

// =============================================================================
// 17.2 Targeting Strategy Settings
// =============================================================================

export type TargetingStrategy = 'gotv' | 'persuasion' | 'hybrid';

export interface ScoreWeights {
  turnoutHistory: number;
  partisanLean: number;
  demographicFit: number;
  donorPotential: number;
}

export interface SwingDefinition {
  minMargin: number; // Default: -10
  maxMargin: number; // Default: +10
}

export interface TargetingSettings {
  // Primary strategy
  strategy: TargetingStrategy;

  // Score weights (0-100, should sum to 100)
  scoreWeights: ScoreWeights;

  // Thresholds
  gotvMinScore: number;        // Default: 70
  persuasionMinScore: number;  // Default: 40
  swingDefinition: SwingDefinition;

  // Universe sizing
  targetUniverseSize: number | 'auto';
}

// =============================================================================

// =============================================================================
// 17.4 AI Assistant Settings
// =============================================================================

export type ResponseStyle = 'concise' | 'detailed' | 'auto';
export type ProactiveFrequency = 'low' | 'medium' | 'high';
export type AITone = 'professional' | 'casual' | 'urgent';

export interface AISettings {
  // Verbosity
  responseStyle: ResponseStyle;

  // Proactive behavior
  enableProactiveSuggestions: boolean;
  proactiveFrequency: ProactiveFrequency;

  // Display options
  showConfidenceIndicators: boolean;
  showDataSources: boolean;
  showMethodologyLinks: boolean;

  // Processing
  preferLocalHandlers: boolean;
  allowClaudeEscalation: boolean;

  // Personality
  tone: AITone;
}

// =============================================================================
// 17.5 Data & Privacy Settings
// =============================================================================

export type ExportFormat = 'csv' | 'xlsx' | 'pdf';

export interface DataSettings {
  // Session tracking
  enableExplorationHistory: boolean;
  enableSessionMemory: boolean;
  sessionRetentionDays: number;

  // Data sources
  enableDonorData: boolean;
  enableTapestrySegments: boolean;
  enableCensusData: boolean;

  // Export preferences
  defaultExportFormat: ExportFormat;
  includeMetadataInExports: boolean;
}

// =============================================================================
// 17.6 Map & Visualization Settings
// =============================================================================

export type ColorScheme = 'dem_rep' | 'viridis' | 'custom';

export interface CustomColors {
  low: string;
  mid: string;
  high: string;
}

export interface MapSettings {
  // Default view
  defaultCenter: [number, number];
  defaultZoom: number;
  defaultMetric: string;

  // Color schemes
  colorScheme: ColorScheme;
  customColors?: CustomColors;

  // Layers
  defaultVisibleLayers: string[];
  showH3Hexagons: boolean;
  showPrecinctBoundaries: boolean;
}

// =============================================================================
// 17.7 Organization Settings
// =============================================================================

export interface OrganizationSettings {
  // Branding
  organizationName: string;
  primaryColor: string;
  logoUrl: string;

  // Geography
  targetState: string;
  targetCounties: string[];
  targetDistricts: string[];

  // Reports
  reportHeaderText: string;
  reportFooterText: string;
  includeOrganizationLogo: boolean;
}

// =============================================================================
// Combined Settings
// =============================================================================

export interface AllSettings {
  appearance: Record<string, never>; // Appearance settings managed in-component (localStorage)
  campaign: CampaignCalendarSettings;
  targeting: TargetingSettings;
  ai: AISettings;
  data: DataSettings;
  map: MapSettings;
  organization: OrganizationSettings;
  savedSegments: Record<string, never>; // Placeholder - actual management via SegmentStore
  // calendarWidget disabled - use Campaign settings to view/configure dates
  team: Record<string, never>; // Coming soon - team management
  vanApi: Record<string, never>; // Coming soon - VAN integration
}

// =============================================================================
// Settings Version & Persistence
// =============================================================================

export interface PersistedSettings {
  version: number;
  lastModified: string;
  settings: AllSettings;
}

export const SETTINGS_VERSION = 1;
export const SETTINGS_STORAGE_KEY = 'pol-settings';

// =============================================================================
// Settings Event Types
// =============================================================================

export type SettingsCategory = keyof AllSettings;

export interface SettingsChangeEvent {
  category: SettingsCategory;
  key: string;
  oldValue: unknown;
  newValue: unknown;
  timestamp: Date;
}

// =============================================================================
// Computed Campaign State
// =============================================================================

export interface CampaignState {
  currentPhase: CampaignPhase;
  daysUntilElection: number;
  daysUntilPrimary: number | null;
  nextDeadline: {
    name: string;
    date: Date;
    daysRemaining: number;
  } | null;
  upcomingDeadlines: Array<{
    name: string;
    date: Date;
    daysRemaining: number;
    isUrgent: boolean; // <= 7 days
  }>;
  phaseProgress: number; // 0-100 within current phase
}
