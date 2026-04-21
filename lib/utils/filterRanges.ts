/**
 * Filter Ranges Utility
 *
 * Calculates dynamic min/max ranges for property filters based on actual data.
 * Includes smart buffering and rounding for better UX.
 *
 * @module lib/utils/filterRanges
 */

/**
 * Property data interface for filter range calculation
 */
export interface PropertyData {
  price?: number | string;
  askedsold_price?: number;
  bedrooms_number?: number;
  bathrooms_number?: number;
  square_footage?: number;
  year_built?: number;
  lot_size?: number;
  [key: string]: any;
}

/**
 * Range object with min and max values
 */
export interface Range {
  min: number;
  max: number;
}

/**
 * Complete filter ranges for all property attributes
 */
export interface FilterRanges {
  priceRange: Range;
  bedrooms: Range;
  bathrooms: Range;
  squareFootage: Range;
  yearBuilt: Range;
  lotSize: Range;
}

/**
 * Configuration options for range calculation
 */
export interface RangeCalculationOptions {
  /**
   * Buffer percentage to add to ranges (0-1)
   * @default 0.1 (10%)
   */
  bufferPercentage?: number;

  /**
   * Round price to nearest value
   * @default 10000 (round to nearest $10k)
   */
  priceRounding?: number;

  /**
   * Round square footage to nearest value
   * @default 100
   */
  squareFootageRounding?: number;

  /**
   * Round lot size to nearest value
   * @default 1000
   */
  lotSizeRounding?: number;

  /**
   * Minimum range span (prevents ranges like 3-3)
   * @default true
   */
  enforceMinimumSpan?: boolean;

  /**
   * Include zero in range if data allows
   * @default false
   */
  includeZero?: boolean;
}

/**
 * Default configuration for range calculation
 */
const DEFAULT_OPTIONS: Required<RangeCalculationOptions> = {
  bufferPercentage: 0.1,
  priceRounding: 10000,
  squareFootageRounding: 100,
  lotSizeRounding: 1000,
  enforceMinimumSpan: true,
  includeZero: false,
};

/**
 * Extracts numeric value from property field
 * Handles string prices (e.g., "$500,000") and missing values
 */
function extractNumericValue(value: number | string | undefined | null): number | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === 'number') {
    return isNaN(value) || !isFinite(value) ? null : value;
  }

  // Handle string values (remove currency symbols, commas, etc.)
  const cleaned = String(value).replace(/[$,\s]/g, '');
  const parsed = parseFloat(cleaned);

  return isNaN(parsed) || !isFinite(parsed) ? null : parsed;
}

/**
 * Rounds a number to the nearest multiple of a given value
 *
 * @param value - Value to round
 * @param roundTo - Round to nearest multiple of this value
 * @param direction - 'up', 'down', or 'nearest'
 */
function roundToNearest(
  value: number,
  roundTo: number,
  direction: 'up' | 'down' | 'nearest' = 'nearest'
): number {
  if (roundTo === 0) return value;

  switch (direction) {
    case 'up':
      return Math.ceil(value / roundTo) * roundTo;
    case 'down':
      return Math.floor(value / roundTo) * roundTo;
    case 'nearest':
    default:
      return Math.round(value / roundTo) * roundTo;
  }
}

/**
 * Calculates min/max range with buffering and rounding
 *
 * @param values - Array of numeric values
 * @param options - Range calculation options
 * @param roundTo - Round to nearest multiple (0 = no rounding)
 */
function calculateRange(
  values: number[],
  options: Required<RangeCalculationOptions>,
  roundTo: number = 0
): Range {
  // Handle empty array
  if (values.length === 0) {
    return { min: 0, max: 0 };
  }

  // Get raw min and max
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);

  // Handle single value or identical values
  if (rawMin === rawMax) {
    if (options.enforceMinimumSpan && roundTo > 0) {
      // Create a minimum span based on rounding value
      const buffer = roundTo * 2;
      return {
        min: roundToNearest(Math.max(0, rawMin - buffer), roundTo, 'down'),
        max: roundToNearest(rawMax + buffer, roundTo, 'up'),
      };
    }
    return { min: rawMin, max: rawMax };
  }

  // Calculate buffer
  const range = rawMax - rawMin;
  const buffer = range * options.bufferPercentage;

  // Apply buffer
  let min = rawMin - buffer;
  let max = rawMax + buffer;

  // Include zero if requested and makes sense
  if (options.includeZero && min > 0) {
    min = 0;
  }

  // Ensure non-negative
  min = Math.max(0, min);

  // Round to specified precision
  if (roundTo > 0) {
    min = roundToNearest(min, roundTo, 'down');
    max = roundToNearest(max, roundTo, 'up');
  }

  // Enforce minimum span
  if (options.enforceMinimumSpan && max - min < roundTo) {
    max = min + roundTo;
  }

  return { min, max };
}

