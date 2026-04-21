/**
 * LocalStorage-based persistence for saved segments
 */

import type { SegmentDefinition, SegmentResults, SegmentExportRow } from './types';

const STORAGE_KEY = 'pol_voter_segments';

/**
 * Segment store for saving and managing segment definitions
 */
export class SegmentStore {
  private storageAvailable: boolean = true;
  private lastError: string | null = null;

  /**
   * Get all saved segments from localStorage
   */
  getAll(): SegmentDefinition[] {
    if (!this.storageAvailable) {
      console.warn('[SegmentStore] Storage unavailable. Use export to save segments.');
      return [];
    }

    try {
      const json = localStorage.getItem(STORAGE_KEY);
      if (!json) return [];
      return JSON.parse(json) as SegmentDefinition[];
    } catch (error) {
      this.handleStorageError(error);
      return [];
    }
  }

  /**
   * Get a segment by ID
   */
  getById(id: string): SegmentDefinition | null {
    const segments = this.getAll();
    return segments.find(s => s.id === id) || null;
  }

  /**
   * Save a segment (create or update)
   * Returns true on success, false on failure
   */
  save(segment: SegmentDefinition): boolean {
    try {
      const segments = this.getAll();
      const existingIndex = segments.findIndex(s => s.id === segment.id);

      if (existingIndex >= 0) {
        // Update existing
        segments[existingIndex] = {
          ...segment,
          updatedAt: new Date().toISOString(),
        };
      } else {
        // Create new
        segments.push(segment);
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(segments));
      this.lastError = null;
      this.storageAvailable = true; // Successfully saved, storage is working
      return true;
    } catch (error) {
      this.handleStorageError(error);
      // Offer export alternative when save fails
      console.warn('[SegmentStore] Save failed:', this.lastError);
      console.warn('[SegmentStore] Use exportToFile() to save this segment locally');
      return false;
    }
  }

