/**
 * Data Export NLP Handler
 *
 * Translates natural language export queries into data export operations.
 * Supports queries like:
 * - "Export all my segments"
 * - "Download the voter file"
 * - "Sync with VAN"
 * - "Export data to CSV"
 */

import type {
  NLPHandler,
  ParsedQuery,
  HandlerResult,
  QueryPattern,
  ExtractedEntities,
} from './types';
import { RESPONSE_TEMPLATES } from './types';

// ============================================================================
// Query Patterns
// ============================================================================

const DATA_EXPORT_PATTERNS: QueryPattern[] = [
  {
    intent: 'export_segments',
    patterns: [
      /export\s+(?:all\s+)?(?:my\s+)?segments?/i,
      /download\s+(?:all\s+)?segments?/i,
      /save\s+segments?\s+(?:to|as)\s+(?:csv|file)/i,
      /segments?\s+(?:to\s+)?(?:csv|excel|spreadsheet)/i,
    ],
    keywords: ['export', 'download', 'segments', 'csv', 'file'],
    priority: 9,
  },
  {
    intent: 'export_voter_file',
    patterns: [
      /(?:export|download)\s+(?:the\s+)?voter\s+file/i,
      /voter\s+(?:file|list)\s+(?:export|download)/i,
      /(?:get|pull)\s+(?:the\s+)?voter\s+(?:file|data|list)/i,
      /(?:export|download)\s+(?:all\s+)?voter\s+(?:data|records?)/i,
    ],
    keywords: ['voter', 'file', 'export', 'download', 'list'],
    priority: 9,
  },
  {
    intent: 'export_van',
    patterns: [
      /(?:sync|export)\s+(?:to|with)\s+van/i,
      /van\s+(?:sync|export|integration)/i,
      /(?:send|push)\s+(?:to\s+)?van/i,
      /(?:van|votebuilder)\s+(?:format|compatible)/i,
    ],
    keywords: ['van', 'sync', 'votebuilder', 'integration'],
    priority: 9,
  },
  {
    intent: 'export_general',
    patterns: [
      /export\s+(?:data|everything)\s+(?:to\s+)?csv/i,
      /download\s+(?:all\s+)?data/i,
      /(?:export|save)\s+(?:to|as)\s+(?:csv|excel|spreadsheet)/i,
      /get\s+(?:me\s+)?(?:a\s+)?(?:data\s+)?export/i,
    ],
    keywords: ['export', 'download', 'csv', 'data', 'excel'],
    priority: 7,
  },
  {
    intent: 'export_precincts',
    patterns: [
      /export\s+(?:all\s+)?precincts?/i,
      /download\s+precinct\s+(?:data|list|file)/i,
      /precinct\s+(?:data\s+)?(?:export|download)/i,
    ],
    keywords: ['export', 'precincts', 'download', 'data'],
    priority: 8,
  },
  {
    intent: 'export_donors',
    patterns: [
      /export\s+(?:all\s+)?donors?(?:\s+data)?/i,
      /download\s+donor\s+(?:data|list|file)/i,
      /donor\s+(?:data\s+)?(?:export|download)/i,
      /fec\s+(?:data\s+)?(?:export|download)/i,
    ],
    keywords: ['export', 'donors', 'download', 'fec', 'data'],
    priority: 8,
  },
];

// ============================================================================
// Export Format Types
// ============================================================================

interface ExportFormat {
  id: string;
  name: string;
  extension: string;
  description: string;
}

const EXPORT_FORMATS: ExportFormat[] = [
  { id: 'csv', name: 'CSV', extension: '.csv', description: 'Comma-separated values (Excel compatible)' },
  { id: 'xlsx', name: 'Excel', extension: '.xlsx', description: 'Microsoft Excel workbook' },
  { id: 'json', name: 'JSON', extension: '.json', description: 'JavaScript Object Notation' },
  { id: 'van', name: 'VAN Format', extension: '.txt', description: 'VoteBuilder/VAN compatible format' },
  { id: 'pdi', name: 'PDI Format', extension: '.txt', description: 'Political Data Inc format' },
];

// ============================================================================
// Data Export Handler Class
// ============================================================================

export class DataExportHandler implements NLPHandler {
  name = 'DataExportHandler';
  patterns = DATA_EXPORT_PATTERNS;

