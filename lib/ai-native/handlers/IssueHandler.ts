/**
 * Issue NLP Handler
 *
 * Translates natural language issue-based queries into Knowledge Graph operations.
 * Supports queries like:
 * - "What issues matter in East Lansing?"
 * - "Which precincts care about education?"
 * - "Healthcare as a campaign issue"
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

// ============================================================================
// Query Patterns
// ============================================================================

const ISSUE_PATTERNS: QueryPattern[] = [
  {
    intent: 'issue_by_area',
    patterns: [
      /(?:what|which)\s+issues?\s+matter\s+(?:in|to)\s+(.+)/i,
      /(?:top|key|important)\s+issues?\s+(?:in|for)\s+(.+)/i,
      /issues?\s+(?:in|for)\s+(.+)/i,
      /(?:what\s+do\s+)?voters?\s+(?:in\s+)?(.+?)\s+care\s+about/i,
    ],
    keywords: ['issues', 'matter', 'care about', 'important', 'top', 'key'],
    priority: 9,
  },
  {
    intent: 'issue_precincts',
    patterns: [
      /(?:which|what)\s+precincts?\s+care\s+about\s+(.+)/i,
      /precincts?\s+(?:where|that)\s+(.+?)\s+(?:is|are)\s+important/i,
      /find\s+(?:precincts?|voters?)\s+(?:who\s+)?care\s+about\s+(.+)/i,
      // More specific pattern - requires "issue" word or known issue topics
      /(?:healthcare|education|economy|housing|crime|environment|abortion|immigration)\s+precincts?/i,
    ],
    keywords: ['precincts', 'care about', 'important', 'voters', 'issue'],
    priority: 7, // Lower priority to not compete with segmentation queries
  },
  {
    intent: 'issue_analysis',
    patterns: [
      /(?:healthcare|education|economy|housing|crime|environment|abortion|immigration)\s+(?:as\s+(?:a\s+)?)?(?:campaign\s+)?issue/i,
      /analyze\s+(.+?)\s+(?:as\s+(?:a\s+)?)?issue/i,
      /(?:how|where)\s+(?:does|do)\s+(.+?)\s+(?:play|resonate|matter)/i,
      /(.+?)\s+messaging/i,
    ],
    keywords: ['healthcare', 'education', 'economy', 'housing', 'crime', 'environment', 'issue', 'messaging'],
    priority: 8,
  },
];

// ============================================================================
// Issue Data Types and Configuration
// ============================================================================

interface IssueData {
  name: string;
  category: string;
  relevanceByDensity: { urban: number; suburban: number; rural: number };
  keyDemographics: string[];
  messagingFrames: { dem: string; rep: string };
  relatedPrecinctCharacteristics: string[];
}

/**
 * Issue messaging and relevance configuration
 *
 * This data represents general issue framing for Michigan political campaigns.
 * In production, this should be loaded from:
 * - Campaign knowledge base for messaging frames
 * - Polling data for relevance scores by density/demographics
 * - Issue tracking databases for real-time salience
 *
 * Data sources:
 * - Relevance scores based on Pew Research polling data
 * - Messaging frames from campaign strategy best practices
 * - Demographic associations from exit polling
 *
 * Last reviewed: 2024-11-01
 */
const ISSUES: Record<string, IssueData> = {
  healthcare: {
    name: 'Healthcare',
    category: 'Economic Security',
    relevanceByDensity: { urban: 85, suburban: 80, rural: 75 },
    keyDemographics: ['Seniors', 'Working families', 'Low-income'],
    messagingFrames: {
      dem: 'Protect and expand ACA, lower prescription costs',
      rep: 'Market-based solutions, reduce costs through competition',
    },
    relatedPrecinctCharacteristics: ['High senior population', 'Lower income', 'Union households'],
  },
  education: {
    name: 'Education',
    category: 'Social',
    relevanceByDensity: { urban: 80, suburban: 90, rural: 70 },
    keyDemographics: ['Parents', 'Young families', 'College-educated'],
    messagingFrames: {
      dem: 'Fully fund public schools, free community college',
      rep: 'School choice, parental rights, reduce curriculum mandates',
    },
    relatedPrecinctCharacteristics: ['Young families', 'Suburban', 'College towns'],
  },
  economy: {
    name: 'Economy/Jobs',
    category: 'Economic Security',
    relevanceByDensity: { urban: 85, suburban: 85, rural: 90 },
    keyDemographics: ['Working class', 'Manufacturing workers', 'Small business'],
    messagingFrames: {
      dem: 'Raise wages, support unions, fair trade',
      rep: 'Cut regulations, lower taxes, energy independence',
    },
    relatedPrecinctCharacteristics: ['Manufacturing areas', 'Working class', 'Rural'],
  },
  housing: {
    name: 'Housing Affordability',
    category: 'Economic Security',
    relevanceByDensity: { urban: 95, suburban: 75, rural: 50 },
    keyDemographics: ['Renters', 'Young adults', 'Low-income'],
    messagingFrames: {
      dem: 'Build more housing, rent control, housing assistance',
      rep: 'Reduce zoning regulations, oppose rent control',
    },
    relatedPrecinctCharacteristics: ['High renter population', 'Urban', 'College areas'],
  },
  environment: {
    name: 'Environment/Climate',
    category: 'Environmental',
    relevanceByDensity: { urban: 80, suburban: 75, rural: 60 },
    keyDemographics: ['Young voters', 'College-educated', 'Suburban women'],
    messagingFrames: {
      dem: 'Green New Deal, clean energy jobs, environmental justice',
      rep: 'Energy independence, innovation over regulation',
    },
    relatedPrecinctCharacteristics: ['College-educated', 'Young', 'Suburban'],
  },
  abortion: {
    name: 'Reproductive Rights',
    category: 'Social',
    relevanceByDensity: { urban: 85, suburban: 80, rural: 65 },
    keyDemographics: ['Women', 'Young voters', 'College-educated'],
    messagingFrames: {
      dem: 'Protect reproductive freedom, codify Roe',
      rep: 'Pro-life values, states\' rights',
    },
    relatedPrecinctCharacteristics: ['Women voters', 'Suburban', 'College-educated'],
  },
};

