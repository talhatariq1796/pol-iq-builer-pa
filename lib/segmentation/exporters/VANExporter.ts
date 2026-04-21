/**
 * VANExporter - VAN (Voter Activation Network) compatible export format
 *
 * Exports segment results in a format compatible with VAN/VoteBuilder
 * for use in voter contact programs.
 */

import type { SegmentResults, PrecinctMatch, VANExportRow } from '../types';

export class VANExporter {
  private segmentResults: SegmentResults;

  constructor(segmentResults: SegmentResults) {
    this.segmentResults = segmentResults;
  }

  /**
   * Export segment results to VAN-compatible CSV format
   */
  export(): string {
    const headers = this.buildHeaders();
    const rows = this.segmentResults.matchingPrecincts.map(result => this.buildRow(result));

    return [headers, ...rows].join('\n');
  }

  /**
   * Build VAN-compatible CSV headers
   */
  private buildHeaders(): string {
    const headers: string[] = [
      'VoterVANID',
      'FirstName',
      'LastName',
      'Address',
      'City',
      'State',
      'Zip',
      'Phone',
      'Email',
      'Precinct',
      'PrecinctName',
      'Score_GOTV',
      'Score_Persuasion',
      'Score_Swing',
      'TargetingStrategy',
    ];

    return this.escapeCSVRow(headers);
  }

  /**
   * Build VAN-compatible row for a precinct match
   */
  private buildRow(result: PrecinctMatch): string {
    const row: VANExportRow = {
      VoterVANID: '',
      FirstName: '',
      LastName: '',
      Address: '',
      City: result.jurisdiction,
      State: 'MI',
      Zip: '',
      Phone: '',
      Email: '',
      Precinct: result.precinctId,
      PrecinctName: result.precinctName,
      Score_GOTV: result.gotvPriority,
      Score_Persuasion: result.persuasionOpportunity,
      Score_Swing: result.swingPotential,
      TargetingStrategy: result.targetingStrategy,
    };

    const values = [
      row.VoterVANID || '',
      row.FirstName || '',
      row.LastName || '',
      row.Address || '',
      row.City,
      row.State,
      row.Zip || '',
      row.Phone || '',
      row.Email || '',
      row.Precinct,
      row.PrecinctName,
      row.Score_GOTV.toFixed(1),
      row.Score_Persuasion.toFixed(1),
      row.Score_Swing.toFixed(1),
      row.TargetingStrategy,
    ];

    return this.escapeCSVRow(values);
  }

  /**
   * Get VAN strategy code based on recommended strategy
   */
  private getStrategyCode(strategy: string): string {
    const codes: Record<string, string> = {
      'GOTV - High Priority': 'GOTV-HP',
      'GOTV - Standard': 'GOTV-STD',
      'Persuasion': 'PERS',
      'Mixed - GOTV + Persuasion': 'MIX-GP',
      'Monitoring': 'MON',
      'Not Recommended': 'SKIP',
    };

    return codes[strategy] || 'OTHER';
  }

  /**
   * Determine recommended contact method based on precinct characteristics
   */
  private getContactMethod(result: PrecinctMatch): string {
    // High GOTV priority -> Phone + Door
    if (result.gotvPriority >= 70) {
      return 'Phone+Door';
    }

    // High persuasion -> Door (more personal)
    if (result.persuasionOpportunity >= 70) {
      return 'Door';
    }

    // Medium priority -> Phone
    if (result.gotvPriority >= 50 || result.persuasionOpportunity >= 50) {
      return 'Phone';
    }

    // Low priority -> Digital/Mail
    return 'Digital';
  }

  /**
   * Build notes field with precinct context
   */
  private buildNotes(result: PrecinctMatch): string {
    const notes: string[] = [];

    // Add voter count
    notes.push(`${result.registeredVoters.toLocaleString()} registered voters`);

    // Add electoral context
    const lean = result.partisanLean;
    if (lean > 10) {
      notes.push('Lean R');
    } else if (lean < -10) {
      notes.push('Lean D');
    } else {
      notes.push('Swing');
    }

    // Add strategy
    notes.push(`Strategy: ${result.targetingStrategy}`);

    // Add scores
    notes.push(`GOTV: ${result.gotvPriority.toFixed(0)}, Persuasion: ${result.persuasionOpportunity.toFixed(0)}`);

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
   * Export with custom target universe name
   */
  exportWithUniverse(universeName: string): string {
    // Note: Universe name would be passed from caller context
    // For now, just return standard export
    return this.export();
  }
}

export default VANExporter;
