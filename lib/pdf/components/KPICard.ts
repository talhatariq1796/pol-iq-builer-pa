/**
 * KPI Card Component for PDF Reports
 * 
 * Renders visually appealing KPI cards with background colors,
 * labels, values, and optional trend indicators.
 */

import jsPDF from 'jspdf';

export interface KPICardOptions {
  label: string;
  value: string;
  trend?: string;
  trendColor?: string;
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
  borderWidth?: number;
}

export const BRAND_COLORS = {
  primary: '#670338',      // Primary burgundy (keep)
  burgundy: '#670338',     // Alias for compatibility
  dark1: '#8a375e',        // Monochromatic dark shade 1
  dark2: '#77294d',        // Monochromatic dark shade 2
  dark3: '#5d1f3d',        // Monochromatic dark shade 3
  dark4: '#49182d',        // Monochromatic dark shade 4
  gray: '#EAE9E9',         // Light gray for backgrounds
  mediumGray: '#9E9E9E',   // Medium gray for text
  darkGray: '#484247',     // Dark gray for headers
  white: '#FFFFFF',
};

/**
 * Render a KPI card with background color, label, value, and optional trend
 * 
 * @param pdf The jsPDF instance
 * @param x X position (mm)
 * @param y Y position (mm)
 * @param width Width of card (mm)
 * @param height Height of card (mm)
 * @param options Card content and styling options
 */
export function renderKPICard(
  pdf: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  options: KPICardOptions
): void {
  const {
    label,
    value,
    trend,
    trendColor,
    backgroundColor = BRAND_COLORS.burgundy,
    textColor = BRAND_COLORS.white,
    borderColor,
    borderWidth = 0,
  } = options;

  // Save current state
  const savedFont = pdf.getFont();
  const savedFontSize = pdf.getFontSize();

  // Draw background
  const bgColor = hexToRGB(backgroundColor);
  pdf.setFillColor(bgColor.r, bgColor.g, bgColor.b);
  pdf.rect(x, y, width, height, 'F');

  // Draw border if specified
  if (borderWidth > 0 && borderColor) {
    const borderRGB = hexToRGB(borderColor);
    pdf.setDrawColor(borderRGB.r, borderRGB.g, borderRGB.b);
    pdf.setLineWidth(borderWidth);
    pdf.rect(x, y, width, height, 'S');
  }

  // Set text color
  const textRGB = hexToRGB(textColor);
  pdf.setTextColor(textRGB.r, textRGB.g, textRGB.b);

  // Calculate vertical center for better layout
  const contentHeight = trend ? 16 : 10; // Approximate total content height
  const startY = y + (height - contentHeight) / 2;

  // Draw label (centered horizontally and vertically)
  pdf.setFontSize(9);
  pdf.setFont(savedFont.fontName, 'normal');
  const labelLines = pdf.splitTextToSize(label, width - 6); // Reduced padding from 4 to 6mm
  const labelY = startY + 4;
  labelLines.forEach((line: string, index: number) => {
    pdf.text(line, x + width / 2, labelY + (index * 3.5), { align: 'center' });
  });

  // Draw value (centered horizontally and vertically)
  const valueY = startY + (labelLines.length * 3.5) + 8;
  pdf.setFontSize(16);
  pdf.setFont(savedFont.fontName, 'bold');
  
  // Split value if too long
  const valueLines = pdf.splitTextToSize(value, width - 6); // Reduced padding
  valueLines.forEach((line: string, index: number) => {
    pdf.text(line, x + width / 2, valueY + (index * 5.5), { align: 'center' });
  });

  // Draw trend if provided (centered horizontally)
  if (trend) {
    const trendY = valueY + (valueLines.length * 5.5) + 4;
    pdf.setFontSize(8);
    pdf.setFont(savedFont.fontName, 'normal');
    
    // Use trend color if specified
    if (trendColor) {
      const trendRGB = hexToRGB(trendColor);
      pdf.setTextColor(trendRGB.r, trendRGB.g, trendRGB.b);
    }
    
    pdf.text(trend, x + width / 2, trendY, { align: 'center' });
  }

  // Restore original state
  pdf.setFont(savedFont.fontName, savedFont.fontStyle);
  pdf.setFontSize(savedFontSize);
  pdf.setTextColor(0, 0, 0); // Reset to black
}