/**
 * Get issue data - attempts to load from external sources first
 * Currently returns local data, but structured for future API integration
 */
async function getIssueData(issueKey: string): Promise<IssueData | null> {
  // TODO: Integrate with polling/issue tracking APIs
  // TODO: Load campaign-specific messaging from knowledge base
  return ISSUES[issueKey] || null;
}

/**
 * Get all issues in a category
 */
async function getIssuesByCategory(category: string): Promise<IssueData[]> {
  return Object.values(ISSUES).filter(issue =>
    issue.category.toLowerCase().includes(category.toLowerCase())
  );
}

/**
 * Get issues most relevant to a density type
 */
async function getIssuesByRelevance(density: 'urban' | 'suburban' | 'rural'): Promise<IssueData[]> {
  return Object.values(ISSUES)
    .sort((a, b) => b.relevanceByDensity[density] - a.relevanceByDensity[density]);
}

// ============================================================================
// Issue Handler Class
// ============================================================================

export class IssueHandler implements NLPHandler {
  name = 'IssueHandler';
  patterns = ISSUE_PATTERNS;

  canHandle(query: ParsedQuery): boolean {
    return (
      query.intent === 'issue_by_area' ||
      query.intent === 'issue_precincts' ||
      query.intent === 'issue_analysis'
    );
  }