  canHandle(query: ParsedQuery): boolean {
    return (
      query.intent === 'export_segments' ||
      query.intent === 'export_voter_file' ||
      query.intent === 'export_van' ||
      query.intent === 'export_general' ||
      query.intent === 'export_precincts' ||
      query.intent === 'export_donors'
    );
  }

  async handle(query: ParsedQuery): Promise<HandlerResult> {
    const startTime = Date.now();

    try {
      switch (query.intent) {
        case 'export_segments':
          return await this.handleExportSegments(query, startTime);

        case 'export_voter_file':
          return await this.handleExportVoterFile(query, startTime);

        case 'export_van':
          return await this.handleExportVAN(query, startTime);

        case 'export_general':
          return await this.handleExportGeneral(query, startTime);

        case 'export_precincts':
          return await this.handleExportPrecincts(query, startTime);

        case 'export_donors':
          return await this.handleExportDonors(query, startTime);

        default:
          return {
            success: false,
            response: RESPONSE_TEMPLATES.error.parse(query.originalQuery),
            error: 'Unknown export intent',
          };
      }
    } catch (error) {
      return {
        success: false,
        response: RESPONSE_TEMPLATES.error.execution('process export request'),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async handleExportSegments(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    const response = [
      '**Export Segments:**',
      '',
      'Ready to export your segments. Choose a format:',
      '',
      '**Available Formats:**',
      ...EXPORT_FORMATS.slice(0, 3).map(f => `- **${f.name}** (${f.extension}) - ${f.description}`),
      '',
      '*Select a format to download your segment data including precinct IDs, voter counts, and targeting scores.*',
    ].join('\n');

    return {
      success: true,
      response,
      suggestedActions: [
        {
          id: 'export-csv',
          label: 'Export as CSV',
          action: 'output:exportSegments',
          metadata: { format: 'csv' },
          priority: 1,
        },
        {
          id: 'export-excel',
          label: 'Export as Excel',
          action: 'output:exportSegments',
          metadata: { format: 'xlsx' },
          priority: 2,
        },
        {
          id: 'export-van',
          label: 'Export for VAN',
          action: 'output:exportSegments',
          metadata: { format: 'van' },
          priority: 3,
        },
      ],
      data: { exportType: 'segments', formats: EXPORT_FORMATS },
      metadata: this.buildMetadata('export_segments', startTime, query),
    };
  }

  private async handleExportVoterFile(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    const response = [
      '**Export Voter File:**',
      '',
      'The voter file export includes:',
      '- All precinct data',
      '- Registered voter counts',
      '- Partisan lean scores',
      '- Targeting scores (GOTV, Swing, Persuasion)',
      '- Demographic indicators',
      '',
      '**Estimated Size:** ~5MB for Ingham County',
      '',
      '*Note: This is aggregated precinct data, not individual voter records.*',
    ].join('\n');

    return {
      success: true,
      response,
      suggestedActions: [
        {
          id: 'download-csv',
          label: 'Download CSV',
          action: 'output:exportVoterFile',
          metadata: { format: 'csv' },
          priority: 1,
        },
        {
          id: 'download-excel',
          label: 'Download Excel',
          action: 'output:exportVoterFile',
          metadata: { format: 'xlsx' },
          priority: 2,
        },
        {
          id: 'go-to-segments',
          label: 'Filter Data First',
          action: 'Navigate to /segments',
          priority: 3,
        },
      ],
      data: { exportType: 'voter_file' },
      metadata: this.buildMetadata('export_voter_file', startTime, query),
    };
  }

  private async handleExportVAN(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    const response = [
      '**VAN/VoteBuilder Export:**',
      '',
      'Export data in VAN-compatible format for:',
      '- Walk list generation',
      '- Turf cutting',
      '- Volunteer assignments',
      '',
      '**Export Options:**',
      '- **Precinct List** - Precinct IDs and metadata',
      '- **Walk List** - Door-ready format with addresses',
      '- **Turf Assignments** - Volunteer turf mappings',
      '',
      '*Requires VAN account for import. Contact your state party for access.*',
    ].join('\n');

    return {
      success: true,
      response,
      suggestedActions: [
        {
          id: 'export-precincts',
          label: 'Export Precinct List',
          action: 'output:exportVAN',
          metadata: { type: 'precincts' },
          priority: 1,
        },
        {
          id: 'export-walklist',
          label: 'Export Walk List',
          action: 'output:exportVAN',
          metadata: { type: 'walklist' },
          priority: 2,
        },
      ],
      data: { exportType: 'van' },
      metadata: this.buildMetadata('export_van', startTime, query),
    };
  }

  private async handleExportGeneral(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    const response = [
      '**Data Export Options:**',
      '',
      'What would you like to export?',
      '',
      '| Data Type | Description | Formats |',
      '|-----------|-------------|---------|',
      '| Segments | Saved voter segments | CSV, Excel |',
      '| Precincts | All precinct data | CSV, Excel, JSON |',
      '| Donors | FEC donor aggregates | CSV, Excel |',
      '| Canvass Plans | Door lists and turfs | CSV, VAN |',
      '| Reports | Analysis reports | PDF |',
      '',
      '*Select a data type to continue.*',
    ].join('\n');

    return {
      success: true,
      response,
      suggestedActions: [
        {
          id: 'export-precincts',
          label: 'Export Precincts',
          action: 'Export all precincts',
          priority: 1,
        },
        {
          id: 'export-segments',
          label: 'Export Segments',
          action: 'Export all segments',
          priority: 2,
        },
        {
          id: 'export-donors',
          label: 'Export Donors',
          action: 'Export donor data',
          priority: 3,
        },
      ],
      data: { exportType: 'general', formats: EXPORT_FORMATS },
      metadata: this.buildMetadata('export_general', startTime, query),
    };
  }

  private async handleExportPrecincts(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    const response = [
      '**Export Precinct Data:**',
      '',
      'Exporting all Ingham County precincts with:',
      '',
      '**Included Fields:**',
      '- Precinct ID and name',
      '- Jurisdiction',
      '- Registered voters',
      '- Partisan lean (D+ / R+)',
      '- GOTV Priority score',
      '- Swing Potential score',
      '- Persuasion Opportunity score',
      '- Density classification',
      '- District assignments (Congressional, State Senate, State House)',
      '',
      '**Records:** 120 precincts',
    ].join('\n');

    return {
      success: true,
      response,
      suggestedActions: [
        {
          id: 'download-csv',
          label: 'Download CSV',
          action: 'output:exportPrecincts',
          metadata: { format: 'csv' },
          priority: 1,
        },
        {
          id: 'download-excel',
          label: 'Download Excel',
          action: 'output:exportPrecincts',
          metadata: { format: 'xlsx' },
          priority: 2,
        },
      ],
      data: { exportType: 'precincts', recordCount: 120 },
      metadata: this.buildMetadata('export_precincts', startTime, query),
    };
  }

  private async handleExportDonors(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    const response = [
      '**Export Donor Data:**',
      '',
      'Exporting FEC donor aggregates for Ingham County:',
      '',
      '**Included Fields:**',
      '- ZIP code',
      '- City',
      '- Total amount raised',
      '- Donor count',
      '- Average contribution',
      '- Top occupation categories',
      '',
      '**Data Source:** FEC bulk data (2023-24 cycle)',
      '',
      '*Note: Individual donor records require separate FEC access.*',
    ].join('\n');

    return {
      success: true,
      response,
      suggestedActions: [
        {
          id: 'download-csv',
          label: 'Download CSV',
          action: 'output:exportDonors',
          metadata: { format: 'csv' },
          priority: 1,
        },
        {
          id: 'download-excel',
          label: 'Download Excel',
          action: 'output:exportDonors',
          metadata: { format: 'xlsx' },
          priority: 2,
        },
        {
          id: 'view-heatmap',
          label: 'View Donor Heatmap',
          action: 'Show donor concentration map',
          priority: 3,
        },
      ],
      data: { exportType: 'donors' },
      metadata: this.buildMetadata('export_donors', startTime, query),
    };
  }

  extractEntities(query: string): ExtractedEntities {
    return {};
  }

  private buildMetadata(intent: string, startTime: number, query: ParsedQuery): any {
    return {
      handlerName: this.name,
      processingTimeMs: Date.now() - startTime,
      queryType: 'export',
      matchedIntent: intent,
      confidence: query.confidence,
    };
  }
}

export const dataExportHandler = new DataExportHandler();
export default DataExportHandler;
