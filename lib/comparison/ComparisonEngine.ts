/**
 * Comparison Engine for Political Landscape Analysis
 *
 * Handles entity building, aggregation, and metric comparison
 * for the Split Screen Comparison Tool.
 */

import type {
  ComparisonEntity,
  ComparisonResult,
  MetricDifference,
  PrecinctRawData,
  PrecinctDataFile,
  CompetitivenessLevel,
  TargetingStrategy,
  MunicipalityRawData,
  MunicipalityDataFile,
  StateHouseRawData,
  StateHouseDataFile,
} from './types';

export class ComparisonEngine {
  private data: PrecinctDataFile | MunicipalityDataFile | StateHouseDataFile;

  constructor(data: PrecinctDataFile | MunicipalityDataFile | StateHouseDataFile) {
    this.data = data;
  }

  /**
   * Type guard for PrecinctDataFile
   */
  private isPrecinctDataFile(data: any): data is PrecinctDataFile {
    return data && 'precincts' in data && typeof data.precincts === 'object';
  }

  /**
   * Type guard for MunicipalityDataFile
   */
  private isMunicipalityDataFile(data: any): data is MunicipalityDataFile {
    return data && 'municipalities' in data && Array.isArray(data.municipalities);
  }

  /**
   * Type guard for StateHouseDataFile
   */
  private isStateHouseDataFile(data: any): data is StateHouseDataFile {
    return data && 'districts' in data && Array.isArray(data.districts);
  }

  /**
   * Build a ComparisonEntity from a precinct ID
   */
  buildPrecinctEntity(precinctId: string): ComparisonEntity {
    if (!this.isPrecinctDataFile(this.data)) {
      throw new Error('Data file does not contain precinct data');
    }

    // Try direct lookup first
    let precinct = this.data.precincts[precinctId];

    // If not found, try case-insensitive name match
    if (!precinct) {
      const precinctEntries = Object.entries(this.data.precincts);
      const found = precinctEntries.find(
        ([_, p]) => p.name.toLowerCase() === precinctId.toLowerCase()
      );
      if (found) {
        precinct = found[1];
      }
    }

    if (!precinct) {
      // Provide helpful error with sample precinct names
      const sampleNames = Object.values(this.data.precincts)
        .map(p => p.name)
        .slice(0, 5)
        .join(', ');
      throw new Error(
        `Precinct "${precinctId}" not found. Sample precincts include: ${sampleNames}...`
      );
    }

    // Get election years sorted descending
    const electionYears = Object.keys(precinct.elections || {})
      .map(Number)
      .filter((y) => Number.isFinite(y))
      .sort((a, b) => b - a);

    let lastYear = electionYears[0] ?? 2024;
    let lastElection = electionYears.length > 0 ? precinct.elections[lastYear] : undefined;

    if (!lastElection) {
      const lean = precinct.electoral.partisanLean;
      const demPct = Math.max(0, Math.min(100, 50 + lean / 2));
      const repPct = Math.max(0, Math.min(100, 100 - demPct));
      const margin = demPct - repPct;
      const avgTurnout = precinct.electoral.avgTurnout ?? 0;
      const voters =
        precinct.demographics.population18up ||
        Math.round(precinct.demographics.totalPopulation * 0.75);
      const ballotsCast = Math.max(0, Math.round(voters * (avgTurnout / 100)));
      lastElection = {
        demPct,
        repPct,
        margin,
        turnout: avgTurnout,
        ballotsCast,
      };
      lastYear = 2024;
    }

    // Build election history
    const electionHistory =
      electionYears.length > 0
        ? electionYears.map((year) => ({
            year,
            ...precinct.elections[year],
          }))
        : [
            {
              year: lastYear,
              ...lastElection,
            },
          ];

    return {
      id: precinct.id,
      name: precinct.name,
      type: 'precinct',
      parentJurisdiction: precinct.jurisdiction,

      demographics: {
        totalPopulation: precinct.demographics.totalPopulation,
        registeredVoters: precinct.demographics.population18up,
        medianAge: precinct.demographics.medianAge,
        medianIncome: precinct.demographics.medianHHI,
        collegePct: precinct.demographics.collegePct,
        homeownerPct: precinct.demographics.homeownerPct,
        diversityIndex: precinct.demographics.diversityIndex,
        populationDensity: precinct.demographics.populationDensity,
      },

      politicalProfile: {
        demAffiliationPct: precinct.political.demAffiliationPct,
        repAffiliationPct: precinct.political.repAffiliationPct,
        independentPct: precinct.political.independentPct,
        partisanLean: precinct.electoral.partisanLean,
        swingPotential: precinct.electoral.swingPotential,
        competitiveness: precinct.electoral.competitiveness,
        dominantParty: this.getDominantParty(precinct.electoral.partisanLean),
        avgTurnoutRate: precinct.electoral.avgTurnout,
      },

      electoral: {
        lastElectionYear: lastYear,
        demVoteShare: lastElection.demPct,
        repVoteShare: lastElection.repPct,
        marginOfVictory: Math.abs(lastElection.margin),
        totalVotesCast: lastElection.ballotsCast,
      },

      targetingScores: {
        gotvPriority: precinct.targeting.gotvPriority,
        persuasionOpportunity: precinct.targeting.persuasionOpportunity,
        combinedScore: precinct.targeting.combinedScore,
        recommendedStrategy: this.parseStrategy(precinct.targeting.strategy),
        canvassingEfficiency: this.calculateCanvassingEfficiency(
          precinct.demographics.populationDensity
        ),
      },

      electionHistory,
    };
  }

