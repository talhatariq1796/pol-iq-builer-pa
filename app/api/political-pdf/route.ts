import { NextRequest, NextResponse } from 'next/server';
import { PoliticalProfilePDFGeneratorV2 } from '@/lib/pdf/political/PoliticalProfilePDFGeneratorV2';
import type { PoliticalProfileConfig } from '@/lib/pdf/political/PoliticalProfilePDFGeneratorV2';
import { politicalDataService } from '@/lib/services/PoliticalDataService';
import type {
  PrecinctPoliticalScores,
  ElectionData,
  PoliticalAreaSelection,
  TargetingPriority,
  DemographicSummary,
  PoliticalAttitudes,
  PoliticalEngagement,
} from '@/types/political';
import { getPoliticalRegionEnv } from '@/lib/political/politicalRegionConfig';

/** Report cover line: same env defaults as PoliticalDataService metadata. */
const { state: REPORT_STATE, county: REPORT_COUNTY } = getPoliticalRegionEnv();

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60; // PDF generation with chart rendering
export const fetchCache = 'force-no-store';
export const revalidate = 0;

/**
 * Request body interface
 */
interface PoliticalPDFRequest {
  // Required: Array of precinct names to include in the report
  precinctNames: string[];

  // Optional: Custom area name (defaults to comma-separated precinct names)
  areaName?: string;

  // Optional: Area description (e.g., "1 km radius from Lansing City Hall")
  areaDescription?: string;

  // Optional: Selection method metadata
  areaSelection?: PoliticalAreaSelection;

  // Optional: Include H3 heatmap visualizations
  includeH3?: boolean;

  // Optional: Map thumbnail (base64 encoded image)
  mapThumbnail?: string;

  // Optional: Pre-rendered chart images
  chartImages?: Record<string, string>;

  // Optional: Which pages to include (1-7, defaults to all)
  selectedPages?: number[];
}

function num(x: unknown): number | undefined {
  if (typeof x === 'number' && !Number.isNaN(x)) return x;
  if (x != null && x !== '') {
    const n = Number(x);
    if (!Number.isNaN(n)) return n;
  }
  return undefined;
}

/** PA / targeting JSON: lean + swing may live on political_scores or top-level swing_potential. */
function readLeanSwingFromTargeting(t: Record<string, unknown> | null | undefined): {
  lean: number;
  swing: number;
} {
  if (!t) return { lean: 0, swing: 0 };
  const ps = t.political_scores as Record<string, unknown> | undefined;
  const lean = num(ps?.partisan_lean) ?? 0;
  const swing = num(t.swing_potential) ?? num(ps?.swing_potential) ?? 0;
  return { lean, swing };
}

function precinctPoliticalScoresFromTargeting(
  precinctName: string,
  t: Record<string, unknown>
): PrecinctPoliticalScores {
  const { lean, swing } = readLeanSwingFromTargeting(t);
  const competitiveness = classifyCompetitiveness(lean);
  const volatility = classifyVolatility(swing);
  const avgTurnout = 65;
  const targetingPriority = calculateTargetingPriority(lean, swing, avgTurnout);
  return {
    precinctId: precinctName.replace(/[^a-zA-Z0-9]/g, '_'),
    precinctName,
    partisanLean: {
      value: lean,
      classification: competitiveness,
      electionsAnalyzed: 3,
      confidence: 0.75,
    },
    swingPotential: {
      value: swing,
      classification: volatility,
      components: {
        marginStdDev: swing * 0.5,
        avgElectionSwing: swing * 0.3,
        ticketSplitting: swing * 0.2,
      },
    },
    turnout: {
      averageTurnout: avgTurnout,
      presidentialAvg: null,
      midtermAvg: null,
      dropoff: null,
      trend: 'stable',
      electionsAnalyzed: 0,
    },
    targetingPriority,
    lastUpdated: new Date().toISOString(),
  };
}

