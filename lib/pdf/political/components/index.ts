/**
 * Political PDF Components - Index
 *
 * Re-exports all reusable components for political PDF generation.
 */

// KPI Card Components
export {
  type PoliticalKPICardOptions,
  type PartisanLeanCardOptions,
  type ScoreCardOptions,
  type StatCardOptions,
  renderPoliticalKPICard,
  renderPartisanLeanCard,
  renderScoreCard,
  renderStatCard,
  renderPoliticalKPICardGrid,
  renderCoverPageKPIGrid,
  renderMiniStatRow,
} from './PoliticalKPICard';

// Table Renderer Components
export {
  type TableColumn,
  type ElectionResultRow,
  type PrecinctRankingRow,
  type SimilarPrecinctRow,
  type TableRenderOptions,
  renderTable,
  renderElectionHistoryTable,
  renderPrecinctRankingTable,
  renderSimilarPrecinctsTable,
  renderComparisonTable,
  renderSegmentCriteriaTable,
  renderTurfAssignmentTable,
  renderDonorZipTable,
  renderKeyValueList,
} from './PoliticalTableRenderer';

// Template Renderer
export {
  type TextAlign,
  type RenderOptions,
  type PageData,
  type ChartDataPoint,
  type KPICardData,
  PoliticalTemplateRenderer,
  createPoliticalRenderer,
} from './PoliticalTemplateRenderer';
