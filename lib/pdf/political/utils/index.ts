/**
 * PDF Utility Functions - Central Export
 *
 * Re-exports all utility functions for easy importing in generators.
 *
 * Usage:
 * ```typescript
 * import { hexToRgb, formatCurrency, validateRequiredFields } from './utils';
 * ```
 *
 * @version 1.0.0
 */

// Color utilities
export {
  hexToRgb,
  hexToRGB,
  rgbToHex,
  darkenColor,
  lightenColor,
  isColorDark,
  getContrastingTextColor,
  type RGBTuple,
  type RGBColor,
} from './colorUtils';

// Format utilities
export {
  formatNumber,
  formatCurrency,
  formatCompact,
  formatPercent,
  formatValue,
  formatDate,
  formatScore,
  truncateText,
  type NumberFormat,
} from './formatUtils';

// Validation utilities
export {
  isDefined,
  isValidNumber,
  isNonEmptyString,
  isNonEmptyArray,
  safeNumber,
  safeString,
  safeArray,
  validateRequiredFields,
  validateNumericBounds,
  logValidationWarnings,
  withDefaults,
  type ValidationError,
  type ValidationResult,
} from './validationUtils';
