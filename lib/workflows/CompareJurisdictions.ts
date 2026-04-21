/**
 * CompareJurisdictions Workflow
 *
 * AI-guided workflow to compare two jurisdictions (cities, townships, etc.)
 * Generates narrative comparisons with strategic insights.
 *
 * Workflow Steps:
 * 1. Parse jurisdiction names from user input
 * 2. Load data for both jurisdictions
 * 3. Calculate aggregate metrics
 * 4. Generate comparative analysis
 * 5. Highlight on map with split view
 * 6. Suggest strategic actions
 */

import type {
  MapCommand,
  SuggestedAction,
  ToolResult,
} from '../ai-native/types';
import { MapCommandBridge } from '../ai-native/MapCommandBridge';
import { politicalDataService } from '@/lib/services/PoliticalDataService';

// ============================================================================
// Types
// ============================================================================

export interface JurisdictionSummary {
  id: string;
  name: string;
  type: 'city' | 'township' | 'village';
  precinctCount: number;
  metrics: JurisdictionMetrics;
}

export interface JurisdictionMetrics {
  totalPopulation: number;
  votingAgePopulation: number;
  medianAge: number;
  medianIncome: number;
  collegePct: number;
  diversityIndex: number;
  demAffiliationPct: number;
  repAffiliationPct: number;
  independentPct: number;
  partisanLean: number;
  avgTurnout: number;
  swingPotential: number;
  gotvPriority: number;
  persuasionOpportunity: number;
}

export interface ComparisonInsight {
  category: 'demographic' | 'political' | 'targeting' | 'strategic';
  metric: string;
  leftValue: number | string;
  rightValue: number | string;
  difference: number | string;
  insight: string;
  significance: 'high' | 'medium' | 'low';
}

export interface CompareInput {
  left: string;
  right: string;
  focusMetrics?: string[];
}

export interface CompareOutput {
  left: JurisdictionSummary;
  right: JurisdictionSummary;
  insights: ComparisonInsight[];
  narrative: string;
  strategicRecommendation: string;
  mapCommands: MapCommand[];
  suggestedActions: SuggestedAction[];
}

// ============================================================================
// Jurisdiction Data Loader
// ============================================================================

interface PrecinctData {
  id: string;
  name: string;
  jurisdiction: string;
  demographics: {
    totalPopulation: number;
    population18up: number;
    medianAge: number;
    medianHHI: number;
    collegePct: number;
    diversityIndex: number;
  };
  political: {
    demAffiliationPct: number;
    repAffiliationPct: number;
    independentPct: number;
  };
  electoral: {
    partisanLean: number;
    swingPotential: number;
    avgTurnout: number;
  };
  targeting: {
    gotvPriority: number;
    persuasionOpportunity: number;
  };
}

interface JurisdictionData {
  id: string;
  name: string;
  type: 'city' | 'township' | 'village';
  precinctIds: string[];
}

// ============================================================================
// CompareJurisdictions Workflow
// ============================================================================

export class CompareJurisdictions {
  private jurisdictions: JurisdictionData[] = [];
  private precincts: Map<string, PrecinctData> = new Map();
  private loaded = false;

  /**
   * Execute the comparison workflow
   */
  async execute(input: CompareInput): Promise<ToolResult> {
    try {
      // Load data
      await this.loadData();

      // Find jurisdictions
      const leftJuris = this.findJurisdiction(input.left);
      const rightJuris = this.findJurisdiction(input.right);

      if (!leftJuris) {
        return {
          success: false,
          error: `Jurisdiction not found: ${input.left}`,
          response: `I couldn't find a jurisdiction matching "${input.left}". Available jurisdictions: ${this.jurisdictions.map(j => j.name).join(', ')}`,
        };
      }

      if (!rightJuris) {
        return {
          success: false,
          error: `Jurisdiction not found: ${input.right}`,
          response: `I couldn't find a jurisdiction matching "${input.right}". Available jurisdictions: ${this.jurisdictions.map(j => j.name).join(', ')}`,
        };
      }

      // Calculate metrics
      const left = this.calculateJurisdictionMetrics(leftJuris);
      const right = this.calculateJurisdictionMetrics(rightJuris);

      // Generate comparison
      const output = this.generateComparison(left, right, input.focusMetrics);

      return {
        success: true,
        data: output as unknown as Record<string, unknown>,
        response: output.narrative,
        mapCommands: output.mapCommands,
        suggestedActions: output.suggestedActions,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        response: 'An error occurred while comparing jurisdictions.',
      };
    }
  }

