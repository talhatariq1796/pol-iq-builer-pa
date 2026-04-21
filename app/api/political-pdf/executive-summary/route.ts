import { NextRequest, NextResponse } from 'next/server';
import { ExecutiveSummaryPDFGenerator } from '@/lib/pdf/political/ExecutiveSummaryPDFGenerator';
import type { ExecutiveSummaryConfig } from '@/lib/pdf/political/ExecutiveSummaryPDFGenerator';
import { politicalDataService } from '@/lib/services/PoliticalDataService';
import { getPoliticalRegionEnv } from '@/lib/political/politicalRegionConfig';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30; // Quick report, should be fast
export const fetchCache = 'force-no-store';
export const revalidate = 0;

/**
 * Request body interface
 */
interface ExecutiveSummaryRequest {
  // Required: Array of precinct names to include
  precinctNames: string[];

  // Optional: Custom area name
  areaName?: string;

  // Optional: Area description
  areaDescription?: string;

  // Optional: AI-generated insights
  quickAssessment?: string[];

  // Optional: Strategic recommendation
  recommendation?: string;

  // Optional: Map thumbnail (base64)
  mapThumbnail?: string;
}

/**
 * POST /api/political-pdf/executive-summary
 *
 * Generates 1-page Executive Summary PDF
 */
export async function POST(request: NextRequest) {
  try {
    const body: ExecutiveSummaryRequest = await request.json();

    console.log('[Executive Summary API] Generating for precincts:', body.precinctNames);

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

    // Aggregate data
    const aggregatedMetrics = aggregateMetrics(validPrecincts);

    const region = getPoliticalRegionEnv();
    const config: ExecutiveSummaryConfig = {
      areaName: body.areaName || validPrecincts.map(p => p.precinctName).join(', '),
      areaDescription: body.areaDescription,
      county: region.county,
      state: region.state,
      metrics: aggregatedMetrics,
      quickAssessment: body.quickAssessment || generateDefaultAssessment(aggregatedMetrics),
      recommendation: body.recommendation || generateDefaultRecommendation(aggregatedMetrics),
      mapThumbnail: body.mapThumbnail,
      reportDate: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      generatedBy: 'Political Analysis Platform',
    };

    // Generate PDF
    const generator = new ExecutiveSummaryPDFGenerator();
    const pdfBlob = await generator.generateReport(config);

    // Convert blob to buffer
    const buffer = await pdfBlob.arrayBuffer();

    // Generate filename
    const sanitizedAreaName = config.areaName
      .replace(/[^a-zA-Z0-9-_ ]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 30);
    const filename = `Executive-Summary-${sanitizedAreaName}-${Date.now()}.pdf`;

    // Return PDF
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[Executive Summary API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate executive summary', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Aggregate metrics from multiple precincts
 */
function aggregateMetrics(precincts: any[]): ExecutiveSummaryConfig['metrics'] {
  const count = precincts.length;

  // Sum up values
  let totalVoters = 0;
  let totalPartisanLean = 0;
  let totalSwing = 0;
  let totalGotv = 0;
  let totalPersuasion = 0;
  let totalTurnout = 0;

  precincts.forEach((p) => {
    const scores = p.scores;
    const targeting = p.targetingScores;
    const demo = p.demographics;

    totalVoters += demo?.registeredVoters ?? (targeting?.registered_voters ?? 0);
    totalPartisanLean += scores?.partisanLean?.value ?? 0;
    totalSwing += scores?.swingPotential?.value ?? 0;
    totalGotv += targeting?.gotv_priority ?? 0;
    totalPersuasion += targeting?.persuasion_opportunity ?? 0;
    totalTurnout += scores?.turnout?.averageTurnout ?? 55;
  });

  return {
    partisanLean: totalPartisanLean / count,
    swingPotential: totalSwing / count,
    gotvPriority: totalGotv / count,
    persuasionOpportunity: totalPersuasion / count,
    registeredVoters: totalVoters,
    avgTurnout: totalTurnout / count,
    precinctCount: count,
  };
}

/**
 * Generate default assessment bullets if none provided
 */
function generateDefaultAssessment(metrics: ExecutiveSummaryConfig['metrics']): string[] {
  const assessment: string[] = [];

  // Partisan lean assessment
  if (metrics.partisanLean > 10) {
    assessment.push(`Area leans Republican (R+${metrics.partisanLean.toFixed(0)}) with strong GOP base.`);
  } else if (metrics.partisanLean < -10) {
    assessment.push(`Area leans Democratic (D+${Math.abs(metrics.partisanLean).toFixed(0)}) with solid Democratic support.`);
  } else {
    assessment.push(`Competitive area with partisan lean near even - key battleground territory.`);
  }

  // Swing potential
  if (metrics.swingPotential >= 70) {
    assessment.push(`High swing potential (${metrics.swingPotential.toFixed(0)}/100) indicates opportunity for persuasion efforts.`);
  } else if (metrics.swingPotential >= 50) {
    assessment.push(`Moderate swing potential suggests mixed voter base with some persuadable voters.`);
  }

  // GOTV
  if (metrics.gotvPriority >= 70) {
    assessment.push(`GOTV priority is high - turnout mobilization could significantly impact results.`);
  }

  // Turnout
  if (metrics.avgTurnout < 55) {
    assessment.push(`Below-average turnout (${metrics.avgTurnout.toFixed(0)}%) presents opportunity for base mobilization.`);
  }

  return assessment.slice(0, 4);
}

/**
 * Generate default recommendation if none provided
 */
function generateDefaultRecommendation(metrics: ExecutiveSummaryConfig['metrics']): string {
  if (metrics.gotvPriority >= 70 && metrics.partisanLean < 0) {
    return 'Prioritize GOTV operations to maximize Democratic turnout in this favorable area.';
  }
  if (metrics.swingPotential >= 70) {
    return 'Focus persuasion efforts on swing voters - this area is highly competitive and persuadable.';
  }
  if (metrics.partisanLean > 10) {
    return 'Consider defensive messaging to protect against Republican gains in favorable territory.';
  }
  if (metrics.avgTurnout < 50) {
    return 'Low turnout area presents opportunity - invest in voter registration and turnout programs.';
  }
  return 'Balance resources between GOTV and persuasion based on campaign priorities and timing.';
}
