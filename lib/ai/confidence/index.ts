export type {
  ConfidenceLevel,
  ConfidenceMetadata,
  ConfidenceFactors,
  ConfidenceEngineConfig,
  PrecinctConfidence,
  RedistrictingImpact,
  ConfidentDataPoint,
  CitationKey,
  Citation,
  InlineCitation,
  CitedText,
} from './types';

// Constants
export {
  CONFIDENCE_INDICATORS,
  CITATION_REGISTRY,
  DEFAULT_CONFIDENCE_CONFIG,
} from './types';

// ConfidenceEngine
export {
  ConfidenceEngine,
  getConfidenceEngine,
} from './ConfidenceEngine';

// CitationService
export {
  getCitationService,
} from './CitationService';
