/**
 * Political KPI Card Component for PDF Reports
 *
 * Renders visually appealing KPI cards with political styling,
 * supporting partisan lean display, score bars, and metric-specific colors.
 *
 * Design Philosophy (v2):
 * - Subdued backgrounds (white/light gray) for all cards
 * - Bright colors ONLY for accents (left border, text values, progress bars)
 * - Clean, professional appearance
 *
 * Features:
 * - Partisan lean cards (D+5.2 format with colored text on white background)
 * - Score cards (0-100 with colored progress bar)
 * - Metric cards (turnout, voters, etc.)
 * - Trend indicators
 *
 * @version 2.0.0
 * @lastUpdated 2025-12-18
 */

import jsPDF from 'jspdf';
import {
  POLITICAL_COLORS,
  FONT_SPECS,
  getPartisanColor,
  formatPartisanLean,
  getCompetitivenessLabel,
  getPriorityLabel,
} from '../templates/PoliticalPageTemplates';
import {
  NEUTRAL_COLORS,
  CHART_COLORS,
  TYPOGRAPHY,
  getMetricChartColor,
  getPartisanTextColor,
} from '../design/PoliticalDesignTokens';
import { hexToRGB, darkenColor, formatValue, type NumberFormat } from '../utils';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface PoliticalKPICardOptions {
  /** Card label (top text) */
  label: string;
  /** Card value (main text) */
  value: string;
  /** Optional trend indicator (e.g., "+2.3 pts") */
  trend?: string;
  /** Trend direction for coloring */
  trendDirection?: 'up' | 'down' | 'neutral';
  /** Card style variant */
  variant?: 'filled' | 'outline' | 'gradient';
  /** Background color override */
  backgroundColor?: string;
  /** Text color override */
  textColor?: string;
  /** Show score bar for 0-100 values */
  showScoreBar?: boolean;
  /** Score value for bar (0-100) */
  score?: number;
  /** Score bar color */
  scoreColor?: string;
}

export interface PartisanLeanCardOptions {
  /** Partisan lean value (-100 to +100, negative = D, positive = R) */
  lean: number;
  /** Optional confidence percentage */
  confidence?: number;
  /** Number of elections analyzed */
  electionsCount?: number;
}

export interface ScoreCardOptions {
  /** Score value (0-100) */
  score: number;
  /** Metric type for color */
  metric: 'swing' | 'gotv' | 'persuasion' | 'turnout' | 'combined';
  /** Card label */
  label: string;
  /** Optional sublabel */
  sublabel?: string;
}

export interface StatCardOptions {
  /** Card label */
  label: string;
  /** Value to display */
  value: string | number;
  /** Format type */
  format?: 'number' | 'currency' | 'percent' | 'plain';
  /** Optional icon/indicator */
  icon?: string;
}

// ============================================================================
// MAIN COMPONENT FUNCTIONS
// ============================================================================

/**
 * Render a standard political KPI card
 */
