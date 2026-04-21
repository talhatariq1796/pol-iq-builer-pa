import { NextRequest, NextResponse } from 'next/server';
import { SegmentReportPDFGenerator } from '@/lib/pdf/political/SegmentReportPDFGenerator';
import type { SegmentReportConfig, SegmentPrecinctData, SegmentFilter } from '@/lib/pdf/political/SegmentReportPDFGenerator';
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
interface SegmentReportRequest {
  // Required: Segment identification
  segmentName: string;

  // Required: List of precinct names in this segment
  precinctNames: string[];

  // Optional: Filter criteria used to create segment
  filters?: Array<{
    field: string;
    operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq' | 'between' | 'in';
    value: number | string | [number, number] | string[];
    label?: string;
  }>;

  // Optional metadata
  segmentDescription?: string;
  createdBy?: string;

  // Optional AI recommendations
  recommendations?: string[];
}

/**
 * POST /api/political-pdf/segment
 *
 * Generates 2-3 page Segment Report PDF
 */
export async function POST(request: NextRequest) {
  try {
    const region = getPoliticalRegionEnv();
    const body: SegmentReportRequest = await request.json();

    console.log('[Segment Report API] Generating for:', body.segmentName, 'with', body.precinctNames.length, 'precincts');

    // Validate request
    if (!body.segmentName) {
      return NextResponse.json(
        { error: 'Segment name is required' },
        { status: 400 }
      );
    }

    if (!body.precinctNames || body.precinctNames.length === 0) {
      return NextResponse.json(
        { error: 'At least one precinct is required in the segment' },
        { status: 400 }
      );
    }

    // Initialize data service
    await politicalDataService.initialize();

    // Load data for all precincts
    const precinctData: SegmentPrecinctData[] = [];
    let totalVoters = 0;
    let totalPopulation = 0;
    let sumSwing = 0;
    let sumGotv = 0;
    let sumPersuasion = 0;
    let sumTurnout = 0;
    let sumLean = 0;
    let sumAge = 0;
    let sumIncome = 0;
    let sumCollege = 0;

    for (const precinctName of body.precinctNames) {
      const [scores, targetingScores, demographics] = await Promise.all([
        politicalDataService.getPrecinctScores(precinctName),
        politicalDataService.getPrecinctTargetingScores(precinctName),
        politicalDataService.getPrecinctDemographics(precinctName),
      ]);

      if (!scores) {
        console.warn(`[Segment Report API] No data found for precinct: ${precinctName}`);
        continue;
      }

      const voters = targetingScores?.registered_voters ?? demographics?.registeredVoters ?? 0;
      const swingVal = scores.swingPotential?.value ?? 50;
      const gotvVal = targetingScores?.gotv_priority ?? 50;
      const persuasionVal = targetingScores?.persuasion_opportunity ?? 50;
      const turnoutVal = scores.turnout?.averageTurnout ?? 55;
      const leanVal = scores.partisanLean?.value ?? 0;

      precinctData.push({
        name: precinctName,
        jurisdiction: demographics?.urbanRural || 'Unknown',
        registeredVoters: voters,
        partisanLean: leanVal,
        swingPotential: swingVal,
        gotvPriority: gotvVal,
        persuasionScore: persuasionVal,
        avgTurnout: turnoutVal,
      });

      totalVoters += voters;
      sumSwing += swingVal;
      sumGotv += gotvVal;
      sumPersuasion += persuasionVal;
      sumTurnout += turnoutVal;
      sumLean += leanVal;

      if (demographics) {
        totalPopulation += demographics.totalPopulation ?? 0;
        sumAge += demographics.medianAge ?? 40;
        sumIncome += demographics.medianHouseholdIncome ?? 50000;
        sumCollege += demographics.educationBachelorsPlus ?? 30;
      }
    }

    if (precinctData.length === 0) {
      return NextResponse.json(
        { error: 'No data found for any of the specified precincts' },
        { status: 404 }
      );
    }

    const count = precinctData.length;

    // Calculate distributions (simplified 10-bucket histograms)
    const swingBuckets = new Array(10).fill(0);
    const gotvBuckets = new Array(10).fill(0);
    const persuasionBuckets = new Array(10).fill(0);

    precinctData.forEach(p => {
      const swingBucket = Math.min(9, Math.floor(p.swingPotential / 10));
      const gotvBucket = Math.min(9, Math.floor(p.gotvPriority / 10));
      const persuasionBucket = Math.min(9, Math.floor(p.persuasionScore / 10));
      swingBuckets[swingBucket]++;
      gotvBuckets[gotvBucket]++;
      persuasionBuckets[persuasionBucket]++;
    });

    // Determine urban/rural mix
    let urbanRural: 'urban' | 'suburban' | 'rural' | 'mixed' = 'mixed';
    const avgVotersPerPrecinct = totalVoters / count;
    if (avgVotersPerPrecinct > 2000) urbanRural = 'urban';
    else if (avgVotersPerPrecinct > 800) urbanRural = 'suburban';
    else if (avgVotersPerPrecinct < 400) urbanRural = 'rural';

    // Build filters array
    const filters: SegmentFilter[] = body.filters || [];

    // Build config
    const config: SegmentReportConfig = {
      segmentName: body.segmentName,
      segmentDescription: body.segmentDescription,
      createdAt: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      createdBy: body.createdBy,

      filters,

      summary: {
        totalPrecincts: count,
        totalVoters,
        avgSwingPotential: sumSwing / count,
        avgGotvPriority: sumGotv / count,
        avgPersuasion: sumPersuasion / count,
        avgTurnout: sumTurnout / count,
        avgPartisanLean: sumLean / count,
      },

      distributions: {
        swing: swingBuckets,
        gotv: gotvBuckets,
        persuasion: persuasionBuckets,
      },

      precincts: precinctData.sort((a, b) => b.gotvPriority - a.gotvPriority), // Sort by GOTV priority

      demographics: {
        totalPopulation,
        medianAge: sumAge / count,
        medianIncome: sumIncome / count,
        collegeEducated: sumCollege / count,
        urbanRural,
      },

      recommendations: body.recommendations || generateDefaultRecommendations(precinctData, count, sumSwing / count, sumGotv / count),

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
    const generator = new SegmentReportPDFGenerator();
    const pdfBlob = await generator.generateReport(config);

    // Convert blob to buffer
    const buffer = await pdfBlob.arrayBuffer();

    // Generate filename
    const sanitizedName = body.segmentName.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 30);
    const filename = `Segment-${sanitizedName}-${Date.now()}.pdf`;

    // Return PDF
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[Segment Report API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate segment report', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Generate default recommendations based on segment data
 */
function generateDefaultRecommendations(
  precincts: SegmentPrecinctData[],
  count: number,
  avgSwing: number,
  avgGotv: number
): string[] {
  const recommendations: string[] = [];

  // High swing segment
  if (avgSwing > 60) {
    recommendations.push(
      `This segment has high swing potential (avg ${avgSwing.toFixed(0)}/100). Focus persuasion efforts here with issue-focused messaging.`
    );
  }

  // High GOTV segment
  if (avgGotv > 65) {
    recommendations.push(
      `Strong GOTV opportunity (avg ${avgGotv.toFixed(0)}/100). Prioritize voter contact and turnout operations in these precincts.`
    );
  }

  // Small vs large segment
  if (count <= 5) {
    recommendations.push(
      `Compact segment of ${count} precincts - ideal for targeted door-to-door canvassing with consistent messaging.`
    );
  } else if (count > 15) {
    recommendations.push(
      `Large segment spanning ${count} precincts - consider sub-segmenting by geography or score thresholds for more targeted outreach.`
    );
  }

  // Mix of leans
  const dLeans = precincts.filter(p => p.partisanLean < -5).length;
  const rLeans = precincts.filter(p => p.partisanLean > 5).length;
  if (dLeans > 0 && rLeans > 0) {
    recommendations.push(
      `Segment includes precincts across the partisan spectrum - develop distinct messaging tracks for different partisan contexts.`
    );
  }

  // Default if no specific recommendations
  if (recommendations.length === 0) {
    recommendations.push(
      `This segment represents a balanced voter universe. Apply standard campaign tactics with local customization based on precinct-level data.`
    );
  }

  return recommendations.slice(0, 4);
}