/**
 * Calculates dynamic filter ranges from an array of properties
 *
 * @param properties - Array of property data objects
 * @param options - Optional configuration for range calculation
 * @returns FilterRanges object with min/max for each filter type
 *
 * @example
 * ```typescript
 * const properties = [
 *   { price: 500000, bedrooms_number: 3, bathrooms_number: 2 },
 *   { price: 750000, bedrooms_number: 4, bathrooms_number: 3 },
 * ];
 *
 * const ranges = calculateFilterRanges(properties);
 * // {
 * //   priceRange: { min: 450000, max: 800000 },
 * //   bedrooms: { min: 3, max: 4 },
 * //   bathrooms: { min: 2, max: 3 },
 * //   ...
 * // }
 * ```
 */
export function calculateFilterRanges(
  properties: PropertyData[],
  options: RangeCalculationOptions = {}
): FilterRanges {
  const config = { ...DEFAULT_OPTIONS, ...options };

  // Handle empty array
  if (!properties || properties.length === 0) {
    return {
      priceRange: { min: 0, max: 0 },
      bedrooms: { min: 0, max: 0 },
      bathrooms: { min: 0, max: 0 },
      squareFootage: { min: 0, max: 0 },
      yearBuilt: { min: 0, max: 0 },
      lotSize: { min: 0, max: 0 },
    };
  }

  // Extract and filter valid values for each field
  const prices: number[] = [];
  const bedrooms: number[] = [];
  const bathrooms: number[] = [];
  const squareFootages: number[] = [];
  const yearsBuilt: number[] = [];
  const lotSizes: number[] = [];

  properties.forEach((property) => {
    // Price (check both price and askedsold_price)
    const priceValue =
      extractNumericValue(property.askedsold_price) ?? extractNumericValue(property.price);
    if (priceValue !== null && priceValue > 0) {
      prices.push(priceValue);
    }

    // Bedrooms
    const bedroomValue = extractNumericValue(property.bedrooms_number);
    if (bedroomValue !== null && bedroomValue >= 0) {
      bedrooms.push(bedroomValue);
    }

    // Bathrooms
    const bathroomValue = extractNumericValue(property.bathrooms_number);
    if (bathroomValue !== null && bathroomValue >= 0) {
      bathrooms.push(bathroomValue);
    }

    // Square footage
    const sqftValue = extractNumericValue(property.square_footage);
    if (sqftValue !== null && sqftValue > 0) {
      squareFootages.push(sqftValue);
    }

    // Year built
    const yearValue = extractNumericValue(property.year_built);
    if (yearValue !== null && yearValue > 1800 && yearValue <= new Date().getFullYear()) {
      yearsBuilt.push(yearValue);
    }

    // Lot size
    const lotValue = extractNumericValue(property.lot_size);
    if (lotValue !== null && lotValue > 0) {
      lotSizes.push(lotValue);
    }
  });

  // Calculate ranges with appropriate rounding
  return {
    priceRange: calculateRange(prices, config, config.priceRounding),
    bedrooms: calculateRange(bedrooms, config, 1), // Always round to whole numbers
    bathrooms: calculateRange(bathrooms, config, 0.5), // Round to 0.5 increments
    squareFootage: calculateRange(squareFootages, config, config.squareFootageRounding),
    yearBuilt: calculateRange(yearsBuilt, config, 5), // Round to 5-year increments
    lotSize: calculateRange(lotSizes, config, config.lotSizeRounding),
  };
}

/**
 * Checks if a property falls within specified filter ranges
 *
 * @param property - Property to check
 * @param ranges - Filter ranges to check against
 * @returns True if property matches all non-zero ranges
 *
 * @example
 * ```typescript
 * const property = { price: 600000, bedrooms_number: 3 };
 * const ranges = { priceRange: { min: 500000, max: 700000 }, ... };
 *
 * const matches = isPropertyInRange(property, ranges);
 * // true
 * ```
 */