/**
 * Render a grid of KPI cards
 * 
 * @param pdf The jsPDF instance
 * @param startX Starting X position (mm)
 * @param startY Starting Y position (mm)
 * @param cards Array of card options
 * @param columns Number of columns in grid
 * @param cardWidth Width of each card (mm)
 * @param cardHeight Height of each card (mm)
 * @param gapX Horizontal gap between cards (mm)
 * @param gapY Vertical gap between cards (mm)
 */
export function renderKPICardGrid(
  pdf: jsPDF,
  startX: number,
  startY: number,
  cards: KPICardOptions[],
  columns: number = 2,
  cardWidth: number = 40,
  cardHeight: number = 25,
  gapX: number = 5,
  gapY: number = 5
): void {
  cards.forEach((card, index) => {
    const row = Math.floor(index / columns);
    const col = index % columns;
    
    const x = startX + col * (cardWidth + gapX);
    const y = startY + row * (cardHeight + gapY);
    
    renderKPICard(pdf, x, y, cardWidth, cardHeight, card);
  });
}

/**
 * Render a mini stat card (smaller version for inline stats)
 * 
 * @param pdf The jsPDF instance
 * @param x X position (mm)
 * @param y Y position (mm)
 * @param width Width of card (mm)
 * @param height Height of card (mm)
 * @param label Label text
 * @param value Value text
 * @param icon Optional icon/emoji
 */
export function renderMiniStatCard(
  pdf: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  value: string,
  icon?: string
): void {
  // Save state
  const savedFont = pdf.getFont();
  const savedFontSize = pdf.getFontSize();

  // Draw light background
  const bgColor = hexToRGB(BRAND_COLORS.gray);
  pdf.setFillColor(bgColor.r, bgColor.g, bgColor.b);
  pdf.rect(x, y, width, height, 'F');

  // Draw subtle border
  const borderColor = hexToRGB(BRAND_COLORS.darkGray);
  pdf.setDrawColor(borderColor.r, borderColor.g, borderColor.b);
  pdf.setLineWidth(0.2);
  pdf.rect(x, y, width, height, 'S');

  // Draw icon if provided
  let textStartY = y + 5;
  if (icon) {
    pdf.setFontSize(12);
    pdf.text(icon, x + width / 2, textStartY, { align: 'center' });
    textStartY += 5;
  }

  // Draw label
  pdf.setFontSize(7);
  pdf.setFont(savedFont.fontName, 'normal');
  pdf.setTextColor(100, 100, 100);
  pdf.text(label, x + width / 2, textStartY, { align: 'center' });

  // Draw value
  pdf.setFontSize(11);
  pdf.setFont(savedFont.fontName, 'bold');
  pdf.setTextColor(0, 0, 0);
  const valueLines = pdf.splitTextToSize(value, width - 2);
  valueLines.forEach((line: string, index: number) => {
    pdf.text(line, x + width / 2, textStartY + 5 + (index * 4), { align: 'center' });
  });

  // Restore state
  pdf.setFont(savedFont.fontName, savedFont.fontStyle);
  pdf.setFontSize(savedFontSize);
  pdf.setTextColor(0, 0, 0);
}

/**
 * Get trend color based on value
 * 
 * @param value Numeric value to evaluate
 * @param isPositiveGood Whether positive values are good (default true)
 * @returns Color hex code
 */
export function getTrendColor(value: number, isPositiveGood: boolean = true): string {
  if (value === 0) return BRAND_COLORS.darkGray;
  
  const isPositive = value > 0;
  
  // Use dark1 for positive (monochromatic), keep red for negative
  if (isPositiveGood) {
    return isPositive ? BRAND_COLORS.dark1 : '#E74C3C'; // Red for negative
  } else {
    return isPositive ? '#E74C3C' : BRAND_COLORS.dark1;
  }
}

/**
 * Format trend indicator with arrow
 * 
 * @param value Numeric value
 * @param suffix Optional suffix (e.g., '%', 'pts')
 * @returns Formatted string with arrow
 */
export function formatTrendIndicator(value: number, suffix: string = ''): string {
  if (value === 0) return `→ 0${suffix}`;
  
  const arrow = value > 0 ? '↑' : '↓';
  const absValue = Math.abs(value);
  
  return `${arrow} ${absValue.toFixed(1)}${suffix}`;
}

/**
 * Convert hex color to RGB object
 */
function hexToRGB(hex: string): { r: number; g: number; b: number } {
  // Remove # if present
  const cleanHex = hex.replace('#', '');
  
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  
  return { r, g, b };
}
