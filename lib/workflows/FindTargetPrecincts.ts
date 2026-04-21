/**
 * FindTargetPrecincts Workflow
 *
 * AI-guided workflow to help users find high-value target precincts
 * based on their campaign strategy (GOTV, Persuasion, or Battleground).
 *
 * Workflow Steps:
 * 1. Identify targeting strategy (or ask user)
 * 2. Apply relevant filters
 * 3. Rank and return top precincts
 * 4. Highlight on map
 * 5. Suggest next actions
 */

import type {
  MapCommand,
  SuggestedAction,
  ToolResult,
  TargetingStrategy,
  QueryFilters,
} from '../ai-native/types';
import { MapCommandBridge } from '../ai-native/MapCommandBridge';

// ============================================================================
// Types
// ============================================================================

export interface TargetPrecinctResult {
  id: string;
  name: string;
  jurisdiction: string;
  score: number;
  rank: number;
  strategy: string;
  metrics: PrecinctMetrics;
  recommendation: string;
}

export interface PrecinctMetrics {
  gotvPriority: number;
  persuasionOpportunity: number;
  swingPotential: number;
  population: number;
  avgTurnout: number;
  partisanLean: number;
}

export interface FindTargetsInput {
  strategy?: TargetingStrategy;
  filters?: QueryFilters;
  limit?: number;
  jurisdiction?: string;
}

export interface FindTargetsOutput {
  strategy: TargetingStrategy;
  totalFound: number;
  topPrecincts: TargetPrecinctResult[];
  summary: string;
  mapCommands: MapCommand[];
  suggestedActions: SuggestedAction[];
}

// ============================================================================
// Precinct Data (would come from API in production)
// ============================================================================

interface RawPrecinct {
  id: string;
  name: string;
  jurisdiction: string;
  demographics: {
    totalPopulation: number;
    population18up: number;
    medianAge: number;
    medianHHI: number;
  };
  electoral: {
    partisanLean: number;
    swingPotential: number;
    avgTurnout: number;
  };
  targeting: {
    gotvPriority: number;
    persuasionOpportunity: number;
    combinedScore: number;
    strategy: string;
  };
}

// ============================================================================
// FindTargetPrecincts Workflow
// ============================================================================

export class FindTargetPrecincts {
  private precinctData: RawPrecinct[] | null = null;

  /**
   * Execute the workflow
   */
  async execute(input: FindTargetsInput): Promise<ToolResult> {
    try {
      // Load precinct data
      await this.loadData();

      if (!this.precinctData || this.precinctData.length === 0) {
        return {
          success: false,
          error: 'No precinct data available',
          response: 'I couldn\'t load precinct data. Please ensure the data files are available.',
        };
      }

      // Determine strategy
      const strategy = input.strategy || 'battleground';

      // Find targets
      const output = this.findTargets(strategy, input);

      // Generate response
      return {
        success: true,
        data: output as unknown as Record<string, unknown>,
        response: output.summary,
        mapCommands: output.mapCommands,
        suggestedActions: output.suggestedActions,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        response: 'An error occurred while finding target precincts.',
      };
    }
  }

  /**
   * Load precinct data from file
   */
  private async loadData(): Promise<void> {
    if (this.precinctData) return;

    try {
      // In browser, fetch from API
      if (typeof window !== 'undefined') {
        const response = await fetch('/api/segments?action=list');
        if (response.ok) {
          const data = await response.json();
          this.precinctData = data.precincts || [];
        }
      } else {
        // In Node, read from file
        const fs = await import('fs/promises');
        const path = await import('path');
        const dataPath = path.join(process.cwd(), 'public/data/political/ingham_precincts.json');
        const raw = await fs.readFile(dataPath, 'utf-8');
        const data = JSON.parse(raw);
        this.precinctData = Object.values(data.precincts) as RawPrecinct[];
      }
    } catch (error) {
      console.error('Error loading precinct data:', error);
      this.precinctData = [];
    }
  }

  /**
   * Find target precincts based on strategy
   */
  private findTargets(
    strategy: TargetingStrategy,
    input: FindTargetsInput
  ): FindTargetsOutput {
    const limit = input.limit || 10;
    let precincts = [...(this.precinctData || [])];

    // Apply jurisdiction filter
    if (input.jurisdiction) {
      precincts = precincts.filter(p =>
        p.jurisdiction.toLowerCase().includes(input.jurisdiction!.toLowerCase())
      );
    }

    // Apply additional filters
    if (input.filters) {
      precincts = this.applyFilters(precincts, input.filters);
    }

    // Score and rank by strategy
    const scored = this.scorePrecincts(precincts, strategy);

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Take top N
    const topPrecincts = scored.slice(0, limit);

    // Generate summary
    const summary = this.generateSummary(strategy, topPrecincts, precincts.length);

    // Generate map commands
    const mapCommands = this.generateMapCommands(topPrecincts, strategy);

    // Generate suggested actions
    const suggestedActions = this.generateSuggestedActions(strategy, topPrecincts);

    return {
      strategy,
      totalFound: precincts.length,
      topPrecincts,
      summary,
      mapCommands,
      suggestedActions,
    };
  }

