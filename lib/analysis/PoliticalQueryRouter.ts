/**
 * Political Query Router
 *
 * Parses natural language political queries and routes to appropriate handlers.
 * Supports queries like:
 * - "Compare Philadelphia vs Pittsburgh"
 * - "Which precincts in Harrisburg have highest swing potential?"
 * - "Show turnout trends in Reading"
 * - "What's the partisan lean of Allentown?"
 */

import { politicalGeoDataManager, PoliticalGeoDataManager, PoliticalGeographicEntity } from '../geo/PoliticalGeoDataManager';

export type PoliticalQueryType =
  | 'comparison'
  | 'ranking'
  | 'aggregation'
  | 'trend'
  | 'profile'
  | 'filter'
  | 'general';

export type PoliticalMetric =
  | 'partisan_lean'
  | 'swing_potential'
  | 'gotv_priority'
  | 'persuasion_opportunity'
  | 'turnout'
  | 'combined_score'
  | 'demographics'
  /** Modeled bachelor's+ share (precinct demographics) */
  | 'college_pct';

export interface ParsedPoliticalQuery {
  type: PoliticalQueryType;
  locations: PoliticalGeographicEntity[];
  locationNames: string[];
  metric?: PoliticalMetric;
  ranking?: 'highest' | 'lowest';
  limit?: number;
  timeRange?: 'current' | 'historical' | 'trend';
  confidence: number;
  originalQuery: string;
  normalizedQuery: string;
}

export interface QueryRouteResult {
  parsed: ParsedPoliticalQuery;
  handler: string;
  suggestedResponse?: string;
  dataNeeded: string[];
}

export class PoliticalQueryRouter {
  private geoManager: PoliticalGeoDataManager;

  // Patterns for query type detection
  private readonly COMPARISON_PATTERNS = [
    /compare\s+(.+?)\s+(?:vs\.?|versus|to|with|and)\s+(.+)/i,
    /(.+?)\s+(?:vs\.?|versus)\s+(.+)/i,
    /difference\s+between\s+(.+?)\s+and\s+(.+)/i,
    /how\s+does\s+(.+?)\s+compare\s+to\s+(.+)/i,
  ];

  private readonly RANKING_PATTERNS = [
    /(?:which|what)\s+(?:precincts?|areas?|jurisdictions?)\s+(?:in\s+)?(.+?)\s+(?:have|has|show)\s+(?:the\s+)?(?:highest|most|best)\s+(.+)/i,
    /(?:which|what)\s+(?:precincts?|areas?|jurisdictions?)\s+(?:in\s+)?(.+?)\s+(?:have|has|show)\s+(?:the\s+)?(?:lowest|least|worst)\s+(.+)/i,
    /(?:top|best|highest)\s+(\d+)?\s*(?:precincts?|areas?|jurisdictions?)\s+(?:in|for|by)\s+(.+)/i,
    /(?:bottom|worst|lowest)\s+(\d+)?\s*(?:precincts?|areas?|jurisdictions?)\s+(?:in|for|by)\s+(.+)/i,
  ];