  /**
   * Build a ComparisonEntity from a municipality ID
   */
  buildMunicipalityEntity(municipalityId: string): ComparisonEntity {
    if (!('municipalities' in this.data)) {
      throw new Error('Not a municipality data file');
    }

    // Try to find municipality by ID or name (case-insensitive)
    let municipality = this.data.municipalities.find(m => m.id === municipalityId);
    if (!municipality) {
      // Try case-insensitive name match
      municipality = this.data.municipalities.find(
        m => m.name.toLowerCase() === municipalityId.toLowerCase()
      );
    }

    if (!municipality) {
      // Provide helpful error with available municipalities
      const availableNames = this.data.municipalities.map(m => m.name).slice(0, 5).join(', ');
      throw new Error(
        `Municipality "${municipalityId}" not found. Available municipalities include: ${availableNames}${
          this.data.municipalities.length > 5 ? `, and ${this.data.municipalities.length - 5} more` : ''
        }`
      );
    }

    // Calculate estimated demographic data
    const estimatedVoters = Math.round(municipality.population * 0.75); // ~75% voting age
    const estimatedIncome = this.estimateIncomeByDensity(municipality.density);
    const estimatedCollege = this.estimateCollegeByDensity(municipality.density);

    return {
      id: municipality.id,
      name: municipality.name,
      type: 'jurisdiction',

      demographics: {
        totalPopulation: municipality.population,
        registeredVoters: estimatedVoters,
        medianAge: 38, // Estimated
        medianIncome: estimatedIncome,
        collegePct: estimatedCollege,
        homeownerPct: municipality.density === 'urban' ? 45 : municipality.density === 'suburban' ? 70 : 80,
        diversityIndex: this.estimateDiversityByDensity(municipality.density),
        populationDensity: this.estimateDensity(municipality.density),
      },

      politicalProfile: {
        demAffiliationPct: Math.max(0, municipality.partisanLean * 1.2),
        repAffiliationPct: Math.max(0, -municipality.partisanLean * 1.2),
        independentPct: 100 - Math.abs(municipality.partisanLean) * 2.4,
        partisanLean: municipality.partisanLean,
        swingPotential: municipality.swingPotential,
        competitiveness: this.categorizeCompetitiveness(municipality.partisanLean),
        dominantParty: this.getDominantParty(municipality.partisanLean),
        avgTurnoutRate: municipality.avgTurnout,
      },

      electoral: {
        lastElectionYear: 2024, // Default
        demVoteShare: 50 + municipality.partisanLean / 2,
        repVoteShare: 50 - municipality.partisanLean / 2,
        marginOfVictory: Math.abs(municipality.partisanLean),
        totalVotesCast: Math.round(estimatedVoters * (municipality.avgTurnout / 100)),
      },

      targetingScores: {
        gotvPriority: municipality.gotvPriority,
        persuasionOpportunity: municipality.persuasionOpportunity,
        combinedScore: (municipality.gotvPriority + municipality.persuasionOpportunity) / 2,
        recommendedStrategy: this.parseStrategy(municipality.dominantStrategy),
        canvassingEfficiency: this.calculateCanvassingEfficiency(
          this.estimateDensity(municipality.density)
        ),
      },

      electionHistory: [], // Not available in municipality data
    };
  }