  /**
   * Delete a segment by ID
   * Returns true on success, false on failure
   */
  delete(id: string): boolean {
    try {
      const segments = this.getAll();
      const filtered = segments.filter(s => s.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      this.lastError = null;
      this.storageAvailable = true; // Successfully deleted, storage is working
      return true;
    } catch (error) {
      this.handleStorageError(error);
      console.warn('[SegmentStore] Delete failed:', this.lastError);
      return false;
    }
  }

  /**
   * Delete multiple segments by IDs
   * Returns number of segments successfully deleted
   */
  deleteMany(ids: string[]): number {
    try {
      const segments = this.getAll();
      const idsSet = new Set(ids);
      const filtered = segments.filter(s => !idsSet.has(s.id));
      const deletedCount = segments.length - filtered.length;

      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      this.lastError = null;
      this.storageAvailable = true;
      return deletedCount;
    } catch (error) {
      this.handleStorageError(error);
      console.warn('[SegmentStore] Batch delete failed:', this.lastError);
      return 0;
    }
  }

  /**
   * Export multiple segments to JSON string
   */
  exportMany(ids: string[]): string {
    const segments = this.getAll();
    const idsSet = new Set(ids);
    const selectedSegments = segments.filter(s => idsSet.has(s.id));
    return JSON.stringify(selectedSegments, null, 2);
  }

  /**
   * Export multiple segments to a downloadable JSON file
   */
  exportManyToFile(ids: string[]): void {
    const json = this.exportMany(ids);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `segments-batch-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Escape CSV field value (handles commas, quotes, newlines)
   */
  private escapeCSV(value: string | number | undefined): string {
    if (value === undefined || value === null) return '';
    const str = String(value);
    // If contains comma, quote, or newline, wrap in quotes and escape internal quotes
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  /**
   * Export segment results to CSV format with comprehensive data
   */
  exportToCSV(results: SegmentResults): string {
    if (!results.matchingPrecincts?.length) return '';

    const headers = [
      'Precinct ID',
      'Precinct Name',
      'Jurisdiction',
      'Registered Voters',
      'Total Population',
      'Population 18+',
      'Median Income',
      'College %',
      'Diversity Index',
      'Population Density',
      'Dem Affiliation %',
      'Rep Affiliation %',
      'Independent %',
      'Liberal %',
      'Moderate %',
      'Conservative %',
      'Partisan Lean',
      'Swing Potential',
      'Avg Turnout %',
      'Competitiveness',
      'GOTV Priority',
      'Persuasion Opportunity',
      'Combined Score',
      'Targeting Strategy',
      'Priority',
      'Match Score',
    ];

    const rows = results.matchingPrecincts.map(precinct => {
      // Type assertion to access nested properties
      const precinctData = precinct as any;

      // Helper function to format numbers
      const formatNum = (value: number | undefined, decimals: number = 1): string => {
        if (value === undefined || value === null) return '';
        return value.toFixed(decimals);
      };

      // Helper function to format currency
      const formatCurrency = (value: number | undefined): string => {
        if (value === undefined || value === null) return '';
        return Math.round(value).toLocaleString();
      };

      // Helper function to format percentages
      const formatPct = (value: number | undefined): string => {
        if (value === undefined || value === null) return '';
        return formatNum(value, 1);
      };

      return [
        // Core identifiers
        this.escapeCSV(precinct.precinctId),
        this.escapeCSV(precinct.precinctName),
        this.escapeCSV(precinct.jurisdiction),

        // Demographics
        this.escapeCSV(precinctData.demographics?.registeredVoters || precinct.registeredVoters || ''),
        this.escapeCSV(precinctData.demographics?.totalPopulation || ''),
        this.escapeCSV(precinctData.demographics?.population18up || ''),
        this.escapeCSV(formatCurrency(precinctData.demographics?.medianHHI)),
        this.escapeCSV(formatPct(precinctData.demographics?.collegePct)),
        this.escapeCSV(formatPct(precinctData.demographics?.diversityIndex)),
        this.escapeCSV(precinctData.demographics?.populationDensity || ''),

        // Political affiliation
        this.escapeCSV(formatPct(precinctData.political?.demAffiliationPct)),
        this.escapeCSV(formatPct(precinctData.political?.repAffiliationPct)),
        this.escapeCSV(formatPct(precinctData.political?.independentPct)),
        this.escapeCSV(formatPct(precinctData.political?.liberalPct)),
        this.escapeCSV(formatPct(precinctData.political?.moderatePct)),
        this.escapeCSV(formatPct(precinctData.political?.conservativePct)),

        // Electoral metrics
        this.escapeCSV(formatNum(precinctData.electoral?.partisanLean || precinct.partisanLean, 1)),
        this.escapeCSV(formatNum(precinctData.electoral?.swingPotential || precinct.swingPotential, 1)),
        this.escapeCSV(formatPct(precinctData.electoral?.avgTurnout)),
        this.escapeCSV(precinctData.electoral?.competitiveness || ''),

        // Targeting scores
        this.escapeCSV(formatNum(precinctData.targeting?.gotvPriority || precinct.gotvPriority, 1)),
        this.escapeCSV(formatNum(precinctData.targeting?.persuasionOpportunity || precinct.persuasionOpportunity, 1)),
        this.escapeCSV(formatNum(precinctData.targeting?.combinedScore, 1)),
        this.escapeCSV(precinctData.targeting?.strategy || precinct.targetingStrategy || ''),
        this.escapeCSV(precinctData.targeting?.priority || ''),
        this.escapeCSV(formatNum(precinct.matchScore, 1)),
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Import segments from JSON string
   */
  importFromJSON(json: string): SegmentDefinition[] {
    try {
      const imported = JSON.parse(json) as SegmentDefinition[];

      // Validate structure
      if (!Array.isArray(imported)) {
        throw new Error('Invalid format: expected array of segments');
      }

      // Save each segment
      imported.forEach(segment => {
        if (!segment.id || !segment.name || !segment.filters) {
          throw new Error('Invalid segment structure');
        }
        this.save(segment);
      });

      return imported;
    } catch (error) {
      console.error('Error importing segments:', error);
      throw new Error('Failed to import segments: ' + (error as Error).message);
    }
  }

  /**
   * Export all segments to JSON string
   */
  exportToJSON(): string {
    const segments = this.getAll();
    return JSON.stringify(segments, null, 2);
  }

  /**
   * Clear all segments (with confirmation)
   * Returns true on success, false on failure
   */
  clearAll(): boolean {
    try {
      localStorage.removeItem(STORAGE_KEY);
      this.lastError = null;
      return true;
    } catch (error) {
      this.handleStorageError(error);
      return false;
    }
  }

  /**
   * Get segment count
   */
  getCount(): number {
    return this.getAll().length;
  }

  /**
   * Check if a segment name already exists
   */
  nameExists(name: string, excludeId?: string): boolean {
    const segments = this.getAll();
    return segments.some(s => s.name === name && s.id !== excludeId);
  }

  /**
   * Handle storage errors with user-friendly messages
   */
  private handleStorageError(error: unknown): void {
    console.error('[SegmentStore] LocalStorage error:', error);

    if (error instanceof DOMException) {
      if (error.name === 'QuotaExceededError') {
        this.lastError = 'Storage quota exceeded. Please export your segments or delete old ones to free up space.';
        this.storageAvailable = false;
        console.warn('[SegmentStore] QuotaExceededError - use exportToFile() or exportToJSON() as alternative');
      } else if (error.name === 'SecurityError') {
        this.lastError = 'Storage blocked (private browsing mode detected). Use "Export to File" to save segments locally.';
        this.storageAvailable = false;
        console.warn('[SegmentStore] SecurityError - private browsing mode, use exportToFile() instead');
      } else {
        this.lastError = `Storage error (${error.name}). Try exporting your segment to file instead.`;
        this.storageAvailable = false;
        console.warn(`[SegmentStore] DOMException ${error.name} - use exportToFile() as alternative`);
      }
    } else {
      this.lastError = 'Failed to access storage. Use "Export to File" to save segments locally.';
      this.storageAvailable = false;
      console.warn('[SegmentStore] Unknown storage error - use exportToFile() as alternative');
    }
  }

  /**
   * Check if localStorage is available
   */
  isStorageAvailable(): boolean {
    return this.storageAvailable;
  }

  /**
   * Get the last error message
   */
  getLastError(): string | null {
    return this.lastError;
  }

  /**
   * Export a segment to a downloadable JSON file
   */
  exportToFile(segment: SegmentDefinition): void {
    const blob = new Blob([JSON.stringify(segment, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `segment-${segment.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Export segment results to a downloadable CSV file
   */
  exportResultsToFile(results: SegmentResults, filename: string): void {
    const csv = this.exportToCSV(results);
    if (!csv) {
      console.error('No data to export');
      return;
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Clear the last error
   */
  clearError(): void {
    this.lastError = null;
    // Attempt to re-enable storage on next operation
    this.storageAvailable = true;
  }
}

/**
 * Singleton instance
 */
export const segmentStore = new SegmentStore();
