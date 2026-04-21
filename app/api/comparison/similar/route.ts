import { NextRequest, NextResponse } from 'next/server';
import {
  ComparisonEngine,
  SimilarityEngine,
  type PrecinctDataFile,
  type MunicipalityDataFile,
  type StateHouseDataFile,
  type BoundaryType,
  type ComparisonEntity,
  type SimilaritySearchOptions,
} from '@/lib/comparison';
import type { SimilarEntityResult } from '@/lib/comparison/types-similarity';
import { politicalDataService } from '@/lib/services/PoliticalDataService';
import { getPoliticalRegionEnv } from '@/lib/political/politicalRegionConfig';

// Cache by state FIPS + boundary type
const dataCache: Record<string, PrecinctDataFile | MunicipalityDataFile | StateHouseDataFile> = {};

function comparisonDataCacheKey(boundaryType: BoundaryType): string {
  return `${getPoliticalRegionEnv().stateFips}:${boundaryType}`;
}

/**
 * Load boundary data based on type
 * Uses PoliticalDataService for precincts (blob storage),
 * local files for municipalities and state_house (not yet in blob storage)
 */
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

  throw new Error(`Unsupported boundary type for comparison: ${boundaryType}`);
}

/**
 * Build entity from ID based on boundary type
 */
function buildEntity(
  engine: ComparisonEngine,
  entityId: string,
  boundaryType: BoundaryType
): ComparisonEntity {
  switch (boundaryType) {
    case 'precincts':
      return engine.buildPrecinctEntity(entityId);
    case 'municipalities':
      return engine.buildMunicipalityEntity(entityId);
    case 'state_house':
    case 'state_senate':
    case 'congressional':
    case 'school_districts':
    case 'county':
    case 'zip_codes':
      return engine.buildStateHouseEntity(entityId);
    default:
      throw new Error(`Unsupported boundary type: ${boundaryType}`);
  }
}

/**
 * Get all entities from engine based on boundary type
 */
function getAllEntities(
  engine: ComparisonEngine,
  boundaryType: BoundaryType
): ComparisonEntity[] {
  switch (boundaryType) {
    case 'precincts': {
      const precincts = engine.getPrecinctList();
      return precincts.map(p => engine.buildPrecinctEntity(p.id));
    }
    case 'municipalities': {
      const municipalities = engine.getMunicipalityList();
      return municipalities.map(m => engine.buildMunicipalityEntity(m.id));
    }
    case 'state_house':
    case 'state_senate':
    case 'congressional':
    case 'school_districts':
    case 'county':
    case 'zip_codes': {
      const districts = engine.getStateHouseList();
      return districts.map(d => engine.buildStateHouseEntity(d.id));
    }
    default:
      throw new Error(`Unsupported boundary type: ${boundaryType}`);
  }
}

/**
 * GET /api/comparison/similar
 *
 * Find similar entities based on similarity scoring
 *
 * Query params:
 * - entityId (required): ID of entity to find similar matches for
 * - boundaryType (required): 'precincts' | 'municipalities' | 'state_house'
 * - limit (optional, default 5): Max results
 * - minSimilarity (optional, default 60): Minimum similarity score
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // Required params
    const entityId = searchParams.get('entityId');
    const boundaryType = searchParams.get('boundaryType') as BoundaryType;

    if (!entityId) {
      return NextResponse.json(
        { error: 'entityId parameter is required' },
        { status: 400 }
      );
    }

    if (!boundaryType) {
      return NextResponse.json(
        { error: 'boundaryType parameter is required' },
        { status: 400 }
      );
    }

    // Optional params
    const limit = parseInt(searchParams.get('limit') || '5', 10);
    const minSimilarity = parseInt(searchParams.get('minSimilarity') || '60', 10);

    // Load data and build engine
    const data = await loadBoundaryData(boundaryType);
    const comparisonEngine = new ComparisonEngine(data);
    const similarityEngine = new SimilarityEngine();

    // Build reference entity
    const referenceEntity = buildEntity(comparisonEngine, entityId, boundaryType);

    // Get all entities for comparison
    const allEntities = getAllEntities(comparisonEngine, boundaryType);

    // Search options
    const searchOptions: Partial<SimilaritySearchOptions> = {
      minSimilarity,
      maxResults: limit,
    };

    // Find similar entities
    const results: SimilarEntityResult[] = similarityEngine.findSimilar(
      referenceEntity,
      allEntities,
      searchOptions
    );

    return NextResponse.json({
      referenceEntity: {
        id: referenceEntity.id,
        name: referenceEntity.name,
        type: referenceEntity.type,
      },
      boundaryType,
      results,
      count: results.length,
      options: {
        minSimilarity,
        maxResults: limit,
      },
    });
  } catch (error) {
    console.error('Similarity search API error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Similarity search failed',
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/comparison/similar
 *
 * Advanced similarity search with custom options
 *
 * Body:
 * {
 *   entityId: string;
 *   boundaryType: BoundaryType;
 *   options: SimilaritySearchOptions;
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { entityId, boundaryType, options } = body;

    // Validate required fields
    if (!entityId) {
      return NextResponse.json(
        { error: 'entityId is required' },
        { status: 400 }
      );
    }

    if (!boundaryType) {
      return NextResponse.json(
        { error: 'boundaryType is required' },
        { status: 400 }
      );
    }

    // Load data and build engines
    const data = await loadBoundaryData(boundaryType);
    const comparisonEngine = new ComparisonEngine(data);

    // Create similarity engine with custom weights if provided
    const similarityEngine = options?.customWeights
      ? new SimilarityEngine(options.customWeights)
      : new SimilarityEngine();

    // Build reference entity
    const referenceEntity = buildEntity(comparisonEngine, entityId, boundaryType);

    // Get all entities for comparison
    const allEntities = getAllEntities(comparisonEngine, boundaryType);

    // Merge default options with provided options
    const searchOptions: Partial<SimilaritySearchOptions> = {
      minSimilarity: 60,
      maxResults: 10,
      ...options,
    };

    // Find similar entities
    const results: SimilarEntityResult[] = similarityEngine.findSimilar(
      referenceEntity,
      allEntities,
      searchOptions
    );

    return NextResponse.json({
      referenceEntity: {
        id: referenceEntity.id,
        name: referenceEntity.name,
        type: referenceEntity.type,
      },
      boundaryType,
      results,
      count: results.length,
      options: searchOptions,
    });
  } catch (error) {
    console.error('Similarity search API error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Similarity search failed',
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
