/**
 * Election Results NLP Handler
 *
 * Translates natural language election result queries into data lookups.
 * Supports queries like:
 * - "What were the 2020 results?"
 * - "How did Biden do in Meridian?"
 * - "Show me the 2022 turnout"
 */

import type {
  NLPHandler,
  ParsedQuery,
  HandlerResult,
  QueryPattern,
  ExtractedEntities,
} from './types';
import { RESPONSE_TEMPLATES, getEnrichmentForQuery, formatEnrichmentSections } from './types';
import { politicalDataService } from '@/lib/services/PoliticalDataService';
import { getPoliticalRegionEnv } from '@/lib/political/politicalRegionConfig';

function enrichmentAreaLabel(): string {
  return getPoliticalRegionEnv().summaryAreaName;
}

// ============================================================================
// Query Patterns
// ============================================================================

const ELECTION_RESULTS_PATTERNS: QueryPattern[] = [
  {
    intent: 'election_results',
    patterns: [
      /(?:what\s+were|show\s+(?:me\s+)?)?(?:the\s+)?(?:20)?(20|22|24|18|16)\s+(?:election\s+)?results?/i,
      /results?\s+(?:from|for|in)\s+(?:20)?(20|22|24|18|16)/i,
      /(?:20)?(20|22|24|18|16)\s+(?:election|results?)/i,
      /how\s+did\s+(?:the\s+)?(?:20)?(20|22|24|18|16)\s+(?:election\s+)?(?:go|turn\s+out)/i,
    ],
    keywords: ['results', '2020', '2022', '2024', '2018', '2016', 'election'],
    priority: 9,
  },
  {
    intent: 'election_candidate_results',
    patterns: [
      /how\s+did\s+(biden|trump|harris|whitmer|slotkin|rogers)\s+do/i,
      /(biden|trump|harris|whitmer|slotkin|rogers)\s+(?:results?|performance|margin)/i,
      /(?:show|what\s+was)\s+(biden|trump|harris|whitmer)\s+(?:results?|vote|margin)/i,
      /(biden|trump|harris|whitmer)\s+(?:in|for)\s+(.+)/i,
    ],
    keywords: ['biden', 'trump', 'harris', 'whitmer', 'results', 'margin', 'vote'],
    priority: 9,
  },
  {
    intent: 'election_turnout',
    patterns: [
      /(?:show|what\s+was)\s+(?:the\s+)?(?:20)?(20|22|24|18|16)\s+turnout/i,
      /turnout\s+(?:in|for|from)\s+(?:20)?(20|22|24|18|16)/i,
      /(?:voter\s+)?turnout\s+(?:results?|data|history)/i,
      /how\s+many\s+(?:people\s+)?voted\s+(?:in\s+)?(?:20)?(20|22|24|18|16)/i,
    ],
    keywords: ['turnout', 'voted', 'participation', '2020', '2022'],
    priority: 8,
  },
  {
    intent: 'election_history',
    patterns: [
      /(?:election|voting)\s+history\s+(?:for\s+)?(.+)/i,
      /how\s+has\s+(.+?)\s+voted\s+(?:historically|over\s+time)/i,
      /historical\s+(?:results?|voting|elections?)\s+(?:for\s+)?(.+)/i,
      /past\s+(?:election\s+)?results?\s+(?:for\s+)?(.+)/i,
    ],
    keywords: ['history', 'historical', 'past', 'over time', 'voted'],
    priority: 8,
  },
];

// ============================================================================
// Election Data Types and Fallback Data
// ============================================================================

interface ElectionResult {
  year: number;
  race: string;
  demCandidate: string;
  repCandidate: string;
  demPct: number;
  repPct: number;
  turnout: number;
  totalVotes: number;
}

