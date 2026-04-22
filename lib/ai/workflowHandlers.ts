/**
 * Workflow Handlers for AI Political Conversation
 *
 * Real handlers that fetch and process data from APIs
 * Enhanced with context awareness (Phase 2 - Claude Integration Plan)
 *
 * INTENT → COMMAND TRANSLATION GUIDE (P2-34):
 * This file translates user intents (parsed from natural language) into map commands.
 *
 * Intent Types → Map Commands:
 * - filter_request → showHeatmap (for metrics) OR showChoropleth (for margins)
 * - district_query → flyTo (location) + showChoropleth OR showHeatmap
 * - comparison → highlightComparison (two entities, different colors)
 * - spatial_query → showBuffer (radius/drivetime) + highlight (results)
 * - segment_create → highlight (matching precincts)
 *
 * Command Selection Logic:
 * - Numeric metrics (swing, gotv, persuasion) → showHeatmap
 * - Categorical/competitive data → showChoropleth
 * - Location-based queries → flyTo + visualization layer
 * - Multiple entities → highlightComparison OR showNumberedMarkers
 * - Spatial proximity → showBuffer + highlight
 */

import type { MapCommand, SuggestedAction } from '@/components/ai-native/AIPoliticalSessionHost';
import { fuzzyMatchPrecinct } from './intentParser';
import { getRecentReports, REPORT_TYPE_CONFIG } from './ReportHistoryService';
import { getStateManager } from '@/lib/ai-native/ApplicationStateManager';
import { getSuggestionEngine } from '@/lib/ai-native/SuggestionEngine';
import {
  frameAsDiscovery,
} from '@/lib/ai/insights';
import { getPoliticalRegionEnv } from '@/lib/political/politicalRegionConfig';
import {
  formatPoliticalDistrictLabel,
  stripDistrictIdForEnrichment,
  isPAPoliticalRegion,
} from '@/lib/political/formatPoliticalDistrictLabel';

import {
  getCitationService,
  type CitationKey,
} from '@/lib/ai/confidence';
import {
  getLastChatExportPrecinctIds,
  getLastUserQueryForExport,
} from '@/lib/ai-native/lastChatExportPrecinctIds';
import {
  buildSegmentFiltersFromFilterCriteria,
  hasAnySegmentFilters,
  normalizeFilterMetric,
} from '@/lib/segmentation/buildSegmentFiltersFromFilterCriteria';

import {
  createSourcesSection,
  createPrecinctsSection,
} from '@/lib/ai-native/handlers/types';

import {
  getStateHouseContext,
  getStateSenateContext,
  getCongressionalContext,
  type CandidateContext,
} from '@/lib/knowledge-graph/CandidateContextService';

import {
  enrichDistrictAnalysis,
  enrichFilterQuery,
  type EnrichmentContext,
} from '@/lib/context';

import { getKnowledgeGraph, type Entity, type Relationship, type RelationshipType } from '@/lib/knowledge-graph';


interface ExplorationContext {
  recentPrecincts: string[];
  explorationDepth: number;
  toolsVisited: string[];
  hasHighValueFinds: boolean;
  sessionMinutes: number;
  filtersApplied: number;
  comparisonsMade: number;
}

type ExpertiseLevel = 'novice' | 'intermediate' | 'power_user';


export interface HandlerResult {
  response: string;
  mapCommands?: MapCommand[];
  suggestedActions?: SuggestedAction[];
  data?: any;
  metadata?: {
    showGraph?: boolean;
    entities?: any[];
    relationships?: any[];
    [key: string]: any;
  };
}

interface PrecinctData {
  id: string;
  name: string;
  jurisdiction: string;
  jurisdictionType: 'city' | 'township';
  demographics: {
    totalPopulation: number;
    population18up: number;
    registeredVoters?: number;  // From election data
    medianAge: number;
    medianHHI: number;
    collegePct: number;
    homeownerPct: number;
    diversityIndex: number;
    populationDensity: number;
  };
  political: {
    demAffiliationPct: number;
    repAffiliationPct: number;
    independentPct: number;
    liberalPct: number;
    moderatePct: number;
    conservativePct: number;
  };
  electoral: {
    partisanLean: number;
    swingPotential: number;
    competitiveness: string;
    avgTurnout: number;
    turnoutDropoff: number;
  };
  targeting: {
    gotvPriority: number;
    persuasionOpportunity: number;
    combinedScore: number;
    strategy: string;
  };
  engagement?: {
    politicalDonorPct: number;
    cnnMsnbcPct: number;
    foxNewsmaxPct: number;
    socialMediaPct: number;
    nprPct: number;
  };
}

interface ReportOption {
  id: string;
  type: string;
  label: string;
  description: string;
  pages: string;
  action: string;
  icon: string;
  emoji: string;  // Emoji icon for visual distinction
  available: boolean;
  recommended?: boolean;
  metadata?: Record<string, unknown>;
}

// Emoji icons for report types
const REPORT_EMOJIS: Record<string, string> = {
  executive: '📋',
  targeting: '🎯',
  profile: '📊',
  comparison: '⚖️',
  segment: '🔍',
};

export async function handleDistrictAnalysis(
  districtParams: {
    congressional?: string;
    stateSenate?: string;
    stateHouse?: string;
    schoolDistrict?: string;
    countyCommissioner?: string;
    districtLevel?: 'congressional' | 'state_senate' | 'state_house' | 'school' | 'county_commissioner';
  }
): Promise<HandlerResult> {
  try {
    // Dynamic import to avoid SSR issues
    const { politicalDataService } = await import('@/lib/services/PoliticalDataService');

    // Determine which district type was requested
    const districtType = districtParams.districtLevel ||
      (districtParams.congressional ? 'congressional' :
        districtParams.stateSenate ? 'state_senate' :
          districtParams.stateHouse ? 'state_house' :
            districtParams.schoolDistrict ? 'school' :
              districtParams.countyCommissioner ? 'county_commissioner' : null);

    const districtId =
      districtParams.congressional ||
      districtParams.stateSenate ||
      districtParams.stateHouse ||
      districtParams.schoolDistrict ||
      districtParams.countyCommissioner;

    if (!districtType || !districtId) {
      if (isPAPoliticalRegion()) {
        return {
          response: `Please specify a district to analyze. Examples:\n• "Analyze State House 171"\n• "Show PA-07"\n• "What's in Senate District 45?"\n• "School district Pittsburgh"`,
          suggestedActions: [
            { id: 'ph-171', label: 'State House 171', action: 'Show State House 171', icon: 'map-pin' },
            { id: 'ps-45', label: 'Senate District 45', action: 'Show Senate District 45', icon: 'map-pin' },
            { id: 'pa-07', label: 'PA-07 Congressional', action: 'Analyze PA-07', icon: 'map-pin' },
          ],
        };
      }
      return {
        response: `Please specify a district to analyze. Examples:\n• "Analyze State House 73"\n• "Show MI-07"\n• "What's in Senate District 21?"\n• "Mason Public Schools district"`,
        suggestedActions: [
          { id: 'hd-73', label: 'State House 73', action: 'Show State House 73', icon: 'map-pin' },
          { id: 'hd-74', label: 'State House 74', action: 'Show State House 74', icon: 'map-pin' },
          { id: 'sd-21', label: 'Senate District 21', action: 'Show Senate District 21', icon: 'map-pin' },
          { id: 'mi-07', label: 'MI-07 Congressional', action: 'Analyze MI-07', icon: 'map-pin' },
        ],
      };
    }

    // Get precincts for the specified district using PoliticalDataService crosswalk
    let precincts: Awaited<ReturnType<typeof politicalDataService.getPrecinctsByStateHouseDistrict>> = [];
    let districtLabel = '';
    let candidateContext: CandidateContext | null = null;

    const summaryArea = getPoliticalRegionEnv().summaryAreaName;

    if (districtType === 'congressional') {
      precincts = await politicalDataService.getPrecinctsByCongressionalDistrict(districtId);
      districtLabel = formatPoliticalDistrictLabel(districtId);
      if (!isPAPoliticalRegion()) {
        try {
          candidateContext = await getCongressionalContext();
        } catch (e) {
          console.warn('[handleDistrictAnalysis] Could not load congressional context:', e);
        }
      }
    } else if (districtType === 'state_senate') {
      precincts = await politicalDataService.getPrecinctsByStateSenateDistrict(districtId);
      districtLabel = formatPoliticalDistrictLabel(districtId);
      if (!isPAPoliticalRegion()) {
        const distNum = stripDistrictIdForEnrichment(districtId, 'state_senate');
        try {
          candidateContext = await getStateSenateContext(distNum);
        } catch (e) {
          console.warn('[handleDistrictAnalysis] Could not load state senate context:', e);
        }
      }
    } else if (districtType === 'state_house') {
      precincts = await politicalDataService.getPrecinctsByStateHouseDistrict(districtId);
      districtLabel = formatPoliticalDistrictLabel(districtId);
      if (!isPAPoliticalRegion()) {
        const distNum = stripDistrictIdForEnrichment(districtId, 'state_house');
        try {
          candidateContext = await getStateHouseContext(distNum);
        } catch (e) {
          console.warn('[handleDistrictAnalysis] Could not load state house context:', e);
        }
      }
    } else if (districtType === 'school') {
      precincts = await politicalDataService.getPrecinctsBySchoolDistrict(districtId);
      // Format school district name nicely
      districtLabel = districtId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    } else if (districtType === 'county_commissioner') {
      // County commissioner districts need to be implemented separately if needed
      return {
        response: `County Commissioner district analysis is coming soon. For now, try State House, State Senate, Congressional, or School districts.`,
        suggestedActions: isPAPoliticalRegion()
          ? [
            { id: 'ph-171', label: 'State House 171', action: 'Show State House 171', icon: 'map-pin' },
            { id: 'ps-45', label: 'Senate District 45', action: 'Show Senate District 45', icon: 'map-pin' },
          ]
          : [
            { id: 'hd-73', label: 'State House 73', action: 'Show State House 73', icon: 'map-pin' },
            { id: 'sd-21', label: 'Senate District 21', action: 'Show Senate District 21', icon: 'map-pin' },
          ],
      };
    }

    if (precincts.length === 0) {
      return {
        response: `No precincts found for ${districtLabel}. This district may not intersect ${summaryArea} precinct data, or boundaries are not available yet.`,
        suggestedActions: [
          {
            id: 'list-districts',
            label: 'List example districts',
            action: isPAPoliticalRegion()
              ? 'What Pennsylvania legislative districts can I analyze?'
              : 'What districts are in Ingham County?',
            icon: 'list',
          },
          {
            id: 'try-hd',
            label: isPAPoliticalRegion() ? 'Try State House 171' : 'Try State House 73',
            action: isPAPoliticalRegion() ? 'Show State House 171' : 'Show State House 73',
            icon: 'map-pin',
          },
        ],
      };
    }

    // Get enrichment context (RAG + Knowledge Graph)
    let enrichmentContext: EnrichmentContext | null = null;
    try {
      const enrichDistrictType = districtType === 'state_house' ? 'state_house' :
        districtType === 'state_senate' ? 'state_senate' :
          districtType === 'congressional' ? 'congressional' : 'county';
      let distNum = '';
      if (districtType === 'congressional') {
        distNum = stripDistrictIdForEnrichment(districtId, 'congressional');
      } else if (districtType === 'state_senate') {
        distNum = stripDistrictIdForEnrichment(districtId, 'state_senate');
      } else if (districtType === 'state_house') {
        distNum = stripDistrictIdForEnrichment(districtId, 'state_house');
      }
      enrichmentContext = await enrichDistrictAnalysis(enrichDistrictType, distNum);
      console.log('[handleDistrictAnalysis] Enrichment:', {
        ragDocs: enrichmentContext.rag.documents.length,
        intel: enrichmentContext.rag.currentIntel.length,
        relevance: enrichmentContext.relevance.overallScore.toFixed(2)
      });
    } catch (e) {
      console.warn('[handleDistrictAnalysis] Enrichment failed:', e);
    }

    // Get aggregate statistics using PoliticalDataService
    const aggregate = await politicalDataService.getDistrictAggregate(
      districtType === 'state_house' ? 'stateHouse' :
        districtType === 'state_senate' ? 'stateSenate' :
          districtType === 'congressional' ? 'congressional' :
            'schoolDistrict',
      districtId
    );

    // Format the response - UnifiedPrecinct uses 'name' property

    // Helper function to classify competitiveness
    const getCompetitivenessLabel = (lean: number): { label: string; emoji: string; analysis: string } => {
      const absLean = Math.abs(lean);
      const party = lean >= 0 ? 'Democratic' : 'Republican';
      const shortParty = lean >= 0 ? 'D' : 'R';

      if (absLean > 20) return {
        label: `Safe ${party}`,
        emoji: '🔒',
        analysis: `This is a safely ${party.toLowerCase()} district with a ${shortParty}+${absLean.toFixed(0)} lean. Barring major political shifts, this seat is unlikely to change hands.`
      };
      if (absLean > 10) return {
        label: `Likely ${party}`,
        emoji: '📊',
        analysis: `Leans ${party.toLowerCase()} at ${shortParty}+${absLean.toFixed(0)}. While not competitive most cycles, a wave election could put this in play.`
      };
      if (absLean > 5) return {
        label: `Lean ${party}`,
        emoji: '⚖️',
        analysis: `A competitive district leaning ${party.toLowerCase()} at ${shortParty}+${absLean.toFixed(0)}. This could be a key battleground in close elections.`
      };
      return {
        label: 'Toss-Up',
        emoji: '🎯',
        analysis: `This is a true battleground at ${shortParty}+${absLean.toFixed(0)}. Both parties should consider this a priority target.`
      };
    };

    // Helper to interpret swing score
    const getSwingAnalysis = (swing: number): string => {
      if (swing >= 75) return 'High volatility — outcomes here have varied significantly across recent elections.';
      if (swing >= 50) return 'Moderate volatility — some ticket-splitting and competitive races in recent cycles.';
      if (swing >= 25) return 'Low volatility — voters here are fairly consistent in their choices.';
      return 'Very stable — this area votes predictably.';
    };

    // Helper to interpret GOTV priority
    const getGOTVAnalysis = (gotv: number, turnout: number): string => {
      if (gotv >= 70 && turnout < 60) return `High priority for GOTV — turnout of ${turnout.toFixed(0)}% is below average with significant untapped potential.`;
      if (gotv >= 70) return 'Strong GOTV target due to favorable demographics and room for improvement.';
      if (gotv >= 40) return 'Moderate GOTV potential — consider targeting if resources allow.';
      return 'Lower priority for GOTV efforts.';
    };

    // Build header with candidate context from Knowledge Graph
    let headerSection = `## ${districtLabel}\n\n`;
    if (candidateContext?.incumbent) {
      const { incumbent, office } = candidateContext;
      const partyLabel = incumbent.party === 'DEM' ? 'Democrat' : incumbent.party === 'REP' ? 'Republican' : incumbent.party;
      const partyEmoji = incumbent.party === 'DEM' ? '🔵' : incumbent.party === 'REP' ? '🔴' : '⚪';
      headerSection += `${partyEmoji} **${incumbent.name}** (${partyLabel})\n`;

      // Add 2024 election result if available
      if (incumbent.election2024?.percentage !== undefined) {
        const pct = incumbent.election2024.percentage;
        const opponent = incumbent.election2024.opponent;
        headerSection += `*2024 Result: Won with ${pct.toFixed(1)}%${opponent ? ` vs ${opponent}` : ''}*\n`;
      }

      // Add next election info
      if (office?.nextElection) {
        const nextDate = new Date(office.nextElection);
        const dateStr = nextDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        headerSection += `*Next Election: ${dateStr}*\n`;
      }

      headerSection += '\n';
    }

    // Build analysis section with interpretation
    let analysisSection = '';
    if (aggregate) {
      const { scores, precinctCount, registeredVoters } = aggregate;
      const turnoutDisplay = scores.avgTurnout > 1 ? scores.avgTurnout : scores.avgTurnout * 100;
      const competitiveness = getCompetitivenessLabel(scores.partisanLean);
      const leanDirection = scores.partisanLean >= 0 ? 'D' : 'R';
      const leanValue = Math.abs(scores.partisanLean).toFixed(1);

      // Strategic Assessment (the "So What")
      analysisSection += `### ${competitiveness.emoji} Strategic Assessment\n\n`;
      analysisSection += `**${competitiveness.label}** — ${leanDirection}+${leanValue}\n\n`;
      analysisSection += `${competitiveness.analysis}\n\n`;

      // Key Metrics - using definition list style (survives entity segmentation)
      const turnoutAssess = turnoutDisplay > 65 ? 'above average' : turnoutDisplay > 55 ? 'average' : 'below average';
      const swingAssess = scores.swingPotential >= 50 ? 'competitive' : 'stable';
      const gotvAssess = scores.gotvPriority >= 60 ? 'high value' : 'moderate';
      const persuasionAssess = scores.persuasionOpportunity >= 50 ? 'good target' : 'lower priority';

      analysisSection += `### 📈 Key Metrics\n\n`;
      analysisSection += `**${registeredVoters.toLocaleString()}** registered voters across **${precinctCount}** precincts\n\n`;
      analysisSection += `- **Turnout:** ${turnoutDisplay.toFixed(1)}% (${turnoutAssess})\n`;
      analysisSection += `- **Swing:** ${scores.swingPotential.toFixed(0)}/100 (${swingAssess})\n`;
      analysisSection += `- **GOTV:** ${scores.gotvPriority.toFixed(0)}/100 (${gotvAssess})\n`;
      analysisSection += `- **Persuasion:** ${scores.persuasionOpportunity.toFixed(0)}/100 (${persuasionAssess})\n\n`;

      // Tactical Insights
      analysisSection += `### 💡 What This Means\n\n`;
      analysisSection += `**Swing:** ${getSwingAnalysis(scores.swingPotential)}\n\n`;
      analysisSection += `**Turnout:** ${getGOTVAnalysis(scores.gotvPriority, turnoutDisplay)}\n\n`;
      if (scores.persuasionOpportunity >= 45) {
        analysisSection += `**Persuasion:** With a ${scores.persuasionOpportunity.toFixed(0)}/100 score, direct voter contact could move opinions here.\n\n`;
      }
    } else {
      analysisSection += `This district contains **${precincts.length} precincts**. Detailed metrics are being calculated.\n\n`;
    }

    // NOTE: Enrichment sections (intel, issues, endorsements) are added by the handler
    // via formatEnrichmentSections() - do not duplicate here

    // Build main response without precincts/sources (those go in collapsible sections)
    const mainResponse = headerSection + analysisSection;

    // Collapsible sections for precincts and sources
    const precinctNames = precincts.map(p => p.name);
    const precinctsCollapsible = createPrecinctsSection(precinctNames, 8);
    const sourcesCollapsible = createSourcesSection(['elections', 'gis', 'demographics']);

    const fullResponse = mainResponse + '\n\n' + precinctsCollapsible + '\n\n' + sourcesCollapsible;

    // Get precinct IDs for highlighting on map - UnifiedPrecinct uses 'id' and 'name'
    const precinctIds = precincts.map(p => p.id || p.name);

    // Suggested actions based on district type
    const suggestedActions: SuggestedAction[] = [
      {
        id: 'show-swing',
        label: 'Show swing precincts',
        action: 'map:showHeatmap',
        icon: 'trending-up',
        metadata: { metric: 'swing_potential' }
      },
      {
        id: 'show-gotv',
        label: 'Show GOTV priority',
        action: 'map:showHeatmap',
        icon: 'users',
        metadata: { metric: 'gotv_priority' }
      },

      {
        id: 'generate-report',
        label: 'Generate district report',
        action: `Generate report for ${districtLabel}`,
        icon: 'file-text'
      },
    ];

    // Add compare suggestion if state house
    if (districtType === 'state_house') {
      const currentNum = parseInt(stripDistrictIdForEnrichment(districtId, 'state_house'), 10);
      if (isPAPoliticalRegion() && Number.isFinite(currentNum)) {
        const next = Math.min(203, Math.max(1, currentNum + 1));
        if (next !== currentNum) {
          suggestedActions.push({
            id: 'compare-district',
            label: `Compare to HD-${next}`,
            action: `Compare State House ${currentNum} to State House ${next}`,
            icon: 'git-compare',
          });
        }
      } else if (!isPAPoliticalRegion() && Number.isFinite(currentNum)) {
        const otherDistricts = [73, 74, 75, 77].filter(n => n !== currentNum);
        if (otherDistricts.length > 0) {
          suggestedActions.push({
            id: 'compare-district',
            label: `Compare to HD-${otherDistricts[0]}`,
            action: `Compare State House ${currentNum} to State House ${otherDistricts[0]}`,
            icon: 'git-compare',
          });
        }
      }
    }

    return {
      response: fullResponse,
      mapCommands: [
        {
          type: 'highlight',
          target: precinctIds.slice(0, 50) // Limit to 50 for performance
        },
        {
          type: 'setExtent',
          target: precinctIds.slice(0, 50)
        }
      ],
      suggestedActions,
      data: {
        districtType,
        districtId,
        districtLabel,
        precinctCount: precincts.length,
        aggregate,
        precinctIds
      }
    };
  } catch (error) {
    console.error('Error in handleDistrictAnalysis:', error);
    return {
      response: `I encountered an error analyzing this district. Let me help you recover.`,
      suggestedActions: [
        {
          id: 'retry',
          label: 'Try again',
          action: isPAPoliticalRegion()
            ? 'What Pennsylvania districts can I analyze?'
            : 'What districts are in Ingham County?',
          icon: 'refresh-cw',
        },
        { id: 'browse', label: 'Browse all precincts', action: 'Show me all precincts', icon: 'list' },
      ],
    };
  }
}

