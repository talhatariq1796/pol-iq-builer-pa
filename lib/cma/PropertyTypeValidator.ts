/**
 * Property Type Validator
 * 
 * Enforces property type segregation rules for CMA analysis:
 * 1. Revenue properties CANNOT be analyzed with residential properties
 * 2. Houses can ONLY be analyzed with other houses
 * 3. Condos can ONLY be analyzed with other condos
 * 
 * Decision Date: November 13, 2025
 * Rationale: Prevent invalid comparisons between different property types
 * 
 * @see docs/CMA_PIPELINE_TESTING_CHECKLIST.md for full context
 */

import type { CMAProperty } from '@/components/cma/types';

export interface ValidationResult {
  valid: boolean;
  error?: string;
  warning?: string;
  suggestion?: string;
  mixedTypes?: boolean;
  propertyTypes?: Set<string>;
}

export class PropertyTypeValidator {
  /**
   * Validates that selected properties can be analyzed together
   * 
   * Rules:
   * 1. Revenue properties (has revenue fields) CANNOT mix with residential
   * 2. Houses can ONLY be analyzed with other houses
   * 3. Condos can ONLY be analyzed with other condos
   * 
   * @param properties - Array of selected properties
   * @returns ValidationResult with valid flag and error/warning messages
   */
  static validateCMASelection(properties: CMAProperty[]): ValidationResult {
    if (properties.length === 0) {
      return {
        valid: false,
        error: 'No properties selected',
        suggestion: 'Please select at least one property to analyze'
      };
    }

    if (properties.length === 1) {
      return {
        valid: true,
        propertyTypes: new Set([this.getPropertyType(properties[0])])
      };
    }

    // Classify all properties
    const propertyTypes = new Set(properties.map(p => this.getPropertyType(p)));
    const hasRevenue = Array.from(propertyTypes).some(type => type === 'revenue');
    const hasResidential = Array.from(propertyTypes).some(type => ['house', 'condo'].includes(type));

    // RULE 1: Revenue cannot mix with residential (HARD SEPARATION)
    if (hasRevenue && hasResidential) {
      return {
        valid: false,
        error: 'Revenue properties cannot be analyzed with residential properties',
        suggestion: 'Revenue properties use income-based valuation (GIM, cap rate, NOI) while residential properties use sales comparison (price/sqft, bedrooms). Please select only revenue properties OR only residential properties.',
        mixedTypes: true,
        propertyTypes
      };
    }

    // RULE 2: Houses and condos cannot mix (SIMPLIFICATION DECISION)
    if (propertyTypes.has('house') && propertyTypes.has('condo')) {
      return {
        valid: false,
        error: 'Houses and condos cannot be analyzed together',
        suggestion: 'Houses and condos have different characteristics (lot size vs floor level, HOA fees, etc.). Please select only houses OR only condos for the most accurate comparison.',
        mixedTypes: true,
        propertyTypes
      };
    }

    // If we got here, all properties are the same type
    return {
      valid: true,
      propertyTypes
    };
  }

  /**
   * Determines the property type from a CMAProperty
   * 
   * Priority:
   * 1. Check for revenue indicators (GIM, gross revenue, common expenses)
   * 2. Check explicit property_type field
   * 3. Fallback to 'house' (safest default)
   * 
   * @param property - CMAProperty to classify
   * @returns 'revenue' | 'house' | 'condo'
   */
  static getPropertyType(property: CMAProperty): 'revenue' | 'house' | 'condo' {
    // Check for revenue property indicators
    // IMPORTANT: common_expenses alone is NOT a revenue indicator (condos have monthly HOA fees)
    // Only classify as revenue if we have propertyCategory='revenue' OR actual revenue fields (GIM, gross revenue)
    const hasGIM = property.gross_income_multiplier !== undefined && property.gross_income_multiplier > 0;
    const hasRevenue = property.potential_gross_revenue !== undefined && property.potential_gross_revenue > 0;
    const isRevenueFlag = property.isRevenueProperty === true;
    const categoryRevenue = property.propertyCategory === 'revenue';

    // Classify as revenue ONLY if we have strong revenue indicators
    // (NOT just common_expenses, which condos also have)
    if (hasGIM || hasRevenue || isRevenueFlag || categoryRevenue) {
      return 'revenue';
    }

    // Check explicit property_type field
    if (property.property_type) {
      const type = property.property_type.toLowerCase();
      
      // Map various type names to our categories
      if (type.includes('condo') || type.includes('appartement') || type.includes('apartment')) {
        return 'condo';
      }
      
      if (type.includes('house') || type.includes('maison') || type.includes('single') || 
          type.includes('detached') || type.includes('semi') || type.includes('townhouse') ||
          type.includes('duplex') || type.includes('triplex')) {
        return 'house';
      }
    }

    // Default to house (most common residential type)
    return 'house';
  }