/** Fallback when precinct-level data cannot be aggregated (Michigan / legacy). */
const INGHAM_RESULTS_FALLBACK: ElectionResult[] = [
  { year: 2024, race: 'President', demCandidate: 'Harris', repCandidate: 'Trump', demPct: 62.1, repPct: 36.2, turnout: 72.5, totalVotes: 152000 },
  { year: 2024, race: 'Senate', demCandidate: 'Slotkin', repCandidate: 'Rogers', demPct: 58.3, repPct: 39.8, turnout: 72.5, totalVotes: 148000 },
  { year: 2022, race: 'Governor', demCandidate: 'Whitmer', repCandidate: 'Dixon', demPct: 67.2, repPct: 31.5, turnout: 58.3, totalVotes: 125000 },
  { year: 2022, race: 'SOS', demCandidate: 'Benson', repCandidate: 'Karamo', demPct: 65.8, repPct: 32.1, turnout: 58.3, totalVotes: 123000 },
  { year: 2020, race: 'President', demCandidate: 'Biden', repCandidate: 'Trump', demPct: 65.8, repPct: 32.5, turnout: 76.2, totalVotes: 168000 },
  { year: 2020, race: 'Senate', demCandidate: 'Peters', repCandidate: 'James', demPct: 63.2, repPct: 34.8, turnout: 76.2, totalVotes: 165000 },
  { year: 2018, race: 'Governor', demCandidate: 'Whitmer', repCandidate: 'Schuette', demPct: 68.5, repPct: 29.2, turnout: 61.5, totalVotes: 132000 },
  { year: 2016, race: 'President', demCandidate: 'Clinton', repCandidate: 'Trump', demPct: 60.2, repPct: 34.1, turnout: 70.8, totalVotes: 155000 },
];

/** Rough statewide presidential placeholders when PA precinct aggregation is unavailable. */
const PA_RESULTS_FALLBACK: ElectionResult[] = [
  { year: 2024, race: 'President', demCandidate: 'Harris', repCandidate: 'Trump', demPct: 50.0, repPct: 48.8, turnout: 71.0, totalVotes: 6_970_000 },
  { year: 2020, race: 'President', demCandidate: 'Biden', repCandidate: 'Trump', demPct: 50.0, repPct: 48.8, turnout: 76.5, totalVotes: 6_900_000 },
  { year: 2016, race: 'President', demCandidate: 'Clinton', repCandidate: 'Trump', demPct: 47.9, repPct: 48.8, turnout: 72.0, totalVotes: 6_100_000 },
];

function regionalElectionFallback(): ElectionResult[] {
  return getPoliticalRegionEnv().stateFips === '42' ? PA_RESULTS_FALLBACK : INGHAM_RESULTS_FALLBACK;
}

/**
 * Candidate name lookup for known elections
 * Maps year to { dem, rep } candidate names
 */
const CANDIDATE_NAMES: Record<number, { dem: string; rep: string }> = {
  2024: { dem: 'Harris', rep: 'Trump' },
  2022: { dem: 'Whitmer', rep: 'Dixon' },
  2020: { dem: 'Biden', rep: 'Trump' },
  2018: { dem: 'Whitmer', rep: 'Schuette' },
  2016: { dem: 'Clinton', rep: 'Trump' },
};

/**
 * Get county-level election results
 * Attempts to compute from precinct data first, falls back to hardcoded data
 */
async function getCountyElectionResults(): Promise<ElectionResult[]> {
  try {
    const electionData = await politicalDataService.getAllElectionResults();

    if (electionData) {
      // Handle precinctHistory format (current election-history.json structure)
      if (electionData.precinctHistory && Object.keys(electionData.precinctHistory).length > 0) {
        const aggregatedResults = aggregatePrecinctHistoryResults(electionData.precinctHistory);
        if (aggregatedResults.length > 0) {
          // Merge with fallback to ensure all years are covered
          return mergeWithFallback(aggregatedResults);
        }
      }
      // Handle legacy precincts format (blob storage)
      if (electionData.precincts && Object.keys(electionData.precincts).length > 0) {
        const aggregatedResults = aggregatePrecinctResults(electionData.precincts);
        if (aggregatedResults.length > 0) {
          // Merge with fallback to ensure all years are covered
          return mergeWithFallback(aggregatedResults);
        }
      }
    }
  } catch (error) {
    console.warn('[ElectionResultsHandler] Failed to load election data from service:', error);
  }

  return regionalElectionFallback();
}

/**
 * Merge aggregated results with fallback data
 * Aggregated data takes precedence; fallback fills in missing years
 */