  /**
   * Apply filters to precincts
   */
  private applyFilters(precincts: RawPrecinct[], filters: QueryFilters): RawPrecinct[] {
    let filtered = precincts;

    if (filters.demographic) {
      const { minIncome, maxIncome } = filters.demographic;
      if (minIncome) {
        filtered = filtered.filter(p => p.demographics.medianHHI >= minIncome);
      }
      if (maxIncome) {
        filtered = filtered.filter(p => p.demographics.medianHHI <= maxIncome);
      }
    }

    if (filters.targeting) {
      const { gotvPriority, persuasionScore, swingPotential } = filters.targeting;
      if (gotvPriority) {
        filtered = filtered.filter(p =>
          p.targeting.gotvPriority >= gotvPriority.min &&
          p.targeting.gotvPriority <= gotvPriority.max
        );
      }
      if (persuasionScore) {
        filtered = filtered.filter(p =>
          p.targeting.persuasionOpportunity >= persuasionScore.min &&
          p.targeting.persuasionOpportunity <= persuasionScore.max
        );
      }
      if (swingPotential) {
        filtered = filtered.filter(p =>
          p.electoral.swingPotential >= swingPotential.min &&
          p.electoral.swingPotential <= swingPotential.max
        );
      }
    }

    return filtered;
  }

  /**
   * Score precincts based on targeting strategy
   */
  private scorePrecincts(
    precincts: RawPrecinct[],
    strategy: TargetingStrategy
  ): TargetPrecinctResult[] {
    return precincts.map((precinct, index) => {
      let score: number;
      let recommendation: string;

      switch (strategy) {
        case 'gotv':
          // GOTV: Prioritize high GOTV priority, low turnout, strong partisan lean
          score = precinct.targeting.gotvPriority * 0.5 +
                  (100 - precinct.electoral.avgTurnout) * 0.3 +
                  Math.abs(precinct.electoral.partisanLean) * 0.2;
          recommendation = precinct.targeting.gotvPriority > 70
            ? 'High-priority GOTV target - deploy canvassers and phone bankers'
            : 'Moderate GOTV potential - include in digital outreach';
          break;

        case 'persuasion':
          // Persuasion: Prioritize high persuasion opportunity, moderate lean
          score = precinct.targeting.persuasionOpportunity * 0.5 +
                  (50 - Math.abs(precinct.electoral.partisanLean)) * 0.3 +
                  precinct.electoral.swingPotential * 0.2;
          recommendation = precinct.targeting.persuasionOpportunity > 60
            ? 'Strong persuasion target - focus on moderate messaging'
            : 'Some persuasion potential - include in broader media buys';
          break;

        case 'battleground':
        default:
          // Battleground: Balanced approach, prioritize swing potential
          score = precinct.electoral.swingPotential * 0.35 +
                  precinct.targeting.gotvPriority * 0.35 +
                  precinct.targeting.persuasionOpportunity * 0.30;
          recommendation = score > 60
            ? 'Critical battleground - allocate maximum resources'
            : 'Secondary battleground - include in saturation programs';
          break;
      }

      return {
        id: precinct.id,
        name: precinct.name,
        jurisdiction: precinct.jurisdiction,
        score: Math.round(score),
        rank: index + 1,
        strategy: precinct.targeting.strategy,
        metrics: {
          gotvPriority: precinct.targeting.gotvPriority,
          persuasionOpportunity: precinct.targeting.persuasionOpportunity,
          swingPotential: precinct.electoral.swingPotential,
          population: precinct.demographics.population18up,
          avgTurnout: precinct.electoral.avgTurnout,
          partisanLean: precinct.electoral.partisanLean,
        },
        recommendation,
      };
    });
  }

