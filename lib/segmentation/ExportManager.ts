/**
 * ExportManager - Central orchestrator for all segment export operations
 *
 * Coordinates various export formats (CSV, VAN, phone lists, digital ads, JSON)
 * and delegates to specialized exporters.
 */

import type { SegmentResults, ExportOptions, ExportFormat } from './types';
import { CSVExporter } from './exporters/CSVExporter';
import { VANExporter } from './exporters/VANExporter';
import { PhoneListExporter } from './exporters/PhoneListExporter';
import { DigitalAdsExporter } from './exporters/DigitalAdsExporter';

export class ExportManager {
  private segmentResults: SegmentResults;

  constructor(segmentResults: SegmentResults) {
    this.segmentResults = segmentResults;
  }

  /**
   * Main export method - routes to appropriate exporter based on format
   */
  async export(options: ExportOptions): Promise<Blob | string> {
    const { format } = options;

    let content: string;
    let mimeType: string;

    switch (format) {
      case 'csv':
        content = await this.toCSV(options);
        mimeType = 'text/csv;charset=utf-8;';
        break;

      case 'van':
        content = await this.toVAN();
        mimeType = 'text/csv;charset=utf-8;';
        break;

      case 'phone_list':
        content = await this.toPhoneList(options);
        mimeType = 'text/csv;charset=utf-8;';
        break;

      case 'digital_ads':
        content = await this.toDigitalAds(options);
        mimeType = 'text/csv;charset=utf-8;';
        break;

      case 'json':
        content = await this.toJSON({ pretty: options.includeMetadata });
        mimeType = 'application/json;charset=utf-8;';
        break;

      case 'pdf':
        throw new Error('PDF export not yet implemented - use report generation');

      case 'mail_merge':
        throw new Error('Mail merge export not yet implemented');

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }

    // Create blob with BOM for Excel compatibility (except JSON)
    const bom = format === 'json' ? '' : '\uFEFF';
    const blob = new Blob([bom + content], { type: mimeType });

    // Auto-download if filename provided
    if (options.filename) {
      this.downloadBlob(blob, options.filename);
    }

    return blob;
  }

  /**
   * Export to standard CSV format
   */
  async toCSV(options?: Partial<ExportOptions>): Promise<string> {
    const exporter = new CSVExporter(this.segmentResults);
    return exporter.export({
      includeDemographics: options?.includeDemographics ?? true,
      includeElectoralBreakdown: options?.includeElectoralBreakdown ?? true,
      includeTapestryAnalysis: options?.includeTapestryAnalysis ?? false,
      includeRecommendations: options?.includeRecommendations ?? true,
    });
  }

  /**
   * Export to VAN-compatible format
   */
  async toVAN(): Promise<string> {
    const exporter = new VANExporter(this.segmentResults);
    return exporter.export();
  }

  /**
   * Export to phone banking list format
   */
  async toPhoneList(options?: { priorityOrder?: 'gotv' | 'persuasion' | 'combined' }): Promise<string> {
    const exporter = new PhoneListExporter(this.segmentResults);
    return exporter.export({
      priorityOrder: options?.priorityOrder ?? 'combined',
    });
  }

  /**
   * Export to digital advertising format (ZIP-level aggregates)
   */
  async toDigitalAds(options?: { aggregationLevel?: 'zip' | 'zip4' | 'municipality' }): Promise<string> {
    const exporter = new DigitalAdsExporter(this.segmentResults);
    return exporter.export({
      aggregationLevel: options?.aggregationLevel ?? 'zip',
    });
  }

  /**
   * Export to JSON format
   */
  async toJSON(options?: { pretty?: boolean }): Promise<string> {
    const data = {
      metadata: {
        exportedAt: new Date().toISOString(),
        totalVoters: this.segmentResults.estimatedVoters,
        totalPrecincts: this.segmentResults.precinctCount,
      },
      results: this.segmentResults,
    };

    return options?.pretty
      ? JSON.stringify(data, null, 2)
      : JSON.stringify(data);
  }

  /**
   * Generate filename based on format and timestamp
   */
  private getFilename(format: ExportFormat): string {
    const timestamp = new Date().toISOString().split('T')[0];
    const safeName = 'segment_export';

    const extensions: Record<ExportFormat, string> = {
      csv: 'csv',
      van: 'csv',
      phone_list: 'csv',
      digital_ads: 'csv',
      json: 'json',
      pdf: 'pdf',
      mail_merge: 'csv',
    };

    return `${safeName}_${timestamp}.${extensions[format]}`;
  }

  /**
   * Download blob as file in browser
   */
  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Quick export methods with sensible defaults
   */
  async exportToCSV(filename?: string): Promise<void> {
    await this.export({
      format: 'csv',
      filename: filename || this.getFilename('csv'),
      includeDemographics: true,
      includeElectoralBreakdown: true,
      includeRecommendations: true,
    });
  }

  async exportToVAN(filename?: string): Promise<void> {
    await this.export({
      format: 'van',
      filename: filename || this.getFilename('van'),
    });
  }

  async exportToPhoneList(filename?: string, priorityOrder?: 'gotv' | 'persuasion' | 'combined'): Promise<void> {
    await this.export({
      format: 'phone_list',
      filename: filename || this.getFilename('phone_list'),
      priorityOrder: priorityOrder || 'combined',
    });
  }

  async exportToDigitalAds(filename?: string, aggregationLevel?: 'zip' | 'zip4' | 'municipality'): Promise<void> {
    await this.export({
      format: 'digital_ads',
      filename: filename || this.getFilename('digital_ads'),
      aggregationLevel: aggregationLevel || 'zip',
    });
  }
}

export default ExportManager;
