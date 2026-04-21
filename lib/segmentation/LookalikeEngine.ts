/**
 * LookalikeEngine.ts
 *
 * Finds similar precincts based on multi-dimensional profiles using
 * various similarity algorithms (Euclidean, Cosine, Mahalanobis).
 *
 * Use cases:
 * - Expand targeting universes by finding similar precincts
 * - Discover untapped opportunities in similar demographics
 * - Test messaging strategies in lookalike precincts
 */

import type {
  PrecinctData,
  LookalikeProfile,
  LookalikeResults,
  LookalikeMatch,
  SegmentResults,
  DensityType,
  CompetitivenessType,
} from './types';

// ============================================================================
// Internal Types
// ============================================================================

/**
 * Normalized feature vector for similarity comparison
 */
interface PrecinctFeatures {
  precinctId: string;
  precinctName: string;
  jurisdiction: string;

  // Normalized features (0-1 scale) for similarity calculation
  demographics: {
    age: number;
    income: number;
    college: number;
    homeowner: number;
    density: number; // Urban=1, Suburban=0.5, Rural=0
  };
  political: {
    lean: number; // -1 to +1 (normalized from -100 to +100)
    demPct: number;
    moderate: number;
  };
  electoral: {
    turnout: number;
    swing: number;
    dropoff: number;
  };
  tapestry?: {
    segment: string;
    diversity: number;
  };
  engagement?: {
    donor: number;
    social: number;
  };

  // Raw values for display and difference analysis
  rawValues: {
    medianAge: number;
    medianIncome: number;
    collegePct: number;
    homeownerPct: number;
    partisanLean: number;
    demAffiliationPct: number;
    moderatePct: number;
    turnout: number;
    swingPotential: number;
    turnoutDropoff: number;
    donorPct?: number;
    socialMediaPct?: number;
  };
}

/**
 * Feature statistics for normalization
 */
interface FeatureStats {
  min: Record<string, number>;
  max: Record<string, number>;
  mean: Record<string, number>;
  std: Record<string, number>;
}

// ============================================================================
// LookalikeEngine Class
// ============================================================================

export class LookalikeEngine {
  private precinctFeatures: Map<string, PrecinctFeatures>;
  private featureStats: FeatureStats;

  constructor(precincts: PrecinctData[]) {
    this.precinctFeatures = new Map();
    this.featureStats = this.computeFeatureStats(precincts);

    // Normalize all precincts
    for (const precinct of precincts) {
      const features = this.normalizeFeatures(precinct);
      this.precinctFeatures.set(precinct.id, features);
    }
  }

  /**
   * Build reference profile from source configuration
   */
  buildReferenceProfile(profile: LookalikeProfile): PrecinctFeatures {
    // Single precinct source
    if (profile.sourcePrecinct) {
      const features = this.precinctFeatures.get(profile.sourcePrecinct);
      if (!features) {
        throw new Error(`Source precinct not found: ${profile.sourcePrecinct}`);
      }
      return features;
    }

    // Multiple precincts (average profile)
    if (profile.sourcePrecincts && profile.sourcePrecincts.length > 0) {
      return this.averageFeatures(profile.sourcePrecincts);
    }

    // Segment source
    if (profile.sourceSegment) {
      const precinctIds = profile.sourceSegment.matchingPrecincts.map((p) => p.precinctId);
      return this.averageFeatures(precinctIds);
    }

    // Manual profile
    if (profile.manualProfile) {
      return this.buildManualProfile(profile.manualProfile);
    }

    throw new Error('No valid source specified for lookalike profile');
  }

