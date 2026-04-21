import { NextRequest, NextResponse } from 'next/server';
import { PoliticalProfilePDFGeneratorV2 } from '@/lib/pdf/political/PoliticalProfilePDFGeneratorV2';
import type { PoliticalProfileConfig } from '@/lib/pdf/political/PoliticalProfilePDFGeneratorV2';
import { politicalDataService } from '@/lib/services/PoliticalDataService';
import { getPoliticalRegionEnv } from '@/lib/political/politicalRegionConfig';
import type {
  PrecinctPoliticalScores,
  PoliticalAreaSelection,
  TargetingPriority,
} from '@/types/political';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for batch generation
export const fetchCache = 'force-no-store';
export const revalidate = 0;

/**
 * Batch PDF generation request
 */
interface BatchPDFRequest {
  // Array of areas to generate reports for
  areas: Array<{
    precinctNames: string[];
    areaName?: string;
    areaDescription?: string;
  }>;

  // Optional: Which pages to include (1-7, defaults to all)
  selectedPages?: number[];
}

interface BatchResult {
  name: string;
  filename: string;
  success: boolean;
  pdfBase64?: string;
  error?: string;
}

/**
 * Batch PDF generation endpoint
 * POST /api/political-pdf/batch
 *
 * Generates multiple Political Profile PDFs and returns them as JSON with base64-encoded PDFs
 */