/** Segment API returns PrecinctMatch (precinctName / precinctId); keep fallbacks for older shapes. */
function filterResultPrecinctLabel(p: { precinctName?: string; name?: string }): string {
  return p.precinctName ?? p.name ?? 'Unknown precinct';
}

function filterResultPrecinctKey(p: {
  precinctId?: string;
  id?: string;
  precinctName?: string;
  name?: string;
}): string {
  return p.precinctId ?? p.id ?? filterResultPrecinctLabel(p);
}

export async function handleFilterRequest(filterCriteria: any): Promise<HandlerResult> {
  try {
    filterCriteria.metric = normalizeFilterMetric(filterCriteria.metric);

    const filters = buildSegmentFiltersFromFilterCriteria(filterCriteria);

    if (!hasAnySegmentFilters(filters)) {
      return {
        response:
          'I could not apply a filter from that question (no metric or criteria was recognized). Try asking for **precincts with GOTV priority above 70**, **swing potential**, or **partisan lean within ±5 points**.',
        suggestedActions: [
          {
            id: 'gotv',
            label: 'High GOTV',
            action: 'Show precincts with GOTV priority above 70',
            icon: 'target',
          },
          {
            id: 'swing',
            label: 'Swing areas',
            action: 'Show me swing areas with margin less than 5%',
            icon: 'filter',
          },
        ],
      };
    }

    // Call segments API
    const response = await fetch('/api/segments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filters })
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to filter precincts');
    }

    const results = data.results;
    const count = results.matchingPrecincts?.length || 0;

    // Get enrichment context for filter query
    let enrichmentContext: EnrichmentContext | null = null;
    try {
      const precinctNames =
        results.matchingPrecincts?.slice(0, 10).map((p: any) => filterResultPrecinctLabel(p)) || [];
      const competitivenessOnly =
        filterCriteria.competitiveness?.length > 0 && !filterCriteria.metric;
      const queryDescription = competitivenessOnly
        ? `modeled competitiveness bucket(s): ${filterCriteria.competitiveness.join(', ')}`
        : `${filterCriteria.metric || 'filtered'} precincts`;
      enrichmentContext = await enrichFilterQuery(queryDescription, precinctNames, {
        includeCurrentIntel: !competitivenessOnly,
      });
    } catch (e) {
      console.warn('[handleFilterRequest] Enrichment failed:', e);
    }

    // Format response
    // NOTE: Enrichment sections are added by the handler via formatEnrichmentSections()
    const responseText = formatFilterResults(filterCriteria, results);

    // Determine appropriate visualization
    const mapCommands: MapCommand[] = [];

    // Show heatmap for numeric metrics; GOTV + low turnout → bivariate (both dimensions matter)
    if (filterCriteria.composite === 'gotv_high_turnout_low') {
      mapCommands.push({
        type: 'showBivariate',
        xMetric: 'gotv_priority',
        yMetric: 'turnout',
      });
    } else if (filterCriteria.metric && ['swing_potential', 'gotv_priority', 'persuasion_opportunity', 'combined_score', 'turnout'].includes(filterCriteria.metric)) {
      mapCommands.push({
        type: 'showHeatmap',
        metric: filterCriteria.metric
      });
    } else if (filterCriteria.metric === 'margin') {
      // Show choropleth for competitive precincts
      mapCommands.push({
        type: 'showChoropleth'
      });
    }

    // Highlight matching precincts if we have specific results
    if (results.matchingPrecincts && results.matchingPrecincts.length > 0 && results.matchingPrecincts.length <= 10) {
      const precinctKeys = results.matchingPrecincts.map((p: any) => filterResultPrecinctKey(p));
      mapCommands.push({
        type: 'highlight',
        target: precinctKeys
      });

      // Add numbered markers for ranked lists (top 5)
      const topPrecincts = results.matchingPrecincts.slice(0, 5);
      if (topPrecincts.length > 0) {
        mapCommands.push({
          type: 'showNumberedMarkers',
          numberedMarkers: topPrecincts.map((p: any, i: number) => ({
            precinctId: filterResultPrecinctKey(p),
            number: i + 1,
            label: filterResultPrecinctLabel(p)
          }))
        });
      }
    }

    // Combine core actions with visualization alternatives
    const baseSuggestions: SuggestedAction[] = [
      {
        id: 'refine-filter',
        label: 'Refine filter criteria',
        action: 'Refine my filter',
        icon: 'sliders'
      },
      {
        id: 'export-list',
        label: 'Export precinct list',
        action: 'Export these precincts to CSV',
        icon: 'download'
      },

    ];

    // Enhance response with context (Phase 2)
    const context = getExplorationContext();
    let enhancedResponse = responseText;

    // If user has filtered before, show comparative context
    if (context.filtersApplied > 1) {
      enhancedResponse += `\n\n📊 *This is your ${ordinalSuffix(context.filtersApplied)} filter this session. Consider combining criteria for more targeted results.*`;
    }

    // Wave 6B.5: Check for serendipitous cross-domain insights
    enhancedResponse = await checkAndAppendSerendipitousInsight(
      enhancedResponse,
      'filter_applied',
    );

    // Wave 6D.5: Check for cross-tool insights (donor-GOTV, segment-canvass)
    if (filterCriteria.metric === 'gotv_priority' || filterCriteria.metric === 'swing_potential') {
      const donorGOTVCheck = checkDonorGOTVOverlap();
      if (donorGOTVCheck.hasOverlap) {
        enhancedResponse += `\n\n${donorGOTVCheck.insight}`;
      }
    }

    const segmentCanvassCheck = checkSegmentCanvassOpportunity();
    if (segmentCanvassCheck.hasOpportunity && count > 0 && count <= 20) {
      enhancedResponse += `\n\n${segmentCanvassCheck.insight}`;
    }

    // Add context-aware suggestions
    const contextAwareSuggestions = getContextAwareSuggestions(baseSuggestions);

    return {
      response: enhancedResponse,
      mapCommands,
      suggestedActions: contextAwareSuggestions,
      data: results
    };
  } catch (error) {
    console.error('Error in handleFilterRequest:', error);
    return {
      response: 'I encountered an error filtering precincts. Let me help you recover.',
      suggestedActions: [
        { id: 'retry', label: 'Try again', action: 'What can you help me with?', icon: 'refresh-cw' },
        { id: 'explore', label: 'Explore map', action: 'map:resetView', icon: 'map' },
        { id: 'help', label: 'Get help', action: 'Show me example questions', icon: 'help-circle' }
      ]
    };
  }
}