  /**
   * Build a ComparisonEntity from a state house district ID
   */
  buildStateHouseEntity(districtId: string): ComparisonEntity {
    if (!('districts' in this.data)) {
      throw new Error('Not a state house data file');
    }

    let district = this.data.districts.find(d => d.id === districtId);
    if (!district) {
      const q = districtId.trim().toLowerCase();
      district = this.data.districts.find(
        d =>
          d.id.toLowerCase() === q ||
          d.name.toLowerCase() === q
      );
    }
    if (!district) {
      throw new Error(`State house district not found: ${districtId}`);
    }

    const estimatedVoters = Math.round(district.population * 0.75);

    return {
      id: district.id,
      name: district.name,
      type: 'jurisdiction',

      demographics: {
        totalPopulation: district.population,
        registeredVoters: estimatedVoters,
        medianAge: district.keyDemographics.medianAge,
        medianIncome: district.keyDemographics.medianIncome,
        collegePct: district.keyDemographics.bachelorsPct,
        homeownerPct: district.keyDemographics.density === 'urban' ? 45 : 70,
        diversityIndex: this.estimateDiversityByDensity(district.keyDemographics.density as any),
        populationDensity: this.estimateDensity(district.keyDemographics.density as any),
      },

      politicalProfile: {
        demAffiliationPct: Math.max(0, district.partisanLean * 1.2),
        repAffiliationPct: Math.max(0, -district.partisanLean * 1.2),
        independentPct: 100 - Math.abs(district.partisanLean) * 2.4,
        partisanLean: district.partisanLean,
        swingPotential: district.swingPotential,
        competitiveness: this.categorizeCompetitiveness(district.partisanLean),
        dominantParty: this.getDominantParty(district.partisanLean),
        avgTurnoutRate: district.avgTurnout,
      },

      electoral: {
        lastElectionYear: district.lastElectionYear,
        demVoteShare: 50 + district.lastElectionMargin / 2,
        repVoteShare: 50 - district.lastElectionMargin / 2,
        marginOfVictory: district.lastElectionMargin,
        totalVotesCast: Math.round(estimatedVoters * (district.avgTurnout / 100)),
      },

      targetingScores: {
        gotvPriority: district.gotvPriority,
        persuasionOpportunity: district.persuasionOpportunity,
        combinedScore: (district.gotvPriority + district.persuasionOpportunity) / 2,
        recommendedStrategy: this.parseStrategy(district.dominantStrategy),
        canvassingEfficiency: this.calculateCanvassingEfficiency(
          this.estimateDensity(district.keyDemographics.density as any)
        ),
      },

      electionHistory: [
        {
          year: district.lastElectionYear,
          demPct: 50 + district.lastElectionMargin / 2,
          repPct: 50 - district.lastElectionMargin / 2,
          margin: district.lastElectionMargin,
          turnout: district.avgTurnout,
          ballotsCast: Math.round(estimatedVoters * (district.avgTurnout / 100)),
        },
      ],
    };
  }

