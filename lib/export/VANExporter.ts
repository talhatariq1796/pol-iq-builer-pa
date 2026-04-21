/**
 * VAN Exporter
 *
 * Exports political data to VAN-compatible CSV formats.
 * Supports precinct-level targeting data for import into NGP VAN/EveryAction.
 *
 * Note: This exports precinct-level aggregate data, not individual voter records.
 * VAN import would match precincts to voters within VAN.
 */

import {
  ExportFormat,
  ExportResult,
  VANExportRow,
  VANExportOptions,
  DEFAULT_VAN_FIELD_MAPPING,
  VANFieldMapping,
} from './types';
import type { PrecinctMatch, SegmentResults } from '@/lib/segmentation/types';
import type { CanvassingUniverse, CanvassingPrecinct } from '@/lib/canvassing/types';

// ============================================================================
// VAN Exporter Class
// ============================================================================

export class VANExporter {
  private static instance: VANExporter;
  private fieldMapping: VANFieldMapping[];

  private constructor() {
    this.fieldMapping = DEFAULT_VAN_FIELD_MAPPING;
  }

  static getInstance(): VANExporter {
    if (!VANExporter.instance) {
      VANExporter.instance = new VANExporter();
    }
    return VANExporter.instance;
  }

  // --------------------------------------------------------------------------
  // Public Methods
  // --------------------------------------------------------------------------

  /**
   * Export segment to VAN-compatible CSV
   */
  async exportSegment(
    results: SegmentResults,
    segmentName: string,
    options: VANExportOptions
  ): Promise<ExportResult> {
    const timestamp = new Date().toISOString();
    const filename =
      options.filename ||
      `van_segment_${this.sanitizeFilename(segmentName)}_${this.formatDate(timestamp)}.csv`;

    try {
      const rows = results.matchingPrecincts.map((precinct, index) =>
        this.precinctToVANRow(precinct, {
          segmentCode: segmentName,
          priorityRank: index + 1,
          timestamp,
        })
      );

      const content = this.toVANCSV(rows, options);

      if (typeof window !== 'undefined') {
        this.downloadFile(content, filename, 'text/csv');
      }

      return {
        success: true,
        filename,
        format: 'csv',
        rowCount: rows.length,
        fileSize: new Blob([content]).size,
      };
    } catch (error) {
      return {
        success: false,
        filename,
        format: 'csv',
        rowCount: 0,
        error: error instanceof Error ? error.message : 'VAN export failed',
      };
    }
  }

  /**
   * Export canvassing universe to VAN-compatible CSV
   */
  async exportUniverse(
    universe: CanvassingUniverse,
    options: VANExportOptions
  ): Promise<ExportResult> {
    const timestamp = new Date().toISOString();
    const filename =
      options.filename ||
      `van_universe_${this.sanitizeFilename(universe.name)}_${this.formatDate(timestamp)}.csv`;

    try {
      const rows = universe.precincts.map((precinct) =>
        this.canvassingPrecinctToVANRow(precinct, {
          segmentCode: universe.name,
          timestamp,
        })
      );

      const content = this.toVANCSV(rows, options);

      if (typeof window !== 'undefined') {
        this.downloadFile(content, filename, 'text/csv');
      }

      return {
        success: true,
        filename,
        format: 'csv',
        rowCount: rows.length,
        fileSize: new Blob([content]).size,
      };
    } catch (error) {
      return {
        success: false,
        filename,
        format: 'csv',
        rowCount: 0,
        error: error instanceof Error ? error.message : 'VAN export failed',
      };
    }
  }

  /**
   * Generate VAN-compatible CSV content without downloading
   */
  toCSVString(
    precincts: PrecinctMatch[],
    segmentName: string,
    options?: Partial<VANExportOptions>
  ): string {
    const timestamp = new Date().toISOString();
    const rows = precincts.map((precinct, index) =>
      this.precinctToVANRow(precinct, {
        segmentCode: segmentName,
        priorityRank: index + 1,
        timestamp,
      })
    );

    return this.toVANCSV(rows, {
      format: 'csv',
      ...options,
    });
  }

  /**
   * Set custom field mapping
   */
  setFieldMapping(mapping: VANFieldMapping[]): void {
    this.fieldMapping = mapping;
  }

  /**
   * Get current field mapping
   */
  getFieldMapping(): VANFieldMapping[] {
    return [...this.fieldMapping];
  }

