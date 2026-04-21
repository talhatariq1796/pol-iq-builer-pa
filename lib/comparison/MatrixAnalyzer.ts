/**
 * Matrix Analyzer for Multi-Entity Comparison
 *
 * Provides statistical analysis across multiple entities including
 * descriptive statistics, correlation analysis, and Pareto analysis.
 */

import type { ComparisonEntity } from './types';
import type {
  MatrixAnalytics,
  MetricGroupAnalysis,
  MetricStats,
  OutlierEntity,
  CorrelationMatrix,
  CorrelationPair,
  ParetoAnalysis,
} from './types-batch';

export class MatrixAnalyzer {
  /**
   * Perform full statistical analysis on entities
   */
  analyze(entities: ComparisonEntity[]): MatrixAnalytics {
    return {
      demographics: this.analyzeDemographics(entities),
      political: this.analyzePolitical(entities),
      targeting: this.analyzeTargeting(entities),
      correlations: this.calculateCorrelations(entities),
      paretoAnalysis: this.paretoAnalysis(entities),
    };
  }

  /**
   * Analyze demographic metrics
   */
  private analyzeDemographics(entities: ComparisonEntity[]): MetricGroupAnalysis {
    return {
      population: this.calculateStats(entities, e => e.demographics.totalPopulation, 'population'),
      medianIncome: this.calculateStats(entities, e => e.demographics.medianIncome, 'medianIncome'),
      medianAge: this.calculateStats(entities, e => e.demographics.medianAge, 'medianAge'),
      collegePct: this.calculateStats(entities, e => e.demographics.collegePct, 'collegePct'),
      homeownerPct: this.calculateStats(entities, e => e.demographics.homeownerPct, 'homeownerPct'),
      diversityIndex: this.calculateStats(entities, e => e.demographics.diversityIndex, 'diversityIndex'),
    };
  }

  /**
   * Analyze political metrics
   */
  private analyzePolitical(entities: ComparisonEntity[]): MetricGroupAnalysis {
    return {
      partisanLean: this.calculateStats(entities, e => e.politicalProfile.partisanLean, 'partisanLean'),
      swingPotential: this.calculateStats(entities, e => e.politicalProfile.swingPotential, 'swingPotential'),
      avgTurnout: this.calculateStats(entities, e => e.politicalProfile.avgTurnoutRate, 'avgTurnout'),
      demAffiliation: this.calculateStats(entities, e => e.politicalProfile.demAffiliationPct, 'demAffiliation'),
      repAffiliation: this.calculateStats(entities, e => e.politicalProfile.repAffiliationPct, 'repAffiliation'),
    };
  }

  /**
   * Analyze targeting metrics
   */
  private analyzeTargeting(entities: ComparisonEntity[]): MetricGroupAnalysis {
    return {
      gotvPriority: this.calculateStats(entities, e => e.targetingScores.gotvPriority, 'gotvPriority'),
      persuasionOpportunity: this.calculateStats(entities, e => e.targetingScores.persuasionOpportunity, 'persuasionOpportunity'),
      combinedScore: this.calculateStats(entities, e => e.targetingScores.combinedScore, 'combinedScore'),
      canvassingEfficiency: this.calculateStats(entities, e => e.targetingScores.canvassingEfficiency, 'canvassingEfficiency'),
    };
  }

  /**
   * Calculate statistics for a metric
   */
  private calculateStats(
    entities: ComparisonEntity[],
    getter: (e: ComparisonEntity) => number,
    metricName: string
  ): MetricStats {
    const values = entities.map(getter);

    const mean = this.mean(values);
    const median = this.median(values);
    const stdDev = this.stdDev(values);
    const min = Math.min(...values);
    const max = Math.max(...values);

    // Find outliers (> 1.5 std dev from mean)
    const outliers: OutlierEntity[] = [];
    for (let i = 0; i < entities.length; i++) {
      const value = values[i];
      const deviation = Math.abs(value - mean) / (stdDev || 1);
      if (deviation > 1.5) {
        outliers.push({
          entityId: entities[i].id,
          entityName: entities[i].name,
          value,
          deviation: Math.round(deviation * 10) / 10,
        });
      }
    }

    return {
      mean: Math.round(mean * 100) / 100,
      median: Math.round(median * 100) / 100,
      stdDev: Math.round(stdDev * 100) / 100,
      min,
      max,
      outliers,
    };
  }

