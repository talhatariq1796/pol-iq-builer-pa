import { NextRequest, NextResponse } from 'next/server';
import {
  ComparisonEngine,
  BatchComparisonEngine,
  type PrecinctDataFile,
  type MunicipalityDataFile,
  type StateHouseDataFile,
  type BoundaryType,
  type ComparisonEntity,
  type BatchComparisonResult,
  type BatchComparisonOptions,
} from '@/lib/comparison';
import { politicalDataService } from '@/lib/services/PoliticalDataService';
import { getPoliticalRegionEnv } from '@/lib/political/politicalRegionConfig';

// Cache by state FIPS + boundary type
const dataCache: Record<string, PrecinctDataFile | MunicipalityDataFile | StateHouseDataFile> = {};

function batchDataCacheKey(boundaryType: BoundaryType): string {
  return `${getPoliticalRegionEnv().stateFips}:${boundaryType}`;
}

/** Load boundary data — municipalities and legislative districts are PA-only (state FIPS 42). */
async function loadBoundaryData(
  boundaryType: BoundaryType
): Promise<PrecinctDataFile | MunicipalityDataFile | StateHouseDataFile> {
  const key = batchDataCacheKey(boundaryType);
  if (dataCache[key]) {
    return dataCache[key];
  }

  // For precincts, use PoliticalDataService (single source of truth)
  if (boundaryType === 'precincts') {
    const data = await politicalDataService.getPrecinctDataFileFormat();
    dataCache[key] = data as PrecinctDataFile;
    return data as PrecinctDataFile;
  }

  if (boundaryType === 'municipalities' && getPoliticalRegionEnv().stateFips === '42') {
    const data = await politicalDataService.getMunicipalityDataFileFormat();
    dataCache[key] = data as MunicipalityDataFile;
    return data as MunicipalityDataFile;
  }

  if (getPoliticalRegionEnv().stateFips === '42') {
    if (boundaryType === 'state_house') {
      const data = await politicalDataService.getPaDistrictChamberDataFile('state_house');
      dataCache[key] = data as StateHouseDataFile;
      return data as StateHouseDataFile;
    }
    if (boundaryType === 'state_senate') {
      const data = await politicalDataService.getPaDistrictChamberDataFile('state_senate');
      dataCache[key] = data as StateHouseDataFile;
      return data as StateHouseDataFile;
    }
    if (boundaryType === 'congressional') {
      const data = await politicalDataService.getPaDistrictChamberDataFile('congressional');
      dataCache[key] = data as StateHouseDataFile;
      return data as StateHouseDataFile;
    }
    if (boundaryType === 'county') {
      const data = await politicalDataService.getPaCountyDataFileFormat();
      dataCache[key] = data as StateHouseDataFile;
      return data as StateHouseDataFile;
    }
    if (boundaryType === 'school_districts') {
      const data = await politicalDataService.getPaSchoolDistrictDataFileFormat();
      dataCache[key] = data as StateHouseDataFile;
      return data as StateHouseDataFile;
    }
    if (boundaryType === 'zip_codes') {
      const data = await politicalDataService.getPaZipCodeDataFileFormat();
      dataCache[key] = data as StateHouseDataFile;
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

  throw new Error(`Unsupported boundary type for batch comparison: ${boundaryType}`);
}

/**
 * Build comparison entities from entity IDs
 */
function buildEntities(
  entityIds: string[],
  boundaryType: BoundaryType,
  engine: ComparisonEngine
): ComparisonEntity[] {
  const entities: ComparisonEntity[] = [];

  for (const entityId of entityIds) {
    let entity: ComparisonEntity | null = null;

    try {
      // Build entity based on boundary type
      switch (boundaryType) {
        case 'precincts':
          entity = engine.buildPrecinctEntity(entityId);
          break;
        case 'municipalities':
          entity = engine.buildMunicipalityEntity(entityId);
          break;
        case 'state_house':
        case 'state_senate':
        case 'congressional':
        case 'school_districts':
        case 'county':
        case 'zip_codes':
          entity = engine.buildStateHouseEntity(entityId);
          break;
        default:
          // Try jurisdiction entity (from precinct data file)
          entity = engine.buildJurisdictionEntity(entityId);
          break;
      }

      if (entity) {
        entities.push(entity);
      }
    } catch (error) {
      console.error(`Failed to build entity ${entityId}:`, error);
      // Continue to next entity
    }
  }

  return entities;
}

/**
 * POST /api/comparison/batch
 *
 * Request body:
 * {
 *   entityIds: string[];  // 3-8 entity IDs
 *   boundaryType: 'precincts' | 'municipalities' | 'state_house';
 *   options?: {
 *     includeSimilarities?: boolean;  // Include pairwise similarity matrix
 *     includeClustering?: boolean;  // Include cluster analysis
 *     clusterCount?: number;  // Number of clusters (default: 3)
 *     includeCorrelations?: boolean;  // Include metric correlations
 *   }
 * }
 *
 * Returns BatchComparisonResult with:
 * - entities: Built comparison entities
 * - analytics: Matrix-level statistical analysis (demographics, political, targeting)
 * - rankings: Rankings by different metrics (GOTV, persuasion, ROI, etc.)
 * - clusters: K-means clusters (if includeClustering)
 * - pairwiseSimilarities: Pairwise similarities (if includeSimilarities)
 * - timestamp: Comparison timestamp
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { entityIds, boundaryType = 'precincts', options = {} } = body;

    // Validate entityIds
    if (!entityIds || !Array.isArray(entityIds)) {
      return NextResponse.json(
        { error: 'entityIds must be an array of entity IDs' },
        { status: 400 }
      );
    }

    if (entityIds.length < 3) {
      return NextResponse.json(
        { error: 'Batch comparison requires at least 3 entities' },
        { status: 400 }
      );
    }

    if (entityIds.length > 8) {
      return NextResponse.json(
        { error: 'Batch comparison supports maximum 8 entities' },
        { status: 400 }
      );
    }

    // Validate boundary type
    const validBoundaryTypes: BoundaryType[] = [
      'precincts',
      'municipalities',
      'state_house',
      'state_senate',
      'congressional',
      'school_districts',
      'county',
      'zip_codes',
    ];
    if (!validBoundaryTypes.includes(boundaryType)) {
      return NextResponse.json(
        {
          error: `Invalid boundaryType. Must be one of: ${validBoundaryTypes.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Load boundary data
    const data = await loadBoundaryData(boundaryType);

    // Initialize engines
    const comparisonEngine = new ComparisonEngine(data);
    const batchEngine = new BatchComparisonEngine();

    // Build entities
    const entities = buildEntities(entityIds, boundaryType, comparisonEngine);

    if (entities.length < 3) {
      return NextResponse.json(
        {
          error: `Could only build ${entities.length} valid entities from provided IDs. Batch comparison requires at least 3 valid entities.`,
        },
        { status: 400 }
      );
    }

    // Parse options
    const batchOptions: Partial<BatchComparisonOptions> = {
      includeSimilarities: options.includeSimilarities ?? false,
      includeClustering: options.includeClustering ?? true,
      clusterCount: options.clusterCount ?? 3,
      includeCorrelations: options.includeCorrelations ?? true,
    };

    // Perform batch comparison
    const result: BatchComparisonResult = batchEngine.compareBatch(entities, batchOptions);

    // Generate insights
    const insights = batchEngine.generateInsights(result);

    // Return result with insights
    return NextResponse.json({
      ...result,
      insights,
    });
  } catch (error) {
    console.error('Batch comparison API error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Batch comparison failed',
      },
      { status: 500 }
    );
  }
}
