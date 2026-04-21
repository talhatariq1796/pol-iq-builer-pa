/**
 * VoteHub Adapter
 *
 * Fetches live polling data from VoteHub's free REST API.
 * API docs: https://votehub.com/polls/api/
 *
 * Features:
 * - Free, no API key required
 * - Creative Commons Attribution 4.0 license
 * - Real-time presidential approval and generic ballot
 */

import {
  PollSourceAdapter,
  RawPoll,
  FetchOptions,
} from '../types';

interface VoteHubPoll {
  pollster: string;
  subject: string;
  poll_type: string;
  date: string;
  results: Record<string, number>;
  sample_size?: number;
  margin_of_error?: number;
  methodology?: string;
  population?: string;
  url?: string;
}

interface VoteHubResponse {
  polls: VoteHubPoll[];
  metadata?: {
    count: number;
    updated_at: string;
  };
}

export class VoteHubAdapter implements PollSourceAdapter {
  name = 'votehub' as const;

  private readonly BASE_URL = 'https://votehub.com/polls/api';

  async fetchPolls(options: FetchOptions): Promise<RawPoll[]> {
    const polls: RawPoll[] = [];

    try {
      // Build query parameters
      const params = new URLSearchParams();

      if (options.state) {
        // VoteHub uses 'subject' for state/geography
        params.set('subject', options.state);
      }

      if (options.race_type) {
        params.set('poll_type', this.mapRaceType(options.race_type));
      }

      const url = `${this.BASE_URL}/polls${params.toString() ? `?${params.toString()}` : ''}`;

      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`VoteHub API error: ${response.status}`);
      }

      const data: VoteHubResponse | VoteHubPoll[] = await response.json();

      // Handle both array and object response formats
      const pollArray = Array.isArray(data) ? data : data.polls || [];

      for (const poll of pollArray) {
        // Filter by state if needed
        if (options.state && !this.matchesState(poll.subject, options.state)) {
          continue;
        }

        // Filter by date if needed
        if (options.start_date && poll.date < options.start_date) {
          continue;
        }

        const rawPoll = this.transformPoll(poll);
        if (rawPoll.results.length > 0) {
          polls.push(rawPoll);
        }
      }

      console.log(`[VoteHub] Fetched ${polls.length} polls`);
    } catch (error) {
      console.error('[VoteHub] Failed to fetch polls:', error);
      // Return empty array on error - don't fail entire ingestion
    }

    return polls;
  }

  private transformPoll(poll: VoteHubPoll): RawPoll {
    // Transform results object to array
    const results = Object.entries(poll.results || {}).map(([name, pct]) => ({
      candidate_name: name,
      party: this.inferParty(name),
      percentage: typeof pct === 'number' ? pct : parseFloat(String(pct)) || 0,
    }));

    return {
      source: 'votehub',
      pollster: poll.pollster || 'Unknown',
      race_type: this.mapPollType(poll.poll_type),
      geography: poll.subject || 'National',
      methodology: poll.methodology,
      population: poll.population,
      sample_size: poll.sample_size,
      margin_of_error: poll.margin_of_error,
      end_date: poll.date,
      results,
      source_url: poll.url,
    };
  }

  private mapRaceType(raceType: string): string {
    const mapping: Record<string, string> = {
      president: 'presidential',
      senate: 'senate',
      governor: 'gubernatorial',
      house: 'congressional',
      approval: 'approval',
    };
    return mapping[raceType] || raceType;
  }

  private mapPollType(pollType: string): string {
    if (!pollType) return 'president';

    const type = pollType.toLowerCase();
    if (type.includes('president')) return 'president';
    if (type.includes('senate')) return 'senate';
    if (type.includes('governor') || type.includes('gubernatorial')) return 'governor';
    if (type.includes('house') || type.includes('congress')) return 'house';
    if (type.includes('approval')) return 'approval';
    if (type.includes('generic')) return 'house'; // Generic ballot

    return 'president';
  }

  private inferParty(name: string): string | undefined {
    const nameLower = name.toLowerCase();

    // Known Democrats
    if (
      nameLower.includes('biden') ||
      nameLower.includes('harris') ||
      nameLower.includes('whitmer') ||
      nameLower.includes('slotkin') ||
      nameLower.includes('peters') ||
      nameLower.includes('democrat')
    ) {
      return 'DEM';
    }

    // Known Republicans
    if (
      nameLower.includes('trump') ||
      nameLower.includes('rogers') ||
      nameLower.includes('dixon') ||
      nameLower.includes('james') ||
      nameLower.includes('republican')
    ) {
      return 'REP';
    }

    // Third parties
    if (nameLower.includes('libertarian') || nameLower.includes('jorgensen')) {
      return 'LIB';
    }
    if (nameLower.includes('green') || nameLower.includes('stein')) {
      return 'GRN';
    }

    return undefined;
  }

  private matchesState(subject: string, target: string): boolean {
    if (!subject || !target) return false;

    const s = subject.toLowerCase().trim();
    const t = target.toLowerCase().trim();

    return (
      s === t ||
      (s === 'michigan' && t === 'mi') ||
      (s === 'mi' && t === 'michigan') ||
      s.includes(t) ||
      t.includes(s)
    );
  }
}

// Singleton instance
let adapterInstance: VoteHubAdapter | null = null;

export function getVoteHubAdapter(): VoteHubAdapter {
  if (!adapterInstance) {
    adapterInstance = new VoteHubAdapter();
  }
  return adapterInstance;
}