function mergeWithFallback(aggregated: ElectionResult[]): ElectionResult[] {
  const resultsByKey = new Map<string, ElectionResult>();

  // Add aggregated results (these take precedence)
  for (const result of aggregated) {
    resultsByKey.set(`${result.year}-${result.race}`, result);
  }

  // Fill in missing years/races from fallback
  for (const fallback of regionalElectionFallback()) {
    const key = `${fallback.year}-${fallback.race}`;
    if (!resultsByKey.has(key)) {
      resultsByKey.set(key, fallback);
    }
  }

  // Sort by year descending
  return Array.from(resultsByKey.values()).sort((a, b) => b.year - a.year || a.race.localeCompare(b.race));
}

/**
 * Aggregate precinctHistory format (election-history.json) into county-level totals
 * Data format: { precinctId: { "2020": { turnout, demVoteShare, repVoteShare, margin } } }
 */
function aggregatePrecinctHistoryResults(
  precinctHistory: Record<string, Record<string, { turnout: number; demVoteShare: number; repVoteShare: number; margin: number }>>
): ElectionResult[] {
  const yearAggregates: Map<number, {
    totalTurnout: number;
    totalDemShare: number;
    totalRepShare: number;
    precinctCount: number;
  }> = new Map();

  // Aggregate across all precincts for each year
  for (const [, yearData] of Object.entries(precinctHistory)) {
    for (const [yearStr, election] of Object.entries(yearData)) {
      const year = parseInt(yearStr);
      if (isNaN(year)) continue;

      const existing = yearAggregates.get(year) || {
        totalTurnout: 0,
        totalDemShare: 0,
        totalRepShare: 0,
        precinctCount: 0,
      };

      existing.totalTurnout += election.turnout || 0;
      existing.totalDemShare += election.demVoteShare || 0;
      existing.totalRepShare += election.repVoteShare || 0;
      existing.precinctCount += 1;

      yearAggregates.set(year, existing);
    }
  }

  // Convert to ElectionResult format with averaged percentages
  const results: ElectionResult[] = [];
  for (const [year, agg] of yearAggregates.entries()) {
    if (agg.precinctCount > 0) {
      const candidates = CANDIDATE_NAMES[year] || { dem: 'Democrat', rep: 'Republican' };
      const avgDemPct = (agg.totalDemShare / agg.precinctCount) * 100;
      const avgRepPct = (agg.totalRepShare / agg.precinctCount) * 100;
      const avgTurnout = (agg.totalTurnout / agg.precinctCount) * 100;

      const estimatedRegisteredVoters =
        getPoliticalRegionEnv().stateFips === '42' ? 9_000_000 : 215000;
      const estimatedTotalVotes = Math.round(estimatedRegisteredVoters * (avgTurnout / 100));

      results.push({
        year,
        race: year % 4 === 0 ? 'President' : 'Governor',
        demCandidate: candidates.dem,
        repCandidate: candidates.rep,
        demPct: avgDemPct,
        repPct: avgRepPct,
        turnout: avgTurnout,
        totalVotes: estimatedTotalVotes,
      });
    }
  }

  // Sort by year descending
  return results.sort((a, b) => b.year - a.year);
}

/**
 * Aggregate precinct-level election results into county-level totals
 * Handles blob storage format:
 * {
 *   elections: {
 *     "2020-11-03": {
 *       ballots_cast: 690,
 *       president: {
 *         candidates: {
 *           "Joseph R. Biden": { party: "DEM", votes: 335 },
 *           "Donald J. Trump": { party: "REP", votes: 343 }
 *         }
 *       }
 *     }
 *   }
 * }
 */
