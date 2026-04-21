import { NextRequest, NextResponse } from 'next/server';
import { DonorAnalysisPDFGenerator } from '@/lib/pdf/political/DonorAnalysisPDFGenerator';
import { getPoliticalRegionEnv } from '@/lib/political/politicalRegionConfig';
import type { DonorAnalysisConfig, ZipDonorData, DonorSegment } from '@/lib/pdf/political/DonorAnalysisPDFGenerator';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 45;
export const fetchCache = 'force-no-store';
export const revalidate = 0;

/**
 * Request body interface
 */
interface DonorReportRequest {
  // Required: Report title
  reportTitle: string;

  // Required: Analysis area
  analysisArea: string;

  // Required: Date range for analysis
  dateRange: string;

  // Required: Summary statistics
  summary: {
    totalRaised: number;
    totalDonors: number;
    avgDonation: number;
    medianDonation: number;
    largestDonation: number;
    repeatDonorRate: number;
  };

  // Required: Top ZIP codes
  topZipCodes: ZipDonorData[];

  // Required: Donor segments
  segments: DonorSegment[];

  // Optional: Lapsed donors
  lapsedDonors?: Array<{
    segment: string;
    count: number;
    lastGaveTotal: number;
    recoveryPotential: number;
    suggestedAction: string;
  }>;

  // Optional: Geographic opportunities
  geographicOpportunities?: Array<{
    zipCode: string;
    currentDonors: number;
    potentialDonors: number;
    untappedPotential: number;
    recommendation: string;
  }>;

  // Optional: Monthly trends
  monthlyTrends?: Array<{
    month: string;
    amount: number;
    donorCount: number;
  }>;

  // Optional: AI recommendations
  recommendations?: string[];
}

/**
 * POST /api/political-pdf/donor
 *
 * Generates 3-4 page Donor Analysis PDF
 */
export async function POST(request: NextRequest) {
  try {
    const region = getPoliticalRegionEnv();
    const body: DonorReportRequest = await request.json();

    console.log('[Donor Report API] Generating for:', body.reportTitle);

    // Validate request
    if (!body.reportTitle) {
      return NextResponse.json(
        { error: 'Report title is required' },
        { status: 400 }
      );
    }

    if (!body.summary) {
      return NextResponse.json(
        { error: 'Summary statistics are required' },
        { status: 400 }
      );
    }

    if (!body.topZipCodes || body.topZipCodes.length === 0) {
      return NextResponse.json(
        { error: 'At least one ZIP code is required' },
        { status: 400 }
      );
    }

    // Generate default segments if none provided
    const segments = body.segments?.length ? body.segments : generateDefaultSegments(body.summary);

    // Generate default recommendations if none provided
    const recommendations = body.recommendations?.length
      ? body.recommendations
      : generateDefaultRecommendations(body.summary, body.topZipCodes, body.segments);

    // Build config
    const config: DonorAnalysisConfig = {
      reportTitle: body.reportTitle,
      analysisArea: body.analysisArea,
      dateRange: body.dateRange,

      summary: body.summary,
      topZipCodes: body.topZipCodes,
      segments,

      lapsedDonors: body.lapsedDonors,
      geographicOpportunities: body.geographicOpportunities,
      monthlyTrends: body.monthlyTrends,

      recommendations,

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
    const generator = new DonorAnalysisPDFGenerator();
    const pdfBlob = await generator.generateReport(config);

    // Convert blob to buffer
    const buffer = await pdfBlob.arrayBuffer();

    // Generate filename
    const sanitizedTitle = body.reportTitle.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 25);
    const filename = `Donor-${sanitizedTitle}-${Date.now()}.pdf`;

    // Return PDF
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[Donor Report API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate donor analysis', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Generate default RFM-style segments
 */
function generateDefaultSegments(summary: DonorReportRequest['summary']): DonorSegment[] {
  const totalDonors = summary.totalDonors;
  const totalRaised = summary.totalRaised;

  return [
    {
      name: 'Major Donors',
      description: 'Top donors giving $1,000+',
      donorCount: Math.round(totalDonors * 0.05),
      totalAmount: totalRaised * 0.45,
      avgDonation: 2500,
      percentOfTotal: 45,
    },
    {
      name: 'Mid-Level',
      description: 'Regular donors $250-$999',
      donorCount: Math.round(totalDonors * 0.15),
      totalAmount: totalRaised * 0.30,
      avgDonation: 450,
      percentOfTotal: 30,
    },
    {
      name: 'Grassroots',
      description: 'Small donors under $250',
      donorCount: Math.round(totalDonors * 0.60),
      totalAmount: totalRaised * 0.20,
      avgDonation: 45,
      percentOfTotal: 20,
    },
    {
      name: 'First-Time',
      description: 'New donors this cycle',
      donorCount: Math.round(totalDonors * 0.20),
      totalAmount: totalRaised * 0.05,
      avgDonation: 75,
      percentOfTotal: 5,
    },
  ];
}

/**
 * Generate default recommendations
 */
function generateDefaultRecommendations(
  summary: DonorReportRequest['summary'],
  topZips: ZipDonorData[],
  segments: DonorSegment[]
): string[] {
  const recommendations: string[] = [];

  // Based on repeat donor rate
  if (summary.repeatDonorRate < 0.3) {
    recommendations.push(
      `Repeat donor rate is ${(summary.repeatDonorRate * 100).toFixed(0)}% - below the 30% benchmark. Implement a stewardship program with monthly updates and recognition to improve retention.`
    );
  } else if (summary.repeatDonorRate > 0.5) {
    recommendations.push(
      `Strong repeat donor rate of ${(summary.repeatDonorRate * 100).toFixed(0)}%. Consider an upgrade campaign targeting recurring donors for one-time increases.`
    );
  }

  // Based on top ZIP concentration
  if (topZips.length > 0) {
    const topZipTotal = topZips.slice(0, 3).reduce((sum, z) => sum + z.totalAmount, 0);
    const topZipPct = (topZipTotal / summary.totalRaised) * 100;
    if (topZipPct > 50) {
      recommendations.push(
        `Top 3 ZIP codes account for ${topZipPct.toFixed(0)}% of fundraising. Diversify geographic reach through targeted digital acquisition campaigns.`
      );
    }
  }

  // Based on average donation
  if (summary.avgDonation < 100) {
    recommendations.push(
      `Average donation of $${summary.avgDonation.toFixed(0)} suggests a grassroots base. Consider ask strings starting at $25-$50 with clear impact statements.`
    );
  } else if (summary.avgDonation > 500) {
    recommendations.push(
      `High average donation of $${summary.avgDonation.toFixed(0)} indicates major donor potential. Invest in personalized outreach and events for top prospects.`
    );
  }

  // Generic best practice
  recommendations.push(
    `Schedule quarterly donor calls with top 20 contributors to maintain relationships and gather feedback on campaign priorities.`
  );

  return recommendations.slice(0, 4);
}
