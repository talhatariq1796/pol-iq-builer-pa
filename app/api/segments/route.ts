/**
 * Voter Segmentation API Route
 *
 * Handles segment queries, precinct data retrieval, and preset management
 *
 * GET endpoints:
 *   - ?action=precincts - Return all precinct data
 *   - ?action=presets - Return preset segment definitions
 *   - ?action=query&filters=... - Execute segment query with filters
 *
 * POST endpoints:
 *   - Body: { filters: SegmentFilters } - Execute segment query
 */

import { NextRequest, NextResponse } from 'next/server';
import { SegmentEngine, getAllPresets } from '@/lib/segmentation';
import type { SegmentFilters } from '@/lib/segmentation';
import { politicalDataService } from '@/lib/services/PoliticalDataService';

// Internal precinct data type matching SegmentEngine expectations
type PrecinctDataJSON = Awaited<ReturnType<typeof politicalDataService.getSegmentEnginePrecincts>>[number];

/**
 * Load precinct data from PoliticalDataService (single source of truth)
 * Uses blob storage for consistent data across all components
 */
async function loadPrecinctData(): Promise<PrecinctDataJSON[]> {
  try {
    const precincts = await politicalDataService.getSegmentEnginePrecincts();
    console.log(`[segments/route] Loaded ${precincts.length} precincts from PoliticalDataService`);
    return precincts;
  } catch (error) {
    console.error('Error loading precinct data:', error);
    throw new Error('Failed to load precinct data');
  }
}

/**
 * GET /api/segments
 *
 * Query parameters:
 *   - action=precincts: Return all precinct data
 *   - action=presets: Return preset segment definitions
 *   - action=query&filters=<json>: Execute segment query
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // Return all precincts
    if (action === 'precincts') {
      const precincts = await loadPrecinctData();
      return NextResponse.json({
        success: true,
        precincts,
      });
    }

    // Return preset definitions
    if (action === 'presets') {
      const presets = getAllPresets();
      return NextResponse.json({
        success: true,
        presets,
      });
    }

    // Execute segment query
    if (action === 'query') {
      const filtersParam = searchParams.get('filters');

      if (!filtersParam) {
        return NextResponse.json(
          {
            success: false,
            error: 'Missing filters parameter',
          },
          { status: 400 }
        );
      }

      let filters: SegmentFilters;
      try {
        filters = JSON.parse(filtersParam);
      } catch (error) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid JSON in filters parameter',
          },
          { status: 400 }
        );
      }

      const precincts = await loadPrecinctData();
      const engine = new SegmentEngine(precincts as any);
      const results = engine.query(filters);

      return NextResponse.json({
        success: true,
        results,
      });
    }

    // Unknown action
    return NextResponse.json(
      {
        success: false,
        error: 'Invalid action parameter. Use: precincts, presets, or query',
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error in GET /api/segments:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/segments
 *
 * Body: { filters: SegmentFilters }
 *
 * Execute segment query and return results
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { filters } = body;

    if (!filters) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing filters in request body',
        },
        { status: 400 }
      );
    }

    // Validate filters structure (basic check)
    if (typeof filters !== 'object' || filters === null) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid filters format',
        },
        { status: 400 }
      );
    }

    const precincts = await loadPrecinctData();
    const engine = new SegmentEngine(precincts as any);
    const results = engine.query(filters as SegmentFilters);

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error('Error in POST /api/segments:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