  /**
   * Calculate correlation matrix between key metrics
   */
  private calculateCorrelations(entities: ComparisonEntity[]): CorrelationMatrix {
    const pairs: CorrelationPair[] = [];

    // Define metrics to correlate
    const metrics: Array<{ name: string; getter: (e: ComparisonEntity) => number }> = [
      { name: 'Partisan Lean', getter: e => e.politicalProfile.partisanLean },
      { name: 'Median Income', getter: e => e.demographics.medianIncome },
      { name: 'College %', getter: e => e.demographics.collegePct },
      { name: 'GOTV Priority', getter: e => e.targetingScores.gotvPriority },
      { name: 'Persuasion', getter: e => e.targetingScores.persuasionOpportunity },
      { name: 'Turnout', getter: e => e.politicalProfile.avgTurnoutRate },
    ];

    // Calculate pairwise correlations
    for (let i = 0; i < metrics.length; i++) {
      for (let j = i + 1; j < metrics.length; j++) {
        const x = entities.map(metrics[i].getter);
        const y = entities.map(metrics[j].getter);
        const r = this.pearsonCorrelation(x, y);

        pairs.push({
          metric1: metrics[i].name,
          metric2: metrics[j].name,
          correlation: Math.round(r * 100) / 100,
          interpretation: this.interpretCorrelation(metrics[i].name, metrics[j].name, r),
        });
      }
    }

    return {
      pairs,
      strongPositive: pairs.filter(p => p.correlation > 0.7),
      strongNegative: pairs.filter(p => p.correlation < -0.7),
    };
  }

  /**
   * Pareto analysis (80/20 rule)
   */
  private paretoAnalysis(entities: ComparisonEntity[]): ParetoAnalysis {
    // Analyze persuadable voters
    const sorted = entities
      .map(e => ({
        entity: e,
        persuadable: e.targetingScores.persuasionOpportunity * e.demographics.registeredVoters / 100,
      }))
      .sort((a, b) => b.persuadable - a.persuadable);

    const total = sorted.reduce((sum, e) => sum + e.persuadable, 0);
    const top20Count = Math.ceil(sorted.length * 0.2);
    const top20Total = sorted.slice(0, top20Count).reduce((sum, e) => sum + e.persuadable, 0);
    const top20Pct = total > 0 ? (top20Total / total) * 100 : 0;

    return {
      metric: 'Persuadable Voters',
      top20Pct: Math.round(top20Pct),
      insight: `Top ${top20Count} entities (20%) contain ${Math.round(top20Pct)}% of persuadable voters`,
    };
  }

  // =====================================================================
  // STATISTICAL HELPERS
  // =====================================================================

  /**
   * Calculate mean
   */
  private mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Calculate median
   */
  private median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  /**
   * Calculate standard deviation
   */
  private stdDev(values: number[]): number {
    if (values.length === 0) return 0;
    const avg = this.mean(values);
    const squareDiffs = values.map(v => (v - avg) ** 2);
    return Math.sqrt(this.mean(squareDiffs));
  }

  /**
   * Pearson correlation coefficient
   */
  private pearsonCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length === 0) return 0;

    const n = x.length;
    const meanX = this.mean(x);
    const meanY = this.mean(y);

    let numerator = 0;
    let denomX = 0;
    let denomY = 0;

    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;
      numerator += dx * dy;
      denomX += dx * dx;
      denomY += dy * dy;
    }

    const denom = Math.sqrt(denomX * denomY);
    return denom === 0 ? 0 : numerator / denom;
  }

  /**
   * Interpret correlation for insights
   */
  private interpretCorrelation(metric1: string, metric2: string, r: number): string {
    if (Math.abs(r) < 0.3) return '';

    const strength = Math.abs(r) > 0.7 ? 'strongly' : 'moderately';
    const direction = r > 0 ? 'positively' : 'negatively';

    return `${metric1} is ${strength} ${direction} correlated with ${metric2}`;
  }
}
