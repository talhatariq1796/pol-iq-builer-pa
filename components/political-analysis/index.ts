/**
 * Political Analysis Components
 *
 * Components for political landscape analysis:
 * - Area selection (boundaries, buffers, drawing)
 * - Political profile reports
 * - Precinct/district visualization
 * - Map layer management
 */

// Main components
export { PoliticalAreaSelector } from './PoliticalAreaSelector';
export { PoliticalAnalysisPanel } from './PoliticalAnalysisPanel';
export { PoliticalReportDialog } from './PoliticalReportDialog';

// Boundary selection components
export { BoundaryLayerPicker, BOUNDARY_LAYERS, AVAILABLE_BOUNDARY_TYPES } from './BoundaryLayerPicker';
export { BoundarySearch } from './BoundarySearch';
export { BoundaryMapLayer } from './BoundaryMapLayer';

// Choropleth visualization
export { PrecinctChoroplethLayer, PrecinctChoroplethLegend } from './PrecinctChoroplethLayer';
export type { TemporalConfig } from './PrecinctChoroplethLayer';

// H3 Heatmap components
export {
  H3HeatmapLayer,
  H3HeatmapLegend,
  MetricSelector,
  H3HeatmapControls
} from './H3HeatmapLayer';
export type { H3Metric } from './H3HeatmapLayer';

// Multi-variable visualization components
export {
  BivariateChoroplethLayer,
  BivariateLegend,
  BIVARIATE_PRESETS,
} from './BivariateChoroplethLayer';
export type { BivariateConfig, BivariateMetric } from './BivariateChoroplethLayer';

export {
  ProportionalSymbolLayer,
  ProportionalLegend,
  PROPORTIONAL_PRESETS,
} from './ProportionalSymbolLayer';
export type {
  ProportionalConfig,
  ProportionalSizeMetric,
  ProportionalColorMetric,
  ProportionalDataPoint,
} from './ProportionalSymbolLayer';

export {
  ValueByAlphaLayer,
  ValueByAlphaLegend,
  VALUE_BY_ALPHA_PRESETS,
} from './ValueByAlphaLayer';
export type {
  ValueByAlphaConfig,
  ValueMetric,
  AlphaMetric,
} from './ValueByAlphaLayer';

// Types
export type { BoundaryFeature } from './BoundarySearch';
