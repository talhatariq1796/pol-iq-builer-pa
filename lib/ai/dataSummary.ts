/**
 * Data summary utility for injecting context into AI prompts
 * Provides pre-computed statistics so AI can answer data questions without tool calling
 *
 * IMPORTANT: This module runs in edge runtime (AI chat API), so it cannot use
 * PoliticalDataService which has Node.js-only code (fs/path).
 *
 * For edge runtime, we fetch directly from blob storage URLs.
 * The async version (getDataSummaryTextAsync) should be used when possible
 * as it provides data from the single source of truth.
 */

import zipAggregatesData from '../../public/data/donors/zip-aggregates.json' with { type: 'json' };
import timeSeriesData from '../../public/data/donors/time-series.json' with { type: 'json' };

// Blob URLs for direct fetching (works in edge runtime)
const BLOB_URLS = {
  targetingScores: '""',
  politicalScores: '""',
};

// Cached summary to avoid recomputation
let cachedSummary: DataSummary | null = null;

interface DataSummary {
  donors: {
    totalAmount: string;
    demAmount: string;
    repAmount: string;
    otherAmount: string;
    totalDonors: string;
    demDonors: number;
    repDonors: number;
    totalContributions: string;
    avgGift: string;
    topZips: Array<{ zip: string; city: string; amount: string }>;
    dateRange: string;
    peakMonths: Array<{ month: string; amount: string }>;
  };
  precincts: {
    totalCount: number;
    jurisdictions: Array<{ name: string; type: string; precinctCount: number }>;
    demographics: {
      totalPopulation: string;
      medianAge: string;
      medianIncome: string;
    };
    political: {
      safeDemCount: number;
      leanDemCount: number;
      tossUpCount: number;
      leanRepCount: number;
      safeRepCount: number;
      avgTurnout2024: string;
      avgTurnout2022: string;
      avgTurnout2020: string;
    };
  };
}

// Type for raw targeting scores from blob
interface RawTargetingPrecinct {
  precinct_id?: string;
  precinct_name?: string;
  total_population?: number;
  population_age_18up?: number;
  median_household_income?: number;
  gotv_priority?: number;
  persuasion_opportunity?: number;
  targeting_strategy?: string;
  dem_affiliation_pct?: number;
  rep_affiliation_pct?: number;
  political_scores?: {
    partisan_lean?: number;
    swing_potential?: number;
  };
}

interface RawTargetingData {
  metadata?: { precinct_count: number };
  precincts: Record<string, RawTargetingPrecinct>;
}

// Type for raw political scores from blob
interface RawPoliticalPrecinct {
  partisan_lean: number | null;
  swing_potential: number | null;
  turnout?: {
    average: number;
  } | null;
  classification?: {
    competitiveness?: string;
    volatility?: string;
  };
}

interface RawPoliticalData {
  summary?: { total_precincts: number };
  precincts: Record<string, RawPoliticalPrecinct>;
}

/**
 * Calculate comprehensive data summary by fetching from blob storage
 * Works in edge runtime (no fs/path dependencies)
 */