export async function handleDataRequest(dataType: string, entity?: string): Promise<HandlerResult> {
  try {
    const precincts = await fetchPrecincts();

    if (dataType === 'demographics') {
      if (!entity) {
        // County-wide demographics
        const totalPop = precincts.reduce((sum, p) => sum + p.demographics.totalPopulation, 0);
        const avgMedianAge = precincts.reduce((sum, p) => sum + p.demographics.medianAge, 0) / precincts.length;
        const avgMedianIncome = precincts.reduce((sum, p) => sum + p.demographics.medianHHI, 0) / precincts.length;

        const demoLabel = getPoliticalRegionEnv().summaryAreaName;
        return {
          response: `${demoLabel} Demographics:\n\n` +
            `Total Population: ${totalPop.toLocaleString()}\n` +
            `Average Median Age: ${avgMedianAge.toFixed(1)} years\n` +
            `Average Median Income: ${formatCurrency(avgMedianIncome)}\n\n` +
            `Would you like demographics for a specific precinct?`,
          mapCommands: [
            {
              type: 'showChoropleth',
            }
          ],
          suggestedActions: [
            {
              id: 'demographic-heatmap',
              label: 'Show demographic heatmap',
              action: 'map:showHeatmap',
              icon: 'map',
              metadata: { metric: 'combined_score' }
            }
          ]
        };
      } else {
        // Specific precinct demographics
        const precinctNames = precincts.map(p => p.name);
        const matchedName = fuzzyMatchPrecinct(entity, precinctNames);
        const precinct = precincts.find(p => p.name === matchedName);

        if (!precinct) {
          return {
            response: `I couldn't find demographic data for "${entity}". Please specify a valid precinct.`,
            suggestedActions: [
              { id: 'retry', label: 'Try again', action: 'What can you help me with?', icon: 'refresh-cw' },
              { id: 'explore', label: 'Explore map', action: 'map:resetView', icon: 'map' },
              { id: 'help', label: 'Get help', action: 'Show me example questions', icon: 'help-circle' }
            ]
          };
        }

        return {
          response: formatDemographics(precinct),
          mapCommands: [
            {
              type: 'highlight',
              target: precinct.name
            }
          ],
          suggestedActions: [
            {
              id: 'compare-demographics',
              label: 'Compare to county average',
              action: `Compare ${precinct.name} demographics to county average`,
              icon: 'bar-chart'
            }
          ],
          data: precinct.demographics
        };
      }
    } else if (dataType === 'elections' || dataType === 'turnout') {
      const avgTurnout = precincts.reduce((sum, p) => sum + p.electoral.avgTurnout, 0) / precincts.length;
      const highTurnout = precincts.filter(p => p.electoral.avgTurnout > avgTurnout).length;

      return {
        response: `Election Data Summary:\n\n` +
          `Average Turnout: ${avgTurnout.toFixed(1)}%\n` +
          `Precincts with Above-Average Turnout: ${highTurnout} of ${precincts.length}\n\n` +
          `Would you like to see high-turnout precincts or specific election results?`,
        mapCommands: [
          {
            type: 'showHeatmap',
            metric: 'turnout'
          }
        ],
        suggestedActions: [
          {
            id: 'show-high-turnout',
            label: 'Show high turnout precincts',
            action: 'map:filter',
            icon: 'trending-up',
            metadata: { metric: 'turnout', threshold: 65, operator: 'greater_than' }
          },
          {
            id: 'turnout-heatmap',
            label: 'Show turnout heatmap',
            action: 'map:showHeatmap',
            icon: 'map',
            metadata: { metric: 'gotv_priority' }
          }
        ]
      };
    } else {
      return {
        response: `I can provide data on demographics, election results, and turnout. What specific data are you looking for?`,
        suggestedActions: [
          { id: 'demographics', label: 'Demographics', action: 'Show me demographic data for Lansing', icon: 'users' },
          { id: 'elections', label: 'Elections', action: 'Show me recent election results', icon: 'vote' },
          { id: 'turnout', label: 'Turnout', action: 'Show me turnout data', icon: 'trending-up' }
        ]
      };
    }
  } catch (error) {
    console.error('Error in handleDataRequest:', error);
    return {
      response: 'I encountered an error retrieving data. Let me help you recover.',
      suggestedActions: [
        { id: 'retry', label: 'Try again', action: 'What can you help me with?', icon: 'refresh-cw' },
        { id: 'explore', label: 'Explore map', action: 'map:resetView', icon: 'map' },
        { id: 'help', label: 'Get help', action: 'Show me example questions', icon: 'help-circle' }
      ]
    };
  }
}

/**
 * Handler for save/export/download requests
 * Returns context-aware suggestions based on what the user can output
 */
export async function handleOutputIntent(
  outputParams: { requestType: 'save' | 'export' | 'download' | 'share'; targetType?: string },
  context: any
): Promise<HandlerResult> {
  const { requestType, targetType } = outputParams;
  const {
    precinctsExplored,
    hasActiveSegment,
    segmentPrecinctCount,
    hasAnalysisResults,
    messageCount,
    hasMapSelection,
  } = context;

  /** Chat may have resolved a precinct list (sessionStorage) without map clicks or IQ analysis. */
  const hasChatResolvedPrecinctList =
    typeof window !== 'undefined' &&
    (getLastChatExportPrecinctIds().length > 0 || getLastUserQueryForExport().trim().length > 0);

  // Build context-aware suggestions
  const suggestions: SuggestedAction[] = [];
  const availableOutputs: string[] = [];

  // Segment save (if user has explored precincts or has active filters)
  if (precinctsExplored > 0 || hasActiveSegment) {
    const precinctCount = hasActiveSegment ? segmentPrecinctCount : precinctsExplored;
    suggestions.push({
      id: 'save-segment',
      label: `Save as segment (${precinctCount} precincts)`,
      action: 'output:saveSegment',
      icon: 'bookmark',
      description: 'Save these precincts as a reusable segment for future analysis',
      metadata: { precinctCount },
    });
    availableOutputs.push(`segment with ${precinctCount} precincts`);
  }

  // CSV export — map/segment/IQ **or** precinct list from last chat (filter queries)
  if (precinctsExplored > 0 || hasActiveSegment || hasAnalysisResults || hasChatResolvedPrecinctList) {
    suggestions.push({
      id: 'export-csv',
      label: 'Export to CSV',
      action: 'output:exportCSV',
      icon: 'file-spreadsheet',
      description: hasChatResolvedPrecinctList
        ? 'Download the precinct list from your last chat query (targeting scores included)'
        : 'Download precinct data with targeting scores as spreadsheet',
    });
    availableOutputs.push(
      hasChatResolvedPrecinctList && precinctsExplored === 0 && !hasActiveSegment && !hasAnalysisResults
        ? 'CSV from your last chat filter'
        : 'CSV with precinct data',
    );
  }

  // VAN/VoteBuilder export (for Democratic campaigns)
  if (precinctsExplored > 0 || hasActiveSegment || hasAnalysisResults || hasChatResolvedPrecinctList) {
    suggestions.push({
      id: 'export-van',
      label: 'Export for VAN/VoteBuilder',
      action: 'output:exportVAN',
      icon: 'database',
      description: 'Export in VAN-compatible format for Democratic campaign tools',
    });
    availableOutputs.push('VAN-compatible CSV');
  }

  // PDF report (if there's meaningful analysis)
  // if (hasAnalysisResults || hasMapSelection || precinctsExplored >= 3) {
  //   suggestions.push({
  //     id: 'generate-report',
  //     label: 'Generate PDF report',
  //     action: 'output:generateReport',
  //     icon: 'file-text',
  //     description: 'Create a comprehensive Political Profile report',
  //   });
  //   availableOutputs.push('PDF Political Profile report');
  // }

  // Conversation export (if there's conversation history)
  if (messageCount >= 3) {
    suggestions.push({
      id: 'export-conversation',
      label: 'Export this conversation',
      action: 'output:exportConversation',
      icon: 'message-square',
      description: 'Download chat history as a text file',
    });
    availableOutputs.push('conversation transcript');
  }

  // // Canvassing plan (if there's a segment or explored precincts)
  // if ((hasActiveSegment && segmentPrecinctCount > 0) || precinctsExplored >= 2) {
  //   suggestions.push({
  //     id: 'plan-canvass',
  //     label: 'Plan canvassing operation',
  //     action: 'output:planCanvass',
  //     icon: 'route',
  //     description: 'Create a canvassing plan for these precincts',
  //   });
  //   availableOutputs.push('canvassing plan');
  // }

  // Generate response based on request type and available outputs
  let response: string;

  if (suggestions.length === 0) {
    // Nothing to save/export yet
    response = getEmptyContextResponse(requestType);
  } else if (targetType && targetType !== 'general') {
    // User specified what they want to output
    response = getTargetedResponse(requestType, targetType, availableOutputs, suggestions);
  } else {
    // General request - show all options
    response = getGeneralResponse(requestType, availableOutputs);
  }

  // Build map commands to highlight explored/saved areas
  const mapCommands: MapCommand[] = [];
  const stateManager = getStateManager();
  const state = stateManager.getState();

  if (precinctsExplored > 0 || hasActiveSegment) {
    // Get precinct IDs from exploration history or active segment
    const precinctIds: string[] = [];

    if (hasActiveSegment && state.segmentation?.matchingPrecincts?.length) {
      // Use matching precincts from active segment filter
      precinctIds.push(...state.segmentation.matchingPrecincts);
    } else if (precinctsExplored > 0) {
      // Use recently explored precincts
      const history = state.explorationHistory || [];
      const recentPrecincts = history
        .filter(e => e.precinctIds && e.precinctIds.length > 0)
        .slice(-10) // Last 10 explorations
        .flatMap(e => e.precinctIds || []);
      precinctIds.push(...Array.from(new Set(recentPrecincts))); // Deduplicate
    }

    if (precinctIds.length > 0) {
      mapCommands.push({
        type: 'highlight',
        target: precinctIds,
      });
    }
  }

  return {
    response,
    suggestedActions: suggestions.slice(0, 5), // Limit to 5 options
    mapCommands: mapCommands.length > 0 ? mapCommands : undefined,
  };
}

/**
 * Handler for report generation requests
 * Returns context-aware report suggestions based on session state
 */
export async function handleReportIntent(
  reportParams: {
    requestType: 'generate' | 'preview' | 'customize';
    reportType?: string;
    targetArea?: string;
    comparisonAreas?: [string, string];
  },
  context: any
): Promise<HandlerResult> {
  const { reportType, targetArea, comparisonAreas } = reportParams;
  const {
    precinctsExplored,
    hasActiveSegment,
    segmentPrecinctCount,
    hasComparisonData,
    hasDonorData,
    hasCanvassingData,
    currentTool,
    hasMapSelection,
    selectedPrecinctNames,
  } = context;

  // Build available report options based on context
  const reportOptions: ReportOption[] = [];

  // Executive Summary - always available if any data
  if (precinctsExplored > 0 || hasMapSelection || hasActiveSegment) {
    const precinctCount = hasActiveSegment ? segmentPrecinctCount : precinctsExplored;
    reportOptions.push({
      id: 'executive-summary',
      type: 'executive',
      label: 'Executive Summary',
      description: `One-page overview with key metrics${precinctCount > 0 ? ` (${precinctCount} precincts)` : ''}`,
      pages: '1 page',
      action: 'report:executive',
      icon: 'file-text',
      emoji: REPORT_EMOJIS.executive,
      available: true,
      recommended: precinctCount <= 3,
      metadata: { precinctCount, precinctNames: selectedPrecinctNames },
    });
  }

  // Targeting Brief - available if exploring multiple precincts
  if (precinctsExplored >= 2 || hasActiveSegment) {
    const precinctCount = hasActiveSegment ? segmentPrecinctCount : precinctsExplored;
    reportOptions.push({
      id: 'targeting-brief',
      type: 'targeting',
      label: 'Targeting Brief',
      description: `Ranked precincts with GOTV/Persuasion scores (${precinctCount} precincts)`,
      pages: '1-2 pages',
      action: 'report:targeting',
      icon: 'target',
      emoji: REPORT_EMOJIS.targeting,
      available: true,
      recommended: precinctCount >= 5 && currentTool !== 'canvass',
      metadata: { precinctCount, precinctNames: selectedPrecinctNames },
    });
  }

  // Political Profile - full 7-page report
  if (precinctsExplored > 0 || hasMapSelection || hasActiveSegment) {
    reportOptions.push({
      id: 'political-profile',
      type: 'profile',
      label: 'Political Profile',
      description: 'Comprehensive 7-page analysis with demographics, elections, and AI insights',
      pages: '7 pages',
      action: 'report:profile',
      icon: 'book-open',
      emoji: REPORT_EMOJIS.profile,
      available: true,
      recommended: precinctsExplored === 1 && !hasActiveSegment,
      metadata: { precinctNames: selectedPrecinctNames },
    });
  }

  // Comparison Report - available if comparison data exists
  if (hasComparisonData || (comparisonAreas && comparisonAreas.length === 2)) {
    const areas = comparisonAreas || context.comparisonEntities;
    reportOptions.push({
      id: 'comparison-report',
      type: 'comparison',
      label: 'Comparison Report',
      description: areas ? `Side-by-side analysis: ${areas[0]} vs ${areas[1]}` : 'Side-by-side analysis of two areas',
      pages: '2-4 pages',
      action: 'report:comparison',
      icon: 'columns',
      emoji: REPORT_EMOJIS.comparison,
      available: true,
      recommended: hasComparisonData,
      metadata: { comparisonAreas: areas },
    });
  }

  // Segment Report - available if segment is active
  if (hasActiveSegment && segmentPrecinctCount > 0) {
    reportOptions.push({
      id: 'segment-report',
      type: 'segment',
      label: 'Segment Report',
      description: `Document your segment definition and ${segmentPrecinctCount} matching precincts`,
      pages: '2-3 pages',
      action: 'report:segment',
      icon: 'filter',
      emoji: REPORT_EMOJIS.segment,
      available: true,
      recommended: currentTool === 'segments',
      metadata: { precinctCount: segmentPrecinctCount },
    });
  }

  // Canvassing Plan - available if on canvass tool or has segment
  if (hasCanvassingData || (hasActiveSegment && segmentPrecinctCount > 0) || precinctsExplored >= 3) {
    const precinctCount = hasActiveSegment ? segmentPrecinctCount : precinctsExplored;
    reportOptions.push({
      id: 'canvassing-plan',
      type: 'canvass',
      label: 'Canvassing Plan',
      description: `Field operation document with turf assignments (~${precinctCount} precincts)`,
      pages: '3-5 pages',
      action: 'report:canvass',
      icon: 'map-pin',
      emoji: REPORT_EMOJIS.canvass,
      available: true,
      recommended: currentTool === 'canvass' || hasCanvassingData,
      metadata: { precinctCount },
    });
  }

  // Donor Analysis - available if on donor tool or has donor data
  if (hasDonorData || currentTool === 'donors') {
    reportOptions.push({
      id: 'donor-analysis',
      type: 'donor',
      label: 'Donor Analysis',
      description: 'Fundraising intelligence with geographic concentration and prospects',
      pages: '3-4 pages',
      action: 'report:donor',
      icon: 'dollar-sign',
      emoji: REPORT_EMOJIS.donor,
      available: true,
      recommended: currentTool === 'donors' || hasDonorData,
    });
  }

  // Generate response based on request type and available options
  let response: string;
  let suggestions: SuggestedAction[] = [];

  if (reportOptions.length === 0) {
    // No data to generate reports - use recovery suggestions
    return {
      response: "I'd love to create a report for you! First, let's define the area to analyze. You can:",
      suggestedActions: generateRecoverySuggestions('selection'),
      mapCommands: [
        { type: 'showChoropleth', metric: 'partisan_lean' }
      ],
    };
  } else if (reportType && reportType !== 'general') {
    // User requested specific report type
    response = getSpecificReportResponse(reportType, reportOptions, targetArea);
    suggestions = buildReportSuggestions(reportOptions.filter(r => r.type === reportType || r.recommended));
  } else {
    // General request - show contextual options
    response = getContextualReportResponse(reportOptions);
    suggestions = buildReportSuggestions(reportOptions);
  }

  // Build map commands to show report area
  const mapCommands: MapCommand[] = [];

  if (hasMapSelection || precinctsExplored > 0 || hasActiveSegment) {
    const stateManager = getStateManager();
    const state = stateManager.getState();
    const precinctIds: string[] = [];

    // Get precinct IDs from active segment or exploration history
    if (hasActiveSegment && state.segmentation?.matchingPrecincts?.length) {
      // Use matching precincts from active segment filter
      precinctIds.push(...state.segmentation.matchingPrecincts);
    } else if (precinctsExplored > 0) {
      const history = state.explorationHistory || [];
      const recentPrecincts = history
        .filter(e => e.precinctIds && e.precinctIds.length > 0)
        .slice(-10)
        .flatMap(e => e.precinctIds || []);
      precinctIds.push(...Array.from(new Set(recentPrecincts)));
    }

    if (precinctIds.length > 0) {
      mapCommands.push({
        type: 'highlight',
        target: precinctIds,
      });
    }
  }

  return {
    response,
    suggestedActions: suggestions.slice(0, 6), // Limit to 6 options
    mapCommands: mapCommands.length > 0 ? mapCommands : undefined,
  };
}

