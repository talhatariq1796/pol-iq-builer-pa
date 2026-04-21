/**
 * Historical Trend Analysis for Election Data
 */

interface ElectionResult {
  turnout: number;
  demVoteShare: number;
  repVoteShare: number;
  margin: number;
}

interface PrecinctHistory {
  [year: string]: ElectionResult;
}

interface TrendAnalysis {
  precinctId: string;
  turnoutTrend: 'increasing' | 'decreasing' | 'stable';
  turnoutChange: number; // Change from first to last election
  marginTrend: 'shifting_dem' | 'shifting_rep' | 'stable';
  marginChange: number;
  volatility: number; // Standard deviation of margin
  flipRisk: boolean; // Did it flip or nearly flip?
}

let electionHistory: any = null;

export async function loadElectionHistory() {
  if (electionHistory) return electionHistory;

  try {
    const response = await fetch('/data/political/election-history.json');
    electionHistory = await response.json();
    return electionHistory;
  } catch (error) {
    console.warn('Could not load election history:', error);
    return null;
  }
}

export function analyzeTrends(precinctId: string): TrendAnalysis | null {
  if (!electionHistory?.precinctHistory?.[precinctId]) {
    return null;
  }

  const history = electionHistory.precinctHistory[precinctId] as PrecinctHistory;
  const years = Object.keys(history).sort();

  if (years.length < 2) return null;

  const first = history[years[0]];
  const last = history[years[years.length - 1]];
  const margins = years.map(y => history[y].margin);
  const turnouts = years.map(y => history[y].turnout);

  // Calculate changes
  const turnoutChange = last.turnout - first.turnout;
  const marginChange = last.margin - first.margin;

  // Calculate volatility (standard deviation)
  const avgMargin = margins.reduce((a, b) => a + b, 0) / margins.length;
  const volatility = Math.sqrt(
    margins.reduce((sum, m) => sum + Math.pow(m - avgMargin, 2), 0) / margins.length
  );

  // Determine trends
  const turnoutTrend = turnoutChange > 0.05 ? 'increasing'
    : turnoutChange < -0.05 ? 'decreasing'
    : 'stable';

  const marginTrend = marginChange > 5 ? 'shifting_dem'
    : marginChange < -5 ? 'shifting_rep'
    : 'stable';

  // Check for flip risk (crossed 0 or within 5 points)
  const flipRisk = margins.some((m, i) =>
    i > 0 && (m * margins[i-1] < 0 || Math.abs(m) < 5)
  );

  return {
    precinctId,
    turnoutTrend,
    turnoutChange,
    marginTrend,
    marginChange,
    volatility,
    flipRisk
  };
}

export function getPrecinctHistory(precinctId: string): PrecinctHistory | null {
  return electionHistory?.precinctHistory?.[precinctId] || null;
}

export function getAvailableElections(): string[] {
  return electionHistory?.metadata?.elections?.map((e: any) => e.year.toString()) || [];
}

export function formatTrendSummary(analysis: TrendAnalysis): string {
  const parts: string[] = [];

  if (analysis.turnoutTrend === 'increasing') {
    parts.push(`Turnout trending up (+${(analysis.turnoutChange * 100).toFixed(0)}%)`);
  } else if (analysis.turnoutTrend === 'decreasing') {
    parts.push(`Turnout trending down (${(analysis.turnoutChange * 100).toFixed(0)}%)`);
  }

  if (analysis.marginTrend === 'shifting_dem') {
    parts.push(`Shifting Democratic (+${analysis.marginChange.toFixed(0)} pts)`);
  } else if (analysis.marginTrend === 'shifting_rep') {
    parts.push(`Shifting Republican (${analysis.marginChange.toFixed(0)} pts)`);
  }

  if (analysis.flipRisk) {
    parts.push('⚠️ Flip risk');
  }

  if (analysis.volatility > 10) {
    parts.push('High volatility');
  }

  return parts.join(' • ') || 'Stable';
}

