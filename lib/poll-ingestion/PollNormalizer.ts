/**
 * Poll Normalizer
 *
 * Standardizes raw poll data from different sources into a consistent format.
 * Handles candidate name matching, party inference, and data validation.
 */

import {
  Poll,
  RawPoll,
  PollResult,
  RaceType,
  PollMethodology,
  PollPopulation,
  Party,
  PollsterRating,
  KNOWN_CANDIDATES,
  RACE_TYPE_MAPPING,
  METHODOLOGY_MAPPING,
  POPULATION_MAPPING,
} from './types';

export class PollNormalizer {
  /**
   * Normalize a raw poll into standardized format
   */
  normalize(raw: RawPoll): Poll {
    const raceType = this.normalizeRaceType(raw.race_type);
    const raceId = this.generateRaceId(raceType, raw.geography, raw.end_date);

    return {
      poll_id: this.generatePollId(raw),
      source: raw.source,

      pollster: this.normalizePollsterName(raw.pollster),
      pollster_rating: this.normalizeRating(raw.pollster_rating),
      sponsor: raw.sponsor,

      race_type: raceType,
      race_id: raceId,
      geography: this.normalizeGeography(raw.geography),
      geography_fips: this.lookupFIPS(raw.geography),

      methodology: this.normalizeMethodology(raw.methodology),
      population: this.normalizePopulation(raw.population),
      sample_size: raw.sample_size || 0,
      margin_of_error: raw.margin_of_error,

      start_date: this.normalizeDate(raw.start_date || raw.end_date),
      end_date: this.normalizeDate(raw.end_date),
      release_date: undefined,

      results: this.normalizeResults(raw.results),

      source_url: raw.source_url,
      ingested_at: new Date().toISOString(),
    };
  }

  /**
   * Normalize multiple polls, filtering invalid ones
   */
  normalizeAll(rawPolls: RawPoll[]): Poll[] {
    const polls: Poll[] = [];

    for (const raw of rawPolls) {
      try {
        // Skip polls without results
        if (!raw.results || raw.results.length === 0) {
          continue;
        }

        // Skip polls without dates
        if (!raw.end_date) {
          continue;
        }

        const poll = this.normalize(raw);

        // Skip if results are invalid after normalization
        if (poll.results.length < 2) {
          continue;
        }

        polls.push(poll);
      } catch (error) {
        console.warn(`[PollNormalizer] Failed to normalize poll:`, error);
      }
    }

    return polls;
  }

  private generatePollId(raw: RawPoll): string {
    // Create unique ID from source, pollster, date, and geography
    const parts = [
      raw.source,
      this.slugify(raw.pollster || 'unknown'),
      raw.end_date?.replace(/-/g, '') || Date.now(),
      this.slugify(raw.geography || 'unknown'),
    ];
    return parts.join('-');
  }

  private generateRaceId(
    raceType: RaceType,
    geography: string,
    date: string
  ): string {
    // Extract year from date
    const year = date?.substring(0, 4) || new Date().getFullYear().toString();

    // Determine election cycle (even years)
    const electionYear = parseInt(year, 10);
    const cycle = electionYear % 2 === 0 ? electionYear : electionYear + 1;

    // Map geography to state code
    const stateCode = this.getStateCode(geography);

    // Build race ID
    const raceTypeCode = {
      president: 'PRES',
      senate: 'SEN',
      governor: 'GOV',
      house: 'HOUSE',
      state_senate: 'STSEN',
      state_house: 'STHOUSE',
      approval: 'APPROVAL',
    }[raceType];

    return `${stateCode}-${raceTypeCode}-${cycle}`;
  }

  private normalizeRaceType(raceType?: string): RaceType {
    if (!raceType) return 'president';

    const key = raceType.toLowerCase().trim();
    return RACE_TYPE_MAPPING[key] || 'president';
  }

  private normalizeMethodology(methodology?: string): PollMethodology {
    if (!methodology) return 'unknown';

    const key = methodology.toLowerCase().trim();
    return METHODOLOGY_MAPPING[key] || 'unknown';
  }

  private normalizePopulation(population?: string): PollPopulation {
    if (!population) return 'lv';

    const key = population.toLowerCase().trim();
    return POPULATION_MAPPING[key] || 'lv';
  }

  private normalizeRating(rating?: string): PollsterRating | undefined {
    if (!rating) return undefined;

    const normalized = rating.toUpperCase().trim();
    const validRatings: PollsterRating[] = [
      'A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F',
    ];

    if (validRatings.includes(normalized as PollsterRating)) {
      return normalized as PollsterRating;
    }

    return undefined;
  }