function aggregatePrecinctResults(precincts: Record<string, any>): ElectionResult[] {
  const raceAggregates: Map<string, {
    year: number;
    race: string;
    demCandidate: string;
    repCandidate: string;
    demVotes: number;
    repVotes: number;
    totalVotes: number;
  }> = new Map();

  // Aggregate votes across all precincts
  for (const [, precinctData] of Object.entries(precincts)) {
    if (!precinctData.elections) continue;

    for (const [electionDate, electionData] of Object.entries(precinctData.elections as Record<string, any>)) {
      // Extract year from date string (e.g., "2020-11-03" -> 2020)
      const year = parseInt(electionDate.split('-')[0]);
      if (isNaN(year)) continue;

      const ballotsCast = electionData.ballots_cast || 0;

      // Process each office/race in this election
      for (const [officeKey, officeData] of Object.entries(electionData as Record<string, any>)) {
        // Skip non-race fields
        if (officeKey === 'ballots_cast' || !officeData?.candidates) continue;

        // Get race name from office key or office field
        const race = officeData.office || officeKey.charAt(0).toUpperCase() + officeKey.slice(1);
        const key = `${year}-${race}`;

        // Find DEM and REP candidates
        let demCandidate = '';
        let repCandidate = '';
        let demVotes = 0;
        let repVotes = 0;

        for (const [candidateName, candidateData] of Object.entries(officeData.candidates as Record<string, any>)) {
          if (candidateData.party === 'DEM') {
            demCandidate = candidateName.split(' ').pop() || candidateName; // Get last name
            demVotes = candidateData.votes || 0;
          } else if (candidateData.party === 'REP') {
            repCandidate = candidateName.split(' ').pop() || candidateName;
            repVotes = candidateData.votes || 0;
          }
        }

        // Aggregate
        const existing = raceAggregates.get(key) || {
          year,
          race,
          demCandidate: demCandidate || CANDIDATE_NAMES[year]?.dem || 'Democrat',
          repCandidate: repCandidate || CANDIDATE_NAMES[year]?.rep || 'Republican',
          demVotes: 0,
          repVotes: 0,
          totalVotes: 0,
        };

        // Use candidate names from first precinct that has them
        if (demCandidate && existing.demCandidate === 'Democrat') {
          existing.demCandidate = demCandidate;
        }
        if (repCandidate && existing.repCandidate === 'Republican') {
          existing.repCandidate = repCandidate;
        }

        existing.demVotes += demVotes;
        existing.repVotes += repVotes;
        existing.totalVotes += demVotes + repVotes; // Use actual votes, not ballots_cast

        raceAggregates.set(key, existing);
      }
    }
  }

  // Convert to ElectionResult format
  const results: ElectionResult[] = [];
  for (const agg of raceAggregates.values()) {
    if (agg.totalVotes > 0) {
      const estimatedRegisteredVoters =
        getPoliticalRegionEnv().stateFips === '42' ? 9_000_000 : 215000;
      results.push({
        year: agg.year,
        race: agg.race,
        demCandidate: agg.demCandidate,
        repCandidate: agg.repCandidate,
        demPct: (agg.demVotes / agg.totalVotes) * 100,
        repPct: (agg.repVotes / agg.totalVotes) * 100,
        turnout: (agg.totalVotes / estimatedRegisteredVoters) * 100,
        totalVotes: agg.totalVotes,
      });
    }
  }

  // Sort by year descending, then race
  return results.sort((a, b) => b.year - a.year || a.race.localeCompare(b.race));
}

// ============================================================================
// Election Results Handler Class
// ============================================================================

export class ElectionResultsHandler implements NLPHandler {
  name = 'ElectionResultsHandler';
  patterns = ELECTION_RESULTS_PATTERNS;

  canHandle(query: ParsedQuery): boolean {
    return (
      query.intent === 'election_results' ||
      query.intent === 'election_candidate_results' ||
      query.intent === 'election_turnout' ||
      query.intent === 'election_history'
    );
  }

