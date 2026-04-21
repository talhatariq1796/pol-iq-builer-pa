/**
 * Report NLP Handler
 *
 * Translates natural language report queries into PDF generation operations.
 * Supports queries like:
 * - "Generate a political profile for East Lansing"
 * - "Create a comparison report for Lansing vs Mason"
 * - "Build a campaign briefing for the swing precincts"
 */

import type {
  NLPHandler,
  ParsedQuery,
  HandlerResult,
  QueryPattern,
  ExtractedEntities,
} from './types';
import { RESPONSE_TEMPLATES, getEnrichmentForQuery, formatEnrichmentSections } from './types';

// ============================================================================
// Query Patterns
// ============================================================================

const REPORT_PATTERNS: QueryPattern[] = [
  {
    intent: 'report_generate',
    patterns: [
      /generate\s+(?:a\s+)?(?:political\s+)?(?:profile|report)/i,
      /create\s+(?:a\s+)?(?:political\s+)?(?:profile|report)/i,
      /build\s+(?:a\s+)?(?:campaign\s+)?(?:briefing|report)/i,
      /make\s+(?:a\s+)?report/i,
      /(?:pdf|document)\s+(?:for|of)/i,
    ],
    keywords: ['generate', 'create', 'build', 'make', 'report', 'profile', 'briefing', 'pdf'],
    priority: 10,
  },
  {
    intent: 'report_preview',
    patterns: [
      /preview\s+(?:the\s+)?report/i,
      /show\s+(?:me\s+)?(?:the\s+)?report\s+preview/i,
      /what\s+(?:would|will)\s+(?:the\s+)?report\s+(?:look|include)/i,
    ],
    keywords: ['preview', 'show', 'report'],
    priority: 8,
  },
];

// ============================================================================
// Report Types
// ============================================================================

type ReportType = 'profile' | 'comparison' | 'briefing' | 'canvass' | 'donor' | 'segment';

interface ReportSection {
  id: string;
  name: string;
  description: string;
  included: boolean;
}

const REPORT_SECTIONS: Record<ReportType, ReportSection[]> = {
  profile: [
    { id: 'summary', name: 'Executive Summary', description: 'Overview and key metrics', included: true },
    { id: 'demographics', name: 'Demographics', description: 'Population, age, income breakdown', included: true },
    { id: 'political', name: 'Political Profile', description: 'Partisan lean, registration, ideology', included: true },
    { id: 'electoral', name: 'Electoral History', description: 'Past election results and trends', included: true },
    { id: 'targeting', name: 'Targeting Scores', description: 'GOTV, Persuasion, Swing scores', included: true },
    { id: 'tapestry', name: 'Lifestyle Segments', description: 'Tapestry segmentation breakdown', included: true },
    { id: 'recommendations', name: 'Strategic Recommendations', description: 'Suggested campaign actions', included: true },
  ],
  comparison: [
    { id: 'summary', name: 'Comparison Overview', description: 'Side-by-side key metrics', included: true },
    { id: 'demographics', name: 'Demographic Comparison', description: 'Population differences', included: true },
    { id: 'political', name: 'Political Comparison', description: 'Partisan and ideological differences', included: true },
    { id: 'targeting', name: 'Targeting Comparison', description: 'Score comparisons', included: true },
    { id: 'insights', name: 'Strategic Insights', description: 'AI-generated comparison insights', included: true },
  ],
  briefing: [
    { id: 'executive', name: 'Executive Summary', description: 'Quick overview for leadership', included: true },
    { id: 'landscape', name: 'Political Landscape', description: 'Current state of play', included: true },
    { id: 'targets', name: 'Target Areas', description: 'Priority precincts and voters', included: true },
    { id: 'strategy', name: 'Recommended Strategy', description: 'Tactical recommendations', included: true },
    { id: 'timeline', name: 'Action Timeline', description: 'Key dates and milestones', included: true },
  ],
  canvass: [
    { id: 'overview', name: 'Operation Overview', description: 'Doors, turfs, staffing', included: true },
    { id: 'precincts', name: 'Precinct Breakdown', description: 'Priority-ranked list', included: true },
    { id: 'staffing', name: 'Staffing Plan', description: 'Volunteer requirements', included: true },
    { id: 'timeline', name: 'Execution Timeline', description: 'Daily/weekly schedule', included: true },
    { id: 'turfsheet', name: 'Turf Assignments', description: 'Individual turf details', included: false },
  ],
  donor: [
    { id: 'summary', name: 'Fundraising Summary', description: 'Total raised, donor count', included: true },
    { id: 'concentration', name: 'Geographic Concentration', description: 'Top ZIP codes', included: true },
    { id: 'segments', name: 'Donor Segments', description: 'RFM segmentation', included: true },
    { id: 'prospects', name: 'Prospect Areas', description: 'Untapped potential', included: true },
    { id: 'trends', name: 'Giving Trends', description: 'Time series analysis', included: true },
  ],
  segment: [
    { id: 'definition', name: 'Segment Definition', description: 'Filters and criteria', included: true },
    { id: 'summary', name: 'Segment Summary', description: 'Size and key metrics', included: true },
    { id: 'precincts', name: 'Precinct List', description: 'Matching precincts', included: true },
    { id: 'demographics', name: 'Demographic Profile', description: 'Aggregate demographics', included: true },
    { id: 'recommendations', name: 'Strategic Actions', description: 'Suggested next steps', included: true },
  ],
};