export async function handleReportHistoryRequest(): Promise<HandlerResult> {
  const recentReports = getRecentReports(10);

  if (recentReports.length === 0) {
    return {
      response: `📜 **Report History**\n\nYou haven't generated any reports yet.\n\n` +
        `To create your first report, explore some precincts on the map or build a segment, then ask me to "generate a report".`,
      suggestedActions: [
        { id: 'generate-report', label: '📊 Generate a report', action: 'generate a report', icon: 'file-text' },
        { id: 'explore-map', label: '🗺️ Explore the map', action: 'navigate:/political-ai', icon: 'map' },
      ],
    };
  }

  // Format the history
  let response = `📜 **Recent Reports** (${recentReports.length})\n\n`;

  recentReports.forEach((entry, index) => {
    const config = REPORT_TYPE_CONFIG[entry.reportType] || { emoji: '📄', label: entry.reportType };
    const date = new Date(entry.generatedAt);
    const timeAgo = getTimeAgo(date);

    response += `${index + 1}. ${config.emoji} **${entry.title}**\n`;
    response += `   - ${entry.precinctCount} precinct${entry.precinctCount > 1 ? 's' : ''}\n`;
    response += `   - Generated ${timeAgo}\n`;
    response += `   - File: \`${entry.filename}\`\n\n`;
  });

  response += `\n_Note: Reports are stored locally. Clear your browser data to reset history._`;

  // Build actions to regenerate recent reports
  const regenerateActions: SuggestedAction[] = recentReports.slice(0, 3).map(entry => {
    const config = REPORT_TYPE_CONFIG[entry.reportType] || { emoji: '📄', label: entry.reportType };
    return {
      id: `regen-${entry.id}`,
      label: `${config.emoji} Regenerate ${entry.title}`,
      action: `report:${entry.reportType}`,
      icon: 'refresh-cw',
      metadata: { precinctNames: entry.precinctNames },
    };
  });

  // Build map commands to highlight most recent report area
  const mapCommands: MapCommand[] = [];
  if (recentReports.length > 0 && recentReports[0].precinctNames) {
    mapCommands.push({
      type: 'highlight',
      target: recentReports[0].precinctNames,
    });
  }

  return {
    response,
    suggestedActions: [
      ...regenerateActions,
      { id: 'new-report', label: '📑 Generate new report', action: 'generate a report', icon: 'file-plus' },
    ],
    mapCommands: mapCommands.length > 0 ? mapCommands : undefined,
  };
}

export async function handleReportCustomization(
  reportType?: string
): Promise<HandlerResult> {
  const availableReportTypes = Object.keys(REPORT_TYPE_CONFIG);

  // If no report type specified, show all available report types to choose from
  if (!reportType || reportType === 'general') {
    let response = `⚙️ **Report Customization**\n\n`;
    response += `Choose a report type to customize:\n\n`;

    availableReportTypes.forEach(type => {
      const config = REPORT_TYPE_CONFIG[type];
      response += `${config.emoji} **${config.label}** - ${config.sections.length} sections\n`;
    });

    response += `\nSelect a report type below to see its customizable sections.`;

    const suggestions: SuggestedAction[] = availableReportTypes.map(type => {
      const config = REPORT_TYPE_CONFIG[type];
      return {
        id: `customize-${type}`,
        label: `${config.emoji} ${config.label}`,
        action: `customize ${type} report sections`,
        icon: 'settings',
        description: `${config.sections.length} sections available`,
      };
    });

    return {
      response,
      suggestedActions: suggestions.slice(0, 6),
      mapCommands: undefined, // No specific area to show when listing all report types
    };
  }

  // Show sections for the specified report type
  const config = REPORT_TYPE_CONFIG[reportType];

  if (!config) {
    return {
      response: `I don't recognize the report type "${reportType}".\n\nAvailable types: ${availableReportTypes.join(', ')}`,
      suggestedActions: [
        { id: 'precinct', label: 'Precinct Profile', action: 'Generate a precinct profile report', icon: 'file-text' },
        { id: 'comparison', label: 'Comparison', action: 'Generate a comparison report', icon: 'git-compare' },
        { id: 'help', label: 'Get help', action: 'What reports can you generate?', icon: 'help-circle' }
      ],
      mapCommands: undefined,
    };
  }

  let response = `⚙️ **Customize ${config.emoji} ${config.label}**\n\n`;
  response += `This report has ${config.sections.length} sections:\n\n`;

  // Group sections by required/optional
  const requiredSections = config.sections.filter(s => s.required);
  const optionalSections = config.sections.filter(s => !s.required);

  if (requiredSections.length > 0) {
    response += `**Required Sections** (always included):\n`;
    requiredSections.forEach(section => {
      response += `• ✓ ${section.label}\n`;
    });
    response += '\n';
  }

  if (optionalSections.length > 0) {
    response += `**Optional Sections** (can be excluded):\n`;
    optionalSections.forEach(section => {
      response += `• ☐ ${section.label}\n`;
    });
    response += '\n';
  }

  response += `\n_Note: Section customization is applied when generating the report. `;
  response += `Simply tell me which sections to exclude (e.g., "generate ${reportType} report without demographics")._`;

  // Build suggestions for excluding each optional section
  const excludeSuggestions: SuggestedAction[] = optionalSections.slice(0, 3).map(section => ({
    id: `exclude-${section.id}`,
    label: `Exclude "${section.label}"`,
    action: `generate ${reportType} report without ${section.label.toLowerCase()}`,
    icon: 'minus-circle',
    description: `Skip the ${section.label} section`,
  }));

  // Add a "generate with all sections" option
  excludeSuggestions.unshift({
    id: 'generate-full',
    label: `${config.emoji} Generate full ${config.label}`,
    action: `report:${reportType}`,
    icon: 'file-text',
    description: `Include all ${config.sections.length} sections`,
  });

  // Add option to customize a different report type
  excludeSuggestions.push({
    id: 'other-report-types',
    label: '⚙️ Customize different report',
    action: 'customize report sections',
    icon: 'settings',
    description: 'Choose a different report type',
  });

  return {
    response,
    suggestedActions: excludeSuggestions.slice(0, 5),
    mapCommands: undefined, // Customization doesn't need map commands
  };
}

export async function handleGraphExploration(params: {
  entityId?: string;
  entityName?: string;
  entityType?: string;
  relationshipTypes?: RelationshipType[];
  maxDepth?: number;
}): Promise<HandlerResult> {
  try {
    const graph = getKnowledgeGraph();
    const { entityId, entityName, entityType, relationshipTypes, maxDepth = 2 } = params;

    let entities: Entity[] = [];
    let relationships: Relationship[] = [];

    // Find starting entity
    if (entityId) {
      const entity = graph.getEntity(entityId);
      if (entity) {
        entities = [entity];
      }
    } else if (entityName) {
      // Search by name
      const queryResult = graph.query({
        namePattern: entityName,
        entityTypes: entityType ? [entityType as any] : undefined,
      });
      entities = queryResult.entities;
    }

    // If no entities found, return suggestion
    if (entities.length === 0) {
      const stats = graph.getStats();
      return {
        response: `I couldn't find an entity matching "${entityName || entityId}". ` +
          `The knowledge graph contains ${stats.entityCount} entities. ` +
          `Try searching for a candidate, office, jurisdiction, or organization.`,
        suggestedActions: [
          { id: 'graph-candidates', label: 'Show all candidates', action: 'Show me all candidates in the knowledge graph', icon: 'users' },
          { id: 'graph-offices', label: 'Show all offices', action: 'Show me all offices in the knowledge graph', icon: 'building' },
          { id: 'graph-stats', label: 'Show graph statistics', action: 'What is in the knowledge graph?', icon: 'bar-chart' },
        ],
      };
    }

    // Get connections for found entities
    const primaryEntity = entities[0];
    const connections = graph.getConnections(primaryEntity.id, relationshipTypes);

    // Collect connected entities and relationships
    const connectedEntities = connections.map(c => c.entity);
    relationships = connections.map(c => c.relationship);

    // If we want deeper traversal
    if (maxDepth > 1 && connections.length > 0) {
      const secondLevelIds = new Set<string>();
      for (const conn of connections) {
        const secondConnections = graph.getConnections(conn.entity.id, relationshipTypes);
        for (const sc of secondConnections.slice(0, 5)) { // Limit second level
          if (sc.entity.id !== primaryEntity.id && !connectedEntities.find(e => e.id === sc.entity.id)) {
            secondLevelIds.add(sc.entity.id);
            relationships.push(sc.relationship);
          }
        }
      }
      for (const id of secondLevelIds) {
        const entity = graph.getEntity(id);
        if (entity) connectedEntities.push(entity);
      }
    }

    // All entities for the graph
    const allEntities = [primaryEntity, ...connectedEntities];

    // Build response
    const graphData = {
      nodes: allEntities.map(e => ({ id: e.id, type: e.type, label: e.name })),
      edges: relationships,
    };

    let response = `**${primaryEntity.name}** (${primaryEntity.type})\n\n`;
    response += `Found ${connections.length} direct connections:\n\n`;

    // Group connections by relationship type
    const connectionsByType: Record<string, typeof connections> = {};
    for (const conn of connections) {
      const type = conn.relationship.type;
      if (!connectionsByType[type]) connectionsByType[type] = [];
      connectionsByType[type].push(conn);
    }

    for (const [type, conns] of Object.entries(connectionsByType)) {
      const readableType = type.toLowerCase().replace(/_/g, ' ');
      response += `**${readableType}**:\n`;
      for (const conn of conns.slice(0, 5)) {
        const arrow = conn.direction === 'outgoing' ? '→' : '←';
        response += `- ${arrow} ${conn.entity.name} (${conn.entity.type})\n`;
      }
      if (conns.length > 5) {
        response += `- ... and ${conns.length - 5} more\n`;
      }
      response += '\n';
    }

    // Build suggested actions
    const suggestedActions: SuggestedAction[] = [];

    // Suggest exploring connected entities
    const importantConnections = connections
      .filter(c => ['candidate', 'office', 'jurisdiction'].includes(c.entity.type))
      .slice(0, 2);

    for (const conn of importantConnections) {
      suggestedActions.push({
        id: `explore-${conn.entity.id}`,
        label: `Explore ${conn.entity.name}`,
        action: `Show me relationships for ${conn.entity.name}`,
        icon: 'search',
      });
    }

    // Suggest showing on map if precinct/jurisdiction
    if (primaryEntity.type === 'precinct' || primaryEntity.type === 'jurisdiction') {
      suggestedActions.push({
        id: 'show-on-map',
        label: 'Show on map',
        action: `Show ${primaryEntity.name} on the map`,
        icon: 'map',
      });
    }

    // Suggest finding path to another entity
    suggestedActions.push({
      id: 'find-path',
      label: 'Find connections',
      action: `How is ${primaryEntity.name} connected to other entities?`,
      icon: 'git-branch',
    });

    // Extract precinct IDs for map commands
    const precinctEntities = allEntities.filter(e => e.type === 'precinct');
    const precinctIds = precinctEntities.length > 0
      ? precinctEntities.map(e => e.id)
      : undefined;

    return {
      response,
      suggestedActions: suggestedActions.slice(0, 4),
      mapCommands: precinctIds ? [
        { type: 'highlight', target: precinctIds }
      ] : undefined,
      data: {
        graphData,
        primaryEntity,
        connections: connections.length,
      },
      metadata: {
        showGraph: true,
        entities: allEntities,
        relationships,
      },
    };
  } catch (error) {
    console.error('[handleGraphExploration] Error:', error);
    return {
      response: 'I encountered an error exploring the knowledge graph. Let me help you recover.',
      suggestedActions: [
        { id: 'retry', label: 'Try again', action: 'What can you help me with?', icon: 'refresh-cw' },
        { id: 'explore', label: 'Explore map', action: 'map:resetView', icon: 'map' },
        { id: 'help', label: 'Get help', action: 'Show me example questions', icon: 'help-circle' }
      ],
    };
  }
}

