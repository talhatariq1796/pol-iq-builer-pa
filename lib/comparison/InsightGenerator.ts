/**
 * Insight Generator for Political Landscape Analysis
 *
 * Generates human-readable insights from comparison results using
 * rule-based logic and strategic analysis.
 */

import type {
  ComparisonResult,
  MetricDifference,
  ComparisonEntity,
} from './types';

export class InsightGenerator {
  /**
   * Generate top 5-7 key insights from a comparison result
   */
  generateInsights(comparison: ComparisonResult): string[] {
    const insights: string[] = [];

    // Analyze demographics
    insights.push(...this.analyzeDemographics(comparison));

    // Analyze political profile
    insights.push(...this.analyzePoliticalProfile(comparison));

    // Analyze electoral performance
    insights.push(...this.analyzeElectoralPerformance(comparison));

    // Analyze targeting strategy
    insights.push(...this.analyzeTargetingStrategy(comparison));

    // Return top 7 most significant insights
    return insights.slice(0, 7);
  }

  /**
   * Generate strategic recommendations based on comparison
   */
  generateStrategicRecommendations(comparison: ComparisonResult): string[] {
    const recommendations: string[] = [];
    const { leftEntity, rightEntity, differences } = comparison;

    // Strategy divergence
    if (
      leftEntity.targetingScores.recommendedStrategy !==
      rightEntity.targetingScores.recommendedStrategy
    ) {
      recommendations.push(
        this.generateStrategyInsight(leftEntity, rightEntity)
      );
    }

    // Turnout opportunity
    const turnoutDiff = differences.politicalProfile.find(
      (d) => d.metricName === 'Avg Turnout Rate'
    );
    if (turnoutDiff && Math.abs(turnoutDiff.difference) > 10) {
      const lowerEntity =
        turnoutDiff.direction === 'left-higher' ? rightEntity : leftEntity;
      recommendations.push(
        `${lowerEntity.name} shows ${Math.abs(turnoutDiff.difference).toFixed(1)}% lower turnout - ` +
          `significant GOTV opportunity if base enthusiasm can be activated.`
      );
    }

    // Persuasion opportunity
    const persuasionDiff = differences.targeting.find(
      (d) => d.metricName === 'Persuasion Opportunity'
    );
    if (persuasionDiff && persuasionDiff.isSignificant) {
      const higherEntity =
        persuasionDiff.direction === 'left-higher' ? leftEntity : rightEntity;
      recommendations.push(
        `${higherEntity.name} has ${persuasionDiff.difference.toFixed(0)} points higher persuasion opportunity - ` +
          `prioritize voter contact and messaging campaigns here.`
      );
    }

    // Canvassing efficiency
    const canvassingDiff = differences.targeting.find(
      (d) => d.metricName === 'Canvassing Efficiency'
    );
    if (canvassingDiff && Math.abs(canvassingDiff.difference) > 10) {
      const moreEfficient =
        canvassingDiff.direction === 'left-higher' ? leftEntity : rightEntity;
      const lessEfficient =
        canvassingDiff.direction === 'left-higher' ? rightEntity : leftEntity;
      recommendations.push(
        `${moreEfficient.name} offers ${Math.abs(canvassingDiff.difference).toFixed(0)} more doors/hour ` +
          `than ${lessEfficient.name} - allocate ground game resources accordingly.`
      );
    }

    return recommendations;
  }

