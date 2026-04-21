/**
 * Address Formatter Utility
 *
 * Formats property addresses with special handling for condo/apartment unit numbers.
 * Unit numbers are displayed at the beginning of the address for multi-unit properties.
 *
 * @module lib/utils/addressFormatter
 */

export interface PropertyAddress {
  address: string;
  propertyType?: string;
  unit_number?: string;
  suite_number?: string;
  apt_number?: string;
  no_civique_debut?: string; // Quebec-specific unit field
}

/**
 * Formats a property address with special handling for condo/apartment units
 *
 * For condos/apartments with unit numbers:
 *   Returns: "Unit 305-123 Main St"
 *
 * For single-family homes or properties without units:
 *   Returns: "123 Main St"
 *
 * Unit number priority:
 *   1. unit_number
 *   2. suite_number
 *   3. apt_number
 *   4. no_civique_debut (Quebec-specific)
 *
 * @param property - Property object with address and optional unit information
 * @returns Formatted address string with unit prefix for condos/apartments
 */
export function formatPropertyAddress(property: PropertyAddress): string {
  if (!property.address) {
    return 'Unknown Address';
  }

  // Check if this is a multi-unit property (condo/apartment)
  const isMultiUnit =
    property.propertyType === 'condo' ||
    property.propertyType === 'apartment' ||
    property.propertyType === 'Condo' ||
    property.propertyType === 'Apartment';

  // If multi-unit, try to find unit number from multiple possible fields
  if (isMultiUnit) {
    const unit =
      property.unit_number ||
      property.suite_number ||
      property.apt_number ||
      property.no_civique_debut;

    if (unit) {
      // Format: "Unit 305-123 Main St"
      return `Unit ${unit}-${property.address}`;
    }
  }

  // Default: return address as-is
  return property.address;
}

/**
 * Extracts unit number from a property (if available)
 *
 * @param property - Property object
 * @returns Unit number string or null
 */
export function extractUnitNumber(property: PropertyAddress): string | null {
  return (
    property.unit_number ||
    property.suite_number ||
    property.apt_number ||
    property.no_civique_debut ||
    null
  );
}

/**
 * Checks if a property is a multi-unit building
 *
 * @param property - Property object
 * @returns True if property is condo/apartment
 */
export function isMultiUnitProperty(property: PropertyAddress): boolean {
  const type = property.propertyType?.toLowerCase();
  return type === 'condo' || type === 'apartment';
}
