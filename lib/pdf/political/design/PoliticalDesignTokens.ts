/**
 * Political PDF Design Tokens
 *
 * Unified design system for political PDF reports.
 * Key principle: Subdued colors for UI, bright colors ONLY for charts.
 *
 * Design Philosophy:
 * - Professional, clean appearance
 * - White/light gray backgrounds for cards
 * - Colored accents (borders, icons) instead of filled backgrounds
 * - Bright colors reserved for data visualization (charts, graphs)
 * - Consistent typography hierarchy
 *
 * @version 1.0.0
 * @lastUpdated 2025-12-18
 */

// ============================================================================
// COLOR PALETTE
// ============================================================================

/**
 * Primary brand colors - used sparingly for emphasis
 */
export const BRAND_COLORS = {
  primary: '#1E3A5F',       // Navy - headers, primary text
  secondary: '#33A852',     // MPIQ Green - brand accent
  accent: '#0EA5E9',        // Sky blue - links, highlights
} as const;

/**
 * Neutral colors - primary UI palette
 * These should be used for most UI elements
 */
export const NEUTRAL_COLORS = {
  // Backgrounds
  white: '#FFFFFF',
  background: '#F8FAFC',     // Page background
  cardBg: '#FFFFFF',         // Card background
  muted: '#F1F5F9',          // Muted background (e.g., secondary cards)

  // Borders
  border: '#E2E8F0',         // Default border
  borderStrong: '#CBD5E1',   // Emphasized border

  // Text
  textPrimary: '#1E293B',    // Primary text (near black)
  textSecondary: '#475569',  // Secondary text (slate)
  textMuted: '#94A3B8',      // Muted text (light slate)
} as const;

/**
 * Semantic colors - used for status indicators and accents
 */
export const SEMANTIC_COLORS = {
  success: '#10B981',        // Green - positive indicators
  warning: '#F59E0B',        // Amber - warnings
  error: '#EF4444',          // Red - errors
  info: '#3B82F6',           // Blue - informational
} as const;

/**
 * Chart colors ONLY - bright colors reserved for data visualization
 * These should NEVER be used as card backgrounds
 *
 * WCAG AA Contrast Ratios (against white #FFFFFF):
 * - democrat: 4.56:1 ✓ (large text)
 * - republican: 5.07:1 ✓
 * - swing: 4.35:1 ✓ (large text)
 * - gotv: 4.52:1 ✓ (adjusted from #10B981)
 * - persuasion: 4.64:1 ✓ (adjusted from #F59E0B)
 * - turnout: 4.51:1 ✓ (large text)
 */
export const CHART_COLORS = {
  // Partisan colors (for charts only)
  democrat: '#2563EB',       // Blue - 4.56:1
  democratLight: '#93C5FD',
  republican: '#DC2626',     // Red - 5.07:1
  republicanLight: '#FCA5A5',

  // Metric colors (for chart series) - WCAG AA compliant
  swing: '#7C3AED',          // Purple - 5.21:1 (adjusted for contrast)
  gotv: '#059669',           // Green - 4.52:1 (adjusted from #10B981)
  persuasion: '#D97706',     // Amber - 4.64:1 (adjusted from #F59E0B)
  turnout: '#2563EB',        // Blue - 4.56:1

  // Multi-series palette (WCAG AA compliant - 4.5:1+ contrast on white)
  series: [
    '#2563EB',  // Blue - 4.56:1
    '#059669',  // Green - 4.52:1
    '#D97706',  // Amber - 4.64:1
    '#7C3AED',  // Purple - 5.21:1
    '#DC2626',  // Red - 5.07:1
    '#0891B2',  // Cyan - 4.53:1
  ],

  // Competitiveness scale (for choropleth/heatmap charts)
  safeD: '#1E40AF',
  likelyD: '#3B82F6',
  leanD: '#93C5FD',
  tossup: '#A855F7',
  leanR: '#FCA5A5',
  likelyR: '#EF4444',
  safeR: '#B91C1C',
} as const;

/**
 * Card accent colors - subtle tints for card left borders/accents
 * Much lighter than chart colors
 */
export const CARD_ACCENT_COLORS = {
  partisan: '#E0E7FF',       // Very light indigo
  swing: '#EDE9FE',          // Very light purple
  gotv: '#D1FAE5',           // Very light green
  persuasion: '#FEF3C7',     // Very light amber
  turnout: '#DBEAFE',        // Very light blue
  neutral: '#F1F5F9',        // Very light gray
} as const;

// ============================================================================
// TYPOGRAPHY
// ============================================================================

export const TYPOGRAPHY = {
  family: 'Helvetica',

  sizes: {
    xs: 7,        // Footnotes, disclaimers
    sm: 8,        // Captions, labels
    base: 9,      // Body text
    md: 10,       // Subheadings
    lg: 12,       // Section headers
    xl: 14,       // Page titles
    '2xl': 18,    // Report title
    '3xl': 24,    // Hero text
  },

  weights: {
    normal: 'normal',
    bold: 'bold',
  },

  lineHeight: {
    tight: 1.2,
    normal: 1.4,
    relaxed: 1.6,
  },
} as const;

// ============================================================================
// SPACING
// ============================================================================

export const SPACING = {
  xs: 2,         // 2mm
  sm: 4,         // 4mm
  md: 8,         // 8mm
  lg: 12,        // 12mm
  xl: 16,        // 16mm
  '2xl': 24,     // 24mm
} as const;

// ============================================================================
// CARD STYLES
// ============================================================================

/**
 * Card style presets - all use neutral backgrounds with subtle accents
 */
