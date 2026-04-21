/**
 * ConfidenceEngine - Calculates data confidence levels
 * Phase 14 Enhanced Implementation
 *
 * Assesses how reliable data points are based on:
 * - Data recency (how old is the data?)
 * - Sample size (how many elections/surveys?)
 * - Source reliability (official vs modeled?)
 * - Redistricting status (stable vs new boundaries?)
 * - Data completeness (all fields present?)
 */

import type {
  ConfidenceLevel,
  ConfidenceMetadata,
  ConfidenceFactors,
  ConfidenceEngineConfig,
  PrecinctConfidence,
  RedistrictingImpact,
} from './types';

import {
  DEFAULT_CONFIDENCE_CONFIG,
  CONFIDENCE_INDICATORS,
  CITATION_REGISTRY,
} from './types';

// Singleton instance
let confidenceEngineInstance: ConfidenceEngine | null = null;

/**
 * Get the ConfidenceEngine singleton
 */
export function getConfidenceEngine(): ConfidenceEngine {
  if (!confidenceEngineInstance) {
    confidenceEngineInstance = new ConfidenceEngine();
  }
  return confidenceEngineInstance;
}

/**
 * ConfidenceEngine class
 */
export class ConfidenceEngine {
  private config: ConfidenceEngineConfig;
  private redistrictingCache: Map<string, RedistrictingImpact> = new Map();

  constructor(config?: Partial<ConfidenceEngineConfig>) {
    this.config = { ...DEFAULT_CONFIDENCE_CONFIG, ...config };
  }

  // ============================================================================
  // Main Confidence Calculation
  // ============================================================================

  /**
   * Calculate confidence for a metric based on factors
   */
  calculateConfidence(factors: Partial<ConfidenceFactors>): ConfidenceMetadata {
    let score = 100; // Start at perfect confidence

    // Apply data recency factor
    if (factors.dataRecency !== undefined) {
      const recencyPenalty = factors.dataRecency * this.config.recencyDecayPerYear;
      score -= recencyPenalty * this.config.weights.dataRecency * 100;
    }

    // Apply sample size factor
    if (factors.sampleSize !== undefined) {
      let sampleScore = 100;
      if (factors.sampleSize < this.config.minSampleSizeForMedium) {
        sampleScore = 40; // Low confidence
      } else if (factors.sampleSize < this.config.minSampleSizeForHigh) {
        sampleScore = 70; // Medium confidence
      }
      score -= (100 - sampleScore) * this.config.weights.sampleSize;
    }

    // Apply source reliability factor
    if (factors.sourceReliability !== undefined) {
      score -= (1 - factors.sourceReliability) * this.config.weights.sourceReliability * 100;
    }

    // Apply redistricting status factor
    if (factors.redistrictingStatus !== undefined) {
      let redistrictingScore = 100;
      switch (factors.redistrictingStatus) {
        case 'stable':
          redistrictingScore = 100;
          break;
        case 'recent':
          redistrictingScore = 70;
          break;
        case 'new':
          redistrictingScore = 40;
          break;
      }
      score -= (100 - redistrictingScore) * this.config.weights.redistrictingStatus;
    }

    // Apply data completeness factor
    if (factors.dataCompleteness !== undefined) {
      score -= (1 - factors.dataCompleteness) * this.config.weights.dataCompleteness * 100;
    }

    // Clamp score to 0-100
    score = Math.max(0, Math.min(100, score));

    // Determine level from score
    const level = this.scoreToLevel(score);

    // Generate explanation
    const explanation = this.generateExplanation(factors, level, score);

    return {
      level,
      score: Math.round(score),
      factors,
      explanation,
      lastUpdated: new Date(),
    };
  }

  /**
   * Calculate confidence for partisan lean
   */
  calculatePartisanLeanConfidence(params: {
    electionCount: number;
    mostRecentYear: number;
    redistrictingStatus: 'stable' | 'recent' | 'new';
    marginVolatility?: number;  // Std dev of margins across elections
  }): ConfidenceMetadata {
    const currentYear = new Date().getFullYear();
    const factors: Partial<ConfidenceFactors> = {
      dataRecency: currentYear - params.mostRecentYear,
      sampleSize: params.electionCount,
      sourceReliability: CITATION_REGISTRY.ELECTIONS.reliability,
      redistrictingStatus: params.redistrictingStatus,
      dataCompleteness: 1.0, // Election data is complete
    };

    const confidence = this.calculateConfidence(factors);

    // Add range if volatility provided
    if (params.marginVolatility !== undefined) {
      confidence.range = {
        low: -params.marginVolatility * 1.5,
        high: params.marginVolatility * 1.5,
        unit: 'points',
      };
    }

    confidence.methodology = '/docs/methodology#partisan-lean';

    return confidence;
  }