  /**
   * Build a ComparisonEntity by aggregating a jurisdiction's precincts
   */
  buildJurisdictionEntity(jurisdictionId: string): ComparisonEntity {
    if (!this.isPrecinctDataFile(this.data)) {
      throw new Error('Not a precinct data file');
    }
    const data = this.data; // Local variable for type narrowing

    // Try to find jurisdiction by ID or name (case-insensitive)
    let jurisdiction = data.jurisdictions.find(j => j.id === jurisdictionId);
    if (!jurisdiction) {
      // Try case-insensitive name match
      jurisdiction = data.jurisdictions.find(
        j => j.name.toLowerCase() === jurisdictionId.toLowerCase()
      );
    }

    if (!jurisdiction) {
      // Provide helpful error with available jurisdictions
      const availableNames = data.jurisdictions.map(j => j.name).slice(0, 5).join(', ');
      throw new Error(
        `Jurisdiction "${jurisdictionId}" not found. Available jurisdictions include: ${availableNames}${
          data.jurisdictions.length > 5 ? `, and ${data.jurisdictions.length - 5} more` : ''
        }`
      );
    }

    const precincts = jurisdiction.precinctIds
      .map(id => data.precincts[id])
      .filter(Boolean);

    if (precincts.length === 0) {
      throw new Error(`No precincts found for jurisdiction: ${jurisdictionId}`);
    }

    const totalPop = precincts.reduce(
      (sum, p) => sum + p.demographics.totalPopulation,
      0
    );

    // Population-weighted averages
    const weightedAvg = (getter: (p: PrecinctRawData) => number): number => {
      const sum = precincts.reduce(
        (acc, p) => acc + getter(p) * p.demographics.totalPopulation,
        0
      );
      return sum / totalPop;
    };

    // Aggregate election results
    const allYears = new Set<string>();
    precincts.forEach(p => {
      Object.keys(p.elections).forEach(y => allYears.add(y));
    });

    const electionHistory = Array.from(allYears)
      .map(Number)
      .sort((a, b) => b - a)
      .map(year => {
        let totalBallots = 0;
        let totalDemVotes = 0;
        let totalRepVotes = 0;

        precincts.forEach(p => {
          const e = p.elections[year];
          if (e) {
            totalBallots += e.ballotsCast;
            totalDemVotes += (e.demPct / 100) * e.ballotsCast;
            totalRepVotes += (e.repPct / 100) * e.ballotsCast;
          }
        });

        const demPct = totalBallots > 0 ? (totalDemVotes / totalBallots) * 100 : 0;
        const repPct = totalBallots > 0 ? (totalRepVotes / totalBallots) * 100 : 0;

        return {
          year,
          demPct,
          repPct,
          margin: demPct - repPct,
          turnout: weightedAvg(p => p.elections[year]?.turnout ?? 0),
          ballotsCast: totalBallots,
        };
      });

    const partisanLean = weightedAvg(p => p.electoral.partisanLean);
    let lastElection = electionHistory[0];
    if (!lastElection) {
      const avgTurn = weightedAvg(p => p.electoral.avgTurnout);
      const demPct = Math.max(0, Math.min(100, 50 + partisanLean / 2));
      const repPct = Math.max(0, Math.min(100, 100 - demPct));
      lastElection = {
        year: 2024,
        demPct,
        repPct,
        margin: demPct - repPct,
        turnout: avgTurn,
        ballotsCast: Math.max(0, Math.round(totalPop * 0.75 * (avgTurn / 100))),
      };
    }
    const gotvPriority = weightedAvg(p => p.targeting.gotvPriority);
    const persuasionOpportunity = weightedAvg(p => p.targeting.persuasionOpportunity);

    return {
      id: jurisdiction.id,
      name: jurisdiction.name,
      type: 'jurisdiction',

      demographics: {
        totalPopulation: totalPop,
        registeredVoters: precincts.reduce(
          (sum, p) => sum + p.demographics.population18up,
          0
        ),
        medianAge: weightedAvg(p => p.demographics.medianAge),
        medianIncome: weightedAvg(p => p.demographics.medianHHI),
        collegePct: weightedAvg(p => p.demographics.collegePct),
        homeownerPct: weightedAvg(p => p.demographics.homeownerPct),
        diversityIndex: weightedAvg(p => p.demographics.diversityIndex),
        populationDensity: weightedAvg(p => p.demographics.populationDensity),
      },

      politicalProfile: {
        demAffiliationPct: weightedAvg(p => p.political.demAffiliationPct),
        repAffiliationPct: weightedAvg(p => p.political.repAffiliationPct),
        independentPct: weightedAvg(p => p.political.independentPct),
        partisanLean,
        swingPotential: weightedAvg(p => p.electoral.swingPotential),
        competitiveness: this.categorizeCompetitiveness(partisanLean),
        dominantParty: this.getDominantParty(partisanLean),
        avgTurnoutRate: weightedAvg(p => p.electoral.avgTurnout),
      },

      electoral: {
        lastElectionYear: lastElection.year,
        demVoteShare: lastElection.demPct,
        repVoteShare: lastElection.repPct,
        marginOfVictory: Math.abs(lastElection.margin),
        totalVotesCast: lastElection.ballotsCast,
      },

      targetingScores: {
        gotvPriority,
        persuasionOpportunity,
        combinedScore: weightedAvg(p => p.targeting.combinedScore),
        recommendedStrategy: this.determineStrategy(
          gotvPriority,
          persuasionOpportunity,
          partisanLean
        ),
        canvassingEfficiency: weightedAvg(p =>
          this.calculateCanvassingEfficiency(p.demographics.populationDensity)
        ),
      },

      electionHistory,
    };
  }

  /**
   * Compare two entities and generate comprehensive comparison result
   */
  compare(left: ComparisonEntity, right: ComparisonEntity): ComparisonResult {
    return {
      leftEntity: left,
      rightEntity: right,
      differences: {
        demographics: this.compareDemographics(left, right),
        politicalProfile: this.comparePolitical(left, right),
        electoral: this.compareElectoral(left, right),
        targeting: this.compareTargeting(left, right),
      },
      insights: [], // Will be populated by InsightGenerator
      comparisonType: this.getComparisonType(left, right),
      timestamp: new Date(),
    };
  }

