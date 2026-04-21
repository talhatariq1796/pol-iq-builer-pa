import { AnalysisContext, ProjectType } from './base-context';
import { REAL_ESTATE_CONTEXT } from './real-estate-context';
import { RETAIL_CONTEXT } from './retail-context';

export * from './base-context';
export { REAL_ESTATE_CONTEXT } from './real-estate-context';
export { RETAIL_CONTEXT } from './retail-context';

/**
 * Registry of all available analysis contexts
 */
export const ANALYSIS_CONTEXTS: Record<string, AnalysisContext> = {
  'retail': RETAIL_CONTEXT,
  'real-estate': REAL_ESTATE_CONTEXT,
};

/**
 * Get analysis context by project type
 */
export function getAnalysisContext(projectType: string): AnalysisContext {
  const context = ANALYSIS_CONTEXTS[projectType];
  if (!context) {
    console.warn(`[AnalysisContexts] Unknown project type: ${projectType}, falling back to retail`);
    return RETAIL_CONTEXT; // Default fallback
  }
  return context;
}

/**
 * Get all available project types
 */
export function getAvailableProjectTypes(): ProjectType[] {
  return Object.keys(ANALYSIS_CONTEXTS) as ProjectType[];
}

/**
 * Check if a project type is supported
 */
export function isProjectTypeSupported(projectType: string): boolean {
  return projectType in ANALYSIS_CONTEXTS;
}