export function isPropertyInRange(property: PropertyData, ranges: FilterRanges): boolean {
  // Check price
  const price = extractNumericValue(property.askedsold_price) ?? extractNumericValue(property.price);
  if (
    price !== null &&
    ranges.priceRange.max > 0 &&
    (price < ranges.priceRange.min || price > ranges.priceRange.max)
  ) {
    return false;
  }

  // Check bedrooms
  const bedroomCount = extractNumericValue(property.bedrooms_number);
  if (
    bedroomCount !== null &&
    ranges.bedrooms.max > 0 &&
    (bedroomCount < ranges.bedrooms.min || bedroomCount > ranges.bedrooms.max)
  ) {
    return false;
  }

  // Check bathrooms
  const bathroomCount = extractNumericValue(property.bathrooms_number);
  if (
    bathroomCount !== null &&
    ranges.bathrooms.max > 0 &&
    (bathroomCount < ranges.bathrooms.min || bathroomCount > ranges.bathrooms.max)
  ) {
    return false;
  }

  // Check square footage
  const sqft = extractNumericValue(property.square_footage);
  if (
    sqft !== null &&
    ranges.squareFootage.max > 0 &&
    (sqft < ranges.squareFootage.min || sqft > ranges.squareFootage.max)
  ) {
    return false;
  }

  // Check year built
  const year = extractNumericValue(property.year_built);
  if (
    year !== null &&
    ranges.yearBuilt.max > 0 &&
    (year < ranges.yearBuilt.min || year > ranges.yearBuilt.max)
  ) {
    return false;
  }

  // Check lot size
  const lotSize = extractNumericValue(property.lot_size);
  if (
    lotSize !== null &&
    ranges.lotSize.max > 0 &&
    (lotSize < ranges.lotSize.min || lotSize > ranges.lotSize.max)
  ) {
    return false;
  }

  return true;
}

/**
 * Formats a range for display
 *
 * @param range - Range to format
 * @param type - Type of range for formatting
 * @returns Formatted string representation
 */
export function formatRange(
  range: Range,
  type: 'price' | 'bedrooms' | 'bathrooms' | 'sqft' | 'year' | 'lotSize'
): string {
  if (range.min === 0 && range.max === 0) {
    return 'N/A';
  }

  switch (type) {
    case 'price':
      return `$${(range.min / 1000).toFixed(0)}k - $${(range.max / 1000).toFixed(0)}k`;
    case 'bedrooms':
      return `${range.min} - ${range.max} beds`;
    case 'bathrooms':
      return `${range.min} - ${range.max} baths`;
    case 'sqft':
      return `${range.min.toLocaleString()} - ${range.max.toLocaleString()} sqft`;
    case 'year':
      return `${range.min} - ${range.max}`;
    case 'lotSize':
      return `${(range.min / 1000).toFixed(1)}k - ${(range.max / 1000).toFixed(1)}k sqft`;
    default:
      return `${range.min} - ${range.max}`;
  }
}

/**
 * Merges multiple filter ranges (useful for combining datasets)
 *
 * @param rangesList - Array of FilterRanges to merge
 * @returns Combined FilterRanges with overall min/max
 */
export function mergeFilterRanges(rangesList: FilterRanges[]): FilterRanges {
  if (rangesList.length === 0) {
    return {
      priceRange: { min: 0, max: 0 },
      bedrooms: { min: 0, max: 0 },
      bathrooms: { min: 0, max: 0 },
      squareFootage: { min: 0, max: 0 },
      yearBuilt: { min: 0, max: 0 },
      lotSize: { min: 0, max: 0 },
    };
  }

  if (rangesList.length === 1) {
    return rangesList[0];
  }

  const mergeRange = (key: keyof FilterRanges): Range => {
    const mins = rangesList.map((r) => r[key].min).filter((v) => v > 0);
    const maxs = rangesList.map((r) => r[key].max).filter((v) => v > 0);

    return {
      min: mins.length > 0 ? Math.min(...mins) : 0,
      max: maxs.length > 0 ? Math.max(...maxs) : 0,
    };
  };

  return {
    priceRange: mergeRange('priceRange'),
    bedrooms: mergeRange('bedrooms'),
    bathrooms: mergeRange('bathrooms'),
    squareFootage: mergeRange('squareFootage'),
    yearBuilt: mergeRange('yearBuilt'),
    lotSize: mergeRange('lotSize'),
  };
}
