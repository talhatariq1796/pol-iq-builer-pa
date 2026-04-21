/**
 * FiveThirtyEight Adapter
 *
 * Fetches historical polling data from FiveThirtyEight's GitHub repository.
 * Note: FiveThirtyEight was shut down in March 2025, so this provides
 * historical data and pollster ratings only.
 */

import {
  PollSourceAdapter,
  RawPoll,
  FetchOptions,
  PollsterRating,
} from '../types';

// FiveThirtyEight CSV column indices
const COLUMNS = {
  poll_id: 0,
  pollster: 1,
  pollster_rating: 2,
  methodology: 3,
  state: 4,
  start_date: 5,
  end_date: 6,
  sample_size: 7,
  population: 8,
  party: 9,
  candidate_name: 10,
  pct: 11,
  // Columns may vary by file
};

export class FiveThirtyEightAdapter implements PollSourceAdapter {
  name = 'fivethirtyeight' as const;

  private readonly CSV_URLS = {
    president:
      'https://projects.fivethirtyeight.com/polls-page/data/president_polls.csv',
    senate:
      'https://projects.fivethirtyeight.com/polls-page/data/senate_polls.csv',
    governor:
      'https://projects.fivethirtyeight.com/polls-page/data/governor_polls.csv',
    house:
      'https://projects.fivethirtyeight.com/polls-page/data/house_polls.csv',
    pollster_ratings:
      'https://raw.githubusercontent.com/fivethirtyeight/data/master/pollster-ratings/pollster-ratings.csv',
  };

  private pollsterRatings: Map<string, PollsterRating> = new Map();

  async fetchPolls(options: FetchOptions): Promise<RawPoll[]> {
    const polls: RawPoll[] = [];

    // Load pollster ratings first
    await this.loadPollsterRatings();

    // Determine which race files to fetch
    const raceTypes = options.race_type
      ? [options.race_type]
      : ['president', 'senate', 'governor'];

    for (const raceType of raceTypes) {
      const url = this.CSV_URLS[raceType as keyof typeof this.CSV_URLS];
      if (!url) continue;

      try {
        const racePolls = await this.fetchRacePolls(url, raceType, options);
        polls.push(...racePolls);
      } catch (error) {
        console.warn(`[FiveThirtyEight] Failed to fetch ${raceType}:`, error);
      }
    }

    return polls;
  }

  private async fetchRacePolls(
    url: string,
    raceType: string,
    options: FetchOptions
  ): Promise<RawPoll[]> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    const csv = await response.text();
    const rows = this.parseCSV(csv);

    // Skip header row
    const dataRows = rows.slice(1);

    // Group by poll_id to combine candidates
    const pollMap = new Map<string, RawPoll>();

    for (const row of dataRows) {
      // Filter to Michigan if specified
      const state = this.getColumn(row, 'state');
      if (options.state && !this.matchesState(state, options.state)) {
        continue;
      }

      // Filter by date if specified
      const endDate = this.getColumn(row, 'end_date');
      if (options.start_date && endDate < options.start_date) {
        continue;
      }

      const pollId = this.getColumn(row, 'poll_id') || `538-${row.join('-').substring(0, 50)}`;
      const existingPoll = pollMap.get(pollId);

      const result = {
        candidate_name: this.getColumn(row, 'candidate_name') || '',
        party: this.getColumn(row, 'party'),
        percentage: parseFloat(this.getColumn(row, 'pct') || '0'),
      };

      if (existingPoll) {
        existingPoll.results.push(result);
      } else {
        const pollster = this.getColumn(row, 'pollster') || 'Unknown';
        const rating = this.pollsterRatings.get(pollster.toLowerCase());

        pollMap.set(pollId, {
          source: 'fivethirtyeight',
          pollster,
          pollster_rating: rating,
          race_type: raceType,
          geography: state || 'Unknown',
          methodology: this.getColumn(row, 'methodology'),
          population: this.getColumn(row, 'population'),
          sample_size: parseInt(this.getColumn(row, 'sample_size') || '0', 10),
          start_date: this.getColumn(row, 'start_date'),
          end_date: endDate,
          results: [result],
          source_url: url,
        });
      }
    }

    return Array.from(pollMap.values());
  }

  private async loadPollsterRatings(): Promise<void> {
    if (this.pollsterRatings.size > 0) return;

    try {
      const response = await fetch(this.CSV_URLS.pollster_ratings);
      if (!response.ok) return;

      const csv = await response.text();
      const rows = this.parseCSV(csv);

      // Find column indices
      const headers = rows[0];
      const pollsterIdx = headers.findIndex(
        (h) => h.toLowerCase() === 'pollster'
      );
      const ratingIdx = headers.findIndex(
        (h) => h.toLowerCase().includes('grade') || h.toLowerCase().includes('rating')
      );

      if (pollsterIdx === -1 || ratingIdx === -1) return;

      for (const row of rows.slice(1)) {
        const pollster = row[pollsterIdx]?.toLowerCase();
        const rating = row[ratingIdx] as PollsterRating;
        if (pollster && rating) {
          this.pollsterRatings.set(pollster, rating);
        }
      }

      console.log(`[FiveThirtyEight] Loaded ${this.pollsterRatings.size} pollster ratings`);
    } catch (error) {
      console.warn('[FiveThirtyEight] Failed to load pollster ratings:', error);
    }
  }

  getPollsterRating(pollster: string): PollsterRating | undefined {
    return this.pollsterRatings.get(pollster.toLowerCase());
  }

  private parseCSV(csv: string): string[][] {
    const rows: string[][] = [];
    const lines = csv.split('\n');

    for (const line of lines) {
      if (!line.trim()) continue;

      // Simple CSV parsing (handles basic cases)
      const row: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          row.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      row.push(current.trim());
      rows.push(row);
    }

    return rows;
  }

  private getColumn(row: string[], columnName: string): string {
    // Dynamic column mapping based on common FiveThirtyEight formats
    const columnMap: Record<string, number[]> = {
      poll_id: [0],
      pollster: [1, 2],
      pollster_rating: [2, 3],
      methodology: [3, 4, 5],
      state: [4, 5, 6],
      start_date: [5, 6, 7],
      end_date: [6, 7, 8],
      sample_size: [7, 8, 9],
      population: [8, 9, 10],
      party: [9, 10, 11],
      candidate_name: [10, 11, 12],
      pct: [11, 12, 13],
    };

    const indices = columnMap[columnName] || [];
    for (const idx of indices) {
      if (row[idx] && row[idx].trim()) {
        return row[idx].trim();
      }
    }
    return '';
  }

  private matchesState(state: string, target: string): boolean {
    const s = state?.toLowerCase().trim();
    const t = target?.toLowerCase().trim();

    return (
      s === t ||
      s === 'michigan' && t === 'mi' ||
      s === 'mi' && t === 'michigan' ||
      s.includes(t) ||
      t.includes(s)
    );
  }
}

// Singleton instance
let adapterInstance: FiveThirtyEightAdapter | null = null;

export function getFiveThirtyEightAdapter(): FiveThirtyEightAdapter {
  if (!adapterInstance) {
    adapterInstance = new FiveThirtyEightAdapter();
  }
  return adapterInstance;
}
