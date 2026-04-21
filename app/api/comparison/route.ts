import { NextRequest, NextResponse } from 'next/server';
import { ComparisonEngine, InsightGenerator } from '@/lib/comparison';
import type { PrecinctDataFile, MunicipalityDataFile, StateHouseDataFile, BoundaryType } from '@/lib/comparison';
import { politicalDataService } from '@/lib/services/PoliticalDataService';
import { getPoliticalRegionEnv } from '@/lib/political/politicalRegionConfig';

export const dynamic = 'force-dynamic';

// Cache the data in memory by state FIPS + boundary type (avoids stale data if region env changes)
const dataCache: Record<string, PrecinctDataFile | MunicipalityDataFile | StateHouseDataFile> = {};

function comparisonDataCacheKey(boundaryType: BoundaryType): string {
  return `${getPoliticalRegionEnv().stateFips}:${boundaryType}`;
}

/** Load boundary data — municipalities and legislative districts are PA-only (state FIPS 42). */
async function loadBoundaryData(
  boundaryType: BoundaryType
): Promise<PrecinctDataFile | MunicipalityDataFile | StateHouseDataFile> {
  const key = comparisonDataCacheKey(boundaryType);
  if (dataCache[key]) {
    return dataCache[key];
  }

  // For precincts, use PoliticalDataService (single source of truth)
  if (boundaryType === 'precincts') {
    const data = await politicalDataService.getPrecinctDataFileFormat();
    dataCache[key] = data as PrecinctDataFile;
    console.log(`[comparison/route] Loaded ${Object.keys(data.precincts).length} precincts from PoliticalDataService`);
    return data as PrecinctDataFile;
  }

  // Pennsylvania: municipalities aggregated from unified precincts
  if (boundaryType === 'municipalities' && getPoliticalRegionEnv().stateFips === '42') {
    const data = await politicalDataService.getMunicipalityDataFileFormat();
    dataCache[key] = data as MunicipalityDataFile;
    console.log(
      `[comparison/route] Loaded ${data.municipalities.length} PA municipalities from PoliticalDataService`,
    );
    return data as MunicipalityDataFile;
  }

  // Pennsylvania: state house / senate / congress from precincts + crosswalk
  if (getPoliticalRegionEnv().stateFips === '42') {
    if (boundaryType === 'state_house') {
      const data = await politicalDataService.getPaDistrictChamberDataFile('state_house');
      dataCache[key] = data as StateHouseDataFile;
      console.log(`[comparison/route] Loaded ${data.districts.length} PA state house districts`);
      return data as StateHouseDataFile;
    }
    if (boundaryType === 'state_senate') {
      const data = await politicalDataService.getPaDistrictChamberDataFile('state_senate');
      dataCache[key] = data as StateHouseDataFile;
      console.log(`[comparison/route] Loaded ${data.districts.length} PA state senate districts`);
      return data as StateHouseDataFile;
    }
    if (boundaryType === 'congressional') {
      const data = await politicalDataService.getPaDistrictChamberDataFile('congressional');
      dataCache[key] = data as StateHouseDataFile;
      console.log(`[comparison/route] Loaded ${data.districts.length} PA congressional districts`);
      return data as StateHouseDataFile;
    }
    if (boundaryType === 'county') {
      const data = await politicalDataService.getPaCountyDataFileFormat();
      dataCache[key] = data as StateHouseDataFile;
      console.log(`[comparison/route] Loaded ${data.districts.length} PA counties`);
      return data as StateHouseDataFile;
    }
    if (boundaryType === 'school_districts') {
      const data = await politicalDataService.getPaSchoolDistrictDataFileFormat();
      dataCache[key] = data as StateHouseDataFile;
      console.log(`[comparison/route] Loaded ${data.districts.length} PA school districts`);
      return data as StateHouseDataFile;
    }
    if (boundaryType === 'zip_codes') {
      const data = await politicalDataService.getPaZipCodeDataFileFormat();
      dataCache[key] = data as StateHouseDataFile;
      console.log(`[comparison/route] Loaded ${data.districts.length} PA ZIP / ZCTA areas`);
      return data as StateHouseDataFile;
    }
  }

  if (
    boundaryType === 'municipalities' ||
    boundaryType === 'state_house' ||
    boundaryType === 'state_senate' ||
    boundaryType === 'congressional' ||
    boundaryType === 'county' ||
    boundaryType === 'school_districts' ||
    boundaryType === 'zip_codes'
  ) {
    throw new Error(
      `Comparison boundary "${boundaryType}" requires Pennsylvania data (POLITICAL_STATE_FIPS=42).`
    );
  }

  throw new Error(`Unsupported boundary type for comparison: ${boundaryType}`);
}

/**
 * Valid boundary types for comparison
 */
