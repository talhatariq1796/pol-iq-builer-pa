/**
 * Segment Exporter
 *
 * Exports segmentation results to various formats (CSV, JSON).
 * Produces files suitable for analysis, reporting, and integration.
 */

import {
  ExportFormat,
  ExportResult,
  SegmentExportRow,
  SegmentExportOptions,
} from './types';
import type { SegmentResults, PrecinctMatch } from '@/lib/segmentation/types';

// ============================================================================
// Segment Exporter Class
// ============================================================================

export class SegmentExporter {
  private static instance: SegmentExporter;

  private constructor() {}

  static getInstance(): SegmentExporter {
    if (!SegmentExporter.instance) {
      SegmentExporter.instance = new SegmentExporter();
    }
    return SegmentExporter.instance;
  }

  // --------------------------------------------------------------------------
  // Public Methods
  // --------------------------------------------------------------------------

  /**
   * Export segment results to specified format
   */
  async export(
    results: SegmentResults,
    options: SegmentExportOptions
  ): Promise<ExportResult> {
    const { format, segmentName, segmentId } = options;
    const timestamp = new Date().toISOString();
    const filename =
      options.filename ||
      `segment_${this.sanitizeFilename(segmentName)}_${this.formatDate(timestamp)}.${format}`;

    try {
      const rows = this.transformToExportRows(results, segmentName, timestamp);

      let content: string;
      let mimeType: string;

      switch (format) {
        case 'csv':
          content = this.toCSV(rows, options);
          mimeType = 'text/csv';
          break;
        case 'json':
          content = this.toJSON(rows, results, segmentName, timestamp);
          mimeType = 'application/json';
          break;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      // In browser, trigger download
      if (typeof window !== 'undefined') {
        this.downloadFile(content, filename, mimeType);
      }

      return {
        success: true,
        filename,
        format,
        rowCount: rows.length,
        fileSize: new Blob([content]).size,
      };
    } catch (error) {
      return {
        success: false,
        filename,
        format,
        rowCount: 0,
        error: error instanceof Error ? error.message : 'Export failed',
      };
    }
  }

  /**
   * Generate CSV content without downloading
   */
  toCSVString(results: SegmentResults, segmentName: string): string {
    const timestamp = new Date().toISOString();
    const rows = this.transformToExportRows(results, segmentName, timestamp);
    return this.toCSV(rows, { format: 'csv', segmentId: '', segmentName });
  }

  /**
   * Generate JSON content without downloading
   */
  toJSONString(results: SegmentResults, segmentName: string): string {
    const timestamp = new Date().toISOString();
    const rows = this.transformToExportRows(results, segmentName, timestamp);
    return this.toJSON(rows, results, segmentName, timestamp);
  }

  // --------------------------------------------------------------------------
  // Transform Methods
  // --------------------------------------------------------------------------

  private transformToExportRows(
    results: SegmentResults,
    segmentName: string,
    timestamp: string
  ): SegmentExportRow[] {
    return results.matchingPrecincts.map((precinct) =>
      this.precinctToExportRow(precinct, segmentName, timestamp)
    );
  }

  private precinctToExportRow(
    precinct: PrecinctMatch,
    segmentName: string,
    timestamp: string
  ): SegmentExportRow {
    return {
      precinct_id: precinct.precinctId,
      precinct_name: precinct.precinctName,
      jurisdiction: precinct.jurisdiction,
      jurisdiction_type: this.inferJurisdictionType(precinct.jurisdiction),
      county: 'Ingham', // MVP: Ingham County only
      registered_voters: precinct.registeredVoters,
      estimated_vap: Math.round(precinct.registeredVoters * 0.85), // Estimate
      gotv_priority: Math.round(precinct.gotvPriority),
      persuasion_opportunity: Math.round(precinct.persuasionOpportunity),
      swing_potential: Math.round(precinct.swingPotential),
      targeting_strategy: precinct.targetingStrategy,
      partisan_lean: Math.round(precinct.partisanLean),
      competitiveness: this.leanToCompetitiveness(precinct.partisanLean),
      avg_turnout: 0, // Would need full precinct data
      median_age: 0, // Would need full precinct data
      median_income: 0, // Would need full precinct data
      density_type: this.inferDensityType(precinct.jurisdiction),
      match_score: Math.round(precinct.matchScore),
      segment_name: segmentName,
      exported_at: timestamp,
    };
  }

  // --------------------------------------------------------------------------
  // Format Methods
  // --------------------------------------------------------------------------

  private toCSV(rows: SegmentExportRow[], options: SegmentExportOptions): string {
    const delimiter = options.delimiter || ',';
    const includeHeaders = options.includeHeaders !== false;

    const headers = [
      'precinct_id',
      'precinct_name',
      'jurisdiction',
      'jurisdiction_type',
      'county',
      'registered_voters',
      'estimated_vap',
      'gotv_priority',
      'persuasion_opportunity',
      'swing_potential',
      'targeting_strategy',
      'partisan_lean',
      'competitiveness',
      'avg_turnout',
      'median_age',
      'median_income',
      'density_type',
      'match_score',
      'segment_name',
      'exported_at',
    ];

    const lines: string[] = [];

    if (includeHeaders) {
      lines.push(headers.join(delimiter));
    }

    for (const row of rows) {
      const values = headers.map((header) => {
        const value = row[header as keyof SegmentExportRow];
        // Escape values with delimiter or quotes
        if (typeof value === 'string' && (value.includes(delimiter) || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return String(value ?? '');
      });
      lines.push(values.join(delimiter));
    }

    return lines.join('\n');
  }

  private toJSON(
    rows: SegmentExportRow[],
    results: SegmentResults,
    segmentName: string,
    timestamp: string
  ): string {
    const exportData = {
      metadata: {
        segmentName,
        exportedAt: timestamp,
        totalPrecincts: results.precinctCount,
        totalVoters: results.estimatedVoters,
        averageScores: {
          gotv: results.avgGOTV,
          persuasion: results.avgPersuasion,
          partisanLean: results.avgPartisanLean,
          turnout: results.avgTurnout,
        },
        strategyBreakdown: results.strategyBreakdown,
      },
      precincts: rows,
    };

    return JSON.stringify(exportData, null, 2);
  }

  // --------------------------------------------------------------------------
  // Utility Methods
  // --------------------------------------------------------------------------

  private inferJurisdictionType(jurisdiction: string): string {
    const lower = jurisdiction.toLowerCase();
    if (lower.includes('city') || lower.includes('lansing')) {
      return 'city';
    }
    if (lower.includes('township') || lower.includes('twp')) {
      return 'township';
    }
    return 'other';
  }

  private inferDensityType(jurisdiction: string): string {
    const lower = jurisdiction.toLowerCase();
    if (lower.includes('lansing') || lower.includes('east lansing')) {
      return 'urban';
    }
    if (
      lower.includes('meridian') ||
      lower.includes('delhi') ||
      lower.includes('okemos')
    ) {
      return 'suburban';
    }
    return 'rural';
  }

  private leanToCompetitiveness(lean: number): string {
    const absLean = Math.abs(lean);
    const party = lean < 0 ? 'd' : 'r';

    if (absLean > 20) return `safe_${party}`;
    if (absLean > 10) return `likely_${party}`;
    if (absLean > 5) return `lean_${party}`;
    return 'toss_up';
  }

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
// Singleton Export
// ============================================================================

export const segmentExporter = SegmentExporter.getInstance();

export default SegmentExporter;
