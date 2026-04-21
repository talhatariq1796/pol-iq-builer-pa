/**
 * Donor Lookup Service
 *
 * Maps entities (precincts, jurisdictions) to ZIP codes for donor data lookup.
 * Handles boundary overlaps and coverage estimation.
 */

import type { ComparisonEntity } from './types';
import type { EntityZIPMapping } from './types-donor';

// Ingham County ZIP codes with approximate jurisdiction mapping
// This is a simplified mapping - production would use GIS intersection
const INGHAM_ZIP_JURISDICTION_MAP: Record<string, string[]> = {
  // Lansing area ZIPs
  '48912': ['Lansing City'],
  '48910': ['Lansing City'],
  '48911': ['Lansing City', 'Delhi Township'],
  '48915': ['Lansing City'],
  '48906': ['Lansing City'],
  '48933': ['Lansing City'],  // Downtown

  // East Lansing
  '48823': ['East Lansing City', 'Meridian Township'],
  '48824': ['East Lansing City'],  // MSU
  '48825': ['East Lansing City'],

  // Surrounding townships
  '48840': ['Haslett', 'Meridian Township'],
  '48842': ['Holt', 'Delhi Township'],
  '48854': ['Mason City', 'Vevay Township'],
  '48864': ['Okemos', 'Meridian Township'],
  '48895': ['Williamston City', 'Williamstown Township'],
  '48917': ['Lansing City', 'Delta Township'],
  '48837': ['Grand Ledge City', 'Oneida Township'],
  '48876': ['Portland City'],  // Partial in Ingham
  '48808': ['Bath Township'],
  '48820': ['DeWitt', 'DeWitt Township'],  // Clinton County but nearby

  // Additional Ingham County ZIPs
  '48819': ['Dansville', 'Ingham Township'],
  '48827': ['Eaton Rapids'],  // Partial
  '48892': ['Webberville', 'Leroy Township'],
};

// Reverse mapping: jurisdiction to ZIPs
const JURISDICTION_ZIP_MAP: Map<string, string[]> = new Map();

// Build reverse mapping
for (const [zip, jurisdictions] of Object.entries(INGHAM_ZIP_JURISDICTION_MAP)) {
  for (const jurisdiction of jurisdictions) {
    const existing = JURISDICTION_ZIP_MAP.get(jurisdiction) || [];
    if (!existing.includes(zip)) {
      existing.push(zip);
    }
    JURISDICTION_ZIP_MAP.set(jurisdiction, existing);
  }
}

export class DonorLookup {
  /**
   * Get ZIP codes for an entity
   * Returns array of ZIP codes that overlap with the entity boundary
   */
  getZIPsForEntity(entity: ComparisonEntity): EntityZIPMapping {
    const entityName = entity.name.toLowerCase();

    // Try exact match first
    const entries = Array.from(JURISDICTION_ZIP_MAP.entries());
    for (const [jurisdiction, zips] of entries) {
      if (jurisdiction.toLowerCase() === entityName ||
          entityName.includes(jurisdiction.toLowerCase()) ||
          jurisdiction.toLowerCase().includes(entityName)) {
        return {
          entityId: entity.id,
          entityType: entity.type,
          zipCodes: zips,
          coverage: 0.85, // Estimate ~85% coverage
        };
      }
    }

    // Try partial match based on parent jurisdiction
    if (entity.parentJurisdiction) {
      for (const [jurisdiction, zips] of entries) {
        if (jurisdiction.toLowerCase().includes(entity.parentJurisdiction.toLowerCase())) {
          return {
            entityId: entity.id,
            entityType: entity.type,
            zipCodes: zips,
            coverage: 0.5, // Lower confidence for parent match
          };
        }
      }
    }

    // For precincts, try to find by jurisdiction name in the entity name
    // E.g., "Lansing Ward 1" -> look for "Lansing"
    const words = entityName.split(/\s+/);
    for (const word of words) {
      if (word.length < 3) continue;
      for (const [jurisdiction, zips] of entries) {
        if (jurisdiction.toLowerCase().includes(word)) {
          return {
            entityId: entity.id,
            entityType: entity.type,
            zipCodes: zips,
            coverage: 0.3, // Low confidence for word match
          };
        }
      }
    }

    // No match found
    return {
      entityId: entity.id,
      entityType: entity.type,
      zipCodes: [],
      coverage: 0,
    };
  }

  /**
   * Get all ZIP codes for Ingham County
   */
  getAllCountyZIPs(): string[] {
    return Object.keys(INGHAM_ZIP_JURISDICTION_MAP);
  }

  /**
   * Get jurisdictions for a ZIP code
   */
  getJurisdictionsForZIP(zipCode: string): string[] {
    return INGHAM_ZIP_JURISDICTION_MAP[zipCode] || [];
  }

  /**
   * Check if a ZIP code is in Ingham County
   */
  isInCounty(zipCode: string): boolean {
    return zipCode in INGHAM_ZIP_JURISDICTION_MAP;
  }
}
