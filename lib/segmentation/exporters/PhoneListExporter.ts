/**
 * PhoneListExporter - Phone banking list export format
 *
 * Exports segment results optimized for phone banking operations
 * with priority ordering and call scripts.
 */

import type { SegmentResults, PrecinctMatch, PhoneListExportRow } from '../types';

export interface PhoneListExportOptions {
  priorityOrder?: 'gotv' | 'persuasion' | 'combined';
  phoneType?: 'best' | 'cell' | 'all';
}

export class PhoneListExporter {
  private segmentResults: SegmentResults;

  constructor(segmentResults: SegmentResults) {
    this.segmentResults = segmentResults;
  }

  /**
   * Export segment results to phone banking list format
   */
  export(options: PhoneListExportOptions = {}): string {
    const {
      priorityOrder = 'combined',
      phoneType = 'best',
    } = options;

    // Sort results by priority
    const sortedResults = this.sortByPriority(
      [...this.segmentResults.matchingPrecincts],
      priorityOrder
    );

    const headers = this.buildHeaders();
    const rows = sortedResults.map(result =>
      this.buildRow(result, { priorityOrder, phoneType })
    );

    return [headers, ...rows].join('\n');
  }

  /**
   * Sort results by priority order
   */
  private sortByPriority(
    results: PrecinctMatch[],
    priorityOrder: 'gotv' | 'persuasion' | 'combined'
  ): PrecinctMatch[] {
    return results.sort((a, b) => {
      let scoreA: number;
      let scoreB: number;

      if (priorityOrder === 'gotv') {
        scoreA = a.gotvPriority;
        scoreB = b.gotvPriority;
      } else if (priorityOrder === 'persuasion') {
        scoreA = a.persuasionOpportunity;
        scoreB = b.persuasionOpportunity;
      } else {
        // Combined: average of both scores
        scoreA = (a.gotvPriority + a.persuasionOpportunity) / 2;
        scoreB = (b.gotvPriority + b.persuasionOpportunity) / 2;
      }

      return scoreB - scoreA; // Descending order (highest first)
    });
  }

  /**
   * Build phone list CSV headers
   */
  private buildHeaders(): string {
    const headers: string[] = [
      'Precinct ID',
      'Precinct Name',
      'Jurisdiction',
      'Registered Voters',
      'Priority',
      'Script',
      'Strategy',
      'Notes',
    ];

    return this.escapeCSVRow(headers);
  }

  /**
   * Build phone list row for a precinct match
   */
  private buildRow(
    result: PrecinctMatch,
    options: PhoneListExportOptions
  ): string {
    const priority = this.calculatePriority(result, options.priorityOrder || 'combined');
    const script = this.getCallScript(result);

    const row: PhoneListExportRow = {
      PrecinctId: result.precinctId,
      PrecinctName: result.precinctName,
      Jurisdiction: result.jurisdiction,
      RegisteredVoters: result.registeredVoters,
      Priority: priority,
      Script: script,
      Strategy: result.targetingStrategy,
      Notes: this.buildNotes(result),
    };

    const values = [
      row.PrecinctId,
      row.PrecinctName,
      row.Jurisdiction,
      row.RegisteredVoters.toLocaleString(),
      row.Priority,
      row.Script,
      row.Strategy,
      row.Notes,
    ];

    return this.escapeCSVRow(values);
  }

  /**
   * Calculate call priority (1-5 scale)
   */
  private calculatePriority(
    result: PrecinctMatch,
    priorityOrder: 'gotv' | 'persuasion' | 'combined'
  ): number {
    let score: number;

    if (priorityOrder === 'gotv') {
      score = result.gotvPriority;
    } else if (priorityOrder === 'persuasion') {
      score = result.persuasionOpportunity;
    } else {
      score = (result.gotvPriority + result.persuasionOpportunity) / 2;
    }

    // Convert 0-100 score to 1-5 priority
    if (score >= 80) return 1;      // Highest priority
    if (score >= 60) return 2;      // High priority
    if (score >= 40) return 3;      // Medium priority
    if (score >= 20) return 4;      // Low priority
    return 5;                       // Lowest priority
  }

  /**
   * Generate call script based on strategy
   */
  private getCallScript(result: PrecinctMatch): string {
    const strategy = result.targetingStrategy;

    const scripts: Record<string, string> = {
      'GOTV - High Priority': 'GOTV Script: "Hi, this is [NAME] calling on behalf of [CAMPAIGN]. Our records show you\'re a registered voter. Do you have a plan to vote on [DATE]? Can we help you find your polling location?"',

      'GOTV - Standard': 'GOTV Script: "Hi, this is [NAME] with [CAMPAIGN]. Just a quick reminder that Election Day is [DATE]. Do you need information about your polling location or early voting options?"',

      'Persuasion': 'Persuasion Script: "Hi, I\'m [NAME] calling to talk about [KEY ISSUE]. What\'s most important to you in this election? [LISTEN] Here\'s how [CANDIDATE] plans to address that..."',

      'Mixed - GOTV + Persuasion': 'Mixed Script: "Hi, this is [NAME]. I wanted to talk about [KEY ISSUE] and make sure you have a plan to vote. What matters most to you? [LISTEN] [CANDIDATE] is focused on [RESPONSE]. Can I help you with voting information?"',

      'Monitoring': 'Monitoring Script: "Hi, this is [NAME] conducting a brief voter survey. Which issues are most important to you this election? [LISTEN, RECORD, THANK]"',

      'Not Recommended': 'No script - not recommended for phone contact',
    };

    return scripts[strategy] || 'Standard Script: See call guide for messaging.';
  }

  /**
   * Build notes field with precinct context
   */
  private buildNotes(result: PrecinctMatch): string {
    const notes: string[] = [];

    // Add voter count
    notes.push(`${result.registeredVoters.toLocaleString()} voters in precinct`);

    // Add partisan lean
    const lean = result.partisanLean;
    if (lean > 10) {
      notes.push('Republican-leaning');
    } else if (lean < -10) {
      notes.push('Democratic-leaning');
    } else {
      notes.push('Swing precinct');
    }

    // Add match score
    notes.push(`Match score: ${result.matchScore.toFixed(0)}`);

    return notes.join(' | ');
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
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  /**
   * Export for GOTV-focused phone banking
   */
  exportGOTV(): string {
    return this.export({
      priorityOrder: 'gotv',
      phoneType: 'best',
    });
  }

  /**
   * Export for persuasion-focused phone banking
   */
  exportPersuasion(): string {
    return this.export({
      priorityOrder: 'persuasion',
      phoneType: 'best',
    });
  }
}

export default PhoneListExporter;
