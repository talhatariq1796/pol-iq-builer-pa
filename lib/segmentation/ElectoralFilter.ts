/**
 * Electoral filtering engine for segmenting by electoral districts
 *
 * Handles filtering precincts by Congressional districts, State House/Senate,
 * County Commissioner districts, and municipalities. Supports split precincts
 * with full or proportional weighting.
 */

import type {
  ElectoralFilters,
  DistrictCrosswalk,
  ElectoralDistrict,
  PrecinctDistrictAssignments,
} from './types';

type DistrictLevel = 'state_house' | 'state_senate' | 'congressional' | 'county' | 'municipal';

/**
 * Electoral filtering engine
 */
export class ElectoralFilter {
  private crosswalk: Map<string, DistrictCrosswalk>;
  private districtToPrecincts: Map<string, Set<string>>;

  /**
   * Create a new ElectoralFilter
   * @param crosswalkData - Precinct-to-district crosswalk entries
   */
  constructor(crosswalkData: DistrictCrosswalk[]) {
    // Build fast lookup maps
    this.crosswalk = new Map();
    this.districtToPrecincts = new Map();

    for (const entry of crosswalkData) {
      this.crosswalk.set(entry.precinctId, entry);

      // Index by all district types
      if (entry.stateHouse) {
        this.addToDistrictIndex(entry.stateHouse, entry.precinctId);
      }
      if (entry.stateSenate) {
        this.addToDistrictIndex(entry.stateSenate, entry.precinctId);
      }
      if (entry.congressional) {
        this.addToDistrictIndex(entry.congressional, entry.precinctId);
      }
      if (entry.countyCommissioner) {
        this.addToDistrictIndex(entry.countyCommissioner, entry.precinctId);
      }
      if (entry.municipality) {
        this.addToDistrictIndex(entry.municipality, entry.precinctId);
      }
    }
  }

  /**
   * Filter precincts by electoral district criteria
   * @param precinctIds - All precinct IDs to filter
   * @param filters - Electoral filtering criteria
   * @returns Filtered precinct IDs
   */
  filterPrecincts(precinctIds: string[], filters: ElectoralFilters): string[] {
    let results = new Set<string>(precinctIds);

    // Congressional districts filter
    if (filters.congressionalDistricts && filters.congressionalDistricts.length > 0) {
      const districtPrecincts = new Set<string>();
      for (const district of filters.congressionalDistricts) {
        const precincts = this.getDistrictPrecincts(
          this.normalizeDistrictId(district),
          'congressional'
        );
        precincts.forEach(p => districtPrecincts.add(p));
      }
      results = this.intersect(results, districtPrecincts);
    }

    // State Senate districts filter
    if (filters.stateSenateDistricts && filters.stateSenateDistricts.length > 0) {
      const districtPrecincts = new Set<string>();
      for (const district of filters.stateSenateDistricts) {
        const precincts = this.getDistrictPrecincts(
          this.normalizeDistrictId(district),
          'state_senate'
        );
        precincts.forEach(p => districtPrecincts.add(p));
      }
      results = this.intersect(results, districtPrecincts);
    }

    // State House districts filter
    if (filters.stateHouseDistricts && filters.stateHouseDistricts.length > 0) {
      const districtPrecincts = new Set<string>();
      for (const district of filters.stateHouseDistricts) {
        const precincts = this.getDistrictPrecincts(
          this.normalizeDistrictId(district),
          'state_house'
        );
        precincts.forEach(p => districtPrecincts.add(p));
      }
      results = this.intersect(results, districtPrecincts);
    }

    // County commissioner districts filter
    if (filters.countyDistricts && filters.countyDistricts.length > 0) {
      const districtPrecincts = new Set<string>();
      for (const district of filters.countyDistricts) {
        const precincts = this.getDistrictPrecincts(
          this.normalizeDistrictId(district),
          'county'
        );
        precincts.forEach(p => districtPrecincts.add(p));
      }
      results = this.intersect(results, districtPrecincts);
    }

    // Municipality filter
    if (filters.municipalities && filters.municipalities.length > 0) {
      const municipalityPrecincts = new Set<string>();
      for (const municipality of filters.municipalities) {
        const precincts = this.getDistrictPrecincts(
          this.normalizeMunicipalityName(municipality),
          'municipal'
        );
        precincts.forEach(p => municipalityPrecincts.add(p));
      }
      results = this.intersect(results, municipalityPrecincts);
    }

    // Municipality type filter (city vs township)
    if (filters.municipalityTypes && filters.municipalityTypes.length > 0) {
      const typePrecincts = new Set<string>();
      for (const precinctId of results) {
        const entry = this.crosswalk.get(precinctId);
        if (entry?.municipalityType && filters.municipalityTypes.includes(entry.municipalityType)) {
          typePrecincts.add(precinctId);
        }
      }
      results = typePrecincts;
    }

    // Split precinct handling
    if (filters.includeSplitPrecincts === false) {
      // Exclude split precincts
      const nonSplitPrecincts = new Set<string>();
      for (const precinctId of results) {
        const entry = this.crosswalk.get(precinctId);
        if (!entry?.isSplit) {
          nonSplitPrecincts.add(precinctId);
        }
      }
      results = nonSplitPrecincts;
    }

    return Array.from(results);
  }