export async function handleFindPath(params: {
  sourceName: string;
  targetName: string;
  maxDepth?: number;
}): Promise<HandlerResult> {
  try {
    const graph = getKnowledgeGraph();
    const { sourceName, targetName, maxDepth = 5 } = params;

    // Find source entity
    const sourceResult = graph.query({ namePattern: sourceName, limit: 1 });
    if (sourceResult.entities.length === 0) {
      return {
        response: `I couldn't find an entity matching "${sourceName}".`,
        suggestedActions: [
          { id: 'graph-search', label: 'Search entities', action: `Search for ${sourceName} in the graph`, icon: 'search' },
        ],
      };
    }

    // Find target entity
    const targetResult = graph.query({ namePattern: targetName, limit: 1 });
    if (targetResult.entities.length === 0) {
      return {
        response: `I couldn't find an entity matching "${targetName}".`,
        suggestedActions: [
          { id: 'graph-search', label: 'Search entities', action: `Search for ${targetName} in the graph`, icon: 'search' },
        ],
      };
    }

    const source = sourceResult.entities[0];
    const target = targetResult.entities[0];

    // Find path
    const path = graph.findPath(source.id, target.id, maxDepth);

    if (!path) {
      return {
        response: `I couldn't find a path between **${source.name}** and **${target.name}** within ${maxDepth} hops. ` +
          `They may not be connected in the knowledge graph.`,
        suggestedActions: [
          { id: 'explore-source', label: `Explore ${source.name}`, action: `Show relationships for ${source.name}`, icon: 'search' },
          { id: 'explore-target', label: `Explore ${target.name}`, action: `Show relationships for ${target.name}`, icon: 'search' },
        ],
      };
    }

    // Build response
    let response = `**Path from ${source.name} to ${target.name}**\n\n`;
    response += `Found a connection in ${path.edges.length} steps:\n\n`;

    for (let i = 0; i < path.nodes.length; i++) {
      const node = path.nodes[i];
      response += `${i + 1}. **${node.name}** (${node.type})`;

      if (i < path.edges.length) {
        const edge = path.edges[i];
        const readableType = edge.type.toLowerCase().replace(/_/g, ' ');
        response += ` → _${readableType}_`;
      }
      response += '\n';
    }

    // Extract precinct IDs from path for map commands
    const precinctNodes = path.nodes.filter(n => n.type === 'precinct');
    const precinctIds = precinctNodes.length > 0
      ? precinctNodes.map(n => n.id)
      : undefined;

    return {
      response,
      suggestedActions: [
        { id: 'explore-path-start', label: `Explore ${source.name}`, action: `Show relationships for ${source.name}`, icon: 'search' },
        { id: 'explore-path-end', label: `Explore ${target.name}`, action: `Show relationships for ${target.name}`, icon: 'search' },
      ],
      mapCommands: precinctIds ? [
        { type: 'highlight', target: precinctIds }
      ] : undefined,
      data: {
        path,
        source,
        target,
      },
      metadata: {
        showGraph: true,
        entities: path.nodes,
        relationships: path.edges,
      },
    };
  } catch (error) {
    console.error('[handleFindPath] Error:', error);
    return {
      response: 'I encountered an error finding the path. Let me help you recover.',
      suggestedActions: [
        { id: 'retry', label: 'Try again', action: 'What can you help me with?', icon: 'refresh-cw' },
        { id: 'explore', label: 'Explore map', action: 'map:resetView', icon: 'map' },
        { id: 'help', label: 'Get help', action: 'Show me example questions', icon: 'help-circle' }
      ],
    };
  }
}

export async function handleTrendQuery(precinctName?: string): Promise<HandlerResult> {
  try {
    // Dynamic import to avoid SSR issues
    const { loadElectionHistory, analyzeTrends, getPrecinctHistory } =
      await import('@/lib/analysis/TrendAnalyzer');

    await loadElectionHistory();

    if (!precinctName) {
      // General trend overview
      return {
        response: `I can show you historical voting trends from 2020-2024.\n\n**Available analyses:**\n• Turnout trends (which areas are voting more/less)\n• Margin shifts (which areas are becoming more D or R)\n• Flip risk (precincts that have changed or nearly changed)\n• Volatility (unstable voting patterns)\n\nAsk about a specific precinct like "What's the trend in East Lansing Precinct 3?" or "Show me precincts shifting Democratic"`,
        suggestedActions: [
          { id: 'shifting-dem', label: 'Show precincts shifting D', action: 'Show precincts shifting Democratic', icon: 'trending-up' },
          { id: 'flip-risk', label: 'Show flip risk areas', action: 'Show precincts with flip risk', icon: 'alert-triangle' },
          { id: 'turnout-trends', label: 'Show turnout trends', action: 'Show turnout trends since 2020', icon: 'bar-chart' }
        ]
      };
    }

    // Analyze specific precinct
    const precincts = await fetchPrecincts();
    const precinctNames = precincts.map(p => p.name);
    const matchedName = fuzzyMatchPrecinct(precinctName, precinctNames);

    if (!matchedName) {
      return {
        response: `I couldn't find a precinct matching "${precinctName}". Try asking about East Lansing, Lansing, Meridian, Delhi, or Williamston precincts.`,
        suggestedActions: [
          { id: 'lansing', label: 'Lansing trends', action: 'Show me historical trends for Lansing', icon: 'trending-up' },
          { id: 'eastlansing', label: 'East Lansing', action: 'Show me historical trends for East Lansing', icon: 'trending-up' },
          { id: 'help', label: 'Get help', action: 'Show me example questions', icon: 'help-circle' }
        ]
      };
    }

    const precinct = precincts.find(p => p.name === matchedName);
    if (!precinct) throw new Error('Precinct not found');

    const analysis = analyzeTrends(precinct.id);
    const history = getPrecinctHistory(precinct.id);

    if (!analysis || !history) {
      return {
        response: `I don't have historical data for ${matchedName}. Historical trends are available for select precincts.`,
        suggestedActions: [
          { id: 'lansing', label: 'Lansing trends', action: 'Show me historical trends for Lansing', icon: 'trending-up' },
          { id: 'explore', label: 'Explore map', action: 'map:resetView', icon: 'map' },
          { id: 'help', label: 'Get help', action: 'Show me example questions', icon: 'help-circle' }
        ]
      };
    }

    // Format response
    const years = Object.keys(history).sort();
    let response = `**Historical Trends: ${matchedName}**\n\n`;

    // Assess confidence based on data quality
    const confidence = assessConfidence({
      historicalElections: years.length,
      margin: analysis.marginChange,
    });

    const trendDirection = analysis.marginChange > 5 ? 'Democratic' :
      analysis.marginChange < -5 ? 'Republican' : 'stable';

    const trendInsight = expressConfidence(
      confidence,
      `${matchedName} shows ${trendDirection} trend over ${years.length} election cycles`,
      `${years.length} elections analyzed`
    );

    response += `📊 **Summary:** ${trendInsight}\n\n`;
    response += `**Election History:**\n`;

    years.forEach(year => {
      const data = history[year];
      const marginStr = data.margin > 0 ? `D+${data.margin}` : `R+${Math.abs(data.margin)}`;
      response += `• **${year}**: ${(data.turnout * 100).toFixed(0)}% turnout, ${marginStr}\n`;
    });

    response += `\n**Analysis:**\n`;
    response += `• Turnout change: ${analysis.turnoutChange > 0 ? '+' : ''}${(analysis.turnoutChange * 100).toFixed(0)}%\n`;
    response += `• Margin change: ${analysis.marginChange > 0 ? '+' : ''}${analysis.marginChange.toFixed(0)} points\n`;
    response += `• Volatility: ${analysis.volatility.toFixed(1)} (${analysis.volatility > 10 ? 'high' : analysis.volatility > 5 ? 'moderate' : 'low'})\n`;

    if (analysis.flipRisk) {
      response += `\n⚠️ **Flip Risk**: This precinct has crossed or nearly crossed the partisan threshold.`;
    }

    return {
      response,
      mapCommands: [
        { type: 'highlight', target: matchedName },
        { type: 'flyTo', target: matchedName }
      ],
      suggestedActions: [
        { id: 'compare-nearby', label: 'Compare to nearby precincts', action: `Compare ${matchedName} to neighboring precincts`, icon: 'git-compare' },
        { id: 'show-all-trends', label: 'Show all trend data', action: 'Show all precincts with trend analysis', icon: 'bar-chart' }
      ]
    };
  } catch (error) {
    console.error('Error in handleTrendQuery:', error);
    return {
      response: 'I encountered an error loading trend data. Let me help you recover.',
      suggestedActions: [
        { id: 'retry', label: 'Try again', action: 'What can you help me with?', icon: 'refresh-cw' },
        { id: 'explore', label: 'Explore map', action: 'map:resetView', icon: 'map' },
        { id: 'help', label: 'Get help', action: 'Show me example questions', icon: 'help-circle' }
      ]
    };
  }
}

