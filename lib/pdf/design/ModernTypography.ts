/**
 * Modern Typography System
 * Based on modern infographic design specification
 */

export const ModernTypography = {
  // Font Families
  fonts: {
    primary: 'Helvetica',
    secondary: 'Helvetica-Bold',
    monospace: 'Courier',
  },

  // Font Sizes (in points) - Reduced for clean professional PDF layout
  sizes: {
    hero: 22,           // Large headings, hero numbers (was 48)
    h1: 16,             // Page titles, major metrics (was 36)
    h2: 14,             // Section headers (was 28)
    h3: 12,             // Subsection headers (was 20)
    h4: 11,             // Card titles (was 16)
    body: 9,            // Body text (was 12)
    small: 8,           // Secondary text (was 10)
    tiny: 7,            // Labels, captions (was 8)
  },

  // Line Heights (multipliers) - adjusted for better readability like reference
  lineHeights: {
    tight: 1.1,         // Large numbers, metrics (tighter for impact)
    normal: 1.5,        // Body text (standard readability)
    relaxed: 1.75,      // Paragraphs with breathing room (slightly tighter than before)
    spacious: 2.0,      // Generous spacing for important sections
  },

  // Font Weights (Helvetica variants)
  weights: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    light: 'Helvetica',  // Helvetica doesn't have a light variant in standard PDFs
  },

  // Letter Spacing (in points) - adjusted for modern infographic style
  letterSpacing: {
    tight: -0.3,       // Slightly less tight (better for headings)
    normal: 0,         // Standard spacing
    wide: 0.8,         // Wider for uppercase labels (like reference)
    wider: 1.2,        // Even wider for section headers
  },
} as const;

/**
 * Typography Scale - Predefined text styles
 */
export const TypographyStyles = {
  // Hero Heading (48px, bold, tight)
  hero: {
    font: ModernTypography.fonts.secondary,
    fontSize: ModernTypography.sizes.hero,
    lineHeight: ModernTypography.lineHeights.tight,
    letterSpacing: ModernTypography.letterSpacing.tight,
  },

  // H1 - Page Titles (36px, bold)
  h1: {
    font: ModernTypography.fonts.secondary,
    fontSize: ModernTypography.sizes.h1,
    lineHeight: ModernTypography.lineHeights.tight,
    letterSpacing: ModernTypography.letterSpacing.wide,  // Wider for impact (like reference)
  },

  // H2 - Section Headers (28px, bold)
  h2: {
    font: ModernTypography.fonts.secondary,
    fontSize: ModernTypography.sizes.h2,
    lineHeight: ModernTypography.lineHeights.tight,
    letterSpacing: ModernTypography.letterSpacing.wide,  // Wider for section headers
  },

  // H3 - Subsection Headers (20px, bold)
  h3: {
    font: ModernTypography.fonts.secondary,
    fontSize: ModernTypography.sizes.h3,
    lineHeight: ModernTypography.lineHeights.normal,
    letterSpacing: ModernTypography.letterSpacing.normal,
  },

  // H4 - Card Titles (16px, bold)
  h4: {
    font: ModernTypography.fonts.secondary,
    fontSize: ModernTypography.sizes.h4,
    lineHeight: ModernTypography.lineHeights.normal,
    letterSpacing: ModernTypography.letterSpacing.normal,
  },

  // Body - Regular text (12px, normal)
  body: {
    font: ModernTypography.fonts.primary,
    fontSize: ModernTypography.sizes.body,
    lineHeight: ModernTypography.lineHeights.normal,
    letterSpacing: ModernTypography.letterSpacing.normal,
  },

  // Body Bold - Emphasized text (12px, bold)
  bodyBold: {
    font: ModernTypography.fonts.secondary,
    fontSize: ModernTypography.sizes.body,
    lineHeight: ModernTypography.lineHeights.normal,
    letterSpacing: ModernTypography.letterSpacing.normal,
  },

  // Small - Secondary text (10px, normal)
  small: {
    font: ModernTypography.fonts.primary,
    fontSize: ModernTypography.sizes.small,
    lineHeight: ModernTypography.lineHeights.normal,
    letterSpacing: ModernTypography.letterSpacing.normal,
  },

  // Small Bold - Labels (10px, bold)
  smallBold: {
    font: ModernTypography.fonts.secondary,
    fontSize: ModernTypography.sizes.small,
    lineHeight: ModernTypography.lineHeights.normal,
    letterSpacing: ModernTypography.letterSpacing.wide,
  },

  // Tiny - Captions (8px, normal)
  tiny: {
    font: ModernTypography.fonts.primary,
    fontSize: ModernTypography.sizes.tiny,
    lineHeight: ModernTypography.lineHeights.normal,
    letterSpacing: ModernTypography.letterSpacing.normal,
  },

  // Metric - Large numbers (36px, bold, tight)
  metric: {
    font: ModernTypography.fonts.secondary,
    fontSize: ModernTypography.sizes.h1,
    lineHeight: ModernTypography.lineHeights.tight,
    letterSpacing: ModernTypography.letterSpacing.tight,
  },

  // Price - Large price numbers (48px, bold, tight)
  price: {
    font: ModernTypography.fonts.secondary,
    fontSize: ModernTypography.sizes.hero,
    lineHeight: ModernTypography.lineHeights.tight,
    letterSpacing: ModernTypography.letterSpacing.tight,
  },

  // Label - Uppercase labels (10px, bold, wide)
  label: {
    font: ModernTypography.fonts.secondary,
    fontSize: ModernTypography.sizes.small,
    lineHeight: ModernTypography.lineHeights.normal,
    letterSpacing: ModernTypography.letterSpacing.wider,
  },
} as const;