  /**
   * Get all precincts in a specific district
   * @param districtId - District identifier (normalized)
   * @param level - District level
   * @returns Array of precinct IDs
   */
  getDistrictPrecincts(districtId: string, level: DistrictLevel): string[] {
    const normalizedId = this.normalizeDistrictId(districtId);
    const precincts = this.districtToPrecincts.get(normalizedId);
    return precincts ? Array.from(precincts) : [];
  }

  /**
   * Get all district assignments for a precinct
   * @param precinctId - Precinct identifier
   * @returns District assignments with split status
   */
  getPrecinctDistricts(precinctId: string): PrecinctDistrictAssignments {
    const entry = this.crosswalk.get(precinctId);

    if (!entry) {
      return {};
    }

    const assignments: PrecinctDistrictAssignments = {
      stateHouse: entry.stateHouse,
      stateSenate: entry.stateSenate,
      congressional: entry.congressional,
      countyCommissioner: entry.countyCommissioner,
      municipality: entry.municipality,
      isSplit: entry.isSplit,
    };

    // Build split details from split weights
    if (entry.isSplit && entry.splitWeights) {
      assignments.splitDetails = [];

      // Group by district type
      const districtTypes = new Set<string>();
      for (const districtId of Object.keys(entry.splitWeights)) {
        const type = this.inferDistrictType(districtId);
        districtTypes.add(type);
      }

      // Create split detail entry for each type
      for (const type of districtTypes) {
        const districts: string[] = [];
        const proportions: number[] = [];

        for (const [districtId, weight] of Object.entries(entry.splitWeights)) {
          if (this.inferDistrictType(districtId) === type) {
            districts.push(districtId);
            proportions.push(weight);
          }
        }

        if (districts.length > 1) {
          assignments.splitDetails.push({
            districtType: type,
            districts,
            proportions,
          });
        }
      }
    }

    return assignments;
  }

  /**
   * Calculate split weight for a precinct in a specific district
   * @param precinctId - Precinct identifier
   * @param districtId - District identifier
   * @returns Weight (0-1) or 1.0 if not split
   */
  calculateSplitWeight(precinctId: string, districtId: string): number {
    const entry = this.crosswalk.get(precinctId);

    if (!entry?.isSplit || !entry.splitWeights) {
      return 1.0;
    }

    const normalizedDistrictId = this.normalizeDistrictId(districtId);
    return entry.splitWeights[normalizedDistrictId] ?? 0;
  }

  /**
   * Build summary of all electoral districts
   * @returns Map of district ID to district summary
   */
  buildDistrictSummary(): Record<string, ElectoralDistrict> {
    const districts: Record<string, ElectoralDistrict> = {};

    // Iterate through all district-to-precinct mappings
    for (const [districtId, precinctSet] of this.districtToPrecincts.entries()) {
      const level = this.inferDistrictLevel(districtId);
      const precinctIds = Array.from(precinctSet);

      districts[districtId] = {
        id: districtId,
        name: this.formatDistrictName(districtId),
        level,
        precinctCount: precinctIds.length,
        precinctIds,
      };
    }

    return districts;
  }

