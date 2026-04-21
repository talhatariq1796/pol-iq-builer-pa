/**
 * Type definitions for Field Brief Generator
 *
 * Defines interfaces for generating field operations briefings that compare two areas.
 * Used by campaign field coordinators and canvassers for tactical planning.
 */

import type { ComparisonEntity } from './types';

/**
 * Complete field brief for comparing two areas
 */
export interface FieldBrief {
  summary: string;                    // AI-generated executive summary
  profiles: AreaProfiles;             // Side-by-side area profiles
  talkingPoints: TalkingPoints;       // Talking points for each area
  voterProfiles: VoterProfiles;       // Tapestry-based voter profiles
  fieldOps: FieldOperations;          // Practical field operations info
  metadata: BriefMetadata;
}

/**
 * Side-by-side area profiles
 */
export interface AreaProfiles {
  left: AreaProfile;
  right: AreaProfile;
  keyDifferences: KeyDifference[];
}

/**
 * Single area profile
 */
export interface AreaProfile {
  name: string;
  partisanLean: string;               // E.g., "D+12" or "R+3"
  population: number;
  medianIncome: number;
  collegePct: number;
  strategy: string;
  competitiveness: string;
}

/**
 * Key difference between areas
 */
export interface KeyDifference {
  metric: string;
  leftValue: string;
  rightValue: string;
  implication: string;                // Strategic implication
}

/**
 * Talking points for canvassers
 */
export interface TalkingPoints {
  left: AreaTalkingPoints;
  right: AreaTalkingPoints;
}

/**
 * Talking points for one area
 */
export interface AreaTalkingPoints {
  areaName: string;
  topIssues: string[];                // Top 3 issues to discuss
  avoidTopics: string[];              // Topics to avoid
  keyMessages: string[];              // Key campaign messages
  connectionPoints: string[];         // Ways to connect with voters
}

/**
 * Voter profiles from Tapestry segmentation
 */
export interface VoterProfiles {
  left: VoterProfile;
  right: VoterProfile;
}

/**
 * Voter profile for one area
 */
export interface VoterProfile {
  areaName: string;
  dominantSegment: string;            // Top Tapestry segment
  lifestyleDescription: string;       // Description of typical voter
  typicalOccupations: string[];       // Common occupations
  mediaHabits: string[];              // How they consume news
  valuesAndPriorities: string[];      // Core values
}

/**
 * Field operations information
 */
export interface FieldOperations {
  left: FieldOpsInfo;
  right: FieldOpsInfo;
}

/**
 * Field ops info for one area
 */
export interface FieldOpsInfo {
  areaName: string;
  doorsPerHour: number;               // Expected canvassing rate
  bestTimes: string[];                // Best times to canvass
  density: 'urban' | 'suburban' | 'rural';
  parkingNotes: string;               // Parking recommendations
  safetyNotes: string;                // Safety considerations
}

/**
 * Brief metadata
 */
export interface BriefMetadata {
  generated: Date;
  comparison: {
    left: string;
    right: string;
  };
  format?: BriefFormat;
}

/**
 * Brief output formats
 */
export type BriefFormat = 'pdf' | 'markdown' | 'html' | 'text';

/**
 * Options for brief generation
 */
export interface BriefOptions {
  includeMap?: boolean;
  includeVoterProfiles?: boolean;
  includeTalkingPoints?: boolean;
  includeFieldOps?: boolean;
  briefingLength?: 'short' | 'standard' | 'detailed';
  audience?: 'canvassers' | 'phonebank' | 'organizers';
  language?: 'en' | 'es';
}