  /**
   * Generate summary text
   */
  private generateSummary(
    strategy: TargetingStrategy,
    topPrecincts: TargetPrecinctResult[],
    totalPrecincts: number
  ): string {
    if (topPrecincts.length === 0) {
      return 'No precincts found matching your criteria.';
    }

    const strategyName = {
      gotv: 'GOTV (Get Out The Vote)',
      persuasion: 'Persuasion',
      battleground: 'Battleground',
    }[strategy];

    const topPrecinct = topPrecincts[0];
    const totalVoters = topPrecincts.reduce((sum, p) => sum + p.metrics.population, 0);
    const avgScore = Math.round(
      topPrecincts.reduce((sum, p) => sum + p.score, 0) / topPrecincts.length
    );

    let summary = `Found ${topPrecincts.length} top ${strategyName} targets from ${totalPrecincts} precincts.\n\n`;

    summary += `**Top Target:** ${topPrecinct.name} (${topPrecinct.jurisdiction})\n`;
    summary += `- Score: ${topPrecinct.score}/100\n`;
    summary += `- ${topPrecinct.metrics.population.toLocaleString()} voting-age adults\n`;
    summary += `- ${topPrecinct.recommendation}\n\n`;

    summary += `**Summary Stats:**\n`;
    summary += `- Total voters in top ${topPrecincts.length}: ${totalVoters.toLocaleString()}\n`;
    summary += `- Average target score: ${avgScore}/100\n`;

    // Add strategy-specific insights
    switch (strategy) {
      case 'gotv':
        const avgTurnout = Math.round(
          topPrecincts.reduce((sum, p) => sum + p.metrics.avgTurnout, 0) / topPrecincts.length
        );
        summary += `- Average turnout: ${avgTurnout}% (county avg: ~55%)\n`;
        summary += `\nThese precincts have strong base support but need turnout help.`;
        break;
      case 'persuasion':
        const avgLean = Math.round(
          topPrecincts.reduce((sum, p) => sum + p.metrics.partisanLean, 0) / topPrecincts.length
        );
        summary += `- Average partisan lean: ${avgLean > 0 ? '+' : ''}${avgLean}D\n`;
        summary += `\nThese precincts have significant persuadable voter populations.`;
        break;
      case 'battleground':
        const avgSwing = Math.round(
          topPrecincts.reduce((sum, p) => sum + p.metrics.swingPotential, 0) / topPrecincts.length
        );
        summary += `- Average swing potential: ${avgSwing}/100\n`;
        summary += `\nThese precincts could go either way - prioritize resource allocation.`;
        break;
    }

    return summary;
  }

  /**
   * Generate map commands for visualization
   */
  private generateMapCommands(
    precincts: TargetPrecinctResult[],
    strategy: TargetingStrategy
  ): MapCommand[] {
    if (precincts.length === 0) return [];

    const commands: MapCommand[] = [];

    // Highlight all target precincts
    const precinctIds = precincts.map(p => p.id);
    commands.push(
      MapCommandBridge.createHighlightPrecincts(precinctIds, {
        fillColor: strategy === 'gotv' ? '#22c55e' : strategy === 'persuasion' ? '#8b5cf6' : '#f59e0b',
        strokeColor: strategy === 'gotv' ? '#15803d' : strategy === 'persuasion' ? '#6d28d9' : '#d97706',
        strokeWidth: 2,
        opacity: 0.6,
      })
    );

    // Show heatmap of the primary metric
    const metric = strategy === 'gotv'
      ? 'gotvPriority'
      : strategy === 'persuasion'
      ? 'persuasionOpportunity'
      : 'swingPotential';

    commands.push(
      MapCommandBridge.createChoroplethCommand(metric, 'precincts', strategy === 'battleground')
    );

    return commands;
  }

  /**
   * Generate suggested next actions
   */
  private generateSuggestedActions(
    strategy: TargetingStrategy,
    precincts: TargetPrecinctResult[]
  ): SuggestedAction[] {
    const actions: SuggestedAction[] = [];

    if (precincts.length > 0) {
      // Save as segment
      actions.push({
        id: 'save-as-segment',
        label: `Save as "${strategy.toUpperCase()} Targets" Segment`,
        action: 'segment:save',
        icon: 'save',
        variant: 'primary',
        metadata: {
          name: `${strategy.charAt(0).toUpperCase() + strategy.slice(1)} Targets`,
          precinctIds: precincts.map(p => p.id),
        },
      });

      // Create canvass universe
      actions.push({
        id: 'create-canvass',
        label: 'Create Canvass Universe',
        action: 'canvass:create-from-segment',
        icon: 'route',
        metadata: { precinctIds: precincts.map(p => p.id) },
      });

      // Explain top precinct score
      actions.push({
        id: 'explain-top',
        label: `Why is ${precincts[0].name} #1?`,
        action: 'analyze:explain-score',
        icon: 'info',
        metadata: { precinctId: precincts[0].id, scoreType: strategy === 'gotv' ? 'gotv_priority' : strategy === 'persuasion' ? 'persuasion_opportunity' : 'swing_potential' },
      });

      // Export list
      actions.push({
        id: 'export-csv',
        label: 'Export Target List (CSV)',
        action: 'export:segment-csv',
        icon: 'download',
      });
    }

    // Try different strategy
    const otherStrategies = (['gotv', 'persuasion', 'battleground'] as const)
      .filter(s => s !== strategy);
    actions.push({
      id: 'try-different',
      label: `Try ${otherStrategies[0].toUpperCase()} Strategy Instead`,
      action: `workflow:find-targets`,
      icon: 'refresh',
      metadata: { strategy: otherStrategies[0] },
    });

    return actions.slice(0, 5);
  }
}

// ============================================================================
// Export
// ============================================================================

export const findTargetPrecincts = new FindTargetPrecincts();

export default FindTargetPrecincts;
