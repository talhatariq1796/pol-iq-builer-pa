/**
 * Canvass Exporter
 *
 * Exports canvassing universes to walk list formats.
 * Produces files suitable for field operations and volunteer coordination.
 */

import {
  ExportFormat,
  ExportResult,
  WalkListRow,
  CanvassExportOptions,
  CanvassSummaryExport,
} from './types';
import type {
  CanvassingUniverse,
  CanvassingPrecinct,
  CanvassSummary,
} from '@/lib/canvassing/types';

// ============================================================================
// Canvass Exporter Class
// ============================================================================

export class CanvassExporter {
  private static instance: CanvassExporter;

  private constructor() {}

  static getInstance(): CanvassExporter {
    if (!CanvassExporter.instance) {
      CanvassExporter.instance = new CanvassExporter();
    }
    return CanvassExporter.instance;
  }

  // --------------------------------------------------------------------------
  // Public Methods
  // --------------------------------------------------------------------------

  /**
   * Export canvassing universe to walk list format
   */
  async exportWalkList(
    universe: CanvassingUniverse,
    options: CanvassExportOptions
  ): Promise<ExportResult> {
    const { format, universeName } = options;
    const timestamp = new Date().toISOString();
    const filename =
      options.filename ||
      `walklist_${this.sanitizeFilename(universeName)}_${this.formatDate(timestamp)}.${format}`;

    try {
      const rows = this.transformToWalkListRows(universe, timestamp);

      // Sort if specified
      if (options.sortBy) {
        this.sortRows(rows, options.sortBy);
      }

      let content: string;
      let mimeType: string;

      switch (format) {
        case 'csv':
          content = this.toCSV(rows, options);
          mimeType = 'text/csv';
          break;
        case 'json':
          content = this.toJSON(rows, universe, timestamp);
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
   * Export canvass summary for reporting
   */
  async exportSummary(
    summary: CanvassSummary,
    options: Omit<CanvassExportOptions, 'universeId'>
  ): Promise<ExportResult> {
    const { format, universeName } = options;
    const timestamp = new Date().toISOString();
    const filename =
      options.filename ||
      `canvass_summary_${this.sanitizeFilename(universeName)}_${this.formatDate(timestamp)}.${format}`;

    try {
      const summaryExport = this.transformToSummaryExport(summary);

      let content: string;
      let mimeType: string;

      switch (format) {
        case 'csv':
          content = this.summaryToCSV(summaryExport);
          mimeType = 'text/csv';
          break;
        case 'json':
          content = JSON.stringify(summary, null, 2);
          mimeType = 'application/json';
          break;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      if (typeof window !== 'undefined') {
        this.downloadFile(content, filename, mimeType);
      }

      return {
        success: true,
        filename,
        format,
        rowCount: 1,
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
   * Export turf assignments for volunteer coordination
   */
  async exportTurfAssignments(
    universe: CanvassingUniverse,
    options: CanvassExportOptions
  ): Promise<ExportResult> {
    const { format, universeName } = options;
    const timestamp = new Date().toISOString();
    const filename =
      options.filename ||
      `turfs_${this.sanitizeFilename(universeName)}_${this.formatDate(timestamp)}.${format}`;

    try {
      const turfs = this.generateTurfAssignments(universe);

      let content: string;
      let mimeType: string;

      switch (format) {
        case 'csv':
          content = this.turfsToCSV(turfs);
          mimeType = 'text/csv';
          break;
        case 'json':
          content = JSON.stringify({ turfs, universeName, exportedAt: timestamp }, null, 2);
          mimeType = 'application/json';
          break;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      if (typeof window !== 'undefined') {
        this.downloadFile(content, filename, mimeType);
      }

      return {
        success: true,
        filename,
        format,
        rowCount: turfs.length,
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
  toCSVString(universe: CanvassingUniverse): string {
    const timestamp = new Date().toISOString();
    const rows = this.transformToWalkListRows(universe, timestamp);
    return this.toCSV(rows, {
      format: 'csv',
      universeId: universe.id,
      universeName: universe.name,
    });
  }

  // --------------------------------------------------------------------------
  // Transform Methods
  // --------------------------------------------------------------------------

  private transformToWalkListRows(
    universe: CanvassingUniverse,
    timestamp: string
  ): WalkListRow[] {
    const rows: WalkListRow[] = [];
    let turfCounter = 1;

    for (const precinct of universe.precincts) {
      // Create a row for each turf in the precinct
      const turfsInPrecinct = precinct.estimatedTurfs || 1;

      for (let turfNum = 1; turfNum <= turfsInPrecinct; turfNum++) {
        rows.push({
          turf_id: `T${String(turfCounter).padStart(4, '0')}`,
          turf_name: `${precinct.precinctName} - Turf ${turfNum}`,
          precinct_id: precinct.precinctId,
          precinct_name: precinct.precinctName,
          jurisdiction: precinct.jurisdiction,
          priority_rank: precinct.priorityRank,
          estimated_doors: Math.ceil(precinct.estimatedDoors / turfsInPrecinct),
          estimated_hours: Math.round((precinct.estimatedHours / turfsInPrecinct) * 10) / 10,
          gotv_priority: Math.round(precinct.gotvPriority),
          persuasion_opportunity: Math.round(precinct.persuasionOpportunity),
          targeting_strategy: precinct.targetingStrategy,
          assigned_volunteer: precinct.assignedVolunteers?.[turfNum - 1] || undefined,
          status: precinct.status || 'unassigned',
          universe_name: universe.name,
          exported_at: timestamp,
        });
        turfCounter++;
      }
    }

    return rows;
  }

  private transformToSummaryExport(summary: CanvassSummary): CanvassSummaryExport {
    return {
      universe_name: summary.universeName,
      created_at: summary.createdAt,
      total_precincts: summary.precincts,
      total_doors: summary.estimatedDoors,
      total_turfs: summary.estimatedTurfs,
      total_hours: summary.estimatedHours,
      volunteers_8hr: summary.volunteersFor8HrShifts,
      volunteers_4hr: summary.volunteersFor4HrShifts,
      expected_contacts: summary.expectedContacts,
      contact_rate: summary.contactRate,
      top_precincts: summary.topPrecincts
        .map((p) => `${p.rank}. ${p.name} (${p.doors} doors)`)
        .join('; '),
      strategy_breakdown: Object.entries(summary.strategyBreakdown)
        .map(([strategy, count]) => `${strategy}: ${count}`)
        .join('; '),
    };
  }

  private generateTurfAssignments(universe: CanvassingUniverse): TurfAssignment[] {
    const turfs: TurfAssignment[] = [];
    let turfCounter = 1;

    for (const precinct of universe.precincts) {
      const turfsInPrecinct = precinct.estimatedTurfs || 1;

      for (let turfNum = 1; turfNum <= turfsInPrecinct; turfNum++) {
        turfs.push({
          turfId: `T${String(turfCounter).padStart(4, '0')}`,
          turfName: `${precinct.precinctName} - Turf ${turfNum}`,
          precinctId: precinct.precinctId,
          precinctName: precinct.precinctName,
          jurisdiction: precinct.jurisdiction,
          estimatedDoors: Math.ceil(precinct.estimatedDoors / turfsInPrecinct),
          estimatedHours: Math.round((precinct.estimatedHours / turfsInPrecinct) * 10) / 10,
          priorityRank: precinct.priorityRank,
          assignedVolunteer: null,
          status: 'unassigned',
        });
        turfCounter++;
      }
    }

    return turfs;
  }

  // --------------------------------------------------------------------------
  // Format Methods
  // --------------------------------------------------------------------------

  private toCSV(rows: WalkListRow[], options: CanvassExportOptions): string {
    const delimiter = options.delimiter || ',';
    const includeHeaders = options.includeHeaders !== false;

    const headers = [
      'turf_id',
      'turf_name',
      'precinct_id',
      'precinct_name',
      'jurisdiction',
      'priority_rank',
      'estimated_doors',
      'estimated_hours',
      'gotv_priority',
      'persuasion_opportunity',
      'targeting_strategy',
      'assigned_volunteer',
      'status',
      'universe_name',
      'exported_at',
    ];

    const lines: string[] = [];

    if (includeHeaders) {
      lines.push(headers.join(delimiter));
    }

    for (const row of rows) {
      const values = headers.map((header) => {
        const value = row[header as keyof WalkListRow];
        if (typeof value === 'string' && (value.includes(delimiter) || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return String(value ?? '');
      });
      lines.push(values.join(delimiter));
    }

    return lines.join('\n');
  }

  private summaryToCSV(summary: CanvassSummaryExport): string {
    const headers = Object.keys(summary);
    const values = Object.values(summary).map((v) => {
      if (typeof v === 'string' && (v.includes(',') || v.includes('"'))) {
        return `"${v.replace(/"/g, '""')}"`;
      }
      return String(v);
    });

    return [headers.join(','), values.join(',')].join('\n');
  }

  private turfsToCSV(turfs: TurfAssignment[]): string {
    const headers = [
      'turf_id',
      'turf_name',
      'precinct_id',
      'precinct_name',
      'jurisdiction',
      'estimated_doors',
      'estimated_hours',
      'priority_rank',
      'assigned_volunteer',
      'status',
    ];

    const lines = [headers.join(',')];

    for (const turf of turfs) {
      const values = [
        turf.turfId,
        `"${turf.turfName}"`,
        turf.precinctId,
        `"${turf.precinctName}"`,
        `"${turf.jurisdiction}"`,
        turf.estimatedDoors,
        turf.estimatedHours,
        turf.priorityRank,
        turf.assignedVolunteer || '',
        turf.status,
      ];
      lines.push(values.join(','));
    }

    return lines.join('\n');
  }

  private toJSON(
    rows: WalkListRow[],
    universe: CanvassingUniverse,
    timestamp: string
  ): string {
    const exportData = {
      metadata: {
        universeName: universe.name,
        description: universe.description,
        exportedAt: timestamp,
        parameters: {
          doorsPerTurf: universe.targetDoorsPerTurf,
          doorsPerHour: universe.targetDoorsPerHour,
          contactRate: universe.targetContactRate,
        },
        totals: {
          precincts: universe.totalPrecincts,
          doors: universe.totalEstimatedDoors,
          turfs: universe.estimatedTurfs,
          hours: universe.estimatedHours,
          volunteers: universe.volunteersNeeded,
        },
      },
      walkList: rows,
    };

    return JSON.stringify(exportData, null, 2);
  }

  // --------------------------------------------------------------------------
  // Utility Methods
  // --------------------------------------------------------------------------

  private sortRows(rows: WalkListRow[], sortBy: 'priority' | 'jurisdiction' | 'doors'): void {
    switch (sortBy) {
      case 'priority':
        rows.sort((a, b) => a.priority_rank - b.priority_rank);
        break;
      case 'jurisdiction':
        rows.sort((a, b) => a.jurisdiction.localeCompare(b.jurisdiction));
        break;
      case 'doors':
        rows.sort((a, b) => b.estimated_doors - a.estimated_doors);
        break;
    }
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
// Supporting Types
// ============================================================================

interface TurfAssignment {
  turfId: string;
  turfName: string;
  precinctId: string;
  precinctName: string;
  jurisdiction: string;
  estimatedDoors: number;
  estimatedHours: number;
  priorityRank: number;
  assignedVolunteer: string | null;
  status: 'unassigned' | 'assigned' | 'in_progress' | 'complete';
}

// ============================================================================
// Singleton Export
// ============================================================================

export const canvassExporter = CanvassExporter.getInstance();

export default CanvassExporter;