// ============================================================================
// Entity Extraction Patterns
// ============================================================================

const JURISDICTION_PATTERNS = [
  /(?:for|of)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/,
  /\b(lansing|east\s+lansing|meridian|delhi|williamston|mason|okemos)/i,
];

const COMPARISON_PATTERN = /(\w+(?:\s+\w+)?)\s+(?:vs|versus|compared\s+to|and)\s+(\w+(?:\s+\w+)?)/i;

const REPORT_TYPE_PATTERNS: Record<ReportType, RegExp> = {
  profile: /\b(profile|overview|analysis)\b/i,
  comparison: /\b(comparison|compare|vs|versus)\b/i,
  briefing: /\b(briefing|brief|campaign\s+(?:memo|summary))\b/i,
  canvass: /\b(canvass(?:ing)?|walk\s+list|turf|door)\b/i,
  donor: /\b(donor|fundrais(?:ing|er)|contribution|giving)\b/i,
  segment: /\b(segment(?:ation)?|target\s+(?:list|audience))\b/i,
};

// ============================================================================
// Report Handler Class
// ============================================================================

export class ReportHandler implements NLPHandler {
  name = 'ReportHandler';
  patterns = REPORT_PATTERNS;

  // --------------------------------------------------------------------------
  // Interface Methods
  // --------------------------------------------------------------------------

  canHandle(query: ParsedQuery): boolean {
    return query.intent === 'report_generate' || query.intent === 'report_preview';
  }