  /**
   * Analyze demographic differences
   */
  private analyzeDemographics(comparison: ComparisonResult): string[] {
    const insights: string[] = [];
    const { leftEntity, rightEntity, differences } = comparison;

    // Age difference
    const ageDiff = differences.demographics.find((d) => d.metricName === 'Median Age');
    if (ageDiff && Math.abs(ageDiff.difference) > 5) {
      const younger = ageDiff.direction === 'left-higher' ? rightEntity : leftEntity;
      const older = ageDiff.direction === 'left-higher' ? leftEntity : rightEntity;
      insights.push(
        `${younger.name} is notably younger (median age ${younger.demographics.medianAge.toFixed(1)}) ` +
          `than ${older.name} (${older.demographics.medianAge.toFixed(1)}) - ` +
          `messaging should reflect different generational priorities.`
      );
    }

    // Income difference
    const incomeDiff = differences.demographics.find((d) => d.metricName === 'Median Income');
    if (incomeDiff && incomeDiff.isSignificant) {
      const narrative = this.narrateDifference(
        incomeDiff,
        leftEntity.name,
        rightEntity.name,
        'median income'
      );
      insights.push(
        narrative +
          ' - tailor economic messaging to different income concerns (tax policy, wages, etc.).'
      );
    }

    // Education difference
    const eduDiff = differences.demographics.find(
      (d) => d.metricName === 'College Degree %'
    );
    if (eduDiff && Math.abs(eduDiff.difference) > 15) {
      const moreEducated = eduDiff.direction === 'left-higher' ? leftEntity : rightEntity;
      insights.push(
        `${moreEducated.name} has ${Math.abs(eduDiff.difference).toFixed(1)}% more college graduates - ` +
          `policy-focused messaging may resonate better than emotional appeals.`
      );
    }

    // Racial composition
    const whiteDiff = differences.demographics.find((d) => d.metricName === 'White %');
    const blackDiff = differences.demographics.find((d) => d.metricName === 'Black %');
    if (
      whiteDiff &&
      blackDiff &&
      (Math.abs(whiteDiff.difference) > 20 || Math.abs(blackDiff.difference) > 15)
    ) {
      insights.push(
        `Significant demographic diversity differences exist - cultural competency ` +
          `and representation in campaign materials should be tailored accordingly.`
      );
    }

    return insights;
  }

  /**
   * Analyze political profile differences
   */
  private analyzePoliticalProfile(comparison: ComparisonResult): string[] {
    const insights: string[] = [];
    const { leftEntity, rightEntity, differences } = comparison;

    // Partisan lean difference
    const leanDiff = differences.politicalProfile.find(
      (d) => d.metricName === 'Partisan Lean'
    );
    if (leanDiff && Math.abs(leanDiff.difference) > 10) {
      const moreDem = leanDiff.direction === 'left-higher' ? leftEntity : rightEntity;
      const moreRep = leanDiff.direction === 'left-higher' ? rightEntity : leftEntity;
      insights.push(
        `${moreDem.name} (${moreDem.politicalProfile.competitiveness}) leans ` +
          `${Math.abs(leanDiff.difference).toFixed(0)} points more Democratic than ` +
          `${moreRep.name} (${moreRep.politicalProfile.competitiveness}) - ` +
          `fundamentally different electorates requiring distinct approaches.`
      );
    }

    // Swing potential difference
    const swingDiff = differences.politicalProfile.find(
      (d) => d.metricName === 'Swing Potential'
    );
    if (swingDiff && Math.abs(swingDiff.difference) > 15) {
      const moreSwing = swingDiff.direction === 'left-higher' ? leftEntity : rightEntity;
      const lessSwing = swingDiff.direction === 'left-higher' ? rightEntity : leftEntity;
      insights.push(
        `${moreSwing.name} shows ${Math.abs(swingDiff.difference).toFixed(0)} points higher swing potential ` +
          `than ${lessSwing.name} - persuasion campaigns will have greater ROI here.`
      );
    }

    // Competitiveness comparison
    if (
      leftEntity.politicalProfile.competitiveness === 'tossup' ||
      rightEntity.politicalProfile.competitiveness === 'tossup'
    ) {
      const tossup =
        leftEntity.politicalProfile.competitiveness === 'tossup'
          ? leftEntity
          : rightEntity;
      insights.push(
        `${tossup.name} is a genuine tossup race - every vote matters and both GOTV ` +
          `and persuasion efforts are critical here.`
      );
    }

    return insights;
  }

  /**
   * Analyze electoral performance differences
   */
  private analyzeElectoralPerformance(comparison: ComparisonResult): string[] {
    const insights: string[] = [];
    const { leftEntity, rightEntity, differences } = comparison;

    // Margin of victory comparison
    const marginDiff = differences.electoral.find(
      (d) => d.metricName === 'Margin of Victory'
    );
    if (marginDiff && marginDiff.isSignificant) {
      const closer = marginDiff.direction === 'left-higher' ? rightEntity : leftEntity;
      insights.push(
        `${closer.name} had a ${closer.electoral.marginOfVictory.toFixed(1)}pt margin in ` +
          `${closer.electoral.lastElectionYear} - narrow enough to flip with targeted effort.`
      );
    }

    // Vote share trends
    const demShareDiff = differences.electoral.find(
      (d) => d.metricName === 'Dem Vote Share'
    );
    if (demShareDiff && Math.abs(demShareDiff.difference) > 15) {
      insights.push(
        `Democratic performance varies by ${Math.abs(demShareDiff.difference).toFixed(1)}% ` +
          `between these areas - indicates different coalition compositions.`
      );
    }

    // Historical trends (if election history available)
    const leftTrend = this.detectTrend(leftEntity.electionHistory);
    const rightTrend = this.detectTrend(rightEntity.electionHistory);
    if (leftTrend !== rightTrend) {
      if (leftTrend === 'bluing') {
        insights.push(
          `${leftEntity.name} is trending Democratic while ${rightEntity.name} is ${rightTrend === 'reddening' ? 'trending Republican' : 'stable'} - ` +
            `demographic and political shifts are diverging.`
        );
      } else if (rightTrend === 'bluing') {
        insights.push(
          `${rightEntity.name} is trending Democratic while ${leftEntity.name} is ${leftTrend === 'reddening' ? 'trending Republican' : 'stable'} - ` +
            `demographic and political shifts are diverging.`
        );
      }
    }

    return insights;
  }

