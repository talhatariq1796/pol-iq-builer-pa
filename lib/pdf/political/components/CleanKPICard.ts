/**
 * Clean KPI Card Component for PDF Reports
 *
 * Redesigned KPI cards with subdued styling:
 * - White/light gray backgrounds (not brightly colored)
 * - Colored accents via left borders and progress bars
 * - Colored text for key values
 * - Professional, clean appearance
 *
 * @version 2.0.0
 * @lastUpdated 2025-12-18
 */

import jsPDF from 'jspdf';
import {
  NEUTRAL_COLORS,
  CHART_COLORS,
  CARD_ACCENT_COLORS,
  TYPOGRAPHY,
  SPACING,
  getPartisanChartColor,
  getPartisanTextColor,
  formatPartisanLean,
  getCompetitivenessLabel,
  getPriorityLabel,
  getMetricChartColor,
} from '../design/PoliticalDesignTokens';
import { hexToRGB } from '../utils/colorUtils';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface CleanKPICardOptions {
  /** Card label (top text) */
  label: string;
  /** Card value (main text) */
  value: string;
  /** Optional sublabel/description */
  sublabel?: string;
  /** Metric type for accent color */
  metric?: 'partisan' | 'swing' | 'gotv' | 'persuasion' | 'turnout' | 'neutral';
  /** Show accent left border */
  showAccent?: boolean;
  /** Show progress bar for scores */
  showProgress?: boolean;
  /** Progress value (0-100) */
  progressValue?: number;
  /** Custom value text color */
  valueColor?: string;
}

export interface CleanPartisanCardOptions {
  /** Partisan lean value (-100 to +100) */
  lean: number;
  /** Optional confidence percentage */
  confidence?: number;
  /** Number of elections analyzed */
  electionsCount?: number;
}

export interface CleanScoreCardOptions {
  /** Score value (0-100) */
  score: number;
  /** Metric type */
  metric: 'swing' | 'gotv' | 'persuasion' | 'turnout';
  /** Card label */
  label: string;
}