  /**
   * Build a ComparisonEntity from any boundary type
   * Supports cross-boundary comparisons by auto-detecting entity type
   */
  buildEntityByType(
    entityId: string,
    boundaryType:
      | 'precincts'
      | 'municipalities'
      | 'state_house'
      | 'state_senate'
      | 'congressional'
      | 'school_districts'
      | 'county'
      | 'zip_codes'
      | 'jurisdictions'
  ): ComparisonEntity {
    switch (boundaryType) {
      case 'precincts':
        return this.buildPrecinctEntity(entityId);
      case 'municipalities':
        return this.buildMunicipalityEntity(entityId);
      case 'state_house':
      case 'state_senate':
      case 'congressional':
      case 'school_districts':
      case 'county':
      case 'zip_codes':
        return this.buildStateHouseEntity(entityId);
      case 'jurisdictions':
        return this.buildJurisdictionEntity(entityId);
      default:
        throw new Error(`Unknown boundary type: ${boundaryType}`);
    }
  }

  /**
   * Cross-boundary comparison: Compare entities from different boundary types
   *
   * Example: Compare a precinct to a municipality, or a municipality to a state house district
   *
   * @param leftId - ID of the left entity
   * @param leftType - Boundary type of the left entity
   * @param rightId - ID of the right entity
   * @param rightType - Boundary type of the right entity
   * @param leftData - Data source for left entity (optional, uses this.data if not provided)
   * @param rightData - Data source for right entity (optional, uses this.data if not provided)
   */
  compareCrossBoundary(
    leftId: string,
    leftType: 'precincts' | 'municipalities' | 'state_house' | 'jurisdictions',
    rightId: string,
    rightType: 'precincts' | 'municipalities' | 'state_house' | 'jurisdictions',
    leftData?: PrecinctDataFile | MunicipalityDataFile | StateHouseDataFile,
    rightData?: PrecinctDataFile | MunicipalityDataFile | StateHouseDataFile
  ): ComparisonResult {
    // Use provided data sources or fall back to this.data
    const originalData = this.data;

    // Build left entity
    if (leftData) {
      this.data = leftData;
    }
    const leftEntity = this.buildEntityByType(leftId, leftType);

    // Build right entity
    if (rightData) {
      this.data = rightData;
    } else if (leftData) {
      // Reset to original if only left was different
      this.data = originalData;
    }
    const rightEntity = this.buildEntityByType(rightId, rightType);

    // Restore original data
    this.data = originalData;

    // Compare the entities
    return this.compare(leftEntity, rightEntity);
  }

  /**
   * Find similar entities across different boundary types
   *
   * @param entity - The entity to find similarities for
   * @param targetType - The boundary type to search in
   * @param targetData - The data source for the target boundary type
   * @param maxResults - Maximum number of results to return (default: 5)
   */
  findSimilarEntities(
    entity: ComparisonEntity,
    targetType:
      | 'precincts'
      | 'municipalities'
      | 'state_house'
      | 'state_senate'
      | 'congressional'
      | 'school_districts'
      | 'county'
      | 'zip_codes'
      | 'jurisdictions',
    targetData: PrecinctDataFile | MunicipalityDataFile | StateHouseDataFile,
    maxResults: number = 5
  ): Array<{ entity: ComparisonEntity; similarityScore: number; matchingFactors: string[] }> {
    const originalData = this.data;
    this.data = targetData;

    try {
      // Get all entities of the target type
      let targetEntities: ComparisonEntity[] = [];

      switch (targetType) {
        case 'precincts':
          if ('precincts' in targetData) {
            targetEntities = Object.keys(targetData.precincts).map(id =>
              this.buildPrecinctEntity(id)
            );
          }
          break;
        case 'municipalities':
          if ('municipalities' in targetData) {
            targetEntities = targetData.municipalities.map(m =>
              this.buildMunicipalityEntity(m.id)
            );
          }
          break;
        case 'state_house':
        case 'state_senate':
        case 'congressional':
        case 'school_districts':
        case 'county':
        case 'zip_codes':
          if ('districts' in targetData) {
            targetEntities = targetData.districts.map(d =>
              this.buildStateHouseEntity(d.id)
            );
          }
          break;
        case 'jurisdictions':
          if ('jurisdictions' in targetData) {
            targetEntities = (targetData as PrecinctDataFile).jurisdictions.map(j =>
              this.buildJurisdictionEntity(j.id)
            );
          }
          break;
      }

      // Calculate similarity scores
      const scored = targetEntities.map(targetEntity => {
        const { score, factors } = this.calculateSimilarity(entity, targetEntity);
        return {
          entity: targetEntity,
          similarityScore: score,
          matchingFactors: factors,
        };
      });

      // Sort by similarity and return top results
      return scored
        .sort((a, b) => b.similarityScore - a.similarityScore)
        .slice(0, maxResults);
    } finally {
      this.data = originalData;
    }
  }