async function calculateDataSummaryAsync(): Promise<DataSummary> {
  // Return cached summary if available
  if (cachedSummary) {
    return cachedSummary;
  }

  // Donor aggregates (from static JSON - donor data is fine)
  const donorTotals = zipAggregatesData.reduce(
    (acc, zip) => ({
      totalAmount: acc.totalAmount + zip.totalAmount,
      demAmount: acc.demAmount + zip.demAmount,
      repAmount: acc.repAmount + zip.repAmount,
      otherAmount: acc.otherAmount + zip.otherAmount,
      donorCount: acc.donorCount + zip.donorCount,
      demDonors: acc.demDonors + zip.demDonors,
      repDonors: acc.repDonors + zip.repDonors,
      contributionCount: acc.contributionCount + zip.contributionCount,
    }),
    {
      totalAmount: 0,
      demAmount: 0,
      repAmount: 0,
      otherAmount: 0,
      donorCount: 0,
      demDonors: 0,
      repDonors: 0,
      contributionCount: 0,
    }
  );

  const topZips = [...zipAggregatesData]
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, 5)
    .map((zip) => ({
      zip: zip.zipCode,
      city: zip.city,
      amount: `$${zip.totalAmount.toLocaleString()}`,
    }));

  // Time series peaks
  const peakMonths = [...timeSeriesData.monthlyTotals]
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, 5)
    .map((m) => ({
      month: m.month,
      amount: `$${m.totalAmount.toLocaleString()}`,
    }));

  // Fetch precinct data directly from blob storage (works in edge runtime)
  let targetingData: RawTargetingData = { precincts: {} };
  let politicalData: RawPoliticalData = { precincts: {} };

  try {
    const [targetingResp, politicalResp] = await Promise.all([
      fetch(BLOB_URLS.targetingScores),
      fetch(BLOB_URLS.politicalScores),
    ]);

    if (targetingResp.ok) {
      targetingData = await targetingResp.json();
    }
    if (politicalResp.ok) {
      politicalData = await politicalResp.json();
    }
  } catch (error) {
    console.warn('[dataSummary] Failed to fetch blob data:', error);
  }

  // Merge targeting and political data (same logic as PoliticalDataService.getUnifiedPrecinctData)
  const allPrecinctNames = new Set([
    ...Object.keys(targetingData.precincts),
    ...Object.keys(politicalData.precincts),
  ]);

  // Extract jurisdiction from precinct name
  const extractJurisdiction = (name: string): string => {
    const match = name.match(/^(.+?)\s+Precinct\s+\d+$/i);
    if (match) return match[1].trim();
    return name;
  };

  // Build jurisdictions map
  const jurisdictionMap = new Map<string, { name: string; type: string; count: number }>();
  for (const name of allPrecinctNames) {
    const jurisdiction = extractJurisdiction(name);
    const existing = jurisdictionMap.get(jurisdiction);
    if (existing) {
      existing.count++;
    } else {
      const type = jurisdiction.toLowerCase().includes('township')
        ? 'Township'
        : jurisdiction.toLowerCase().includes('city')
          ? 'City'
          : 'Municipality';
      jurisdictionMap.set(jurisdiction, { name: jurisdiction, type, count: 1 });
    }
  }

  // Calculate stats
  let safeDemCount = 0;
  let leanDemCount = 0;
  let tossUpCount = 0;
  let leanRepCount = 0;
  let safeRepCount = 0;
  let totalPopulation = 0;
  let incomeSum = 0;
  let incomeCount = 0;
  let turnoutSum = 0;
  let turnoutCount = 0;

  for (const name of allPrecinctNames) {
    const targeting = targetingData.precincts[name];
    const political = politicalData.precincts[name];

    // Competitiveness
    const comp = (political?.classification?.competitiveness || '').toLowerCase().replace(/\s+/g, '_');
    if (comp === 'safe_d') safeDemCount++;
    else if (comp === 'likely_d' || comp === 'lean_d') leanDemCount++;
    else if (comp === 'toss_up' || comp === 'tossup') tossUpCount++;
    else if (comp === 'lean_r' || comp === 'likely_r') leanRepCount++;
    else if (comp === 'safe_r') safeRepCount++;

    // Demographics
    if (targeting?.total_population) {
      totalPopulation += targeting.total_population;
      if (targeting.median_household_income) {
        incomeSum += targeting.median_household_income;
        incomeCount++;
      }
    }

    // Turnout
    if (political?.turnout?.average) {
      turnoutSum += political.turnout.average;
      turnoutCount++;
    }
  }

  // Build jurisdictions array sorted by precinct count
  const jurisdictions = Array.from(jurisdictionMap.values())
    .map((j) => ({ name: j.name, type: j.type, precinctCount: j.count }))
    .sort((a, b) => b.precinctCount - a.precinctCount);

  cachedSummary = {
    donors: {
      totalAmount: `$${donorTotals.totalAmount.toLocaleString()}`,
      demAmount: `$${donorTotals.demAmount.toLocaleString()}`,
      repAmount: `$${donorTotals.repAmount.toLocaleString()}`,
      otherAmount: `$${donorTotals.otherAmount.toLocaleString()}`,
      totalDonors: donorTotals.donorCount.toLocaleString(),
      demDonors: donorTotals.demDonors,
      repDonors: donorTotals.repDonors,
      totalContributions: donorTotals.contributionCount.toLocaleString(),
      avgGift: `$${Math.round(donorTotals.totalAmount / donorTotals.contributionCount)}`,
      topZips,
      dateRange: `${timeSeriesData.dateRange.earliest} to ${timeSeriesData.dateRange.latest}`,
      peakMonths,
    },
    precincts: {
      totalCount: allPrecinctNames.size,
      jurisdictions,
      demographics: {
        totalPopulation: totalPopulation.toLocaleString(),
        medianAge: 'N/A', // Not available in blob data
        medianIncome:
          incomeCount > 0
            ? `$${Math.round(incomeSum / incomeCount).toLocaleString()}`
            : 'N/A',
      },
      political: {
        safeDemCount,
        leanDemCount,
        tossUpCount,
        leanRepCount,
        safeRepCount,
        avgTurnout2024:
          turnoutCount > 0
            ? `${(turnoutSum / turnoutCount).toFixed(1)}%`
            : 'N/A',
        avgTurnout2022: 'N/A', // Year-specific data not available
        avgTurnout2020: 'N/A',
      },
    },
  };

  console.log(
    `[dataSummary] Calculated summary from ${allPrecinctNames.size} precincts (targeting: ${Object.keys(targetingData.precincts).length}, political: ${Object.keys(politicalData.precincts).length})`
  );

  return cachedSummary;
}