  /**
   * Get all unique municipalities
   * @returns Array of municipality names
   */
  getMunicipalities(): string[] {
    const municipalities = new Set<string>();

    for (const entry of this.crosswalk.values()) {
      if (entry.municipality) {
        municipalities.add(entry.municipality);
      }
    }

    return Array.from(municipalities).sort();
  }

  /**
   * Get all districts at a specific level
   * @param level - District level
   * @returns Array of district IDs
   */
  getDistrictsByLevel(level: DistrictLevel): string[] {
    const districts = new Set<string>();

    for (const entry of this.crosswalk.values()) {
      switch (level) {
        case 'congressional':
          if (entry.congressional) districts.add(entry.congressional);
          break;
        case 'state_senate':
          if (entry.stateSenate) districts.add(entry.stateSenate);
          break;
        case 'state_house':
          if (entry.stateHouse) districts.add(entry.stateHouse);
          break;
        case 'county':
          if (entry.countyCommissioner) districts.add(entry.countyCommissioner);
          break;
        case 'municipal':
          if (entry.municipality) districts.add(entry.municipality);
          break;
      }
    }

    return Array.from(districts).sort();
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Add precinct to district index
   */
  private addToDistrictIndex(districtId: string, precinctId: string): void {
    const normalizedId = this.normalizeDistrictId(districtId);

    if (!this.districtToPrecincts.has(normalizedId)) {
      this.districtToPrecincts.set(normalizedId, new Set());
    }

    this.districtToPrecincts.get(normalizedId)!.add(precinctId);
  }

  /**
   * Normalize district ID to lowercase with consistent format
   */
  private normalizeDistrictId(districtId: string): string {
    return districtId.toLowerCase().trim().replace(/\s+/g, '-');
  }

  /**
   * Normalize municipality name
   */
  private normalizeMunicipalityName(name: string): string {
    return name.toLowerCase().trim().replace(/\s+/g, '-');
  }

  /**
   * Intersect two sets
   */
  private intersect(setA: Set<string>, setB: Set<string>): Set<string> {
    const result = new Set<string>();
    for (const item of setA) {
      if (setB.has(item)) {
        result.add(item);
      }
    }
    return result;
  }

  /**
   * Infer district type from district ID
   */
  private inferDistrictType(districtId: string): string {
    const normalized = this.normalizeDistrictId(districtId);

    if (
      normalized.startsWith('mi-') ||
      normalized.startsWith('us-') ||
      normalized.startsWith('pa-')
    ) {
      if (normalized.includes('house')) return 'State House';
      if (normalized.includes('senate')) return 'State Senate';
      if (normalized.match(/mi-\d+/) || normalized.match(/pa-congress-\d+/)) return 'Congressional';
    }

    if (normalized.startsWith('cc-')) return 'County Commissioner';

    return 'Municipality';
  }

  /**
   * Infer district level from district ID
   */
  private inferDistrictLevel(districtId: string): ElectoralDistrict['level'] {
    const normalized = this.normalizeDistrictId(districtId);

    if (normalized.match(/mi-\d+/) || normalized.match(/us-\d+/) || normalized.match(/pa-congress-\d+/)) {
      return 'federal';
    }

    if (normalized.includes('senate')) return 'state_senate';
    if (normalized.includes('house')) return 'state_house';
    if (normalized.startsWith('cc-')) return 'county';

    return 'local';
  }

  /**
   * Format district ID as human-readable name
   */
  private formatDistrictName(districtId: string): string {
    const normalized = this.normalizeDistrictId(districtId);

    // Congressional: MI-07 → Michigan 7th Congressional
    if (normalized.match(/mi-(\d+)/)) {
      const match = normalized.match(/mi-(\d+)/);
      const num = match ? match[1] : '';
      return `Michigan ${num}${this.ordinalSuffix(parseInt(num))} Congressional`;
    }

    // State Senate: mi-senate-23 → Michigan State Senate 23
    if (normalized.match(/mi-senate-(\d+)/)) {
      const match = normalized.match(/mi-senate-(\d+)/);
      const num = match ? match[1] : '';
      return `Michigan State Senate ${num}`;
    }

    // State House: mi-house-71 → Michigan State House 71
    if (normalized.match(/mi-house-(\d+)/)) {
      const match = normalized.match(/mi-house-(\d+)/);
      const num = match ? match[1] : '';
      return `Michigan State House ${num}`;
    }

    // Pennsylvania congressional: pa-congress-07
    if (normalized.match(/pa-congress-(\d+)/)) {
      const match = normalized.match(/pa-congress-(\d+)/);
      const num = match ? parseInt(match[1], 10) : 0;
      return `Pennsylvania ${num}${this.ordinalSuffix(num)} Congressional`;
    }

    // Pennsylvania State Senate: pa-senate-3
    if (normalized.match(/pa-senate-(\d+)/)) {
      const match = normalized.match(/pa-senate-(\d+)/);
      const num = match ? match[1] : '';
      return `Pennsylvania State Senate ${num}`;
    }

    // Pennsylvania State House: pa-house-77
    if (normalized.match(/pa-house-(\d+)/)) {
      const match = normalized.match(/pa-house-(\d+)/);
      const num = match ? match[1] : '';
      return `Pennsylvania State House ${num}`;
    }

    // County Commissioner: cc-1 → County Commissioner District 1
    if (normalized.match(/cc-(\d+)/)) {
      const match = normalized.match(/cc-(\d+)/);
      const num = match ? match[1] : '';
      return `County Commissioner District ${num}`;
    }

    // Municipality: lansing-city → Lansing City
    return districtId
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Get ordinal suffix for number (1st, 2nd, 3rd, etc.)
   */
  private ordinalSuffix(num: number): string {
    const j = num % 10;
    const k = num % 100;

    if (j === 1 && k !== 11) return 'st';
    if (j === 2 && k !== 12) return 'nd';
    if (j === 3 && k !== 13) return 'rd';
    return 'th';
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create ElectoralFilter from precinct data
 * Extracts district assignments from precinct objects
 */
export function createElectoralFilterFromPrecincts(
  precincts: Array<{
    id: string;
    districts?: PrecinctDistrictAssignments;
  }>
): ElectoralFilter {
  const crosswalkData: DistrictCrosswalk[] = precincts
    .filter(p => p.districts)
    .map(p => {
      const districts = p.districts!;
      const entry: DistrictCrosswalk = {
        precinctId: p.id,
        stateHouse: districts.stateHouse,
        stateSenate: districts.stateSenate,
        congressional: districts.congressional,
        countyCommissioner: districts.countyCommissioner,
        municipality: districts.municipality,
        isSplit: districts.isSplit,
      };

      // Build split weights from split details
      if (districts.isSplit && districts.splitDetails) {
        entry.splitWeights = {};
        for (const detail of districts.splitDetails) {
          detail.districts.forEach((districtId, idx) => {
            entry.splitWeights![districtId] = detail.proportions[idx];
          });
        }
      }

      return entry;
    });

  return new ElectoralFilter(crosswalkData);
}

/**
 * Check if a precinct is split across multiple districts
 */
export function isPrecinctSplit(assignments: PrecinctDistrictAssignments): boolean {
  return assignments.isSplit ?? false;
}

/**
 * Get primary district for a split precinct (highest proportion)
 */
export function getPrimaryDistrict(
  assignments: PrecinctDistrictAssignments,
  level: 'stateHouse' | 'stateSenate' | 'congressional' | 'countyCommissioner'
): string | undefined {
  if (!assignments.splitDetails) {
    // Not split, return the single assignment
    return assignments[level];
  }

  // Find split detail for this level
  const levelMap: Record<typeof level, string> = {
    stateHouse: 'State House',
    stateSenate: 'State Senate',
    congressional: 'Congressional',
    countyCommissioner: 'County Commissioner',
  };

  const targetType = levelMap[level];
  const detail = assignments.splitDetails.find(d => d.districtType === targetType);

  if (!detail || detail.districts.length === 0) {
    return undefined;
  }

  // Find district with highest proportion
  let maxProportion = -1;
  let primaryDistrict: string | undefined;

  detail.districts.forEach((districtId, idx) => {
    if (detail.proportions[idx] > maxProportion) {
      maxProportion = detail.proportions[idx];
      primaryDistrict = districtId;
    }
  });

  return primaryDistrict;
}