  /**
   * Calculate similarity score between two entities
   * Returns a score from 0-100 and a list of matching factors
   */
  private calculateSimilarity(
    entity1: ComparisonEntity,
    entity2: ComparisonEntity
  ): { score: number; factors: string[] } {
    const factors: string[] = [];
    let totalScore = 0;
    let weightSum = 0;

    // Political Profile (40% weight)
    const leanDiff = Math.abs(entity1.politicalProfile.partisanLean - entity2.politicalProfile.partisanLean);
    const leanScore = Math.max(0, 100 - leanDiff * 2);
    if (leanScore > 70) factors.push('Similar partisan lean');
    totalScore += leanScore * 0.2;
    weightSum += 0.2;

    const swingDiff = Math.abs(entity1.politicalProfile.swingPotential - entity2.politicalProfile.swingPotential);
    const swingScore = Math.max(0, 100 - swingDiff);
    if (swingScore > 70) factors.push('Similar swing potential');
    totalScore += swingScore * 0.1;
    weightSum += 0.1;

    const turnoutDiff = Math.abs(entity1.politicalProfile.avgTurnoutRate - entity2.politicalProfile.avgTurnoutRate);
    const turnoutScore = Math.max(0, 100 - turnoutDiff * 2);
    if (turnoutScore > 70) factors.push('Similar turnout rates');
    totalScore += turnoutScore * 0.1;
    weightSum += 0.1;

    // Demographics (30% weight)
    const incomeDiff = Math.abs(entity1.demographics.medianIncome - entity2.demographics.medianIncome);
    const incomeScore = Math.max(0, 100 - (incomeDiff / 1000));
    if (incomeScore > 70) factors.push('Similar median income');
    totalScore += incomeScore * 0.1;
    weightSum += 0.1;

    const ageDiff = Math.abs(entity1.demographics.medianAge - entity2.demographics.medianAge);
    const ageScore = Math.max(0, 100 - ageDiff * 3);
    if (ageScore > 70) factors.push('Similar median age');
    totalScore += ageScore * 0.1;
    weightSum += 0.1;

    const eduDiff = Math.abs(entity1.demographics.collegePct - entity2.demographics.collegePct);
    const eduScore = Math.max(0, 100 - eduDiff * 2);
    if (eduScore > 70) factors.push('Similar education levels');
    totalScore += eduScore * 0.1;
    weightSum += 0.1;

    // Targeting Scores (30% weight)
    const gotvDiff = Math.abs(entity1.targetingScores.gotvPriority - entity2.targetingScores.gotvPriority);
    const gotvScore = Math.max(0, 100 - gotvDiff);
    if (gotvScore > 70) factors.push('Similar GOTV priority');
    totalScore += gotvScore * 0.15;
    weightSum += 0.15;

    const persuasionDiff = Math.abs(entity1.targetingScores.persuasionOpportunity - entity2.targetingScores.persuasionOpportunity);
    const persuasionScore = Math.max(0, 100 - persuasionDiff);
    if (persuasionScore > 70) factors.push('Similar persuasion opportunity');
    totalScore += persuasionScore * 0.15;
    weightSum += 0.15;

    // Same recommended strategy is a strong match
    if (entity1.targetingScores.recommendedStrategy === entity2.targetingScores.recommendedStrategy) {
      factors.push(`Same strategy: ${entity1.targetingScores.recommendedStrategy}`);
      totalScore += 10;
    }

    return {
      score: Math.min(100, Math.round(totalScore / weightSum)),
      factors,
    };
  }

  /**
   * Get list of all precincts for search
   */
  getPrecinctList(): Array<{ id: string; name: string; jurisdiction: string; partisanLean: number; population: number }> {
    if (!this.isPrecinctDataFile(this.data)) {
      throw new Error('Not a precinct data file');
    }
    return Object.values(this.data.precincts).map(p => ({
      id: p.id,
      name: p.name,
      jurisdiction: p.jurisdiction,
      partisanLean: p.electoral.partisanLean,
      population: p.demographics.totalPopulation,
    }));
  }

