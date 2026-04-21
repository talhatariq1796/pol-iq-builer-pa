/**
 * Boundary type definitions and metadata
 * for split screen comparison tool
 */

import type { BoundaryTypeInfo } from './types';

/**
 * Available boundary types for comparison
 *
 * Available types have data loaded and ready to use.
 * Unavailable types are shown but disabled with "Data coming soon" message.
 */
export const BOUNDARY_TYPES: BoundaryTypeInfo[] = [
  {
    value: 'precincts',
    label: 'Precincts',
    description: 'Pennsylvania voting precincts — statewide (unified targeting + election history)',
    entityType: 'precinct',
    available: true,
    dataSource: 'PoliticalDataService (PA precincts)',
  },
  {
    value: 'municipalities',
    label: 'Municipalities',
    description: 'Cities and townships — aggregated from PA precinct jurisdictions',
    entityType: 'jurisdiction',
    available: true,
    dataSource: 'PoliticalDataService (PA municipalities)',
  },
  {
    value: 'state_house',
    label: 'State House Districts',
    description: 'Pennsylvania State House — aggregated from precincts and district crosswalk',
    entityType: 'jurisdiction',
    available: true,
    dataSource: 'PoliticalDataService + PA precinct–district crosswalk',
  },
  {
    value: 'state_senate',
    label: 'State Senate Districts',
    description: 'Pennsylvania State Senate — aggregated from precincts and district crosswalk',
    entityType: 'jurisdiction',
    available: true,
    dataSource: 'PoliticalDataService + PA precinct–district crosswalk',
  },
  {
    value: 'congressional',
    label: 'Congressional Districts',
    description: 'U.S. House districts in Pennsylvania — aggregated from precincts and district crosswalk',
    entityType: 'jurisdiction',
    available: true,
    dataSource: 'PoliticalDataService + PA precinct–district crosswalk',
  },
  {
    value: 'school_districts',
    label: 'School Districts',
    description:
      'Pennsylvania K-12 school districts — aggregated from precincts + crosswalk (centroid in district polygon)',
    entityType: 'jurisdiction',
    available: true,
    dataSource: 'PoliticalDataService + pa_precinct_district_crosswalk (schoolDistrict)',
  },
  {
    value: 'county',
    label: 'Counties',
    description: 'Pennsylvania counties — aggregated from precinct county FIPS (precinct UNIQUE_ID prefix)',
    entityType: 'jurisdiction',
    available: true,
    dataSource: 'PoliticalDataService (COUNTYFP from precinct key)',
  },
  {
    value: 'zip_codes',
    label: 'ZIP Codes',
    description: 'Pennsylvania ZCTA / ZIP areas — aggregated from precincts + crosswalk (centroid in ZIP polygon)',
    entityType: 'jurisdiction',
    available: true,
    dataSource: 'PoliticalDataService + pa_precinct_district_crosswalk (zcta)',
  },
];

/**
 * Get boundary type info by value
 */
export function getBoundaryTypeInfo(value: string): BoundaryTypeInfo | undefined {
  return BOUNDARY_TYPES.find((type) => type.value === value);
}

/**
 * Get available boundary types only
 */
export function getAvailableBoundaryTypes(): BoundaryTypeInfo[] {
  return BOUNDARY_TYPES.filter((type) => type.available);
}

/**
 * Check if a boundary type is available
 */
export function isBoundaryTypeAvailable(value: string): boolean {
  const type = getBoundaryTypeInfo(value);
  return type?.available ?? false;
}
