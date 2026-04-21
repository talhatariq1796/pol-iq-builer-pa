/**
 * Poll Ingestion System
 *
 * Complete polling data pipeline:
 * - Source adapters (FiveThirtyEight, VoteHub)
 * - Normalization and validation
 * - FiveThirtyEight-style weighted aggregation
 * - JSON persistence
 * - Knowledge graph integration
 * - RAG document generation
 */

// Types
export * from './types';

// Source Adapters
export { FiveThirtyEightAdapter, getFiveThirtyEightAdapter } from './sources/FiveThirtyEightAdapter';
export { VoteHubAdapter, getVoteHubAdapter } from './sources/VoteHubAdapter';

// Core Components
export { PollNormalizer, getPollNormalizer } from './PollNormalizer';
export { PollAggregator, getPollAggregator } from './PollAggregator';
export { PollStore, getPollStore } from './PollStore';

// Bridges
export { PollToGraphBridge, getPollToGraphBridge } from './PollToGraphBridge';
export { PollToRAGBridge, getPollToRAGBridge } from './PollToRAGBridge';

// Main orchestrator
export { PollIngestionPipeline, getPollIngestionPipeline } from './PollIngestionPipeline';