export function renderPoliticalKPICard(
  pdf: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  options: PoliticalKPICardOptions
): void {
  const {
    label,
    value,
    trend,
    trendDirection = 'neutral',
    variant = 'filled',
    backgroundColor = POLITICAL_COLORS.primary,
    textColor = POLITICAL_COLORS.white,
    showScoreBar = false,
    score = 0,
    scoreColor = POLITICAL_COLORS.accent,
  } = options;

  // Save current state
  const savedFont = pdf.getFont();
  const savedFontSize = pdf.getFontSize();

  // Draw background based on variant
  if (variant === 'filled') {
    const bgRGB = hexToRGB(backgroundColor);
    pdf.setFillColor(bgRGB.r, bgRGB.g, bgRGB.b);
    pdf.rect(x, y, width, height, 'F');
  } else if (variant === 'outline') {
    const borderRGB = hexToRGB(backgroundColor);
    pdf.setDrawColor(borderRGB.r, borderRGB.g, borderRGB.b);
    pdf.setLineWidth(0.5);
    pdf.rect(x, y, width, height, 'S');
  } else if (variant === 'gradient') {
    // Simulate gradient with solid color (jsPDF doesn't support gradients natively)
    const bgRGB = hexToRGB(backgroundColor);
    pdf.setFillColor(bgRGB.r, bgRGB.g, bgRGB.b);
    pdf.rect(x, y, width, height, 'F');
  }

  // Determine text colors based on variant
  const labelColor = variant === 'outline' ? POLITICAL_COLORS.textSecondary : textColor;
  const valueColor = variant === 'outline' ? POLITICAL_COLORS.textPrimary : textColor;

  // Calculate vertical layout
  const hasScoreBar = showScoreBar && score !== undefined;
  const hasTrend = trend !== undefined;
  const contentHeight = 4 + 6 + (hasTrend ? 3 : 0) + (hasScoreBar ? 5 : 0); // Approximate
  const startY = y + (height - contentHeight) / 2;

  // Draw label
  const labelRGB = hexToRGB(labelColor);
  pdf.setTextColor(labelRGB.r, labelRGB.g, labelRGB.b);
  pdf.setFontSize(8);
  pdf.setFont(FONT_SPECS.family, 'normal');

  const labelLines = pdf.splitTextToSize(label, width - 4);
  let currentY = startY + 4;
  labelLines.forEach((line: string, index: number) => {
    pdf.text(line, x + width / 2, currentY + index * 3, { align: 'center' });
  });
  currentY += labelLines.length * 3 + 2;

  // Draw value
  const valueRGB = hexToRGB(valueColor);
  pdf.setTextColor(valueRGB.r, valueRGB.g, valueRGB.b);
  pdf.setFontSize(16);
  pdf.setFont(FONT_SPECS.family, 'bold');

  const valueLines = pdf.splitTextToSize(value, width - 4);
  valueLines.forEach((line: string, index: number) => {
    pdf.text(line, x + width / 2, currentY + index * 5, { align: 'center' });
  });
  currentY += valueLines.length * 5 + 2;

  // Draw score bar if enabled
  if (hasScoreBar) {
    const barX = x + 4;
    const barY = currentY;
    const barWidth = width - 8;
    const barHeight = 3;

    // Background bar
    const bgBarRGB = hexToRGB(darkenColor(backgroundColor, 20));
    pdf.setFillColor(bgBarRGB.r, bgBarRGB.g, bgBarRGB.b);
    pdf.rect(barX, barY, barWidth, barHeight, 'F');

    // Score fill
    const scoreRGB = hexToRGB(scoreColor);
    pdf.setFillColor(scoreRGB.r, scoreRGB.g, scoreRGB.b);
    pdf.rect(barX, barY, barWidth * (score / 100), barHeight, 'F');

    currentY += barHeight + 2;
  }

  // Draw trend indicator
  if (hasTrend) {
    const trendColors = {
      up: '#10B981',     // Green
      down: '#EF4444',   // Red
      neutral: variant === 'outline' ? POLITICAL_COLORS.textMuted : textColor,
    };
    const trendRGB = hexToRGB(trendColors[trendDirection]);
    pdf.setTextColor(trendRGB.r, trendRGB.g, trendRGB.b);
    pdf.setFontSize(8);
    pdf.setFont(FONT_SPECS.family, 'normal');

    const arrow = trendDirection === 'up' ? '▲' : trendDirection === 'down' ? '▼' : '';
    pdf.text(`${arrow} ${trend}`, x + width / 2, currentY, { align: 'center' });
  }

  // Restore state
  pdf.setFont(savedFont.fontName, savedFont.fontStyle);
  pdf.setFontSize(savedFontSize);
  pdf.setTextColor(0, 0, 0);
}

/**
 * Render a partisan lean card with subdued design
 * White background with colored text value and left accent border
 */
