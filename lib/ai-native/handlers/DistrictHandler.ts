/**
 * District NLP Handler
 *
 * Translates natural language district queries into multi-level district analysis.
 * Supports queries like:
 * - "Show State House 73"
 * - "Analyze PA-07" (Pennsylvania deployment)
 * - "Compare HD-73 vs HD-74"
 * - "What precincts are in Senate District 21?"
 */

import type {
  NLPHandler,
  ParsedQuery,
  HandlerResult,
  QueryPattern,
  ExtractedEntities,
} from './types';
import { RESPONSE_TEMPLATES, getEnrichmentForQuery, formatEnrichmentSections } from './types';
import {
  handleDistrictAnalysis,
} from '@/lib/ai/workflowHandlers';
import { getPoliticalRegionEnv } from '@/lib/political/politicalRegionConfig';
import { isPAPoliticalRegion, stripDistrictIdForEnrichment } from '@/lib/political/formatPoliticalDistrictLabel';

// ============================================================================
// Query Patterns
// ============================================================================

const DISTRICT_PATTERNS: QueryPattern[] = [
  {
    intent: 'district_analysis',
    patterns: [
      // Direct commands: "Show State House 73"
      /(?:show|analyze|view|display)\s+(?:state\s+house|house\s+district|hd)\s*(?:district\s*)?\s*[-\s]?\d+/i,
      /(?:show|analyze|view|display)\s+(?:state\s+senate|senate\s+district|sd)\s*(?:district\s*)?\s*[-\s]?\d+/i,
      /(?:show|analyze|view|display)\s+(?:congressional|mi|pa)\s*[-\s]?\d+/i,
      /(?:show|analyze|view|display)\s+(?:school\s+district)\s+[\w\s-]+/i,
      // Flexible phrases: "Show me the political landscape of State House District 73"
      /(?:landscape|analysis|overview|profile)\s+(?:of|for)\s+(?:state\s+house|house\s+district|hd)\s*(?:district\s*)?\s*[-\s]?\d+/i,
      /(?:landscape|analysis|overview|profile)\s+(?:of|for)\s+(?:state\s+senate|senate\s+district|sd)\s*(?:district\s*)?\s*[-\s]?\d+/i,
      // Just mention of district anywhere: "State House District 73"
      /state\s+house\s+(?:district\s+)?(\d+)/i,
      /state\s+senate\s+(?:district\s+)?(\d+)/i,
      /house\s+district\s+(\d+)/i,
      /senate\s+district\s+(\d+)/i,
      // Short forms
      /(?:hd|sd)\s*[-\s]?\d+/i,
      /(?:mi|pa)\s*[-\s]?\d+/i,
    ],
    keywords: ['state house', 'senate', 'congressional', 'district', 'hd', 'sd', 'mi-', 'landscape', 'political'],
    priority: 10,
  },
  {
    intent: 'district_compare',
    patterns: [
      /compare\s+(?:state\s+house|hd)\s*[-\s]?\d+\s+(?:to|vs|versus)\s+(?:state\s+house|hd)\s*[-\s]?\d+/i,
      /compare\s+(?:senate\s+district|sd)\s*[-\s]?\d+\s+(?:to|vs|versus)\s+(?:senate\s+district|sd)\s*[-\s]?\d+/i,
      /(?:hd|sd)\s*[-\s]?\d+\s+vs\s+(?:hd|sd)\s*[-\s]?\d+/i,
    ],
    keywords: ['compare', 'versus', 'vs', 'district'],
    priority: 9,
  },
  {
    intent: 'district_list',
    patterns: [
      /(?:show|list|what)\s+(?:all|available)?\s*(?:state\s+house|senate|congressional)?\s*districts?/i,
      /what\s+districts\s+(?:are\s+)?(?:in|available)/i,
      /list\s+(?:of\s+)?districts/i,
    ],
    keywords: ['show', 'list', 'what', 'districts', 'available'],
    priority: 8,
  },
  {
    intent: 'district_precincts',
    patterns: [
      /(?:what|which|show)\s+precincts?\s+(?:are\s+)?in\s+(?:state\s+house|senate\s+district|hd|sd)\s*[-\s]?\d+/i,
      /precincts?\s+(?:for|in)\s+(?:state\s+house|senate\s+district|hd|sd)\s*[-\s]?\d+/i,
    ],
    keywords: ['precincts', 'in', 'district', 'what', 'which'],
    priority: 8,
  },
  // Jurisdiction lookup patterns (municipalities, cities, townships)
  {
    intent: 'jurisdiction_lookup',
    patterns: [
      /(?:show|list|display)\s+(?:me\s+)?(?:all\s+)?precincts?\s+in\s+(east\s+lansing|lansing|meridian|delhi|williamston|mason|okemos|haslett|philadelphia|pittsburgh|harrisburg|allentown|erie|reading|scranton|lancaster|york|chester|bethlehem)/i,
      /(?:what|which)\s+precincts?\s+(?:are\s+)?in\s+(east\s+lansing|lansing|meridian|delhi|williamston|mason|okemos|haslett|philadelphia|pittsburgh|harrisburg|allentown|erie|reading|scranton|lancaster|york|chester|bethlehem)/i,
      /precincts?\s+(?:in|of|for)\s+(east\s+lansing|lansing|meridian|delhi|williamston|mason|okemos|haslett|philadelphia|pittsburgh|harrisburg|allentown|erie|reading|scranton|lancaster|york|chester|bethlehem)/i,
      /(east\s+lansing|lansing|meridian|delhi|williamston|mason|okemos|haslett|philadelphia|pittsburgh|harrisburg|allentown|erie|reading|scranton|lancaster|york|chester|bethlehem)\s+precincts?/i,
      /(?:show|view|display)\s+(?:me\s+)?(east\s+lansing|lansing|meridian|delhi|williamston|mason|okemos|haslett|philadelphia|pittsburgh|harrisburg|allentown|erie|reading|scranton|lancaster|york|chester|bethlehem)(?:\s+city|\s+township)?/i,
    ],
    keywords: ['precincts', 'in', 'city', 'township', 'east lansing', 'lansing', 'philadelphia', 'pittsburgh', 'harrisburg'],
    priority: 9,
  },
];

