/**
 * PDF Page Builders - Modern Infographic Design (V2)
 *
 * Exports all V2 page builders for the 7-page CMA report with modern infographic design.
 * Each page builder is responsible for rendering a specific section of the report.
 */

export { Page1BuilderV2 } from './Page1BuilderV2';
export { Page2BuilderV2 } from './Page2BuilderV2';
export { Page3BuilderV2 } from './Page3BuilderV2';
export { Page4BuilderV2 } from './Page4BuilderV2';
export { Page5BuilderV2 } from './Page5BuilderV2';
export { Page6BuilderV2 } from './Page6BuilderV2';
export { Page7BuilderV2 } from './Page7BuilderV2';

// Re-export types used by page builders
export type { PDFReportConfig } from '../CMAReportPDFGenerator';