export function renderPartisanLeanCard(
  pdf: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  options: PartisanLeanCardOptions
): void {
  const { lean, confidence, electionsCount } = options;

  const partisanColor = getPartisanColor(lean);
  const displayValue = formatPartisanLean(lean);
  const classification = getCompetitivenessLabel(lean);

  // Save state
  const savedFont = pdf.getFont();
  const savedFontSize = pdf.getFontSize();

  // White background
  const bgRGB = hexToRGB(NEUTRAL_COLORS.white);
  pdf.setFillColor(bgRGB.r, bgRGB.g, bgRGB.b);
  pdf.roundedRect(x, y, width, height, 2, 2, 'F');

  // Border
  const borderRGB = hexToRGB(NEUTRAL_COLORS.border);
  pdf.setDrawColor(borderRGB.r, borderRGB.g, borderRGB.b);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(x, y, width, height, 2, 2, 'S');

  // Colored left accent border
  const accentRGB = hexToRGB(partisanColor);
  pdf.setFillColor(accentRGB.r, accentRGB.g, accentRGB.b);
  pdf.rect(x, y + 2, 3, height - 4, 'F');

  // Label
  const labelRGB = hexToRGB(NEUTRAL_COLORS.textSecondary);
  pdf.setTextColor(labelRGB.r, labelRGB.g, labelRGB.b);
  pdf.setFontSize(TYPOGRAPHY.sizes.sm);
  pdf.setFont(FONT_SPECS.family, 'normal');
  pdf.text('Partisan Lean', x + width / 2, y + 10, { align: 'center' });

  // Value in partisan color
  const valueRGB = hexToRGB(partisanColor);
  pdf.setTextColor(valueRGB.r, valueRGB.g, valueRGB.b);
  pdf.setFontSize(18);
  pdf.setFont(FONT_SPECS.family, 'bold');
  pdf.text(displayValue, x + width / 2, y + 28, { align: 'center' });

  // Classification
  const classRGB = hexToRGB(NEUTRAL_COLORS.textMuted);
  pdf.setTextColor(classRGB.r, classRGB.g, classRGB.b);
  pdf.setFontSize(TYPOGRAPHY.sizes.xs);
  pdf.setFont(FONT_SPECS.family, 'normal');
  pdf.text(classification, x + width / 2, y + 38, { align: 'center' });

  // Confidence/elections if provided
  if (confidence !== undefined || electionsCount !== undefined) {
    let infoText = '';
    if (confidence !== undefined && electionsCount !== undefined) {
      infoText = `${confidence}% conf. • ${electionsCount} elections`;
    } else if (confidence !== undefined) {
      infoText = `${confidence}% confidence`;
    } else if (electionsCount !== undefined) {
      infoText = `${electionsCount} elections analyzed`;
    }
    pdf.text(infoText, x + width / 2, y + height - 6, { align: 'center' });
  }

  // Restore state
  pdf.setFont(savedFont.fontName, savedFont.fontStyle);
  pdf.setFontSize(savedFontSize);
  pdf.setTextColor(0, 0, 0);
}

/**
 * Render a score card with subdued design
 * White background with colored progress bar and value
 */
export function renderScoreCard(
  pdf: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  options: ScoreCardOptions
): void {
  const { score, metric, label, sublabel } = options;

  const metricColors: Record<string, string> = {
    swing: CHART_COLORS.swing,
    gotv: CHART_COLORS.gotv,
    persuasion: CHART_COLORS.persuasion,
    turnout: CHART_COLORS.turnout,
    combined: CHART_COLORS.series[0],
  };

  const accentColor = metricColors[metric] || CHART_COLORS.series[0];
  const priorityLabel = getPriorityLabel(score);

  // Save state
  const savedFont = pdf.getFont();
  const savedFontSize = pdf.getFontSize();

  // White background
  const bgRGB = hexToRGB(NEUTRAL_COLORS.white);
  pdf.setFillColor(bgRGB.r, bgRGB.g, bgRGB.b);
  pdf.roundedRect(x, y, width, height, 2, 2, 'F');

  // Border
  const borderRGB = hexToRGB(NEUTRAL_COLORS.border);
  pdf.setDrawColor(borderRGB.r, borderRGB.g, borderRGB.b);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(x, y, width, height, 2, 2, 'S');

  // Colored left accent border
  const accentRGB = hexToRGB(accentColor);
  pdf.setFillColor(accentRGB.r, accentRGB.g, accentRGB.b);
  pdf.rect(x, y + 2, 3, height - 4, 'F');

  // Label
  const labelRGB = hexToRGB(NEUTRAL_COLORS.textSecondary);
  pdf.setTextColor(labelRGB.r, labelRGB.g, labelRGB.b);
  pdf.setFontSize(TYPOGRAPHY.sizes.sm);
  pdf.setFont(FONT_SPECS.family, 'normal');
  pdf.text(label, x + width / 2, y + 10, { align: 'center' });

  // Score value in accent color
  const valueRGB = hexToRGB(accentColor);
  pdf.setTextColor(valueRGB.r, valueRGB.g, valueRGB.b);
  pdf.setFontSize(16);
  pdf.setFont(FONT_SPECS.family, 'bold');
  pdf.text(`${Math.round(score)}/100`, x + width / 2, y + 26, { align: 'center' });

  // Progress bar
  const barX = x + 8;
  const barY = y + 32;
  const barWidth = width - 16;
  const barHeight = 4;

  // Background bar
  const barBgRGB = hexToRGB(NEUTRAL_COLORS.muted);
  pdf.setFillColor(barBgRGB.r, barBgRGB.g, barBgRGB.b);
  pdf.roundedRect(barX, barY, barWidth, barHeight, 1, 1, 'F');

  // Score fill
  const scoreWidth = (score / 100) * barWidth;
  if (scoreWidth > 0) {
    pdf.setFillColor(accentRGB.r, accentRGB.g, accentRGB.b);
    pdf.roundedRect(barX, barY, scoreWidth, barHeight, 1, 1, 'F');
  }

  // Priority label
  const subRGB = hexToRGB(NEUTRAL_COLORS.textMuted);
  pdf.setTextColor(subRGB.r, subRGB.g, subRGB.b);
  pdf.setFontSize(TYPOGRAPHY.sizes.xs);
  pdf.setFont(FONT_SPECS.family, 'normal');
  pdf.text(sublabel || priorityLabel, x + width / 2, y + height - 6, { align: 'center' });

  // Restore state
  pdf.setFont(savedFont.fontName, savedFont.fontStyle);
  pdf.setFontSize(savedFontSize);
  pdf.setTextColor(0, 0, 0);
}

