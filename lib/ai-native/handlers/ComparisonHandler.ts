/**
 * Comparison NLP Handler
 *
 * Translates natural language comparison queries into ComparisonEngine operations.
 * Supports queries like:
 * - "Compare Lansing Ward 1 to East Lansing Ward 1"
 * - "Find precincts similar to Okemos Township 1"
 * - "What's the ROI of canvassing these areas?"
 * - "Generate a field brief for Lansing Ward 2 and Ward 3"
 */

import type {
  NLPHandler,
  ParsedQuery,
  HandlerResult,
  QueryPattern,
  ExtractedEntities,
} from './types';
import { RESPONSE_TEMPLATES, appendSources, getEnrichmentForQuery, formatEnrichmentSections } from './types';
import { ComparisonEngine } from '@/lib/comparison/ComparisonEngine';
import { ResourceOptimizer } from '@/lib/comparison/ResourceOptimizer';
import type {
  ComparisonEntity,
  ComparisonResult,
  PrecinctDataFile,
} from '@/lib/comparison/types';
import type { EntityResourceAnalysis } from '@/lib/comparison';
import { politicalDataService } from '@/lib/services/PoliticalDataService';

// ============================================================================
// Query Patterns
// ============================================================================

const COMPARISON_PATTERNS: QueryPattern[] = [
  {
    intent: 'compare_find_similar',
    patterns: [
      /find\s+(?:precincts?|jurisdictions?|areas?)\s+similar\s+to/i,
      /similar\s+(?:precincts?|jurisdictions?|areas?)\s+(?:to|as)/i,
      /which\s+(?:precincts?|areas?)\s+(?:are\s+)?like/i,
      /show\s+(?:me\s+)?similar/i,
      /comparable\s+(?:precincts?|jurisdictions?|areas?)/i,
    ],
    keywords: ['similar', 'like', 'comparable', 'find', 'match'],
    priority: 10,
  },
  {
    intent: 'compare_resource_analysis',
    patterns: [
      /what.*roi/i,
      /resource.*allocation/i,
      /cost.*benefit/i,
      /efficiency.*analysis/i,
      /where.*best.*invest/i,
      /prioritize.*canvass/i,
      /optimize.*resources?/i,
    ],
    keywords: ['roi', 'resource', 'cost', 'benefit', 'efficiency', 'optimize', 'prioritize'],
    priority: 9,
  },
  {
    intent: 'compare_field_brief',
    patterns: [
      /(?:generate|create|make)\s+(?:a\s+)?field\s+brief/i,
      /field\s+brief\s+for/i,
      /briefing\s+(?:for|on)/i,
      /canvass\s+brief/i,
      /door.?knock(?:ing)?\s+brief/i,
    ],
    keywords: ['brief', 'briefing', 'field', 'canvass', 'door knock'],
    priority: 8,
  },
  {
    intent: 'compare_batch',
    patterns: [
      /compare\s+all\s+(?:precincts?|wards?|jurisdictions?)/i,
      /batch\s+comparison/i,
      /compare\s+multiple/i,
      /side.?by.?side\s+all/i,
      /rank\s+all/i,
    ],
    keywords: ['batch', 'all', 'multiple', 'rank', 'compare all'],
    priority: 7,
  },
  {
    intent: 'compare_export_pdf',
    patterns: [
      /export\s+(?:comparison|brief)\s+(?:as\s+)?pdf/i,
      /download\s+comparison/i,
      /(?:save|generate)\s+pdf/i,
      /print\s+comparison/i,
    ],
    keywords: ['export', 'download', 'pdf', 'save', 'print'],
    priority: 6,
  },
  {
    intent: 'compare_jurisdictions',
    patterns: [
      /compare\s+[\w\s]+\s+(?:to|vs|versus|and)\s+[\w\s]+/i,
      /difference\s+between\s+[\w\s]+\s+and\s+[\w\s]+/i,
      /side.?by.?side/i,
      /how\s+(?:does|do)\s+[\w\s]+\s+compare/i,
    ],
    keywords: ['compare', 'versus', 'vs', 'difference', 'side by side'],
    priority: 10,
  },
];