  private normalizeResults(rawResults: RawPoll['results']): PollResult[] {
    const results: PollResult[] = [];

    for (const raw of rawResults) {
      if (!raw.candidate_name || raw.percentage === undefined) {
        continue;
      }

      const normalizedName = this.normalizeCandidateName(raw.candidate_name);
      const party = this.inferParty(raw.candidate_name, raw.party);

      results.push({
        candidate_name: normalizedName,
        party,
        percentage: Math.round(raw.percentage * 10) / 10, // Round to 1 decimal
        is_incumbent: this.isIncumbent(normalizedName),
      });
    }

    // Sort by percentage descending
    results.sort((a, b) => b.percentage - a.percentage);

    return results;
  }

  private normalizeCandidateName(name: string): string {
    const key = name.toLowerCase().trim();

    // Check known candidates
    const known = KNOWN_CANDIDATES[key];
    if (known) {
      return known.fullName;
    }

    // Title case the name
    return name
      .trim()
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  private inferParty(name: string, rawParty?: string): Party {
    // First check if party is explicitly provided
    if (rawParty) {
      const p = rawParty.toUpperCase().trim();
      if (p === 'DEM' || p === 'DEMOCRAT' || p === 'DEMOCRATIC') return 'DEM';
      if (p === 'REP' || p === 'REPUBLICAN' || p === 'GOP') return 'REP';
      if (p === 'IND' || p === 'INDEPENDENT') return 'IND';
      if (p === 'LIB' || p === 'LIBERTARIAN') return 'LIB';
      if (p === 'GRN' || p === 'GREEN') return 'GRN';
    }

    // Check known candidates
    const key = name.toLowerCase().trim();
    const known = KNOWN_CANDIDATES[key];
    if (known) {
      return known.party;
    }

    // Default to other
    return 'other';
  }

  private isIncumbent(name: string): boolean {
    const incumbents = [
      'Joe Biden',
      'Gretchen Whitmer',
      'Gary Peters',
      'Debbie Stabenow',
    ];
    return incumbents.includes(name);
  }

  private normalizePollsterName(pollster: string): string {
    if (!pollster) return 'Unknown';

    // Standardize common pollster names
    const mappings: Record<string, string> = {
      '538': 'FiveThirtyEight',
      fivethirtyeight: 'FiveThirtyEight',
      emerson: 'Emerson College',
      'emerson college polling': 'Emerson College',
      'quinnipiac university': 'Quinnipiac',
      'quinnipiac university poll': 'Quinnipiac',
      'morning consult': 'Morning Consult',
      'yougov': 'YouGov',
      'ipsos': 'Ipsos',
      'marist': 'Marist College',
      'marist poll': 'Marist College',
    };

    const key = pollster.toLowerCase().trim();
    return mappings[key] || pollster.trim();
  }

  private normalizeGeography(geography: string): string {
    if (!geography) return 'Unknown';

    const mappings: Record<string, string> = {
      mi: 'Michigan',
      mich: 'Michigan',
      'mich.': 'Michigan',
      national: 'National',
      usa: 'National',
      us: 'National',
      'united states': 'National',
    };

    const key = geography.toLowerCase().trim();
    return mappings[key] || geography.trim();
  }

  private getStateCode(geography: string): string {
    const geo = geography.toLowerCase().trim();

    if (geo === 'michigan' || geo === 'mi') return 'MI';
    if (geo === 'national' || geo === 'usa' || geo === 'us') return 'US';

    // Extract state code from district (e.g., "MI-07" -> "MI")
    const match = geo.match(/^([A-Za-z]{2})-?\d+$/);
    if (match) return match[1].toUpperCase();

    return 'MI'; // Default to Michigan for this project
  }

  private lookupFIPS(geography: string): string | undefined {
    // Michigan FIPS codes
    const fipsCodes: Record<string, string> = {
      michigan: '26',
      mi: '26',
      'ingham county': '26065',
      ingham: '26065',
    };

    const key = geography.toLowerCase().trim();
    return fipsCodes[key];
  }

  private normalizeDate(date?: string): string {
    if (!date) return new Date().toISOString().split('T')[0];

    // Handle various date formats
    // MM/DD/YYYY
    const slashMatch = date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slashMatch) {
      const [, month, day, year] = slashMatch;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // MMDDYYYY (FEC format)
    const fecMatch = date.match(/^(\d{2})(\d{2})(\d{4})$/);
    if (fecMatch) {
      const [, month, day, year] = fecMatch;
      return `${year}-${month}-${day}`;
    }

    // Already ISO format
    if (/^\d{4}-\d{2}-\d{2}/.test(date)) {
      return date.split('T')[0];
    }

    return date;
  }

  private slugify(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);
  }
}

// Singleton instance
let normalizerInstance: PollNormalizer | null = null;

export function getPollNormalizer(): PollNormalizer {
  if (!normalizerInstance) {
    normalizerInstance = new PollNormalizer();
  }
  return normalizerInstance;
}