  /**
   * Validate VAN export format
   */
  validateExport(rows: VANExportRow[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (rows.length === 0) {
      errors.push('No rows to export');
      return { valid: false, errors };
    }

    // Check required fields
    const requiredFields = this.fieldMapping.filter((f) => f.required).map((f) => f.target);

    for (const field of requiredFields) {
      const missing = rows.filter(
        (row) => !row[field as keyof VANExportRow]
      );
      if (missing.length > 0) {
        errors.push(`Missing required field '${field}' in ${missing.length} rows`);
      }
    }

    // Check score ranges
    for (const row of rows) {
      if (row.GOTVPriority < 0 || row.GOTVPriority > 100) {
        errors.push(`Invalid GOTVPriority value: ${row.GOTVPriority}`);
      }
      if (row.PersuasionScore < 0 || row.PersuasionScore > 100) {
        errors.push(`Invalid PersuasionScore value: ${row.PersuasionScore}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  // --------------------------------------------------------------------------
  // Transform Methods
  // --------------------------------------------------------------------------

  private precinctToVANRow(
    precinct: PrecinctMatch,
    context: { segmentCode: string; priorityRank: number; timestamp: string }
  ): VANExportRow {
    return {
      ExternalID: precinct.precinctId,
      PrecinctID: precinct.precinctId,
      PrecinctName: precinct.precinctName,
      Jurisdiction: precinct.jurisdiction,
      County: 'Ingham', // MVP: Ingham County only
      State: 'MI',
      GOTVPriority: Math.round(precinct.gotvPriority),
      PersuasionScore: Math.round(precinct.persuasionOpportunity),
      SwingPotential: Math.round(precinct.swingPotential),
      PartisanLean: Math.round(precinct.partisanLean),
      TurnoutLikelihood: 70, // Default, would come from full precinct data
      TargetingStrategy: precinct.targetingStrategy,
      SegmentCode: context.segmentCode,
      PriorityRank: context.priorityRank,
      SourceSystem: 'PoliticalLandscapeAnalysis',
      ExportDate: context.timestamp,
      DataVersion: '1.0',
    };
  }

  private canvassingPrecinctToVANRow(
    precinct: CanvassingPrecinct,
    context: { segmentCode: string; timestamp: string }
  ): VANExportRow {
    return {
      ExternalID: precinct.precinctId,
      PrecinctID: precinct.precinctId,
      PrecinctName: precinct.precinctName,
      Jurisdiction: precinct.jurisdiction,
      County: 'Ingham',
      State: 'MI',
      GOTVPriority: Math.round(precinct.gotvPriority),
      PersuasionScore: Math.round(precinct.persuasionOpportunity),
      SwingPotential: Math.round(precinct.swingPotential),
      PartisanLean: 0, // Not available in CanvassingPrecinct
      TurnoutLikelihood: 70,
      TargetingStrategy: precinct.targetingStrategy,
      SegmentCode: context.segmentCode,
      TurfID: `T${String(precinct.priorityRank).padStart(4, '0')}`,
      PriorityRank: precinct.priorityRank,
      SourceSystem: 'PoliticalLandscapeAnalysis',
      ExportDate: context.timestamp,
      DataVersion: '1.0',
    };
  }

  // --------------------------------------------------------------------------
  // Format Methods
  // --------------------------------------------------------------------------

  private toVANCSV(rows: VANExportRow[], options: VANExportOptions): string {
    const includeScores = options.includeScores !== false;
    const includeTargeting = options.includeTargeting !== false;
    const includeMetadata = options.includeMetadata !== false;

    // Build headers based on options
    const headers: (keyof VANExportRow)[] = [
      'ExternalID',
      'PrecinctID',
      'PrecinctName',
      'Jurisdiction',
      'County',
      'State',
    ];

    if (includeScores) {
      headers.push(
        'GOTVPriority',
        'PersuasionScore',
        'SwingPotential',
        'PartisanLean',
        'TurnoutLikelihood'
      );
    }

    if (includeTargeting) {
      headers.push('TargetingStrategy', 'SegmentCode', 'TurfID', 'PriorityRank');
    }

    if (includeMetadata) {
      headers.push('SourceSystem', 'ExportDate', 'DataVersion');
    }

    // Apply custom field mapping if provided
    const mappedHeaders = options.vanFieldMapping
      ? headers.map((h) => options.vanFieldMapping?.[h] || h)
      : headers;

    const lines = [mappedHeaders.join(',')];

    for (const row of rows) {
      const values = headers.map((header) => {
        const value = row[header];
        if (value === undefined || value === null) return '';
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return String(value);
      });
      lines.push(values.join(','));
    }

    return lines.join('\n');
  }

  // --------------------------------------------------------------------------
  // Utility Methods
  // --------------------------------------------------------------------------

  private sanitizeFilename(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 50);
  }

  private formatDate(isoString: string): string {
    const date = new Date(isoString);
    return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  }

  private downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

// ============================================================================
// VAN Import Preparation Utility
// ============================================================================

/**
 * Generates documentation for importing data into VAN
 */
export function generateVANImportInstructions(filename: string): string {
  return `
# VAN Import Instructions for ${filename}

## Overview
This CSV file contains precinct-level targeting data from Political Landscape Analysis.
It can be imported into NGP VAN as a custom data overlay.

## Import Steps

1. Log into VAN/VoteBuilder
2. Navigate to Admin → Data Management → Custom Data Import
3. Select "Precinct-Level Import"
4. Upload the CSV file
5. Map fields:
   - ExternalID → Your precinct identifier field
   - GOTVPriority → Custom GOTV Score field
   - PersuasionScore → Custom Persuasion Score field
   - TargetingStrategy → Custom Segment field
   - PriorityRank → Custom Priority field

## Field Definitions

| Field | Description | Range |
|-------|-------------|-------|
| GOTVPriority | GOTV mobilization priority | 0-100 |
| PersuasionScore | Persuasion opportunity score | 0-100 |
| SwingPotential | Likelihood of changing party | 0-100 |
| PartisanLean | Partisan lean (-100 Dem to +100 Rep) | -100 to +100 |
| TargetingStrategy | Primary targeting approach | base_mobilization, persuasion_target, battleground, low_priority |

## Notes
- Data is precinct-level aggregates, not individual voter records
- Scores are calculated from historical election data and demographics
- Export date: ${new Date().toISOString()}
- Source: Political Landscape Analysis Platform
`.trim();
}

// ============================================================================
// Singleton Export
// ============================================================================

export const vanExporter = VANExporter.getInstance();

export default VANExporter;