  /**
   * Analyze targeting strategy differences
   */
  private analyzeTargetingStrategy(comparison: ComparisonResult): string[] {
    const insights: string[] = [];
    const { leftEntity, rightEntity, differences } = comparison;

    // GOTV priority difference
    const gotvDiff = differences.targeting.find((d) => d.metricName === 'GOTV Priority');
    if (gotvDiff && gotvDiff.isSignificant) {
      const higherGOTV = gotvDiff.direction === 'left-higher' ? leftEntity : rightEntity;
      insights.push(
        `${higherGOTV.name} ranks ${Math.abs(gotvDiff.difference).toFixed(0)} points higher ` +
          `for GOTV priority - base turnout operations should focus here.`
      );
    }

    // Strategy recommendations
    if (
      leftEntity.targetingScores.recommendedStrategy !==
      rightEntity.targetingScores.recommendedStrategy
    ) {
      insights.push(this.generateStrategyInsight(leftEntity, rightEntity));
    }

    return insights;
  }

  /**
   * Generate strategy divergence insight
   */
  generateStrategyInsight(left: ComparisonEntity, right: ComparisonEntity): string {
    const strategies = {
      Battleground:
        'requires balanced persuasion and turnout with heavy field presence',
      'Base Mobilization': 'should focus on GOTV and base enthusiasm',
      'Persuasion Target': 'needs messaging-heavy persuasion campaigns',
      'Low Priority': 'can receive minimal resource allocation',
    };

    return (
      `Strategic divergence: ${left.name} (${left.targetingScores.recommendedStrategy}) ` +
      `${strategies[left.targetingScores.recommendedStrategy]}, while ` +
      `${right.name} (${right.targetingScores.recommendedStrategy}) ` +
      `${strategies[right.targetingScores.recommendedStrategy]}.`
    );
  }

  /**
   * Convert metric difference to narrative sentence
   */
  private narrateDifference(
    diff: MetricDifference,
    leftName: string,
    rightName: string,
    metricLabel: string
  ): string {
    const higherEntity = diff.direction === 'left-higher' ? leftName : rightName;
    const lowerEntity = diff.direction === 'left-higher' ? rightName : leftName;
    const amount = Math.abs(diff.difference);

    let formattedAmount: string;
    if (diff.formatType === 'currency') {
      formattedAmount = `$${amount.toLocaleString()}`;
    } else if (diff.formatType === 'percent') {
      formattedAmount = `${amount.toFixed(1)}%`;
    } else if (diff.formatType === 'points') {
      formattedAmount = `${amount.toFixed(1)} points`;
    } else {
      formattedAmount = amount.toFixed(0);
    }

    return (
      `${higherEntity} has ${formattedAmount} higher ${metricLabel} than ${lowerEntity} ` +
      `(${Math.abs(diff.percentDiff).toFixed(0)}% difference)`
    );
  }

  /**
   * Detect electoral trend from election history
   */
  private detectTrend(
    history: Array<{ year: number; demPct: number; repPct: number }>
  ): 'bluing' | 'reddening' | 'stable' {
    if (history.length < 2) return 'stable';

    const sorted = [...history].sort((a, b) => a.year - b.year);
    const oldestMargin = sorted[0].demPct - sorted[0].repPct;
    const newestMargin = sorted[sorted.length - 1].demPct - sorted[sorted.length - 1].repPct;
    const shift = newestMargin - oldestMargin;

    if (shift > 5) return 'bluing';
    if (shift < -5) return 'reddening';
    return 'stable';
  }
}