/**
 * Synchronous fallback for calculateDataSummary
 * Returns cached data or minimal fallback if async data not yet loaded
 */
function calculateDataSummary(): DataSummary {
  // Return cached if available
  if (cachedSummary) {
    return cachedSummary;
  }

  // Trigger async load in background (for next call)
  calculateDataSummaryAsync().catch((err) => {
    console.error('[dataSummary] Failed to load async summary:', err);
  });

  // Return minimal fallback while loading
  const donorTotals = zipAggregatesData.reduce(
    (acc, zip) => ({
      totalAmount: acc.totalAmount + zip.totalAmount,
      demAmount: acc.demAmount + zip.demAmount,
      repAmount: acc.repAmount + zip.repAmount,
      otherAmount: acc.otherAmount + zip.otherAmount,
      donorCount: acc.donorCount + zip.donorCount,
      demDonors: acc.demDonors + zip.demDonors,
      repDonors: acc.repDonors + zip.repDonors,
      contributionCount: acc.contributionCount + zip.contributionCount,
    }),
    {
      totalAmount: 0,
      demAmount: 0,
      repAmount: 0,
      otherAmount: 0,
      donorCount: 0,
      demDonors: 0,
      repDonors: 0,
      contributionCount: 0,
    }
  );

  const topZips = [...zipAggregatesData]
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, 5)
    .map((zip) => ({
      zip: zip.zipCode,
      city: zip.city,
      amount: `$${zip.totalAmount.toLocaleString()}`,
    }));

  const peakMonths = [...timeSeriesData.monthlyTotals]
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, 5)
    .map((m) => ({
      month: m.month,
      amount: `$${m.totalAmount.toLocaleString()}`,
    }));

  return {
    donors: {
      totalAmount: `$${donorTotals.totalAmount.toLocaleString()}`,
      demAmount: `$${donorTotals.demAmount.toLocaleString()}`,
      repAmount: `$${donorTotals.repAmount.toLocaleString()}`,
      otherAmount: `$${donorTotals.otherAmount.toLocaleString()}`,
      totalDonors: donorTotals.donorCount.toLocaleString(),
      demDonors: donorTotals.demDonors,
      repDonors: donorTotals.repDonors,
      totalContributions: donorTotals.contributionCount.toLocaleString(),
      avgGift: `$${Math.round(donorTotals.totalAmount / donorTotals.contributionCount)}`,
      topZips,
      dateRange: `${timeSeriesData.dateRange.earliest} to ${timeSeriesData.dateRange.latest}`,
      peakMonths,
    },
    precincts: {
      totalCount: 0, // Will be populated on next call after async loads
      jurisdictions: [],
      demographics: {
        totalPopulation: 'Loading...',
        medianAge: 'Loading...',
        medianIncome: 'Loading...',
      },
      political: {
        safeDemCount: 0,
        leanDemCount: 0,
        tossUpCount: 0,
        leanRepCount: 0,
        safeRepCount: 0,
        avgTurnout2024: 'Loading...',
        avgTurnout2022: 'Loading...',
        avgTurnout2020: 'Loading...',
      },
    },
  };
}