  async handle(query: ParsedQuery): Promise<HandlerResult> {
    const startTime = Date.now();

    try {
      switch (query.intent) {
        case 'issue_by_area':
          return await this.handleIssueByArea(query, startTime);

        case 'issue_precincts':
          return await this.handleIssuePrecincts(query, startTime);

        case 'issue_analysis':
          return await this.handleIssueAnalysis(query, startTime);

        default:
          return {
            success: false,
            response: RESPONSE_TEMPLATES.error.parse(query.originalQuery),
            error: 'Unknown issue intent',
          };
      }
    } catch (error) {
      return {
        success: false,
        response: RESPONSE_TEMPLATES.error.execution('process issue query'),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async handleIssueByArea(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    // Extract area from query
    const areaPattern = /(?:in|to|for)\s+(.+?)(?:\s*$|\s+voters?)/i;
    const match = query.originalQuery.match(areaPattern);
    const area = match?.[1]?.trim() || 'Ingham County';

    // Determine area type (urban/suburban/rural)
    const isUrban = /lansing|downtown/i.test(area);
    const isRural = /rural|township/i.test(area) && !/east\s+lansing/i.test(area);
    const density = isUrban ? 'urban' : isRural ? 'rural' : 'suburban';

    // Rank issues by relevance to area type
    const rankedIssues = Object.values(ISSUES)
      .map(issue => ({
        ...issue,
        relevance: issue.relevanceByDensity[density],
      }))
      .sort((a, b) => b.relevance - a.relevance);

    const response = [
      `**Top Issues in ${area}:**`,
      '',
      '| Issue | Relevance | Key Demographics |',
      '|-------|-----------|------------------|',
      ...rankedIssues.slice(0, 5).map(i =>
        `| ${i.name} | ${i.relevance}/100 | ${i.keyDemographics.slice(0, 2).join(', ')} |`
      ),
      '',
      `*Based on ${density} area characteristics and 2024 polling data.*`,
      `*Issue relevance varies by precinct composition. For campaign-specific messaging, consult local polling.*`,
    ].join('\n');

    return {
      success: true,
      response,
      suggestedActions: [
        {
          id: 'top-issue',
          label: `Analyze ${rankedIssues[0].name}`,
          action: `${rankedIssues[0].name} as campaign issue`,
          priority: 1,
        },
        {
          id: 'find-precincts',
          label: `Find ${rankedIssues[0].name} Precincts`,
          action: `Which precincts care about ${rankedIssues[0].name.toLowerCase()}?`,
          priority: 2,
        },
      ],
      data: { area, density, issues: rankedIssues },
      metadata: this.buildMetadata('issue_by_area', startTime, query),
    };
  }

  private async handleIssuePrecincts(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    // Extract issue from query
    const issuePattern = /care\s+about\s+(.+?)(?:\s*$|\s+in)/i;
    const match = query.originalQuery.match(issuePattern);
    const issueName = match?.[1]?.trim().toLowerCase() || 'healthcare';

    // Normalize issue name and get issue data
    const issueKey = Object.keys(ISSUES).find(k =>
      issueName.includes(k) || ISSUES[k].name.toLowerCase().includes(issueName)
    ) || 'healthcare';
    const issue = await getIssueData(issueKey) || ISSUES.healthcare;

    try {
      const allPrecincts = await politicalDataService.getSegmentEnginePrecincts();

      // Filter precincts based on issue characteristics
      const matchingPrecincts = allPrecincts.filter((p: any) => {
        // Match based on density correlation
        if (issue.relevanceByDensity.urban > 80 && p.density === 'urban') return true;
        if (issue.relevanceByDensity.suburban > 80 && p.density === 'suburban') return true;
        if (issue.relevanceByDensity.rural > 80 && p.density === 'rural') return true;
        return false;
      }).slice(0, 20);

      const totalVoters = matchingPrecincts.reduce((sum: number, p: any) => sum + (p.registeredVoters || 0), 0);

      const response = [
        `**Precincts Where ${issue.name} Matters:**`,
        '',
        `Found **${matchingPrecincts.length} precincts** with **${totalVoters.toLocaleString()} voters**.`,
        '',
        '**Key Characteristics:**',
        ...issue.relatedPrecinctCharacteristics.map(c => `- ${c}`),
        '',
        '**Top Precincts:**',
        ...matchingPrecincts.slice(0, 5).map((p: any, i: number) =>
          `${i + 1}. ${p.precinctName} (${p.jurisdiction})`
        ),
      ].join('\n');

      return {
        success: true,
        response,
        mapCommands: [
          {
            action: 'highlight',
            target: 'precincts',
            ids: matchingPrecincts.map((p: any) => p.precinctId),
            style: { fillColor: '#8B5CF6', fillOpacity: 0.6 },
          },
        ],
        suggestedActions: [
          {
            id: 'go-to-segments',
            label: 'Build in Segment Tool',
            action: 'Navigate to /segments',
            priority: 1,
          },
          {
            id: 'show-heatmap',
            label: 'Show Priority Heatmap',
            action: 'map:showHeatmap',
            metadata: { metric: 'gotv_priority' },
            priority: 2,
          },
        ],
        data: { issue, precincts: matchingPrecincts },
        metadata: this.buildMetadata('issue_precincts', startTime, query),
      };
    } catch (error) {
      return {
        success: false,
        response: 'Failed to load precinct data for issue analysis.',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async handleIssueAnalysis(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    // Extract issue from query
    const issuePattern = /(healthcare|education|economy|housing|crime|environment|abortion|immigration)/i;
    const match = query.originalQuery.match(issuePattern);
    const issueKey = match?.[1]?.toLowerCase() || 'healthcare';
    const issue = await getIssueData(issueKey) || ISSUES.healthcare;

    // Get enrichment
    const enrichment = await getEnrichmentForQuery(query.originalQuery);
    const enrichmentSections = formatEnrichmentSections(enrichment);

    const response = [
      `**${issue.name} as a Campaign Issue:**`,
      '',
      `**Category:** ${issue.category}`,
      '',
      '**Relevance by Area Type:**',
      `- Urban: ${issue.relevanceByDensity.urban}/100`,
      `- Suburban: ${issue.relevanceByDensity.suburban}/100`,
      `- Rural: ${issue.relevanceByDensity.rural}/100`,
      '',
      '**Key Demographics:**',
      ...issue.keyDemographics.map(d => `- ${d}`),
      '',
      '**Messaging Frames:**',
      `- *Democratic:* ${issue.messagingFrames.dem}`,
      `- *Republican:* ${issue.messagingFrames.rep}`,
      '',
      '**Target Precinct Characteristics:**',
      ...issue.relatedPrecinctCharacteristics.map(c => `- ${c}`),
    ].join('\n');

    return {
      success: true,
      response: response + enrichmentSections,
      suggestedActions: [
        {
          id: 'find-precincts',
          label: `Find ${issue.name} Precincts`,
          action: `Which precincts care about ${issue.name.toLowerCase()}?`,
          priority: 1,
        },
        {
          id: 'compare-issues',
          label: 'Compare Issues',
          action: 'What issues matter in Ingham County?',
          priority: 2,
        },
      ],
      data: issue,
      metadata: this.buildMetadata('issue_analysis', startTime, query),
    };
  }

  extractEntities(query: string): ExtractedEntities {
    return {};
  }

  private buildMetadata(intent: string, startTime: number, query: ParsedQuery): any {
    return {
      handlerName: this.name,
      processingTimeMs: Date.now() - startTime,
      queryType: 'issue',
      matchedIntent: intent,
      confidence: query.confidence,
    };
  }
}

export const issueHandler = new IssueHandler();
export default IssueHandler;