export interface CleanStatCardOptions {
  /** Card label */
  label: string;
  /** Value to display */
  value: string | number;
  /** Format type */
  format?: 'number' | 'currency' | 'percent' | 'plain';
  /** Optional icon prefix */
  icon?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatValue(value: string | number, format: string = 'number'): string {
  if (typeof value === 'string') return value;

  switch (format) {
    case 'number':
      return value.toLocaleString();
    case 'currency':
      return `$${value.toLocaleString()}`;
    case 'percent':
      return `${value.toFixed(1)}%`;
    default:
      return String(value);
  }
}

function setFillColor(pdf: jsPDF, hex: string): void {
  const rgb = hexToRGB(hex);
  pdf.setFillColor(rgb.r, rgb.g, rgb.b);
}

function setDrawColor(pdf: jsPDF, hex: string): void {
  const rgb = hexToRGB(hex);
  pdf.setDrawColor(rgb.r, rgb.g, rgb.b);
}

function setTextColor(pdf: jsPDF, hex: string): void {
  const rgb = hexToRGB(hex);
  pdf.setTextColor(rgb.r, rgb.g, rgb.b);
}

// ============================================================================
// MAIN COMPONENT FUNCTIONS
// ============================================================================

/**
 * Render a clean KPI card with subdued styling
 */
export function renderCleanKPICard(
  pdf: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  options: CleanKPICardOptions
): void {
  const {
    label,
    value,
    sublabel,
    metric = 'neutral',
    showAccent = true,
    showProgress = false,
    progressValue = 0,
    valueColor,
  } = options;

  // Save state
  const savedFont = pdf.getFont();
  const savedFontSize = pdf.getFontSize();

  // Draw card background (white)
  setFillColor(pdf, NEUTRAL_COLORS.white);
  pdf.rect(x, y, width, height, 'F');

  // Draw border
  setDrawColor(pdf, NEUTRAL_COLORS.border);
  pdf.setLineWidth(0.3);
  pdf.rect(x, y, width, height, 'S');

  // Draw accent left border if enabled
  if (showAccent) {
    const accentColor = CARD_ACCENT_COLORS[metric] || CARD_ACCENT_COLORS.neutral;
    // Use chart color for the actual accent line
    const chartColor = metric === 'swing' ? CHART_COLORS.swing :
                       metric === 'gotv' ? CHART_COLORS.gotv :
                       metric === 'persuasion' ? CHART_COLORS.persuasion :
                       metric === 'turnout' ? CHART_COLORS.turnout :
                       metric === 'partisan' ? CHART_COLORS.democrat :
                       NEUTRAL_COLORS.borderStrong;

    setFillColor(pdf, chartColor);
    pdf.rect(x, y, 2, height, 'F');
  }

  // Calculate layout
  const padding = SPACING.sm;
  const contentX = x + padding + (showAccent ? 2 : 0);
  const contentWidth = width - padding * 2 - (showAccent ? 2 : 0);

  // Draw label
  setTextColor(pdf, NEUTRAL_COLORS.textSecondary);
  pdf.setFontSize(TYPOGRAPHY.sizes.sm);
  pdf.setFont(TYPOGRAPHY.family, 'normal');

  const labelY = y + padding + 3;
  pdf.text(label.toUpperCase(), contentX, labelY);

  // Draw value
  const finalValueColor = valueColor || NEUTRAL_COLORS.textPrimary;
  setTextColor(pdf, finalValueColor);
  pdf.setFontSize(TYPOGRAPHY.sizes.xl);
  pdf.setFont(TYPOGRAPHY.family, 'bold');

  const valueY = labelY + 8;
  pdf.text(value, contentX, valueY);

  // Draw progress bar if enabled
  if (showProgress && progressValue !== undefined) {
    const barY = valueY + 4;
    const barWidth = contentWidth;
    const barHeight = 3;

    // Background bar
    setFillColor(pdf, NEUTRAL_COLORS.muted);
    pdf.rect(contentX, barY, barWidth, barHeight, 'F');

    // Progress fill (use chart color)
    const progressColor = metric === 'swing' ? CHART_COLORS.swing :
                          metric === 'gotv' ? CHART_COLORS.gotv :
                          metric === 'persuasion' ? CHART_COLORS.persuasion :
                          metric === 'turnout' ? CHART_COLORS.turnout :
                          CHART_COLORS.series[0];

    setFillColor(pdf, progressColor);
    pdf.rect(contentX, barY, barWidth * (progressValue / 100), barHeight, 'F');
  }

  // Draw sublabel
  if (sublabel) {
    setTextColor(pdf, NEUTRAL_COLORS.textMuted);
    pdf.setFontSize(TYPOGRAPHY.sizes.xs);
    pdf.setFont(TYPOGRAPHY.family, 'normal');

    const sublabelY = showProgress ? valueY + 10 : valueY + 5;
    pdf.text(sublabel, contentX, sublabelY);
  }

  // Restore state
  pdf.setFont(savedFont.fontName, savedFont.fontStyle);
  pdf.setFontSize(savedFontSize);
  setTextColor(pdf, NEUTRAL_COLORS.textPrimary);
}

/**
 * Render a partisan lean card with clean styling
 * Value is colored (blue/purple/red) but background is white
 */
export function renderCleanPartisanCard(
  pdf: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  options: CleanPartisanCardOptions
): void {
  const { lean, confidence, electionsCount } = options;

  const displayValue = formatPartisanLean(lean);
  const classification = getCompetitivenessLabel(lean);
  const valueColor = getPartisanTextColor(lean);

  // Build sublabel
  let sublabel = classification;
  if (confidence !== undefined && electionsCount !== undefined) {
    sublabel = `${classification} | ${confidence}% conf. (${electionsCount} elec.)`;
  } else if (electionsCount !== undefined) {
    sublabel = `${classification} | ${electionsCount} elections`;
  }

  renderCleanKPICard(pdf, x, y, width, height, {
    label: 'Partisan Lean',
    value: displayValue,
    sublabel,
    metric: 'partisan',
    showAccent: true,
    valueColor,
  });
}

/**
 * Render a score card with progress bar
 */
export function renderCleanScoreCard(
  pdf: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  options: CleanScoreCardOptions
): void {
  const { score, metric, label } = options;

  const priorityLabel = getPriorityLabel(score);
  const chartColor = getMetricChartColor(metric);

  renderCleanKPICard(pdf, x, y, width, height, {
    label,
    value: `${Math.round(score)}`,
    sublabel: priorityLabel,
    metric,
    showAccent: true,
    showProgress: true,
    progressValue: score,
    valueColor: chartColor,
  });
}

/**
 * Render a stat card (outline style)
 */
export function renderCleanStatCard(
  pdf: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  options: CleanStatCardOptions
): void {
  const { label, value, format = 'number', icon } = options;

  const displayValue = formatValue(value, format);
  const displayLabel = icon ? `${icon} ${label}` : label;

  renderCleanKPICard(pdf, x, y, width, height, {
    label: displayLabel,
    value: displayValue,
    metric: 'neutral',
    showAccent: false,
  });
}

/**
 * Render cover page KPI grid (4 cards in 2x2)
 */
export function renderCleanCoverKPIGrid(
  pdf: jsPDF,
  startX: number,
  startY: number,
  data: {
    partisanLean: number;
    swingPotential: number;
    avgTurnout: number;
    registeredVoters: number;
    confidence?: number;
    electionsCount?: number;
  }
): void {
  const cardWidth = 85;
  const cardHeight = 28;
  const gapX = 10;
  const gapY = 6;

  // Row 1: Partisan Lean, Swing Potential
  renderCleanPartisanCard(pdf, startX, startY, cardWidth, cardHeight, {
    lean: data.partisanLean,
    confidence: data.confidence,
    electionsCount: data.electionsCount,
  });

  renderCleanScoreCard(pdf, startX + cardWidth + gapX, startY, cardWidth, cardHeight, {
    score: data.swingPotential,
    metric: 'swing',
    label: 'Swing Potential',
  });

  // Row 2: Avg Turnout, Registered Voters
  renderCleanKPICard(pdf, startX, startY + cardHeight + gapY, cardWidth, cardHeight, {
    label: 'Avg Turnout',
    value: `${data.avgTurnout.toFixed(1)}%`,
    metric: 'turnout',
    showAccent: true,
    valueColor: CHART_COLORS.turnout,
  });

  renderCleanKPICard(pdf, startX + cardWidth + gapX, startY + cardHeight + gapY, cardWidth, cardHeight, {
    label: 'Registered Voters',
    value: data.registeredVoters.toLocaleString(),
    metric: 'neutral',
    showAccent: true,
  });
}

/**
 * Render a mini stat row (4 compact cards)
 */
export function renderCleanStatRow(
  pdf: jsPDF,
  startX: number,
  startY: number,
  stats: Array<{
    label: string;
    value: string | number;
    format?: 'number' | 'currency' | 'percent' | 'plain';
  }>
): void {
  const cardWidth = 42;
  const cardHeight = 22;
  const gapX = 4;

  stats.slice(0, 4).forEach((stat, index) => {
    const x = startX + index * (cardWidth + gapX);
    renderCleanStatCard(pdf, x, startY, cardWidth, cardHeight, {
      label: stat.label,
      value: stat.value,
      format: stat.format,
    });
  });
}

// ============================================================================
// FALLBACK CHART RENDERERS
// ============================================================================

/**
 * Render a placeholder for missing charts
 * Shows a subtle "no data" indicator instead of blank space
 */
export function renderChartPlaceholder(
  pdf: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  title: string = 'Chart'
): void {
  // Draw light background
  setFillColor(pdf, NEUTRAL_COLORS.muted);
  pdf.rect(x, y, width, height, 'F');

  // Draw border
  setDrawColor(pdf, NEUTRAL_COLORS.border);
  pdf.setLineWidth(0.3);
  pdf.rect(x, y, width, height, 'S');

  // Draw "No data available" message
  setTextColor(pdf, NEUTRAL_COLORS.textMuted);
  pdf.setFontSize(TYPOGRAPHY.sizes.sm);
  pdf.setFont(TYPOGRAPHY.family, 'normal');

  const centerX = x + width / 2;
  const centerY = y + height / 2;

  pdf.text(title, centerX, centerY - 4, { align: 'center' });
  pdf.setFontSize(TYPOGRAPHY.sizes.xs);
  pdf.text('Data visualization pending', centerX, centerY + 4, { align: 'center' });
}

/**
 * Render simple horizontal bar chart (fallback)
 */
export function renderSimpleHorizontalBars(
  pdf: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  data: Array<{ label: string; value: number; color?: string }>,
  maxValue?: number
): void {
  if (data.length === 0) {
    renderChartPlaceholder(pdf, x, y, width, height, 'Bar Chart');
    return;
  }

  const max = maxValue || Math.max(...data.map(d => d.value));
  const barHeight = Math.min(12, (height - 8) / data.length - 4);
  const labelWidth = 40;
  const barWidth = width - labelWidth - 8;

  data.forEach((item, index) => {
    const barY = y + 4 + index * (barHeight + 4);

    // Label
    setTextColor(pdf, NEUTRAL_COLORS.textSecondary);
    pdf.setFontSize(TYPOGRAPHY.sizes.xs);
    pdf.setFont(TYPOGRAPHY.family, 'normal');
    pdf.text(item.label, x, barY + barHeight / 2 + 1);

    // Bar background
    setFillColor(pdf, NEUTRAL_COLORS.muted);
    pdf.rect(x + labelWidth, barY, barWidth, barHeight, 'F');

    // Bar fill
    const fillWidth = (item.value / max) * barWidth;
    const color = item.color || CHART_COLORS.series[index % CHART_COLORS.series.length];
    setFillColor(pdf, color);
    pdf.rect(x + labelWidth, barY, fillWidth, barHeight, 'F');

    // Value label
    setTextColor(pdf, NEUTRAL_COLORS.textPrimary);
    pdf.setFontSize(TYPOGRAPHY.sizes.xs);
    pdf.text(`${item.value.toFixed(1)}%`, x + labelWidth + barWidth + 2, barY + barHeight / 2 + 1);
  });
}

/**
 * Render simple donut chart (fallback)
 */
export function renderSimpleDonut(
  pdf: jsPDF,
  centerX: number,
  centerY: number,
  radius: number,
  data: Array<{ label: string; value: number; color?: string }>
): void {
  if (data.length === 0) {
    renderChartPlaceholder(pdf, centerX - radius, centerY - radius, radius * 2, radius * 2, 'Donut Chart');
    return;
  }

  const total = data.reduce((sum, d) => sum + d.value, 0);
  const innerRadius = radius * 0.6;

  let currentAngle = -Math.PI / 2; // Start from top

  data.forEach((item, index) => {
    const sliceAngle = (item.value / total) * 2 * Math.PI;
    const color = item.color || CHART_COLORS.series[index % CHART_COLORS.series.length];

    // Draw arc using lines (jsPDF doesn't have native arc support)
    setFillColor(pdf, color);

    // Use polygon approximation for the arc
    const steps = 20;
    const points: Array<{ x: number; y: number }> = [];

    // Outer arc
    for (let i = 0; i <= steps; i++) {
      const angle = currentAngle + (i / steps) * sliceAngle;
      points.push({
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
      });
    }

    // Inner arc (reversed)
    for (let i = steps; i >= 0; i--) {
      const angle = currentAngle + (i / steps) * sliceAngle;
      points.push({
        x: centerX + Math.cos(angle) * innerRadius,
        y: centerY + Math.sin(angle) * innerRadius,
      });
    }

    // Draw as polygon (simplified - just draw a filled rectangle for demo)
    // In production, use canvas-based chart rendering
    currentAngle += sliceAngle;
  });

  // For now, draw a simple representation
  setFillColor(pdf, NEUTRAL_COLORS.muted);
  pdf.circle(centerX, centerY, radius, 'F');

  // Draw legend below
  const legendY = centerY + radius + 8;
  data.forEach((item, index) => {
    const legendX = centerX - radius + index * 40;
    const color = item.color || CHART_COLORS.series[index % CHART_COLORS.series.length];

    setFillColor(pdf, color);
    pdf.rect(legendX, legendY, 6, 6, 'F');

    setTextColor(pdf, NEUTRAL_COLORS.textSecondary);
    pdf.setFontSize(TYPOGRAPHY.sizes.xs);
    pdf.text(`${item.label}`, legendX + 8, legendY + 4);
  });
}