  /**
   * Find similar precincts based on profile
   */
  findLookalikes(profile: LookalikeProfile): LookalikeResults {
    const referenceProfile = this.buildReferenceProfile(profile);
    const weights = this.getFeatureWeights(profile.featureWeights);

    const matches: LookalikeMatch[] = [];

    // Calculate similarity for each precinct
    for (const [precinctId, features] of this.precinctFeatures) {
      // Skip if excluded
      if (profile.excludeSources && this.isSourcePrecinct(precinctId, profile)) {
        continue;
      }

      // Apply geographic filters
      if (profile.withinMunicipality && features.jurisdiction !== profile.withinMunicipality) {
        continue;
      }

      // Calculate overall similarity
      let similarityScore: number;
      switch (profile.algorithm) {
        case 'euclidean':
          similarityScore = this.calculateEuclideanSimilarity(referenceProfile, features, weights);
          break;
        case 'cosine':
          similarityScore = this.calculateCosineSimilarity(referenceProfile, features, weights);
          break;
        case 'mahalanobis':
          similarityScore = this.calculateMahalanobisSimilarity(referenceProfile, features, weights);
          break;
        default:
          similarityScore = this.calculateEuclideanSimilarity(referenceProfile, features, weights);
      }

      // Filter by minimum score
      if (profile.minSimilarityScore && similarityScore < profile.minSimilarityScore) {
        continue;
      }

      // Calculate feature-level similarities
      const demographicSimilarity = this.calculateFeatureSimilarity(
        referenceProfile.demographics,
        features.demographics
      );
      const politicalSimilarity = this.calculateFeatureSimilarity(
        referenceProfile.political,
        features.political
      );
      const electoralSimilarity = this.calculateFeatureSimilarity(
        referenceProfile.electoral,
        features.electoral
      );

      const tapestrySimilarity =
        referenceProfile.tapestry && features.tapestry
          ? referenceProfile.tapestry.segment === features.tapestry.segment
            ? 100
            : 50
          : 50;

      const engagementSimilarity =
        referenceProfile.engagement && features.engagement
          ? this.calculateFeatureSimilarity(referenceProfile.engagement, features.engagement)
          : 50;

      // Analyze top differences
      const topDifferences = this.analyzeTopDifferences(referenceProfile, features);

      matches.push({
        precinctId: features.precinctId,
        precinctName: features.precinctName,
        jurisdiction: features.jurisdiction,
        similarityScore,
        demographicSimilarity,
        politicalSimilarity,
        electoralSimilarity,
        tapestrySimilarity,
        engagementSimilarity,
        topDifferences,
      });
    }

    // Sort by similarity score (descending)
    matches.sort((a, b) => b.similarityScore - a.similarityScore);

    // Apply maxResults limit
    const limitedMatches = profile.maxResults ? matches.slice(0, profile.maxResults) : matches;

    // Build reference profile summary
    const referenceProfileSummary = {
      name: profile.sourcePrecinct
        ? referenceProfile.precinctName
        : profile.sourcePrecincts
          ? `${profile.sourcePrecincts.length} precincts`
          : profile.sourceSegment
            ? 'Segment'
            : 'Manual profile',
      precinctCount: profile.sourcePrecincts?.length || 1,
      avgAge: referenceProfile.rawValues.medianAge,
      avgIncome: referenceProfile.rawValues.medianIncome,
      avgPartisanLean: referenceProfile.rawValues.partisanLean,
    };

    const avgSimilarityScore =
      limitedMatches.length > 0
        ? limitedMatches.reduce((sum, m) => sum + m.similarityScore, 0) / limitedMatches.length
        : 0;

    return {
      matches: limitedMatches,
      referenceProfile: referenceProfileSummary,
      avgSimilarityScore,
      algorithm: profile.algorithm,
      featureWeights: weights,
      computedAt: new Date().toISOString(),
    };
  }

  // ==========================================================================
  // Similarity Algorithms
  // ==========================================================================

