/**
 * TableRenderer Component
 * Renders professional tables with headers, borders, and alternating row colors
 * Supports status badges, icons, and flexible column configurations
 */

import jsPDF from 'jspdf';
import { BRAND_COLORS } from '../templates/PageTemplates';

export interface TableColumn {
  key: string;
  header: string;
  width: number; // Width in mm
  align?: 'left' | 'center' | 'right';
  format?: (value: unknown) => string;
  renderCell?: (pdf: jsPDF, value: unknown, x: number, y: number, width: number, height: number) => void;
}

export interface TableConfig {
  x: number; // Starting X position in mm
  y: number; // Starting Y position in mm
  columns: TableColumn[];
  rowHeight?: number; // Height of each row in mm (default: 8)
  headerHeight?: number; // Height of header row in mm (default: 10)
  fontSize?: number; // Body font size in pt (default: 8)
  headerFontSize?: number; // Header font size in pt (default: 9)
  alternateRowColor?: boolean; // Enable alternating row colors (default: true)
  showBorders?: boolean; // Show cell borders (default: true)
  maxRows?: number; // Maximum number of rows to display
}

export interface TableRow {
  [key: string]: unknown;
}

/**
 * Render a professional table with headers, borders, and styled rows
 */
export function renderTable(
  pdf: jsPDF,
  data: TableRow[],
  config: TableConfig
): number {
  const {
    x,
    y,
    columns,
    rowHeight = 8,
    headerHeight = 10,
    fontSize = 8,
    headerFontSize = 9,
    alternateRowColor = true,
    showBorders = true,
    maxRows,
  } = config;

  let currentY = y;
  const tableWidth = columns.reduce((sum, col) => sum + col.width, 0);
  const displayData = maxRows ? data.slice(0, maxRows) : data;

  // Render header row
  currentY = renderTableHeader(pdf, columns, x, currentY, headerHeight, headerFontSize);

  // Render data rows
  displayData.forEach((row, index) => {
    const isAlternate = alternateRowColor && index % 2 === 1;
    currentY = renderTableRow(
      pdf,
      row,
      columns,
      x,
      currentY,
      rowHeight,
      fontSize,
      isAlternate,
      showBorders
    );
  });

  // Draw bottom border
  if (showBorders) {
    pdf.setDrawColor(BRAND_COLORS.mediumGray);
    pdf.setLineWidth(0.3);
    pdf.line(x, currentY, x + tableWidth, currentY);
  }

  return currentY;
}

/**
 * Render table header row
 */
function renderTableHeader(
  pdf: jsPDF,
  columns: TableColumn[],
  x: number,
  y: number,
  height: number,
  fontSize: number
): number {
  let currentX = x;

  // Header background
  pdf.setFillColor(BRAND_COLORS.burgundy);
  const tableWidth = columns.reduce((sum, col) => sum + col.width, 0);
  pdf.rect(x, y, tableWidth, height, 'F');

  // Header text
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(fontSize);
  pdf.setTextColor('#FFFFFF');

  columns.forEach((column) => {
    const align = column.align || 'left';
    const textY = y + height / 2 + 1.5; // Vertically center text

    let textX = currentX;
    if (align === 'center') {
      textX = currentX + column.width / 2;
    } else if (align === 'right') {
      textX = currentX + column.width - 2;
    } else {
      textX = currentX + 2; // Left padding
    }

    pdf.text(column.header, textX, textY, { align });
    currentX += column.width;
  });

  // Reset text color
  pdf.setTextColor(BRAND_COLORS.darkGray);

  return y + height;
}

/**
 * Render a single table row
 */
function renderTableRow(
  pdf: jsPDF,
  row: TableRow,
  columns: TableColumn[],
  x: number,
  y: number,
  height: number,
  fontSize: number,
  isAlternate: boolean,
  showBorders: boolean
): number {
  let currentX = x;
  const tableWidth = columns.reduce((sum, col) => sum + col.width, 0);

  // Alternating row background
  if (isAlternate) {
    pdf.setFillColor('#F9F9F9');
    pdf.rect(x, y, tableWidth, height, 'F');
  }

  // Cell borders (vertical lines)
  if (showBorders) {
    pdf.setDrawColor(BRAND_COLORS.lightGray);
    pdf.setLineWidth(0.2);
    
    let borderX = x;
    columns.forEach((column) => {
      // Draw left border of cell
      pdf.line(borderX, y, borderX, y + height);
      borderX += column.width;
    });
    // Draw right border of last cell
    pdf.line(borderX, y, borderX, y + height);

    // Draw horizontal line below row
    pdf.setDrawColor(BRAND_COLORS.mediumGray);
    pdf.setLineWidth(0.1);
    pdf.line(x, y + height, x + tableWidth, y + height);
  }

  // Cell content
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(fontSize);
  pdf.setTextColor(BRAND_COLORS.darkGray);

  columns.forEach((column) => {
    const value = row[column.key];

    // Use custom cell renderer if provided
    if (column.renderCell) {
      column.renderCell(pdf, value, currentX, y, column.width, height);
    } else {
      // Default text rendering
      const displayValue = column.format ? column.format(value) : String(value || '');
      const align = column.align || 'left';
      const textY = y + height / 2 + 1.5; // Vertically center text

      let textX = currentX;
      if (align === 'center') {
        textX = currentX + column.width / 2;
      } else if (align === 'right') {
        textX = currentX + column.width - 2;
      } else {
        textX = currentX + 2; // Left padding
      }

      // Truncate text if too long
      const maxWidth = column.width - 4;
      const truncatedText = truncateText(pdf, displayValue, maxWidth);
      pdf.text(truncatedText, textX, textY, { align });
    }

    currentX += column.width;
  });

  return y + height;
}

