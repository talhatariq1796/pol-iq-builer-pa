/**
 * Knowledge Graph Module
 *
 * Provides entity and relationship management for political data,
 * enabling queries like:
 * - "Which candidates are running in swing precincts?"
 * - "What issues matter in East Lansing?"
 * - "Show connections between Haley Stevens and Oakland County"
 */

export * from './types';
export { KnowledgeGraph, getKnowledgeGraph } from './KnowledgeGraph';
export { EntityExtractor, getEntityExtractor } from './EntityExtractor';
export { GraphPopulator, getGraphPopulator } from './GraphPopulator';
