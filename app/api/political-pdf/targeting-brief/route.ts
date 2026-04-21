import { NextRequest, NextResponse } from 'next/server';
import { TargetingBriefPDFGenerator } from '@/lib/pdf/political/TargetingBriefPDFGenerator';
import type {
  TargetingBriefConfig,
  PrecinctTargetingData,
} from '@/lib/pdf/political/TargetingBriefPDFGenerator';
import { politicalDataService } from '@/lib/services/PoliticalDataService';
import { getPoliticalRegionEnv } from '@/lib/political/politicalRegionConfig';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 45; // May have many precincts
export const fetchCache = 'force-no-store';
export const revalidate = 0;

/**
 * Request body interface
 */
interface TargetingBriefRequest {
  // Required: Array of precinct names to include
  precinctNames: string[];

  // Optional: Report title
  reportTitle?: string;

  // Optional: Segment name
  segmentName?: string;

  // Optional: Filter criteria descriptions
  filterCriteria?: string[];

  // Optional: Sort field
  sortBy?: 'gotv' | 'persuasion' | 'swing' | 'voters' | 'combined';

  // Optional: Sort order
  sortOrder?: 'asc' | 'desc';

  // Optional: Limit results
  limit?: number;
}

/**
 * POST /api/political-pdf/targeting-brief
 *
 * Generates 1-2 page Targeting Brief PDF with ranked precincts
 */
export async function POST(request: NextRequest) {
  try {
    const region = getPoliticalRegionEnv();
    const body: TargetingBriefRequest = await request.json();

    console.log('[Targeting Brief API] Generating for precincts:', body.precinctNames?.length || 0);

    // Validate request
    if (!body.precinctNames || body.precinctNames.length === 0) {
      return NextResponse.json(
        { error: 'At least one precinct name is required' },
        { status: 400 }
      );
    }

    // Initialize data service
    await politicalDataService.initialize();

    // Load data for all requested precincts
    const precinctDataPromises = body.precinctNames.map(async (precinctName) => {
      const [scores, targetingScores, demographics] = await Promise.all([
        politicalDataService.getPrecinctScores(precinctName),
        politicalDataService.getPrecinctTargetingScores(precinctName),
        politicalDataService.getPrecinctDemographics(precinctName),
      ]);

      return {
        precinctName,
        scores,
        targetingScores,
        demographics,
      };
    });

    const precinctDataList = await Promise.all(precinctDataPromises);

    // Filter out precincts with no data
    const validPrecincts = precinctDataList.filter((p) => p.scores !== null);

    if (validPrecincts.length === 0) {
      return NextResponse.json(
        { error: 'No valid precinct data found' },
        { status: 404 }
      );
    }

    console.log(`[Targeting Brief API] Found ${validPrecincts.length} valid precincts`);

    // Transform to targeting data format
    const targetingData: PrecinctTargetingData[] = validPrecincts.map((p) => {
      const scores = p.scores;
      const targeting = p.targetingScores;
      const demo = p.demographics;

      const gotvScore = targeting?.gotv_priority ?? 50;
      const persuasionScore = targeting?.persuasion_opportunity ?? 50;
      const swingPotential = scores?.swingPotential?.value ?? 50;
      const partisanLean = scores?.partisanLean?.value ?? 0;
      const registeredVoters = demo?.registeredVoters ?? (targeting?.registered_voters ?? 0);
      const avgTurnout = scores?.turnout?.averageTurnout ?? 55;

      // Calculate combined score for sorting
      const combinedScore = (gotvScore + persuasionScore + swingPotential) / 3;

      // Determine priority tier
      let priorityTier: 'High' | 'Medium' | 'Low';
      if (combinedScore >= 70) {
        priorityTier = 'High';
      } else if (combinedScore >= 50) {
        priorityTier = 'Medium';
      } else {
        priorityTier = 'Low';
      }

      // Extract jurisdiction from precinct name
      const nameParts = p.precinctName.split(',');
      const jurisdiction = nameParts.length > 1 ? nameParts[0].trim() : region.summaryAreaName;

      return {
        rank: 0, // Will be set after sorting
        name: p.precinctName,
        jurisdiction,
        gotvScore,
        persuasionScore,
        swingPotential,
        partisanLean,
        registeredVoters,
        avgTurnout,
        priorityTier,
        _combinedScore: combinedScore, // For sorting
      } as PrecinctTargetingData & { _combinedScore: number };
    });

    // Sort precincts
    const sortBy = body.sortBy || 'combined';
    const sortOrder = body.sortOrder || 'desc';

    targetingData.sort((a, b) => {
      let aValue: number, bValue: number;

      switch (sortBy) {
        case 'gotv':
          aValue = a.gotvScore;
          bValue = b.gotvScore;
          break;
        case 'persuasion':
          aValue = a.persuasionScore;
          bValue = b.persuasionScore;
          break;
        case 'swing':
          aValue = a.swingPotential;
          bValue = b.swingPotential;
          break;
        case 'voters':
          aValue = a.registeredVoters;
          bValue = b.registeredVoters;
          break;
        case 'combined':
        default:
          aValue = (a as any)._combinedScore;
          bValue = (b as any)._combinedScore;
          break;
      }

      return sortOrder === 'desc' ? bValue - aValue : aValue - bValue;
    });

    // Apply limit if specified
    const limitedData = body.limit ? targetingData.slice(0, body.limit) : targetingData;

    // Set ranks
    limitedData.forEach((p, index) => {
      p.rank = index + 1;
      // Clean up internal field
      delete (p as any)._combinedScore;
    });

    // Calculate summary stats
    const summary = {
      totalPrecincts: limitedData.length,
      totalVoters: limitedData.reduce((sum, p) => sum + p.registeredVoters, 0),
      avgGotvScore: limitedData.reduce((sum, p) => sum + p.gotvScore, 0) / limitedData.length,
      avgPersuasionScore: limitedData.reduce((sum, p) => sum + p.persuasionScore, 0) / limitedData.length,
      avgSwingPotential: limitedData.reduce((sum, p) => sum + p.swingPotential, 0) / limitedData.length,
      highPriorityCount: limitedData.filter((p) => p.priorityTier === 'High').length,
    };

    // Build config
    const config: TargetingBriefConfig = {
      reportTitle: body.reportTitle || 'Targeting Brief',
      segmentName: body.segmentName,
      filterCriteria: body.filterCriteria,
      summary,
      precincts: limitedData,
      county: region.county,
      state: region.state,
      generatedBy: 'Political Analysis Platform',
      reportDate: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    };

    // Generate PDF
    const generator = new TargetingBriefPDFGenerator();
    const pdfBlob = await generator.generateReport(config);

    // Convert blob to buffer
    const buffer = await pdfBlob.arrayBuffer();

    // Generate filename
    const sanitizedName = (body.segmentName || 'Targeting-Brief')
      .replace(/[^a-zA-Z0-9-_ ]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 30);
    const filename = `${sanitizedName}-${Date.now()}.pdf`;

    // Return PDF
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[Targeting Brief API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate targeting brief', details: String(error) },
      { status: 500 }
    );
  }
}