export async function POST(request: NextRequest) {
  try {
    const body: BatchPDFRequest = await request.json();

    console.log('[Batch PDF API] Starting batch generation for', body.areas.length, 'areas');

    // Validate request
    if (!body.areas || body.areas.length === 0) {
      return NextResponse.json(
        { error: 'At least one area is required' },
        { status: 400 }
      );
    }

    if (body.areas.length > 20) {
      return NextResponse.json(
        { error: 'Maximum 20 areas per batch' },
        { status: 400 }
      );
    }

    // Initialize data service
    await politicalDataService.initialize();

    const results: BatchResult[] = [];

    // Generate each PDF
    for (let i = 0; i < body.areas.length; i++) {
      const area = body.areas[i];
      const areaDisplayName = area.areaName || area.precinctNames.join(', ');

      try {
        console.log(`[Batch PDF API] Generating ${i + 1}/${body.areas.length}: ${areaDisplayName}`);

        // Load data for all requested precincts
        const precinctDataPromises = area.precinctNames.map(async (precinctName) => {
          const [scores, targetingScores, electionHistory, demographics, attitudes, engagement] =
            await Promise.all([
              politicalDataService.getPrecinctScores(precinctName),
              politicalDataService.getPrecinctTargetingScores(precinctName),
              politicalDataService.getPrecinctElectionHistory(precinctName),
              politicalDataService.getPrecinctDemographics(precinctName),
              politicalDataService.getPrecinctPoliticalAttitudes(precinctName),
              politicalDataService.getPrecinctEngagement(precinctName),
            ]);

          return {
            precinctName,
            scores,
            targetingScores,
            electionHistory,
            demographics,
            attitudes,
            engagement,
          };
        });

        const precinctDataList = await Promise.all(precinctDataPromises);
        const validPrecincts = precinctDataList.filter((p) => p.scores !== null);

        if (validPrecincts.length === 0) {
          results.push({
            name: areaDisplayName,
            filename: '',
            success: false,
            error: 'No valid precinct data found',
          });
          continue;
        }

        // Aggregate data across all precincts
        const aggregatedConfig = aggregatePrecinctData(
          validPrecincts,
          area.areaName,
          area.areaDescription,
          body.selectedPages
        );

        // Generate PDF using V2 template-based generator
        const generator = new PoliticalProfilePDFGeneratorV2();
        const pdfBlob = await generator.generateReport(aggregatedConfig);

        // Convert to base64
        const pdfBuffer = await pdfBlob.arrayBuffer();
        const pdfBase64 = Buffer.from(pdfBuffer).toString('base64');

        // Generate filename
        const sanitizedName = (area.areaName || validPrecincts[0].precinctName)
          .replace(/[^a-zA-Z0-9-_ ]/g, '')
          .replace(/\s+/g, '-')
          .substring(0, 50);
        const filename = `Political-Profile-${sanitizedName}.pdf`;

        results.push({
          name: areaDisplayName,
          filename,
          success: true,
          pdfBase64,
        });
      } catch (error) {
        console.error(`[Batch PDF API] Error generating PDF for area ${i + 1}:`, error);
        results.push({
          name: areaDisplayName,
          filename: '',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`[Batch PDF API] Batch complete: ${successCount}/${results.length} successful`);

    return NextResponse.json({
      success: true,
      totalRequested: body.areas.length,
      totalGenerated: successCount,
      results,
    });
  } catch (error) {
    console.error('[Batch PDF API] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate batch PDFs',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// Data Aggregation Helpers (simplified for batch)
// ============================================================================

interface PrecinctData {
  precinctName: string;
  scores: PrecinctPoliticalScores | null;
  targetingScores: any;
  electionHistory: any;
  demographics: any;
  attitudes: any;
  engagement: any;
}

function aggregatePrecinctData(
  precincts: PrecinctData[],
  customAreaName?: string,
  areaDescription?: string,
  selectedPages?: number[]
): PoliticalProfileConfig {
  const region = getPoliticalRegionEnv();
  const areaName =
    customAreaName ||
    (precincts.length === 1
      ? precincts[0].precinctName
      : `${precincts.length} Precincts`);

  // Aggregate scores
  const weights = precincts.map((p) => p.demographics?.registeredVoters || 1000);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  let weightedLean = 0;
  let weightedSwing = 0;
  let weightedTurnout = 0;
  let totalElections = 0;

  precincts.forEach((p, i) => {
    if (!p.scores) return;
    const weight = weights[i];
    weightedLean += p.scores.partisanLean.value * weight;
    weightedSwing += p.scores.swingPotential.value * weight;
    weightedTurnout += p.scores.turnout.averageTurnout * weight;
    totalElections = Math.max(totalElections, p.scores.partisanLean.electionsAnalyzed);
  });

  const avgLean = weightedLean / totalWeight;
  const avgSwing = weightedSwing / totalWeight;
  const avgTurnout = weightedTurnout / totalWeight;

  // Aggregate demographics
  let totalPopulation = 0;
  let registeredVoters = 0;
  let votingAgePopulation = 0;

  precincts.forEach((p) => {
    if (!p.demographics) return;
    totalPopulation += p.demographics.totalPopulation || 0;
    registeredVoters += p.demographics.registeredVoters || 0;
    votingAgePopulation += p.demographics.votingAgePopulation || 0;
  });

  return {
    areaSelection: {
      method: 'boundary-select',
      metadata: {
        boundaryType: 'precinct',
        boundaryNames: precincts.map((p) => p.precinctName),
      },
    } as PoliticalAreaSelection,
    areaName,
    areaDescription,
    county: region.county,
    state: region.state,
    politicalScores: {
      precinctId: 'aggregated',
      precinctName: 'Aggregated Area',
      partisanLean: {
        value: avgLean,
        classification: classifyCompetitiveness(avgLean),
        electionsAnalyzed: totalElections,
        confidence: 0.8,
      },
      swingPotential: {
        value: avgSwing,
        classification: avgSwing > 40 ? 'Swing' : 'Moderate',
        components: { marginStdDev: 0, avgElectionSwing: 0, ticketSplitting: 0 },
      },
      turnout: {
        averageTurnout: avgTurnout,
        presidentialAvg: null,
        midtermAvg: null,
        dropoff: null,
        trend: 'stable',
        electionsAnalyzed: totalElections,
      },
      targetingPriority: calculateTargetingPriority(avgLean, avgSwing, avgTurnout),
      lastUpdated: new Date().toISOString(),
    },
    electionHistory: {},
    demographics: {
      totalPopulation,
      votingAgePopulation,
      registeredVoters,
      medianAge: 38,
      medianHouseholdIncome: 60000,
      educationBachelorsPlus: 30,
      ownerOccupied: 60,
      renterOccupied: 40,
      urbanRural: 'suburban' as const,
    },
    includedPrecincts: precincts.map((p) => ({
      name: p.precinctName,
      overlapRatio: 1.0,
      registeredVoters: p.demographics?.registeredVoters || 0,
    })),
    selectedPages: selectedPages || [1, 2, 3, 4, 5, 6, 7],
    reportDate: new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
  };
}

function classifyCompetitiveness(lean: number): import('@/types/political').CompetitivenessRating {
  if (lean >= 20) return 'Safe D';
  if (lean >= 10) return 'Likely D';
  if (lean >= 5) return 'Lean D';
  if (lean > -5) return 'Tossup';
  if (lean > -10) return 'Lean R';
  if (lean > -20) return 'Likely R';
  return 'Safe R';
}

function calculateTargetingPriority(
  lean: number,
  swing: number,
  turnout: number
): TargetingPriority {
  if (Math.abs(lean) < 10 && swing > 40) return 'High';
  if (Math.abs(lean) < 15 || swing > 50) return 'Medium-High';
  if (Math.abs(lean) < 25 && swing > 20) return 'Medium';
  return 'Low';
}