  private readonly PROFILE_PATTERNS = [
    /(?:what(?:'s| is)?|tell me about|describe|profile)\s+(?:the\s+)?(.+?)(?:\s+like|\?|$)/i,
    /(?:partisan lean|swing potential|turnout|demographics?)\s+(?:of|in|for)\s+(.+)/i,
    // "Show me the full profile for X" — allow optional "full" before profile
    /(?:show|get|display)\s+(?:me\s+)?(?:the\s+)?(?:full\s+)?(?:political\s+)?(?:profile|data|info)\s+(?:for|of|about)\s+(.+)/i,
  ];

  private readonly FILTER_PATTERNS = [
    /(?:find|show|list)\s+(?:all\s+)?(.+?)\s+(?:precincts?|areas?)\s+(?:with|where)\s+(.+)/i,
    /(?:precincts?|areas?)\s+(?:with|where)\s+(.+)/i,
  ];

  private readonly TREND_PATTERNS = [
    /(?:trend|trends?|history|historical|over time)\s+(?:in|for|of)\s+(.+)/i,
    /how\s+has\s+(.+?)\s+changed/i,
    /(?:turnout|voting|partisan)\s+trends?\s+(?:in|for)\s+(.+)/i,
  ];

  // Metric keywords
  private readonly METRIC_KEYWORDS: Record<string, PoliticalMetric> = {
    partisan: 'partisan_lean',
    'partisan lean': 'partisan_lean',
    lean: 'partisan_lean',
    democratic: 'partisan_lean',
    republican: 'partisan_lean',
    swing: 'swing_potential',
    'swing potential': 'swing_potential',
    competitive: 'swing_potential',
    volatility: 'swing_potential',
    gotv: 'gotv_priority',
    'get out the vote': 'gotv_priority',
    mobilization: 'gotv_priority',
    turnout: 'turnout',
    'voter turnout': 'turnout',
    participation: 'turnout',
    persuasion: 'persuasion_opportunity',
    persuadable: 'persuasion_opportunity',
    undecided: 'persuasion_opportunity',
    demographic: 'demographics',
    demographics: 'demographics',
    population: 'demographics',
    'college-educated': 'college_pct',
    'college educated': 'college_pct',
    'college-educated voters': 'college_pct',
    'bachelor\'s degree': 'college_pct',
    'bachelors degree': 'college_pct',
    'education attainment': 'college_pct',
    'college degree': 'college_pct',
    'college education': 'college_pct',
    'college concentration': 'college_pct',
    'highly educated': 'college_pct',
    college: 'college_pct',
    bachelor: 'college_pct',
    bachelors: 'college_pct',
    score: 'combined_score',
    overall: 'combined_score',
    combined: 'combined_score',
    'targeting priority': 'combined_score',
    'combined targeting': 'combined_score',
  };

  constructor() {
    this.geoManager = politicalGeoDataManager;
  }

  /**
   * Parse and route a political query
   */
  public parseQuery(query: string): QueryRouteResult {
    const normalizedQuery = query.toLowerCase().trim();
    const parsed: ParsedPoliticalQuery = {
      type: 'general',
      locations: [],
      locationNames: [],
      confidence: 0,
      originalQuery: query,
      normalizedQuery,
    };

    // Try each pattern type in order of specificity
    let result = this.tryComparison(normalizedQuery, parsed);
    if (result.parsed.confidence > 0.6) return result;

    result = this.tryRanking(normalizedQuery, parsed);
    if (result.parsed.confidence > 0.6) return result;

    result = this.tryTrend(normalizedQuery, parsed);
    if (result.parsed.confidence > 0.6) return result;

    result = this.tryProfile(normalizedQuery, parsed);
    if (result.parsed.confidence > 0.5) return result;

    result = this.tryFilter(normalizedQuery, parsed);
    if (result.parsed.confidence > 0.5) return result;

    // Fall back to general query
    return this.handleGeneral(normalizedQuery, parsed);
  }

  private tryComparison(query: string, parsed: ParsedPoliticalQuery): QueryRouteResult {
    for (const pattern of this.COMPARISON_PATTERNS) {
      const match = query.match(pattern);
      if (match) {
        const loc1 = this.geoManager.resolveLocation(match[1].trim());
        const loc2 = this.geoManager.resolveLocation(match[2].trim());

        if (loc1 && loc2) {
          parsed.type = 'comparison';
          parsed.locations = [loc1, loc2];
          parsed.locationNames = [loc1.name, loc2.name];
          parsed.metric = this.extractMetric(query);
          parsed.confidence = 0.9;

          return {
            parsed,
            handler: 'comparison',
            dataNeeded: ['jurisdiction_aggregates'],
            suggestedResponse: `I'll compare ${loc1.name} and ${loc2.name}${parsed.metric ? ` by ${parsed.metric.replace('_', ' ')}` : ''}.`,
          };
        } else if (loc1 || loc2) {
          // Partial match - one location recognized
          parsed.type = 'comparison';
          parsed.locations = [loc1, loc2].filter(Boolean) as PoliticalGeographicEntity[];
          parsed.locationNames = [match[1].trim(), match[2].trim()];
          parsed.confidence = 0.5;

          return {
            parsed,
            handler: 'comparison',
            dataNeeded: ['jurisdiction_aggregates'],
            suggestedResponse: `I found ${parsed.locations[0]?.name || 'one location'}, but couldn't identify the other. Did you mean one of these: ${this.geoManager.getAllJurisdictions().slice(0, 5).join(', ')}?`,
          };
        }
      }
    }

    return { parsed, handler: 'general', dataNeeded: [] };
  }

  private tryRanking(query: string, parsed: ParsedPoliticalQuery): QueryRouteResult {
    // "List/show the top N most competitive areas" — statewide precinct ranking (swing_potential), not general chat
    const topNCompetitiveAreas = query.match(
      /(?:show|find|list)\s+(?:me\s+)?(?:the\s+)?top\s+(\d+)\s+(?:most\s+)?(?:competitive|swing|volatile|battleground)\s+(?:areas|precincts|jurisdictions?)\b/i
    );
    if (topNCompetitiveAreas) {
      const limit = Math.min(100, Math.max(1, parseInt(topNCompetitiveAreas[1], 10) || 10));
      parsed.type = 'ranking';
      parsed.metric = this.extractMetric(query) || 'swing_potential';
      parsed.ranking = 'highest';
      parsed.limit = limit;
      parsed.confidence = 0.88;
      parsed.locationNames = [];
      parsed.locations = [];
      return {
        parsed,
        handler: 'ranking',
        dataNeeded: ['precinct_scores', 'targeting_scores'],
        suggestedResponse: `I'll list the top ${limit} precincts by ${parsed.metric?.replace('_', ' ') || 'swing potential'}.`,
      };
    }

    // "Show/List precincts with the highest/top ..." (e.g. college concentration) — statewide unless "in <place>"
    const showPrecinctsWithExtreme = query.match(
      /(?:show|find|list)\s+(?:me\s+)?(?:the\s+)?precincts?\s+with\s+(?:the\s+)?(?:highest|top|most|lowest|least)\b/i
    );
    if (showPrecinctsWithExtreme) {
      const isHighest = !/\b(?:lowest|least|worst|bottom)\b/i.test(query);
      const limitMatch = query.match(/\b(?:top|first|bottom)\s+(\d+)\b/i);
      const limit = limitMatch ? parseInt(limitMatch[1], 10) : 15;
      parsed.type = 'ranking';
      parsed.metric = this.extractMetric(query);
      parsed.ranking = isHighest ? 'highest' : 'lowest';
      parsed.limit = limit;
      parsed.confidence = 0.87;
      parsed.locationNames = [];
      parsed.locations = [];
      const inJurisdiction = query.match(
        /\b(?:in|within|inside)\s+([a-z0-9][a-z0-9\s,'.-]{2,60}?)(?:\s*[.(]|$)/i
      );
      if (inJurisdiction) {
        const loc = this.geoManager.resolveLocation(inJurisdiction[1].trim());
        if (loc) {
          parsed.locations = [loc];
          parsed.locationNames = [loc.name];
        }
      }
      return {
        parsed,
        handler: 'ranking',
        dataNeeded: ['precinct_scores', 'targeting_scores', 'precinct_demographics'],
        suggestedResponse: `I'll list precincts by ${parsed.metric?.replace('_', ' ') || 'the requested metric'}.`,
      };
    }

    // "Rank precincts in <jurisdiction> by <metric>" (precincts within a place)
    const rankPrecinctsInPlace = query.match(
      /\brank\s+(?:the\s+)?precincts?\s+(?:in|of)\s+(.+?)\s+by\b/i
    );
    if (rankPrecinctsInPlace) {
      const location = this.geoManager.resolveLocation(rankPrecinctsInPlace[1].trim());
      if (location) {
        const isHighest = !/lowest|bottom|worst/i.test(query);
        const limitMatch = query.match(/\b(?:top|first|bottom)\s+(\d+)\b/i);
        const limit = limitMatch ? parseInt(limitMatch[1], 10) : 15;
        parsed.type = 'ranking';
        parsed.locations = [location];
        parsed.locationNames = [location.name];
        parsed.metric = this.extractMetric(query);
        parsed.ranking = isHighest ? 'highest' : 'lowest';
        parsed.limit = limit;
        parsed.confidence = 0.88;
        return {
          parsed,
          handler: 'ranking',
          dataNeeded: ['precinct_scores', 'targeting_scores'],
          suggestedResponse: `I'll rank precincts in ${location.name} by ${parsed.metric?.replace('_', ' ') || 'the requested metric'}.`,
        };
      }
    }

    // "Rank precincts by <metric>" (statewide — no jurisdiction)
    if (/\brank\s+(?:the\s+)?precincts?\s+by\b/i.test(query)) {
      const isHighest = !/lowest|bottom|worst/i.test(query);
      const limitMatch = query.match(/\b(?:top|first|bottom)\s+(\d+)\b/i);
      const limit = limitMatch ? parseInt(limitMatch[1], 10) : 15;
      parsed.type = 'ranking';
      parsed.locationNames = [];
      parsed.metric = this.extractMetric(query);
      parsed.ranking = isHighest ? 'highest' : 'lowest';
      parsed.limit = limit;
      parsed.confidence = 0.88;
      return {
        parsed,
        handler: 'ranking',
        dataNeeded: ['precinct_scores', 'targeting_scores'],
        suggestedResponse: `I'll rank precincts statewide by ${parsed.metric?.replace('_', ' ') || 'targeting priority'}.`,
      };
    }

    for (const pattern of this.RANKING_PATTERNS) {
      const match = query.match(pattern);
      if (match) {
        // Determine if highest or lowest
        const isHighest = /highest|most|best|top/i.test(query);
        const isLowest = /lowest|least|worst|bottom/i.test(query);

        // Extract location (if any)
        const locationMatch = match[1] || match[2];
        const location = locationMatch ? this.geoManager.resolveLocation(locationMatch.trim()) : null;

        // Extract limit (e.g., "top 5")
        const limitMatch = query.match(/(?:top|bottom)\s+(\d+)/i);
        const limit = limitMatch ? parseInt(limitMatch[1]) : 10;

        parsed.type = 'ranking';
        if (location) {
          parsed.locations = [location];
          parsed.locationNames = [location.name];
        }
        parsed.metric = this.extractMetric(query);
        parsed.ranking = isHighest ? 'highest' : isLowest ? 'lowest' : 'highest';
        parsed.limit = limit;
        parsed.confidence = 0.85;

        return {
          parsed,
          handler: 'ranking',
          dataNeeded: ['precinct_scores', 'targeting_scores'],
          suggestedResponse: `I'll find the ${parsed.ranking} ${parsed.metric?.replace('_', ' ') || 'scoring'} precincts${location ? ` in ${location.name}` : ''}.`,
        };
      }
    }

    return { parsed, handler: 'general', dataNeeded: [] };
  }

  private tryTrend(query: string, parsed: ParsedPoliticalQuery): QueryRouteResult {
    for (const pattern of this.TREND_PATTERNS) {
      const match = query.match(pattern);
      if (match) {
        const locationText = match[1].trim();
        const location = this.geoManager.resolveLocation(locationText);

        if (location) {
          parsed.type = 'trend';
          parsed.locations = [location];
          parsed.locationNames = [location.name];
          parsed.metric = this.extractMetric(query) || 'turnout';
          parsed.timeRange = 'historical';
          parsed.confidence = 0.8;

          return {
            parsed,
            handler: 'trend',
            dataNeeded: ['election_results', 'historical_data'],
            suggestedResponse: `I'll show ${parsed.metric?.replace('_', ' ')} trends for ${location.name} over recent elections.`,
          };
        }
      }
    }

    return { parsed, handler: 'general', dataNeeded: [] };
  }

  private tryProfile(query: string, parsed: ParsedPoliticalQuery): QueryRouteResult {
    for (const pattern of this.PROFILE_PATTERNS) {
      const match = query.match(pattern);
      if (match) {
        const locationText = match[1].trim();
        const location = this.geoManager.resolveLocation(locationText);

        if (location) {
          parsed.type = 'profile';
          parsed.locations = [location];
          parsed.locationNames = [location.name];
          parsed.metric = this.extractMetric(query);
          parsed.confidence = 0.75;

          return {
            parsed,
            handler: 'profile',
            dataNeeded: ['jurisdiction_aggregates', 'demographics', 'targeting_scores'],
            suggestedResponse: `I'll provide a political profile for ${location.name}.`,
          };
        }
      }
    }

    // Try to find any location mentioned
    const allJurisdictions = this.geoManager.getAllJurisdictions();
    for (const jurisdiction of allJurisdictions) {
      if (query.toLowerCase().includes(jurisdiction.toLowerCase())) {
        const location = this.geoManager.resolveLocation(jurisdiction);
        if (location) {
          parsed.type = 'profile';
          parsed.locations = [location];
          parsed.locationNames = [location.name];
          parsed.metric = this.extractMetric(query);
          parsed.confidence = 0.6;

          return {
            parsed,
            handler: 'profile',
            dataNeeded: ['jurisdiction_aggregates'],
          };
        }
      }
    }

    return { parsed, handler: 'general', dataNeeded: [] };
  }

  private tryFilter(query: string, parsed: ParsedPoliticalQuery): QueryRouteResult {
    for (const pattern of this.FILTER_PATTERNS) {
      const match = query.match(pattern);
      if (match) {
        parsed.type = 'filter';
        parsed.metric = this.extractMetric(query);
        parsed.confidence = 0.7;

        return {
          parsed,
          handler: 'filter',
          dataNeeded: ['precinct_scores', 'targeting_scores'],
          suggestedResponse: `I'll filter precincts based on your criteria.`,
        };
      }
    }

    return { parsed, handler: 'general', dataNeeded: [] };
  }

  private handleGeneral(query: string, parsed: ParsedPoliticalQuery): QueryRouteResult {
    // Check if any political keywords are present
    const hasPoliticalKeywords = Object.keys(this.METRIC_KEYWORDS).some((keyword) =>
      query.includes(keyword)
    );

    // Check if any locations are mentioned
    const allJurisdictions = this.geoManager.getAllJurisdictions();
    const mentionedLocations: PoliticalGeographicEntity[] = [];

    for (const jurisdiction of allJurisdictions) {
      if (query.toLowerCase().includes(jurisdiction.toLowerCase())) {
        const location = this.geoManager.resolveLocation(jurisdiction);
        if (location) {
          mentionedLocations.push(location);
        }
      }
    }

    if (mentionedLocations.length > 0) {
      parsed.locations = mentionedLocations;
      parsed.locationNames = mentionedLocations.map((l) => l.name);
    }

    parsed.metric = this.extractMetric(query);
    parsed.confidence = hasPoliticalKeywords ? 0.5 : 0.3;

    return {
      parsed,
      handler: 'general',
      dataNeeded: mentionedLocations.length > 0 ? ['jurisdiction_aggregates'] : [],
    };
  }

  private extractMetric(query: string): PoliticalMetric | undefined {
    const lowerQuery = query.toLowerCase();

    // Try multi-word matches first
    const sortedKeywords = Object.entries(this.METRIC_KEYWORDS).sort(
      (a, b) => b[0].length - a[0].length
    );

    for (const [keyword, metric] of sortedKeywords) {
      if (lowerQuery.includes(keyword)) {
        return metric;
      }
    }

    return undefined;
  }

  /**
   * Get all recognized locations in a query
   */
  public extractLocations(query: string): PoliticalGeographicEntity[] {
    const locations: PoliticalGeographicEntity[] = [];
    const allJurisdictions = this.geoManager.getAllJurisdictions();

    for (const jurisdiction of allJurisdictions) {
      if (query.toLowerCase().includes(jurisdiction.toLowerCase())) {
        const location = this.geoManager.resolveLocation(jurisdiction);
        if (location && !locations.find((l) => l.name === location.name)) {
          locations.push(location);
        }
      }
    }

    // Also check regional groups
    const regionalGroups = ['urban', 'suburban', 'rural', 'lansing metro', 'university area', 'capital area'];
    for (const group of regionalGroups) {
      if (query.toLowerCase().includes(group)) {
        const groupMembers = this.geoManager.getRegionalGroup(group);
        for (const member of groupMembers) {
          const location = this.geoManager.resolveLocation(member);
          if (location && !locations.find((l) => l.name === location.name)) {
            locations.push(location);
          }
        }
      }
    }

    return locations;
  }

  /**
   * Suggest query completions based on partial input
   */
  public suggestCompletions(partialQuery: string): string[] {
    const suggestions: string[] = [];
    const lower = partialQuery.toLowerCase();

    // Suggest jurisdictions
    if (lower.includes('compare') || lower.includes('vs')) {
      const jurisdictions = this.geoManager.getAllJurisdictions();
      for (const j of jurisdictions.slice(0, 5)) {
        suggestions.push(`Compare ${j} vs Lansing`);
      }
    }

    // Suggest metrics
    if (lower.includes('highest') || lower.includes('top')) {
      suggestions.push(
        'Which precincts have highest swing potential?',
        'Top 10 precincts by GOTV priority',
        'Areas with highest turnout'
      );
    }

    // Suggest profiles
    if (lower.includes('what') || lower.includes('tell me')) {
      suggestions.push(
        "What's the partisan lean of East Lansing?",
        'Tell me about Meridian Township',
        'Profile of urban areas'
      );
    }

    return suggestions.slice(0, 5);
  }
}

// Export singleton instance
export const politicalQueryRouter = new PoliticalQueryRouter();