// ============================================================================
// Entity Extraction Patterns
// ============================================================================

const STATE_HOUSE_PATTERN = /(?:state\s+house\s*(?:district)?|hd|house\s+district)\s*[-\s]?(\d+)/i;
const STATE_SENATE_PATTERN = /(?:state\s+senate\s*(?:district)?|sd|senate\s+district)\s*[-\s]?(\d+)/i;
const CONGRESSIONAL_PATTERN_MI = /(?:congressional|mi)\s*[-\s]?(\d+)/i;
const CONGRESSIONAL_PATTERN_PA = /(?:congressional|pa)\s*[-\s]?(\d+)/i;
const SCHOOL_DISTRICT_PATTERN = /(?:school\s+district)\s+([\w\s-]+)/i;

// ============================================================================
// District Handler Class
// ============================================================================

export class DistrictHandler implements NLPHandler {
  name = 'DistrictHandler';
  patterns = DISTRICT_PATTERNS;

  // --------------------------------------------------------------------------
  // Interface Methods
  // --------------------------------------------------------------------------

  canHandle(query: ParsedQuery): boolean {
    return (
      query.intent === 'district_analysis' ||
      query.intent === 'district_compare' ||
      query.intent === 'district_list' ||
      query.intent === 'district_precincts' ||
      query.intent === 'jurisdiction_lookup'
    );
  }