function enrichDemographicsFromTargeting(
  d: DemographicSummary | null,
  t: Record<string, unknown> | null | undefined
): DemographicSummary {
  const base: DemographicSummary = d ?? {
    totalPopulation: 0,
    votingAgePopulation: 0,
    registeredVoters: 0,
    medianAge: 0,
    medianHouseholdIncome: 0,
    educationBachelorsPlus: 0,
    ownerOccupied: 0,
    renterOccupied: 0,
    urbanRural: 'suburban',
  };
  if (!t) return base;
  const tPop = num(t.total_population);
  const useTargeting =
    (tPop != null && tPop > 0 && (!base.totalPopulation || base.totalPopulation === 0)) ||
    (num(t.registered_voters) != null &&
      (num(t.registered_voters) as number) > 0 &&
      (!base.registeredVoters || base.registeredVoters === 0));
  if (!useTargeting) return base;
  const ownerPct = num(t.owner_pct);
  const renterFromOwner =
    ownerPct != null && ownerPct >= 0 && ownerPct <= 100
      ? Math.max(0, Math.min(100, 100 - ownerPct))
      : undefined;

  return {
    ...base,
    totalPopulation: tPop && tPop > 0 ? tPop : base.totalPopulation,
    votingAgePopulation: num(t.population_age_18up) ?? base.votingAgePopulation,
    registeredVoters: num(t.registered_voters) ?? base.registeredVoters,
    medianAge: num(t.median_age) ?? base.medianAge,
    medianHouseholdIncome: num(t.median_household_income) ?? base.medianHouseholdIncome,
    educationBachelorsPlus: num(t.college_pct) ?? base.educationBachelorsPlus,
    ownerOccupied: ownerPct ?? base.ownerOccupied,
    renterOccupied:
      renterFromOwner != null
        ? renterFromOwner
        : base.renterOccupied > 0
          ? base.renterOccupied
          : base.ownerOccupied > 0 && base.renterOccupied === 0
            ? Math.max(0, 100 - base.ownerOccupied)
            : base.renterOccupied,
    diversityIndex: num(t.diversity_index) ?? base.diversityIndex,
  };
}

/**
 * Server-side PDF generation endpoint
 * POST /api/political-pdf
 *
 * Generates Political Profile PDF reports for selected precincts/areas
 */