  /**
   * Load jurisdiction and precinct data from PoliticalDataService (single source of truth)
   */
  private async loadData(): Promise<void> {
    if (this.loaded) return;

    try {
      // Use PoliticalDataService for single source of truth (blob storage)
      const data = await politicalDataService.getPrecinctDataFileFormat();

      this.jurisdictions = data.jurisdictions.map(j => ({
        id: j.id,
        name: j.name,
        type: j.type,
        precinctIds: j.precinctIds,
      }));
      this.precincts = new Map(Object.entries(data.precincts || {}));
      this.loaded = true;
      console.log(`[CompareJurisdictions] Loaded ${this.jurisdictions.length} jurisdictions, ${this.precincts.size} precincts from PoliticalDataService`);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }

  /**
   * Find jurisdiction by name (fuzzy match)
   */
  private findJurisdiction(name: string): JurisdictionData | undefined {
    const normalized = name.toLowerCase().trim();

    return this.jurisdictions.find(j => {
      const jName = j.name.toLowerCase();
      return (
        jName === normalized ||
        jName.includes(normalized) ||
        normalized.includes(jName) ||
        j.id.toLowerCase() === normalized
      );
    });
  }

  /**
   * Calculate aggregate metrics for a jurisdiction
   */
  private calculateJurisdictionMetrics(jurisdiction: JurisdictionData): JurisdictionSummary {
    const precinctList = jurisdiction.precinctIds
      .map(id => this.precincts.get(id))
      .filter((p): p is PrecinctData => p !== undefined);

    if (precinctList.length === 0) {
      throw new Error(`No precinct data for ${jurisdiction.name}`);
    }

    // Weighted averages by population
    const totalPop = precinctList.reduce((sum, p) => sum + p.demographics.totalPopulation, 0);
    const totalVAP = precinctList.reduce((sum, p) => sum + p.demographics.population18up, 0);

    const weightedAvg = (getter: (p: PrecinctData) => number): number => {
      const weightedSum = precinctList.reduce(
        (sum, p) => sum + getter(p) * p.demographics.totalPopulation,
        0
      );
      return weightedSum / totalPop;
    };

    const simpleAvg = (getter: (p: PrecinctData) => number): number => {
      return precinctList.reduce((sum, p) => sum + getter(p), 0) / precinctList.length;
    };

    return {
      id: jurisdiction.id,
      name: jurisdiction.name,
      type: jurisdiction.type,
      precinctCount: precinctList.length,
      metrics: {
        totalPopulation: totalPop,
        votingAgePopulation: totalVAP,
        medianAge: Math.round(weightedAvg(p => p.demographics.medianAge) * 10) / 10,
        medianIncome: Math.round(weightedAvg(p => p.demographics.medianHHI)),
        collegePct: Math.round(weightedAvg(p => p.demographics.collegePct) * 10) / 10,
        diversityIndex: Math.round(weightedAvg(p => p.demographics.diversityIndex)),
        demAffiliationPct: Math.round(weightedAvg(p => p.political.demAffiliationPct) * 10) / 10,
        repAffiliationPct: Math.round(weightedAvg(p => p.political.repAffiliationPct) * 10) / 10,
        independentPct: Math.round(weightedAvg(p => p.political.independentPct) * 10) / 10,
        partisanLean: Math.round(simpleAvg(p => p.electoral.partisanLean)),
        avgTurnout: Math.round(simpleAvg(p => p.electoral.avgTurnout) * 10) / 10,
        swingPotential: Math.round(simpleAvg(p => p.electoral.swingPotential)),
        gotvPriority: Math.round(simpleAvg(p => p.targeting.gotvPriority)),
        persuasionOpportunity: Math.round(simpleAvg(p => p.targeting.persuasionOpportunity)),
      },
    };
  }

  /**
   * Generate full comparison output
   */
  private generateComparison(
    left: JurisdictionSummary,
    right: JurisdictionSummary,
    focusMetrics?: string[]
  ): CompareOutput {
    // Generate insights
    const insights = this.generateInsights(left, right);

    // Filter by focus metrics if specified
    const filteredInsights = focusMetrics
      ? insights.filter(i => focusMetrics.some(m => i.metric.toLowerCase().includes(m.toLowerCase())))
      : insights;

    // Generate narrative
    const narrative = this.generateNarrative(left, right, filteredInsights);

    // Strategic recommendation
    const strategicRecommendation = this.generateStrategicRecommendation(left, right, insights);

    // Map commands
    const mapCommands = this.generateMapCommands(left, right);

    // Suggested actions
    const suggestedActions = this.generateSuggestedActions(left, right);

    return {
      left,
      right,
      insights: filteredInsights,
      narrative,
      strategicRecommendation,
      mapCommands,
      suggestedActions,
    };
  }

  /**
   * Generate comparison insights
   */
  private generateInsights(
    left: JurisdictionSummary,
    right: JurisdictionSummary
  ): ComparisonInsight[] {
    const insights: ComparisonInsight[] = [];
    const lm = left.metrics;
    const rm = right.metrics;

    // Demographic comparisons
    const ageDiff = lm.medianAge - rm.medianAge;
    if (Math.abs(ageDiff) >= 3) {
      insights.push({
        category: 'demographic',
        metric: 'Median Age',
        leftValue: lm.medianAge,
        rightValue: rm.medianAge,
        difference: ageDiff,
        insight: `${left.name} skews ${Math.abs(ageDiff).toFixed(1)} years ${ageDiff > 0 ? 'older' : 'younger'} than ${right.name}`,
        significance: Math.abs(ageDiff) >= 10 ? 'high' : 'medium',
      });
    }

    const incomeDiff = lm.medianIncome - rm.medianIncome;
    const incomeRatio = lm.medianIncome / rm.medianIncome;
    if (Math.abs(incomeRatio - 1) >= 0.2) {
      insights.push({
        category: 'demographic',
        metric: 'Median Income',
        leftValue: `$${lm.medianIncome.toLocaleString()}`,
        rightValue: `$${rm.medianIncome.toLocaleString()}`,
        difference: `$${Math.abs(incomeDiff).toLocaleString()}`,
        insight: `${left.name} has ${incomeRatio > 1 ? incomeRatio.toFixed(1) + '×' : (1/incomeRatio).toFixed(1) + '×'} ${incomeRatio > 1 ? 'higher' : 'lower'} income`,
        significance: incomeRatio >= 1.5 || incomeRatio <= 0.67 ? 'high' : 'medium',
      });
    }

    const collegeDiff = lm.collegePct - rm.collegePct;
    if (Math.abs(collegeDiff) >= 10) {
      insights.push({
        category: 'demographic',
        metric: 'College Education',
        leftValue: `${lm.collegePct}%`,
        rightValue: `${rm.collegePct}%`,
        difference: `${Math.abs(collegeDiff).toFixed(1)}%`,
        insight: `${collegeDiff > 0 ? left.name : right.name} has significantly higher college attainment`,
        significance: Math.abs(collegeDiff) >= 20 ? 'high' : 'medium',
      });
    }

    // Political comparisons
    const leanDiff = lm.partisanLean - rm.partisanLean;
    if (Math.abs(leanDiff) >= 5) {
      insights.push({
        category: 'political',
        metric: 'Partisan Lean',
        leftValue: `${lm.partisanLean > 0 ? '+' : ''}${lm.partisanLean}D`,
        rightValue: `${rm.partisanLean > 0 ? '+' : ''}${rm.partisanLean}D`,
        difference: `${Math.abs(leanDiff)} points`,
        insight: `${left.name} is ${Math.abs(leanDiff)} points more ${leanDiff > 0 ? 'Democratic' : 'Republican'}`,
        significance: Math.abs(leanDiff) >= 15 ? 'high' : 'medium',
      });
    }

    const turnoutDiff = lm.avgTurnout - rm.avgTurnout;
    if (Math.abs(turnoutDiff) >= 5) {
      insights.push({
        category: 'political',
        metric: 'Average Turnout',
        leftValue: `${lm.avgTurnout}%`,
        rightValue: `${rm.avgTurnout}%`,
        difference: `${Math.abs(turnoutDiff).toFixed(1)}%`,
        insight: `${turnoutDiff > 0 ? left.name : right.name} has ${Math.abs(turnoutDiff).toFixed(1)}% higher voter turnout`,
        significance: Math.abs(turnoutDiff) >= 10 ? 'high' : 'medium',
      });
    }

    // Targeting comparisons
    const gotvDiff = lm.gotvPriority - rm.gotvPriority;
    insights.push({
      category: 'targeting',
      metric: 'GOTV Priority',
      leftValue: lm.gotvPriority,
      rightValue: rm.gotvPriority,
      difference: Math.abs(gotvDiff),
      insight: gotvDiff > 0
        ? `${left.name} is a stronger GOTV target (${lm.gotvPriority} vs ${rm.gotvPriority})`
        : `${right.name} is a stronger GOTV target (${rm.gotvPriority} vs ${lm.gotvPriority})`,
      significance: Math.abs(gotvDiff) >= 15 ? 'high' : Math.abs(gotvDiff) >= 8 ? 'medium' : 'low',
    });

    const persuasionDiff = lm.persuasionOpportunity - rm.persuasionOpportunity;
    insights.push({
      category: 'targeting',
      metric: 'Persuasion Opportunity',
      leftValue: lm.persuasionOpportunity,
      rightValue: rm.persuasionOpportunity,
      difference: Math.abs(persuasionDiff),
      insight: persuasionDiff > 0
        ? `${left.name} has more persuadable voters (${lm.persuasionOpportunity} vs ${rm.persuasionOpportunity})`
        : `${right.name} has more persuadable voters (${rm.persuasionOpportunity} vs ${lm.persuasionOpportunity})`,
      significance: Math.abs(persuasionDiff) >= 15 ? 'high' : Math.abs(persuasionDiff) >= 8 ? 'medium' : 'low',
    });

    // Sort by significance
    return insights.sort((a, b) => {
      const sigOrder = { high: 0, medium: 1, low: 2 };
      return sigOrder[a.significance] - sigOrder[b.significance];
    });
  }

  /**
   * Generate narrative comparison text
   */
  private generateNarrative(
    left: JurisdictionSummary,
    right: JurisdictionSummary,
    insights: ComparisonInsight[]
  ): string {
    const parts: string[] = [];

    // Opening
    parts.push(`**${left.name} vs ${right.name}**\n`);

    // Population context
    const popRatio = left.metrics.votingAgePopulation / right.metrics.votingAgePopulation;
    parts.push(`${left.name} has ${left.metrics.votingAgePopulation.toLocaleString()} voting-age adults across ${left.precinctCount} precincts. `);
    parts.push(`${right.name} has ${right.metrics.votingAgePopulation.toLocaleString()} voting-age adults in ${right.precinctCount} precincts.\n`);

    // Top insights
    const topInsights = insights.filter(i => i.significance === 'high').slice(0, 3);
    if (topInsights.length > 0) {
      parts.push(`\n**Key Differences:**\n`);
      topInsights.forEach(insight => {
        parts.push(`- ${insight.insight}\n`);
      });
    }

    // Targeting summary
    const lm = left.metrics;
    const rm = right.metrics;

    parts.push(`\n**Strategic Profile:**\n`);

    // Determine primary strategy for each
    const leftStrategy = lm.gotvPriority > lm.persuasionOpportunity ? 'GOTV' : 'Persuasion';
    const rightStrategy = rm.gotvPriority > rm.persuasionOpportunity ? 'GOTV' : 'Persuasion';

    parts.push(`- ${left.name}: Best for ${leftStrategy} (GOTV: ${lm.gotvPriority}, Persuasion: ${lm.persuasionOpportunity})\n`);
    parts.push(`- ${right.name}: Best for ${rightStrategy} (GOTV: ${rm.gotvPriority}, Persuasion: ${rm.persuasionOpportunity})\n`);

    return parts.join('');
  }

  /**
   * Generate strategic recommendation
   */
  private generateStrategicRecommendation(
    left: JurisdictionSummary,
    right: JurisdictionSummary,
    insights: ComparisonInsight[]
  ): string {
    const lm = left.metrics;
    const rm = right.metrics;

    // Determine winner for each category
    const gotvWinner = lm.gotvPriority > rm.gotvPriority ? left.name : right.name;
    const persuasionWinner = lm.persuasionOpportunity > rm.persuasionOpportunity ? left.name : right.name;
    const turnoutWinner = lm.avgTurnout > rm.avgTurnout ? left.name : right.name;

    let recommendation = '';

    if (gotvWinner === persuasionWinner) {
      recommendation = `**Concentrate resources in ${gotvWinner}** - it scores higher on both GOTV priority and persuasion opportunity. `;
      recommendation += `${gotvWinner === left.name ? right.name : left.name} should receive maintenance-level attention.`;
    } else {
      recommendation = `**Split strategy recommended**: Deploy GOTV operations in ${gotvWinner} while running persuasion programs in ${persuasionWinner}. `;

      // Add specific tactical advice
      if (lm.avgTurnout < 50 || rm.avgTurnout < 50) {
        const lowTurnoutArea = lm.avgTurnout < rm.avgTurnout ? left.name : right.name;
        recommendation += `Focus early vote and mail-in outreach on ${lowTurnoutArea} given low historical turnout.`;
      }
    }

    return recommendation;
  }

  /**
   * Generate map commands
   */
  private generateMapCommands(
    left: JurisdictionSummary,
    right: JurisdictionSummary
  ): MapCommand[] {
    return [
      // Fly to show both jurisdictions
      {
        type: 'flyTo',
        center: [-84.5, 42.72], // Center of Ingham County
        zoom: 10,
        animation: true,
      },
      // Highlight left jurisdiction
      MapCommandBridge.createHighlightPrecincts(
        this.jurisdictions.find(j => j.id === left.id)?.precinctIds || [],
        {
          fillColor: '#3b82f6',
          strokeColor: '#1d4ed8',
          strokeWidth: 2,
          opacity: 0.5,
        }
      ),
      // Show partisan lean choropleth
      MapCommandBridge.createChoroplethCommand('partisanLean', 'precincts', true),
    ];
  }

  /**
   * Generate suggested actions
   */
  private generateSuggestedActions(
    left: JurisdictionSummary,
    right: JurisdictionSummary
  ): SuggestedAction[] {
    return [
      {
        id: 'export-comparison',
        label: 'Export Comparison PDF',
        action: 'export:comparison-pdf',
        icon: 'download',
        variant: 'primary',
        metadata: { leftId: left.id, rightId: right.id },
      },
      {
        id: 'swap-areas',
        label: 'Swap Comparison Areas',
        action: 'compare:swap',
        icon: 'refresh',
        metadata: { left: right.id, right: left.id },
      },
      {
        id: 'drill-down-left',
        label: `Show ${left.name} Precincts`,
        action: 'analyze:jurisdiction-precincts',
        icon: 'zoom-in',
        metadata: { jurisdictionId: left.id },
      },
      {
        id: 'drill-down-right',
        label: `Show ${right.name} Precincts`,
        action: 'analyze:jurisdiction-precincts',
        icon: 'zoom-in',
        metadata: { jurisdictionId: right.id },
      },
      {
        id: 'compare-to-county',
        label: 'Compare to County Average',
        action: 'compare:to-average',
        icon: 'percent',
      },
    ];
  }

  /**
   * Get list of available jurisdictions
   */
  async getAvailableJurisdictions(): Promise<string[]> {
    await this.loadData();
    return this.jurisdictions.map(j => j.name);
  }
}

// ============================================================================
// Export
// ============================================================================

export const compareJurisdictions = new CompareJurisdictions();

export default CompareJurisdictions;