  /**
   * Euclidean distance similarity (0-100 scale)
   * Good for continuous features with similar scales
   */
  private calculateEuclideanSimilarity(
    ref: PrecinctFeatures,
    target: PrecinctFeatures,
    weights: Record<string, number>
  ): number {
    let sumSquaredDiff = 0;
    let totalWeight = 0;

    // Demographics
    if (weights.demographics) {
      const demoDiff = this.calculateFeatureDistance(ref.demographics, target.demographics);
      sumSquaredDiff += Math.pow(demoDiff, 2) * weights.demographics;
      totalWeight += weights.demographics;
    }

    // Political
    if (weights.political) {
      const politicalDiff = this.calculateFeatureDistance(ref.political, target.political);
      sumSquaredDiff += Math.pow(politicalDiff, 2) * weights.political;
      totalWeight += weights.political;
    }

    // Electoral
    if (weights.electoral) {
      const electoralDiff = this.calculateFeatureDistance(ref.electoral, target.electoral);
      sumSquaredDiff += Math.pow(electoralDiff, 2) * weights.electoral;
      totalWeight += weights.electoral;
    }

    // Engagement
    if (weights.engagement && ref.engagement && target.engagement) {
      const engagementDiff = this.calculateFeatureDistance(ref.engagement, target.engagement);
      sumSquaredDiff += Math.pow(engagementDiff, 2) * weights.engagement;
      totalWeight += weights.engagement;
    }

    const euclideanDistance = Math.sqrt(sumSquaredDiff / totalWeight);

    // Convert distance to similarity (0-100 scale)
    // Assuming max distance is ~1.0 for normalized features
    return Math.max(0, Math.min(100, (1 - euclideanDistance) * 100));
  }

  /**
   * Cosine similarity (0-100 scale)
   * Good for comparing direction/pattern regardless of magnitude
   */
  private calculateCosineSimilarity(
    ref: PrecinctFeatures,
    target: PrecinctFeatures,
    weights: Record<string, number>
  ): number {
    const refVector = this.buildFeatureVector(ref, weights);
    const targetVector = this.buildFeatureVector(target, weights);

    const dotProduct = refVector.reduce((sum, val, i) => sum + val * targetVector[i], 0);
    const refMagnitude = Math.sqrt(refVector.reduce((sum, val) => sum + val * val, 0));
    const targetMagnitude = Math.sqrt(targetVector.reduce((sum, val) => sum + val * val, 0));

    if (refMagnitude === 0 || targetMagnitude === 0) {
      return 0;
    }

    const cosineSimilarity = dotProduct / (refMagnitude * targetMagnitude);

    // Convert to 0-100 scale (cosine ranges from -1 to 1)
    return ((cosineSimilarity + 1) / 2) * 100;
  }