const VALID_BOUNDARY_TYPES: BoundaryType[] = [
  'precincts',
  'municipalities',
  'state_house',
  'state_senate',
  'congressional',
  'school_districts',
  'county',
  'zip_codes',
];

/**
 * Valid list types
 */
const VALID_LIST_TYPES = [
  'precincts',
  'jurisdictions',
  'municipalities',
  'state_house',
  'state_senate',
  'congressional',
  'school_districts',
  'county',
  'zip_codes',
] as const;

/** District-style lists (StateHouseDataFile + getStateHouseList). */
const PA_DISTRICT_STYLE_BOUNDARIES: BoundaryType[] = [
  'state_house',
  'state_senate',
  'congressional',
  'school_districts',
  'county',
  'zip_codes',
];

/**
 * GET /api/comparison
 *
 * Query params:
 * - left: ID of left entity
 * - right: ID of right entity
 * - leftType: 'precinct' | 'jurisdiction' | 'municipality' | 'state_house'
 * - rightType: 'precinct' | 'jurisdiction' | 'municipality' | 'state_house'
 * - boundaryType: 'precincts' | 'municipalities' | 'state_house' (required for comparison)
 *
 * Or for listing:
 * - list: 'precincts' | 'jurisdictions' | 'municipalities' | 'state_house'
 * - boundaryType: 'precincts' | 'municipalities' | 'state_house' (required for list)
 * - jurisdiction: (optional) filter precincts by jurisdiction
 * - q: (optional) case-insensitive substring on name, id, jurisdiction (precinct list only)
 * - limit: (optional) max rows returned for precinct list (default 80, max 200); without q, list is sorted A–Z then capped
 * - id: (optional) return at most one precinct matching this id (for label lookup without loading full list)
 * - For list=municipalities: same q, limit, id, truncated, total as precincts (PA large lists)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const list = searchParams.get('list');
    const boundaryTypeParam = searchParams.get('boundaryType') || 'precincts';

    // Validate boundaryType
    if (!VALID_BOUNDARY_TYPES.includes(boundaryTypeParam as BoundaryType)) {
      return NextResponse.json(
        {
          error: 'Invalid boundaryType parameter',
          message: `boundaryType must be one of: ${VALID_BOUNDARY_TYPES.join(', ')}`,
          received: boundaryTypeParam
        },
        { status: 400 }
      );
    }

    const boundaryType = boundaryTypeParam as BoundaryType;

    // Validate list parameter if provided
    if (list && !VALID_LIST_TYPES.includes(list as typeof VALID_LIST_TYPES[number])) {
      return NextResponse.json(
        {
          error: 'Invalid list parameter',
          message: `list must be one of: ${VALID_LIST_TYPES.join(', ')}`,
          received: list
        },
        { status: 400 }
      );
    }

    const data = await loadBoundaryData(boundaryType);
    const engine = new ComparisonEngine(data);

    // List mode
    if (list === 'precincts') {
      const jurisdiction = searchParams.get('jurisdiction');
      const lookupId = searchParams.get('id')?.trim();
      const qRaw = searchParams.get('q');
      const q = qRaw?.trim().toLowerCase() ?? '';
      const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '80', 10)));

      let precincts = engine.getPrecinctList();

      if (lookupId) {
        const found = precincts.find(
          p =>
            p.id === lookupId ||
            p.name.toLowerCase() === lookupId.toLowerCase()
        );
        return NextResponse.json({ precincts: found ? [found] : [] });
      }

      if (jurisdiction) {
        precincts = precincts.filter(
          p => p.jurisdiction.toLowerCase() === jurisdiction.toLowerCase()
        );
      }

      let totalAfterFilter = precincts.length;

      if (q) {
        precincts = precincts.filter(
          p =>
            p.name.toLowerCase().includes(q) ||
            p.id.toLowerCase().includes(q) ||
            (p.jurisdiction && p.jurisdiction.toLowerCase().includes(q))
        );
        totalAfterFilter = precincts.length;
      } else {
        precincts = [...precincts].sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        );
      }

      const truncated = precincts.length > limit;
      precincts = precincts.slice(0, limit);

      return NextResponse.json({
        precincts,
        truncated,
        total: totalAfterFilter,
      });
    }

    if (list === 'jurisdictions') {
      const jurisdictions = engine.getJurisdictionList();
      return NextResponse.json({ jurisdictions });
    }

    if (list === 'municipalities') {
      const lookupId = searchParams.get('id')?.trim();
      const qRaw = searchParams.get('q');
      const q = qRaw?.trim().toLowerCase() ?? '';
      const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '80', 10)));

      let municipalities = engine.getMunicipalityList();

      if (lookupId) {
        const found = municipalities.find(
          (m) =>
            m.id === lookupId ||
            m.name.toLowerCase() === lookupId.toLowerCase()
        );
        return NextResponse.json({ municipalities: found ? [found] : [] });
      }

      let totalAfterFilter = municipalities.length;

      if (q) {
        municipalities = municipalities.filter(
          (m) =>
            m.name.toLowerCase().includes(q) ||
            m.id.toLowerCase().includes(q) ||
            (m.type && m.type.toLowerCase().includes(q))
        );
        totalAfterFilter = municipalities.length;
      } else {
        municipalities = [...municipalities].sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        );
      }

      const truncated = municipalities.length > limit;
      municipalities = municipalities.slice(0, limit);

      return NextResponse.json({
        municipalities,
        truncated,
        total: totalAfterFilter,
      });
    }

    if (list && PA_DISTRICT_STYLE_BOUNDARIES.includes(list as BoundaryType)) {
      if (list !== boundaryType) {
        return NextResponse.json(
          {
            error: 'Invalid list / boundaryType',
            message: 'For district lists, list must match boundaryType (e.g. list=county&boundaryType=county)',
            received: { list, boundaryType },
          },
          { status: 400 },
        );
      }

      const lookupId = searchParams.get('id')?.trim();
      const qRaw = searchParams.get('q');
      const q = qRaw?.trim().toLowerCase() ?? '';
      const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '80', 10)));

      let districts = engine.getStateHouseList();

      if (lookupId) {
        const found = districts.find(
          (d) =>
            d.id === lookupId ||
            d.name.toLowerCase() === lookupId.toLowerCase()
        );
        return NextResponse.json({ districts: found ? [found] : [] });
      }

      let totalAfterFilter = districts.length;

      if (q) {
        districts = districts.filter(
          (d) =>
            d.name.toLowerCase().includes(q) ||
            d.id.toLowerCase().includes(q)
        );
        totalAfterFilter = districts.length;
      } else {
        districts = [...districts].sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        );
      }

      const truncated = districts.length > limit;
      districts = districts.slice(0, limit);

      return NextResponse.json({
        districts,
        truncated,
        total: totalAfterFilter,
      });
    }

    // Comparison mode
    const leftId = searchParams.get('left');
    const rightId = searchParams.get('right');

    // Validate entity IDs are provided
    if (!leftId || !rightId) {
      return NextResponse.json(
        {
          error: 'Missing required parameters',
          message: 'Both left and right entity IDs are required for comparison',
          missing: [
            !leftId ? 'left' : null,
            !rightId ? 'right' : null
          ].filter(Boolean)
        },
        { status: 400 }
      );
    }

    // Validate entity IDs are non-empty strings
    const trimmedLeftId = leftId.trim();
    const trimmedRightId = rightId.trim();

    if (!trimmedLeftId || !trimmedRightId) {
      return NextResponse.json(
        {
          error: 'Invalid entity IDs',
          message: 'Entity IDs cannot be empty or whitespace-only',
          received: {
            left: leftId,
            right: rightId
          }
        },
        { status: 400 }
      );
    }

    // Build entities based on boundary type
    let leftEntity;
    let rightEntity;

    // Determine entity builder based on boundaryType
    switch (boundaryType) {
      case 'precincts':
        leftEntity = engine.buildPrecinctEntity(trimmedLeftId);
        rightEntity = engine.buildPrecinctEntity(trimmedRightId);
        break;
      case 'municipalities':
        leftEntity = engine.buildMunicipalityEntity(trimmedLeftId);
        rightEntity = engine.buildMunicipalityEntity(trimmedRightId);
        break;
      case 'state_house':
      case 'state_senate':
      case 'congressional':
      case 'school_districts':
      case 'county':
      case 'zip_codes':
        leftEntity = engine.buildStateHouseEntity(trimmedLeftId);
        rightEntity = engine.buildStateHouseEntity(trimmedRightId);
        break;
      default:
        // For other types, try jurisdiction entity (from precinct data file)
        leftEntity = engine.buildJurisdictionEntity(trimmedLeftId);
        rightEntity = engine.buildJurisdictionEntity(trimmedRightId);
        break;
    }

    // Validate entities were successfully built
    if (!leftEntity) {
      return NextResponse.json(
        {
          error: 'Entity not found',
          message: `Left entity with ID "${trimmedLeftId}" not found in ${boundaryType}`,
          entityId: trimmedLeftId,
          boundaryType
        },
        { status: 404 }
      );
    }

    if (!rightEntity) {
      return NextResponse.json(
        {
          error: 'Entity not found',
          message: `Right entity with ID "${trimmedRightId}" not found in ${boundaryType}`,
          entityId: trimmedRightId,
          boundaryType
        },
        { status: 404 }
      );
    }

    // Compare
    const comparison = engine.compare(leftEntity, rightEntity);

    // Generate insights
    const insightGenerator = new InsightGenerator();
    comparison.insights = insightGenerator.generateInsights(comparison);

    return NextResponse.json(comparison);
  } catch (error) {
    console.error('Comparison API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Comparison failed' },
      { status: 500 }
    );
  }
}