export async function handleGraphQuery(graphParams?: {
  queryType: 'overview' | 'explore' | 'path' | 'list' | 'search';
  entityName?: string;
  entityType?: string;
  sourceName?: string;
  targetName?: string;
  searchTerm?: string;
}): Promise<HandlerResult> {
  try {
    if (!graphParams) {
      // Get stats for the intro message
      const statsResponse = await fetch('/api/knowledge-graph?action=stats');
      const statsData = await statsResponse.json();

      const kgArea = getPoliticalRegionEnv().summaryAreaName;
      let introMessage = `**Knowledge Graph** lets you explore relationships between political entities in ${kgArea}:\n`;

      if (statsData.success && statsData.stats) {
        const stats = statsData.stats;
        introMessage += `\n**Current Graph:**\n`;
        introMessage += `• ${stats.entityCount.toLocaleString()} entities\n`;
        introMessage += `• ${stats.relationshipCount.toLocaleString()} relationships\n`;

        if (stats.entityTypeBreakdown) {
          introMessage += `\n**Entity Types:**\n`;
          Object.entries(stats.entityTypeBreakdown)
            .sort((a: any, b: any) => b[1] - a[1])
            .slice(0, 5)
            .forEach(([type, count]: [string, any]) => {
              introMessage += `• ${count} ${type}${count !== 1 ? 's' : ''}\n`;
            });
        }
      }

      introMessage += `\nTry asking:\n`;
      introMessage += `• "Show me the knowledge graph overview"\n`;
      introMessage += `• "Explore connections for [entity name]"\n`;
      introMessage += `• "What connects [entity A] to [entity B]?"\n`;
      introMessage += `• "List all candidates" or "List all precincts"`;

      return {
        response: introMessage,
        suggestedActions: [
          { id: 'graph-overview', label: 'Show graph overview', action: 'Show me the knowledge graph overview', icon: 'share-2' },
          { id: 'explore-precincts', label: 'Explore precincts', action: 'List all precincts in the graph', icon: 'map' },
          { id: 'search', label: 'Search entities', action: 'Search for entities related to East Lansing', icon: 'search' }
        ],
        metadata: {
          showGraph: true
        }
      };
    }

    const { queryType, entityName, entityType, sourceName, targetName, searchTerm } = graphParams;

    // Handle different query types
    switch (queryType) {
      case 'overview': {
        // Get full graph data
        const response = await fetch('/api/knowledge-graph?action=all');
        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch graph data');
        }

        const { entities, relationships, stats } = data;

        let responseText = `**Knowledge Graph Overview**\n\n`;
        responseText += `**Total Entities:** ${stats.entityCount.toLocaleString()}\n`;
        responseText += `**Total Relationships:** ${stats.relationshipCount.toLocaleString()}\n\n`;

        if (stats.entityTypeBreakdown) {
          responseText += `**Entity Types:**\n`;
          Object.entries(stats.entityTypeBreakdown)
            .sort((a: any, b: any) => b[1] - a[1])
            .forEach(([type, count]: [string, any]) => {
              responseText += `• ${count} ${type}${count !== 1 ? 's' : ''}\n`;
            });
        }

        if (stats.relationshipTypeBreakdown) {
          responseText += `\n**Top Relationship Types:**\n`;
          Object.entries(stats.relationshipTypeBreakdown)
            .sort((a: any, b: any) => b[1] - a[1])
            .slice(0, 5)
            .forEach(([type, count]: [string, any]) => {
              responseText += `• ${count} ${type} relationships\n`;
            });
        }

        return {
          response: responseText,
          suggestedActions: [
            { id: 'explore-entity', label: 'Explore an entity', action: 'Show me connections for East Lansing', icon: 'git-branch' },
            { id: 'list-candidates', label: 'List candidates', action: 'List all candidates', icon: 'users' },
            { id: 'list-precincts', label: 'List precincts', action: 'List all precincts', icon: 'map' }
          ],
          metadata: {
            showGraph: true,
            graphData: { entities, relationships }
          }
        };
      }

      case 'explore': {
        if (!entityName) {
          return {
            response: 'To explore connections, specify an entity name like "East Lansing" or a precinct name.',
            suggestedActions: [
              { id: 'example', label: 'Try an example', action: 'Show connections for East Lansing', icon: 'git-branch' }
            ]
          };
        }

        // Search for the entity
        const searchResponse = await fetch(`/api/knowledge-graph?action=search&name=${encodeURIComponent(entityName)}${entityType ? `&type=${entityType}` : ''}`);
        const searchData = await searchResponse.json();

        if (!searchData.success || searchData.entities.length === 0) {
          return {
            response: `Could not find entity "${entityName}". Try:\n• Checking the spelling\n• Using a different name variant\n• Listing all entities of a type first`,
            suggestedActions: [
              { id: 'list', label: 'List entities', action: 'List all entities', icon: 'list' },
              { id: 'search', label: 'Search differently', action: `Search for ${entityName.split(' ')[0]}`, icon: 'search' }
            ]
          };
        }

        // Get the first matching entity
        const entity = searchData.entities[0];

        // Get connections for this entity
        const connectionsResponse = await fetch(`/api/knowledge-graph?action=entity&id=${encodeURIComponent(entity.id)}`);
        const connectionsData = await connectionsResponse.json();

        if (!connectionsData.success) {
          throw new Error('Failed to fetch entity connections');
        }

        const { entity: fullEntity, connections } = connectionsData;

        let responseText = `**Exploring: ${fullEntity.name}**\n`;
        responseText += `Type: ${fullEntity.type}\n\n`;

        if (connections && connections.length > 0) {
          responseText += `**Connected to ${connections.length} entities:**\n\n`;

          // Group connections by relationship type
          const groupedConnections: Record<string, any[]> = {};
          connections.forEach((conn: any) => {
            if (!groupedConnections[conn.relationship]) {
              groupedConnections[conn.relationship] = [];
            }
            groupedConnections[conn.relationship].push(conn);
          });

          // Show top relationship types
          Object.entries(groupedConnections)
            .slice(0, 5)
            .forEach(([relType, conns]) => {
              responseText += `**${relType}** (${conns.length}):\n`;
              conns.slice(0, 3).forEach((conn: any) => {
                responseText += `• ${conn.entity.name} (${conn.entity.type})\n`;
              });
              if (conns.length > 3) {
                responseText += `• ...and ${conns.length - 3} more\n`;
              }
              responseText += `\n`;
            });
        } else {
          responseText += `No connections found for this entity.\n`;
        }

        // Build map commands for precincts
        const mapCommands: MapCommand[] = [];
        if (fullEntity.type === 'precinct') {
          mapCommands.push(
            { type: 'highlight', target: fullEntity.name },
            { type: 'flyTo', target: fullEntity.name }
          );
        }

        return {
          response: responseText,
          mapCommands: mapCommands.length > 0 ? mapCommands : undefined,
          suggestedActions: [
            { id: 'similar', label: 'Find similar entities', action: `Find entities similar to ${fullEntity.name}`, icon: 'users' },
            { id: 'path', label: 'Find connections', action: `What connects ${fullEntity.name} to other entities?`, icon: 'git-merge' },
            { id: 'details', label: 'Show details', action: `Tell me more about ${fullEntity.name}`, icon: 'info' }
          ],
          metadata: {
            showGraph: true,
            focusEntity: fullEntity.id,
            entityData: fullEntity
          }
        };
      }

      case 'path': {
        if (!sourceName || !targetName) {
          return {
            response: 'To find a path, specify both source and target. Example: "What connects East Lansing to [entity name]?"',
            suggestedActions: [
              { id: 'example', label: 'Try an example', action: 'What connects East Lansing to swing precincts?', icon: 'git-merge' }
            ]
          };
        }

        // Search for source entity
        const sourceResponse = await fetch(`/api/knowledge-graph?action=search&name=${encodeURIComponent(sourceName)}`);
        const sourceData = await sourceResponse.json();

        // Search for target entity
        const targetResponse = await fetch(`/api/knowledge-graph?action=search&name=${encodeURIComponent(targetName)}`);
        const targetData = await targetResponse.json();

        if (!sourceData.success || sourceData.entities.length === 0 ||
          !targetData.success || targetData.entities.length === 0) {
          return {
            response: `Could not find one or both entities. Make sure both "${sourceName}" and "${targetName}" exist in the graph.`,
            suggestedActions: [
              { id: 'list', label: 'List entities', action: 'List all entities', icon: 'list' }
            ]
          };
        }

        const sourceEntity = sourceData.entities[0];
        const targetEntity = targetData.entities[0];

        // Find path between entities
        const pathResponse = await fetch(
          `/api/knowledge-graph?action=path&source=${encodeURIComponent(sourceEntity.id)}&target=${encodeURIComponent(targetEntity.id)}`
        );
        const pathData = await pathResponse.json();

        if (!pathData.success || !pathData.path || pathData.path.length === 0) {
          return {
            response: `No path found between ${sourceEntity.name} and ${targetEntity.name}. They may not be connected in the current graph.`,
            suggestedActions: [
              { id: 'explore-source', label: `Explore ${sourceEntity.name}`, action: `Show me connections for ${sourceEntity.name}`, icon: 'git-branch' },
              { id: 'explore-target', label: `Explore ${targetEntity.name}`, action: `Show me connections for ${targetEntity.name}`, icon: 'git-branch' }
            ]
          };
        }

        // Format the path
        let responseText = `**Path from ${sourceEntity.name} to ${targetEntity.name}:**\n\n`;

        pathData.path.forEach((step: any, index: number) => {
          if (index > 0) {
            responseText += ` →\n`;
          }
          responseText += `${index + 1}. **${step.entity.name}** (${step.entity.type})`;
          if (step.relationship) {
            responseText += `\n   via ${step.relationship}`;
          }
          responseText += `\n`;
        });

        return {
          response: responseText,
          suggestedActions: [
            { id: 'explore-source', label: `Explore ${sourceEntity.name}`, action: `Show me connections for ${sourceEntity.name}`, icon: 'git-branch' },
            { id: 'explore-target', label: `Explore ${targetEntity.name}`, action: `Show me connections for ${targetEntity.name}`, icon: 'git-branch' }
          ],
          metadata: {
            showGraph: true,
            highlightPath: pathData.path.map((step: any) => step.entity.id)
          }
        };
      }

      case 'list': {
        const listType = entityType || 'all';
        const searchUrl = listType === 'all'
          ? '/api/knowledge-graph?action=search&limit=50'
          : `/api/knowledge-graph?action=search&type=${listType}&limit=50`;

        const response = await fetch(searchUrl);
        const data = await response.json();

        if (!data.success || data.entities.length === 0) {
          return {
            response: `No entities found${listType !== 'all' ? ` of type "${listType}"` : ''}.`,
            suggestedActions: [
              { id: 'overview', label: 'Show graph overview', action: 'Show me the knowledge graph overview', icon: 'share-2' }
            ]
          };
        }

        let responseText = `**${listType === 'all' ? 'Entities' : listType.charAt(0).toUpperCase() + listType.slice(1) + 's'} in Knowledge Graph:**\n\n`;

        // Group by type if showing all
        if (listType === 'all') {
          const grouped: Record<string, any[]> = {};
          data.entities.forEach((entity: any) => {
            if (!grouped[entity.type]) {
              grouped[entity.type] = [];
            }
            grouped[entity.type].push(entity);
          });

          Object.entries(grouped).forEach(([type, entities]) => {
            responseText += `**${type.charAt(0).toUpperCase() + type.slice(1)}s** (${entities.length}):\n`;
            entities.slice(0, 5).forEach((entity: any) => {
              responseText += `• ${entity.name}\n`;
            });
            if (entities.length > 5) {
              responseText += `• ...and ${entities.length - 5} more\n`;
            }
            responseText += `\n`;
          });
        } else {
          data.entities.slice(0, 20).forEach((entity: any) => {
            responseText += `• ${entity.name}\n`;
          });
          if (data.entities.length > 20) {
            responseText += `\n...and ${data.entities.length - 20} more`;
          }
        }

        return {
          response: responseText,
          suggestedActions: [
            { id: 'explore', label: 'Explore an entity', action: `Show me connections for ${data.entities[0].name}`, icon: 'git-branch' },
            { id: 'filter', label: 'Filter by type', action: 'List all candidates', icon: 'filter' }
          ],
          metadata: {
            entities: data.entities
          }
        };
      }

      case 'search': {
        if (!searchTerm) {
          return {
            response: 'Provide a search term to find entities. Example: "Search for East Lansing"',
            suggestedActions: [
              { id: 'list', label: 'List all entities', action: 'List all entities', icon: 'list' }
            ]
          };
        }

        const response = await fetch(`/api/knowledge-graph?action=search&name=${encodeURIComponent(searchTerm)}`);
        const data = await response.json();

        if (!data.success || data.entities.length === 0) {
          return {
            response: `No entities found matching "${searchTerm}". Try:\n• Using different keywords\n• Checking spelling\n• Being more specific`,
            suggestedActions: [
              { id: 'list', label: 'List all entities', action: 'List all entities', icon: 'list' }
            ]
          };
        }

        let responseText = `**Search results for "${searchTerm}":**\n\n`;
        responseText += `Found ${data.entities.length} matching entities:\n\n`;

        data.entities.slice(0, 10).forEach((entity: any) => {
          responseText += `• **${entity.name}** (${entity.type})\n`;
          if (entity.metadata) {
            const metadataStr = Object.entries(entity.metadata)
              .slice(0, 2)
              .map(([key, value]) => `${key}: ${value}`)
              .join(', ');
            if (metadataStr) {
              responseText += `  ${metadataStr}\n`;
            }
          }
        });

        if (data.entities.length > 10) {
          responseText += `\n...and ${data.entities.length - 10} more results`;
        }

        return {
          response: responseText,
          suggestedActions: [
            { id: 'explore', label: `Explore ${data.entities[0].name}`, action: `Show me connections for ${data.entities[0].name}`, icon: 'git-branch' },
            { id: 'refine', label: 'Refine search', action: `Search for ${searchTerm} candidates`, icon: 'search' }
          ],
          metadata: {
            searchResults: data.entities
          }
        };
      }

      default:
        return {
          response: `I can help you explore the knowledge graph. Try:\n• "Show graph overview"\n• "Explore [entity name] connections"\n• "What connects [entity A] to [entity B]?"\n• "List all [entity type]"\n• "Search for [term]"`,
          suggestedActions: [
            { id: 'overview', label: 'Graph overview', action: 'Show me the knowledge graph overview', icon: 'share-2' },
            { id: 'help', label: 'Get help', action: 'Show me example questions', icon: 'help-circle' }
          ]
        };
    }
  } catch (error) {
    console.error('Error in handleGraphQuery:', error);
    return {
      response: `I encountered an error exploring the knowledge graph: ${error instanceof Error ? error.message : 'Unknown error'}`,
      suggestedActions: [
        { id: 'retry', label: 'Try again', action: 'What can you help me with?', icon: 'refresh-cw' },
        { id: 'overview', label: 'Graph overview', action: 'Show me the knowledge graph overview', icon: 'share-2' }
      ]
    };
  }
}

async function checkAndAppendSerendipitousInsight(
  baseResponse: string,
  trigger: 'precinct_selection' | 'filter_applied' | 'segment_created' | 'query_response',
): Promise<string> {
  try {
    const suggestionEngine = getSuggestionEngine();
    const result = await suggestionEngine.checkForSerendipitousInsight(trigger);

    // InsightCheckResult uses hasInsight + insights[] (not found + insight)
    if (result.hasInsight && result.insights.length > 0) {
      const insight = result.insights[0]; // Take first (most relevant) insight
      // Frame the insight as a discovery
      // Insight has: title, message, shortMessage - use title as the headline
      const discoveryText = frameAsDiscovery
        ? frameAsDiscovery(insight)
        : insight.title;

      return `${baseResponse}\n\n💡 **Unexpected Discovery**: ${discoveryText}\n${insight.shortMessage}`;
    }
  } catch (error) {
    console.warn('[workflowHandlers] Serendipitous insight check failed:', error);
  }
  return baseResponse;
}

async function fetchPrecincts(): Promise<PrecinctData[]> {
  const response = await fetch('/api/segments?action=precincts');
  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch precincts');
  }

  return data.precincts || [];
}

function getFilterMetricDisplayValue(p: any, criteria: any): number | null {
  if (criteria.metric === 'swing_potential') {
    return p.swingPotential ?? p.electoral?.swingPotential ?? null;
  }
  if (criteria.metric === 'gotv_priority') {
    return p.gotvPriority ?? p.targeting?.gotvPriority ?? null;
  }
  if (criteria.metric === 'persuasion_opportunity') {
    return p.persuasionOpportunity ?? p.targeting?.persuasionOpportunity ?? null;
  }
  if (criteria.metric === 'margin' && criteria.marginMode === 'presidential_margin') {
    const v = p.presidentialMargin;
    return typeof v === 'number' && !Number.isNaN(v) ? v : null;
  }
  if (criteria.metric === 'partisan_lean') {
    const v = p.partisanLean ?? p.electoral?.partisanLean;
    return typeof v === 'number' && !Number.isNaN(v) ? v : null;
  }
  return null;
}

function formatLeanForFilterDisplay(lean: number): string {
  if (lean >= 0) return `D+${lean.toFixed(1)}`;
  return `R+${Math.abs(lean).toFixed(1)}`;
}

