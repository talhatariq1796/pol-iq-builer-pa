/**
 * Text Truncation Utilities for PDF Generation
 * Prevents content overflow by measuring and truncating text
 */

import jsPDF from 'jspdf';

export interface TextFitResult {
  text: string;
  fontSize: number;
  truncated: boolean;
  lines?: string[];
}

export interface TextMeasurement {
  width: number;
  height: number;
  fitsInBox: boolean;
}

/**
 * Measure text width using jsPDF's text measurement
 */
export function measureTextWidth(
  pdf: jsPDF,
  text: string,
  fontSize: number,
  font: string = 'helvetica',
  fontStyle: string = 'normal'
): number {
  // Save current state
  const currentFont = pdf.getFont();
  const currentFontSize = pdf.getFontSize();

  // Set font for measurement
  pdf.setFont(font, fontStyle);
  pdf.setFontSize(fontSize);

  // Measure width
  const width = pdf.getTextWidth(text);

  // Restore state
  pdf.setFont(currentFont.fontName, currentFont.fontStyle);
  pdf.setFontSize(currentFontSize);

  return width;
}

/**
 * Truncate text with ellipsis to fit within max width
 */
export function truncateText(
  pdf: jsPDF,
  text: string,
  maxWidth: number,
  fontSize: number,
  font: string = 'helvetica',
  fontStyle: string = 'normal',
  ellipsis: string = '...'
): string {
  if (!text || text.length === 0) {
    return '';
  }

  // Measure full text width
  const fullWidth = measureTextWidth(pdf, text, fontSize, font, fontStyle);

  // If text fits, return as-is
  if (fullWidth <= maxWidth) {
    return text;
  }

  // Measure ellipsis width

  // Binary search for optimal truncation point
  let left = 0;
  let right = text.length;
  let bestFit = '';

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const truncated = text.substring(0, mid) + ellipsis;
    const width = measureTextWidth(pdf, truncated, fontSize, font, fontStyle);

    if (width <= maxWidth) {
      bestFit = truncated;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  // Ensure we have at least some text visible
  if (bestFit === ellipsis || bestFit.length < ellipsis.length) {
    // Try to show at least one character
    const minText = text.substring(0, 1) + ellipsis;
    const minWidth = measureTextWidth(pdf, minText, fontSize, font, fontStyle);
    if (minWidth <= maxWidth) {
      return minText;
    }
    return ellipsis;
  }

  return bestFit;
}

/**
 * Wrap text into lines respecting max width and max lines
 */
export function wrapTextToLines(
  pdf: jsPDF,
  text: string,
  maxWidth: number,
  maxLines: number,
  fontSize: number,
  font: string = 'helvetica',
  fontStyle: string = 'normal',
  ellipsis: string = '...'
): string[] {
  if (!text || text.length === 0) {
    return [];
  }

  // Use jsPDF's built-in text splitting for accurate word wrapping
  const currentFont = pdf.getFont();
  const currentFontSize = pdf.getFontSize();

  pdf.setFont(font, fontStyle);
  pdf.setFontSize(fontSize);

  const wrappedLines = pdf.splitTextToSize(text, maxWidth);
  const linesArray = Array.isArray(wrappedLines) ? wrappedLines : [wrappedLines];

  pdf.setFont(currentFont.fontName, currentFont.fontStyle);
  pdf.setFontSize(currentFontSize);

  // If within line limit, return as-is
  if (!maxLines || linesArray.length <= maxLines) {
    return linesArray;
  }

  // Truncate to max lines and add ellipsis to last line
  const truncatedLines = linesArray.slice(0, maxLines);
  const lastLine = truncatedLines[truncatedLines.length - 1];

  // Add ellipsis to last line (may need to truncate further)
  const lastLineWithEllipsis = truncateText(
    pdf,
    lastLine,
    maxWidth,
    fontSize,
    font,
    fontStyle,
    ellipsis
  );

  truncatedLines[truncatedLines.length - 1] = lastLineWithEllipsis;

  return truncatedLines;
}

/**
 * Fit text within a box by auto-adjusting font size
 */
export function fitTextToBox(
  pdf: jsPDF,
  text: string,
  boxWidth: number,
  boxHeight: number,
  initialFontSize: number,
  minFontSize: number = 6,
  maxFontSize?: number,
  font: string = 'helvetica',
  fontStyle: string = 'normal',
  lineHeight: number = 1.5
): TextFitResult {
  if (!text || text.length === 0) {
    return {
      text: '',
      fontSize: initialFontSize,
      truncated: false,
      lines: [],
    };
  }

  const maxSize = maxFontSize || initialFontSize;
  let currentFontSize = Math.min(initialFontSize, maxSize);
  let lines: string[] = [];

  // Try progressively smaller font sizes until text fits
  while (currentFontSize >= minFontSize) {
    // Wrap text at current font size
    pdf.setFont(font, fontStyle);
    pdf.setFontSize(currentFontSize);

    const wrappedLines = pdf.splitTextToSize(text, boxWidth);
    lines = Array.isArray(wrappedLines) ? wrappedLines : [wrappedLines];

    // Calculate total height needed
    const totalHeight = lines.length * currentFontSize * lineHeight;

    // Check if it fits
    if (totalHeight <= boxHeight) {
      // It fits!
      return {
        text: lines.join('\n'),
        fontSize: currentFontSize,
        truncated: false,
        lines,
      };
    }

    // Try smaller font size
    currentFontSize -= 0.5;
  }

  // Even at minimum size, text doesn't fit - truncate lines
  pdf.setFont(font, fontStyle);
  pdf.setFontSize(minFontSize);

  // Calculate max lines that fit
  const maxLines = Math.floor(boxHeight / (minFontSize * lineHeight));

  if (maxLines < 1) {
    // Box too small even for one line
    return {
      text: '...',
      fontSize: minFontSize,
      truncated: true,
      lines: ['...'],
    };
  }

  // Truncate to max lines
  const fittedLines = wrapTextToLines(
    pdf,
    text,
    boxWidth,
    maxLines,
    minFontSize,
    font,
    fontStyle
  );

  return {
    text: fittedLines.join('\n'),
    fontSize: minFontSize,
    truncated: true,
    lines: fittedLines,
  };
}

/**
 * Measure if text fits in a box without modifications
 */
export function measureTextFit(
  pdf: jsPDF,
  text: string,
  boxWidth: number,
  boxHeight: number,
  fontSize: number,
  font: string = 'helvetica',
  fontStyle: string = 'normal',
  lineHeight: number = 1.5
): TextMeasurement {
  if (!text || text.length === 0) {
    return { width: 0, height: 0, fitsInBox: true };
  }

  pdf.setFont(font, fontStyle);
  pdf.setFontSize(fontSize);

  // Wrap text
  const wrappedLines = pdf.splitTextToSize(text, boxWidth);
  const lines = Array.isArray(wrappedLines) ? wrappedLines : [wrappedLines];

  // Calculate dimensions
  const maxLineWidth = Math.max(...lines.map(line => pdf.getTextWidth(line)));
  const totalHeight = lines.length * fontSize * lineHeight;

  return {
    width: maxLineWidth,
    height: totalHeight,
    fitsInBox: maxLineWidth <= boxWidth && totalHeight <= boxHeight,
  };
}

/**
 * Smart truncate: Uses ellipsis in middle for long single words/paths
 */
export function smartTruncate(
  pdf: jsPDF,
  text: string,
  maxWidth: number,
  fontSize: number,
  font: string = 'helvetica',
  fontStyle: string = 'normal'
): string {
  if (!text || text.length === 0) {
    return '';
  }

  const fullWidth = measureTextWidth(pdf, text, fontSize, font, fontStyle);

  if (fullWidth <= maxWidth) {
    return text;
  }

  // Check if it's a single long word (no spaces)
  const hasSpaces = text.includes(' ');

  if (!hasSpaces && text.length > 20) {
    // Use middle ellipsis for long single words/paths
    const ellipsis = '...';
    const targetLength = Math.floor(text.length * (maxWidth / fullWidth));
    const sideLength = Math.floor((targetLength - ellipsis.length) / 2);

    if (sideLength < 1) {
      return ellipsis;
    }

    const start = text.substring(0, sideLength);
    const end = text.substring(text.length - sideLength);
    const result = start + ellipsis + end;

    // Verify it fits
    const resultWidth = measureTextWidth(pdf, result, fontSize, font, fontStyle);
    if (resultWidth <= maxWidth) {
      return result;
    }
  }

  // Fall back to regular truncation
  return truncateText(pdf, text, maxWidth, fontSize, font, fontStyle);
}

/**
 * Truncate each line in a multi-line text block
 */
export function truncateLines(
  pdf: jsPDF,
  lines: string[],
  maxWidth: number,
  fontSize: number,
  font: string = 'helvetica',
  fontStyle: string = 'normal'
): string[] {
  return lines.map(line =>
    truncateText(pdf, line, maxWidth, fontSize, font, fontStyle)
  );
}

/**
 * Calculate optimal font size for text to fit in box
 */
export function calculateOptimalFontSize(
  pdf: jsPDF,
  text: string,
  boxWidth: number,
  boxHeight: number,
  minFontSize: number = 6,
  maxFontSize: number = 24,
  font: string = 'helvetica',
  fontStyle: string = 'normal',
  lineHeight: number = 1.5
): number {
  let optimalSize = maxFontSize;

  for (let size = maxFontSize; size >= minFontSize; size -= 0.5) {
    const measurement = measureTextFit(
      pdf,
      text,
      boxWidth,
      boxHeight,
      size,
      font,
      fontStyle,
      lineHeight
    );

    if (measurement.fitsInBox) {
      optimalSize = size;
      break;
    }
  }

  return optimalSize;
}