/**
 * Render a stat card with outline style
 */
export function renderStatCard(
  pdf: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  options: StatCardOptions
): void {
  const { label, value, format = 'number', icon } = options;

  const displayValue = typeof value === 'number' ? formatValue(value, format) : value;

  renderPoliticalKPICard(pdf, x, y, width, height, {
    label: icon ? `${icon} ${label}` : label,
    value: displayValue,
    variant: 'outline',
    backgroundColor: POLITICAL_COLORS.border,
    textColor: POLITICAL_COLORS.textPrimary,
  });
}

/**
 * Render a grid of political KPI cards
 */
export function renderPoliticalKPICardGrid(
  pdf: jsPDF,
  startX: number,
  startY: number,
  cards: Array<{
    type: 'kpi' | 'partisan' | 'score' | 'stat';
    options: PoliticalKPICardOptions | PartisanLeanCardOptions | ScoreCardOptions | StatCardOptions;
  }>,
  columns: number = 2,
  cardWidth: number = 85,
  cardHeight: number = 28,
  gapX: number = 10,
  gapY: number = 6
): void {
  cards.forEach((card, index) => {
    const row = Math.floor(index / columns);
    const col = index % columns;

    const x = startX + col * (cardWidth + gapX);
    const y = startY + row * (cardHeight + gapY);

    switch (card.type) {
      case 'partisan':
        renderPartisanLeanCard(pdf, x, y, cardWidth, cardHeight, card.options as PartisanLeanCardOptions);
        break;
      case 'score':
        renderScoreCard(pdf, x, y, cardWidth, cardHeight, card.options as ScoreCardOptions);
        break;
      case 'stat':
        renderStatCard(pdf, x, y, cardWidth, cardHeight, card.options as StatCardOptions);
        break;
      default:
        renderPoliticalKPICard(pdf, x, y, cardWidth, cardHeight, card.options as PoliticalKPICardOptions);
    }
  });
}

/**
 * Render the 4-card cover page grid (partisan, swing, turnout, voters)
 */
export function renderCoverPageKPIGrid(
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
  renderPartisanLeanCard(pdf, startX, startY, cardWidth, cardHeight, {
    lean: data.partisanLean,
    confidence: data.confidence,
    electionsCount: data.electionsCount,
  });

  renderScoreCard(pdf, startX + cardWidth + gapX, startY, cardWidth, cardHeight, {
    score: data.swingPotential,
    metric: 'swing',
    label: 'Swing Potential',
  });

  // Row 2: Avg Turnout, Registered Voters
  renderPoliticalKPICard(pdf, startX, startY + cardHeight + gapY, cardWidth, cardHeight, {
    label: 'Avg Turnout',
    value: `${data.avgTurnout.toFixed(1)}%`,
    backgroundColor: POLITICAL_COLORS.turnout,
    textColor: POLITICAL_COLORS.white,
    variant: 'filled',
  });

  renderPoliticalKPICard(pdf, startX + cardWidth + gapX, startY + cardHeight + gapY, cardWidth, cardHeight, {
    label: 'Registered Voters',
    value: data.registeredVoters.toLocaleString(),
    backgroundColor: POLITICAL_COLORS.primary,
    textColor: POLITICAL_COLORS.white,
    variant: 'filled',
  });
}

/**
 * Render a mini stat row (4 cards in a row)
 */
export function renderMiniStatRow(
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
    renderStatCard(pdf, x, startY, cardWidth, cardHeight, {
      label: stat.label,
      value: stat.value,
      format: stat.format,
    });
  });
}