  /**
   * Get list of all jurisdictions for search
   */
  getJurisdictionList(): Array<{ id: string; name: string; type: string; precinctCount: number }> {
    if (!this.isPrecinctDataFile(this.data)) {
      throw new Error('Not a precinct data file');
    }
    return this.data.jurisdictions.map(j => ({
      id: j.id,
      name: j.name,
      type: j.type,
      precinctCount: j.precinctIds.length,
    }));
  }

  /**
   * Get list of all municipalities for search
   */
  getMunicipalityList(): Array<{
    id: string;
    name: string;
    type: string;
    partisanLean: number;
    population: number;
    precinctCount: number;
  }> {
    if (!('municipalities' in this.data)) {
      throw new Error('Not a municipality data file');
    }
    return this.data.municipalities.map(m => ({
      id: m.id,
      name: m.name,
      type: m.type,
      partisanLean: m.partisanLean,
      population: m.population,
      precinctCount: m.precinctCount ?? 0,
    }));
  }

  /**
   * Get list of all state house districts for search
   */
  getStateHouseList(): Array<{
    id: string;
    name: string;
    representative: string;
    party: string;
    partisanLean: number;
    population: number;
    precinctCount: number;
  }> {
    if (!('districts' in this.data)) {
      throw new Error('Not a state house data file');
    }
    return this.data.districts.map(d => ({
      id: d.id,
      name: d.name,
      representative: d.representative,
      party: d.party,
      partisanLean: d.partisanLean,
      population: d.population,
      precinctCount: d.precinctCount ?? 0,
    }));
  }

  // Private comparison methods

  private compareDemographics(left: ComparisonEntity, right: ComparisonEntity): MetricDifference[] {
    return [
      this.createDifference('Population', left.demographics.totalPopulation, right.demographics.totalPopulation, 'number'),
      this.createDifference('Median Age', left.demographics.medianAge, right.demographics.medianAge, 'number'),
      this.createDifference('Median Income', left.demographics.medianIncome, right.demographics.medianIncome, 'currency'),
      this.createDifference('College %', left.demographics.collegePct, right.demographics.collegePct, 'percent'),
      this.createDifference('Homeowner %', left.demographics.homeownerPct, right.demographics.homeownerPct, 'percent'),
      this.createDifference('Diversity Index', left.demographics.diversityIndex, right.demographics.diversityIndex, 'number'),
    ];
  }

  private comparePolitical(left: ComparisonEntity, right: ComparisonEntity): MetricDifference[] {
    return [
      this.createDifference('Partisan Lean', left.politicalProfile.partisanLean, right.politicalProfile.partisanLean, 'points'),
      this.createDifference('Swing Potential', left.politicalProfile.swingPotential, right.politicalProfile.swingPotential, 'number'),
      this.createDifference('Dem Affiliation %', left.politicalProfile.demAffiliationPct, right.politicalProfile.demAffiliationPct, 'percent'),
      this.createDifference('Rep Affiliation %', left.politicalProfile.repAffiliationPct, right.politicalProfile.repAffiliationPct, 'percent'),
      this.createDifference('Avg Turnout', left.politicalProfile.avgTurnoutRate, right.politicalProfile.avgTurnoutRate, 'percent'),
    ];
  }

  private compareElectoral(left: ComparisonEntity, right: ComparisonEntity): MetricDifference[] {
    return [
      this.createDifference('Dem Vote Share', left.electoral.demVoteShare, right.electoral.demVoteShare, 'percent'),
      this.createDifference('Rep Vote Share', left.electoral.repVoteShare, right.electoral.repVoteShare, 'percent'),
      this.createDifference('Margin', left.electoral.marginOfVictory, right.electoral.marginOfVictory, 'points'),
      this.createDifference('Total Votes', left.electoral.totalVotesCast, right.electoral.totalVotesCast, 'number'),
    ];
  }

  private compareTargeting(left: ComparisonEntity, right: ComparisonEntity): MetricDifference[] {
    return [
      this.createDifference('GOTV Priority', left.targetingScores.gotvPriority, right.targetingScores.gotvPriority, 'number'),
      this.createDifference('Persuasion Opp.', left.targetingScores.persuasionOpportunity, right.targetingScores.persuasionOpportunity, 'number'),
      this.createDifference('Combined Score', left.targetingScores.combinedScore, right.targetingScores.combinedScore, 'number'),
      this.createDifference('Canvass Efficiency', left.targetingScores.canvassingEfficiency, right.targetingScores.canvassingEfficiency, 'number'),
    ];
  }