function formatFilterResults(criteria: any, results: any): string {
  const expertise = getUserExpertiseLevel();
  const count = results.matchingPrecincts?.length || 0;
  const totalVoters = results.estimatedVoters || 0;
  const matchingPrecincts = results.matchingPrecincts || [];
  const areaName = getPoliticalRegionEnv().summaryAreaName;
  const isTightPresidentialMargin =
    criteria.metric === 'margin' &&
    criteria.marginMode === 'presidential_margin' &&
    typeof criteria.threshold === 'number';

  let criteriaText = '';
  if (isTightPresidentialMargin) {
    const t = criteria.threshold as number;
    criteriaText = ` — presidential |margin| < ${t} pp (2024, else 2020; same as CSV export)`;
  } else if (
    criteria.metric === 'partisan_lean' &&
    Array.isArray(criteria.partisanLeanRange) &&
    criteria.partisanLeanRange.length === 2
  ) {
    const [lo, hi] = criteria.partisanLeanRange as [number, number];
    criteriaText = ` — modeled partisan lean between ${lo} and ${hi}`;
  } else if (criteria.metric) {
    criteriaText = ` with ${criteria.metric.replace(/_/g, ' ')}`;
    if (criteria.threshold !== undefined && criteria.threshold !== null) {
      const operator = criteria.operator === 'less_than' ? '<' : criteria.operator === 'greater_than' ? '>' : '=';
      criteriaText += ` ${operator} ${criteria.threshold}`;
    }
  }

  const useLeanStyleMetricSuffix =
    isTightPresidentialMargin || criteria.metric === 'partisan_lean';

  // Assess confidence based on data quality and result count
  const confidence = assessConfidence({
    dataPoints: count,
    sampleSize: totalVoters,
  });

  // Generate confidence-aware recommendation based on result count
  let insightText: string;
  let methodologyNote: string;

  if (count < 5) {
    insightText = `${count} precincts match your criteria — a highly focused targeting segment`;
    methodologyNote = 'Focused selection allows deep engagement';
  } else if (count <= 15) {
    insightText = `${count} precincts match your criteria — an actionable canvassing universe`;
    methodologyNote = `${totalVoters.toLocaleString()} voters across manageable territory`;
  } else if (count <= 30) {
    insightText = `${count} precincts match your criteria — consider prioritizing top performers`;
    methodologyNote = 'May benefit from additional filtering for resource efficiency';
  } else {
    insightText = `${count} precincts match your criteria — broad selection may need refinement`;
    methodologyNote = 'Consider narrowing criteria for more targeted outreach';
  }

  const recommendation = expressConfidence(confidence, insightText, methodologyNote);

  // Wave 6D.3: Expertise-based formatting
  if (expertise === 'power_user') {
    // Terse format for power users
    const leadPrefix = isTightPresidentialMargin
      ? `**${count} tight-margin precincts** (${areaName}, |presidential margin| < ${criteria.threshold} pp, 2024 else 2020) — ${recommendation}`
      : `**${recommendation}**`;
    let response = isTightPresidentialMargin ? `${leadPrefix}\n` : `${leadPrefix}${criteriaText}\n`;
    if (matchingPrecincts.length > 0 && matchingPrecincts.length <= 10) {
      const topPrecincts = matchingPrecincts.slice(0, 5);
      response += topPrecincts.map((p: any, i: number) => {
        const metricValue = getFilterMetricDisplayValue(p, criteria);
        const label = filterResultPrecinctLabel(p);
        const suffix =
          metricValue !== null
            ? useLeanStyleMetricSuffix
              ? ` (${formatLeanForFilterDisplay(metricValue)})`
              : ` (${Math.round(metricValue)})`
            : '';
        return `${i + 1}. ${label}${suffix}`;
      }).join(' | ') + '\n';
    }
    response += `Avg: GOTV ${results.avgGOTV?.toFixed(0) || 'N/A'} | Pers ${results.avgPersuasion?.toFixed(0) || 'N/A'} | Lean ${results.avgPartisanLean > 0 ? 'R+' : 'D+'}${Math.abs(results.avgPartisanLean || 0).toFixed(0)} | TO ${results.avgTurnout?.toFixed(0) || 'N/A'}%`;

    const jurisdictions = matchingPrecincts.map((p: any) => p.jurisdiction || p.jurisdictionType || 'Unknown');
    const soWhat = generateFilterSoWhat({
      precinctCount: count,
      estimatedVoters: totalVoters,
      avgGOTV: results.avgGOTV,
      avgPartisanLean: results.avgPartisanLean,
      jurisdictions,
    });
    return response + soWhat;
  }

  let response: string;
  if (isTightPresidentialMargin) {
    const t = criteria.threshold as number;
    response =
      `**Answer:** In **${areaName}**, these are precincts where **|Dem−Rep presidential margin| is under ${t} percentage points** ` +
      `(**2024** president where reported, else **2020**) — **the same rule** as the assistant’s “Authoritative filter / export” count and downloadable CSV.\n\n` +
      `Found **${count} precincts** with approximately **${totalVoters.toLocaleString()}** registered voters.\n\n`;
  } else {
    response =
      `**Filter Results${criteriaText}:**\n\n` +
      `Found **${count} precincts** with approximately **${totalVoters.toLocaleString()}** registered voters.\n\n`;
  }

  // Add top 5 precincts if available
  if (matchingPrecincts.length > 0 && matchingPrecincts.length <= 10) {
    const topPrecincts = matchingPrecincts.slice(0, 5);
    response += `**Top ${Math.min(5, count)} precincts:**\n`;
    topPrecincts.forEach((p: any, i: number) => {
      const metricValue = getFilterMetricDisplayValue(p, criteria);
      const label = filterResultPrecinctLabel(p);
      const suffix =
        metricValue !== null
          ? useLeanStyleMetricSuffix
            ? ` (${formatLeanForFilterDisplay(metricValue)})`
            : ` (${Math.round(metricValue)})`
          : '';

      response += `${i + 1}. **${label}**${suffix}\n`;
    });
    response += '\n';
  }

  response += (
    `**Averages:**\n` +
    `• GOTV Priority: ${results.avgGOTV?.toFixed(0) || 'N/A'}/100\n` +
    `• Persuasion Opportunity: ${results.avgPersuasion?.toFixed(0) || 'N/A'}/100\n` +
    `• Partisan Lean: ${results.avgPartisanLean > 0 ? 'R+' : 'D+'}${Math.abs(results.avgPartisanLean || 0).toFixed(0)}\n` +
    `• Turnout: ${results.avgTurnout?.toFixed(1) || 'N/A'}%\n\n` +
    `These precincts are highlighted on the map${matchingPrecincts.length > 0 && matchingPrecincts.length <= 10 ? ' with numbered markers' : ''}.`
  );

  // Wave 6B: Add "So What" strategic insight
  // Wave 6B.7: Extract jurisdictions for spatial reasoning
  const jurisdictions = matchingPrecincts.map((p: any) => p.jurisdiction || p.jurisdictionType || 'Unknown');
  const soWhat = generateFilterSoWhat({
    precinctCount: count,
    estimatedVoters: totalVoters,
    avgGOTV: results.avgGOTV,
    avgPartisanLean: results.avgPartisanLean,
    jurisdictions,
  });

  // Wave 6D.2: Add citations
  const fullResponse = response + soWhat;
  return addCitationsToResponse(fullResponse, ['ELECTIONS', 'SEGMENT_METHODOLOGY', 'TARGETING']);
}

function formatDemographics(precinct: PrecinctData): string {
  const { name, demographics } = precinct;
  const expertise = getUserExpertiseLevel();

  // Wave 6D.3: Expertise-based formatting
  if (expertise === 'power_user') {
    const response = (
      `**${name} Demographics**\n` +
      `Pop: ${demographics.totalPopulation.toLocaleString()} (${demographics.population18up.toLocaleString()} 18+) | ` +
      `Age: ${demographics.medianAge.toFixed(0)} | Inc: $${Math.round(demographics.medianHHI / 1000)}K | ` +
      `Ed: ${demographics.collegePct.toFixed(0)}% | Own: ${demographics.homeownerPct.toFixed(0)}%`
    );
    return addCitationsToResponse(response, ['DEMOGRAPHICS', 'CENSUS_ACS']);
  }

  const response = (
    `**Demographics for ${name}:**\n\n` +
    `• Total Population: ${demographics.totalPopulation.toLocaleString()}\n` +
    `• Voting Age Population: ${demographics.population18up.toLocaleString()}\n` +
    `• Median Age: ${demographics.medianAge.toFixed(1)} years\n` +
    `• Median Household Income: ${formatCurrency(demographics.medianHHI)}\n` +
    `• College Degree: ${demographics.collegePct.toFixed(1)}%\n` +
    `• Homeownership Rate: ${demographics.homeownerPct.toFixed(1)}%\n` +
    `• Diversity Index: ${demographics.diversityIndex}/100\n` +
    `• Population Density: ${demographics.populationDensity.toLocaleString()} per sq mi`
  );

  // Wave 6D.2: Add citations
  return addCitationsToResponse(response, ['DEMOGRAPHICS', 'CENSUS_ACS']);
}

function addCitationsToResponse(
  response: string,
  explicitCitations: CitationKey[] = []
): string {
  const citationService = getCitationService();

  // Auto-detect additional citations from content
  const suggestedCitations = citationService.suggestCitations(response);

  // Combine explicit and suggested, remove duplicates
  const allCitations = [...new Set([...explicitCitations, ...suggestedCitations])];

  return citationService.addCitationsToResponse(response, allCitations);
}

/**
 * Response when there's nothing to save/export
 */
function getEmptyContextResponse(requestType: string): string {
  const action = requestType === 'save' ? 'save' : requestType === 'share' ? 'share' : 'export';

  return (
    `I'd be happy to help you ${action} your work, but there isn't much to ${action} yet.\n\n` +
    `**To get started, try:**\n` +
    `• Click on a precinct on the map to explore it\n` +
    `• Use the QuickStart IQ button to run an analysis\n` +
    `• Ask me to "Find swing precincts" or "Show high GOTV areas"\n\n` +
    `Once you've explored some data, I'll offer relevant save and export options.`
  );
}

/**
 * Response for targeted export request (user specified what they want)
 */
function getTargetedResponse(
  requestType: string,
  targetType: string,
  availableOutputs: string[],
  suggestions: SuggestedAction[]
): string {
  const targetMap: Record<string, string> = {
    analysis: 'analysis results',
    conversation: 'conversation',
    segment: 'segment',
    report: 'report',
    data: 'data',
    map: 'map view',
  };

  const targetLabel = targetMap[targetType] || targetType;
  const relevantSuggestion = suggestions.find(s => {
    if (targetType === 'analysis') return s.id === 'generate-report' || s.id === 'export-csv';
    if (targetType === 'conversation') return s.id === 'export-conversation';
    // "Segment" often means the precinct list the user filtered — CSV/VAN is the right action, not only save-segment
    if (targetType === 'segment') {
      return s.id === 'save-segment' || s.id === 'export-csv' || s.id === 'export-van';
    }
    if (targetType === 'report') return s.id === 'generate-report';
    if (targetType === 'data') return s.id === 'export-csv';
    return false;
  });

  if (relevantSuggestion) {
    return (
      `I can ${requestType} your ${targetLabel}. Here are the best options:\n\n` +
      `Based on your current session, you have:\n` +
      availableOutputs.map(o => `• ${o}`).join('\n') +
      `\n\nSelect an option below to proceed.`
    );
  }

  return (
    `I understand you want to ${requestType} your ${targetLabel}.\n\n` +
    `While I don't have that specific output ready, here's what I can ${requestType} right now:\n` +
    availableOutputs.map(o => `• ${o}`).join('\n') +
    `\n\nWould any of these work for you?`
  );
}

/**
 * Response for general export request
 */
function getGeneralResponse(requestType: string, availableOutputs: string[]): string {
  const actionVerb = requestType === 'save' ? 'save' : requestType === 'share' ? 'share' : 'export';

  return (
    `I can ${actionVerb} your work in several ways.\n\n` +
    `**Based on your current session:**\n` +
    availableOutputs.map(o => `• ${o}`).join('\n') +
    `\n\nWhat would be most useful for you?`
  );
}

function checkDonorGOTVOverlap(): { hasOverlap: boolean; insight: string; overlappingAreas: string[] } {
  try {
    const stateManager = getStateManager();
    const state = stateManager.getState();
    const history = state.explorationHistory || [];

    // Extract high-GOTV precincts from exploration history
    const gotvPrecincts = history
      .filter(e => {
        const gotvPriority = e.metadata?.gotvPriority as number | undefined;
        return gotvPriority !== undefined && gotvPriority > 70;
      })
      .flatMap(e => e.precinctIds || []);

    // Extract top donor ZIPs from exploration history
    const donorData = history
      .filter(e => e.tool === 'donors' && e.metadata?.topZips)
      .flatMap(e => (e.metadata?.topZips as string[]) || []);

    // Check for exploration in both domains
    if (gotvPrecincts.length > 0 && donorData.length > 0) {
      // Provide actionable insight about strategic overlap opportunity
      // Note: True geographic intersection would require precinct-to-ZIP crosswalk data
      // which is not currently loaded in the handler context
      const uniqueGotvPrecincts = Array.from(new Set(gotvPrecincts));
      const uniqueDonorZips = Array.from(new Set(donorData));

      return {
        hasOverlap: true,
        insight: `💡 **Cross-Tool Discovery**: You've explored ${uniqueGotvPrecincts.length} high-GOTV precincts ` +
          `and ${uniqueDonorZips.length} top donor ZIP codes. **Strategic opportunity**: Deploy canvassing teams in ` +
          `high-GOTV areas that overlap with donor-rich ZIPs for dual-purpose outreach (voter contact + fundraising asks). ` +
          `Consider analyzing precinct-ZIP overlap on the map to identify these high-value zones.`,
        overlappingAreas: uniqueGotvPrecincts.slice(0, 3),
      };
    }

    return { hasOverlap: false, insight: '', overlappingAreas: [] };
  } catch {
    return { hasOverlap: false, insight: '', overlappingAreas: [] };
  }
}

function checkSegmentCanvassOpportunity(): { hasOpportunity: boolean; insight: string; segmentName?: string } {
  try {
    const stateManager = getStateManager();
    const state = stateManager.getState();
    const savedSegments = state.segmentation?.savedSegments || [];
    const history = state.explorationHistory || [];

    // Check if user has saved segments but hasn't visited canvassing
    const hasVisitedCanvass = history.some(e => e.tool === 'canvass');

    if (savedSegments.length > 0 && !hasVisitedCanvass) {
      const recentSegment = savedSegments[savedSegments.length - 1];
      return {
        hasOpportunity: true,
        insight: `💡 **Next Step Suggestion**: You've saved "${recentSegment.name}" as a segment. ` +
          `Ready to turn this into a canvassing plan? The Canvassing Planner can optimize routes for these precincts.`,
        segmentName: recentSegment.name,
      };
    }

    return { hasOpportunity: false, insight: '' };
  } catch {
    return { hasOpportunity: false, insight: '' };
  }
}

