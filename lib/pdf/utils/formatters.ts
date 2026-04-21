/**
 * PDF Formatting Utilities
 * 
 * Consistent number, currency, and percentage formatting for PDF generation
 */

/**
 * Format as currency with optional decimal places
 */
export function formatCurrency(value: number | null | undefined, decimals: number = 0): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '$0';
  }
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format as percentage with 2 decimal places
 */
export function formatPercent(value: number | null | undefined, decimals: number = 2): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '0.00%';
  }
  
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format large numbers with K/M suffixes
 */
export function formatLargeNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '0';
  }
  
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  
  return value.toFixed(0);
}

/**
 * Format number with commas
 */
export function formatNumber(value: number | null | undefined, decimals: number = 0): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '0';
  }
  
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Calculate and format year-over-year change
 */
export function formatYoYChange(current: number | null | undefined, previous: number | null | undefined): string {
  if (!current || !previous || previous === 0) {
    return '—';
  }
  
  const change = ((current - previous) / previous) * 100;
  const arrow = change > 0 ? '↑' : change < 0 ? '↓' : '→';
  const absChange = Math.abs(change);
  
  return `${arrow} ${absChange.toFixed(1)}%`;
}

/**
 * Format trend indicator with current and previous values
 */
export function formatTrend(current: number, previous: number): string {
  if (!previous || previous === 0) {
    return '→ 0.0%';
  }
  
  const change = ((current - previous) / previous) * 100;
  const arrow = change > 0 ? '↑' : change < 0 ? '↓' : '→';
  
  return `${arrow} ${Math.abs(change).toFixed(1)}%`;
}

/**
 * Format trend indicator from single value (used for direct percentage changes)
 */
export function formatTrendValue(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '→ 0.0%';
  }
  
  const arrow = value > 0 ? '↑' : value < 0 ? '↓' : '→';
  const absValue = Math.abs(value);
  
  return `${arrow} ${absValue.toFixed(1)}%`;
}

/**
 * Truncate text to fit within max length
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Calculate maximum lines that fit in a text box
 */
export function calculateMaxLines(
  boxHeight: number, // in mm
  fontSize: number,   // in pt
  lineHeightMultiplier: number = 1.5
): number {
  // Convert font size from pt to mm (1 pt ≈ 0.353 mm)
  const fontSizeMM = fontSize * 0.353;
  const lineHeightMM = fontSizeMM * lineHeightMultiplier;
  
  return Math.floor(boxHeight / lineHeightMM);
}

/**
 * Split text into lines that fit within width
 */
export function splitTextToFitWidth(
  pdf: any,
  text: string,
  maxWidth: number // in mm
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = pdf.getTextWidth(testLine);
    
    if (width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  
  if (currentLine) {
    lines.push(currentLine);
  }
  
  return lines;
}

/**
 * Truncate text to fit within box dimensions
 */
export function fitTextToBox(
  pdf: any,
  text: string,
  maxWidth: number,
  maxHeight: number,
  fontSize: number
): string {
  const lines = splitTextToFitWidth(pdf, text, maxWidth);
  const maxLines = calculateMaxLines(maxHeight, fontSize);
  
  if (lines.length <= maxLines) {
    return lines.join(' ');
  }
  
  // Truncate to max lines and add ellipsis
  const truncatedLines = lines.slice(0, maxLines);
  const lastLine = truncatedLines[maxLines - 1];
  
  // Ensure last line has room for ellipsis
  const words = lastLine.split(' ');
  let fittedLine = '';
  
  for (const word of words) {
    const testLine = fittedLine ? `${fittedLine} ${word}` : word;
    if (pdf.getTextWidth(testLine + '...') <= maxWidth) {
      fittedLine = testLine;
    } else {
      break;
    }
  }
  
  truncatedLines[maxLines - 1] = fittedLine + '...';
  
  return truncatedLines.join(' ');
}
