/**
 * Validation Utility Functions for PDF Generation
 *
 * Input validation for PDF generator configs to prevent
 * runtime errors from undefined/null values.
 *
 * @version 1.0.0
 */

/**
 * Validation error with field path
 */
export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Check if a value is defined (not null or undefined)
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Check if a value is a valid number
 */
export function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

/**
 * Check if a value is a non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Check if a value is a non-empty array
 */
export function isNonEmptyArray<T>(value: unknown): value is T[] {
  return Array.isArray(value) && value.length > 0;
}

/**
 * Safely get a number with default fallback
 */
export function safeNumber(value: unknown, defaultValue: number): number {
  if (isValidNumber(value)) return value;
  return defaultValue;
}

/**
 * Safely get a string with default fallback
 */
export function safeString(value: unknown, defaultValue: string): string {
  if (typeof value === 'string') return value;
  return defaultValue;
}

/**
 * Safely get an array with default fallback
 */
export function safeArray<T>(value: unknown, defaultValue: T[] = []): T[] {
  if (Array.isArray(value)) return value;
  return defaultValue;
}

/**
 * Validate required fields in a config object
 * @param config Config object to validate
 * @param requiredFields Array of required field paths (supports dot notation)
 * @param name Config name for error messages
 * @returns Validation result
 */
export function validateRequiredFields(
  config: Record<string, unknown>,
  requiredFields: string[],
  name: string = 'config'
): ValidationResult {
  const errors: ValidationError[] = [];

  for (const field of requiredFields) {
    const parts = field.split('.');
    let value: unknown = config;

    for (const part of parts) {
      if (value && typeof value === 'object' && part in (value as object)) {
        value = (value as Record<string, unknown>)[part];
      } else {
        value = undefined;
        break;
      }
    }

    if (!isDefined(value)) {
      errors.push({
        field,
        message: `${name}.${field} is required`,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate numeric fields are within bounds
 * @param config Config object
 * @param numericFields Array of { field, min?, max? }
 * @returns Validation result
 */
export function validateNumericBounds(
  config: Record<string, unknown>,
  numericFields: Array<{ field: string; min?: number; max?: number }>
): ValidationResult {
  const errors: ValidationError[] = [];

  for (const { field, min, max } of numericFields) {
    const parts = field.split('.');
    let value: unknown = config;

    for (const part of parts) {
      if (value && typeof value === 'object' && part in (value as object)) {
        value = (value as Record<string, unknown>)[part];
      } else {
        value = undefined;
        break;
      }
    }

    if (isDefined(value)) {
      if (!isValidNumber(value)) {
        errors.push({
          field,
          message: `${field} must be a valid number`,
        });
      } else {
        if (isDefined(min) && value < min) {
          errors.push({
            field,
            message: `${field} must be at least ${min}`,
          });
        }
        if (isDefined(max) && value > max) {
          errors.push({
            field,
            message: `${field} must be at most ${max}`,
          });
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Log validation warnings (non-blocking)
 */
export function logValidationWarnings(
  result: ValidationResult,
  generatorName: string
): void {
  if (!result.valid) {
    console.warn(
      `[${generatorName}] Validation warnings:`,
      result.errors.map((e) => `${e.field}: ${e.message}`).join(', ')
    );
  }
}

/**
 * Create a validated config with defaults applied
 * @param config Input config
 * @param defaults Default values
 * @returns Merged config with defaults
 */
export function withDefaults<T extends Record<string, unknown>>(
  config: Partial<T>,
  defaults: T
): T {
  const result = { ...defaults };

  for (const key of Object.keys(config) as Array<keyof T>) {
    if (isDefined(config[key])) {
      if (
        typeof config[key] === 'object' &&
        !Array.isArray(config[key]) &&
        config[key] !== null &&
        typeof defaults[key] === 'object' &&
        !Array.isArray(defaults[key]) &&
        defaults[key] !== null
      ) {
        // Deep merge objects
        result[key] = withDefaults(
          config[key] as Record<string, unknown>,
          defaults[key] as Record<string, unknown>
        ) as T[keyof T];
      } else {
        result[key] = config[key] as T[keyof T];
      }
    }
  }

  return result;
}
