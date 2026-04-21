/**
 * Scenario Handler (GAP 4 Fix)
 *
 * Handles "what if" scenario modeling queries for hypothetical analysis.
 * Implements Principles 17 (Scenario-Driven Thinking) and 18 (Integrated Scenarios).
 *
 * Supports queries like:
 * - "What if turnout increases 10%?"
 * - "What happens if we shift D+5?"
 * - "Model a scenario where students vote at 80%"
 */

import type {
  NLPHandler,
  ParsedQuery,
  HandlerResult,
  QueryPattern,
  ExtractedEntities,
  HandlerContext,
} from './types';
import { getEnrichmentForQuery, formatEnrichmentSections } from './types';

// ============================================================================
// Query Patterns
// ============================================================================

const SCENARIO_PATTERNS: QueryPattern[] = [
  {
    intent: 'scenario_turnout',
    patterns: [
      /what\s+if\s+(?:voter\s+)?turnout\s+(?:increases?|goes\s+up|rises?|jumps?)\s*(?:by\s+)?(\d+)%?/i,
      /what\s+if\s+(?:voter\s+)?turnout\s+(?:decreases?|goes\s+down|drops?|falls?)\s*(?:by\s+)?(\d+)%?/i,
      /what\s+happens?\s+(?:with|if)\s+(?:a\s+)?(\d+)%?\s+turnout\s+(?:increase|decrease|change)/i,
      /model\s+(?:a\s+)?(?:scenario|situation)\s+(?:with|where)\s+turnout\s+(?:at\s+)?(\d+)%?/i,
      /scenario\s+(?:with|where)\s+turnout\s+(?:increases?|drops?)\s*(?:by\s+)?(\d+)%?/i,
      /if\s+(?:we\s+)?(?:get|achieve|reach)\s+(\d+)%?\s+turnout/i,
    ],
    keywords: ['what if', 'turnout', 'increase', 'decrease', 'scenario', 'model', 'happens'],
    priority: 12,
  },
  {
    intent: 'scenario_partisan_shift',
    patterns: [
      /what\s+if\s+(?:there'?s?\s+)?(?:a\s+)?(?:D|dem|democratic)\s*\+?\s*(\d+)\s+shift/i,
      /what\s+if\s+(?:there'?s?\s+)?(?:a\s+)?(?:R|rep|republican)\s*\+?\s*(\d+)\s+shift/i,
      /what\s+if\s+(?:the\s+)?(?:area|district|county)\s+shifts?\s+(?:D|R|dem|rep)\s*\+?\s*(\d+)/i,
      /model\s+(?:a\s+)?(\d+)\s*(?:point|%)?\s+(?:democratic|republican|D|R)\s+shift/i,
      /scenario\s+(?:with|where)\s+(?:a\s+)?(\d+)\s*(?:point|%)?\s+(?:swing|shift)/i,
      /what\s+happens?\s+(?:with|if)\s+(?:a\s+)?(\d+)\s*(?:point|%)?\s+(?:swing|shift)/i,
    ],
    keywords: ['what if', 'shift', 'swing', 'D+', 'R+', 'democratic', 'republican', 'scenario'],
    priority: 12,
  },
  {
    intent: 'scenario_demographic',
    patterns: [
      /what\s+if\s+(?:young|youth|student|college)\s+(?:voter\s+)?turnout\s+(?:is\s+)?(?:at\s+)?(\d+)%?/i,
      /what\s+if\s+(?:senior|elderly|older)\s+(?:voter\s+)?turnout\s+(?:increases?|decreases?)\s*(?:by\s+)?(\d+)%?/i,
      /model\s+(?:a\s+)?(?:scenario|situation)\s+(?:with|where)\s+(?:students?|youth|young\s+voters?)\s+(?:vote|turn\s+out)\s+(?:at\s+)?(\d+)%?/i,
      /scenario\s+(?:with|where)\s+(?:suburban|urban|rural)\s+(?:areas?\s+)?(?:shift|swing)\s*(?:by\s+)?(\d+)%?/i,
      /what\s+happens?\s+if\s+(?:we\s+)?(?:increase|boost|improve)\s+(?:young|youth|student)\s+(?:voter\s+)?turnout/i,
    ],
    keywords: ['what if', 'young', 'student', 'senior', 'suburban', 'urban', 'rural', 'demographic', 'scenario'],
    priority: 12,
  },
  {
    intent: 'scenario_canvass',
    patterns: [
      /what\s+if\s+(?:we\s+)?(?:double|triple|increase)\s+(?:our\s+)?canvass(?:ing)?\s+(?:in|effort)/i,
      /what\s+if\s+(?:we\s+)?canvass\s+(\d+)\s+(?:more\s+)?doors/i,
      /what\s+happens?\s+(?:with|if)\s+(?:we\s+add|more)\s+(\d+)\s+volunteers?/i,
      /model\s+(?:a\s+)?(?:scenario|situation)\s+(?:with|where)\s+(?:we\s+)?(?:reach|contact)\s+(\d+)\s+(?:more\s+)?(?:voters?|doors)/i,
      /scenario\s+(?:with|where)\s+(?:we\s+)?(?:knock|canvass)\s+(\d+)(?:k|K)?\s+(?:more\s+)?doors/i,
    ],
    keywords: ['what if', 'canvass', 'doors', 'volunteers', 'double', 'triple', 'increase', 'scenario'],
    priority: 12,
  },
  {
    intent: 'scenario_general',
    patterns: [
      /what\s+if\b/i,
      /what\s+would\s+happen\s+if/i,
      /model\s+(?:a\s+)?scenario/i,
      /hypothetically?\b/i,
      /imagine\s+(?:if|that)/i,
      /run\s+(?:a\s+)?scenario/i,
      /let'?s?\s+say\b/i,
    ],
    keywords: ['what if', 'scenario', 'hypothetical', 'imagine', 'model'],
    priority: 8,
  },
];

// ============================================================================
// Scenario Analysis Functions
// ============================================================================

interface ScenarioResult {
  scenarioName: string;
  description: string;
  baselineValue: number;
  projectedValue: number;
  change: number;
  changePercent: number;
  impactLevel: 'low' | 'moderate' | 'high' | 'critical';
  affectedPrecincts: number;
  insights: string[];
  recommendations: string[];
}

function analyzeScenario(
  scenarioType: string,
  delta: number,
  direction: 'increase' | 'decrease',
  context?: HandlerContext
): ScenarioResult {
  // Base calculations using typical Ingham County data
  const basePrecincts = context?.segmentation.matchingPrecincts.length || 120;
  const baseVoters = basePrecincts * 2500; // ~300k voters total

  // Calculate scenario impact based on type
  let scenarioName = '';
  let description = '';
  let baselineValue = 0;
  let projectedValue = 0;
  let affectedPrecincts = 0;
  const insights: string[] = [];
  const recommendations: string[] = [];

  switch (scenarioType) {
    case 'turnout':
      scenarioName = `Turnout ${direction === 'increase' ? '+' : '-'}${delta}%`;
      description = `Modeling a ${delta}% ${direction} in voter turnout`;
      baselineValue = 65; // Baseline turnout %
      projectedValue = direction === 'increase' ? baselineValue + delta : baselineValue - delta;
      affectedPrecincts = Math.round(basePrecincts * (delta / 100) * 2);

      const additionalVotes = Math.round(baseVoters * (delta / 100));
      insights.push(`**${additionalVotes.toLocaleString()}** additional votes would be cast`);

      if (direction === 'increase') {
        insights.push(`Democratic lean areas typically benefit more from turnout increases`);
        insights.push(`Swing precincts become more volatile with higher turnout`);
        recommendations.push('Focus GOTV efforts on D+5 to D+15 precincts');
        recommendations.push('Prioritize student-heavy areas like East Lansing');
      } else {
        insights.push(`Lower turnout typically favors incumbent patterns`);
        insights.push(`Base voters become proportionally more important`);
        recommendations.push('Focus on high-propensity voter contact');
        recommendations.push('Ensure base turnout through early vote programs');
      }
      break;

    case 'partisan_shift':
      scenarioName = `${delta}-Point Partisan Shift`;
      description = `Modeling a ${delta}-point shift in partisan lean`;
      baselineValue = -5; // Baseline D+5 county average
      projectedValue = baselineValue + (direction === 'increase' ? delta : -delta);
      affectedPrecincts = Math.round(basePrecincts * 0.3); // Swing precincts affected

      insights.push(`**${affectedPrecincts}** precincts would change competitive classification`);
      insights.push(`Margin of victory would shift by ~${Math.round(baseVoters * (delta / 100)).toLocaleString()} votes`);

      if (Math.abs(projectedValue) < 3) {
        insights.push(`County would become highly competitive (toss-up territory)`);
        recommendations.push('Deploy maximum resources to persuasion targets');
      } else if (projectedValue < -10) {
        insights.push(`County would become safely Democratic`);
        recommendations.push('Focus on down-ballot races and GOTV');
      }
      break;

    case 'demographic':
      scenarioName = `Youth Turnout at ${delta}%`;
      description = `Modeling student/young voter turnout at ${delta}%`;
      baselineValue = 45; // Baseline youth turnout
      projectedValue = delta;
      affectedPrecincts = Math.round(basePrecincts * 0.15); // College-area precincts

      const youthVoters = Math.round(baseVoters * 0.18); // ~18% are 18-29
      const additionalYouth = Math.round(youthVoters * ((delta - baselineValue) / 100));

      insights.push(`**${additionalYouth.toLocaleString()}** additional young voters would turn out`);
      insights.push(`East Lansing area would see largest impact`);
      insights.push(`Young voters lean D+25 on average in Ingham County`);
      recommendations.push('Target MSU campus and surrounding precincts');
      recommendations.push('Increase peer-to-peer outreach programs');
      recommendations.push('Focus on issues resonating with young voters');
      break;

    case 'canvass':
      scenarioName = `Expanded Canvassing (+${delta}k doors)`;
      description = `Modeling ${delta * 1000} additional door knocks`;
      baselineValue = 5000; // Baseline doors
      projectedValue = baselineValue + (delta * 1000);
      affectedPrecincts = Math.round(delta * 10); // ~100 doors per precinct affected

      const expectedContacts = Math.round(delta * 1000 * 0.35); // 35% contact rate
      const expectedPersuasion = Math.round(expectedContacts * 0.03); // 3% persuasion rate

      insights.push(`**${expectedContacts.toLocaleString()}** additional voter contacts expected`);
      insights.push(`**${expectedPersuasion.toLocaleString()}** potential vote changes through persuasion`);
      insights.push(`Would require ~${Math.round(delta * 1000 / 25)} volunteer shifts`);
      recommendations.push('Target swing precincts for maximum impact');
      recommendations.push('Prioritize quality contacts over quantity');
      break;

    default:
      scenarioName = 'Custom Scenario';
      description = 'Modeling a custom hypothetical scenario';
      baselineValue = 50;
      projectedValue = 50 + delta;
      affectedPrecincts = Math.round(basePrecincts * 0.5);
      insights.push('Custom scenario analysis available');
      recommendations.push('Provide more specific parameters for detailed analysis');
  }

  const change = projectedValue - baselineValue;
  const changePercent = Math.abs((change / baselineValue) * 100);
  const impactLevel: ScenarioResult['impactLevel'] =
    changePercent < 5 ? 'low' :
    changePercent < 15 ? 'moderate' :
    changePercent < 30 ? 'high' : 'critical';

  return {
    scenarioName,
    description,
    baselineValue,
    projectedValue,
    change,
    changePercent,
    impactLevel,
    affectedPrecincts,
    insights,
    recommendations,
  };
}

// ============================================================================
// Scenario Handler Class
// ============================================================================

export class ScenarioHandler implements NLPHandler {
  name = 'ScenarioHandler';
  patterns = SCENARIO_PATTERNS;

  canHandle(query: ParsedQuery): boolean {
    return (
      query.intent === 'scenario_turnout' ||
      query.intent === 'scenario_partisan_shift' ||
      query.intent === 'scenario_demographic' ||
      query.intent === 'scenario_canvass' ||
      query.intent === 'scenario_general'
    );
  }

  async handle(query: ParsedQuery, context?: HandlerContext): Promise<HandlerResult> {
    const startTime = Date.now();

    try {
      switch (query.intent) {
        case 'scenario_turnout':
          return await this.handleTurnoutScenario(query, startTime, context);

        case 'scenario_partisan_shift':
          return await this.handlePartisanShiftScenario(query, startTime, context);

        case 'scenario_demographic':
          return await this.handleDemographicScenario(query, startTime, context);

        case 'scenario_canvass':
          return await this.handleCanvassScenario(query, startTime, context);

        case 'scenario_general':
          return await this.handleGeneralScenario(query, startTime, context);

        default:
          return this.handleUnknownScenario(query, startTime);
      }
    } catch (error) {
      return {
        success: false,
        response: `Failed to model scenario. ${error instanceof Error ? error.message : 'Please try again.'}`,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // --------------------------------------------------------------------------
  // Scenario Handlers
  // --------------------------------------------------------------------------

  private async handleTurnoutScenario(
    query: ParsedQuery,
    startTime: number,
    context?: HandlerContext
  ): Promise<HandlerResult> {
    const entities = this.extractEntities(query.originalQuery);
    const delta = entities.percentValue || 10;
    const direction = /decrease|drop|fall|down/i.test(query.originalQuery) ? 'decrease' : 'increase';

    const result = analyzeScenario('turnout', delta, direction, context);
    const response = this.formatScenarioResponse(result);

    // Get enrichment context
    const enrichment = await getEnrichmentForQuery(query.originalQuery);
    const enrichmentSections = formatEnrichmentSections(enrichment);

    return {
      success: true,
      response: response + enrichmentSections,
      mapCommands: [
        { type: 'showHeatmap', metric: 'gotv_priority' },
      ],
      suggestedActions: [
        {
          id: 'model-different',
          label: `Model ${direction === 'increase' ? '-' : '+'}${delta}% Instead`,
          description: 'Try the opposite scenario',
          action: `What if turnout ${direction === 'increase' ? 'decreases' : 'increases'} ${delta}%?`,
          priority: 1,
        },
        {
          id: 'find-gotv',
          label: 'Find GOTV Targets',
          description: 'Identify precincts to focus turnout efforts',
          action: 'Find high GOTV priority precincts',
          priority: 2,
        },
        {
          id: 'compare-elections',
          label: 'Compare Past Turnout',
          description: 'See historical turnout patterns',
          action: 'Show turnout trends since 2016',
          priority: 3,
        },
      ],
      data: { scenario: result },
      metadata: this.buildMetadata('scenario_turnout', startTime, query),
    };
  }

  private async handlePartisanShiftScenario(
    query: ParsedQuery,
    startTime: number,
    context?: HandlerContext
  ): Promise<HandlerResult> {
    const entities = this.extractEntities(query.originalQuery);
    const delta = entities.percentValue || 5;
    const direction = /R\+|rep|republican/i.test(query.originalQuery) ? 'decrease' : 'increase';

    const result = analyzeScenario('partisan_shift', delta, direction, context);
    const response = this.formatScenarioResponse(result);

    const enrichment = await getEnrichmentForQuery(query.originalQuery);
    const enrichmentSections = formatEnrichmentSections(enrichment);

    return {
      success: true,
      response: response + enrichmentSections,
      mapCommands: [
        { type: 'showHeatmap', metric: 'swing_potential' },
      ],
      suggestedActions: [
        {
          id: 'find-swing',
          label: 'Find Swing Precincts',
          description: 'See which precincts would flip',
          action: 'Find swing precincts within 5 points',
          priority: 1,
        },
        {
          id: 'model-different',
          label: `Model ${delta + 5}-Point Shift`,
          description: 'Try a larger swing',
          action: `What if there's a ${delta + 5} point shift?`,
          priority: 2,
        },
        {
          id: 'compare-areas',
          label: 'Compare Competitive Areas',
          description: 'See most affected areas',
          action: 'Compare the most competitive precincts',
          priority: 3,
        },
      ],
      data: { scenario: result },
      metadata: this.buildMetadata('scenario_partisan_shift', startTime, query),
    };
  }

  private async handleDemographicScenario(
    query: ParsedQuery,
    startTime: number,
    context?: HandlerContext
  ): Promise<HandlerResult> {
    const entities = this.extractEntities(query.originalQuery);
    const delta = entities.percentValue || 70;
    const direction = /decrease|drop|fall/i.test(query.originalQuery) ? 'decrease' : 'increase';

    const result = analyzeScenario('demographic', delta, direction, context);
    const response = this.formatScenarioResponse(result);

    const enrichment = await getEnrichmentForQuery(query.originalQuery);
    const enrichmentSections = formatEnrichmentSections(enrichment);

    return {
      success: true,
      response: response + enrichmentSections,
      mapCommands: [
        { type: 'flyTo', target: 'East Lansing' },
        { type: 'showHeatmap', metric: 'gotv_priority' },
      ],
      suggestedActions: [
        {
          id: 'find-youth',
          label: 'Find Student Areas',
          description: 'Identify precincts with young voters',
          action: 'Find precincts with high student population',
          priority: 1,
        },
        {
          id: 'model-80',
          label: 'Model 80% Youth Turnout',
          description: 'See maximum impact scenario',
          action: 'What if student turnout reaches 80%?',
          priority: 2,
        },
        {
          id: 'plan-campus',
          label: 'Plan Campus Canvass',
          description: 'Create student outreach plan',
          action: 'Plan a canvass for East Lansing',
          priority: 3,
        },
      ],
      data: { scenario: result },
      metadata: this.buildMetadata('scenario_demographic', startTime, query),
    };
  }

  private async handleCanvassScenario(
    query: ParsedQuery,
    startTime: number,
    context?: HandlerContext
  ): Promise<HandlerResult> {
    const entities = this.extractEntities(query.originalQuery);
    const delta = entities.doorCount ? Math.round(entities.doorCount / 1000) : 5;
    const direction: 'increase' | 'decrease' = 'increase';

    const result = analyzeScenario('canvass', delta, direction, context);
    const response = this.formatScenarioResponse(result);

    const enrichment = await getEnrichmentForQuery(query.originalQuery);
    const enrichmentSections = formatEnrichmentSections(enrichment);

    return {
      success: true,
      response: response + enrichmentSections,
      mapCommands: [
        { type: 'showHeatmap', metric: 'persuasion_opportunity' },
      ],
      suggestedActions: [
        {
          id: 'plan-canvass',
          label: 'Plan Actual Canvass',
          description: 'Create a real canvassing plan',
          action: `Plan a canvass for ${delta * 1000} doors`,
          priority: 1,
        },
        {
          id: 'find-targets',
          label: 'Find Best Targets',
          description: 'Identify high-ROI precincts',
          action: 'Find precincts with highest persuasion potential',
          priority: 2,
        },
        {
          id: 'estimate-resources',
          label: 'Estimate Resources',
          description: 'Calculate volunteer needs',
          action: `How many volunteers for ${delta * 1000} doors?`,
          priority: 3,
        },
      ],
      data: { scenario: result },
      metadata: this.buildMetadata('scenario_canvass', startTime, query),
    };
  }

  private async handleGeneralScenario(
    query: ParsedQuery,
    startTime: number,
    context?: HandlerContext
  ): Promise<HandlerResult> {
    const response = [
      '**Scenario Modeling Available**',
      '',
      'I can model various "what if" scenarios for you. Try asking:',
      '',
      '**Turnout Scenarios:**',
      '- "What if turnout increases 10%?"',
      '- "What happens with 5% lower turnout?"',
      '',
      '**Partisan Shift Scenarios:**',
      '- "What if there\'s a 5-point Democratic shift?"',
      '- "Model a 3-point Republican swing"',
      '',
      '**Demographic Scenarios:**',
      '- "What if student turnout reaches 70%?"',
      '- "What happens if suburban turnout drops?"',
      '',
      '**Canvassing Scenarios:**',
      '- "What if we double our canvassing?"',
      '- "What happens if we knock 10,000 more doors?"',
      '',
      'Each scenario shows projected impact, affected precincts, and strategic recommendations.',
    ].join('\n');

    return {
      success: true,
      response,
      suggestedActions: [
        {
          id: 'turnout-scenario',
          label: 'Turnout +10%',
          description: 'Model higher voter turnout',
          action: 'What if turnout increases 10%?',
          priority: 1,
        },
        {
          id: 'shift-scenario',
          label: 'D+5 Shift',
          description: 'Model Democratic swing',
          action: 'What if there\'s a 5-point Democratic shift?',
          priority: 2,
        },
        {
          id: 'youth-scenario',
          label: 'Youth Turnout 70%',
          description: 'Model high student turnout',
          action: 'What if student turnout reaches 70%?',
          priority: 3,
        },
        {
          id: 'canvass-scenario',
          label: 'Double Canvassing',
          description: 'Model expanded field program',
          action: 'What if we double our canvassing effort?',
          priority: 4,
        },
      ],
      metadata: this.buildMetadata('scenario_general', startTime, query),
    };
  }

  private handleUnknownScenario(query: ParsedQuery, startTime: number): HandlerResult {
    return {
      success: false,
      response: 'I couldn\'t understand that scenario. Try "What if turnout increases 10%?" or "What if there\'s a 5-point shift?"',
      error: 'Unknown scenario type',
      metadata: this.buildMetadata('scenario_unknown', startTime, query),
    };
  }

  // --------------------------------------------------------------------------
  // Response Formatting
  // --------------------------------------------------------------------------

  private formatScenarioResponse(result: ScenarioResult): string {
    const impactEmoji = {
      low: '',
      moderate: '',
      high: '**',
      critical: '***',
    }[result.impactLevel];

    const sections = [
      `## ${result.scenarioName}`,
      '',
      result.description,
      '',
      '### Projected Impact',
      '',
      `| Metric | Baseline | Projected | Change |`,
      `|--------|----------|-----------|--------|`,
      `| Value | ${result.baselineValue}${typeof result.baselineValue === 'number' && result.baselineValue < 100 ? '%' : ''} | ${result.projectedValue}${typeof result.projectedValue === 'number' && result.projectedValue < 100 ? '%' : ''} | ${result.change > 0 ? '+' : ''}${result.change.toFixed(1)} |`,
      `| Impact Level | - | ${impactEmoji}${result.impactLevel.toUpperCase()}${impactEmoji} | ~${result.changePercent.toFixed(1)}% |`,
      `| Precincts Affected | - | ${result.affectedPrecincts} | - |`,
      '',
      '### Key Insights',
      '',
      ...result.insights.map(i => `- ${i}`),
      '',
      '### Strategic Recommendations',
      '',
      ...result.recommendations.map((r, i) => `${i + 1}. ${r}`),
    ];

    return sections.join('\n');
  }

  // --------------------------------------------------------------------------
  // Entity Extraction
  // --------------------------------------------------------------------------

  extractEntities(query: string): ExtractedEntities & { percentValue?: number; doorCount?: number } {
    const entities: ExtractedEntities & { percentValue?: number; doorCount?: number } = {};

    // Extract percentage values
    const percentMatch = query.match(/(\d+)\s*%?/);
    if (percentMatch) {
      entities.percentValue = parseInt(percentMatch[1], 10);
    }

    // Extract door counts
    const doorMatch = query.match(/(\d+)\s*(?:k|K|,?\d{3})?\s*(?:doors?|knocks?)/);
    if (doorMatch) {
      let count = parseInt(doorMatch[1].replace(/,/g, ''), 10);
      if (/k|K/.test(doorMatch[0])) {
        count *= 1000;
      }
      entities.doorCount = count;
    }

    return entities;
  }

  // --------------------------------------------------------------------------
  // Metadata
  // --------------------------------------------------------------------------

  private buildMetadata(intent: string, startTime: number, query: ParsedQuery): any {
    return {
      handlerName: this.name,
      processingTimeMs: Date.now() - startTime,
      queryType: 'scenario',
      matchedIntent: intent,
      confidence: query.confidence,
    };
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const scenarioHandler = new ScenarioHandler();

export default ScenarioHandler;