/**
 * Render a status badge (colored pill with text)
 */
export function renderStatusBadge(
  pdf: jsPDF,
  status: string,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  // Badge should fit within column width with 2mm padding on each side
  const badgeWidth = Math.min(20, width - 4); // Max 20mm, but adapt to column width
  const badgeHeight = 5;
  const badgeX = x + (width - badgeWidth) / 2;
  const badgeY = y + (height - badgeHeight) / 2;

  // Determine badge color based on status
  let fillColor: string = BRAND_COLORS.mediumGray;
  let textColor = '#FFFFFF';

  const statusLower = status.toLowerCase();
  if (statusLower === 'active' || statusLower === 'for sale') {
    fillColor = '#0BB95F'; // Green
  } else if (statusLower === 'sold' || statusLower === 'closed') {
    fillColor = '#670338'; // Burgundy
  } else if (statusLower === 'pending' || statusLower === 'under contract') {
    fillColor = '#DDD70F'; // Yellow
    textColor = BRAND_COLORS.darkGray;
  }

  // Draw rounded rectangle badge
  pdf.setFillColor(fillColor);
  pdf.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 1, 1, 'F');

  // Draw badge text
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7);
  pdf.setTextColor(textColor);
  pdf.text(status.toUpperCase(), badgeX + badgeWidth / 2, badgeY + badgeHeight / 2 + 1, {
    align: 'center',
  });

  // Reset colors
  pdf.setTextColor(BRAND_COLORS.darkGray);
}

/**
 * Render property image thumbnail (placeholder if no image available)
 */
export function renderPropertyThumbnail(
  pdf: jsPDF,
  imageData: string | undefined,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  const thumbSize = Math.min(width - 2, height - 2);
  const thumbX = x + (width - thumbSize) / 2;
  const thumbY = y + (height - thumbSize) / 2;

  if (imageData && imageData.startsWith('data:image')) {
    try {
      // Render actual image
      pdf.addImage(imageData, 'JPEG', thumbX, thumbY, thumbSize, thumbSize);
    } catch (error) {
      console.warn('[renderPropertyThumbnail] Failed to render image:', error);
      renderImagePlaceholder(pdf, thumbX, thumbY, thumbSize);
    }
  } else {
    // Render placeholder
    renderImagePlaceholder(pdf, thumbX, thumbY, thumbSize);
  }
}

/**
 * Render placeholder for missing property image
 */
function renderImagePlaceholder(
  pdf: jsPDF,
  x: number,
  y: number,
  size: number
): void {
  // Gray border
  pdf.setDrawColor(BRAND_COLORS.mediumGray);
  pdf.setLineWidth(0.3);
  pdf.rect(x, y, size, size);

  // House icon (simple representation)
  pdf.setFillColor(BRAND_COLORS.lightGray);
  
  // Roof triangle
  const roofY = y + size * 0.3;
  const roofTop = y + size * 0.15;
  const centerX = x + size / 2;
  pdf.triangle(
    x + size * 0.25, roofY,
    x + size * 0.75, roofY,
    centerX, roofTop,
    'F'
  );

  // House body rectangle
  const bodyY = roofY;
  const bodyHeight = size * 0.5;
  const bodyWidth = size * 0.4;
  const bodyX = x + (size - bodyWidth) / 2;
  pdf.rect(bodyX, bodyY, bodyWidth, bodyHeight, 'F');
}

/**
 * Truncate text to fit within specified width
 */
function truncateText(pdf: jsPDF, text: string, maxWidth: number): string {
  const textWidth = pdf.getTextWidth(text);
  
  if (textWidth <= maxWidth) {
    return text;
  }

  // Binary search for optimal length
  let left = 0;
  let right = text.length;
  let result = text;

  while (left < right) {
    const mid = Math.floor((left + right + 1) / 2);
    const truncated = text.substring(0, mid) + '...';
    const truncatedWidth = pdf.getTextWidth(truncated);

    if (truncatedWidth <= maxWidth) {
      result = truncated;
      left = mid;
    } else {
      right = mid - 1;
    }
  }

  return result;
}

/**
 * Render a mini statistics card within a table cell
 */
export function renderCellStats(
  pdf: jsPDF,
  stats: { label: string; value: string }[],
  x: number,
  y: number,
  width: number,
  height: number
): void {
  const padding = 1;
  const lineHeight = height / stats.length;

  stats.forEach((stat, index) => {
    const lineY = y + index * lineHeight;
    
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(6);
    pdf.setTextColor(BRAND_COLORS.mediumGray);
    pdf.text(stat.label, x + padding, lineY + lineHeight / 2 - 0.5);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.setTextColor(BRAND_COLORS.darkGray);
    pdf.text(stat.value, x + padding, lineY + lineHeight / 2 + 1.5);
  });

  // Reset colors
  pdf.setTextColor(BRAND_COLORS.darkGray);
}