  private createDifference(
    metricName: string,
    leftValue: number,
    rightValue: number,
    formatType: 'number' | 'currency' | 'percent' | 'points'
  ): MetricDifference {
    const difference = leftValue - rightValue;
    const percentDiff = rightValue !== 0 ? (difference / rightValue) * 100 : 0;

    let isSignificant = false;
    if (formatType === 'points') {
      isSignificant = Math.abs(difference) > 5;
    } else if (formatType === 'percent') {
      isSignificant = Math.abs(difference) > 10;
    } else {
      isSignificant = Math.abs(percentDiff) > 10;
    }

    let direction: 'left-higher' | 'right-higher' | 'equal';
    if (Math.abs(difference) < 0.01) {
      direction = 'equal';
    } else if (difference > 0) {
      direction = 'left-higher';
    } else {
      direction = 'right-higher';
    }

    return {
      metricName,
      leftValue,
      rightValue,
      difference,
      percentDiff,
      isSignificant,
      direction,
      formatType,
    };
  }

  private getDominantParty(partisanLean: number): 'D' | 'R' | 'Swing' {
    if (Math.abs(partisanLean) < 5) return 'Swing';
    return partisanLean > 0 ? 'D' : 'R';
  }

  private categorizeCompetitiveness(partisanLean: number): CompetitivenessLevel {
    if (partisanLean > 20) return 'safe_d';
    if (partisanLean > 10) return 'likely_d';
    if (partisanLean > 5) return 'lean_d';
    if (partisanLean >= -5) return 'tossup';
    if (partisanLean >= -10) return 'lean_r';
    if (partisanLean >= -20) return 'likely_r';
    return 'safe_r';
  }

  private parseStrategy(strategy: string): TargetingStrategy {
    const normalized = strategy.toLowerCase();
    if (normalized.includes('battleground')) return 'Battleground';
    if (normalized.includes('base') || normalized.includes('mobilization')) return 'Base Mobilization';
    if (normalized.includes('persuasion')) return 'Persuasion Target';
    return 'Low Priority';
  }

  private determineStrategy(
    gotvPriority: number,
    persuasionOpportunity: number,
    partisanLean: number
  ): TargetingStrategy {
    const isCompetitive = Math.abs(partisanLean) < 10;

    if (isCompetitive && persuasionOpportunity > 50) {
      return 'Battleground';
    }
    if (persuasionOpportunity > 60) {
      return 'Persuasion Target';
    }
    if (gotvPriority > 60) {
      return 'Base Mobilization';
    }
    return 'Low Priority';
  }

  private calculateCanvassingEfficiency(density: number): number {
    if (density > 3000) return 45;
    if (density > 1000) return 35;
    if (density > 500) return 28;
    return 20;
  }

  private getComparisonType(
    left: ComparisonEntity,
    right: ComparisonEntity
  ): 'precinct-to-precinct' | 'jurisdiction-to-jurisdiction' | 'mixed' | 'cross-boundary' {
    if (left.type === 'precinct' && right.type === 'precinct') {
      return 'precinct-to-precinct';
    }
    if (left.type === 'jurisdiction' && right.type === 'jurisdiction') {
      // Check if they're from the same boundary type (by checking parentJurisdiction or name patterns)
      // For now, consider all jurisdiction-to-jurisdiction as the same type
      return 'jurisdiction-to-jurisdiction';
    }
    if (left.type !== right.type) {
      return 'cross-boundary';
    }
    return 'mixed';
  }

  // Helper methods for estimation

  private estimateIncomeByDensity(density: 'urban' | 'suburban' | 'rural'): number {
    switch (density) {
      case 'urban': return 48000;
      case 'suburban': return 62000;
      case 'rural': return 52000;
    }
  }

  private estimateCollegeByDensity(density: 'urban' | 'suburban' | 'rural'): number {
    switch (density) {
      case 'urban': return 45;
      case 'suburban': return 52;
      case 'rural': return 32;
    }
  }

  private estimateDensity(density: 'urban' | 'suburban' | 'rural'): number {
    switch (density) {
      case 'urban': return 3500;
      case 'suburban': return 1200;
      case 'rural': return 200;
    }
  }

  private estimateDiversityByDensity(density: 'urban' | 'suburban' | 'rural'): number {
    switch (density) {
      case 'urban': return 0.65;
      case 'suburban': return 0.45;
      case 'rural': return 0.30;
    }
  }
}