  async handle(query: ParsedQuery): Promise<HandlerResult> {
    const startTime = Date.now();

    try {
      switch (query.intent) {
        case 'report_generate':
          return await this.handleGenerate(query, startTime);

        case 'report_preview':
          return await this.handlePreview(query, startTime);

        default:
          return {
            success: false,
            response: RESPONSE_TEMPLATES.error.parse(query.originalQuery),
            error: 'Unknown report intent',
          };
      }
    } catch (error) {
      return {
        success: false,
        response: RESPONSE_TEMPLATES.error.execution('generate report'),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // --------------------------------------------------------------------------
  // Query Handlers
  // --------------------------------------------------------------------------

  private async handleGenerate(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    const entities = this.extractEntities(query.originalQuery);
    const reportType = this.detectReportType(query.originalQuery);
    const sections = REPORT_SECTIONS[reportType];

    // Determine subject
    let subject: string;
    if (entities.comparisonAreas && entities.comparisonAreas.length === 2) {
      subject = `${entities.comparisonAreas[0]} vs ${entities.comparisonAreas[1]}`;
    } else if (entities.jurisdictions && entities.jurisdictions.length > 0) {
      subject = entities.jurisdictions[0];
    } else if (entities.segmentName) {
      subject = entities.segmentName;
    } else {
      subject = 'Ingham County';
    }

    const reportName = this.generateReportName(reportType, subject);
    const sectionCount = sections.filter((s) => s.included).length;

    const response = this.formatGenerateResponse(reportType, subject, reportName, sectionCount);

    // Get enrichment context (RAG + Knowledge Graph)
    const enrichment = await getEnrichmentForQuery(query.originalQuery);
    const enrichmentSections = formatEnrichmentSections(enrichment);

    return {
      success: true,
      response: response + enrichmentSections,
      suggestedActions: [
        {
          id: 'download-pdf',
          label: 'Download PDF',
          description: 'Save report as PDF',
          action: 'download_pdf',
          params: { reportType, subject },
          priority: 1,
        },
        {
          id: 'download-docx',
          label: 'Download Word',
          description: 'Save as editable document',
          action: 'download_docx',
          priority: 2,
        },
        {
          id: 'customize-sections',
          label: 'Customize Sections',
          description: 'Add or remove sections',
          action: 'customize_report',
          priority: 3,
        },
        {
          id: 'share-report',
          label: 'Share Report',
          description: 'Send to team members',
          action: 'share_report',
          priority: 4,
        },
      ],
      data: {
        reportType,
        subject,
        reportName,
        sections: sections.filter((s) => s.included),
        format: 'pdf',
      },
      metadata: this.buildMetadata('report_generate', startTime, query),
    };
  }

  private async handlePreview(
    query: ParsedQuery,
    startTime: number
  ): Promise<HandlerResult> {
    const entities = this.extractEntities(query.originalQuery);
    const reportType = this.detectReportType(query.originalQuery);
    const sections = REPORT_SECTIONS[reportType];

    const response = this.formatPreviewResponse(reportType, sections);

    // Get enrichment context (RAG + Knowledge Graph)
    const enrichment = await getEnrichmentForQuery(query.originalQuery);
    const enrichmentSections = formatEnrichmentSections(enrichment);

    return {
      success: true,
      response: response + enrichmentSections,
      suggestedActions: [
        {
          id: 'generate-now',
          label: 'Generate Report',
          description: 'Create the report now',
          action: 'generate_report',
          priority: 1,
        },
        {
          id: 'toggle-sections',
          label: 'Toggle Sections',
          description: 'Include/exclude sections',
          action: 'toggle_sections',
          priority: 2,
        },
      ],
      data: {
        reportType,
        sections,
      },
      metadata: this.buildMetadata('report_preview', startTime, query),
    };
  }

  // --------------------------------------------------------------------------
  // Entity Extraction
  // --------------------------------------------------------------------------

  extractEntities(query: string): ExtractedEntities {
    const entities: ExtractedEntities = {};

    // Check for comparison
    const compMatch = query.match(COMPARISON_PATTERN);
    if (compMatch) {
      (entities as any).comparisonAreas = [compMatch[1].trim(), compMatch[2].trim()];
    }

    // Extract jurisdictions
    for (const pattern of JURISDICTION_PATTERNS) {
      const match = query.match(pattern);
      if (match) {
        if (!entities.jurisdictions) entities.jurisdictions = [];
        entities.jurisdictions.push(match[1].trim());
      }
    }

    // Check for segment reference
    const segmentMatch = query.match(/(?:for|of)\s+(?:the\s+)?["']?([^"']+)["']?\s+segment/i);
    if (segmentMatch) {
      entities.segmentName = segmentMatch[1].trim();
    }

    // Check for report format
    if (/\bpdf\b/i.test(query)) {
      entities.format = 'pdf';
    } else if (/\b(docx?|word)\b/i.test(query)) {
      entities.format = 'docx';
    }

    return entities;
  }

  // --------------------------------------------------------------------------
  // Report Type Detection
  // --------------------------------------------------------------------------

  private detectReportType(query: string): ReportType {
    // Check each report type pattern
    for (const [type, pattern] of Object.entries(REPORT_TYPE_PATTERNS)) {
      if (pattern.test(query)) {
        return type as ReportType;
      }
    }

    // Check for comparison keywords
    if (COMPARISON_PATTERN.test(query)) {
      return 'comparison';
    }

    // Default to profile
    return 'profile';
  }

  // --------------------------------------------------------------------------
  // Response Formatting
  // --------------------------------------------------------------------------

  private formatGenerateResponse(
    type: ReportType,
    subject: string,
    reportName: string,
    sectionCount: number
  ): string {
    const typeNames: Record<ReportType, string> = {
      profile: 'Political Profile',
      comparison: 'Comparison Report',
      briefing: 'Campaign Briefing',
      canvass: 'Canvassing Report',
      donor: 'Donor Analysis',
      segment: 'Segment Report',
    };

    const lines = [
      `**Generating ${typeNames[type]} for ${subject}**`,
      '',
      `Report: **${reportName}**`,
      `Sections: ${sectionCount}`,
      '',
      '**Included Sections:**',
    ];

    const sections = REPORT_SECTIONS[type].filter((s) => s.included);
    sections.forEach((s, i) => {
      lines.push(`${i + 1}. ${s.name} - ${s.description}`);
    });

    lines.push('');
    lines.push('*Report will be generated as PDF*');

    return lines.join('\n');
  }

  private formatPreviewResponse(type: ReportType, sections: ReportSection[]): string {
    const lines = [
      `**Report Preview - ${type.charAt(0).toUpperCase() + type.slice(1)} Report**`,
      '',
      '**Available Sections:**',
    ];

    sections.forEach((s) => {
      const status = s.included ? '✅' : '⬜';
      lines.push(`${status} **${s.name}** - ${s.description}`);
    });

    lines.push('');
    lines.push('*Toggle sections using "Customize Sections" or generate now*');

    return lines.join('\n');
  }

  private generateReportName(type: ReportType, subject: string): string {
    const date = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    const typeLabels: Record<ReportType, string> = {
      profile: 'Political Profile',
      comparison: 'Comparison',
      briefing: 'Campaign Briefing',
      canvass: 'Canvass Plan',
      donor: 'Donor Analysis',
      segment: 'Segment Analysis',
    };

    return `${typeLabels[type]} - ${subject} - ${date}`;
  }

  // --------------------------------------------------------------------------
  // Metadata
  // --------------------------------------------------------------------------

  private buildMetadata(intent: string, startTime: number, query: ParsedQuery): any {
    return {
      handlerName: this.name,
      processingTimeMs: Date.now() - startTime,
      queryType: 'report',
      matchedIntent: intent,
      confidence: query.confidence,
    };
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const reportHandler = new ReportHandler();

export default ReportHandler;