/**
 * Helper function to apply typography style to PDF document
 */
export interface TextStyle {
  font: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
}

/**
 * Calculate text height based on style and content
 */
export function calculateTextHeight(
  text: string,
  style: TextStyle,
  maxWidth: number
): number {
  // Rough estimation: character width is ~0.6 of font size
  const avgCharWidth = style.fontSize * 0.6;
  const charsPerLine = Math.floor(maxWidth / avgCharWidth);
  const lines = Math.ceil(text.length / charsPerLine);
  return lines * (style.fontSize * style.lineHeight);
}

/**
 * Wrap text to fit within max width
 */
export function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
  const avgCharWidth = fontSize * 0.6;
  const maxCharsPerLine = Math.floor(maxWidth / avgCharWidth);

  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (testLine.length <= maxCharsPerLine) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Format number with typography style
 */
export function formatMetricNumber(value: number, decimals = 0): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(decimals)}M`;
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(decimals)}K`;
  }
  return value.toFixed(decimals);
}

/**
 * Format currency with typography style
 * Handles null, undefined, and invalid values gracefully
 */
export function formatCurrency(value: number | null | undefined, decimals = 0): string {
  // Handle null, undefined, or invalid values
  if (value === null || value === undefined || isNaN(value)) {
    return '$0';
  }

  // Ensure value is a number
  const numValue = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(numValue)) {
    return '$0';
  }

  if (numValue >= 1000000) {
    return `$${(numValue / 1000000).toFixed(1)}M`;
  } else if (numValue >= 1000) {
    return `$${(numValue / 1000).toFixed(0)}K`;
  }
  return `$${numValue.toFixed(decimals)}`;
}

export type Typography = typeof ModernTypography;
export type TypographyStyleName = keyof typeof TypographyStyles;

/**
 * Advanced text truncation utilities
 * Import from TextTruncationUtils for PDF-specific implementations
 */
import jsPDF from 'jspdf';

/**
 * Truncate text to fit within specified width (uses jsPDF text measurement)
 * @param pdf - jsPDF instance for accurate text measurement
 * @param text - Text to truncate
 * @param maxWidth - Maximum width in PDF units
 * @param fontSize - Font size in points
 * @param font - Font name
 * @returns Truncated text with ellipsis if needed
 */