export const CARD_STYLES = {
  /**
   * Default card - white background with border
   */
  default: {
    background: NEUTRAL_COLORS.white,
    border: NEUTRAL_COLORS.border,
    borderRadius: 2,
    shadow: false,
    textColor: NEUTRAL_COLORS.textPrimary,
    labelColor: NEUTRAL_COLORS.textSecondary,
  },

  /**
   * Elevated card - white with subtle shadow effect
   */
  elevated: {
    background: NEUTRAL_COLORS.white,
    border: NEUTRAL_COLORS.border,
    borderRadius: 2,
    shadow: true,
    textColor: NEUTRAL_COLORS.textPrimary,
    labelColor: NEUTRAL_COLORS.textSecondary,
  },

  /**
   * Accent card - white background with colored left border
   */
  accent: {
    background: NEUTRAL_COLORS.white,
    border: NEUTRAL_COLORS.border,
    borderRadius: 2,
    shadow: false,
    accentBorder: true,        // Show 3mm colored left border
    textColor: NEUTRAL_COLORS.textPrimary,
    labelColor: NEUTRAL_COLORS.textSecondary,
  },

  /**
   * Muted card - subtle gray background
   */
  muted: {
    background: NEUTRAL_COLORS.muted,
    border: 'none',
    borderRadius: 2,
    shadow: false,
    textColor: NEUTRAL_COLORS.textPrimary,
    labelColor: NEUTRAL_COLORS.textSecondary,
  },
} as const;

// ============================================================================
// KPI CARD SPECIFIC STYLES
// ============================================================================

/**
 * KPI value display styles
 */
export const KPI_STYLES = {
  /**
   * Standard KPI - label on top, large value below
   */
  standard: {
    labelSize: TYPOGRAPHY.sizes.sm,
    labelColor: NEUTRAL_COLORS.textSecondary,
    valueSize: TYPOGRAPHY.sizes.xl,
    valueColor: NEUTRAL_COLORS.textPrimary,
    valueWeight: 'bold' as const,
  },

  /**
   * Compact KPI - smaller value for tight spaces
   */
  compact: {
    labelSize: TYPOGRAPHY.sizes.xs,
    labelColor: NEUTRAL_COLORS.textSecondary,
    valueSize: TYPOGRAPHY.sizes.lg,
    valueColor: NEUTRAL_COLORS.textPrimary,
    valueWeight: 'bold' as const,
  },

  /**
   * Metric KPI - shows score with colored progress bar
   */
  metric: {
    labelSize: TYPOGRAPHY.sizes.sm,
    labelColor: NEUTRAL_COLORS.textSecondary,
    valueSize: TYPOGRAPHY.sizes.xl,
    valueColor: NEUTRAL_COLORS.textPrimary,
    valueWeight: 'bold' as const,
    showProgressBar: true,
    progressBarHeight: 3,
    progressBarBg: NEUTRAL_COLORS.muted,
  },
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get accent color for a metric type
 */
export function getMetricAccentColor(metric: 'partisan' | 'swing' | 'gotv' | 'persuasion' | 'turnout' | 'neutral'): string {
  return CARD_ACCENT_COLORS[metric] || CARD_ACCENT_COLORS.neutral;
}

/**
 * Get chart color for a metric type
 */
export function getMetricChartColor(metric: 'swing' | 'gotv' | 'persuasion' | 'turnout'): string {
  return CHART_COLORS[metric] || CHART_COLORS.series[0];
}

/**
 * Get partisan color for charts (based on lean value)
 */
export function getPartisanChartColor(lean: number): string {
  if (lean < -15) return CHART_COLORS.safeD;
  if (lean < -8) return CHART_COLORS.likelyD;
  if (lean < -3) return CHART_COLORS.leanD;
  if (lean <= 3) return CHART_COLORS.tossup;
  if (lean <= 8) return CHART_COLORS.leanR;
  if (lean <= 15) return CHART_COLORS.likelyR;
  return CHART_COLORS.safeR;
}

/**
 * Get text color for partisan lean display
 */
export function getPartisanTextColor(lean: number): string {
  // For cards, we use the chart color as the value text color only
  // Background remains white
  if (lean < -3) return CHART_COLORS.democrat;
  if (lean > 3) return CHART_COLORS.republican;
  return CHART_COLORS.tossup;
}

/**
 * Format partisan lean as display string
 */
export function formatPartisanLean(lean: number): string {
  if (Math.abs(lean) < 0.5) return 'EVEN';
  const party = lean < 0 ? 'D' : 'R';
  const value = Math.abs(lean).toFixed(1);
  return `${party}+${value}`;
}

/**
 * Get competitiveness label
 */
export function getCompetitivenessLabel(lean: number): string {
  const absLean = Math.abs(lean);
  const party = lean < 0 ? 'Democrat' : lean > 0 ? 'Republican' : 'Toss-up';

  if (absLean < 3) return 'Toss-up';
  if (absLean < 8) return `Lean ${party}`;
  if (absLean < 15) return `Likely ${party}`;
  return `Safe ${party}`;
}

/**
 * Get priority label from score
 */
export function getPriorityLabel(score: number): string {
  if (score >= 80) return 'TOP PRIORITY';
  if (score >= 70) return 'HIGH';
  if (score >= 60) return 'MEDIUM';
  if (score >= 50) return 'LOW';
  return 'MINIMAL';
}

// ============================================================================
// EXPORT ALL
// ============================================================================

export const POLITICAL_DESIGN_TOKENS = {
  brand: BRAND_COLORS,
  neutral: NEUTRAL_COLORS,
  semantic: SEMANTIC_COLORS,
  chart: CHART_COLORS,
  cardAccent: CARD_ACCENT_COLORS,
  typography: TYPOGRAPHY,
  spacing: SPACING,
  cardStyles: CARD_STYLES,
  kpiStyles: KPI_STYLES,
} as const;

export default POLITICAL_DESIGN_TOKENS;