  /**
   * Calculate confidence for swing potential
   */
  calculateSwingPotentialConfidence(params: {
    electionCount: number;
    mostRecentYear: number;
    redistrictingStatus: 'stable' | 'recent' | 'new';
    hasTicketSplittingData: boolean;
    hasDemographicData: boolean;
  }): ConfidenceMetadata {
    const currentYear = new Date().getFullYear();
    const completeness =
      (params.hasTicketSplittingData ? 0.5 : 0) + (params.hasDemographicData ? 0.5 : 0);

    const factors: Partial<ConfidenceFactors> = {
      dataRecency: currentYear - params.mostRecentYear,
      sampleSize: params.electionCount,
      sourceReliability: 0.85, // Calculated metric
      redistrictingStatus: params.redistrictingStatus,
      dataCompleteness: completeness,
    };

    const confidence = this.calculateConfidence(factors);
    confidence.methodology = '/docs/methodology#swing-potential';

    return confidence;
  }

  /**
   * Calculate confidence for GOTV priority
   */
  calculateGotvConfidence(params: {
    hasTurnoutHistory: boolean;
    hasPartisanData: boolean;
    hasDemographicData: boolean;
    turnoutElections: number;
    redistrictingStatus: 'stable' | 'recent' | 'new';
  }): ConfidenceMetadata {
    const completeness =
      (params.hasTurnoutHistory ? 0.4 : 0) +
      (params.hasPartisanData ? 0.3 : 0) +
      (params.hasDemographicData ? 0.3 : 0);

    const factors: Partial<ConfidenceFactors> = {
      dataRecency: 0, // Always current calculation
      sampleSize: params.turnoutElections,
      sourceReliability: 0.80, // Composite score
      redistrictingStatus: params.redistrictingStatus,
      dataCompleteness: completeness,
    };

    const confidence = this.calculateConfidence(factors);
    confidence.methodology = '/docs/methodology#gotv-priority';

    return confidence;
  }

  /**
   * Calculate confidence for demographic data
   */
  calculateDemographicConfidence(params: {
    acsVintage: string;  // e.g., "2019-2023"
    interpolated: boolean;
    blockGroupCoverage: number;  // 0-1, how much of precinct is covered
  }): ConfidenceMetadata {
    // Parse vintage to get end year
    const vintageMatch = params.acsVintage.match(/(\d{4})$/);
    const endYear = vintageMatch ? parseInt(vintageMatch[1]) : 2023;
    const currentYear = new Date().getFullYear();

    const factors: Partial<ConfidenceFactors> = {
      dataRecency: currentYear - endYear,
      sampleSize: 5, // 5-year estimates
      sourceReliability: params.interpolated ? 0.75 : 0.90, // Lower if interpolated
      redistrictingStatus: 'stable', // Demographics don't depend on precinct lines
      dataCompleteness: params.blockGroupCoverage,
    };

    const confidence = this.calculateConfidence(factors);

    if (params.interpolated) {
      confidence.explanation +=
        ' Note: Demographics were interpolated from block groups to precinct boundaries.';
    }

    return confidence;
  }

  // ============================================================================
  // Precinct-Level Assessment
  // ============================================================================

  /**
   * Get full confidence assessment for a precinct
   */
  assessPrecinctConfidence(params: {
    precinctId: string;
    electionYears: number[];
    redistrictingStatus: 'stable' | 'recent' | 'new';
    hasTicketSplitting: boolean;
    hasDemographics: boolean;
    hasTapestry: boolean;
    demographicVintage?: string;
    blockGroupCoverage?: number;
  }): PrecinctConfidence {
    const warnings: string[] = [];
    const currentYear = new Date().getFullYear();
    const mostRecentElection = Math.max(...params.electionYears);

    // Calculate individual metric confidences
    const partisanLean = this.calculatePartisanLeanConfidence({
      electionCount: params.electionYears.length,
      mostRecentYear: mostRecentElection,
      redistrictingStatus: params.redistrictingStatus,
    });

    const swingPotential = this.calculateSwingPotentialConfidence({
      electionCount: params.electionYears.length,
      mostRecentYear: mostRecentElection,
      redistrictingStatus: params.redistrictingStatus,
      hasTicketSplittingData: params.hasTicketSplitting,
      hasDemographicData: params.hasDemographics,
    });

    const gotvPriority = this.calculateGotvConfidence({
      hasTurnoutHistory: params.electionYears.length >= 2,
      hasPartisanData: true,
      hasDemographicData: params.hasDemographics,
      turnoutElections: params.electionYears.length,
      redistrictingStatus: params.redistrictingStatus,
    });

    let demographics: ConfidenceMetadata | undefined;
    if (params.hasDemographics) {
      demographics = this.calculateDemographicConfidence({
        acsVintage: params.demographicVintage || '2019-2023',
        interpolated: true,
        blockGroupCoverage: params.blockGroupCoverage || 0.9,
      });
    }

    // Generate warnings
    if (params.redistrictingStatus === 'new') {
      warnings.push(
        'This precinct was newly created in recent redistricting. Historical data is limited.'
      );
    }
    if (params.electionYears.length < 2) {
      warnings.push('Limited election history. Scores may be less reliable.');
    }
    if (currentYear - mostRecentElection > 2) {
      warnings.push(
        `Most recent election data is from ${mostRecentElection}. Consider that voter composition may have changed.`
      );
    }
    if (!params.hasDemographics) {
      warnings.push('Demographic data unavailable for this precinct.');
    }

    // Calculate overall confidence (weighted average)
    const metricScores = [
      partisanLean.score,
      swingPotential.score,
      gotvPriority.score,
    ];
    if (demographics) {
      metricScores.push(demographics.score);
    }
    const overallScore = metricScores.reduce((a, b) => a + b, 0) / metricScores.length;

    return {
      precinctId: params.precinctId,
      overall: this.scoreToLevel(overallScore),
      overallScore: Math.round(overallScore),
      metrics: {
        partisanLean,
        swingPotential,
        gotvPriority,
        demographics,
      },
      warnings,
      lastAssessed: new Date(),
    };
  }