// ============================================================================
// Aggregate Trend Analysis Functions (for TrendHandler)
// ============================================================================

export interface TurnoutTrendSummary {
  overall: 'increasing' | 'decreasing' | 'stable';
  averageChange: number;
  increasingCount: number;
  decreasingCount: number;
  stableCount: number;
  topIncreasing: Array<{ precinctId: string; change: number }>;
  topDecreasing: Array<{ precinctId: string; change: number }>;
}

export interface PartisanShiftSummary {
  overall: 'shifting_dem' | 'shifting_rep' | 'stable';
  averageShift: number;
  shiftingDemCount: number;
  shiftingRepCount: number;
  stableCount: number;
  topDemShifts: Array<{ precinctId: string; shift: number }>;
  topRepShifts: Array<{ precinctId: string; shift: number }>;
}

export interface FlipRiskSummary {
  atRiskCount: number;
  highRisk: Array<{ precinctId: string; currentMargin: number; volatility: number }>;
  recentFlips: Array<{ precinctId: string; fromParty: string; toParty: string }>;
}

export interface ElectionComparison {
  year1: number;
  year2: number;
  turnoutChange: number;
  marginChange: number;
  precinctsFlipped: number;
  topChanges: Array<{ precinctId: string; marginChange: number }>;
}

/**
 * Analyze turnout trends across all precincts
 */
export function analyzeTurnoutTrends(): TurnoutTrendSummary {
  if (!electionHistory?.precinctHistory) {
    return {
      overall: 'stable',
      averageChange: 0,
      increasingCount: 0,
      decreasingCount: 0,
      stableCount: 0,
      topIncreasing: [],
      topDecreasing: [],
    };
  }

  const precincts = Object.keys(electionHistory.precinctHistory);
  const changes: Array<{ precinctId: string; change: number }> = [];

  precincts.forEach(precinctId => {
    const analysis = analyzeTrends(precinctId);
    if (analysis) {
      changes.push({ precinctId, change: analysis.turnoutChange });
    }
  });

  const averageChange = changes.length > 0
    ? changes.reduce((sum, c) => sum + c.change, 0) / changes.length
    : 0;

  const sorted = [...changes].sort((a, b) => b.change - a.change);

  return {
    overall: averageChange > 0.02 ? 'increasing' : averageChange < -0.02 ? 'decreasing' : 'stable',
    averageChange,
    increasingCount: changes.filter(c => c.change > 0.02).length,
    decreasingCount: changes.filter(c => c.change < -0.02).length,
    stableCount: changes.filter(c => Math.abs(c.change) <= 0.02).length,
    topIncreasing: sorted.slice(0, 5),
    topDecreasing: sorted.slice(-5).reverse(),
  };
}

/**
 * Analyze partisan shifts across all precincts
 */
export function analyzePartisanShifts(): PartisanShiftSummary {
  if (!electionHistory?.precinctHistory) {
    return {
      overall: 'stable',
      averageShift: 0,
      shiftingDemCount: 0,
      shiftingRepCount: 0,
      stableCount: 0,
      topDemShifts: [],
      topRepShifts: [],
    };
  }

  const precincts = Object.keys(electionHistory.precinctHistory);
  const shifts: Array<{ precinctId: string; shift: number }> = [];

  precincts.forEach(precinctId => {
    const analysis = analyzeTrends(precinctId);
    if (analysis) {
      shifts.push({ precinctId, shift: analysis.marginChange });
    }
  });

  const averageShift = shifts.length > 0
    ? shifts.reduce((sum, s) => sum + s.shift, 0) / shifts.length
    : 0;

  const sortedByDem = [...shifts].sort((a, b) => b.shift - a.shift);
  const sortedByRep = [...shifts].sort((a, b) => a.shift - b.shift);

  return {
    overall: averageShift > 3 ? 'shifting_dem' : averageShift < -3 ? 'shifting_rep' : 'stable',
    averageShift,
    shiftingDemCount: shifts.filter(s => s.shift > 3).length,
    shiftingRepCount: shifts.filter(s => s.shift < -3).length,
    stableCount: shifts.filter(s => Math.abs(s.shift) <= 3).length,
    topDemShifts: sortedByDem.slice(0, 5),
    topRepShifts: sortedByRep.slice(0, 5),
  };
}