  /**
   * Gets comparable fields for analysis based on property types
   * 
   * When all properties are same type, returns all relevant fields.
   * This function is provided for future flexibility but current rules
   * don't allow mixed types.
   * 
   * @param propertyTypes - Set of property types in selection
   * @returns Array of field names safe to compare
   */
  static getComparableFields(propertyTypes: Set<string>): string[] {
    // If revenue properties, return revenue-specific fields
    if (propertyTypes.has('revenue')) {
      return [
        'price',
        'askedsold_price',
        'gross_income_multiplier',
        'potential_gross_revenue',
        'price_vs_assessment',
        'common_expenses',
        'pgi',
        'noi',
        'nim',
        'gim',
        'price_to_assessment_ratio',
        'municipality',
        'postal_code'
      ];
    }

    // If single residential type (house or condo), return all residential fields
    if (propertyTypes.size === 1) {
      const type = Array.from(propertyTypes)[0];
      
      if (type === 'house') {
        return [
          'price',
          'askedsold_price',
          'bedrooms_number',
          'bathrooms_number',
          'living_area_imperial',
          'lot_area_imperial',
          'year_built',
          'price_per_sqft',
          'municipality',
          'postal_code',
          'fsa_code'
        ];
      }
      
      if (type === 'condo') {
        return [
          'price',
          'askedsold_price',
          'bedrooms_number',
          'bathrooms_number',
          'living_area_imperial',
          'year_built',
          'price_per_sqft',
          'municipality',
          'postal_code',
          'fsa_code'
          // Note: floor_level and common_expenses specific to condos
        ];
      }
    }

    // This shouldn't happen with current validation rules, but provide safe fallback
    console.warn('[PropertyTypeValidator] Unexpected property type mix:', Array.from(propertyTypes));
    return ['price', 'municipality'];
  }

  /**
   * Format property types for display in error messages
   * 
   * @param propertyTypes - Set of property types
   * @returns Human-readable string (e.g., "houses and condos")
   */
  static formatPropertyTypes(propertyTypes: Set<string>): string {
    const types = Array.from(propertyTypes);
    
    if (types.length === 1) {
      const type = types[0];
      return type === 'revenue' ? 'revenue properties' : `${type}s`;
    }

    if (types.length === 2) {
      const formatted = types.map(t => t === 'revenue' ? 'revenue properties' : `${t}s`);
      return `${formatted[0]} and ${formatted[1]}`;
    }

    const formatted = types.map(t => t === 'revenue' ? 'revenue properties' : `${t}s`);
    const last = formatted.pop();
    return `${formatted.join(', ')}, and ${last}`;
  }

  /**
   * Check if properties are all revenue type
   * 
   * @param properties - Array of properties to check
   * @returns true if all properties are revenue type
   */
  static areAllRevenue(properties: CMAProperty[]): boolean {
    return properties.every(p => this.getPropertyType(p) === 'revenue');
  }

  /**
   * Check if properties are all residential (house or condo)
   * 
   * @param properties - Array of properties to check
   * @returns true if all properties are residential (not revenue)
   */
  static areAllResidential(properties: CMAProperty[]): boolean {
    return properties.every(p => {
      const type = this.getPropertyType(p);
      return type === 'house' || type === 'condo';
    });
  }

  /**
   * Check if properties are all the same type
   * 
   * @param properties - Array of properties to check
   * @returns true if all properties are identical type
   */
  static areAllSameType(properties: CMAProperty[]): boolean {
    if (properties.length === 0) return true;
    
    const firstType = this.getPropertyType(properties[0]);
    return properties.every(p => this.getPropertyType(p) === firstType);
  }

  /**
   * Filter properties by type
   * 
   * @param properties - Array of properties to filter
   * @param type - Property type to keep ('revenue' | 'house' | 'condo')
   * @returns Filtered array of properties
   */
  static filterByType(properties: CMAProperty[], type: 'revenue' | 'house' | 'condo'): CMAProperty[] {
    return properties.filter(p => this.getPropertyType(p) === type);
  }

  /**
   * Group properties by type
   * 
   * @param properties - Array of properties to group
   * @returns Map of property type to array of properties
   */
  static groupByType(properties: CMAProperty[]): Map<string, CMAProperty[]> {
    const groups = new Map<string, CMAProperty[]>();
    
    properties.forEach(property => {
      const type = this.getPropertyType(property);
      const existing = groups.get(type) || [];
      groups.set(type, [...existing, property]);
    });
    
    return groups;
  }

  /**
   * Get statistics about property types in selection
   * 
   * @param properties - Array of properties
   * @returns Object with counts per property type
   */
  static getTypeStatistics(properties: CMAProperty[]): {
    total: number;
    revenue: number;
    house: number;
    condo: number;
    types: string[];
  } {
    const groups = this.groupByType(properties);
    
    return {
      total: properties.length,
      revenue: groups.get('revenue')?.length || 0,
      house: groups.get('house')?.length || 0,
      condo: groups.get('condo')?.length || 0,
      types: Array.from(groups.keys())
    };
  }
}
