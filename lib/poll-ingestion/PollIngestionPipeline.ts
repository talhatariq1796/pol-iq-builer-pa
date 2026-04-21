/**
 * Poll Ingestion Pipeline
 *
 * Orchestrates the complete polling data flow:
 * 1. Fetch from sources (FiveThirtyEight, VoteHub)
 * 2. Normalize raw data
 * 3. Store in PollStore
 * 4. Calculate weighted aggregates
 * 5. Sync to Knowledge Graph
 * 6. Generate RAG documents
 */

import { FiveThirtyEightAdapter, getFiveThirtyEightAdapter } from './sources/FiveThirtyEightAdapter';
import { VoteHubAdapter, getVoteHubAdapter } from './sources/VoteHubAdapter';
import { PollNormalizer, getPollNormalizer } from './PollNormalizer';
import { PollAggregator, getPollAggregator } from './PollAggregator';
import { PollStore, getPollStore } from './PollStore';
import { PollToGraphBridge, getPollToGraphBridge } from './PollToGraphBridge';
import { PollToRAGBridge, getPollToRAGBridge } from './PollToRAGBridge';
import { Poll, PollAggregate, FetchOptions, PollSourceAdapter } from './types';

export interface PipelineOptions {
  sources?: ('fivethirtyeight' | 'votehub')[];
  fetchOptions?: FetchOptions;
  skipGraph?: boolean;
  skipRAG?: boolean;
  forceRefresh?: boolean;
}

export interface PipelineResult {
  success: boolean;
  pollsFetched: number;
  pollsNormalized: number;
  pollsStored: number;
  aggregatesCalculated: number;
  graphEntitiesCreated: number;
  ragDocumentsGenerated: number;
  errors: string[];
  duration: number;
}

export class PollIngestionPipeline {
  private adapters: Map<string, PollSourceAdapter> = new Map();
  private normalizer: PollNormalizer;
  private aggregator: PollAggregator;
  private store: PollStore;
  private graphBridge: PollToGraphBridge;
  private ragBridge: PollToRAGBridge;

  constructor() {
    // Initialize adapters
    this.adapters.set('fivethirtyeight', getFiveThirtyEightAdapter());
    this.adapters.set('votehub', getVoteHubAdapter());

    // Initialize components
    this.normalizer = getPollNormalizer();
    this.aggregator = getPollAggregator();
    this.store = getPollStore();
    this.graphBridge = getPollToGraphBridge();
    this.ragBridge = getPollToRAGBridge();
  }

  /**
   * Run the complete ingestion pipeline
   */
  async run(options: PipelineOptions = {}): Promise<PipelineResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    const result: PipelineResult = {
      success: false,
      pollsFetched: 0,
      pollsNormalized: 0,
      pollsStored: 0,
      aggregatesCalculated: 0,
      graphEntitiesCreated: 0,
      ragDocumentsGenerated: 0,
      errors: [],
      duration: 0,
    };

    try {
      console.log('[PollIngestionPipeline] Starting pipeline...');

      // Load existing store
      await this.store.load();

      // Default to all sources if none specified
      const sources = options.sources || ['fivethirtyeight', 'votehub'];

      const fetchOptions: FetchOptions = {
        state: 'Pennsylvania',
        ...options.fetchOptions,
      };

      // 1. Fetch from sources
      console.log(`[PollIngestionPipeline] Fetching from ${sources.length} sources...`);
      const rawPolls: Poll[] = [];

      for (const sourceName of sources) {
        const adapter = this.adapters.get(sourceName);
        if (!adapter) {
          errors.push(`Unknown source: ${sourceName}`);
          continue;
        }

        try {
          const sourcePolls = await adapter.fetchPolls(fetchOptions);
          result.pollsFetched += sourcePolls.length;
          console.log(`[PollIngestionPipeline] Fetched ${sourcePolls.length} polls from ${sourceName}`);

          // Normalize
          const normalized = this.normalizer.normalizeAll(sourcePolls);
          result.pollsNormalized += normalized.length;
          rawPolls.push(...normalized);
        } catch (error) {
          const errorMsg = `Failed to fetch from ${sourceName}: ${error}`;
          console.error(`[PollIngestionPipeline] ${errorMsg}`);
          errors.push(errorMsg);
        }
      }

      // 2. Store polls
      if (rawPolls.length > 0) {
        const added = this.store.addPolls(rawPolls);
        result.pollsStored = added;
        console.log(`[PollIngestionPipeline] Stored ${added} new polls`);
      }

      // 3. Calculate aggregates
      const allPolls = this.store.getPolls();
      const aggregates = this.aggregator.aggregateAll(allPolls);
      this.store.setAggregates(aggregates);
      result.aggregatesCalculated = aggregates.size;
      console.log(`[PollIngestionPipeline] Calculated ${aggregates.size} race aggregates`);

      // 4. Save store
      await this.store.save();

      // 5. Sync to Knowledge Graph
      if (!options.skipGraph) {
        try {
          const graphAdded = this.graphBridge.addPolls(allPolls);
          result.graphEntitiesCreated = graphAdded;

          // Add aggregates to graph
          for (const [_, agg] of aggregates) {
            this.graphBridge.addAggregate(agg);
          }

          console.log(`[PollIngestionPipeline] Synced ${graphAdded} polls to knowledge graph`);
        } catch (error) {
          const errorMsg = `Graph sync failed: ${error}`;
          console.error(`[PollIngestionPipeline] ${errorMsg}`);
          errors.push(errorMsg);
        }
      }

      // 6. Generate RAG documents
      if (!options.skipRAG) {
        try {
          const ragSaved = await this.ragBridge.saveAggregates(aggregates);
          await this.ragBridge.saveRecentPolls(allPolls, 20);
          await this.ragBridge.updateIntelIndex(aggregates);
          result.ragDocumentsGenerated = ragSaved;
          console.log(`[PollIngestionPipeline] Generated ${ragSaved} RAG documents`);
        } catch (error) {
          const errorMsg = `RAG generation failed: ${error}`;
          console.error(`[PollIngestionPipeline] ${errorMsg}`);
          errors.push(errorMsg);
        }
      }

      result.success = errors.length === 0;
      result.errors = errors;

    } catch (error) {
      result.success = false;
      result.errors = [`Pipeline failed: ${error}`];
      console.error('[PollIngestionPipeline] Pipeline failed:', error);
    }