function generateFilterSoWhat(
  results: { precinctCount?: number; estimatedVoters?: number; avgGOTV?: number; avgPartisanLean?: number; jurisdictions?: string[] }
): string {
  const count = results.precinctCount || 0;
  const voters = results.estimatedVoters || 0;
  const avgGotv = results.avgGOTV || 0;
  const avgLean = results.avgPartisanLean || 0;
  const jurisdictions = results.jurisdictions || [];

  const insights: string[] = [];

  // Universe size insight
  if (count <= 5) {
    insights.push(
      `**Focused Universe**: Only ${count} precincts match — this is a highly targeted segment. ` +
      `Your team can do deep engagement with quality over quantity.`
    );
  } else if (count <= 15) {
    insights.push(
      `**Manageable Universe**: ${count} precincts with ~${voters.toLocaleString()} voters is an actionable canvassing universe. ` +
      `This is roughly ${Math.ceil(count / 3)}-${Math.ceil(count / 2)} canvassing shifts of work.`
    );
  } else if (count > 30) {
    insights.push(
      `**Large Universe**: ${count} precincts may need further filtering for efficient resource allocation. ` +
      `Consider prioritizing the top 10-15 by your key metric.`
    );
  }

  // Partisan composition insight
  if (Math.abs(avgLean) < 5) {
    insights.push(
      `**Battleground Territory**: Average lean is ${avgLean > 0 ? 'R+' : 'D+'}${Math.abs(avgLean).toFixed(0)} — these precincts are truly competitive.`
    );
  } else if (avgLean < -10) {
    insights.push(
      `**Democratic Base**: Average D+${Math.abs(avgLean).toFixed(0)} lean — ideal for GOTV rather than persuasion.`
    );
  } else if (avgLean > 10) {
    insights.push(
      `**Republican Territory**: Average R+${avgLean.toFixed(0)} lean — consider if resources are better spent elsewhere for Democrats, or ideal GOTV for Republicans.`
    );
  }

  // Strategic recommendation
  if (avgGotv > 70 && Math.abs(avgLean) > 5) {
    insights.push(
      `**Recommendation**: High GOTV priority (${avgGotv.toFixed(0)}/100) with clear partisan lean suggests pure turnout strategy over persuasion.`
    );
  }

  // Wave 6B.7: Spatial/geographic insight
  if (jurisdictions.length > 0) {
    const uniqueJurisdictions = [...new Set(jurisdictions)];
    if (uniqueJurisdictions.length === 1) {
      insights.push(
        `**Geographic Focus**: All precincts are in ${uniqueJurisdictions[0]} — efficient for a concentrated canvassing effort.`
      );
    } else if (uniqueJurisdictions.length <= 3 && count <= 10) {
      insights.push(
        `**Geographic Clustering**: Precincts span ${uniqueJurisdictions.length} jurisdictions (${uniqueJurisdictions.join(', ')}) — consider cluster-based canvassing routes.`
      );
    } else if (uniqueJurisdictions.length > 5) {
      insights.push(
        `**Geographic Spread**: Precincts span ${uniqueJurisdictions.length} jurisdictions — may require multiple field teams or prioritization by cluster.`
      );
    }
  }

  if (insights.length > 0) {
    return `\n\n**📊 Strategic Insight**\n${insights.slice(0, 3).join('\n\n')}`; // Show up to 3 insights for spatial
  }

  return '';
}

function getUserExpertiseLevel(): ExpertiseLevel {
  try {
    const stateManager = getStateManager();
    return stateManager.getUserExpertiseLevel();
  } catch {
    return 'intermediate'; // Default
  }
}

function ordinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function getExplorationContext(): ExplorationContext {
  try {
    const stateManager = getStateManager();
    const metrics = stateManager.getExplorationMetrics();
    const state = stateManager.getState();

    // Get recent precinct names from exploration history
    const recentPrecincts = state.explorationHistory
      .filter(entry => entry.precinctIds && entry.precinctIds.length > 0)
      .slice(-5)
      .flatMap(entry => entry.precinctIds || []);

    return {
      recentPrecincts: [...new Set(recentPrecincts)], // Deduplicate
      explorationDepth: stateManager.getExplorationDepth(),
      toolsVisited: metrics.toolsVisited,
      hasHighValueFinds: metrics.highValueFound,
      sessionMinutes: metrics.sessionDuration,
      filtersApplied: metrics.filtersApplied,
      comparisonsMade: metrics.comparisonsMade,
    };
  } catch {
    // Return defaults if state manager not available
    return {
      recentPrecincts: [],
      explorationDepth: 0,
      toolsVisited: [],
      hasHighValueFinds: false,
      sessionMinutes: 0,
      filtersApplied: 0,
      comparisonsMade: 0,
    };
  }
}

function generateRecoverySuggestions(missingContext: 'selection' | 'segment' | 'comparison' | 'filter'): SuggestedAction[] {
  const browsePrecinctsAction = isPAPoliticalRegion()
    ? `Show me precincts in ${getPoliticalRegionEnv().summaryAreaName}`
    : 'Show me all precincts in Ingham County';
  const baseActions: SuggestedAction[] = [
    { id: 'click-map', label: 'Click map to select', action: 'Click on the map to select a precinct', icon: 'map-pin' },
    { id: 'browse-all', label: 'Browse all precincts', action: browsePrecinctsAction, icon: 'list' },
  ];

  switch (missingContext) {
    case 'selection':
      return [
        ...baseActions,
        { id: 'draw-boundary', label: 'Draw custom area', action: 'map:enableDraw', icon: 'edit' },
        { id: 'use-saved', label: 'Use saved segment', action: 'navigate:segments', icon: 'bookmark' },
      ];
    case 'segment':
      return [
        { id: 'create-segment', label: 'Create new segment', action: 'navigate:segments', icon: 'plus' },
        { id: 'quick-filter', label: 'Quick filter: High GOTV', action: 'Find precincts with GOTV priority above 70', icon: 'filter' },
        ...baseActions,
      ];
    case 'comparison':
      return [
        { id: 'select-first', label: 'Select first precinct', action: 'Click on a precinct to start comparison', icon: 'target' },
        {
          id: 'compare-example',
          label: 'Example comparison',
          action: isPAPoliticalRegion()
            ? 'Compare Philadelphia to Pittsburgh'
            : 'Compare East Lansing to Meridian Township',
          icon: 'git-compare',
        },
      ];
    case 'filter':
      return [
        { id: 'show-filters', label: 'Show available filters', action: 'What filters can I use?', icon: 'filter' },
        { id: 'preset-gotv', label: 'Use GOTV preset', action: 'Apply GOTV targeting filter', icon: 'zap' },
        { id: 'preset-swing', label: 'Use swing preset', action: 'Find swing precincts', icon: 'trending-up' },
      ];
    default:
      return baseActions;
  }
}

function getContextAwareSuggestions(
  baseSuggestions: SuggestedAction[],
  currentPrecinct?: string
): SuggestedAction[] {
  const context = getExplorationContext();
  const suggestions = [...baseSuggestions];

  // If user has explored multiple precincts, suggest comparison
  if (context.recentPrecincts.length >= 2 && currentPrecinct) {
    const otherPrecinct = context.recentPrecincts.find(p => p !== currentPrecinct);
    if (otherPrecinct) {
      suggestions.push({
        id: 'compare-recent',
        label: `Compare with ${otherPrecinct}`,
        action: `Compare ${currentPrecinct} to ${otherPrecinct}`,
        icon: 'git-compare'
      });
    }
  }

  // Wave 6B: Get output suggestions from SuggestionEngine based on exploration depth
  try {
    const suggestionEngine = getSuggestionEngine();
    const stateManager = getStateManager();
    const state = stateManager.getState();

    // Get threshold-based output suggestions (save segment, export, generate report, etc.)
    const outputSuggestions = suggestionEngine.generateOutputSuggestions(state);

    // Convert to SuggestedAction format and merge (avoid duplicates by ID)
    const existingIds = new Set(suggestions.map(s => s.id));
    for (const outputSugg of outputSuggestions) {
      if (!existingIds.has(outputSugg.id)) {
        suggestions.push({
          id: outputSugg.id,
          label: outputSugg.label,
          action: outputSugg.action,
          icon: outputSugg.category === 'canvassing' ? 'map-pin'
            : outputSugg.category === 'reporting' ? 'file-text'
              : outputSugg.category === 'segmentation' ? 'filter'
                : 'arrow-right',
          metadata: outputSugg.metadata,
        });
        existingIds.add(outputSugg.id);
      }
    }
  } catch (error) {
    console.warn('[workflowHandlers] SuggestionEngine not available:', error);
  }

  // Legacy: Manual fallback suggestions (kept for compatibility)
  // If deep exploration and no output suggestion yet, suggest save
  if (context.explorationDepth > 60 && !suggestions.some(s => s.id.startsWith('output-'))) {
    suggestions.push({
      id: 'save-segment',
      label: 'Save as targeting segment',
      action: 'output:saveSegment',
      icon: 'save'
    });
  }

  // If user has made comparisons, suggest report
  if (context.comparisonsMade >= 2 && !suggestions.some(s => s.id === 'output-save-comparison')) {
    suggestions.push({
      id: 'generate-comparison-report',
      label: 'Generate comparison report',
      action: 'report:comparison',
      icon: 'file-text'
    });
  }

  return suggestions.slice(0, 5); // Limit to 5 suggestions
}

function expressConfidence(
  level: 'high' | 'medium' | 'low',
  insight: string,
  methodology?: string
): string {
  const expressions = {
    high: {
      prefix: '**High confidence**: ',
      suffix: methodology ? ` (Based on ${methodology})` : '',
    },
    medium: {
      prefix: 'Likely: ',
      suffix: methodology ? ` (${methodology})` : '',
    },
    low: {
      prefix: 'Possible: ',
      suffix: methodology ? ` (Limited data: ${methodology})` : '',
    },
  };

  const expr = expressions[level];
  return `${expr.prefix}${insight}${expr.suffix}`;
}

function assessConfidence(factors: {
  dataPoints?: number;
  historicalElections?: number;
  margin?: number;
  sampleSize?: number;
}): 'high' | 'medium' | 'low' {
  let score = 0;

  if (factors.dataPoints && factors.dataPoints > 100) score += 2;
  else if (factors.dataPoints && factors.dataPoints > 20) score += 1;

  if (factors.historicalElections && factors.historicalElections >= 3) score += 2;
  else if (factors.historicalElections && factors.historicalElections >= 2) score += 1;

  if (factors.margin !== undefined) {
    if (Math.abs(factors.margin) > 10) score += 2; // Clear trend
    else if (Math.abs(factors.margin) > 5) score += 1;
  }

  if (factors.sampleSize && factors.sampleSize > 1000) score += 1;

  if (score >= 5) return 'high';
  if (score >= 3) return 'medium';
  return 'low';
}

function getSpecificReportResponse(
  reportType: string,
  options: ReportOption[],
  targetArea?: string
): string {
  const typeLabels: Record<string, string> = {
    executive: 'Executive Summary',
    targeting: 'Targeting Brief',
    comparison: 'Comparison Report',
    segment: 'Segment Report',
    canvass: 'Canvassing Plan',
    donor: 'Donor Analysis',
    profile: 'Political Profile',
  };

  const matchingOption = options.find(o => o.type === reportType);
  const label = typeLabels[reportType] || 'Report';

  if (matchingOption) {
    const areaText = targetArea ? ` for ${targetArea}` : '';
    return (
      `**${label}${areaText}**\n\n` +
      `${matchingOption.description}\n\n` +
      `**What's included:**\n` +
      getReportContents(reportType) +
      `\n\nReady to generate? Click below to create your ${matchingOption.pages} report.`
    );
  }

  // Report type not available - suggest alternatives
  const alternatives = options.filter(o => o.available).slice(0, 3);
  return (
    `I don't have enough data to create a ${label} right now.\n\n` +
    `**Available alternatives:**\n` +
    alternatives.map(o => `• **${o.label}** - ${o.description}`).join('\n') +
    `\n\nWould any of these work for you?`
  );
}

function getReportContents(reportType: string): string {
  const contents: Record<string, string> = {
    executive: '• Key metrics overview\n• Quick assessment\n• Top recommendation',
    targeting: '• Ranked precinct list\n• GOTV and Persuasion scores\n• Priority recommendations',
    comparison: '• Side-by-side metrics\n• Key differences\n• Strategic implications',
    segment: '• Filter criteria\n• Matching precincts\n• Aggregate demographics',
    canvass: '• Operation overview\n• Turf assignments\n• Staffing recommendations',
    donor: '• Fundraising summary\n• Geographic concentration\n• Prospect identification',
    profile: '• Political overview\n• Election history\n• Demographics\n• Political attitudes\n• Engagement profile\n• AI analysis',
  };

  return contents[reportType] || '• Comprehensive analysis';
}

function getContextualReportResponse(
  options: ReportOption[],
): string {
  // Group options by category
  const quickReports = options.filter(o => ['executive', 'targeting'].includes(o.type));
  const detailedReports = options.filter(o => ['profile', 'comparison'].includes(o.type));
  const operationalReports = options.filter(o => ['segment', 'canvass', 'donor'].includes(o.type));

  const recommended = options.find(o => o.recommended);

  let response = `I can create several types of reports based on your session.\n\n`;

  if (quickReports.length > 0) {
    response += `**Quick Reports (1-2 pages):**\n`;
    quickReports.forEach(r => {
      const recLabel = r.recommended ? ' ⭐ *Recommended*' : '';
      response += `${r.emoji} **${r.label}** - ${r.description}${recLabel}\n`;
    });
    response += '\n';
  }

  if (detailedReports.length > 0) {
    response += `**Detailed Reports:**\n`;
    detailedReports.forEach(r => {
      const recLabel = r.recommended ? ' ⭐ *Recommended*' : '';
      response += `${r.emoji} **${r.label}** (${r.pages}) - ${r.description}${recLabel}\n`;
    });
    response += '\n';
  }

  if (operationalReports.length > 0) {
    response += `**Operational Reports:**\n`;
    operationalReports.forEach(r => {
      const recLabel = r.recommended ? ' ⭐ *Recommended*' : '';
      response += `${r.emoji} **${r.label}** (${r.pages}) - ${r.description}${recLabel}\n`;
    });
    response += '\n';
  }

  // Add recommendation
  if (recommended) {
    response += `Based on your exploration, I'd suggest starting with the **${recommended.label}**.`;
  } else {
    response += `Which would be most useful for you?`;
  }

  return response;
}

function buildReportSuggestions(options: ReportOption[]): SuggestedAction[] {
  // Sort by recommended first, then by type priority
  const sortedOptions = [...options].sort((a, b) => {
    if (a.recommended && !b.recommended) return -1;
    if (!a.recommended && b.recommended) return 1;
    return 0;
  });

  const suggestions: SuggestedAction[] = sortedOptions.map(option => ({
    id: option.id,
    label: `${option.emoji} ${option.label} (${option.pages})`,
    action: option.action,
    icon: option.icon,
    description: option.description,
    metadata: option.metadata,
  }));

  // Add customize option if there are reports available
  if (sortedOptions.length > 0) {
    suggestions.push({
      id: 'customize-report',
      label: '⚙️ Customize report sections',
      action: 'customize report',
      icon: 'settings',
      description: 'Choose which sections to include in your report',
    });
  }

  return suggestions;
}

// Helpers
function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  } else if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(1)}K`;
  } else {
    return `$${amount.toFixed(0)}`;
  }
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}