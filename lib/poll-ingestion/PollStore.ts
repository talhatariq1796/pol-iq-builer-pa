/**
 * Poll Store
 *
 * JSON-based persistence for polls and aggregates.
 * Stores data in public/data/polls/ directory for client-side access.
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { Poll, PollAggregate } from './types';

interface PollStoreData {
  polls: Poll[];
  aggregates: Record<string, PollAggregate>;
  lastUpdated: string;
  metadata: {
    totalPolls: number;
    totalRaces: number;
    sources: string[];
    dateRange: {
      earliest: string;
      latest: string;
    };
  };
}

export class PollStore {
  private readonly dataDir: string;
  private readonly pollsFile: string;
  private readonly aggregatesFile: string;

  private polls: Poll[] = [];
  private aggregates: Map<string, PollAggregate> = new Map();
  private loaded = false;

  constructor(dataDir?: string) {
    this.dataDir = dataDir || path.join(process.cwd(), 'public', 'data', 'polls');
    this.pollsFile = path.join(this.dataDir, 'polls.json');
    this.aggregatesFile = path.join(this.dataDir, 'aggregates.json');
  }

  /**
   * Load polls from disk
   */
  async load(): Promise<void> {
    try {
      // Ensure directory exists
      await fs.mkdir(this.dataDir, { recursive: true });

      // Load polls
      try {
        const pollsData = await fs.readFile(this.pollsFile, 'utf-8');
        const parsed = JSON.parse(pollsData);
        this.polls = Array.isArray(parsed) ? parsed : parsed.polls || [];
      } catch {
        this.polls = [];
      }

      // Load aggregates
      try {
        const aggData = await fs.readFile(this.aggregatesFile, 'utf-8');
        const parsed = JSON.parse(aggData);
        this.aggregates = new Map(Object.entries(parsed));
      } catch {
        this.aggregates = new Map();
      }

      this.loaded = true;
      console.log(`[PollStore] Loaded ${this.polls.length} polls, ${this.aggregates.size} aggregates`);
    } catch (error) {
      console.error('[PollStore] Failed to load:', error);
      this.polls = [];
      this.aggregates = new Map();
      this.loaded = true;
    }
  }

  /**
   * Save polls and aggregates to disk
   */
  async save(): Promise<void> {
    try {
      // Ensure directory exists
      await fs.mkdir(this.dataDir, { recursive: true });

      // Save polls with metadata
      const pollsData: PollStoreData = {
        polls: this.polls,
        aggregates: Object.fromEntries(this.aggregates),
        lastUpdated: new Date().toISOString(),
        metadata: this.generateMetadata(),
      };

      await fs.writeFile(this.pollsFile, JSON.stringify(pollsData, null, 2));

      // Save aggregates separately for easy access
      await fs.writeFile(
        this.aggregatesFile,
        JSON.stringify(Object.fromEntries(this.aggregates), null, 2)
      );

      console.log(`[PollStore] Saved ${this.polls.length} polls, ${this.aggregates.size} aggregates`);
    } catch (error) {
      console.error('[PollStore] Failed to save:', error);
      throw error;
    }
  }

  /**
   * Add new polls (deduplicates by poll_id)
   */
  addPolls(newPolls: Poll[]): number {
    const existingIds = new Set(this.polls.map((p) => p.poll_id));
    let added = 0;

    for (const poll of newPolls) {
      if (!existingIds.has(poll.poll_id)) {
        this.polls.push(poll);
        existingIds.add(poll.poll_id);
        added++;
      }
    }

    // Sort by date descending
    this.polls.sort(
      (a, b) => new Date(b.end_date).getTime() - new Date(a.end_date).getTime()
    );

    console.log(`[PollStore] Added ${added} new polls (${newPolls.length - added} duplicates skipped)`);
    return added;
  }

  /**
   * Update aggregates
   */
  setAggregates(aggregates: Map<string, PollAggregate>): void {
    this.aggregates = new Map(aggregates);
  }

  /**
   * Get all polls
   */
  getPolls(): Poll[] {
    return [...this.polls];
  }

  /**
   * Get polls by race ID
   */
  getPollsByRace(raceId: string): Poll[] {
    return this.polls.filter((p) => p.race_id === raceId);
  }

  /**
   * Get polls by geography
   */
  getPollsByGeography(geography: string): Poll[] {
    const geo = geography.toLowerCase();
    return this.polls.filter(
      (p) => p.geography.toLowerCase().includes(geo) || geo.includes(p.geography.toLowerCase())
    );
  }

  /**
   * Get recent polls
   */
  getRecentPolls(days: number = 30): Poll[] {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    return this.polls.filter((p) => new Date(p.end_date) >= cutoff);
  }

  /**
   * Get all aggregates
   */
  getAggregates(): Map<string, PollAggregate> {
    return new Map(this.aggregates);
  }

  /**
   * Get aggregate by race ID
   */
  getAggregate(raceId: string): PollAggregate | undefined {
    return this.aggregates.get(raceId);
  }

  /**
   * Get aggregates by geography
   */
  getAggregatesByGeography(geography: string): PollAggregate[] {
    const geo = geography.toLowerCase();
    return Array.from(this.aggregates.values()).filter(
      (a) =>
        a.geography.toLowerCase().includes(geo) || geo.includes(a.geography.toLowerCase())
    );
  }

  /**
   * Get Michigan aggregates
   */
  getMichiganAggregates(): PollAggregate[] {
    return this.getAggregatesByGeography('michigan');
  }

  /**
   * Get competitive races (margin < 5)
   */
  getCompetitiveRaces(): PollAggregate[] {
    return Array.from(this.aggregates.values())
      .filter((a) => Math.abs(a.margin) < 5)
      .sort((a, b) => Math.abs(a.margin) - Math.abs(b.margin));
  }

  /**
   * Search polls by pollster name
   */
  searchByPollster(pollster: string): Poll[] {
    const search = pollster.toLowerCase();
    return this.polls.filter((p) => p.pollster.toLowerCase().includes(search));
  }

  /**
   * Get unique race IDs
   */
  getRaceIds(): string[] {
    return [...new Set(this.polls.map((p) => p.race_id))];
  }

  /**
   * Get poll count
   */
  getPollCount(): number {
    return this.polls.length;
  }

  /**
   * Check if loaded
   */
  isLoaded(): boolean {
    return this.loaded;
  }

  /**
   * Generate metadata for the store
   */
  private generateMetadata(): PollStoreData['metadata'] {
    const sources = [...new Set(this.polls.map((p) => p.source))];

    const dates = this.polls.map((p) => p.end_date).filter(Boolean).sort();

    return {
      totalPolls: this.polls.length,
      totalRaces: this.aggregates.size,
      sources,
      dateRange: {
        earliest: dates[0] || '',
        latest: dates[dates.length - 1] || '',
      },
    };
  }

  /**
   * Export for client-side use (smaller payload)
   */
  exportForClient(): {
    aggregates: PollAggregate[];
    recentPolls: Poll[];
    metadata: PollStoreData['metadata'];
  } {
    return {
      aggregates: Array.from(this.aggregates.values()),
      recentPolls: this.getRecentPolls(30),
      metadata: this.generateMetadata(),
    };
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.polls = [];
    this.aggregates = new Map();
  }
}

// Singleton instance
let storeInstance: PollStore | null = null;

export function getPollStore(): PollStore {
  if (!storeInstance) {
    storeInstance = new PollStore();
  }
  return storeInstance;
}
