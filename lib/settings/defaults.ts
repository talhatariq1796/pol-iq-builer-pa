/**
 * Default Settings - Phase 17.1
 *
 * Sensible defaults for all application settings.
 * These are used when settings are not found in storage or reset.
 */

import type {
  AllSettings,
  CampaignCalendarSettings,
  TargetingSettings,
  AISettings,
  DataSettings,
  MapSettings,
  OrganizationSettings,
} from './types';

// =============================================================================
// Campaign Calendar Defaults
// =============================================================================

/**
 * Default campaign calendar settings.
 * Uses 2026 Michigan election dates as defaults.
 */
export const DEFAULT_CAMPAIGN_SETTINGS: CampaignCalendarSettings = {
  // Michigan 2026 Elections
  primaryDate: '2026-08-04', // First Tuesday in August
  primaryType: 'open',
  generalElectionDate: '2026-11-03', // First Tuesday after first Monday

  // Michigan-specific deadlines (can be overridden)
  voterRegistrationDeadline: '2026-10-19', // 15 days before election
  earlyVotingStart: '2026-10-24', // 9 days before election
  earlyVotingEnd: '2026-11-02', // Day before election
  absenteeRequestDeadline: '2026-10-30', // Friday before election

  // No custom deadlines by default
  customDeadlines: [],

  // Auto-detect phase based on dates
  forcePhase: 'auto',
};

// =============================================================================
// Targeting Strategy Defaults
// =============================================================================

/**
 * Default targeting strategy settings.
 * Balanced hybrid approach suitable for most campaigns.
 */
export const DEFAULT_TARGETING_SETTINGS: TargetingSettings = {
  // Hybrid strategy balances GOTV and persuasion
  strategy: 'hybrid',

  // Balanced score weights (sum to 100)
  scoreWeights: {
    turnoutHistory: 30,
    partisanLean: 25,
    demographicFit: 25,
    donorPotential: 20,
  },

  // Conservative thresholds
  gotvMinScore: 70,
  persuasionMinScore: 40,
  swingDefinition: {
    minMargin: -10, // D+10 to R+10 is "swing"
    maxMargin: 10,
  },

  // Auto-size universe based on resources
  targetUniverseSize: 'auto',
};



// =============================================================================
// AI Assistant Defaults
// =============================================================================

/**
 * Default AI assistant settings.
 * Balanced for typical users, adjustable based on expertise.
 */
export const DEFAULT_AI_SETTINGS: AISettings = {
  // Auto-adjust verbosity based on user expertise
  responseStyle: 'auto',

  // Enable proactive help at medium frequency
  enableProactiveSuggestions: true,
  proactiveFrequency: 'medium',

  // Show helpful context by default
  showConfidenceIndicators: true,
  showDataSources: false,
  showMethodologyLinks: false,

  // Prefer fast local handlers, allow Claude for complex queries
  preferLocalHandlers: true,
  allowClaudeEscalation: true,

  // Professional tone suitable for political work
  tone: 'professional',
};

// =============================================================================
// Data & Privacy Defaults
// =============================================================================

/**
 * Default data and privacy settings.
 * Enables useful features while respecting privacy.
 */
export const DEFAULT_DATA_SETTINGS: DataSettings = {
  // Enable exploration tracking for better suggestions
  enableExplorationHistory: true,
  enableSessionMemory: true,
  sessionRetentionDays: 30, // Keep session data for 30 days

  // Enable all data sources by default
  enableDonorData: true,
  enableTapestrySegments: true,
  enableCensusData: true,

  // CSV is most portable
  defaultExportFormat: 'csv',
  includeMetadataInExports: true,
};

// =============================================================================
// Map & Visualization Defaults
// =============================================================================

/**
 * Default map and visualization settings.
 * Centered on Ingham County, MI (pilot area).
 */
export const DEFAULT_MAP_SETTINGS: MapSettings = {
  // Ingham County center (Lansing area)
  defaultCenter: [-84.55, 42.73],
  defaultZoom: 10,
  defaultMetric: 'partisan_lean',

  // Traditional Dem/Rep color scheme
  colorScheme: 'dem_rep',
  customColors: undefined,

  // Show precincts and key layers by default
  defaultVisibleLayers: ['precincts', 'municipalities'],
  showH3Hexagons: false,
  showPrecinctBoundaries: true,
};

// =============================================================================
// Organization Defaults
// =============================================================================

/**
 * Default organization settings.
 * Generic placeholders until configured.
 */
export const DEFAULT_ORGANIZATION_SETTINGS: OrganizationSettings = {
  // Generic branding
  organizationName: 'Political Analysis',
  primaryColor: '#2563eb', // Blue
  logoUrl: '',

  // Ingham County, MI as pilot
  targetState: 'MI',
  targetCounties: ['Ingham'],
  targetDistricts: [],

  // Generic report branding
  reportHeaderText: '',
  reportFooterText: 'Generated by Political Landscape Analysis Platform',
  includeOrganizationLogo: false,
};

// =============================================================================
// Combined Defaults
// =============================================================================

/**
 * All default settings combined.
 * Use this to initialize or reset settings.
 */
export const DEFAULT_SETTINGS: AllSettings = {
  appearance: {}, // Managed in-component via localStorage
  campaign: DEFAULT_CAMPAIGN_SETTINGS,
  targeting: DEFAULT_TARGETING_SETTINGS,
  ai: DEFAULT_AI_SETTINGS,
  data: DEFAULT_DATA_SETTINGS,
  map: DEFAULT_MAP_SETTINGS,
  organization: DEFAULT_ORGANIZATION_SETTINGS,
  savedSegments: {}, // Managed via SegmentStore
  // calendarWidget disabled
  team: {}, // Coming soon - team management
  vanApi: {}, // Coming soon - VAN integration
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Deep clone settings to avoid mutation.
 */
export function cloneSettings<T>(settings: T): T {
  return JSON.parse(JSON.stringify(settings));
}

/**
 * Get default value for a specific setting path.
 * @example getDefaultValue('campaign', 'primaryDate') => '2026-08-04'
 */
export function getDefaultValue<K extends keyof AllSettings>(
  category: K,
  key: keyof AllSettings[K]
): AllSettings[K][typeof key] {
  return DEFAULT_SETTINGS[category][key];
}

/**
 * Get all defaults for a category.
 */
export function getCategoryDefaults<K extends keyof AllSettings>(
  category: K
): AllSettings[K] {
  return cloneSettings(DEFAULT_SETTINGS[category]);
}
