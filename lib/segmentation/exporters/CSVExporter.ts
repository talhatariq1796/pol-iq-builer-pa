/**
 * CSVExporter - Enhanced CSV export with configurable columns
 *
 * Exports segment results to standard CSV format with optional
 * demographics, electoral breakdown, and Tapestry analysis.
 */

import type { SegmentResults, PrecinctMatch } from '../types';

export interface CSVExportOptions {
  includeDemographics?: boolean;
  includeElectoralBreakdown?: boolean;
  includeTapestryAnalysis?: boolean;
  includeRecommendations?: boolean;
}

export class CSVExporter {
  private segmentResults: SegmentResults;

  constructor(segmentResults: SegmentResults) {
    this.segmentResults = segmentResults;
  }

  /**
   * Export segment results to CSV format
   */
  export(options: CSVExportOptions = {}): string {
    const {
      includeDemographics = true,
      includeElectoralBreakdown = true,
      includeTapestryAnalysis = false,
      includeRecommendations = true,
    } = options;

    const headers = this.buildHeaders({
      includeDemographics,
      includeElectoralBreakdown,
      includeTapestryAnalysis,
      includeRecommendations,
    });

    const rows = this.segmentResults.matchingPrecincts.map(result =>
      this.buildRow(result, {
        includeDemographics,
        includeElectoralBreakdown,
        includeTapestryAnalysis,
        includeRecommendations,
      })
    );

    return [headers, ...rows].join('\n');
  }

  /**
   * Build CSV headers based on options
   */
  private buildHeaders(options: CSVExportOptions): string {
    const headers: string[] = [
      'Precinct ID',
      'Precinct Name',
      'Municipality',
      'Voters Matched',
      'GOTV Priority',
      'Persuasion Opportunity',
      'Strategy',
    ];

    if (options.includeDemographics) {
      headers.push(
        'Population',
        'Median Age',
        'Median Income',
        'College Degree %',
        'White %',
        'Black %',
        'Hispanic %',
        'Asian %'
      );
    }

    if (options.includeElectoralBreakdown) {
      headers.push(
        'Partisan Lean',
        'Turnout Rate',
        'Swing Potential',
        'Biden 2020 %',
        'Trump 2020 %'
      );
    }

    if (options.includeTapestryAnalysis) {
      headers.push(
        'Top Tapestry Segment',
        'Tapestry Concentration %',
        'Segment Description'
      );
    }

    if (options.includeRecommendations) {
      headers.push(
        'Recommended Actions',
        'Messaging Themes'
      );
    }

    return this.escapeCSVRow(headers);
  }

  /**
   * Build CSV row for a precinct match
   */
  private buildRow(result: PrecinctMatch, options: CSVExportOptions): string {
    const values: (string | number)[] = [
      result.precinctId,
      result.precinctName,
      result.jurisdiction || '',
      result.registeredVoters,
      result.gotvPriority.toFixed(1),
      result.persuasionOpportunity.toFixed(1),
      result.targetingStrategy,
    ];

    if (options.includeDemographics) {
      // Note: Demographics would come from joining with PoliticalDataService
      // For now, use placeholder values
      values.push('N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A');
    }

    if (options.includeElectoralBreakdown) {
      values.push(
        result.partisanLean.toFixed(1),
        'N/A', // turnoutRate - not in PrecinctMatch
        result.swingPotential.toFixed(1),
        'N/A', // biden2020Percent
        'N/A'  // trump2020Percent
      );
    }

    if (options.includeTapestryAnalysis) {
      // Tapestry data would come from PoliticalDataService
      values.push('N/A', 'N/A', 'N/A');
    }

    if (options.includeRecommendations) {
      // Generate basic recommendations from strategy
      const actions = this.getRecommendedActions(result);
      values.push(
        actions.join('; '),
        this.getMessagingThemes(result).join('; ')
      );
    }

    return this.escapeCSVRow(values);
  }

  /**
   * Get recommended actions based on strategy
   */
  private getRecommendedActions(result: PrecinctMatch): string[] {
    const actions: string[] = [];

    if (result.gotvPriority >= 70) {
      actions.push('Door-to-door canvassing', 'Phone banking');
    } else if (result.gotvPriority >= 50) {
      actions.push('Phone banking', 'Digital ads');
    }

    if (result.persuasionOpportunity >= 70) {
      actions.push('Persuasion canvassing', 'Town halls');
    } else if (result.persuasionOpportunity >= 50) {
      actions.push('Direct mail', 'Digital persuasion');
    }

    return actions.length > 0 ? actions : ['Monitor only'];
  }

  /**
   * Get messaging themes based on partisan lean
   */
  private getMessagingThemes(result: PrecinctMatch): string[] {
    const themes: string[] = [];

    if (result.partisanLean > 10) {
      themes.push('Conservative values', 'Economic growth');
    } else if (result.partisanLean < -10) {
      themes.push('Progressive policies', 'Social justice');
    } else {
      themes.push('Bipartisan solutions', 'Community focus');
    }

    return themes;
  }

  /**
   * Escape and format a CSV row
   */
  private escapeCSVRow(values: (string | number)[]): string {
    return values
      .map(value => this.escapeCSVValue(String(value)))
      .join(',');
  }

  /**
   * Escape a CSV value (handle quotes, commas, newlines)
   */
  private escapeCSVValue(value: string): string {
    // If value contains comma, quote, or newline, wrap in quotes and escape quotes
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  /**
   * Export with all columns enabled
   */
  exportFull(): string {
    return this.export({
      includeDemographics: true,
      includeElectoralBreakdown: true,
      includeTapestryAnalysis: true,
      includeRecommendations: true,
    });
  }

  /**
   * Export minimal version (just precinct + scores)
   */
  exportMinimal(): string {
    return this.export({
      includeDemographics: false,
      includeElectoralBreakdown: false,
      includeTapestryAnalysis: false,
      includeRecommendations: false,
    });
  }
}

export default CSVExporter;
