/**
 * Export Types
 *
 * Common types for data export functionality.
 * Supports segment exports, canvass walk lists, and VAN-compatible formats.
 */

// ============================================================================
// Export Format Types
// ============================================================================

export type ExportFormat = 'csv' | 'json' | 'xlsx';

export interface ExportOptions {
  format: ExportFormat;
  filename?: string;
  includeHeaders?: boolean;
  dateFormat?: string;
  delimiter?: ',' | '\t' | ';';
}

export interface ExportResult {
  success: boolean;
  filename: string;
  format: ExportFormat;
  rowCount: number;
  fileSize?: number;
  downloadUrl?: string;
  error?: string;
}

// ============================================================================
// Segment Export Types
// ============================================================================

export interface SegmentExportRow {
  precinct_id: string;
  precinct_name: string;
  jurisdiction: string;
  jurisdiction_type: string;
  county: string;
  registered_voters: number;
  estimated_vap: number;
  gotv_priority: number;
  persuasion_opportunity: number;
  swing_potential: number;
  targeting_strategy: string;
  partisan_lean: number;
  competitiveness: string;
  avg_turnout: number;
  median_age: number;
  median_income: number;
  density_type: string;
  match_score: number;
  segment_name: string;
  exported_at: string;
}

export interface SegmentExportOptions extends ExportOptions {
  segmentId: string;
  segmentName: string;
  includedemographics?: boolean;
  includeElectoral?: boolean;
  includeEngagement?: boolean;
}

// ============================================================================
// Canvass Export Types
// ============================================================================

export interface WalkListRow {
  turf_id: string;
  turf_name: string;
  precinct_id: string;
  precinct_name: string;
  jurisdiction: string;
  priority_rank: number;
  estimated_doors: number;
  estimated_hours: number;
  gotv_priority: number;
  persuasion_opportunity: number;
  targeting_strategy: string;
  assigned_volunteer?: string;
  status: 'unassigned' | 'assigned' | 'in_progress' | 'complete';
  universe_name: string;
  exported_at: string;
}

export interface CanvassExportOptions extends ExportOptions {
  universeId: string;
  universeName: string;
  includeTurfAssignments?: boolean;
  includeVolunteerSlots?: boolean;
  sortBy?: 'priority' | 'jurisdiction' | 'doors';
}

export interface CanvassSummaryExport {
  universe_name: string;
  created_at: string;
  total_precincts: number;
  total_doors: number;
  total_turfs: number;
  total_hours: number;
  volunteers_8hr: number;
  volunteers_4hr: number;
  expected_contacts: number;
  contact_rate: number;
  top_precincts: string;
  strategy_breakdown: string;
}

// ============================================================================
// VAN Export Types
// ============================================================================

/**
 * VAN-compatible voter record format
 * Based on NGP VAN export specifications
 */
export interface VANExportRow {
  // Required VAN fields
  VANID?: string;              // VAN's unique voter identifier (if available)
  ExternalID: string;          // Our precinct or voter ID

  // Name (placeholder for voter-level data)
  FirstName?: string;
  LastName?: string;

  // Location
  PrecinctID: string;
  PrecinctName: string;
  Jurisdiction: string;
  County: string;
  State: string;
  ZIP?: string;

  // Our scores (can be imported as custom fields in VAN)
  GOTVPriority: number;
  PersuasionScore: number;
  SwingPotential: number;
  PartisanLean: number;
  TurnoutLikelihood: number;

  // Targeting
  TargetingStrategy: string;
  SegmentCode?: string;
  TurfID?: string;
  PriorityRank: number;

  // Metadata
  SourceSystem: string;
  ExportDate: string;
  DataVersion: string;
}

export interface VANExportOptions extends ExportOptions {
  // Field mapping customization
  includeScores?: boolean;
  includeTargeting?: boolean;
  includeMetadata?: boolean;

  // VAN-specific options
  vanFieldMapping?: Record<string, string>;
  customFields?: string[];

  // Source
  segmentId?: string;
  universeId?: string;
  precinctIds?: string[];
}

/**
 * VAN field mapping configuration
 * Maps our field names to VAN's expected field names
 */
export interface VANFieldMapping {
  source: string;           // Our field name
  target: string;           // VAN field name
  transform?: 'none' | 'uppercase' | 'number' | 'date';
  required: boolean;
}

export const DEFAULT_VAN_FIELD_MAPPING: VANFieldMapping[] = [
  { source: 'precinctId', target: 'ExternalID', transform: 'none', required: true },
  { source: 'precinctName', target: 'PrecinctName', transform: 'none', required: true },
  { source: 'jurisdiction', target: 'Jurisdiction', transform: 'none', required: true },
  { source: 'gotvPriority', target: 'GOTVPriority', transform: 'number', required: false },
  { source: 'persuasionOpportunity', target: 'PersuasionScore', transform: 'number', required: false },
  { source: 'swingPotential', target: 'SwingPotential', transform: 'number', required: false },
  { source: 'partisanLean', target: 'PartisanLean', transform: 'number', required: false },
  { source: 'targetingStrategy', target: 'TargetingStrategy', transform: 'none', required: false },
  { source: 'priorityRank', target: 'PriorityRank', transform: 'number', required: false },
];

// ============================================================================
// CSV Upload Types
// ============================================================================

export interface CSVColumn {
  name: string;
  index: number;
  sampleValues: string[];
  inferredType: 'string' | 'number' | 'date' | 'boolean' | 'unknown';
}

export interface CSVParseResult {
  success: boolean;
  columns: CSVColumn[];
  rowCount: number;
  previewRows: Record<string, string>[];
  errors?: string[];
}

export interface ColumnMapping {
  sourceColumn: string;
  targetField: string;
  transform?: 'none' | 'uppercase' | 'lowercase' | 'number' | 'date';
}

export interface CSVUploadConfig {
  expectedColumns: string[];
  requiredColumns: string[];
  autoDetectMapping?: boolean;
  validateOnParse?: boolean;
  maxRows?: number;
  maxFileSize?: number; // bytes
}

export interface CSVUploadResult {
  success: boolean;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  mappedFields: string[];
  warnings?: string[];
  errors?: string[];
  data?: Record<string, unknown>[];
}

// ============================================================================
// Export History Types
// ============================================================================

export interface ExportRecord {
  id: string;
  type: 'segment' | 'canvass' | 'van' | 'custom';
  sourceId: string;
  sourceName: string;
  format: ExportFormat;
  filename: string;
  rowCount: number;
  fileSize: number;
  exportedAt: string;
  exportedBy?: string;
}

export interface ExportHistory {
  exports: ExportRecord[];
  lastExport?: ExportRecord;
  totalExports: number;
}
