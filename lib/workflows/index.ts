/**
 * Workflows Module
 *
 * AI-guided workflows for common political analysis tasks.
 * Each workflow provides:
 * - Guided user experience
 * - Map commands for visualization
 * - Suggested next actions
 * - Natural language responses
 */

export { FindTargetPrecincts, findTargetPrecincts } from './FindTargetPrecincts';
export { CompareJurisdictions, compareJurisdictions } from './CompareJurisdictions';

export type { TargetPrecinctResult, FindTargetsInput, FindTargetsOutput } from './FindTargetPrecincts';
export type { JurisdictionSummary, ComparisonInsight, CompareInput, CompareOutput } from './CompareJurisdictions';