// ============================================================================
// Entity Extraction Patterns
// ============================================================================

const PRECINCT_NAME_PATTERN = /(?:precinct\s+)?([A-Za-z\s]+(?:ward|township|precinct)\s+\d+)/gi;
const JURISDICTION_NAME_PATTERN = /(?:city|township|ward)\s+of\s+([A-Za-z\s]+)/gi;
const WARD_PATTERN = /ward\s+(\d+)/gi;

// ============================================================================
// Comparison Handler Class
// ============================================================================

export class ComparisonHandler implements NLPHandler {
  name = 'ComparisonHandler';
  patterns = COMPARISON_PATTERNS;

  private engine: ComparisonEngine | null = null;
  private optimizer: ResourceOptimizer | null = null;

  // --------------------------------------------------------------------------
  // Interface Methods
  // --------------------------------------------------------------------------

  canHandle(query: ParsedQuery): boolean {
    return (
      query.intent === 'compare_find_similar' ||
      query.intent === 'compare_resource_analysis' ||
      query.intent === 'compare_field_brief' ||
      query.intent === 'compare_batch' ||
      query.intent === 'compare_export_pdf' ||
      query.intent === 'compare_jurisdictions'
    );
  }

  async handle(query: ParsedQuery): Promise<HandlerResult> {
    const startTime = Date.now();

    try {
      // Initialize engines lazily
      await this.initializeEngines();

      switch (query.intent) {
        case 'compare_find_similar':
          return await this.handleFindSimilar(query, startTime);

        case 'compare_resource_analysis':
          return await this.handleResourceAnalysis(query, startTime);

        case 'compare_field_brief':
          return await this.handleFieldBrief(query, startTime);

        case 'compare_batch':
          return await this.handleBatch(query, startTime);

        case 'compare_export_pdf':
          return await this.handleExportPDF(query, startTime);

        case 'compare_jurisdictions':
          return await this.handleJurisdictions(query, startTime);

        default:
          return {
            success: false,
            response: RESPONSE_TEMPLATES.error.parse(query.originalQuery),
            error: 'Unknown comparison intent',
          };
      }
    } catch (error) {
      return {
        success: false,
        response: RESPONSE_TEMPLATES.error.execution('process comparison query'),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // --------------------------------------------------------------------------
  // Query Handlers
  // --------------------------------------------------------------------------

  private async handleFindSimilar(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    const entities = this.extractEntities(query.originalQuery);

    // Extract the reference precinct name from query
    const referencePrecinctName = this.extractReferenceEntity(query.originalQuery);

    if (!referencePrecinctName) {
      return {
        success: false,
        response: 'Please specify which precinct or jurisdiction you want to find similar areas to.',
        error: 'No reference entity specified',
      };
    }

    try {
      // Determine boundary type (default to precincts)
      const boundaryType = entities.comparisonBoundaryType || 'precincts';
      const limit = entities.comparisonMaxResults || 5;
      const minSimilarity = entities.comparisonMinSimilarity || 60;

      // Call the similar API endpoint with correct parameters
      const apiUrl = `/api/comparison/similar?entityId=${encodeURIComponent(referencePrecinctName)}&boundaryType=${boundaryType}&limit=${limit}&minSimilarity=${minSimilarity}`;
      const response = await fetch(apiUrl);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || response.statusText);
      }

      const data = await response.json();
      const { referenceEntity, results, count } = data;

      // Get enrichment context (RAG + Knowledge Graph)
      const enrichment = await getEnrichmentForQuery(query.originalQuery);
      const enrichmentSections = formatEnrichmentSections(enrichment);

      // Format response with similarity results
      const responseText = this.formatSimilarResponse(referenceEntity, results) + enrichmentSections;

      // Extract entity IDs for map highlighting
      const entityIds = results.map((r: any) => r.entity.id);

      return {
        success: true,
        response: responseText,
        mapCommands: [
          {
            type: 'highlight',
            target: [referenceEntity.id, ...entityIds],
            color: '#8B5CF6',
          },
          {
            type: 'flyTo',
            target: referenceEntity.id,
            zoom: 11,
          },
        ],
        suggestedActions: [
          {
            id: 'compare-top-similar',
            label: `Compare ${referenceEntity.name} to ${results[0]?.entity.name || 'top match'}`,
            action: `Compare ${referenceEntity.name} to ${results[0]?.entity.name || 'top match'}`,
            icon: 'git-compare',
          },
          {
            id: 'go-to-segments',
            label: 'Build in Segment Tool',
            action: 'Navigate to /segments',
            icon: 'bookmark',
          },
          {
            id: 'go-to-compare',
            label: 'Open Comparison Tool',
            action: 'Navigate to /compare',
            icon: 'download',
          },
        ],
        data: { referenceEntity, similarPrecincts: results, count },
        citations: [
          {
            id: 'similarity-engine',
            source: 'SimilarityEngine',
            type: 'calculation',
            description: 'Multi-dimensional similarity scoring (political, demographic, targeting)',
          },
        ],
        metadata: this.buildMetadata('compare_find_similar', startTime, query),
      };
    } catch (error) {
      return {
        success: false,
        response: `Could not find similar areas to "${referencePrecinctName}". ${error instanceof Error ? error.message : ''}`,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async handleResourceAnalysis(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    if (!this.optimizer) {
      throw new Error('ResourceOptimizer not initialized');
    }

    const entities = this.extractEntities(query.originalQuery);

    // Extract area names from query
    const areaNames = this.extractAreaNames(query.originalQuery);

    if (areaNames.length === 0) {
      return {
        success: false,
        response: 'Please specify which areas you want to analyze for resource allocation (e.g., "Lansing Ward 1 and Ward 2").',
        error: 'No areas specified',
      };
    }

    // Build entities for the specified areas
    const comparisonEntities: ComparisonEntity[] = [];
    for (const areaName of areaNames) {
      try {
        const entity = this.engine!.buildPrecinctEntity(areaName);
        comparisonEntities.push(entity);
      } catch (error) {
        // Try jurisdiction if precinct fails
        try {
          const entity = this.engine!.buildJurisdictionEntity(areaName);
          comparisonEntities.push(entity);
        } catch {
          // Skip invalid names
        }
      }
    }

    if (comparisonEntities.length === 0) {
      return {
        success: false,
        response: `Could not find any valid areas matching: ${areaNames.join(', ')}`,
        error: 'No valid entities found',
      };
    }

    // Use ResourceOptimizer to analyze - rankByROI returns EntityResourceAnalysis[]
    const rankedAnalyses = this.optimizer.rankByROI(comparisonEntities);

    const responseText = this.formatResourceAnalysisResponse(rankedAnalyses);

    return {
      success: true,
      response: responseText,
      mapCommands: [
        {
          action: 'highlight',
          target: 'precincts',
          ids: comparisonEntities.map(e => e.id),
          style: { fillColor: '#10B981', fillOpacity: 0.6 },
        },
      ],
      suggestedActions: [
        {
          id: 'export-roi',
          label: 'Export ROI Analysis',
          description: 'Download as CSV',
          action: 'export_roi',
          priority: 2,
        },
      ],
      data: rankedAnalyses,
      metadata: this.buildMetadata('compare_resource_analysis', startTime, query),
    };
  }

  private async handleFieldBrief(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    const entities = this.extractEntities(query.originalQuery);
    const areaNames = this.extractAreaNames(query.originalQuery);

    if (areaNames.length < 2) {
      return {
        success: false,
        response: 'Please specify at least two areas to generate a field brief (e.g., "Lansing Ward 1 and Ward 2").',
        error: 'Insufficient areas specified',
      };
    }

    try {
      // Call the brief API endpoint
      const response = await fetch('/api/comparison/brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityIds: areaNames,
          includeTargeting: true,
          includeCanvassing: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const brief = await response.json();

      const responseText = this.formatFieldBriefResponse(brief);

      return {
        success: true,
        response: responseText,
        mapCommands: [
          {
            action: 'highlight',
            target: 'precincts',
            ids: areaNames,
            style: { fillColor: '#F59E0B', fillOpacity: 0.6 },
          },
        ],
        suggestedActions: [
          {
            id: 'export-brief',
            label: 'Export as PDF',
            description: 'Download field brief',
            action: 'compare_export_pdf',
            params: { briefId: brief.id },
            priority: 1,
          },
        ],
        data: brief,
        citations: [
          {
            id: 'field-brief',
            source: 'Comparison Engine',
            type: 'calculation',
            description: 'Generated field brief with targeting recommendations',
          },
        ],
        metadata: this.buildMetadata('compare_field_brief', startTime, query),
      };
    } catch (error) {
      return {
        success: false,
        response: `Could not generate field brief. ${error instanceof Error ? error.message : ''}`,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async handleBatch(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    const entities = this.extractEntities(query.originalQuery);

    // Extract jurisdiction or pattern to batch compare
    const jurisdictionPattern = this.extractJurisdictionPattern(query.originalQuery);

    if (!jurisdictionPattern) {
      return {
        success: false,
        response: 'Please specify which areas to batch compare (e.g., "all wards in Lansing").',
        error: 'No jurisdiction pattern specified',
      };
    }

    try {
      // Call the batch API endpoint
      const response = await fetch('/api/comparison/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pattern: jurisdictionPattern,
          sortBy: 'gotvPriority',
          limit: 20,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const data = await response.json();
      const { entities: batchEntities, rankings } = data;

      const responseText = this.formatBatchResponse(batchEntities, rankings);

      return {
        success: true,
        response: responseText,
        mapCommands: [
          {
            action: 'showHeatmap',
            layer: 'gotv-priority',
            field: 'gotvPriority',
            colorScheme: 'blue',
          },
        ],
        suggestedActions: [
          {
            id: 'compare-top-two',
            label: 'Compare Top 2',
            description: 'Side-by-side view',
            action: 'compare_entities',
            params: {
              leftId: batchEntities[0]?.id,
              rightId: batchEntities[1]?.id,
            },
            priority: 1,
          },
          {
            id: 'export-rankings',
            label: 'Export Rankings',
            description: 'Download as CSV',
            action: 'export_rankings',
            priority: 2,
          },
          {
            id: 'create-segment-top',
            label: 'Create Segment from Top 10',
            description: 'Group high-priority areas',
            action: 'create_segment',
            priority: 3,
          },
        ],
        data: { entities: batchEntities, rankings },
        metadata: this.buildMetadata('compare_batch', startTime, query),
      };
    } catch (error) {
      return {
        success: false,
        response: `Could not perform batch comparison. ${error instanceof Error ? error.message : ''}`,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async handleExportPDF(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    const entities = this.extractEntities(query.originalQuery);
    const areaNames = this.extractAreaNames(query.originalQuery);

    if (areaNames.length < 2) {
      return {
        success: false,
        response: 'Please specify at least two areas to export comparison (e.g., "Lansing Ward 1 vs Ward 2").',
        error: 'Insufficient areas specified',
      };
    }

    try {
      // Call the export PDF API endpoint
      const response = await fetch('/api/comparison/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityIds: areaNames,
          format: 'pdf',
          includeCharts: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      return {
        success: true,
        response: `Comparison PDF exported successfully for ${areaNames.join(' vs ')}. Download link created.`,
        suggestedActions: [
          {
            id: 'open-pdf',
            label: 'Open PDF',
            description: 'View comparison report',
            action: 'open_url',
            params: { url },
            priority: 1,
          },
        ],
        data: { downloadUrl: url, entityIds: areaNames },
        metadata: this.buildMetadata('compare_export_pdf', startTime, query),
      };
    } catch (error) {
      return {
        success: false,
        response: `Could not export comparison PDF. ${error instanceof Error ? error.message : ''}`,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async handleJurisdictions(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    const entities = this.extractEntities(query.originalQuery);
    const areaNames = this.extractAreaNames(query.originalQuery);

    if (areaNames.length < 2) {
      return {
        success: false,
        response: 'Please specify two areas to compare (e.g., "Compare Lansing to East Lansing").',
        error: 'Insufficient areas specified',
      };
    }

    if (!this.engine) {
      throw new Error('ComparisonEngine not initialized');
    }

    try {
      // Build entities for both areas
      const leftEntity = await this.buildEntity(areaNames[0]);
      const rightEntity = await this.buildEntity(areaNames[1]);

      // Compare the entities
      const comparison = this.engine.compare(leftEntity, rightEntity);

      // Get enrichment context (RAG + Knowledge Graph)
      const enrichment = await getEnrichmentForQuery(query.originalQuery);
      const enrichmentSections = formatEnrichmentSections(enrichment);

      const responseText = this.formatComparisonResponse(comparison) + enrichmentSections;

      // Add action directive for split screen
      const actionDirective = `[ACTION:setComparison:{"left":"${leftEntity.id}","right":"${rightEntity.id}"}]`;

      return {
        success: true,
        response: `${responseText}\n\n${actionDirective}`,
        mapCommands: [
          {
            action: 'highlight',
            target: 'precincts',
            ids: [leftEntity.id, rightEntity.id],
            style: { fillColor: '#8B5CF6', fillOpacity: 0.6 },
          },
          {
            action: 'splitScreen',
            leftEntityId: leftEntity.id,
            rightEntityId: rightEntity.id,
          },
        ],
        suggestedActions: [
          {
            id: 'export-comparison',
            label: 'Export as PDF',
            description: 'Download comparison report',
            action: 'compare_export_pdf',
            params: { entityIds: [leftEntity.id, rightEntity.id] },
            priority: 1,
          },
          {
            id: 'find-similar',
            label: `Find Similar to ${leftEntity.name}`,
            description: 'Discover comparable areas',
            action: 'compare_find_similar',
            params: { entityId: leftEntity.id },
            priority: 2,
          },
          {
            id: 'create-segment',
            label: 'Create Segment from Both',
            description: 'Group for targeting',
            action: 'create_segment',
            params: { precincts: [leftEntity.id, rightEntity.id] },
            priority: 3,
          },
        ],
        data: comparison,
        citations: [
          {
            id: 'comparison-data',
            source: 'Ingham County Precinct Data',
            type: 'data',
            description: 'Precinct-level comparison',
          },
        ],
        metadata: this.buildMetadata('compare_jurisdictions', startTime, query),
      };
    } catch (error) {
      return {
        success: false,
        response: `Could not compare "${areaNames[0]}" and "${areaNames[1]}". ${error instanceof Error ? error.message : ''}`,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // --------------------------------------------------------------------------
  // Entity Extraction
  // --------------------------------------------------------------------------

  extractEntities(query: string): ExtractedEntities {
    const entities: ExtractedEntities = {};

    // Extract precinct names
    const precinctMatches = query.match(PRECINCT_NAME_PATTERN);
    if (precinctMatches) {
      entities.precincts = Array.from(new Set(precinctMatches.map(m => m.trim())));
    }

    // Extract jurisdiction names
    const jurisdictionMatches = query.match(JURISDICTION_NAME_PATTERN);
    if (jurisdictionMatches) {
      entities.jurisdictions = Array.from(new Set(jurisdictionMatches.map(m => m.trim())));
    }

    return entities;
  }

  // --------------------------------------------------------------------------
  // Helper Methods
  // --------------------------------------------------------------------------

  private async initializeEngines(): Promise<void> {
    if (this.engine && this.optimizer) {
      return;
    }

    // Load precinct data from PoliticalDataService (single source of truth)
    // This ensures consistent data across all components using blob storage
    const data = await politicalDataService.getPrecinctDataFileFormat();

    this.engine = new ComparisonEngine(data as PrecinctDataFile);
    this.optimizer = new ResourceOptimizer();
  }

  private extractReferenceEntity(query: string): string | null {
    // Extract entity name after "similar to" or "like"
    const match = query.match(/similar\s+to\s+([\w\s]+?)(?:\s+and|\s+or|$)/i) ||
      query.match(/like\s+([\w\s]+?)(?:\s+and|\s+or|$)/i);
    return match ? match[1].trim() : null;
  }

  private extractAreaNames(query: string): string[] {
    const names: string[] = [];

    // Extract ward numbers
    const wardMatches = query.match(/ward\s+(\d+)/gi);
    if (wardMatches) {
      wardMatches.forEach(m => names.push(m.trim()));
    }

    // Extract full precinct/jurisdiction names
    const precinctMatches = query.match(/([A-Za-z\s]+(?:ward|township|precinct)\s+\d+)/gi);
    if (precinctMatches) {
      precinctMatches.forEach(m => names.push(m.trim()));
    }

    // Extract city/township names
    const cityMatches = query.match(/(?:city|township)\s+of\s+([A-Za-z\s]+)/gi);
    if (cityMatches) {
      cityMatches.forEach(m => names.push(m.trim()));
    }

    return Array.from(new Set(names));
  }

  private extractJurisdictionPattern(query: string): string | null {
    // Extract patterns like "all wards in Lansing"
    const match = query.match(/all\s+(wards?|precincts?)\s+in\s+([\w\s]+)/i);
    if (match) {
      return `${match[2].trim()}:${match[1].trim()}`;
    }

    // Extract patterns like "all Lansing wards"
    const match2 = query.match(/all\s+([\w\s]+)\s+(wards?|precincts?)/i);
    if (match2) {
      return `${match2[1].trim()}:${match2[2].trim()}`;
    }

    return null;
  }

  private async buildEntity(areaName: string): Promise<ComparisonEntity> {
    if (!this.engine) {
      throw new Error('ComparisonEngine not initialized');
    }

    try {
      return this.engine.buildPrecinctEntity(areaName);
    } catch {
      // Try jurisdiction if precinct fails
      return this.engine.buildJurisdictionEntity(areaName);
    }
  }

  private async calculateCenterPoint(entities: ComparisonEntity[]): Promise<[number, number]> {
    // Default to Ingham County center if no entities
    const INGHAM_CENTER: [number, number] = [-84.55, 42.60];

    if (entities.length === 0) {
      return INGHAM_CENTER;
    }

    // Calculate centroid of all entities by looking up their geographic centers
    const coords: [number, number][] = [];

    for (const entity of entities) {
      try {
        // Try to get centroid for this entity (works for precincts)
        const centroid = await politicalDataService.getPrecinctCentroid(entity.id);
        if (centroid && centroid[0] !== 0 && centroid[1] !== 0) {
          coords.push(centroid);
        }
      } catch {
        // Entity doesn't have centroid data, skip
      }
    }

    if (coords.length === 0) {
      return INGHAM_CENTER;
    }

    // Calculate geometric center of all coordinates
    const sumLng = coords.reduce((sum, c) => sum + c[0], 0);
    const sumLat = coords.reduce((sum, c) => sum + c[1], 0);

    return [sumLng / coords.length, sumLat / coords.length];
  }

  // --------------------------------------------------------------------------
  // Response Formatting
  // --------------------------------------------------------------------------

  private formatSimilarResponse(
    reference: { id: string; name: string; type: string },
    results: Array<{ entity: ComparisonEntity; similarity: { score: number; factors: string[] } }>
  ): string {
    if (!results || results.length === 0) {
      return `No similar areas found for ${reference.name}. Try adjusting the similarity threshold or expanding the search area.`;
    }

    const lines = [
      `**Areas Similar to ${reference.name}:**`,
      '',
      `Found ${results.length} precincts with similar characteristics:`,
      '',
    ];

    results.forEach((result, i) => {
      const entity = result.entity;
      const similarity = result.similarity;
      const leanLabel = entity.politicalProfile.partisanLean > 0
        ? `D+${entity.politicalProfile.partisanLean.toFixed(1)}`
        : `R+${Math.abs(entity.politicalProfile.partisanLean).toFixed(1)}`;

      lines.push(`**${i + 1}. ${entity.name}** (${similarity.score}% similar)`);
      lines.push(`   - Partisan Lean: ${leanLabel}`);
      lines.push(`   - GOTV Priority: ${entity.targetingScores.gotvPriority}/100`);
      lines.push(`   - Strategy: ${entity.targetingScores.recommendedStrategy}`);

      if (similarity.factors && similarity.factors.length > 0) {
        lines.push(`   - Key matches: ${similarity.factors.slice(0, 3).join(', ')}`);
      }

      lines.push('');
    });

    lines.push(`**Next Steps:**`);
    lines.push(`- Compare ${reference.name} to top matches for detailed analysis`);
    lines.push(`- Create a segment from similar precincts for coordinated targeting`);

    return appendSources(lines.join('\n'), ['elections', 'demographics']);
  }

  private formatResourceAnalysisResponse(analyses: EntityResourceAnalysis[]): string {
    const lines = [
      '**Resource Allocation ROI Analysis:**',
      '',
      '| Area | GOTV Priority | Persuasion | Efficiency | ROI Score |',
      '|------|---------------|------------|------------|-----------|',
    ];

    analyses.forEach((analysis: EntityResourceAnalysis) => {
      const entity = analysis.entity;
      const canvassingEfficiency = analysis.channelCosts.canvassing?.doorsPerHour || 'N/A';
      lines.push(
        `| ${entity.name} | ${entity.targetingScores.gotvPriority.toFixed(0)} | ${entity.targetingScores.persuasionOpportunity.toFixed(0)} | ${canvassingEfficiency} doors/hr | ${analysis.roiScore.totalScore.toFixed(0)} |`
      );
    });

    lines.push('');
    lines.push('**Recommendation:** Focus resources on areas with highest ROI scores for maximum impact.');

    return appendSources(lines.join('\n'), ['elections', 'demographics']);
  }

  private formatFieldBriefResponse(brief: any): string {
    const response = [
      `**Field Brief: ${brief.title || 'Comparison Areas'}**`,
      '',
      `**Target Areas:** ${brief.entityCount || 0}`,
      `**Total Voters:** ${brief.totalVoters?.toLocaleString() || 'N/A'}`,
      `**Recommended Strategy:** ${brief.recommendedStrategy || 'Mixed approach'}`,
      '',
      '**Key Insights:**',
      ...((brief.insights || []) as string[]).map((insight: string) => `- ${insight}`),
      '',
      '**Next Steps:**',
      ...((brief.nextSteps || []) as string[]).map((step: string) => `- ${step}`),
    ].join('\n');

    return appendSources(response, ['elections', 'demographics']);
  }

  private formatBatchResponse(entities: ComparisonEntity[], rankings: any): string {
    const lines = [
      `**Batch Comparison Results: ${entities.length} Areas**`,
      '',
      '| Rank | Area | Partisan Lean | GOTV | Strategy |',
      '|------|------|---------------|------|----------|',
    ];

    entities.slice(0, 10).forEach((entity, i) => {
      const leanLabel = entity.politicalProfile.partisanLean > 0
        ? `D+${entity.politicalProfile.partisanLean.toFixed(1)}`
        : `R+${Math.abs(entity.politicalProfile.partisanLean).toFixed(1)}`;

      lines.push(
        `| ${i + 1} | ${entity.name} | ${leanLabel} | ${entity.targetingScores.gotvPriority} | ${entity.targetingScores.recommendedStrategy} |`
      );
    });

    if (entities.length > 10) {
      lines.push('');
      lines.push(`*Showing top 10 of ${entities.length} areas*`);
    }

    return appendSources(lines.join('\n'), ['elections', 'demographics']);
  }

  private formatComparisonResponse(comparison: ComparisonResult): string {
    const left = comparison.leftEntity;
    const right = comparison.rightEntity;

    const lines = [
      `**Comparison: ${left.name} vs ${right.name}**`,
      '',
      '**Demographics:**',
      '',
      '| Metric | ' + left.name + ' | ' + right.name + ' | Difference |',
      '|--------|' + '-'.repeat(left.name.length) + '-|' + '-'.repeat(right.name.length) + '-|------------|',
    ];

    comparison.differences.demographics.slice(0, 4).forEach(diff => {
      const leftVal = this.formatValue(diff.leftValue, diff.formatType);
      const rightVal = this.formatValue(diff.rightValue, diff.formatType);
      const diffVal = this.formatDifference(diff.difference, diff.formatType);

      lines.push(`| ${diff.metricName} | ${leftVal} | ${rightVal} | ${diffVal} |`);
    });

    lines.push('');
    lines.push('**Political Profile:**');
    lines.push('');
    lines.push('| Metric | ' + left.name + ' | ' + right.name + ' | Difference |');
    lines.push('|--------|' + '-'.repeat(left.name.length) + '-|' + '-'.repeat(right.name.length) + '-|------------|');

    comparison.differences.politicalProfile.slice(0, 4).forEach(diff => {
      const leftVal = this.formatValue(diff.leftValue, diff.formatType);
      const rightVal = this.formatValue(diff.rightValue, diff.formatType);
      const diffVal = this.formatDifference(diff.difference, diff.formatType);

      lines.push(`| ${diff.metricName} | ${leftVal} | ${rightVal} | ${diffVal} |`);
    });

    lines.push('');
    lines.push('**Targeting Strategy:**');
    lines.push(`- ${left.name}: ${left.targetingScores.recommendedStrategy}`);
    lines.push(`- ${right.name}: ${right.targetingScores.recommendedStrategy}`);

    return appendSources(lines.join('\n'), ['elections', 'demographics']);
  }

  private formatValue(value: number, formatType: string): string {
    switch (formatType) {
      case 'currency':
        return `$${Math.round(value).toLocaleString()}`;
      case 'percent':
        return `${value.toFixed(1)}%`;
      case 'points':
        return value > 0 ? `D+${value.toFixed(1)}` : `R+${Math.abs(value).toFixed(1)}`;
      default:
        return Math.round(value).toLocaleString();
    }
  }

  private formatDifference(diff: number, formatType: string): string {
    const sign = diff >= 0 ? '+' : '';
    switch (formatType) {
      case 'currency':
        return `${sign}$${Math.round(diff).toLocaleString()}`;
      case 'percent':
        return `${sign}${diff.toFixed(1)}%`;
      case 'points':
        return `${sign}${diff.toFixed(1)}`;
      default:
        return `${sign}${Math.round(diff).toLocaleString()}`;
    }
  }

  // --------------------------------------------------------------------------
  // Metadata
  // --------------------------------------------------------------------------

  private buildMetadata(intent: string, startTime: number, query: ParsedQuery): any {
    return {
      handlerName: this.name,
      processingTimeMs: Date.now() - startTime,
      queryType: 'comparison',
      matchedIntent: intent,
      confidence: query.confidence,
    };
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const comparisonHandler = new ComparisonHandler();

export default ComparisonHandler;
