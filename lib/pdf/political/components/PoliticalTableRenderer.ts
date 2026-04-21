/**
 * Political Table Renderer for PDF Reports
 *
 * Renders fixed-position tables with political styling for:
 * - Election history results
 * - Precinct rankings
 * - Similar precincts
 * - Demographic breakdowns
 *
 * @version 1.0.0
 * @lastUpdated 2025-12-10
 */

import jsPDF from 'jspdf';
import {
  POLITICAL_COLORS,
  FONT_SPECS,
  type TableTemplate,
  formatPartisanLean,
  getPartisanColor,
} from '../templates/PoliticalPageTemplates';
import {
  hexToRGB,
  formatCurrency as formatCurrencyUtil,
  truncateText as truncateTextUtil,
} from '../utils';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface TableColumn {
  /** Column header */
  header: string;
  /** Column key (for data access) */
  key: string;
  /** Column width as percentage */
  width: number;
  /** Text alignment */
  align?: 'left' | 'center' | 'right';
  /** Format function */
  format?: (value: any) => string;
  /** Color function (returns hex color) */
  colorFn?: (value: any) => string;
}

export interface ElectionResultRow {
  year: number;
  type: 'General' | 'Midterm' | 'Primary' | 'Special';
  office: string;
  demPct: number;
  repPct: number;
  margin: number;
  turnout?: number;
}

