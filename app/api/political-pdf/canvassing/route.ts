import { NextRequest, NextResponse } from 'next/server';
import { CanvassingPlanPDFGenerator } from '@/lib/pdf/political/CanvassingPlanPDFGenerator';
import type { CanvassingPlanConfig, CanvassTurfData } from '@/lib/pdf/political/CanvassingPlanPDFGenerator';
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
interface CanvassingReportRequest {
  // Required: Operation details
  operationName: string;
  operationType: 'gotv' | 'persuasion' | 'voter_id' | 'general';

  // Required: List of precinct names
  precinctNames: string[];

  // Optional: Operation date
  operationDate?: string;

  // Optional: Turf assignments
  turfs?: Array<{
    turfId: string;
    turfName: string;
    precinctName: string;
    totalDoors: number;
    notes?: string;
  }>;

  // Optional: Talking points
  talkingPoints?: string[];

  // Optional: FAQs
  faqs?: Array<{ question: string; answer: string }>;
}

/**
 * POST /api/political-pdf/canvassing
 *
 * Generates 3-5 page Canvassing Plan PDF
 */
export async function POST(request: NextRequest) {
  try {
    const region = getPoliticalRegionEnv();
    const body: CanvassingReportRequest = await request.json();

    console.log('[Canvassing Report API] Generating for:', body.operationName, 'with', body.precinctNames.length, 'precincts');

    // Validate request
    if (!body.operationName) {
      return NextResponse.json(
        { error: 'Operation name is required' },
        { status: 400 }
      );
    }

    if (!body.precinctNames || body.precinctNames.length === 0) {
      return NextResponse.json(
        { error: 'At least one precinct is required' },
        { status: 400 }
      );
    }

    // Initialize data service
    await politicalDataService.initialize();

    // Load data for all precincts
    interface PriorityPrecinct {
      name: string;
      doors: number;
      gotvScore: number;
      persuasionScore: number;
      priorityRank: number;
      efficiencyScore: number;
    }

    const priorityPrecincts: PriorityPrecinct[] = [];
    let totalDoors = 0;
    let totalVoters = 0;

    for (const precinctName of body.precinctNames) {
      const [scores, targetingScores, demographics] = await Promise.all([
        politicalDataService.getPrecinctScores(precinctName),
        politicalDataService.getPrecinctTargetingScores(precinctName),
        politicalDataService.getPrecinctDemographics(precinctName),
      ]);

      if (!scores) {
        console.warn(`[Canvassing Report API] No data found for precinct: ${precinctName}`);
        continue;
      }

      const voters = targetingScores?.registered_voters ?? demographics?.registeredVoters ?? 0;
      const gotvVal = targetingScores?.gotv_priority ?? 50;
      const persuasionVal = targetingScores?.persuasion_opportunity ?? 50;

      // Estimate doors based on voter count (roughly 1.5 voters per door)
      const doors = Math.round(voters / 1.5);
      totalDoors += doors;
      totalVoters += voters;

      // Efficiency based on density (urban = more doors/hour)
      const density = doors > 1000 ? 'urban' : doors > 400 ? 'suburban' : 'rural';
      const efficiencyScore = density === 'urban' ? 45 : density === 'suburban' ? 35 : 25;

      priorityPrecincts.push({
        name: precinctName,
        doors,
        gotvScore: gotvVal,
        persuasionScore: persuasionVal,
        priorityRank: 0, // Will be set after sorting
        efficiencyScore,
      });
    }

    if (priorityPrecincts.length === 0) {
      return NextResponse.json(
        { error: 'No data found for any of the specified precincts' },
        { status: 404 }
      );
    }

    // Sort by operation type priority
    if (body.operationType === 'gotv') {
      priorityPrecincts.sort((a, b) => b.gotvScore - a.gotvScore);
    } else if (body.operationType === 'persuasion') {
      priorityPrecincts.sort((a, b) => b.persuasionScore - a.persuasionScore);
    } else {
      // Combined score
      priorityPrecincts.sort((a, b) => (b.gotvScore + b.persuasionScore) - (a.gotvScore + a.persuasionScore));
    }

    // Assign priority ranks
    priorityPrecincts.forEach((p, i) => {
      p.priorityRank = i + 1;
    });

    // Calculate logistics
    const avgDoorsPerHour = 35;
    const estimatedTotalHours = Math.ceil(totalDoors / avgDoorsPerHour);
    const suggestedVolunteers = Math.ceil(estimatedTotalHours / 3); // 3-hour shifts

    // Build turf data if provided
    let turfs: CanvassTurfData[] | undefined;
    if (body.turfs?.length) {
      turfs = body.turfs.map((turf, i) => {
        const precinct = priorityPrecincts.find(p => p.name === turf.precinctName);
        return {
          turfId: turf.turfId,
          turfName: turf.turfName,
          precinctName: turf.precinctName,
          totalDoors: turf.totalDoors,
          estimatedHours: turf.totalDoors / avgDoorsPerHour,
          priorityRank: precinct?.priorityRank ?? i + 1,
          gotvScore: precinct?.gotvScore ?? 50,
          persuasionScore: precinct?.persuasionScore ?? 50,
          contactRateExpected: 0.35,
          suggestedTeamSize: Math.ceil(turf.totalDoors / 100),
          notes: turf.notes,
        };
      });
    }

    // Build config
    const config: CanvassingPlanConfig = {
      operationName: body.operationName,
      operationDate: body.operationDate,
      operationType: body.operationType,

      targetArea: `${priorityPrecincts.length} Precincts`,
      totalDoors,
      totalPrecincts: priorityPrecincts.length,
      estimatedTotalHours,
      suggestedVolunteers,

      priorityPrecincts,

      turfs,

      logistics: {
        optimalTimes: ['Saturday 10am-1pm', 'Weekdays 4pm-7pm', 'Sunday 2pm-5pm'],
        avgDoorsPerHour,
        expectedContactRate: 0.35,
        returnVisitStrategy: 'Same-day evening return for morning not-homes',
      },

      talkingPoints: body.talkingPoints || getDefaultTalkingPoints(body.operationType),
      faqs: body.faqs,

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
    const generator = new CanvassingPlanPDFGenerator();
    const pdfBlob = await generator.generateReport(config);

    // Convert blob to buffer
    const buffer = await pdfBlob.arrayBuffer();

    // Generate filename
    const sanitizedName = body.operationName.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 25);
    const filename = `Canvass-${sanitizedName}-${Date.now()}.pdf`;

    // Return PDF
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[Canvassing Report API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate canvassing plan', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Get default talking points based on operation type
 */
function getDefaultTalkingPoints(operationType: string): string[] {
  switch (operationType) {
    case 'gotv':
      return [
        'Early voting starts next week - beat the election day lines!',
        'Your vote matters in local races that directly affect our community.',
        'Need a ride to the polls? We can help arrange transportation.',
        'Check your registration status at michigan.gov/vote.',
      ];
    case 'persuasion':
      return [
        'Focus on issues that matter locally: schools, infrastructure, public safety.',
        'Listen first, understand their concerns, then share how our candidate addresses them.',
        'Leave a door hanger with key issue positions if no one answers.',
        'Be friendly and conversational - we\'re neighbors, not salespeople.',
      ];
    case 'voter_id':
      return [
        'We\'re building our voter file - every contact counts.',
        'Ask about their voting plans and preferred issues.',
        'Mark down any changes in household composition.',
        'Note if they\'re interested in volunteering.',
      ];
    default:
      return [
        'Introduce yourself and explain why you\'re there.',
        'Be respectful of their time - keep conversations brief.',
        'Thank them regardless of their response.',
        'Log every contact accurately for follow-up.',
      ];
  }
}
