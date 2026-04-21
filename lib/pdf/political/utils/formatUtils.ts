/**
 * Formatting Utility Functions for PDF Generation
 *
 * Centralized number, currency, and text formatting utilities
 * used across all PDF generators.
 *
 * @version 1.0.0
 */

/**
 * Format type for numbers
 */
export type NumberFormat = 'number' | 'currency' | 'percent' | 'plain';

/**
 * Format a number with appropriate suffix (K, M, B)
 * @param value Number to format
 * @returns Formatted string (e.g., "12.5K", "1.2M")
 */
export function formatNumber(value: number): string {
  if (value >= 1000000000) return `${(value / 1000000000).toFixed(1)}B`;
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 10000) return `${(value / 1000).toFixed(0)}K`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toLocaleString();
}

/**
 * Format a number as currency with appropriate suffix
 * @param value Number to format
 * @returns Formatted currency string (e.g., "$12.5K", "$1.2M")
 */
export function formatCurrency(value: number): string {
  if (value >= 1000000000) return `$${(value / 1000000000).toFixed(1)}B`;
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 10000) return `$${(value / 1000).toFixed(0)}K`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value.toLocaleString()}`;
}

/**
 * Format a number as compact (no dollar sign, for charts)
 * @param value Number to format
 * @returns Formatted compact string (e.g., "12.5K", "1.2M")
 */
export function formatCompact(value: number): string {
  if (value >= 1000000000) return `${(value / 1000000000).toFixed(1)}B`;
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
  return value.toString();
}

/**
 * Format a number as percentage
 * @param value Number to format (0-100 or 0-1)
 * @param decimals Number of decimal places
 * @param isDecimal Whether value is already a decimal (0-1) vs percentage (0-100)
 * @returns Formatted percentage string
 */
export function formatPercent(value: number, decimals: number = 1, isDecimal: boolean = false): string {
  const pct = isDecimal ? value * 100 : value;
  return `${pct.toFixed(decimals)}%`;
}

/**
 * Format a value based on format type
 * @param value Number or string to format
 * @param format Format type
 * @returns Formatted string
 */
export function formatValue(value: number | string, format: NumberFormat = 'number'): string {
  if (typeof value === 'string') return value;

  switch (format) {
    case 'currency':
      return formatCurrency(value);
    case 'percent':
      return formatPercent(value);
    case 'number':
      return formatNumber(value);
    case 'plain':
    default:
      return String(value);
  }
}

/**
 * Format a date for display
 * @param date Date to format (Date object or string)
 * @param style Format style
 * @returns Formatted date string
 */
export function formatDate(
  date?: Date | string,
  style: 'short' | 'medium' | 'long' = 'medium'
): string {
  const d = date ? new Date(date) : new Date();

  const styleOptions: Record<string, Intl.DateTimeFormatOptions> = {
    short: { year: 'numeric', month: 'numeric', day: 'numeric' },
    medium: { year: 'numeric', month: 'short', day: 'numeric' },
    long: { year: 'numeric', month: 'long', day: 'numeric' },
  };

  return d.toLocaleDateString('en-US', styleOptions[style]);
}

/**
 * Truncate text to a maximum length with ellipsis
 * @param text Text to truncate
 * @param maxLength Maximum length
 * @param ellipsis Ellipsis character(s)
 * @returns Truncated text
 */
export function truncateText(text: string, maxLength: number, ellipsis: string = '…'): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - ellipsis.length) + ellipsis;
}

/**
 * Format a score value (0-100) with optional label
 * @param score Score value
 * @param showMax Whether to show "/100"
 * @returns Formatted score string
 */
export function formatScore(score: number, showMax: boolean = true): string {
  const rounded = Math.round(score);
  return showMax ? `${rounded}/100` : String(rounded);
}
