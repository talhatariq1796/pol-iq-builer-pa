/**
 * Political PDF Template System - Index
 *
 * Re-exports all template definitions and utilities for political PDF generation.
 */

export {
  // Type definitions
  type ElementTemplate,
  type ChartTemplate,
  type ImageTemplate,
  type TableTemplate,
  type KPICardTemplate,
  type PageTemplate,

  // Constants
  PAGE_DIMENSIONS,
  MARGINS,
  CONTENT_AREA,
  COLUMN_LAYOUT,
  POLITICAL_COLORS,
  FONT_SPECS,
  KPI_GRID,

  // Templates
  POLITICAL_PAGE_TEMPLATES,

  // Template access functions
  getPageTemplate,
  getAllPageTemplates,

  // Utility functions
  getPartisanColor,
  formatPartisanLean,
  getCompetitivenessLabel,
  getScoreColor,
  getPriorityLabel,
} from './PoliticalPageTemplates';
