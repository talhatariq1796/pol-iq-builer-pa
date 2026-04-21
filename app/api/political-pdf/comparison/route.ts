import { NextRequest, NextResponse } from 'next/server';
import { ComparisonReportPDFGenerator } from '@/lib/pdf/political/ComparisonReportPDFGenerator';
import type { ComparisonReportConfig, ComparisonEntityData } from '@/lib/pdf/political/ComparisonReportPDFGenerator';
import { politicalDataService } from '@/lib/services/PoliticalDataService';
import { getPoliticalRegionEnv } from '@/lib/political/politicalRegionConfig';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 45;
export const fetchCache = 'force-no-store';
export const revalidate = 0;

/**
 * Request body interface
 */
interface ComparisonReportRequest {
  // Required: Two entities to compare
  entityA: string; // Precinct name
  entityB: string; // Precinct name

  // Optional metadata
  comparisonTitle?: string;
  comparisonPurpose?: string;

  // Optional AI insights
  keyDifferences?: string[];
  strategicImplications?: string[];
  recommendation?: string;
}

/**
 * POST /api/political-pdf/comparison
 *
 * Generates 2-4 page Comparison Report PDF
 */
export async function POST(request: NextRequest) {
  try {
    const body: ComparisonReportRequest = await request.json();

    console.log('[Comparison Report API] Generating for:', body.entityA, 'vs', body.entityB);

    // Validate request
    if (!body.entityA || !body.entityB) {
      return NextResponse.json(
        { error: 'Two entity names are required for comparison' },
        { status: 400 }
      );
    }

    // Initialize data service
    await politicalDataService.initialize();

    // Load data for both entities
    const [dataA, dataB] = await Promise.all([
      loadEntityData(body.entityA),
      loadEntityData(body.entityB),
    ]);

    if (!dataA) {
      return NextResponse.json(
        { error: `No data found for "${body.entityA}"` },
        { status: 404 }
      );
    }

    if (!dataB) {
      return NextResponse.json(
        { error: `No data found for "${body.entityB}"` },
        { status: 404 }
      );
    }

    const region = getPoliticalRegionEnv();
    const config: ComparisonReportConfig = {
      entityA: dataA,
      entityB: dataB,
      comparisonTitle: body.comparisonTitle || `${body.entityA} vs ${body.entityB}`,
      comparisonPurpose: body.comparisonPurpose,
      keyDifferences: body.keyDifferences || generateDefaultDifferences(dataA, dataB),
      strategicImplications: body.strategicImplications || generateDefaultImplications(dataA, dataB),
      recommendation: body.recommendation || generateDefaultRecommendation(dataA, dataB),
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
    const generator = new ComparisonReportPDFGenerator();
    const pdfBlob = await generator.generateReport(config);

    // Convert blob to buffer
    const buffer = await pdfBlob.arrayBuffer();

    // Generate filename
    const sanitizedA = body.entityA.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 20);
    const sanitizedB = body.entityB.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 20);
    const filename = `Comparison-${sanitizedA}-vs-${sanitizedB}-${Date.now()}.pdf`;

    // Return PDF
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[Comparison Report API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate comparison report', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Load entity data from political data service
 */
async function loadEntityData(entityName: string): Promise<ComparisonEntityData | null> {
  try {
    const [scores, targetingScores, demographics] = await Promise.all([
      politicalDataService.getPrecinctScores(entityName),
      politicalDataService.getPrecinctTargetingScores(entityName),
      politicalDataService.getPrecinctDemographics(entityName),
    ]);

    if (!scores) return null;

    return {
      name: entityName,
      type: 'precinct',
      partisanLean: scores.partisanLean?.value ?? 0,
      swingPotential: scores.swingPotential?.value ?? 50,
      gotvPriority: targetingScores?.gotv_priority ?? 50,
      persuasionOpportunity: targetingScores?.persuasion_opportunity ?? 50,
      avgTurnout: scores.turnout?.averageTurnout ?? 55,
      registeredVoters: targetingScores?.registered_voters ?? demographics?.registeredVoters ?? 0,
      totalPopulation: demographics?.totalPopulation ?? 0,
      medianAge: demographics?.medianAge ?? 40,
      medianIncome: demographics?.medianHouseholdIncome ?? 50000,
      collegeEducated: demographics?.educationBachelorsPlus ?? 30,
      electionHistory: [], // Would load from election data if available
    };
  } catch (error) {
    console.error(`[Comparison Report API] Error loading ${entityName}:`, error);
    return null;
  }
}

/**
 * Generate default key differences
 */
function generateDefaultDifferences(a: ComparisonEntityData, b: ComparisonEntityData): string[] {
  const differences: string[] = [];

  // Partisan lean difference
  const leanDiff = Math.abs(a.partisanLean - b.partisanLean);
  if (leanDiff > 10) {
    const moreD = a.partisanLean < b.partisanLean ? a.name : b.name;
    const moreR = a.partisanLean > b.partisanLean ? a.name : b.name;
    differences.push(`${moreD} leans more Democratic while ${moreR} leans more Republican (${leanDiff.toFixed(0)} point difference).`);
  }

  // Swing potential
  const swingDiff = Math.abs(a.swingPotential - b.swingPotential);
  if (swingDiff > 15) {
    const higher = a.swingPotential > b.swingPotential ? a.name : b.name;
    differences.push(`${higher} has significantly higher swing potential (${swingDiff.toFixed(0)} points higher).`);
  }

  // Voter size
  const voterRatio = Math.max(a.registeredVoters, b.registeredVoters) / Math.max(1, Math.min(a.registeredVoters, b.registeredVoters));
  if (voterRatio > 1.5) {
    const larger = a.registeredVoters > b.registeredVoters ? a.name : b.name;
    differences.push(`${larger} has ${voterRatio.toFixed(1)}x more registered voters.`);
  }

  // Turnout
  const turnoutDiff = Math.abs(a.avgTurnout - b.avgTurnout);
  if (turnoutDiff > 10) {
    const higher = a.avgTurnout > b.avgTurnout ? a.name : b.name;
    differences.push(`${higher} has ${turnoutDiff.toFixed(0)}% higher average turnout.`);
  }

  return differences.slice(0, 4);
}

/**
 * Generate default strategic implications
 */
function generateDefaultImplications(a: ComparisonEntityData, b: ComparisonEntityData): string[] {
  const implications: string[] = [];

  // GOTV implications
  if (a.gotvPriority > 70 || b.gotvPriority > 70) {
    const high = a.gotvPriority > b.gotvPriority ? a.name : b.name;
    implications.push(`Focus GOTV resources on ${high} where turnout mobilization has higher impact.`);
  }

  // Persuasion implications
  if (a.persuasionOpportunity > 60 && b.persuasionOpportunity > 60) {
    implications.push(`Both areas have persuadable voters - consider differentiated messaging based on demographics.`);
  } else if (a.persuasionOpportunity > 60 || b.persuasionOpportunity > 60) {
    const high = a.persuasionOpportunity > b.persuasionOpportunity ? a.name : b.name;
    implications.push(`Concentrate persuasion efforts on ${high}.`);
  }

  // Resource allocation
  if (a.registeredVoters > b.registeredVoters * 1.5) {
    implications.push(`${a.name} offers higher voter density - may be more efficient for field operations.`);
  } else if (b.registeredVoters > a.registeredVoters * 1.5) {
    implications.push(`${b.name} offers higher voter density - may be more efficient for field operations.`);
  }

  return implications.slice(0, 3);
}

/**
 * Generate default recommendation
 */
function generateDefaultRecommendation(a: ComparisonEntityData, b: ComparisonEntityData): string {
  // Find the "better" area for different strategies
  const gotvArea = a.gotvPriority > b.gotvPriority ? a : b;
  const persuasionArea = a.persuasionOpportunity > b.persuasionOpportunity ? a : b;
  const swingArea = a.swingPotential > b.swingPotential ? a : b;

  if (gotvArea === persuasionArea && gotvArea === swingArea) {
    return `${gotvArea.name} is the stronger target across all metrics. Prioritize this area for comprehensive campaign efforts.`;
  }

  if (gotvArea !== persuasionArea) {
    return `Split strategy recommended: Focus GOTV efforts on ${gotvArea.name} and persuasion on ${persuasionArea.name} based on their respective strengths.`;
  }

  return `Both areas merit attention. Consider ${swingArea.name} for competitive races and ${gotvArea.name} for base mobilization.`;
}