export async function POST(request: NextRequest) {
  try {
    const body: PoliticalPDFRequest = await request.json();

    console.log('[Political PDF API] Generating PDF for precincts:', body.precinctNames);
    console.log('[Political PDF API] Area name:', body.areaName || '(auto-generated)');
    console.log('[Political PDF API] Include H3:', body.includeH3 || false);

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

    const rawList = await Promise.all(precinctDataPromises);
    const precinctDataList = rawList.map((p) => ({
      ...p,
      demographics: enrichDemographicsFromTargeting(
        p.demographics,
        p.targetingScores as Record<string, unknown> | null | undefined
      ),
    }));

    // Legacy MI political_scores and/or PA targeting_scores
    const withData = precinctDataList.filter((p) => p.scores != null || p.targetingScores != null);

    if (withData.length === 0) {
      return NextResponse.json(
        {
          error: 'No valid precinct data found',
          message: `None of the requested precincts have political or targeting data: ${body.precinctNames.join(', ')}`,
        },
        { status: 404 }
      );
    }

    const validPrecincts: PrecinctData[] = withData.map((p) => {
      if (p.scores) return p;
      if (!p.targetingScores) return p;
      return {
        ...p,
        scores: precinctPoliticalScoresFromTargeting(
          p.precinctName,
          p.targetingScores as unknown as Record<string, unknown>
        ),
      };
    });

    console.log(
      `[Political PDF API] Loaded data for ${validPrecincts.length}/${body.precinctNames.length} precincts`
    );

    // Aggregate data across all precincts
    const aggregatedConfig = aggregatePrecinctData(
      validPrecincts,
      body.areaName,
      body.areaDescription,
      body.areaSelection,
      body.mapThumbnail,
      body.chartImages,
      body.selectedPages
    );

    console.log('[Political PDF API] Aggregated config:', {
      areaName: aggregatedConfig.areaName,
      precinctsIncluded: aggregatedConfig.includedPrecincts?.length,
      electionsAnalyzed: Object.keys(aggregatedConfig.electionHistory).length,
      partisanLean: aggregatedConfig.politicalScores.partisanLean.value,
      swingPotential: aggregatedConfig.politicalScores.swingPotential.value,
      targetingPriority: aggregatedConfig.politicalScores.targetingPriority,
    });

    // Generate PDF using V2 template-based generator
    const generator = new PoliticalProfilePDFGeneratorV2();
    const pdfBlob = await generator.generateReport(aggregatedConfig);

    // Convert blob to buffer
    const buffer = await pdfBlob.arrayBuffer();

    // Generate filename
    const sanitizedAreaName = (body.areaName || validPrecincts[0].precinctName)
      .replace(/[^a-zA-Z0-9-_ ]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
    const filename = `Political-Profile-${sanitizedAreaName}-${Date.now()}.pdf`;

    // Return PDF
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });
  } catch (error) {
    console.error('[Political PDF API] Error generating PDF:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate Political Profile PDF',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// Data Aggregation Helpers
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

function isEffectivelyZeroAttitudes(a: PoliticalAttitudes): boolean {
  const vals = [
    a.veryLiberal,
    a.somewhatLiberal,
    a.middleOfRoad,
    a.somewhatConservative,
    a.veryConservative,
    a.registeredDemocrat,
    a.registeredRepublican,
    a.registeredIndependent,
    a.registeredOther ?? 0,
    a.likelyVoters ?? 0,
  ];
  return vals.every((v) => Math.abs(Number(v) || 0) < 1e-6);
}

function isEffectivelyZeroEngagement(e: PoliticalEngagement): boolean {
  const vals = [
    e.politicalPodcastListeners,
    e.politicalContributors,
    e.wroteCalledPolitician,
    e.cashGiftsToPolitical,
    e.followsPoliticiansOnSocial,
    e.followsPoliticalGroups,
    e.votedLastElection ?? 0,
    e.alwaysVotes ?? 0,
  ];
  return vals.every((v) => Math.abs(Number(v) || 0) < 1e-6);
}

/** Weighted average of optional targeting affiliation / ideology fields (when present on JSON). */
function aggregateAttitudesFromTargeting(precincts: PrecinctData[]): PoliticalAttitudes | null {
  const weights = precincts.map((p) => {
    const t = p.targetingScores as Record<string, unknown> | null | undefined;
    return (
      p.demographics?.totalPopulation ||
      num(t?.total_population) ||
      num(t?.registered_voters) ||
      1000
    );
  });
  let tw = 0;
  let wDem = 0,
    wRep = 0,
    wInd = 0,
    wLib = 0,
    wMod = 0,
    wCon = 0;
  let any = false;

  precincts.forEach((p, i) => {
    const t = p.targetingScores as Record<string, unknown> | undefined;
    if (!t) return;
    const d = num(t.dem_affiliation_pct);
    const r = num(t.rep_affiliation_pct);
    const ind = num(t.ind_affiliation_pct);
    const lib = num(t.liberal_pct);
    const mod = num(t.moderate_pct);
    const con = num(t.conservative_pct);
    if (
      d == null &&
      r == null &&
      ind == null &&
      lib == null &&
      mod == null &&
      con == null
    ) {
      return;
    }
    any = true;
    const w = weights[i];
    tw += w;
    if (d != null) wDem += d * w;
    if (r != null) wRep += r * w;
    if (ind != null) wInd += ind * w;
    if (lib != null) wLib += lib * w;
    if (mod != null) wMod += mod * w;
    if (con != null) wCon += con * w;
  });

  if (!any || tw === 0) return null;

  const dem = wDem / tw;
  const rep = wRep / tw;
  const ind = wInd / tw;
  const lib = wLib / tw;
  const mod = wMod / tw;
  const con = wCon / tw;
  const hasParty = dem + rep + ind > 0.5;
  const hasIdeo = lib + mod + con > 0.5;

  return {
    veryLiberal: hasIdeo ? Math.min(100, lib * 0.25) : 8,
    somewhatLiberal: hasIdeo ? Math.min(100, lib * 0.45) : 15,
    middleOfRoad: hasIdeo ? Math.min(100, mod) : 35,
    somewhatConservative: hasIdeo ? Math.min(100, con * 0.45) : 22,
    veryConservative: hasIdeo ? Math.min(100, con * 0.25) : 12,
    registeredDemocrat: hasParty ? Math.min(100, dem) : 33,
    registeredRepublican: hasParty ? Math.min(100, rep) : 33,
    registeredIndependent: hasParty ? Math.min(100, ind) : 29,
    registeredOther: 5,
    likelyVoters: 70,
  };
}

/**
 * Aggregate data from multiple precincts into a single PoliticalProfileConfig
 */
function aggregatePrecinctData(
  precincts: PrecinctData[],
  customAreaName?: string,
  areaDescription?: string,
  areaSelection?: PoliticalAreaSelection,
  mapThumbnail?: string,
  chartImages?: Record<string, string>,
  selectedPages?: number[]
): PoliticalProfileConfig {
  // Generate area name
  const areaName =
    customAreaName ||
    (precincts.length === 1
      ? precincts[0].precinctName
      : `${precincts.length} Precincts (${REPORT_COUNTY})`);

  // Aggregate political scores (weighted by registered voters if available)
  const aggregatedScores = aggregatePoliticalScores(precincts);

  // Aggregate election history (sum votes across precincts)
  const aggregatedElectionHistory = aggregateElectionHistory(precincts);

  // Aggregate demographics (sum populations, weighted averages for percentages)
  const aggregatedDemographics = aggregateDemographics(precincts);

  const baAttitudes = aggregateAttitudes(precincts) as PoliticalAttitudes;
  let aggregatedAttitudes: PoliticalAttitudes | undefined = isEffectivelyZeroAttitudes(baAttitudes)
    ? aggregateAttitudesFromTargeting(precincts) ?? undefined
    : baAttitudes;

  const baEngagement = aggregateEngagement(precincts) as PoliticalEngagement;
  let aggregatedEngagement: PoliticalEngagement | undefined = isEffectivelyZeroEngagement(baEngagement)
    ? undefined
    : baEngagement;

  // Build included precincts list
  const includedPrecincts = precincts.map((p) => ({
    name: p.precinctName,
    overlapRatio: 1.0, // Full precinct included
    registeredVoters:
      p.demographics?.registeredVoters ||
      num((p.targetingScores as Record<string, unknown>)?.registered_voters) ||
      num((p.targetingScores as Record<string, unknown>)?.active_voters) ||
      0,
  }));

  // Build area selection metadata
  const finalAreaSelection: PoliticalAreaSelection =
    areaSelection ||
    ({
      method: 'boundary-select',
      metadata: {
        boundaryType: 'precinct',
        boundaryNames: precincts.map((p) => p.precinctName),
      },
    } as PoliticalAreaSelection);

  return {
    areaSelection: finalAreaSelection,
    areaName,
    areaDescription,
    county: REPORT_COUNTY,
    state: REPORT_STATE,
    politicalScores: aggregatedScores,
    electionHistory: aggregatedElectionHistory,
    demographics: aggregatedDemographics,
    politicalAttitudes: aggregatedAttitudes,
    engagement: aggregatedEngagement,
    includedPrecincts,
    mapThumbnail,
    chartImages,
    selectedPages: selectedPages || [1, 2, 3, 4, 5, 6, 7], // Default to all pages
    reportDate: new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
  };
}

/**
 * Aggregate political scores across precincts
 * Weighted by registered voters where available
 */
function aggregatePoliticalScores(precincts: PrecinctData[]): PrecinctPoliticalScores {
  // Calculate total weight (registered voters if available, else equal weight)
  const weights = precincts.map((p) => {
    const t = p.targetingScores as Record<string, unknown> | null | undefined;
    return (
      p.demographics?.registeredVoters ||
      num(t?.registered_voters) ||
      num(t?.active_voters) ||
      1000
    );
  });
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  // Weighted averages
  let weightedLean = 0;
  let weightedSwing = 0;
  let weightedTurnout = 0;
  let totalElections = 0;
  let hasPresidentialData = false;
  let hasMidtermData = false;
  let presidentialTurnoutSum = 0;
  let midtermTurnoutSum = 0;
  let presidentialCount = 0;
  let midtermCount = 0;

  precincts.forEach((p, i) => {
    if (!p.scores) return;

    const weight = weights[i];
    weightedLean += p.scores.partisanLean.value * weight;
    weightedSwing += p.scores.swingPotential.value * weight;
    weightedTurnout += (p.scores.turnout?.averageTurnout ?? 65) * weight;
    totalElections = Math.max(totalElections, p.scores.partisanLean.electionsAnalyzed);

    if (p.scores.turnout?.presidentialAvg != null) {
      presidentialTurnoutSum += p.scores.turnout.presidentialAvg * weight;
      presidentialCount += weight;
      hasPresidentialData = true;
    }

    if (p.scores.turnout?.midtermAvg != null) {
      midtermTurnoutSum += p.scores.turnout.midtermAvg * weight;
      midtermCount += weight;
      hasMidtermData = true;
    }
  });

  const avgLean = weightedLean / totalWeight;
  const avgSwing = weightedSwing / totalWeight;
  const avgTurnout = weightedTurnout / totalWeight;
  const avgPresidential = hasPresidentialData ? presidentialTurnoutSum / presidentialCount : null;
  const avgMidterm = hasMidtermData ? midtermTurnoutSum / midtermCount : null;
  const dropoff =
    avgPresidential !== null && avgMidterm !== null ? avgPresidential - avgMidterm : null;

  // Classify competitiveness
  const competitiveness = classifyCompetitiveness(avgLean);

  // Classify volatility
  const volatility = classifyVolatility(avgSwing);

  // Calculate targeting priority
  const targetingPriority = calculateTargetingPriority(avgLean, avgSwing, avgTurnout);

  return {
    precinctId: 'aggregated',
    precinctName: 'Aggregated Area',
    partisanLean: {
      value: avgLean,
      classification: competitiveness,
      electionsAnalyzed: totalElections,
      confidence: totalElections >= 3 ? 0.9 : totalElections >= 2 ? 0.7 : 0.5,
    },
    swingPotential: {
      value: avgSwing,
      classification: volatility,
      components: {
        marginStdDev: avgSwing * 0.5,
        avgElectionSwing: avgSwing * 0.3,
        ticketSplitting: avgSwing * 0.2,
      },
    },
    turnout: {
      averageTurnout: avgTurnout,
      presidentialAvg: avgPresidential,
      midtermAvg: avgMidterm,
      dropoff,
      trend: 'stable',
      electionsAnalyzed: totalElections,
    },
    targetingPriority,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Aggregate election history across precincts
 */
function aggregateElectionHistory(precincts: PrecinctData[]): Record<string, ElectionData> {
  const electionMap = new Map<string, ElectionData>();

  precincts.forEach((p) => {
    if (!p.electionHistory?.elections) return;

    Object.entries(p.electionHistory.elections).forEach(([date, election]: [string, any]) => {
      if (!electionMap.has(date)) {
        // Initialize election
        electionMap.set(date, {
          date,
          type: election.type || 'general',
          registeredVoters: 0,
          ballotsCast: 0,
          turnout: 0,
          races: {} as Record<string, any>,
        });
      }

      const aggregated = electionMap.get(date)!;

      // Sum registered voters and ballots cast
      aggregated.registeredVoters += election.registered_voters || 0;
      aggregated.ballotsCast += election.ballots_cast || 0;

      // Aggregate races
      if (election.races) {
        Object.entries(election.races).forEach(([office, race]: [string, any]) => {
          if (!aggregated.races[office as keyof typeof aggregated.races]) {
            aggregated.races[office as keyof typeof aggregated.races] = {
              office: race.office,
              district: race.district,
              candidates: race.candidates || [],
              totalVotes: 0,
              demVotes: 0,
              repVotes: 0,
              otherVotes: 0,
              demPct: 0,
              repPct: 0,
              margin: 0,
              winner: race.winner,
              winnerParty: race.winner_party,
            };
          }

          const aggRace = aggregated.races[office as keyof typeof aggregated.races];
          aggRace.totalVotes += race.total_votes || 0;
          aggRace.demVotes += race.dem_votes || 0;
          aggRace.repVotes += race.rep_votes || 0;
          aggRace.otherVotes += race.other_votes || 0;
        });
      }
    });
  });

  // Recalculate percentages and margins
  electionMap.forEach((election) => {
    if (election.registeredVoters > 0) {
      election.turnout = (election.ballotsCast / election.registeredVoters) * 100;
    }

    Object.values(election.races).forEach((race) => {
      if (race.totalVotes > 0) {
        race.demPct = (race.demVotes / race.totalVotes) * 100;
        race.repPct = (race.repVotes / race.totalVotes) * 100;
        race.margin = race.demPct - race.repPct;
      }
    });
  });

  return Object.fromEntries(electionMap);
}

/**
 * Aggregate demographics across precincts
 * Includes age distribution computed from median age
 */
function aggregateDemographics(precincts: PrecinctData[]): any {
  let totalPopulation = 0;
  let votingAgePopulation = 0;
  let registeredVoters = 0;
  let totalWeight = 0;
  let weightedAge = 0;
  let weightedIncome = 0;
  let weightedEducation = 0;
  let weightedOwner = 0;
  let weightedRenter = 0;
  let weightedDiversity = 0;
  let weightedCollegePct = 0;

  precincts.forEach((p) => {
    if (!p.demographics) return;

    const pop = p.demographics.totalPopulation || 0;
    totalPopulation += pop;
    votingAgePopulation += p.demographics.votingAgePopulation || 0;
    registeredVoters += p.demographics.registeredVoters || 0;

    if (pop > 0) {
      totalWeight += pop;
      weightedAge += (p.demographics.medianAge || 0) * pop;
      weightedIncome += (p.demographics.medianHouseholdIncome || 0) * pop;
      weightedEducation += (p.demographics.educationBachelorsPlus || 0) * pop;
      weightedOwner += (p.demographics.ownerOccupied || 0) * pop;
      weightedRenter += (p.demographics.renterOccupied || 0) * pop;
      weightedDiversity += (p.demographics.diversityIndex || 0) * pop;
      weightedCollegePct += (p.demographics.collegePct || p.demographics.educationBachelorsPlus || 0) * pop;
    }
  });

  const medianAge = totalWeight > 0 ? weightedAge / totalWeight : 38;

  // Estimate age distribution from median age using demographic modeling
  // Based on typical age distributions adjusted by median age deviation from US average (38.5)
  const ageDistribution = estimateAgeDistribution(medianAge, totalPopulation);

  return {
    totalPopulation,
    votingAgePopulation,
    registeredVoters,
    medianAge,
    medianHouseholdIncome: totalWeight > 0 ? weightedIncome / totalWeight : 0,
    educationBachelorsPlus: totalWeight > 0 ? weightedEducation / totalWeight : 0,
    ownerOccupied: totalWeight > 0 ? weightedOwner / totalWeight : 0,
    renterOccupied: totalWeight > 0 ? weightedRenter / totalWeight : 0,
    diversityIndex: totalWeight > 0 ? weightedDiversity / totalWeight : 0,
    collegePct: totalWeight > 0 ? weightedCollegePct / totalWeight : 0,
    urbanRural: classifyUrbanRural(totalPopulation / precincts.length) as 'urban' | 'suburban' | 'rural',
    // Age distribution estimates
    ageDistribution,
  };
}

/**
 * Estimate age distribution from median age using demographic modeling
 * Uses typical US age distributions adjusted by deviation from national median
 */
function estimateAgeDistribution(medianAge: number, totalPop: number): {
  under18: number;
  age18to34: number;
  age35to54: number;
  age55to64: number;
  age65plus: number;
} {
  // US baseline percentages (Census 2020)
  const usBaseline = {
    under18: 22.3,
    age18to34: 21.5,
    age35to54: 25.4,
    age55to64: 13.0,
    age65plus: 17.8,
  };

  // US median age is approximately 38.5
  const usMedianAge = 38.5;
  const ageDeviation = medianAge - usMedianAge;

  // Adjust distributions based on median age deviation
  // Younger median = more under18 and 18-34, less 55+
  // Older median = less under18 and 18-34, more 55+
  const adjustmentFactor = ageDeviation / 20; // Normalize to -1 to 1 range

  let under18 = usBaseline.under18 * (1 - adjustmentFactor * 0.4);
  let age18to34 = usBaseline.age18to34 * (1 - adjustmentFactor * 0.3);
  let age35to54 = usBaseline.age35to54 * (1 + adjustmentFactor * 0.1);
  let age55to64 = usBaseline.age55to64 * (1 + adjustmentFactor * 0.3);
  let age65plus = usBaseline.age65plus * (1 + adjustmentFactor * 0.5);

  // Normalize to 100%
  const total = under18 + age18to34 + age35to54 + age55to64 + age65plus;
  const normalizer = 100 / total;

  return {
    under18: Math.round(under18 * normalizer * totalPop / 100),
    age18to34: Math.round(age18to34 * normalizer * totalPop / 100),
    age35to54: Math.round(age35to54 * normalizer * totalPop / 100),
    age55to64: Math.round(age55to64 * normalizer * totalPop / 100),
    age65plus: Math.round(age65plus * normalizer * totalPop / 100),
  };
}

/**
 * Classify urban/suburban/rural based on population density proxy
 */
function classifyUrbanRural(avgPopPerPrecinct: number): string {
  if (avgPopPerPrecinct > 5000) return 'urban';
  if (avgPopPerPrecinct > 2000) return 'suburban';
  return 'rural';
}

/**
 * Aggregate political attitudes across precincts
 */
function aggregateAttitudes(precincts: PrecinctData[]): any {
  const weights = precincts.map((p) => p.demographics?.totalPopulation || 1000);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  const weighted = {
    veryLiberal: 0,
    somewhatLiberal: 0,
    middleOfRoad: 0,
    somewhatConservative: 0,
    veryConservative: 0,
    registeredDemocrat: 0,
    registeredRepublican: 0,
    registeredIndependent: 0,
    registeredOther: 0,
    likelyVoters: 0,
  };

  precincts.forEach((p, i) => {
    if (!p.attitudes) return;

    const weight = weights[i];
    weighted.veryLiberal += (p.attitudes.veryLiberal || 0) * weight;
    weighted.somewhatLiberal += (p.attitudes.somewhatLiberal || 0) * weight;
    weighted.middleOfRoad += (p.attitudes.middleOfRoad || 0) * weight;
    weighted.somewhatConservative += (p.attitudes.somewhatConservative || 0) * weight;
    weighted.veryConservative += (p.attitudes.veryConservative || 0) * weight;
    weighted.registeredDemocrat += (p.attitudes.registeredDemocrat || 0) * weight;
    weighted.registeredRepublican += (p.attitudes.registeredRepublican || 0) * weight;
    weighted.registeredIndependent += (p.attitudes.registeredIndependent || 0) * weight;
    weighted.registeredOther += (p.attitudes.registeredOther || 0) * weight;
    weighted.likelyVoters += (p.attitudes.likelyVoters || 0) * weight;
  });

  return {
    veryLiberal: weighted.veryLiberal / totalWeight,
    somewhatLiberal: weighted.somewhatLiberal / totalWeight,
    middleOfRoad: weighted.middleOfRoad / totalWeight,
    somewhatConservative: weighted.somewhatConservative / totalWeight,
    veryConservative: weighted.veryConservative / totalWeight,
    registeredDemocrat: weighted.registeredDemocrat / totalWeight,
    registeredRepublican: weighted.registeredRepublican / totalWeight,
    registeredIndependent: weighted.registeredIndependent / totalWeight,
    registeredOther: weighted.registeredOther / totalWeight,
    likelyVoters: weighted.likelyVoters / totalWeight,
  };
}

/**
 * Aggregate engagement metrics across precincts
 */
function aggregateEngagement(precincts: PrecinctData[]): any {
  const weights = precincts.map((p) => p.demographics?.totalPopulation || 1000);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  const weighted = {
    politicalPodcastListeners: 0,
    politicalContributors: 0,
    wroteCalledPolitician: 0,
    cashGiftsToPolitical: 0,
    followsPoliticiansOnSocial: 0,
    followsPoliticalGroups: 0,
    votedLastElection: 0,
    alwaysVotes: 0,
  };

  precincts.forEach((p, i) => {
    if (!p.engagement) return;

    const weight = weights[i];
    weighted.politicalPodcastListeners += (p.engagement.politicalPodcastListeners || 0) * weight;
    weighted.politicalContributors += (p.engagement.politicalContributors || 0) * weight;
    weighted.wroteCalledPolitician += (p.engagement.wroteCalledPolitician || 0) * weight;
    weighted.cashGiftsToPolitical += (p.engagement.cashGiftsToPolitical || 0) * weight;
    weighted.followsPoliticiansOnSocial +=
      (p.engagement.followsPoliticiansOnSocial || 0) * weight;
    weighted.followsPoliticalGroups += (p.engagement.followsPoliticalGroups || 0) * weight;
    weighted.votedLastElection += (p.engagement.votedLastElection || 0) * weight;
    weighted.alwaysVotes += (p.engagement.alwaysVotes || 0) * weight;
  });

  return {
    politicalPodcastListeners: weighted.politicalPodcastListeners / totalWeight,
    politicalContributors: weighted.politicalContributors / totalWeight,
    wroteCalledPolitician: weighted.wroteCalledPolitician / totalWeight,
    cashGiftsToPolitical: weighted.cashGiftsToPolitical / totalWeight,
    followsPoliticiansOnSocial: weighted.followsPoliticiansOnSocial / totalWeight,
    followsPoliticalGroups: weighted.followsPoliticalGroups / totalWeight,
    votedLastElection: weighted.votedLastElection / totalWeight,
    alwaysVotes: weighted.alwaysVotes / totalWeight,
  };
}

// ============================================================================
// Classification Helpers
// ============================================================================

function classifyCompetitiveness(lean: number): import('@/types/political').CompetitivenessRating {
  if (lean >= 20) return 'Safe D';
  if (lean >= 10) return 'Likely D';
  if (lean >= 5) return 'Lean D';
  if (lean > -5) return 'Tossup';
  if (lean > -10) return 'Lean R';
  if (lean > -20) return 'Likely R';
  return 'Safe R';
}

function classifyVolatility(swing: number): import('@/types/political').VolatilityRating {
  if (swing >= 60) return 'Highly Volatile';
  if (swing >= 40) return 'Swing';
  if (swing >= 20) return 'Moderate';
  return 'Stable';
}

function calculateTargetingPriority(
  lean: number,
  swing: number,
  turnout: number
): TargetingPriority {
  // High priority: Competitive + high swing + lower turnout
  if (Math.abs(lean) < 10 && swing > 40) return 'High';

  // Medium-High: Somewhat competitive or high swing
  if (Math.abs(lean) < 15 || swing > 50) return 'Medium-High';

  // Medium: Moderate lean, moderate swing
  if (Math.abs(lean) < 25 && swing > 20) return 'Medium';

  // Low: Safe seats, stable voting patterns
  return 'Low';
}
