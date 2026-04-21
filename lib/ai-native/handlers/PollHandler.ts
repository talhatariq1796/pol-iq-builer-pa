/**
 * Poll NLP Handler
 *
 * Translates natural language polling queries into poll data responses.
 * Supports queries like:
 * - "What's the latest polling?"
 * - "Show me the Senate race polls"
 * - "Most competitive races"
 * - "How has polling changed?"
 */

import type {
  NLPHandler,
  ParsedQuery,
  HandlerResult,
  QueryPattern,
  ExtractedEntities,
} from './types';
import { RESPONSE_TEMPLATES, appendSources } from './types';
import { getPollIngestionPipeline } from '@/lib/poll-ingestion';
import { getPoliticalRegionEnv } from '@/lib/political/politicalRegionConfig';
import type { Poll, PollAggregate } from '@/lib/poll-ingestion';

// ============================================================================
// Query Patterns
// ============================================================================

const POLL_PATTERNS: QueryPattern[] = [
  {
    intent: 'poll_current',
    patterns: [
      /(?:latest|current|recent)\s+poll(?:s|ing)?/i,
      /what(?:'s| is)\s+the\s+(?:latest|current)\s+poll(?:s|ing)?/i,
      /show\s+(?:me\s+)?(?:the\s+)?poll(?:s|ing)?/i,
      /poll(?:ing)?\s+(?:data|numbers|results)/i,
      /where\s+(?:do|does)\s+(?:the\s+)?race(?:s)?\s+stand/i,
    ],
    keywords: ['poll', 'polling', 'latest', 'current', 'survey'],
    priority: 10,
  },
  {
    intent: 'poll_race',
    patterns: [
      /poll(?:s|ing)?\s+(?:for|in|on)\s+(?:the\s+)?(.+?)(?:\s+race)?$/i,
      /(?:senate|house|governor|presidential)\s+(?:race\s+)?poll(?:s|ing)?/i,
      /mi-?\d+\s+poll(?:s|ing)?/i,
      /(.+?)\s+race\s+poll(?:s|ing)?/i,
      /how\s+(?:is|are)\s+(?:the\s+)?(.+?)\s+(?:race|races)\s+(?:polling|looking)/i,
    ],
    keywords: ['poll', 'race', 'senate', 'house', 'governor', 'president'],
    priority: 11,
  },
  {
    intent: 'poll_competitive',
    patterns: [
      /(?:most\s+)?competitive\s+races?/i,
      /close(?:st)?\s+races?/i,
      // Do not match bare "toss-up" — that hits precinct targeting ("toss-up seats", QuickStarts)
      /toss[- ]?up\s+races?/i,
      /races?\s+(?:that\s+are\s+)?(?:toss|within|under)/i,
      /(?:tight|narrow)\s+races?/i,
      /races?\s+(?:within|under)\s+\d+\s+points?/i,
      /poll(?:s|ing)?\s+.*\b(?:competitive|toss|close|tight)\b/i,
      /\b(?:competitive|close|tight)\s+(?:senate|house|governor|presidential)?\s*races?\b/i,
    ],
    keywords: ['competitive', 'close', 'toss-up', 'tight', 'narrow'],
    priority: 10,
  },
  {
    intent: 'poll_trend',
    patterns: [
      /poll(?:ing)?\s+trends?/i,
      /how\s+has\s+poll(?:ing)?\s+changed/i,
      /poll(?:ing)?\s+(?:momentum|movement|shift)/i,
      /trending\s+(?:in\s+)?poll(?:s|ing)?/i,
      /poll(?:ing)?\s+over\s+time/i,
    ],
    keywords: ['trend', 'momentum', 'shift', 'movement', 'changed'],
    priority: 9,
  },
  {
    intent: 'poll_refresh',
    patterns: [
      /(?:refresh|update|fetch)\s+poll(?:s|ing)?(?:\s+data)?/i,
      /get\s+(?:new|latest)\s+poll(?:s|ing)?/i,
      /run\s+poll\s+ingestion/i,
      /sync\s+poll(?:s|ing)?/i,
    ],
    keywords: ['refresh', 'update', 'fetch', 'sync', 'ingestion'],
    priority: 8,
  },
];

// ============================================================================
// Poll Handler Class
// ============================================================================

export class PollHandler implements NLPHandler {
  name = 'PollHandler';
  patterns = POLL_PATTERNS;

  /**
   * Check if this handler can process the query
   */
  canHandle(query: ParsedQuery): boolean {
    const pollIntents = ['poll_current', 'poll_race', 'poll_competitive', 'poll_trend', 'poll_refresh'];

    // Check if intent matches
    if (pollIntents.includes(query.intent)) {
      return true;
    }

    // Pattern match fallback
    const text = query.originalQuery.toLowerCase();
    return POLL_PATTERNS.some((pattern) =>
      pattern.patterns.some((p) => p.test(text))
    );
  }

  /**
   * Extract entities from query
   */
  extractEntities(query: string): ExtractedEntities {
    const entities: ExtractedEntities = {};
    const text = query.toLowerCase();

    // Extract race type
    if (/senate/i.test(text)) {
      entities.raceType = 'senate';
    } else if (/house|congress/i.test(text)) {
      entities.raceType = 'house';
    } else if (/governor/i.test(text)) {
      entities.raceType = 'governor';
    } else if (/president/i.test(text)) {
      entities.raceType = 'president';
    }

    // Extract race ID patterns (MI-07, MI-SEN, etc.)
    const raceIdMatch = text.match(/mi-?(\d+|sen|gov)/i);
    if (raceIdMatch) {
      entities.raceId = `MI-${raceIdMatch[1].toUpperCase()}`;
    }

    // Extract geography
    if (/michigan/i.test(text)) {
      entities.jurisdictions = ['Michigan'];
    }

    return entities;
  }

  /**
   * Handle the poll query
   */
  async handle(query: ParsedQuery): Promise<HandlerResult> {
    const startTime = Date.now();

    try {
      const pipeline = getPollIngestionPipeline();

      switch (query.intent) {
        case 'poll_current':
          return await this.handleCurrentPolls(query, pipeline, startTime);
        case 'poll_race':
          return await this.handleRacePolls(query, pipeline, startTime);
        case 'poll_competitive':
          return await this.handleCompetitiveRaces(query, pipeline, startTime);
        case 'poll_trend':
          return await this.handlePollTrends(query, pipeline, startTime);
        case 'poll_refresh':
          return await this.handleRefresh(query, pipeline, startTime);
        default:
          // Default to current polls
          return await this.handleCurrentPolls(query, pipeline, startTime);
      }
    } catch (error) {
      return this.errorResult(`Failed to process poll query: ${error}`, startTime);
    }
  }

  // ==========================================================================
  // Intent Handlers
  // ==========================================================================

  private async handleCurrentPolls(
    query: ParsedQuery,
    pipeline: ReturnType<typeof getPollIngestionPipeline>,
    startTime: number
  ): Promise<HandlerResult> {
    const aggregates = await pipeline.getMichiganAggregates();

    if (aggregates.length === 0) {
      return {
        success: true,
        response: this.noDataResponse(),
        suggestedActions: [
          {
            id: 'refresh-polls',
            label: 'Fetch Latest Polls',
            action: 'query:poll_refresh',
            icon: 'refresh',
          },
        ],
        metadata: this.buildMetadata('poll_current', startTime, query),
      };
    }

    const response = this.formatAggregatesResponse(aggregates);

    return {
      success: true,
      response: appendSources(response, ['elections']),
      data: { aggregates },
      suggestedActions: this.getPollActions(aggregates),
      metadata: this.buildMetadata('poll_current', startTime, query),
    };
  }

  private async handleRacePolls(
    query: ParsedQuery,
    pipeline: ReturnType<typeof getPollIngestionPipeline>,
    startTime: number
  ): Promise<HandlerResult> {
    const entities = this.extractEntities(query.originalQuery);

    // Try to find specific race
    if (entities.raceId) {
      const aggregate = await pipeline.getAggregate(entities.raceId);
      const polls = await pipeline.getPollsForRace(entities.raceId);

      if (aggregate) {
        const response = this.formatSingleRaceResponse(aggregate, polls);
        return {
          success: true,
          response: appendSources(response, ['elections']),
          data: { aggregate, polls },
          suggestedActions: this.getRaceActions(aggregate),
          metadata: this.buildMetadata('poll_race', startTime, query),
        };
      }
    }

    // Filter by race type if specified
    const aggregates = await pipeline.getMichiganAggregates();
    let filtered = aggregates;

    if (entities.raceType) {
      filtered = aggregates.filter((a) =>
        a.race_id.toLowerCase().includes(entities.raceType!)
      );
    }

    if (filtered.length === 0) {
      return {
        success: true,
        response: `No polling data found${entities.raceType ? ` for ${entities.raceType} races` : ''}. Try refreshing the poll data.`,
        suggestedActions: [
          {
            id: 'refresh-polls',
            label: 'Fetch Latest Polls',
            action: 'query:poll_refresh',
          },
        ],
        metadata: this.buildMetadata('poll_race', startTime, query),
      };
    }

    const response = this.formatAggregatesResponse(filtered);

    return {
      success: true,
      response: appendSources(response, ['elections']),
      data: { aggregates: filtered },
      suggestedActions: this.getPollActions(filtered),
      metadata: this.buildMetadata('poll_race', startTime, query),
    };
  }

  private async handleCompetitiveRaces(
    query: ParsedQuery,
    pipeline: ReturnType<typeof getPollIngestionPipeline>,
    startTime: number
  ): Promise<HandlerResult> {
    const competitive = await pipeline.getCompetitiveRaces();

    if (competitive.length === 0) {
      const aggregates = await pipeline.getMichiganAggregates();
      if (aggregates.length === 0) {
        return {
          success: true,
          response: this.noDataResponse(),
          suggestedActions: [
            {
              id: 'refresh-polls',
              label: 'Fetch Latest Polls',
              action: 'query:poll_refresh',
            },
          ],
          metadata: this.buildMetadata('poll_competitive', startTime, query),
        };
      }

      return {
        success: true,
        response: `No races within 5 points found in current polling.\n\n${this.formatAggregatesResponse(aggregates.slice(0, 3))}`,
        data: { aggregates },
        metadata: this.buildMetadata('poll_competitive', startTime, query),
      };
    }

    let response = `**Most Competitive Races** (margin < 5 points):\n\n`;

    for (const agg of competitive.slice(0, 5)) {
      const leaderCandidate = agg.candidates.find(c => c.name === agg.leader);
      const leaderParty = this.getPartyEmoji(leaderCandidate?.party || '');
      response += `**${agg.race_name}** ${leaderParty}\n`;
      response += `${agg.leader} leads by ${Math.abs(agg.margin).toFixed(1)} points\n`;
      response += `*${agg.poll_count} polls, last updated ${this.formatDate(agg.last_updated)}*\n\n`;
    }

    return {
      success: true,
      response: appendSources(response, ['elections']),
      data: { competitive },
      suggestedActions: this.getPollActions(competitive),
      metadata: this.buildMetadata('poll_competitive', startTime, query),
    };
  }

  private async handlePollTrends(
    query: ParsedQuery,
    pipeline: ReturnType<typeof getPollIngestionPipeline>,
    startTime: number
  ): Promise<HandlerResult> {
    const aggregates = await pipeline.getMichiganAggregates();

    if (aggregates.length === 0) {
      return {
        success: true,
        response: this.noDataResponse(),
        suggestedActions: [
          {
            id: 'refresh-polls',
            label: 'Fetch Latest Polls',
            action: 'query:poll_refresh',
          },
        ],
        metadata: this.buildMetadata('poll_trend', startTime, query),
      };
    }

    let response = `**Polling Trends** (Michigan races):\n\n`;

    for (const agg of aggregates.slice(0, 5)) {
      const trendArrow = this.getTrendArrow(agg.trend_direction || 'stable');
      response += `**${agg.race_name}** ${trendArrow}\n`;
      response += `Current: ${agg.leader} +${Math.abs(agg.margin).toFixed(1)}\n`;

      if (agg.trend_direction && agg.trend_direction !== 'stable') {
        response += `*Trending ${agg.trend_direction}*\n`;
      }
      response += '\n';
    }

    return {
      success: true,
      response: appendSources(response, ['elections']),
      data: { aggregates },
      metadata: this.buildMetadata('poll_trend', startTime, query),
    };
  }

  private async handleRefresh(
    query: ParsedQuery,
    pipeline: ReturnType<typeof getPollIngestionPipeline>,
    startTime: number
  ): Promise<HandlerResult> {
    try {
      const result = await pipeline.run({
        sources: ['fivethirtyeight', 'votehub'],
        fetchOptions: { state: 'Michigan' },
      });

      if (result.success) {
        let response = `**Poll Data Refreshed**\n\n`;
        response += `- Polls fetched: ${result.pollsFetched}\n`;
        response += `- New polls stored: ${result.pollsStored}\n`;
        response += `- Race aggregates: ${result.aggregatesCalculated}\n`;
        response += `- Duration: ${result.duration}ms\n`;

        if (result.errors.length > 0) {
          response += `\n*Warnings: ${result.errors.join(', ')}*`;
        }

        return {
          success: true,
          response,
          data: result,
          suggestedActions: [
            {
              id: 'view-polls',
              label: 'View Latest Polls',
              action: 'query:poll_current',
            },
            {
              id: 'view-competitive',
              label: 'Competitive Races',
              action: 'query:poll_competitive',
            },
          ],
          metadata: this.buildMetadata('poll_refresh', startTime, query),
        };
      } else {
        return {
          success: false,
          response: `Poll refresh failed: ${result.errors.join(', ')}`,
          error: result.errors.join(', '),
          metadata: this.buildMetadata('poll_refresh', startTime, query),
        };
      }
    } catch (error) {
      return this.errorResult(`Failed to refresh polls: ${error}`, startTime);
    }
  }

  // ==========================================================================
  // Formatting Helpers
  // ==========================================================================

  private formatAggregatesResponse(aggregates: PollAggregate[]): string {
    if (aggregates.length === 0) {
      return this.noDataResponse();
    }

    let response = `**Current Polling** (${aggregates.length} races):\n\n`;

    for (const agg of aggregates.slice(0, 5)) {
      const leaderCandidate = agg.candidates.find(c => c.name === agg.leader);
      const leaderParty = this.getPartyEmoji(leaderCandidate?.party || '');
      const competitiveness = this.getCompetitivenessLabel(agg.margin);

      response += `**${agg.race_name}** ${leaderParty}\n`;
      response += `${agg.leader} +${Math.abs(agg.margin).toFixed(1)} (${competitiveness})\n`;
      response += `*${agg.poll_count} polls*\n\n`;
    }

    if (aggregates.length > 5) {
      response += `*...and ${aggregates.length - 5} more races*\n`;
    }

    return response;
  }

  private formatSingleRaceResponse(aggregate: PollAggregate, polls: Poll[]): string {
    let response = `**${aggregate.race_name}**\n\n`;
    response += `**Current Leader:** ${aggregate.leader} (+${Math.abs(aggregate.margin).toFixed(1)})\n\n`;

    response += `| Candidate | Party | Average | Polls |\n`;
    response += `|-----------|-------|---------|-------|\n`;

    for (const candidate of aggregate.candidates) {
      response += `| ${candidate.name} | ${candidate.party} | ${candidate.average.toFixed(1)}% | ${candidate.poll_count} |\n`;
    }

    response += `\n*Based on ${aggregate.poll_count} polls. Last updated: ${this.formatDate(aggregate.last_updated)}*\n`;

    if (polls.length > 0) {
      response += `\n**Recent Polls:**\n`;
      for (const poll of polls.slice(0, 3)) {
        response += `- ${poll.pollster}: ${poll.end_date}\n`;
      }
    }

    return response;
  }

  private noDataResponse(): string {
    const area = getPoliticalRegionEnv().summaryAreaName || getPoliticalRegionEnv().state;
    return `**No Polling Data Available**

The poll ingestion pipeline hasn't been run yet, or no polls are available for ${area}.

To fetch the latest polling data, ask me to "refresh polls" or "update polling data".

*Polling data is sourced from FiveThirtyEight and VoteHub.*`;
  }

  private getPartyEmoji(party: string): string {
    if (party === 'DEM' || party === 'Democratic') return '(D)';
    if (party === 'REP' || party === 'Republican') return '(R)';
    return `(${party})`;
  }

  private getCompetitivenessLabel(margin: number): string {
    const absMargin = Math.abs(margin);
    if (absMargin < 2) return 'Toss-up';
    if (absMargin < 5) return 'Lean';
    if (absMargin < 10) return 'Likely';
    return 'Safe';
  }

  private getTrendArrow(trend: string): string {
    switch (trend) {
      case 'dem_gaining': return '↗️ D';
      case 'rep_gaining': return '↗️ R';
      case 'stable': return '→';
      default: return '';
    }
  }

  private formatDate(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  }

  // ==========================================================================
  // Actions & Metadata
  // ==========================================================================

  private getPollActions(aggregates: PollAggregate[]): HandlerResult['suggestedActions'] {
    const actions: HandlerResult['suggestedActions'] = [
      {
        id: 'competitive-races',
        label: 'Most Competitive',
        action: 'query:poll_competitive',
        icon: 'chart',
      },
      {
        id: 'refresh-polls',
        label: 'Refresh Data',
        action: 'query:poll_refresh',
        icon: 'refresh',
      },
    ];

    // Add specific race actions
    if (aggregates.length > 0) {
      const firstRace = aggregates[0];
      actions.unshift({
        id: `race-${firstRace.race_id}`,
        label: firstRace.race_name.split(' ')[0],
        action: `query:Polling for ${firstRace.race_name}`,
      });
    }

    return actions;
  }

  private getRaceActions(aggregate: PollAggregate): HandlerResult['suggestedActions'] {
    return [
      {
        id: 'all-polls',
        label: 'All Michigan Polls',
        action: 'query:poll_current',
      },
      {
        id: 'competitive',
        label: 'Competitive Races',
        action: 'query:poll_competitive',
      },
      {
        id: 'refresh',
        label: 'Refresh Data',
        action: 'query:poll_refresh',
      },
    ];
  }

  private buildMetadata(intent: string, startTime: number, query: ParsedQuery) {
    return {
      handlerName: this.name,
      processingTimeMs: Date.now() - startTime,
      queryType: 'polling',
      matchedIntent: intent,
      confidence: query.confidence,
    };
  }

  private errorResult(message: string, startTime: number): HandlerResult {
    return {
      success: false,
      response: RESPONSE_TEMPLATES.error.execution('process poll query'),
      error: message,
      metadata: {
        handlerName: this.name,
        processingTimeMs: Date.now() - startTime,
        queryType: 'polling',
        matchedIntent: 'unknown',
        confidence: 0,
      },
    };
  }
}

// Singleton instance
let handlerInstance: PollHandler | null = null;

export function getPollHandler(): PollHandler {
  if (!handlerInstance) {
    handlerInstance = new PollHandler();
  }
  return handlerInstance;
}