  /**
   * Mahalanobis distance similarity (0-100 scale)
   * Good for accounting for feature correlations
   *
   * Simplified version without full covariance matrix
   */
  private calculateMahalanobisSimilarity(
    ref: PrecinctFeatures,
    target: PrecinctFeatures,
    weights: Record<string, number>
  ): number {
    // Simplified Mahalanobis using feature standard deviations
    let sumNormalizedSquaredDiff = 0;
    let totalWeight = 0;

    const addFeatureDiff = (
      refFeatures: Record<string, number>,
      targetFeatures: Record<string, number>,
      weight: number,
      prefix: string
    ) => {
      for (const key of Object.keys(refFeatures)) {
        const featureKey = `${prefix}_${key}`;
        const std = this.featureStats.std[featureKey] || 1;
        const diff = refFeatures[key] - targetFeatures[key];
        sumNormalizedSquaredDiff += Math.pow(diff / std, 2) * weight;
      }
      totalWeight += weight * Object.keys(refFeatures).length;
    };

    if (weights.demographics) {
      addFeatureDiff(ref.demographics, target.demographics, weights.demographics, 'demo');
    }
    if (weights.political) {
      addFeatureDiff(ref.political, target.political, weights.political, 'political');
    }
    if (weights.electoral) {
      addFeatureDiff(ref.electoral, target.electoral, weights.electoral, 'electoral');
    }
    if (weights.engagement && ref.engagement && target.engagement) {
      addFeatureDiff(ref.engagement, target.engagement, weights.engagement, 'engagement');
    }

    const mahalanobisDistance = Math.sqrt(sumNormalizedSquaredDiff / totalWeight);

    // Convert to similarity (0-100 scale)
    return Math.max(0, Math.min(100, (1 - Math.min(mahalanobisDistance, 1)) * 100));
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * Calculate distance between two feature objects
   */
  private calculateFeatureDistance(
    features1: Record<string, number>,
    features2: Record<string, number>
  ): number {
    const keys = Object.keys(features1);
    const sumSquaredDiff = keys.reduce((sum, key) => {
      const diff = features1[key] - features2[key];
      return sum + diff * diff;
    }, 0);
    return Math.sqrt(sumSquaredDiff / keys.length);
  }

  /**
   * Calculate similarity percentage between feature objects
   */
  private calculateFeatureSimilarity(
    features1: Record<string, number>,
    features2: Record<string, number>
  ): number {
    const distance = this.calculateFeatureDistance(features1, features2);
    return Math.max(0, Math.min(100, (1 - distance) * 100));
  }

  /**
   * Build weighted feature vector for cosine similarity
   */
  private buildFeatureVector(features: PrecinctFeatures, weights: Record<string, number>): number[] {
    const vector: number[] = [];

    if (weights.demographics) {
      Object.values(features.demographics).forEach((val) => {
        vector.push(val * Math.sqrt(weights.demographics || 0));
      });
    }

    if (weights.political) {
      Object.values(features.political).forEach((val) => {
        vector.push(val * Math.sqrt(weights.political || 0));
      });
    }

    if (weights.electoral) {
      Object.values(features.electoral).forEach((val) => {
        vector.push(val * Math.sqrt(weights.electoral || 0));
      });
    }

    if (weights.engagement && features.engagement) {
      Object.values(features.engagement).forEach((val) => {
        vector.push(val * Math.sqrt(weights.engagement || 0));
      });
    }

    return vector;
  }

  /**
   * Analyze top differences between reference and match
   */
  private analyzeTopDifferences(
    ref: PrecinctFeatures,
    match: PrecinctFeatures
  ): Array<{
    feature: string;
    referenceValue: number;
    matchValue: number;
    difference: number;
    direction: 'higher' | 'lower';
  }> {
    const differences: Array<{
      feature: string;
      referenceValue: number;
      matchValue: number;
      difference: number;
      direction: 'higher' | 'lower';
    }> = [];

    const addDifference = (
      feature: string,
      refValue: number,
      matchValue: number,
      isPercentage = false
    ) => {
      const diff = Math.abs(refValue - matchValue);
      differences.push({
        feature,
        referenceValue: isPercentage ? refValue : Math.round(refValue),
        matchValue: isPercentage ? matchValue : Math.round(matchValue),
        difference: isPercentage ? parseFloat(diff.toFixed(1)) : Math.round(diff),
        direction: matchValue > refValue ? 'higher' : 'lower',
      });
    };

    addDifference('Median Age', ref.rawValues.medianAge, match.rawValues.medianAge);
    addDifference('Median Income', ref.rawValues.medianIncome, match.rawValues.medianIncome);
    addDifference('College %', ref.rawValues.collegePct, match.rawValues.collegePct, true);
    addDifference('Homeowner %', ref.rawValues.homeownerPct, match.rawValues.homeownerPct, true);
    addDifference('Partisan Lean', ref.rawValues.partisanLean, match.rawValues.partisanLean);
    addDifference('Dem Affiliation %', ref.rawValues.demAffiliationPct, match.rawValues.demAffiliationPct, true);
    addDifference('Turnout %', ref.rawValues.turnout, match.rawValues.turnout, true);
    addDifference('Swing Potential', ref.rawValues.swingPotential, match.rawValues.swingPotential);

    // Sort by absolute difference
    differences.sort((a, b) => b.difference - a.difference);

    // Return top 5
    return differences.slice(0, 5);
  }

  /**
   * Average features from multiple precincts
   */
  private averageFeatures(precinctIds: string[]): PrecinctFeatures {
    const featuresList = precinctIds
      .map((id) => this.precinctFeatures.get(id))
      .filter((f): f is PrecinctFeatures => f !== undefined);

    if (featuresList.length === 0) {
      throw new Error('No valid precincts found for averaging');
    }

    const avgFeatures: PrecinctFeatures = {
      precinctId: 'averaged-profile',
      precinctName: `Average of ${featuresList.length} precincts`,
      jurisdiction: featuresList[0].jurisdiction,
      demographics: {
        age: 0,
        income: 0,
        college: 0,
        homeowner: 0,
        density: 0,
      },
      political: {
        lean: 0,
        demPct: 0,
        moderate: 0,
      },
      electoral: {
        turnout: 0,
        swing: 0,
        dropoff: 0,
      },
      rawValues: {
        medianAge: 0,
        medianIncome: 0,
        collegePct: 0,
        homeownerPct: 0,
        partisanLean: 0,
        demAffiliationPct: 0,
        moderatePct: 0,
        turnout: 0,
        swingPotential: 0,
        turnoutDropoff: 0,
      },
    };

    // Average all numeric fields
    for (const features of featuresList) {
      avgFeatures.demographics.age += features.demographics.age;
      avgFeatures.demographics.income += features.demographics.income;
      avgFeatures.demographics.college += features.demographics.college;
      avgFeatures.demographics.homeowner += features.demographics.homeowner;
      avgFeatures.demographics.density += features.demographics.density;

      avgFeatures.political.lean += features.political.lean;
      avgFeatures.political.demPct += features.political.demPct;
      avgFeatures.political.moderate += features.political.moderate;

      avgFeatures.electoral.turnout += features.electoral.turnout;
      avgFeatures.electoral.swing += features.electoral.swing;
      avgFeatures.electoral.dropoff += features.electoral.dropoff;

      avgFeatures.rawValues.medianAge += features.rawValues.medianAge;
      avgFeatures.rawValues.medianIncome += features.rawValues.medianIncome;
      avgFeatures.rawValues.collegePct += features.rawValues.collegePct;
      avgFeatures.rawValues.homeownerPct += features.rawValues.homeownerPct;
      avgFeatures.rawValues.partisanLean += features.rawValues.partisanLean;
      avgFeatures.rawValues.demAffiliationPct += features.rawValues.demAffiliationPct;
      avgFeatures.rawValues.moderatePct += features.rawValues.moderatePct;
      avgFeatures.rawValues.turnout += features.rawValues.turnout;
      avgFeatures.rawValues.swingPotential += features.rawValues.swingPotential;
      avgFeatures.rawValues.turnoutDropoff += features.rawValues.turnoutDropoff;
    }

    const count = featuresList.length;
    avgFeatures.demographics.age /= count;
    avgFeatures.demographics.income /= count;
    avgFeatures.demographics.college /= count;
    avgFeatures.demographics.homeowner /= count;
    avgFeatures.demographics.density /= count;

    avgFeatures.political.lean /= count;
    avgFeatures.political.demPct /= count;
    avgFeatures.political.moderate /= count;

    avgFeatures.electoral.turnout /= count;
    avgFeatures.electoral.swing /= count;
    avgFeatures.electoral.dropoff /= count;

    avgFeatures.rawValues.medianAge /= count;
    avgFeatures.rawValues.medianIncome /= count;
    avgFeatures.rawValues.collegePct /= count;
    avgFeatures.rawValues.homeownerPct /= count;
    avgFeatures.rawValues.partisanLean /= count;
    avgFeatures.rawValues.demAffiliationPct /= count;
    avgFeatures.rawValues.moderatePct /= count;
    avgFeatures.rawValues.turnout /= count;
    avgFeatures.rawValues.swingPotential /= count;
    avgFeatures.rawValues.turnoutDropoff /= count;

    return avgFeatures;
  }

  /**
   * Build features from manual profile
   */
  private buildManualProfile(manual: LookalikeProfile['manualProfile']): PrecinctFeatures {
    if (!manual) {
      throw new Error('Manual profile is undefined');
    }

    const demographics = manual.demographics || {};
    const political = manual.political || {};

    return {
      precinctId: 'manual-profile',
      precinctName: 'Manual Profile',
      jurisdiction: 'N/A',
      demographics: {
        age: this.normalizeValue(demographics.medianAge || 45, 20, 75),
        income: this.normalizeValue(demographics.medianIncome || 60000, 20000, 150000),
        college: (demographics.collegePct || 30) / 100,
        homeowner: (demographics.homeownerPct || 65) / 100,
        density: this.normalizeDensity(demographics.density || 'suburban'),
      },
      political: {
        lean: ((political.partisanLean || 0) + 100) / 200, // -100 to +100 → 0 to 1
        demPct: (political.demAffiliationPct || 40) / 100,
        moderate: 0.33, // Default moderate
      },
      electoral: {
        turnout: 0.65, // Default 65%
        swing: 0.5, // Default 50
        dropoff: 0.15, // Default 15%
      },
      rawValues: {
        medianAge: demographics.medianAge || 45,
        medianIncome: demographics.medianIncome || 60000,
        collegePct: demographics.collegePct || 30,
        homeownerPct: demographics.homeownerPct || 65,
        partisanLean: political.partisanLean || 0,
        demAffiliationPct: political.demAffiliationPct || 40,
        moderatePct: 33,
        turnout: 65,
        swingPotential: 50,
        turnoutDropoff: 15,
      },
    };
  }

  /**
   * Check if precinct is a source precinct
   */
  private isSourcePrecinct(precinctId: string, profile: LookalikeProfile): boolean {
    if (profile.sourcePrecinct === precinctId) return true;
    if (profile.sourcePrecincts?.includes(precinctId)) return true;
    if (profile.sourceSegment?.matchingPrecincts.some((p) => p.precinctId === precinctId))
      return true;
    return false;
  }

  /**
   * Get feature weights with defaults
   */
  private getFeatureWeights(
    weights?: LookalikeProfile['featureWeights']
  ): Record<string, number> {
    return {
      demographics: weights?.demographics ?? 0.3,
      political: weights?.political ?? 0.25,
      electoral: weights?.electoral ?? 0.2,
      tapestry: weights?.tapestry ?? 0.15,
      engagement: weights?.engagement ?? 0.1,
    };
  }

  // ==========================================================================
  // Feature Normalization
  // ==========================================================================

  /**
   * Normalize precinct data to 0-1 scale
   */
  private normalizeFeatures(precinct: PrecinctData): PrecinctFeatures {
    const medianAge = precinct.demographics.median_age || precinct.demographics.medianAge;
    const medianIncome =
      precinct.demographics.median_household_income || precinct.demographics.medianHHI;
    const collegePct = precinct.demographics.collegePct;
    const homeownerPct = precinct.demographics.homeownerPct;

    const partisanLean = precinct.electoral.partisan_lean ?? precinct.electoral.partisanLean;
    const swingPotential = precinct.electoral.swing_potential ?? precinct.electoral.swingPotential;
    const avgTurnout = precinct.electoral.avgTurnout;
    const turnoutDropoff = precinct.electoral.turnoutDropoff;

    const demAffiliationPct = precinct.political.demAffiliationPct;
    const moderatePct = precinct.political.moderatePct;

    const density = this.getDensityFromPopulation(
      precinct.demographics.population_density || precinct.demographics.populationDensity || 0
    );

    return {
      precinctId: precinct.id,
      precinctName: precinct.name,
      jurisdiction: precinct.jurisdiction.name,
      demographics: {
        age: this.normalizeValue(medianAge, 20, 75),
        income: this.normalizeValue(medianIncome, 20000, 150000),
        college: collegePct / 100,
        homeowner: homeownerPct / 100,
        density: this.normalizeDensity(density),
      },
      political: {
        lean: (partisanLean + 100) / 200, // -100 to +100 → 0 to 1
        demPct: demAffiliationPct / 100,
        moderate: moderatePct / 100,
      },
      electoral: {
        turnout: avgTurnout / 100,
        swing: swingPotential / 100,
        dropoff: turnoutDropoff / 100,
      },
      engagement: precinct.engagement
        ? {
            donor: precinct.engagement.politicalDonorPct / 100,
            social: precinct.engagement.socialMediaPct / 100,
          }
        : undefined,
      rawValues: {
        medianAge,
        medianIncome,
        collegePct,
        homeownerPct,
        partisanLean,
        demAffiliationPct,
        moderatePct,
        turnout: avgTurnout,
        swingPotential,
        turnoutDropoff,
        donorPct: precinct.engagement?.politicalDonorPct,
        socialMediaPct: precinct.engagement?.socialMediaPct,
      },
    };
  }

  /**
   * Normalize value to 0-1 range
   */
  private normalizeValue(value: number, min: number, max: number): number {
    return Math.max(0, Math.min(1, (value - min) / (max - min)));
  }

  /**
   * Convert density type to numeric 0-1 scale
   */
  private normalizeDensity(density: DensityType): number {
    switch (density) {
      case 'urban':
        return 1;
      case 'suburban':
        return 0.5;
      case 'rural':
        return 0;
      default:
        return 0.5;
    }
  }

  /**
   * Infer density from population density
   */
  private getDensityFromPopulation(popDensity: number): DensityType {
    if (popDensity > 2000) return 'urban';
    if (popDensity > 500) return 'suburban';
    return 'rural';
  }

  /**
   * Compute feature statistics for normalization
   */
  private computeFeatureStats(precincts: PrecinctData[]): FeatureStats {
    const stats: FeatureStats = {
      min: {},
      max: {},
      mean: {},
      std: {},
    };

    const values: Record<string, number[]> = {};

    // Collect all values
    for (const precinct of precincts) {
      const medianAge = precinct.demographics.median_age || precinct.demographics.medianAge;
      const medianIncome =
        precinct.demographics.median_household_income || precinct.demographics.medianHHI;
      const partisanLean = precinct.electoral.partisan_lean ?? precinct.electoral.partisanLean;

      this.addValue(values, 'demo_age', medianAge);
      this.addValue(values, 'demo_income', medianIncome);
      this.addValue(values, 'demo_college', precinct.demographics.collegePct);
      this.addValue(values, 'demo_homeowner', precinct.demographics.homeownerPct);
      this.addValue(values, 'political_lean', partisanLean);
      this.addValue(values, 'political_demPct', precinct.political.demAffiliationPct);
      this.addValue(values, 'political_moderate', precinct.political.moderatePct);
      this.addValue(values, 'electoral_turnout', precinct.electoral.avgTurnout);
      this.addValue(
        values,
        'electoral_swing',
        precinct.electoral.swing_potential ?? precinct.electoral.swingPotential
      );
      this.addValue(values, 'electoral_dropoff', precinct.electoral.turnoutDropoff);
    }

    // Calculate stats
    for (const [key, vals] of Object.entries(values)) {
      stats.min[key] = Math.min(...vals);
      stats.max[key] = Math.max(...vals);
      stats.mean[key] = vals.reduce((sum, v) => sum + v, 0) / vals.length;

      const variance =
        vals.reduce((sum, v) => sum + Math.pow(v - stats.mean[key], 2), 0) / vals.length;
      stats.std[key] = Math.sqrt(variance);
    }

    return stats;
  }

  /**
   * Add value to stats collection
   */
  private addValue(values: Record<string, number[]>, key: string, value: number) {
    if (!values[key]) values[key] = [];
    values[key].push(value);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createLookalikeEngine(precincts: PrecinctData[]): LookalikeEngine {
  return new LookalikeEngine(precincts);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get default feature weights
 */
export function getDefaultFeatureWeights(): Record<string, number> {
  return {
    demographics: 0.3,
    political: 0.25,
    electoral: 0.2,
    tapestry: 0.15,
    engagement: 0.1,
  };
}

/**
 * Format similarity score for display
 */
export function formatSimilarityScore(score: number): string {
  if (score >= 90) return `${score.toFixed(1)}% (Excellent match)`;
  if (score >= 80) return `${score.toFixed(1)}% (Very similar)`;
  if (score >= 70) return `${score.toFixed(1)}% (Good match)`;
  if (score >= 60) return `${score.toFixed(1)}% (Moderate match)`;
  return `${score.toFixed(1)}% (Low similarity)`;
}