export interface PrecinctRankingRow {
  rank: number;
  name: string;
  gotv: number;
  swing: number;
  lean: number;
  voters: number;
  priority: 'TOP' | 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface SimilarPrecinctRow {
  name: string;
  lean: number;
  swing: number;
  gotv?: number;
  similarity: number;
}

export interface TableRenderOptions {
  /** X position */
  x: number;
  /** Y position */
  y: number;
  /** Total width */
  width: number;
  /** Row height */
  rowHeight?: number;
  /** Header row height */
  headerHeight?: number;
  /** Font size for body */
  bodyFontSize?: number;
  /** Font size for header */
  headerFontSize?: number;
  /** Show alternating row colors */
  alternateRows?: boolean;
  /** Border color */
  borderColor?: string;
  /** Header background color */
  headerBgColor?: string;
  /** Header text color */
  headerTextColor?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Set fill color from hex
 */
function setFillColorFromHex(pdf: jsPDF, hex: string): void {
  const rgb = hexToRGB(hex);
  pdf.setFillColor(rgb.r, rgb.g, rgb.b);
}

/**
 * Set text color from hex
 */
function setTextColorFromHex(pdf: jsPDF, hex: string): void {
  const rgb = hexToRGB(hex);
  pdf.setTextColor(rgb.r, rgb.g, rgb.b);
}

/**
 * Set draw color from hex
 */
function setDrawColorFromHex(pdf: jsPDF, hex: string): void {
  const rgb = hexToRGB(hex);
  pdf.setDrawColor(rgb.r, rgb.g, rgb.b);
}

// ============================================================================
// GENERIC TABLE RENDERER
// ============================================================================

/**
 * Render a generic table with columns and data
 */
export function renderTable(
  pdf: jsPDF,
  columns: TableColumn[],
  data: Record<string, any>[],
  options: TableRenderOptions
): number {
  const {
    x,
    y,
    width,
    rowHeight = 7,
    headerHeight = 8,
    bodyFontSize = 8,
    headerFontSize = 8,
    alternateRows = true,
    borderColor = POLITICAL_COLORS.border,
    headerBgColor = POLITICAL_COLORS.primary,
    headerTextColor = POLITICAL_COLORS.white,
  } = options;

  // Save state
  const savedFont = pdf.getFont();
  const savedFontSize = pdf.getFontSize();

  let currentY = y;

  // Calculate column positions
  const colPositions: number[] = [];
  let runningX = x;
  columns.forEach((col) => {
    colPositions.push(runningX);
    runningX += (col.width / 100) * width;
  });

  // Draw header background
  setFillColorFromHex(pdf, headerBgColor);
  pdf.rect(x, currentY, width, headerHeight, 'F');

  // Draw header text
  setTextColorFromHex(pdf, headerTextColor);
  pdf.setFontSize(headerFontSize);
  pdf.setFont(FONT_SPECS.family, 'bold');

  columns.forEach((col, i) => {
    const colWidth = (col.width / 100) * width;
    const textX =
      col.align === 'right'
        ? colPositions[i] + colWidth - 2
        : col.align === 'center'
          ? colPositions[i] + colWidth / 2
          : colPositions[i] + 2;

    pdf.text(col.header, textX, currentY + headerHeight / 2 + 1.5, {
      align: col.align || 'left',
    });
  });

  currentY += headerHeight;

  // Draw data rows
  pdf.setFontSize(bodyFontSize);
  pdf.setFont(FONT_SPECS.family, 'normal');

  data.forEach((row, rowIndex) => {
    // Alternate row background
    if (alternateRows && rowIndex % 2 === 0) {
      setFillColorFromHex(pdf, POLITICAL_COLORS.background);
      pdf.rect(x, currentY, width, rowHeight, 'F');
    }

    // Draw cell text
    columns.forEach((col, colIndex) => {
      const value = row[col.key];
      const displayValue = col.format ? col.format(value) : String(value ?? '');

      // Apply color function if provided
      if (col.colorFn) {
        setTextColorFromHex(pdf, col.colorFn(value));
      } else {
        setTextColorFromHex(pdf, POLITICAL_COLORS.textPrimary);
      }

      const colWidth = (col.width / 100) * width;
      const textX =
        col.align === 'right'
          ? colPositions[colIndex] + colWidth - 2
          : col.align === 'center'
            ? colPositions[colIndex] + colWidth / 2
            : colPositions[colIndex] + 2;

      pdf.text(displayValue, textX, currentY + rowHeight / 2 + 1.5, {
        align: col.align || 'left',
      });
    });

    currentY += rowHeight;
  });

  // Draw table border
  setDrawColorFromHex(pdf, borderColor);
  pdf.setLineWidth(0.2);
  pdf.rect(x, y, width, currentY - y, 'S');

  // Draw header separator
  pdf.line(x, y + headerHeight, x + width, y + headerHeight);

  // Restore state
  pdf.setFont(savedFont.fontName, savedFont.fontStyle);
  pdf.setFontSize(savedFontSize);
  pdf.setTextColor(0, 0, 0);

  return currentY; // Return ending Y position
}

// ============================================================================
// SPECIALIZED TABLE RENDERERS
// ============================================================================

/**
 * Render election history results table
 */
export function renderElectionHistoryTable(
  pdf: jsPDF,
  data: ElectionResultRow[],
  x: number,
  y: number,
  width: number
): number {
  const columns: TableColumn[] = [
    { header: 'Year', key: 'year', width: 12, align: 'center' },
    { header: 'Type', key: 'type', width: 15, align: 'left' },
    {
      header: 'Office',
      key: 'office',
      width: 28,
      align: 'left',
      format: (v) => truncateText(v, 25),
    },
    {
      header: 'Dem %',
      key: 'demPct',
      width: 15,
      align: 'right',
      format: (v) => `${v.toFixed(1)}%`,
      colorFn: () => POLITICAL_COLORS.democrat,
    },
    {
      header: 'Rep %',
      key: 'repPct',
      width: 15,
      align: 'right',
      format: (v) => `${v.toFixed(1)}%`,
      colorFn: () => POLITICAL_COLORS.republican,
    },
    {
      header: 'Margin',
      key: 'margin',
      width: 15,
      align: 'right',
      format: (v) => formatPartisanLean(v),
      colorFn: (v) => getPartisanColor(v),
    },
  ];

  return renderTable(pdf, columns, data, {
    x,
    y,
    width,
    rowHeight: 8,  // Increased from 7 for better readability
    headerHeight: 8,
    bodyFontSize: 8,
    headerFontSize: 8,
    headerBgColor: POLITICAL_COLORS.primary,
  });
}

/**
 * Render precinct ranking table (for targeting briefs)
 */
export function renderPrecinctRankingTable(
  pdf: jsPDF,
  data: PrecinctRankingRow[],
  x: number,
  y: number,
  width: number
): number {
  const columns: TableColumn[] = [
    { header: '#', key: 'rank', width: 8, align: 'center' },
    {
      header: 'Precinct',
      key: 'name',
      width: 28,
      align: 'left',
      format: (v) => truncateText(v, 22),
    },
    {
      header: 'GOTV',
      key: 'gotv',
      width: 12,
      align: 'center',
      colorFn: (v) => (v >= 80 ? POLITICAL_COLORS.gotv : POLITICAL_COLORS.textPrimary),
    },
    {
      header: 'Swing',
      key: 'swing',
      width: 12,
      align: 'center',
      colorFn: (v) => (v >= 70 ? POLITICAL_COLORS.swing : POLITICAL_COLORS.textPrimary),
    },
    {
      header: 'Lean',
      key: 'lean',
      width: 15,
      align: 'center',
      format: (v) => formatPartisanLean(v),
      colorFn: (v) => getPartisanColor(v),
    },
    {
      header: 'Voters',
      key: 'voters',
      width: 15,
      align: 'right',
      format: (v) => v.toLocaleString(),
    },
    {
      header: 'Priority',
      key: 'priority',
      width: 10,
      align: 'center',
      colorFn: (v) => {
        switch (v) {
          case 'TOP':
            return POLITICAL_COLORS.gotv;
          case 'HIGH':
            return POLITICAL_COLORS.swing;
          case 'MEDIUM':
            return POLITICAL_COLORS.persuasion;
          default:
            return POLITICAL_COLORS.textMuted;
        }
      },
    },
  ];

  return renderTable(pdf, columns, data, {
    x,
    y,
    width,
    rowHeight: 7,
    headerHeight: 7,
    bodyFontSize: 8,
    headerFontSize: 8,
    headerBgColor: POLITICAL_COLORS.primary,
  });
}

/**
 * Render similar precincts table
 */
export function renderSimilarPrecinctsTable(
  pdf: jsPDF,
  data: SimilarPrecinctRow[],
  x: number,
  y: number,
  width: number
): number {
  const columns: TableColumn[] = [
    {
      header: 'Precinct',
      key: 'name',
      width: 35,
      align: 'left',
      format: (v) => truncateText(v, 28),
    },
    {
      header: 'Lean',
      key: 'lean',
      width: 15,
      align: 'center',
      format: (v) => formatPartisanLean(v),
      colorFn: (v) => getPartisanColor(v),
    },
    {
      header: 'Swing',
      key: 'swing',
      width: 15,
      align: 'center',
      colorFn: (v) => (v >= 70 ? POLITICAL_COLORS.swing : POLITICAL_COLORS.textPrimary),
    },
    {
      header: 'GOTV',
      key: 'gotv',
      width: 15,
      align: 'center',
      format: (v) => (v !== undefined ? String(v) : '-'),
      colorFn: (v) => (v && v >= 80 ? POLITICAL_COLORS.gotv : POLITICAL_COLORS.textPrimary),
    },
    {
      header: 'Similarity',
      key: 'similarity',
      width: 20,
      align: 'center',
      format: (v) => `${v}%`,
      colorFn: (v) => {
        if (v >= 90) return POLITICAL_COLORS.gotv;
        if (v >= 80) return POLITICAL_COLORS.swing;
        if (v >= 70) return POLITICAL_COLORS.persuasion;
        return POLITICAL_COLORS.textPrimary;
      },
    },
  ];

  return renderTable(pdf, columns, data, {
    x,
    y,
    width,
    rowHeight: 7,
    headerHeight: 7,
    bodyFontSize: 8,
    headerFontSize: 8,
    headerBgColor: POLITICAL_COLORS.primary,
  });
}

/**
 * Render comparison table (for side-by-side entity comparison)
 */
export function renderComparisonTable(
  pdf: jsPDF,
  metrics: Array<{
    label: string;
    entityAValue: string;
    entityBValue: string;
    difference?: string;
  }>,
  x: number,
  y: number,
  width: number,
  entityAName: string,
  entityBName: string
): number {
  // Truncate entity names if too long
  const entityA = truncateText(entityAName, 15);
  const entityB = truncateText(entityBName, 15);

  const columns: TableColumn[] = [
    { header: 'Metric', key: 'label', width: 30, align: 'left' },
    { header: entityA, key: 'entityAValue', width: 25, align: 'right' },
    { header: entityB, key: 'entityBValue', width: 25, align: 'right' },
    { header: 'Difference', key: 'difference', width: 20, align: 'right' },
  ];

  return renderTable(pdf, columns, metrics, {
    x,
    y,
    width,
    rowHeight: 7,
    headerHeight: 7,
    bodyFontSize: 8,
    headerFontSize: 8,
    headerBgColor: POLITICAL_COLORS.primary,
  });
}

/**
 * Render segment filter criteria table
 */
export function renderSegmentCriteriaTable(
  pdf: jsPDF,
  criteria: Array<{
    filter: string;
    operator: string;
    value: string;
  }>,
  x: number,
  y: number,
  width: number
): number {
  const columns: TableColumn[] = [
    { header: 'Filter', key: 'filter', width: 40, align: 'left' },
    { header: 'Condition', key: 'operator', width: 25, align: 'center' },
    { header: 'Value', key: 'value', width: 35, align: 'right' },
  ];

  return renderTable(pdf, columns, criteria, {
    x,
    y,
    width,
    rowHeight: 6,
    headerHeight: 6,
    bodyFontSize: 8,
    headerFontSize: 8,
    headerBgColor: POLITICAL_COLORS.secondary,
  });
}

/**
 * Render canvassing turf assignment table
 */
export function renderTurfAssignmentTable(
  pdf: jsPDF,
  turfs: Array<{
    turf: number;
    precinct: string;
    doors: number;
    estMinutes: number;
    priority: 'HIGH' | 'MED' | 'LOW';
    team?: string;
  }>,
  x: number,
  y: number,
  width: number
): number {
  const columns: TableColumn[] = [
    { header: 'Turf', key: 'turf', width: 10, align: 'center' },
    {
      header: 'Precinct',
      key: 'precinct',
      width: 28,
      align: 'left',
      format: (v) => truncateText(v, 22),
    },
    {
      header: 'Doors',
      key: 'doors',
      width: 12,
      align: 'right',
      format: (v) => v.toLocaleString(),
    },
    {
      header: 'Est. Min',
      key: 'estMinutes',
      width: 15,
      align: 'right',
    },
    {
      header: 'Priority',
      key: 'priority',
      width: 15,
      align: 'center',
      colorFn: (v) => {
        switch (v) {
          case 'HIGH':
            return POLITICAL_COLORS.gotv;
          case 'MED':
            return POLITICAL_COLORS.persuasion;
          default:
            return POLITICAL_COLORS.textMuted;
        }
      },
    },
    {
      header: 'Team',
      key: 'team',
      width: 10,
      align: 'center',
      format: (v) => v || '-',
    },
  ];

  return renderTable(pdf, columns, turfs, {
    x,
    y,
    width,
    rowHeight: 7,
    headerHeight: 7,
    bodyFontSize: 8,
    headerFontSize: 8,
    headerBgColor: POLITICAL_COLORS.primary,
  });
}

/**
 * Render donor ZIP code table
 */
export function renderDonorZipTable(
  pdf: jsPDF,
  zips: Array<{
    rank: number;
    zip: string;
    city: string;
    amount: number;
    donors: number;
    avgGift: number;
  }>,
  x: number,
  y: number,
  width: number
): number {
  const columns: TableColumn[] = [
    { header: '#', key: 'rank', width: 8, align: 'center' },
    { header: 'ZIP', key: 'zip', width: 12, align: 'center' },
    {
      header: 'City',
      key: 'city',
      width: 25,
      align: 'left',
      format: (v) => truncateText(v, 18),
    },
    {
      header: 'Amount',
      key: 'amount',
      width: 20,
      align: 'right',
      format: (v) => formatCurrency(v),
    },
    {
      header: 'Donors',
      key: 'donors',
      width: 15,
      align: 'right',
      format: (v) => v.toLocaleString(),
    },
    {
      header: 'Avg Gift',
      key: 'avgGift',
      width: 20,
      align: 'right',
      format: (v) => formatCurrency(v),
    },
  ];

  return renderTable(pdf, columns, zips, {
    x,
    y,
    width,
    rowHeight: 7,
    headerHeight: 7,
    bodyFontSize: 8,
    headerFontSize: 8,
    headerBgColor: POLITICAL_COLORS.primary,
  });
}

// ============================================================================
// UTILITY FUNCTIONS (re-export from shared utils for backwards compatibility)
// ============================================================================

/**
 * Truncate text to max length with ellipsis
 */
function truncateText(text: string, maxLength: number): string {
  return truncateTextUtil(text, maxLength);
}

/**
 * Format currency value
 */
function formatCurrency(value: number): string {
  return formatCurrencyUtil(value);
}

/**
 * Render a simple key-value list (for segment summaries, etc.)
 */
export function renderKeyValueList(
  pdf: jsPDF,
  items: Array<{ key: string; value: string }>,
  x: number,
  y: number,
  width: number,
  options: {
    keyWidth?: number;
    rowHeight?: number;
    fontSize?: number;
  } = {}
): number {
  const { keyWidth = 80, rowHeight = 5, fontSize = 9 } = options;

  // Save state
  const savedFont = pdf.getFont();
  const savedFontSize = pdf.getFontSize();

  pdf.setFontSize(fontSize);
  let currentY = y;

  items.forEach((item) => {
    // Key (bold)
    setTextColorFromHex(pdf, POLITICAL_COLORS.textSecondary);
    pdf.setFont(FONT_SPECS.family, 'bold');
    pdf.text(item.key + ':', x, currentY);

    // Value (normal)
    setTextColorFromHex(pdf, POLITICAL_COLORS.textPrimary);
    pdf.setFont(FONT_SPECS.family, 'normal');
    pdf.text(item.value, x + keyWidth, currentY);

    currentY += rowHeight;
  });

  // Restore state
  pdf.setFont(savedFont.fontName, savedFont.fontStyle);
  pdf.setFontSize(savedFontSize);
  pdf.setTextColor(0, 0, 0);

  return currentY;
}
