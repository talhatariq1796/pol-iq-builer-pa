/**
 * Split Screen Comparison Tool - Public API
 *
 * @example
 * ```typescript
 * import { ComparisonEngine, InsightGenerator } from '@/lib/comparison';
 * import { politicalDataService } from '@/lib/services/PoliticalDataService';
 *
 * const precinctData = await politicalDataService.getPrecinctDataFileFormat();
 * const engine = new ComparisonEngine(precinctData);
 * const left = engine.buildPrecinctEntity('some-precinct-id');
 * const right = engine.buildPrecinctEntity('other-precinct-id');
 * const comparison = engine.compare(left, right);
 *
 * const generator = new InsightGenerator();
 * comparison.insights = generator.generateInsights(comparison);
 * ```
 */

// Core engines
export { ComparisonEngine } from './ComparisonEngine';
export { InsightGenerator } from './InsightGenerator';

// Wave 1 engines
export { SimilarityEngine } from './SimilarityEngine';
export { ResourceOptimizer } from './ResourceOptimizer';
export { DonorLookup } from './DonorLookup';

// Wave 2 engines
export { ClusterAnalyzer } from './ClusterAnalyzer';
export { BudgetSimulator } from './BudgetSimulator';
export { FieldBriefGenerator } from './FieldBriefGenerator';
export { BatchComparisonEngine } from './BatchComparisonEngine';
export { MatrixAnalyzer } from './MatrixAnalyzer';

export {
  BOUNDARY_TYPES,
  getBoundaryTypeInfo,
  getAvailableBoundaryTypes,
  isBoundaryTypeAvailable,
} from './boundaryTypes';

// Core types
export type {
  EntityType,
  BoundaryType,
  BoundaryTypeInfo,
  CompetitivenessLevel,
  TargetingStrategy,
  PrecinctRawData,
  JurisdictionEntry,
  PrecinctDataFile,
  MunicipalityRawData,
  MunicipalityDataFile,
  StateHouseRawData,
  StateHouseDataFile,
  ComparisonEntity,
  MetricDifference,
  ComparisonResult,
  EntitySearchResult,
  CrossBoundaryComparisonOptions,
  SimilarEntityResult,
} from './types';

// Similarity types
export type {
  SimilarityResult,
  SimilarityBreakdown,
  SimilarityBonuses,
  SimilaritySearchOptions,
  SimilarEntityResult as SimilarEntityResultFull,
  EntityCluster,
  ClusterOptions,
  ClusterCharacteristics,
} from './types-similarity';

// Resource types
export type {
  ROIScore,
  ROIBreakdown,
  ChannelCosts,
  ChannelCostEstimate,
  EntityResourceAnalysis,
  ResourceOptimizerConfig,
  SimulationResult,
  BudgetAllocation,
  ChannelSplit,
  EntitySimulationResult,
} from './types-resource';

// Donor types
export type {
  DonorConcentrationMetrics,
  DonorComparison,
  DonorGrowthMetrics,
  DonorIntegrationOptions,
  EntityZIPMapping,
  ZIPAggregateData,
  LapsedDonorData,
} from './types-donor';

// Brief types
export type {
  FieldBrief,
  AreaProfiles,
  TalkingPoints,
  VoterProfiles,
  FieldOperations,
  BriefOptions,
} from './types-brief';

// Batch types
export type {
  BatchComparisonResult,
  BatchComparisonOptions,
  MatrixAnalytics,
  MetricStats,
  Rankings,
  PairwiseSimilarity,
  CorrelationMatrix,
  ParetoAnalysis,
} from './types-batch';