    result.duration = Date.now() - startTime;
    console.log(`[PollIngestionPipeline] Completed in ${result.duration}ms`);

    return result;
  }

  /**
   * Fetch polls without full pipeline (for preview/testing)
   */
  async fetchOnly(options: PipelineOptions = {}): Promise<Poll[]> {
    const sources = options.sources || ['fivethirtyeight', 'votehub'];
    const fetchOptions: FetchOptions = {
      state: 'Pennsylvania',
      ...options.fetchOptions,
    };

    const allPolls: Poll[] = [];

    for (const sourceName of sources) {
      const adapter = this.adapters.get(sourceName);
      if (!adapter) continue;

      try {
        const sourcePolls = await adapter.fetchPolls(fetchOptions);
        const normalized = this.normalizer.normalizeAll(sourcePolls);
        allPolls.push(...normalized);
      } catch (error) {
        console.error(`[PollIngestionPipeline] Failed to fetch from ${sourceName}:`, error);
      }
    }

    return allPolls;
  }

  /**
   * Get current aggregates from store
   */
  async getAggregates(): Promise<Map<string, PollAggregate>> {
    if (!this.store.isLoaded()) {
      await this.store.load();
    }
    return this.store.getAggregates();
  }

  /**
   * Get polls for a specific race
   */
  async getPollsForRace(raceId: string): Promise<Poll[]> {
    if (!this.store.isLoaded()) {
      await this.store.load();
    }
    return this.store.getPollsByRace(raceId);
  }

  /**
   * Get aggregate for a specific race
   */
  async getAggregate(raceId: string): Promise<PollAggregate | undefined> {
    if (!this.store.isLoaded()) {
      await this.store.load();
    }
    return this.store.getAggregate(raceId);
  }

  /**
   * Get aggregates for the configured state (legacy method name)
   */
  async getMichiganAggregates(): Promise<PollAggregate[]> {
    if (!this.store.isLoaded()) {
      await this.store.load();
    }
    return this.store.getMichiganAggregates();
  }

  /**
   * Get competitive races (margin < 5)
   */
  async getCompetitiveRaces(): Promise<PollAggregate[]> {
    if (!this.store.isLoaded()) {
      await this.store.load();
    }
    return this.store.getCompetitiveRaces();
  }

  /**
   * Get recent polls
   */
  async getRecentPolls(days: number = 30): Promise<Poll[]> {
    if (!this.store.isLoaded()) {
      await this.store.load();
    }
    return this.store.getRecentPolls(days);
  }

  /**
   * Generate summary context for AI
   */
  async getSummaryContext(): Promise<string> {
    const aggregates = await this.getAggregates();
    return this.ragBridge.generateSummaryContext(aggregates);
  }

  /**
   * Get store statistics
   */
  async getStats(): Promise<{
    pollCount: number;
    aggregateCount: number;
    raceIds: string[];
  }> {
    if (!this.store.isLoaded()) {
      await this.store.load();
    }

    return {
      pollCount: this.store.getPollCount(),
      aggregateCount: this.store.getAggregates().size,
      raceIds: this.store.getRaceIds(),
    };
  }
}

// Singleton instance
let pipelineInstance: PollIngestionPipeline | null = null;

export function getPollIngestionPipeline(): PollIngestionPipeline {
  if (!pipelineInstance) {
    pipelineInstance = new PollIngestionPipeline();
  }
  return pipelineInstance;
}