  // ============================================================================
  // Formatting for AI Responses
  // ============================================================================

  /**
   * Format confidence for AI response
   */
  formatConfidenceForAI(confidence: ConfidenceMetadata, metricName: string): string {
    const indicator = CONFIDENCE_INDICATORS[confidence.level];

    let result = `${indicator.emoji} **${metricName}** (${indicator.label})`;

    if (confidence.range) {
      result += `\nRange: ${confidence.range.low.toFixed(1)} to ${confidence.range.high.toFixed(1)}${confidence.range.unit ? ` ${confidence.range.unit}` : ''}`;
    }

    result += `\n${confidence.explanation}`;

    if (confidence.methodology) {
      result += ` [View methodology](${confidence.methodology})`;
    }

    return result;
  }

  /**
   * Format precinct confidence summary
   */
  formatPrecinctConfidenceSummary(assessment: PrecinctConfidence): string {
    const indicator = CONFIDENCE_INDICATORS[assessment.overall];
    const parts: string[] = [];

    parts.push(`**Data Confidence**: ${indicator.emoji} ${indicator.label} (${assessment.overallScore}/100)`);

    if (assessment.warnings.length > 0) {
      parts.push('\n**⚠️ Data Notes:**');
      for (const warning of assessment.warnings) {
        parts.push(`- ${warning}`);
      }
    }

    return parts.join('\n');
  }

  /**
   * Get confidence badge for inline use
   */
  getConfidenceBadge(level: ConfidenceLevel): string {
    const indicator = CONFIDENCE_INDICATORS[level];
    return `${indicator.emoji}`;
  }

  /**
   * Format value with confidence
   */
  formatValueWithConfidence(
    value: number | string,
    confidence: ConfidenceMetadata,
    options?: {
      showRange?: boolean;
      showExplanation?: boolean;
      compact?: boolean;
    }
  ): string {
    const indicator = CONFIDENCE_INDICATORS[confidence.level];
    const opts = { showRange: false, showExplanation: false, compact: false, ...options };

    if (opts.compact) {
      return `${value} ${indicator.emoji}`;
    }

    let result = `**${value}** ${indicator.emoji}`;

    if (opts.showRange && confidence.range) {
      result += ` (range: ${confidence.range.low.toFixed(1)}–${confidence.range.high.toFixed(1)})`;
    }

    if (opts.showExplanation) {
      result += `\n_${confidence.explanation}_`;
    }

    return result;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private scoreToLevel(score: number): ConfidenceLevel {
    if (score >= this.config.thresholds.high) return 'high';
    if (score >= this.config.thresholds.medium) return 'medium';
    if (score >= this.config.thresholds.low) return 'low';
    return 'estimate';
  }

  private generateExplanation(
    factors: Partial<ConfidenceFactors>,
    level: ConfidenceLevel,
    score: number
  ): string {
    const parts: string[] = [];

    if (factors.sampleSize !== undefined) {
      if (factors.sampleSize >= this.config.minSampleSizeForHigh) {
        parts.push(`Based on ${factors.sampleSize} elections`);
      } else if (factors.sampleSize >= this.config.minSampleSizeForMedium) {
        parts.push(`Based on ${factors.sampleSize} elections (limited history)`);
      } else {
        parts.push(`Based on only ${factors.sampleSize} election(s)`);
      }
    }

    if (factors.redistrictingStatus === 'new') {
      parts.push('newly redistricted');
    } else if (factors.redistrictingStatus === 'recent') {
      parts.push('recently redistricted');
    }

    if (factors.dataRecency !== undefined && factors.dataRecency > 2) {
      parts.push(`data is ${factors.dataRecency} years old`);
    }

    if (factors.dataCompleteness !== undefined && factors.dataCompleteness < 0.8) {
      parts.push('some data unavailable');
    }

    if (parts.length === 0) {
      return CONFIDENCE_INDICATORS[level].description;
    }

    return parts.join(', ') + '.';
  }

  /**
   * Set redistricting status for a precinct
   */
  setRedistrictingImpact(impact: RedistrictingImpact): void {
    this.redistrictingCache.set(impact.precinctId, impact);
  }

  /**
   * Get redistricting impact for a precinct
   */
  getRedistrictingImpact(precinctId: string): RedistrictingImpact | undefined {
    return this.redistrictingCache.get(precinctId);
  }
}

export default ConfidenceEngine;
