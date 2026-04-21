/**
 * Settings Validation - Phase 17.1
 *
 * Zod schemas for validating all settings.
 * Used for form validation and import validation.
 */

import { z } from 'zod';

// =============================================================================
// Helper Schemas
// =============================================================================

const dateStringSchema = z.string().regex(
  /^\d{4}-\d{2}-\d{2}$/,
  'Date must be in YYYY-MM-DD format'
);

const nullableDateSchema = dateStringSchema.nullable();

const hexColorSchema = z.string().regex(
  /^#[0-9a-fA-F]{6}$/,
  'Must be a valid hex color (e.g., #2563eb)'
);

// =============================================================================
// Campaign Calendar Validation
// =============================================================================

export const customDeadlineSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'Deadline name is required'),
  date: dateStringSchema,
  alertDaysBefore: z.number().min(0).max(90),
});

export const campaignPhaseSchema = z.enum([
  'pre_primary',
  'primary_gotv',
  'general_id',
  'general_persuasion',
  'general_gotv',
  'post_election',
]);

export const primaryTypeSchema = z.enum(['open', 'closed', 'semi-closed', 'caucus']);

export const campaignCalendarSettingsSchema = z.object({
  primaryDate: nullableDateSchema,
  primaryType: primaryTypeSchema,
  generalElectionDate: dateStringSchema,
  voterRegistrationDeadline: dateStringSchema,
  earlyVotingStart: nullableDateSchema,
  earlyVotingEnd: nullableDateSchema,
  absenteeRequestDeadline: nullableDateSchema,
  customDeadlines: z.array(customDeadlineSchema),
  forcePhase: z.union([campaignPhaseSchema, z.literal('auto')]),
});

// =============================================================================
// Targeting Strategy Validation
// =============================================================================

export const targetingStrategySchema = z.enum(['gotv', 'persuasion', 'hybrid']);

export const scoreWeightsSchema = z.object({
  turnoutHistory: z.number().min(0).max(100),
  partisanLean: z.number().min(0).max(100),
  demographicFit: z.number().min(0).max(100),
  donorPotential: z.number().min(0).max(100),
}).refine(
  data => {
    const sum = data.turnoutHistory + data.partisanLean + data.demographicFit + data.donorPotential;
    return sum === 100;
  },
  { message: 'Score weights must sum to 100' }
);

export const swingDefinitionSchema = z.object({
  minMargin: z.number().min(-50).max(0),
  maxMargin: z.number().min(0).max(50),
}).refine(
  data => data.minMargin < data.maxMargin,
  { message: 'Min margin must be less than max margin' }
);

export const targetingSettingsSchema = z.object({
  strategy: targetingStrategySchema,
  scoreWeights: scoreWeightsSchema,
  gotvMinScore: z.number().min(0).max(100),
  persuasionMinScore: z.number().min(0).max(100),
  swingDefinition: swingDefinitionSchema,
  targetUniverseSize: z.union([z.number().min(100).max(1000000), z.literal('auto')]),
});


export const doorsPerHourSchema = z.object({
  urban: z.number().min(10).max(60),
  suburban: z.number().min(5).max(50),
  rural: z.number().min(3).max(30),
});


// =============================================================================
// AI Assistant Validation
// =============================================================================

export const responseStyleSchema = z.enum(['concise', 'detailed', 'auto']);
export const proactiveFrequencySchema = z.enum(['low', 'medium', 'high']);
export const aiToneSchema = z.enum(['professional', 'casual', 'urgent']);

export const aiSettingsSchema = z.object({
  responseStyle: responseStyleSchema,
  enableProactiveSuggestions: z.boolean(),
  proactiveFrequency: proactiveFrequencySchema,
  showConfidenceIndicators: z.boolean(),
  showDataSources: z.boolean(),
  showMethodologyLinks: z.boolean(),
  preferLocalHandlers: z.boolean(),
  allowClaudeEscalation: z.boolean(),
  tone: aiToneSchema,
});

// =============================================================================
// Data & Privacy Validation
// =============================================================================

export const exportFormatSchema = z.enum(['csv', 'xlsx', 'pdf']);

export const dataSettingsSchema = z.object({
  enableExplorationHistory: z.boolean(),
  enableSessionMemory: z.boolean(),
  sessionRetentionDays: z.number().min(1).max(365),
  enableDonorData: z.boolean(),
  enableTapestrySegments: z.boolean(),
  enableCensusData: z.boolean(),
  defaultExportFormat: exportFormatSchema,
  includeMetadataInExports: z.boolean(),
});

// =============================================================================
// Map & Visualization Validation
// =============================================================================

export const colorSchemeSchema = z.enum(['dem_rep', 'viridis', 'custom']);

export const customColorsSchema = z.object({
  low: hexColorSchema,
  mid: hexColorSchema,
  high: hexColorSchema,
});

export const mapSettingsSchema = z.object({
  defaultCenter: z.tuple([
    z.number().min(-180).max(180), // longitude
    z.number().min(-90).max(90),   // latitude
  ]),
  defaultZoom: z.number().min(1).max(20),
  defaultMetric: z.string().min(1),
  colorScheme: colorSchemeSchema,
  customColors: customColorsSchema.optional(),
  defaultVisibleLayers: z.array(z.string()),
  showH3Hexagons: z.boolean(),
  showPrecinctBoundaries: z.boolean(),
});

// =============================================================================
// Organization Validation
// =============================================================================

export const organizationSettingsSchema = z.object({
  organizationName: z.string().max(100),
  primaryColor: hexColorSchema,
  logoUrl: z.string().url().or(z.literal('')),
  targetState: z.string().length(2),
  targetCounties: z.array(z.string()),
  targetDistricts: z.array(z.string()),
  reportHeaderText: z.string().max(200),
  reportFooterText: z.string().max(200),
  includeOrganizationLogo: z.boolean(),
});

// =============================================================================
// Combined Settings Validation
// =============================================================================

export const allSettingsSchema = z.object({
  campaign: campaignCalendarSettingsSchema,
  targeting: targetingSettingsSchema,
  ai: aiSettingsSchema,
  data: dataSettingsSchema,
  map: mapSettingsSchema,
  organization: organizationSettingsSchema,
});

export const persistedSettingsSchema = z.object({
  version: z.number().min(1),
  lastModified: z.string().datetime(),
  settings: allSettingsSchema,
});

// =============================================================================
// Validation Helpers
// =============================================================================

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: z.ZodError };

/**
 * Validate settings for a specific category.
 */
export function validateCategorySettings<K extends keyof typeof categorySchemas>(
  category: K,
  settings: unknown
): ValidationResult<z.infer<(typeof categorySchemas)[K]>> {
  const schema = categorySchemas[category];
  const result = schema.safeParse(settings);

  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

/**
 * Validate all settings.
 */
export function validateAllSettings(
  settings: unknown
): ValidationResult<z.infer<typeof allSettingsSchema>> {
  const result = allSettingsSchema.safeParse(settings);

  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

/**
 * Get human-readable error messages from Zod errors.
 */
export function getErrorMessages(error: z.ZodError): string[] {
  return error.errors.map(err => {
    const path = err.path.join('.');
    return `${path}: ${err.message}`;
  });
}

// Category schemas map for dynamic validation
const categorySchemas = {
  campaign: campaignCalendarSettingsSchema,
  targeting: targetingSettingsSchema,
  ai: aiSettingsSchema,
  data: dataSettingsSchema,
  map: mapSettingsSchema,
  organization: organizationSettingsSchema,
} as const;