/**
 * Format data summary as text for prompt injection (async version - preferred)
 * Uses PoliticalDataService for consistent precinct data
 */
export async function getDataSummaryTextAsync(): Promise<string> {
  const summary = await calculateDataSummaryAsync();
  return formatSummaryAsText(summary);
}

/**
 * Format data summary as text for prompt injection (sync version - fallback)
 * May return cached or loading state on first call
 */
export function getDataSummaryText(): string {
  const summary = calculateDataSummary();
  return formatSummaryAsText(summary);
}

/**
 * Format a DataSummary object as text for prompt injection
 */
function formatSummaryAsText(summary: DataSummary): string {
  return `
═══════════════════════════════════════════════════════════════
                    INGHAM COUNTY DATA SUMMARY
═══════════════════════════════════════════════════════════════

📊 DONOR DATA (FEC Contributions)
────────────────────────────────────────────────────────────────
Total Contributions: ${summary.donors.totalAmount}
  • Democratic: ${summary.donors.demAmount} (${summary.donors.demDonors.toLocaleString()} donors)
  • Republican: ${summary.donors.repAmount} (${summary.donors.repDonors.toLocaleString()} donors)
  • Other/Unaffiliated: ${summary.donors.otherAmount}

Total Unique Donors: ${summary.donors.totalDonors}
Total Contributions: ${summary.donors.totalContributions}
Average Gift Size: ${summary.donors.avgGift}
Date Range: ${summary.donors.dateRange}

Top 5 ZIP Codes by Contribution Volume:
${summary.donors.topZips.map((z, i) => `  ${i + 1}. ${z.zip} (${z.city}): ${z.amount}`).join('\n')}

Peak Fundraising Months:
${summary.donors.peakMonths.map((m, i) => `  ${i + 1}. ${m.month}: ${m.amount}`).join('\n')}

🗳️ PRECINCT & ELECTORAL DATA
────────────────────────────────────────────────────────────────
Total Precincts: ${summary.precincts.totalCount}

Jurisdictions:
${summary.precincts.jurisdictions.map((j) => `  • ${j.name} (${j.type}): ${j.precinctCount} precincts`).join('\n')}

Demographics (County-wide Averages):
  • Total Population: ${summary.precincts.demographics.totalPopulation}
  • Median Age: ${summary.precincts.demographics.medianAge} years
  • Median Household Income: ${summary.precincts.demographics.medianIncome}

Precinct Competitiveness Breakdown:
  • Safe Democratic: ${summary.precincts.political.safeDemCount} precincts
  • Lean Democratic: ${summary.precincts.political.leanDemCount} precincts
  • Toss-Up: ${summary.precincts.political.tossUpCount} precincts
  • Lean Republican: ${summary.precincts.political.leanRepCount} precincts
  • Safe Republican: ${summary.precincts.political.safeRepCount} precincts

Average Turnout Rates:
  • 2024 Election: ${summary.precincts.political.avgTurnout2024}
  • 2022 Election: ${summary.precincts.political.avgTurnout2022}
  • 2020 Election: ${summary.precincts.political.avgTurnout2020}

═══════════════════════════════════════════════════════════════

When answering questions about data, reference these statistics directly.
For more detailed breakdowns, suggest using the appropriate tool:
  • Donor Tool: ZIP-level donor analysis, prospect identification
  • Segmentation Tool: Precinct filtering by demographics/politics
  • Comparison Tool: Side-by-side district/precinct comparisons
  • Canvassing Tool: Door-knocking route optimization

`;
}

/**
 * Get raw data summary object (async version - preferred)
 * Uses PoliticalDataService for consistent precinct data
 */
export async function getDataSummaryAsync(): Promise<DataSummary> {
  return calculateDataSummaryAsync();
}

/**
 * Get raw data summary object (sync version - fallback)
 * May return cached or loading state on first call
 */
export function getDataSummary(): DataSummary {
  return calculateDataSummary();
}

/**
 * Pre-warm the data summary cache
 * Call this during app initialization to ensure data is ready
 */
export async function warmDataSummaryCache(): Promise<void> {
  await calculateDataSummaryAsync();
  console.log('[dataSummary] Cache warmed successfully');
}