export function truncateTextToWidth(
  pdf: jsPDF,
  text: string,
  maxWidth: number,
  fontSize: number,
  font: string = 'helvetica'
): string {
  pdf.setFont(font, 'normal');
  pdf.setFontSize(fontSize);

  const textWidth = pdf.getTextWidth(text);
  if (textWidth <= maxWidth) {
    return text;
  }

  // Binary search for optimal truncation point
  const ellipsis = '...';
  const ellipsisWidth = pdf.getTextWidth(ellipsis);
  let left = 0;
  let right = text.length;
  let bestFit = '';

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const truncated = text.substring(0, mid) + ellipsis;
    const width = pdf.getTextWidth(truncated);

    if (width <= maxWidth) {
      bestFit = truncated;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  return bestFit || ellipsis;
}

/**
 * Wrap and truncate text to fit within box dimensions
 * @param pdf - jsPDF instance
 * @param text - Text to wrap
 * @param maxWidth - Maximum width in PDF units
 * @param maxLines - Maximum number of lines
 * @param fontSize - Font size in points
 * @returns Array of wrapped lines (truncated if needed)
 */
export function wrapAndTruncateText(
  pdf: jsPDF,
  text: string,
  maxWidth: number,
  maxLines: number,
  fontSize: number,
  font: string = 'helvetica'
): string[] {
  pdf.setFont(font, 'normal');
  pdf.setFontSize(fontSize);

  const wrappedLines = pdf.splitTextToSize(text, maxWidth);
  const linesArray = Array.isArray(wrappedLines) ? wrappedLines : [wrappedLines];

  if (linesArray.length <= maxLines) {
    return linesArray;
  }

  // Truncate to max lines and add ellipsis
  const truncatedLines = linesArray.slice(0, maxLines);
  const lastLine = truncatedLines[truncatedLines.length - 1];
  const lastLineWithEllipsis = truncateTextToWidth(pdf, lastLine, maxWidth, fontSize, font);
  truncatedLines[truncatedLines.length - 1] = lastLineWithEllipsis;

  return truncatedLines;
}

/**
 * Calculate optimal font size to fit text in a box
 * @param pdf - jsPDF instance
 * @param text - Text to fit
 * @param boxWidth - Box width in PDF units
 * @param boxHeight - Box height in PDF units
 * @param initialFontSize - Starting font size
 * @param minFontSize - Minimum allowed font size
 * @param lineHeight - Line height multiplier
 * @returns Optimal font size
 */
export function calculateFitFontSize(
  pdf: jsPDF,
  text: string,
  boxWidth: number,
  boxHeight: number,
  initialFontSize: number,
  minFontSize: number = 6,
  lineHeight: number = 1.5
): number {
  let fontSize = initialFontSize;

  while (fontSize >= minFontSize) {
    pdf.setFontSize(fontSize);
    const wrappedLines = pdf.splitTextToSize(text, boxWidth);
    const linesArray = Array.isArray(wrappedLines) ? wrappedLines : [wrappedLines];
    const totalHeight = linesArray.length * fontSize * lineHeight;

    if (totalHeight <= boxHeight) {
      return fontSize;
    }

    fontSize -= 0.5;
  }

  return minFontSize;
}

/**
 * Measure text dimensions
 * @param pdf - jsPDF instance
 * @param text - Text to measure
 * @param fontSize - Font size in points
 * @param font - Font name
 * @returns Object with width and height
 */
export function measureText(
  pdf: jsPDF,
  text: string,
  fontSize: number,
  font: string = 'helvetica',
  lineHeight: number = 1.5
): { width: number; height: number; lines: number } {
  pdf.setFont(font, 'normal');
  pdf.setFontSize(fontSize);

  const lines = text.split('\n');
  const widths = lines.map(line => pdf.getTextWidth(line));
  const maxWidth = Math.max(...widths);
  const height = lines.length * fontSize * lineHeight;

  return {
    width: maxWidth,
    height,
    lines: lines.length,
  };
}