  async handle(query: ParsedQuery): Promise<HandlerResult> {
    const startTime = Date.now();

    try {
      switch (query.intent) {
        case 'election_results':
          return await this.handleResults(query, startTime);

        case 'election_candidate_results':
          return await this.handleCandidateResults(query, startTime);

        case 'election_turnout':
          return await this.handleTurnout(query, startTime);

        case 'election_history':
          return await this.handleHistory(query, startTime);

        default:
          return {
            success: false,
            response: RESPONSE_TEMPLATES.error.parse(query.originalQuery),
            error: 'Unknown election results intent',
          };
      }
    } catch (error) {
      return {
        success: false,
        response: RESPONSE_TEMPLATES.error.execution('process election results query'),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async handleResults(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    // Extract year from query
    const yearPattern = /(?:20)?(20|22|24|18|16)/;
    const match = query.originalQuery.match(yearPattern);
    const yearSuffix = match?.[1] || '20';
    const year = parseInt(`20${yearSuffix}`);

    // Get election results from data service (or fallback)
    const countyResults = await getCountyElectionResults();
    const yearResults = countyResults.filter(r => r.year === year);

    if (yearResults.length === 0) {
      return {
        success: false,
        response: `No election data found for ${year}. Available years: 2016, 2018, 2020, 2022, 2024.`,
        error: 'Year not found',
      };
    }

    const response = [
      `**${year} Election Results - ${enrichmentAreaLabel()}:**`,
      '',
      '| Race | Democrat | Republican | Margin | Turnout |',
      '|------|----------|------------|--------|---------|',
      ...yearResults.map(r =>
        `| ${r.race} | ${r.demCandidate} ${r.demPct.toFixed(1)}% | ${r.repCandidate} ${r.repPct.toFixed(1)}% | D+${(r.demPct - r.repPct).toFixed(1)} | ${r.turnout.toFixed(1)}% |`
      ),
      '',
      `**Total Votes:** ~${yearResults[0].totalVotes.toLocaleString()}`,
      `**Turnout:** ${yearResults[0].turnout.toFixed(1)}%`,
    ].join('\n');

    return {
      success: true,
      response,
      suggestedActions: [
        {
          id: 'compare-years',
          label: 'Compare to Previous',
          action: `Compare ${year} to ${year - 2} results`,
          priority: 1,
        },
        {
          id: 'precinct-breakdown',
          label: 'Precinct Breakdown',
          action: `Show ${year} results by precinct`,
          priority: 2,
        },
      ],
      data: yearResults,
      metadata: this.buildMetadata('election_results', startTime, query),
    };
  }

  private async handleCandidateResults(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    // Extract candidate and optionally area
    const candidatePattern = /(biden|trump|harris|whitmer|slotkin|rogers)/i;
    const match = query.originalQuery.match(candidatePattern);
    const candidate = match?.[1]?.toLowerCase() || 'biden';

    // Get election results from data service (or fallback)
    const countyResults = await getCountyElectionResults();

    // Find results for this candidate
    const candidateResults = countyResults.filter(r =>
      r.demCandidate.toLowerCase() === candidate ||
      r.repCandidate.toLowerCase() === candidate
    );

    if (candidateResults.length === 0) {
      return {
        success: false,
        response: `No results found for ${candidate}. Try: Biden, Trump, Harris, Whitmer, Slotkin, Rogers.`,
        error: 'Candidate not found',
      };
    }

    const result = candidateResults[0];
    const isDem = result.demCandidate.toLowerCase() === candidate;
    const pct = isDem ? result.demPct : result.repPct;
    const margin = isDem ? result.demPct - result.repPct : result.repPct - result.demPct;

    const response = [
      `**${candidate.charAt(0).toUpperCase() + candidate.slice(1)} Performance in ${enrichmentAreaLabel()}:**`,
      '',
      `**Race:** ${result.race} (${result.year})`,
      `**Result:** ${pct.toFixed(1)}% (${margin > 0 ? '+' : ''}${margin.toFixed(1)} margin)`,
      `**Outcome:** ${isDem ? 'Won' : 'Lost'} ${enrichmentAreaLabel()}`,
      '',
      `**Context:**`,
      `- Aggregate margin in this view: D+${(result.demPct - result.repPct).toFixed(0)}`,
      `- Turnout was ${result.turnout.toFixed(1)}%`,
      `- ~${result.totalVotes.toLocaleString()} total votes`,
    ].join('\n');

    return {
      success: true,
      response,
      suggestedActions: [
        {
          id: 'precinct-map',
          label: 'Show on Map',
          action: `Show ${candidate} results on map`,
          priority: 1,
        },
        {
          id: 'compare',
          label: 'Compare to Opponent',
          action: `Compare ${candidate} to ${isDem ? result.repCandidate : result.demCandidate}`,
          priority: 2,
        },
      ],
      data: { candidate, result },
      metadata: this.buildMetadata('election_candidate_results', startTime, query),
    };
  }

  private async handleTurnout(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    // Extract year from query
    const yearPattern = /(?:20)?(20|22|24|18|16)/;
    const match = query.originalQuery.match(yearPattern);
    const yearSuffix = match?.[1];
    const year = yearSuffix ? parseInt(`20${yearSuffix}`) : null;

    // Get election results from data service (or fallback)
    const countyResults = await getCountyElectionResults();

    // Get turnout data
    const turnoutData = year
      ? countyResults.filter(r => r.year === year).slice(0, 1)
      : countyResults.filter((r, i, arr) =>
          arr.findIndex(x => x.year === r.year) === i
        ); // Unique years

    if (year && turnoutData.length === 0) {
      return {
        success: false,
        response: `No turnout data for ${year}.`,
        error: 'Year not found',
      };
    }

    const response = year
      ? [
          `**${year} Turnout - ${enrichmentAreaLabel()}:**`,
          '',
          `**Voter Turnout:** ${turnoutData[0].turnout.toFixed(1)}%`,
          `**Total Votes:** ~${turnoutData[0].totalVotes.toLocaleString()}`,
          '',
          `*${year % 4 === 0 ? 'Presidential' : 'Midterm'} election*`,
        ].join('\n')
      : [
          `**Turnout History - ${enrichmentAreaLabel()}:**`,
          '',
          '| Year | Type | Turnout | Total Votes |',
          '|------|------|---------|-------------|',
          ...turnoutData.map(r =>
            `| ${r.year} | ${r.year % 4 === 0 ? 'Presidential' : 'Midterm'} | ${r.turnout.toFixed(1)}% | ${r.totalVotes.toLocaleString()} |`
          ),
          '',
          '*Presidential years show higher turnout than midterms*',
        ].join('\n');

    return {
      success: true,
      response,
      suggestedActions: [
        {
          id: 'turnout-trends',
          label: 'Show Turnout Trends',
          action: 'How has turnout changed over time?',
          priority: 1,
        },
        {
          id: 'low-turnout',
          label: 'Low Turnout Precincts',
          action: 'Find low turnout precincts',
          priority: 2,
        },
      ],
      data: turnoutData,
      metadata: this.buildMetadata('election_turnout', startTime, query),
    };
  }

  private async handleHistory(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    // Extract area from query
    const areaPattern = /(?:for|in)\s+(.+?)(?:\s*$|\s+over)/i;
    const match = query.originalQuery.match(areaPattern);
    const area = match?.[1]?.trim() || enrichmentAreaLabel();

    // Get enrichment
    const enrichment = await getEnrichmentForQuery(query.originalQuery);
    const enrichmentSections = formatEnrichmentSections(enrichment);

    // Get election results from data service (or fallback)
    const countyResults = await getCountyElectionResults();

    // Get unique years and presidential results
    const presidentialResults = countyResults.filter(r => r.race === 'President');

    const response = [
      `**Election History - ${area}:**`,
      '',
      '**Presidential Elections:**',
      '',
      '| Year | Democrat | Republican | Margin |',
      '|------|----------|------------|--------|',
      ...presidentialResults.map(r =>
        `| ${r.year} | ${r.demCandidate} ${r.demPct.toFixed(1)}% | ${r.repCandidate} ${r.repPct.toFixed(1)}% | D+${(r.demPct - r.repPct).toFixed(1)} |`
      ),
      '',
      '**Trend:** Use precinct-level maps for local patterns; aggregated rows above reflect the loaded dataset or fallback estimates.',
      '',
      '**Key Observations:**',
      '- Margins vary widely by county and region within Pennsylvania',
      '- Turnout is typically higher in presidential years',
      '- Compare subareas with the map and segmentation tools',
    ].join('\n');

    return {
      success: true,
      response: response + enrichmentSections,
      suggestedActions: [
        {
          id: 'partisan-trends',
          label: 'Partisan Shift Analysis',
          action: 'Show partisan trends',
          priority: 1,
        },
        {
          id: 'flip-risk',
          label: 'Flip Risk Analysis',
          action: 'Which precincts might flip?',
          priority: 2,
        },
      ],
      data: { area, results: presidentialResults },
      metadata: this.buildMetadata('election_history', startTime, query),
    };
  }

  extractEntities(query: string): ExtractedEntities {
    return {};
  }

  private buildMetadata(intent: string, startTime: number, query: ParsedQuery): any {
    return {
      handlerName: this.name,
      processingTimeMs: Date.now() - startTime,
      queryType: 'election_results',
      matchedIntent: intent,
      confidence: query.confidence,
    };
  }
}

export const electionResultsHandler = new ElectionResultsHandler();
export default ElectionResultsHandler;