/**
 * Identify precincts at risk of flipping party control
 */
export function identifyFlipRisk(): FlipRiskSummary {
  if (!electionHistory?.precinctHistory) {
    return {
      atRiskCount: 0,
      highRisk: [],
      recentFlips: [],
    };
  }

  const precincts = Object.keys(electionHistory.precinctHistory);
  const highRisk: Array<{ precinctId: string; currentMargin: number; volatility: number }> = [];
  const recentFlips: Array<{ precinctId: string; fromParty: string; toParty: string }> = [];

  precincts.forEach(precinctId => {
    const history = electionHistory.precinctHistory[precinctId] as PrecinctHistory;
    const years = Object.keys(history).sort();
    const analysis = analyzeTrends(precinctId);

    if (!analysis || years.length < 2) return;

    const lastYear = years[years.length - 1];
    const currentMargin = history[lastYear].margin;

    // High risk: close margin OR high volatility
    if (Math.abs(currentMargin) < 5 || analysis.volatility > 8) {
      highRisk.push({
        precinctId,
        currentMargin,
        volatility: analysis.volatility,
      });
    }

    // Check for recent flips
    if (years.length >= 2) {
      const prevYear = years[years.length - 2];
      const prevMargin = history[prevYear].margin;
      if (prevMargin * currentMargin < 0) {
        recentFlips.push({
          precinctId,
          fromParty: prevMargin > 0 ? 'D' : 'R',
          toParty: currentMargin > 0 ? 'D' : 'R',
        });
      }
    }
  });

  // Sort by risk (closest margin first)
  highRisk.sort((a, b) => Math.abs(a.currentMargin) - Math.abs(b.currentMargin));

  return {
    atRiskCount: highRisk.length,
    highRisk: highRisk.slice(0, 10),
    recentFlips,
  };
}

/**
 * Compare two election years side by side
 */
export function compareElections(year1: number, year2: number): ElectionComparison {
  const y1 = year1.toString();
  const y2 = year2.toString();

  if (!electionHistory?.precinctHistory) {
    return {
      year1,
      year2,
      turnoutChange: 0,
      marginChange: 0,
      precinctsFlipped: 0,
      topChanges: [],
    };
  }

  const precincts = Object.keys(electionHistory.precinctHistory);
  let totalTurnoutChange = 0;
  let totalMarginChange = 0;
  let precinctsFlipped = 0;
  let validCount = 0;
  const changes: Array<{ precinctId: string; marginChange: number }> = [];

  precincts.forEach(precinctId => {
    const history = electionHistory.precinctHistory[precinctId] as PrecinctHistory;
    if (!history[y1] || !history[y2]) return;

    const turnoutDiff = history[y2].turnout - history[y1].turnout;
    const marginDiff = history[y2].margin - history[y1].margin;

    totalTurnoutChange += turnoutDiff;
    totalMarginChange += marginDiff;
    validCount++;

    changes.push({ precinctId, marginChange: marginDiff });

    // Check if flipped
    if (history[y1].margin * history[y2].margin < 0) {
      precinctsFlipped++;
    }
  });

  const sortedChanges = [...changes].sort((a, b) => Math.abs(b.marginChange) - Math.abs(a.marginChange));

  return {
    year1,
    year2,
    turnoutChange: validCount > 0 ? totalTurnoutChange / validCount : 0,
    marginChange: validCount > 0 ? totalMarginChange / validCount : 0,
    precinctsFlipped,
    topChanges: sortedChanges.slice(0, 10),
  };
}