  async handle(query: ParsedQuery): Promise<HandlerResult> {
    const startTime = Date.now();

    try {
      switch (query.intent) {
        case 'district_analysis':
          return await this.handleAnalysis(query, startTime);

        case 'district_compare':
          return await this.handleCompare(query, startTime);

        case 'district_list':
          return await this.handleList(query, startTime);

        case 'district_precincts':
          return await this.handlePrecincts(query, startTime);

        case 'jurisdiction_lookup':
          return await this.handleJurisdictionLookup(query, startTime);

        default:
          return {
            success: false,
            response: RESPONSE_TEMPLATES.error.parse(query.originalQuery),
            error: 'Unknown district intent',
          };
      }
    } catch (error) {
      return {
        success: false,
        response: RESPONSE_TEMPLATES.error.execution('process district query'),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // --------------------------------------------------------------------------
  // Query Handlers
  // --------------------------------------------------------------------------

  private async handleAnalysis(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    const entities = this.extractEntities(query.originalQuery);

    // Determine district parameters from extracted entities
    const districtParams: {
      congressional?: string;
      stateSenate?: string;
      stateHouse?: string;
      schoolDistrict?: string;
      districtLevel?: 'congressional' | 'state_senate' | 'state_house' | 'school';
    } = {};

    if (entities.stateHouse) {
      districtParams.stateHouse = entities.stateHouse;
      districtParams.districtLevel = 'state_house';
    } else if (entities.stateSenate) {
      districtParams.stateSenate = entities.stateSenate;
      districtParams.districtLevel = 'state_senate';
    } else if (entities.congressional) {
      districtParams.congressional = entities.congressional;
      districtParams.districtLevel = 'congressional';
    } else if (entities.schoolDistrict) {
      districtParams.schoolDistrict = entities.schoolDistrict;
      districtParams.districtLevel = 'school';
    } else {
      return {
        success: false,
        response: isPAPoliticalRegion()
          ? 'Please specify which district to analyze (e.g., "Show State House 171" or "Analyze PA-07").'
          : 'Please specify which district to analyze (e.g., "Show State House 73" or "Analyze MI-07").',
        suggestedActions: isPAPoliticalRegion()
          ? [
              { id: 'ph-171', label: 'State House 171', action: 'Show State House 171', icon: 'map-pin' },
              { id: 'ps-45', label: 'Senate District 45', action: 'Show Senate District 45', icon: 'map-pin' },
              { id: 'pa-07', label: 'Congressional PA-07', action: 'Show Congressional District PA-07', icon: 'map-pin' },
            ]
          : [
              { id: 'hd-73', label: 'State House 73', action: 'Show State House 73', icon: 'map-pin' },
              { id: 'sd-21', label: 'Senate District 21', action: 'Show Senate District 21', icon: 'map-pin' },
              { id: 'mi-07', label: 'Congressional MI-07', action: 'Show Congressional District MI-07', icon: 'map-pin' },
            ],
        error: 'No district specified',
      };
    }

    // Call existing handleDistrictAnalysis from workflowHandlers
    const result = await handleDistrictAnalysis(districtParams);

    // Get enrichment context (RAG + Knowledge Graph)
    const districtTypeMap: Record<string, 'state_house' | 'state_senate' | 'congressional' | 'county'> = {
      state_house: 'state_house',
      state_senate: 'state_senate',
      congressional: 'congressional',
      school: 'county', // Fall back to county for school districts
    };
    const dLevel = districtParams.districtLevel || 'county';
    let districtNumber: string | undefined;
    if (dLevel === 'state_house' && entities.stateHouse) {
      districtNumber = stripDistrictIdForEnrichment(entities.stateHouse, 'state_house');
    } else if (dLevel === 'state_senate' && entities.stateSenate) {
      districtNumber = stripDistrictIdForEnrichment(entities.stateSenate, 'state_senate');
    } else if (dLevel === 'congressional' && entities.congressional) {
      districtNumber = stripDistrictIdForEnrichment(entities.congressional, 'congressional');
    }
    const enrichment = await getEnrichmentForQuery(query.originalQuery, {
      districtType: districtTypeMap[dLevel],
      districtNumber,
    });
    const enrichmentSections = formatEnrichmentSections(enrichment);

    // Add metadata and success flag
    return {
      success: true,
      ...result,
      response: result.response + enrichmentSections,
      metadata: this.buildMetadata('district_analysis', startTime, query),
    };
  }

  private async handleCompare(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    const entities = this.extractEntities(query.originalQuery);

    // Extract two district IDs from query
    const districtIds = this.extractDistrictPair(query.originalQuery);

    if (!districtIds || districtIds.length < 2) {
      return {
        success: false,
        response: 'Please specify two districts to compare (e.g., "Compare HD-73 vs HD-74").',
        suggestedActions: [
          {
            id: 'compare-hd',
            label: 'Compare HD-73 vs HD-74',
            action: 'Compare State House 73 vs State House 74',
            icon: 'git-compare',
          },
          {
            id: 'compare-sd',
            label: 'Compare SD-21 vs SD-28',
            action: 'Compare Senate District 21 vs Senate District 28',
            icon: 'git-compare',
          },
        ],
        error: 'Insufficient districts specified',
      };
    }

    // For now, analyze both districts separately
    // Future enhancement: Create a side-by-side comparison view
    const [district1, district2] = districtIds;

    // Analyze first district
    const result1 = await handleDistrictAnalysis(this.parseDistrictId(district1));
    const result2 = await handleDistrictAnalysis(this.parseDistrictId(district2));

    // Combine responses
    const combinedResponse = `**Comparison: ${district1} vs ${district2}**\n\n` +
      `**${district1}:**\n${result1.response}\n\n` +
      `**${district2}:**\n${result2.response}`;

    // Get enrichment context (RAG + Knowledge Graph)
    const enrichment = await getEnrichmentForQuery(query.originalQuery);
    const enrichmentSections = formatEnrichmentSections(enrichment);

    return {
      success: true,
      response: combinedResponse + enrichmentSections,
      mapCommands: [
        ...(result1.mapCommands || []),
        ...(result2.mapCommands || []),
      ],
      suggestedActions: [
        {
          id: 'side-by-side',
          label: 'View Side-by-Side',
          action: `navigate:compare?left=${district1}&right=${district2}`,
          icon: 'columns',
          priority: 1,
        },
        {
          id: 'find-similar',
          label: `Find Similar to ${district1}`,
          action: `Find precincts similar to ${district1}`,
          icon: 'search',
          priority: 2,
        },
        {
          id: 'export-comparison',
          label: 'Export Comparison',
          action: 'output:generateReport',
          icon: 'download',
          priority: 3,
        },
      ],
      data: {
        district1: result1.data,
        district2: result2.data,
      },
      metadata: this.buildMetadata('district_compare', startTime, query),
    };
  }

  private async handleList(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    const area = getPoliticalRegionEnv().summaryAreaName;
    const districts = isPAPoliticalRegion()
      ? {
          congressional: ['PA-07', 'PA-08', 'PA-17'],
          stateSenate: ['45', '48', '12'],
          stateHouse: ['171', '100', '23'],
          school: [
            'Philadelphia City SD',
            'Pittsburgh SD',
            'Central Dauphin SD',
          ],
        }
      : {
          congressional: ['MI-07'],
          stateSenate: ['21', '28'],
          stateHouse: ['73', '74', '75', '77'],
          school: [
            'Lansing Public Schools',
            'East Lansing Public Schools',
            'Okemos Public Schools',
            'Mason Public Schools',
            'Haslett Public Schools',
            'Williamston Community Schools',
          ],
        };

    const responseLines = [
      `**Example districts (${area} data):**`,
      '',
      '**Congressional:**',
      ...districts.congressional.map(d => `- ${d}`),
      '',
      '**State Senate:**',
      ...districts.stateSenate.map(d => `- District ${d}`),
      '',
      '**State House:**',
      ...districts.stateHouse.map(d => `- District ${d}`),
      '',
      '**School districts (examples):**',
      ...districts.school.map(d => `- ${d}`),
      '',
      '**Try asking:**',
      isPAPoliticalRegion()
        ? '- "Show State House 171"\n- "Analyze PA-07"\n- "Compare HD-100 vs HD-101"'
        : '- "Show State House 73"\n- "Analyze Senate District 21"\n- "Compare HD-73 vs HD-74"',
    ];

    return {
      success: true,
      response: responseLines.join('\n'),
      suggestedActions: isPAPoliticalRegion()
        ? [
            { id: 'ph-171', label: 'State House 171', action: 'Show State House 171', icon: 'map-pin', priority: 1 },
            { id: 'ps-45', label: 'Senate District 45', action: 'Show Senate District 45', icon: 'map-pin', priority: 2 },
            { id: 'pa-07', label: 'Congressional PA-07', action: 'Show Congressional District PA-07', icon: 'map-pin', priority: 3 },
          ]
        : [
            { id: 'hd-73', label: 'State House 73', action: 'Show State House 73', icon: 'map-pin', priority: 1 },
            { id: 'sd-21', label: 'Senate District 21', action: 'Show Senate District 21', icon: 'map-pin', priority: 2 },
            { id: 'mi-07', label: 'Congressional MI-07', action: 'Show Congressional District MI-07', icon: 'map-pin', priority: 3 },
          ],
      data: districts,
      metadata: this.buildMetadata('district_list', startTime, query),
    };
  }

  private async handlePrecincts(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    const entities = this.extractEntities(query.originalQuery);

    // Determine which district type
    let districtId: string | undefined;
    let districtType: 'state_house' | 'state_senate' | 'congressional' | 'school' | undefined;

    if (entities.stateHouse) {
      districtId = entities.stateHouse;
      districtType = 'state_house';
    } else if (entities.stateSenate) {
      districtId = entities.stateSenate;
      districtType = 'state_senate';
    } else if (entities.congressional) {
      districtId = entities.congressional;
      districtType = 'congressional';
    } else if (entities.schoolDistrict) {
      districtId = entities.schoolDistrict;
      districtType = 'school';
    }

    if (!districtId || !districtType) {
      return {
        success: false,
        response: 'Please specify which district to show precincts for (e.g., "What precincts are in State House 73?").',
        error: 'No district specified',
      };
    }

    // Use handleDistrictAnalysis to get precinct list
    const result = await handleDistrictAnalysis({
      [districtType === 'state_house' ? 'stateHouse' :
        districtType === 'state_senate' ? 'stateSenate' :
          districtType === 'congressional' ? 'congressional' :
            'schoolDistrict']: districtId,
      districtLevel: districtType,
    });

    // Get enrichment context (RAG + Knowledge Graph)
    let distNum: string | undefined;
    if (districtType === 'state_house') distNum = stripDistrictIdForEnrichment(districtId, 'state_house');
    else if (districtType === 'state_senate') distNum = stripDistrictIdForEnrichment(districtId, 'state_senate');
    else if (districtType === 'congressional') distNum = stripDistrictIdForEnrichment(districtId, 'congressional');
    const enrichment = await getEnrichmentForQuery(query.originalQuery, {
      districtType: districtType === 'school' ? 'county' : districtType,
      districtNumber: distNum,
    });
    const enrichmentSections = formatEnrichmentSections(enrichment);

    // The result already includes precinct information
    return {
      success: true,
      ...result,
      response: result.response + enrichmentSections,
      metadata: this.buildMetadata('district_precincts', startTime, query),
    };
  }

  // --------------------------------------------------------------------------
  // Entity Extraction
  // --------------------------------------------------------------------------

  extractEntities(query: string): ExtractedEntities {
    const entities: ExtractedEntities = {};
    const pa = isPAPoliticalRegion();

    const houseMatch = query.match(STATE_HOUSE_PATTERN);
    if (houseMatch) {
      entities.stateHouse = pa ? `pa-house-${houseMatch[1]}` : `mi-house-${houseMatch[1]}`;
    }

    const senateMatch = query.match(STATE_SENATE_PATTERN);
    if (senateMatch) {
      entities.stateSenate = pa ? `pa-senate-${senateMatch[1]}` : `mi-senate-${senateMatch[1]}`;
    }

    const congressMatchPA = query.match(CONGRESSIONAL_PATTERN_PA);
    const congressMatchMI = query.match(CONGRESSIONAL_PATTERN_MI);
    if (pa && congressMatchPA) {
      entities.congressional = `pa-congress-${congressMatchPA[1].padStart(2, '0')}`;
    } else if (!pa && congressMatchMI) {
      entities.congressional = `mi-${congressMatchMI[1].padStart(2, '0')}`;
    } else if (pa && congressMatchMI) {
      entities.congressional = `pa-congress-${congressMatchMI[1].padStart(2, '0')}`;
    }

    const schoolMatch = query.match(SCHOOL_DISTRICT_PATTERN);
    if (schoolMatch) {
      entities.schoolDistrict = schoolMatch[1].toLowerCase().replace(/\s+/g, '-');
    }

    return entities;
  }

  // --------------------------------------------------------------------------
  // Helper Methods
  // --------------------------------------------------------------------------

  private extractDistrictPair(query: string): string[] | null {
    const pa = isPAPoliticalRegion();
    const hp = pa ? 'pa-house-' : 'mi-house-';
    const sp = pa ? 'pa-senate-' : 'mi-senate-';
    const cp = pa ? 'pa-congress-' : 'mi-';

    const houseMatches = Array.from(query.matchAll(/(?:state\s+house|hd)\s*[-\s]?(\d+)/gi));
    if (houseMatches.length >= 2) {
      return [`${hp}${houseMatches[0][1]}`, `${hp}${houseMatches[1][1]}`];
    }

    const senateMatches = Array.from(query.matchAll(/(?:state\s+senate|sd)\s*[-\s]?(\d+)/gi));
    if (senateMatches.length >= 2) {
      return [`${sp}${senateMatches[0][1]}`, `${sp}${senateMatches[1][1]}`];
    }

    const congressMatches = Array.from(query.matchAll(/(?:congressional|mi|pa)\s*[-\s]?(\d+)/gi));
    if (congressMatches.length >= 2) {
      const a = congressMatches[0][1].padStart(2, '0');
      const b = congressMatches[1][1].padStart(2, '0');
      return pa ? [`pa-congress-${a}`, `pa-congress-${b}`] : [`mi-${a}`, `mi-${b}`];
    }

    return null;
  }

  private parseDistrictId(districtId: string): {
    congressional?: string;
    stateSenate?: string;
    stateHouse?: string;
    schoolDistrict?: string;
    districtLevel?: 'congressional' | 'state_senate' | 'state_house' | 'school';
  } {
    if (districtId.startsWith('pa-house-') || districtId.startsWith('mi-house-')) {
      return {
        stateHouse: districtId,
        districtLevel: 'state_house',
      };
    } else if (districtId.startsWith('pa-senate-') || districtId.startsWith('mi-senate-')) {
      return {
        stateSenate: districtId,
        districtLevel: 'state_senate',
      };
    } else if (
      districtId.startsWith('pa-congress-') ||
      (districtId.startsWith('mi-') && !districtId.includes('house') && !districtId.includes('senate'))
    ) {
      return {
        congressional: districtId,
        districtLevel: 'congressional',
      };
    } else {
      return {
        schoolDistrict: districtId,
        districtLevel: 'school',
      };
    }
  }

  // --------------------------------------------------------------------------
  // Jurisdiction Lookup Handler
  // --------------------------------------------------------------------------

  private async handleJurisdictionLookup(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    // Extract jurisdiction from query
    const jurisdictionPattern = isPAPoliticalRegion()
      ? /(philadelphia|pittsburgh|harrisburg|allentown|erie|reading|scranton|lancaster|york|chester|bethlehem)/i
      : /(east\s+lansing|lansing|meridian|delhi|williamston|mason|okemos|haslett)/i;
    const match = query.originalQuery.match(jurisdictionPattern);
    const jurisdiction = match ? match[1] : null;

    if (!jurisdiction) {
      return {
        success: false,
        response: isPAPoliticalRegion()
          ? 'Please specify a city. Examples: Philadelphia, Pittsburgh, Harrisburg, Allentown, Erie, Reading.'
          : 'Please specify a city or township. Available: Lansing, East Lansing, Meridian Township, Delhi Township, Mason, Okemos, Haslett, Williamston.',
        suggestedActions: isPAPoliticalRegion()
          ? [
              { id: 'philly', label: 'Philadelphia', action: 'Show precincts in Philadelphia', priority: 1 },
              { id: 'pitt', label: 'Pittsburgh', action: 'Show precincts in Pittsburgh', priority: 2 },
            ]
          : [
              { id: 'east-lansing', label: 'East Lansing Precincts', action: 'Show precincts in East Lansing', priority: 1 },
              { id: 'lansing', label: 'Lansing Precincts', action: 'Show precincts in Lansing', priority: 2 },
            ],
        error: 'No jurisdiction specified',
      };
    }

    try {
      // Import politicalDataService
      const { politicalDataService } = await import('@/lib/services/PoliticalDataService');

      // Get all precincts and filter by jurisdiction
      const allPrecincts = await politicalDataService.getSegmentEnginePrecincts();
      const jurisdictionNormalized = jurisdiction.toLowerCase().replace(/\s+/g, ' ');

      const matchingPrecincts = allPrecincts.filter((p: any) =>
        p.jurisdiction?.toLowerCase().includes(jurisdictionNormalized)
      );

      if (matchingPrecincts.length === 0) {
        return {
          success: false,
          response: `No precincts found in "${jurisdiction}". Try a different city or township.`,
          error: 'No precincts found',
        };
      }

      const totalVoters = matchingPrecincts.reduce((sum: number, p: any) => sum + (p.registeredVoters || 0), 0);
      const avgLean = matchingPrecincts.reduce((sum: number, p: any) => sum + (p.partisanLean || 0), 0) / matchingPrecincts.length;
      const avgGOTV = matchingPrecincts.reduce((sum: number, p: any) => sum + (p.gotvPriority || 0), 0) / matchingPrecincts.length;

      const response = [
        `**Precincts in ${jurisdiction.charAt(0).toUpperCase() + jurisdiction.slice(1)}:**`,
        '',
        `Found **${matchingPrecincts.length} precincts** with **${totalVoters.toLocaleString()} voters**.`,
        '',
        `**Jurisdiction Average:**`,
        `- Partisan Lean: ${avgLean >= 0 ? 'D+' : 'R+'}${Math.abs(avgLean).toFixed(1)}`,
        `- GOTV Priority: ${avgGOTV.toFixed(0)}/100`,
        '',
        `**Precincts:**`,
        ...matchingPrecincts.slice(0, 8).map((p: any, i: number) =>
          `${i + 1}. ${p.precinctName} (${p.registeredVoters?.toLocaleString() || 0} voters, ${(p.partisanLean ?? 0) >= 0 ? 'D+' : 'R+'}${Math.abs(p.partisanLean ?? 0).toFixed(1)})`
        ),
        matchingPrecincts.length > 8 ? `\n...and ${matchingPrecincts.length - 8} more precincts` : '',
      ].join('\n');

      // Get enrichment context (RAG + Knowledge Graph)
      const enrichment = await getEnrichmentForQuery(query.originalQuery);
      const enrichmentSections = formatEnrichmentSections(enrichment);

      return {
        success: true,
        response: response + enrichmentSections,
        mapCommands: [
          {
            action: 'highlight',
            target: 'precincts',
            ids: matchingPrecincts.map((p: any) => p.precinctId),
            style: { fillColor: '#3B82F6', fillOpacity: 0.6 },
          },
          {
            action: 'fitBounds',
            target: 'selection',
          },
        ],
        suggestedActions: [
          {
            id: 'save-jurisdiction',
            label: `Save as "${jurisdiction} Precincts"`,
            action: `Save segment as ${jurisdiction}`,
            priority: 1,
          },
          {
            id: 'find-gotv',
            label: `High-GOTV in ${jurisdiction}`,
            action: `Find high GOTV precincts in ${jurisdiction}`,
            priority: 2,
          },
          {
            id: 'compare',
            label: 'Compare to another city',
            action: isPAPoliticalRegion()
              ? `Compare ${jurisdiction} to Pittsburgh`
              : `Compare ${jurisdiction} to East Lansing`,
            priority: 3,
          },
        ],
        data: { jurisdiction, precincts: matchingPrecincts },
        metadata: this.buildMetadata('jurisdiction_lookup', startTime, query),
      };
    } catch (error) {
      return {
        success: false,
        response: 'Failed to load jurisdiction data. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // --------------------------------------------------------------------------
  // Metadata
  // --------------------------------------------------------------------------

  private buildMetadata(intent: string, startTime: number, query: ParsedQuery): any {
    return {
      handlerName: this.name,
      processingTimeMs: Date.now() - startTime,
      queryType: 'district',
      matchedIntent: intent,
      confidence: query.confidence,
    };
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const districtHandler = new DistrictHandler();

export default DistrictHandler;
