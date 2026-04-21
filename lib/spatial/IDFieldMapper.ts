/**
 * Maps between different ID field naming conventions
 * Different layers and datasets may use different field names for the same ID
 */
export class IDFieldMapper {
  // Common ID field names in order of preference
  private static readonly ID_FIELD_NAMES = [
    'OBJECTID',
    'ObjectId', 
    'objectid',
    'ID',
    'id',
    'FID',
    'fid',
    'feature_id',
    'zip_code',
    'ZIP',
    'GEOID'
  ];

  /**
   * Extract ID from a record using various field name conventions
   */
  static extractId(record: any): string | null {
    if (!record) return null;
    
    // PRIORITY: Check for ZIP code in DESCRIPTION field first (HRB specific)
    if (record.DESCRIPTION && typeof record.DESCRIPTION === 'string') {
      // Extract ZIP from format like "32792 (Winter Park)" or just "32792"
      const zipMatch = record.DESCRIPTION.match(/^(\d{5})/);
      if (zipMatch) {
        return zipMatch[1];
      }
    }
    
    // Fallback: Try each possible field name
    for (const fieldName of this.ID_FIELD_NAMES) {
      if (record[fieldName] !== undefined && record[fieldName] !== null) {
        return String(record[fieldName]);
      }
    }
    
    // Log warning if no ID found
    console.warn('[IDFieldMapper] No ID field found in record:', Object.keys(record).slice(0, 10));
    return null;
  }

  /**
   * Find the ID field name used in a layer
   */
  static findIdFieldName(sampleRecord: any): string | null {
    if (!sampleRecord) return null;
    
    for (const fieldName of this.ID_FIELD_NAMES) {
      if (fieldName in sampleRecord) {
        return fieldName;
      }
    }
    
    return null;
  }

  /**
   * Create a mapping between spatial query IDs and dataset IDs
   * This handles cases where the reference layer uses different IDs than the analysis dataset
   */
  static async createIdMapping(
    spatialIds: string[],
    datasetRecords: any[]
  ): Promise<Map<string, string>> {
    const mapping = new Map<string, string>();
    
    // If IDs match directly, use them
    const spatialIdSet = new Set(spatialIds);
    
    for (const record of datasetRecords) {
      const recordId = this.extractId(record);
      if (recordId && spatialIdSet.has(recordId)) {
        mapping.set(recordId, recordId);
      }
    }
    
    // If we found matches, return the mapping
    if (mapping.size > 0) {
      console.log(`[IDFieldMapper] Direct ID mapping: ${mapping.size}/${spatialIds.length} matches`);
      return mapping;
    }
    
    // If no direct matches, try alternative matching strategies
    // For example, matching by ZIP code or geographic attributes
    console.warn('[IDFieldMapper] No direct ID matches found, may need alternative matching strategy');
    
    return mapping;
  }
}