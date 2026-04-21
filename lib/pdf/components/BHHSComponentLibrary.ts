import jsPDF from 'jspdf';
import { GridSystem } from '../core/GridSystem';
import { ModernColorPalette, hexToRgb } from '../design/ModernColorPalette';

/**
 * BHHS Branded Component Library for CMA PDF Reports
 * Modern infographic-style components with BHHS burgundy color palette
 */
export class BHHSComponentLibrary {
  private grid: GridSystem;
  private colors = ModernColorPalette;

  constructor() {
    this.grid = new GridSystem();
  }

  /**
   * Render branded page header with BHHS logo (minimal maroon usage)
   */
  renderBrandHeader(
    pdf: jsPDF,
    y: number,
    pageTitle: string,
    logoBase64?: string
  ): void {
    const pageWidth = pdf.internal.pageSize.getWidth();

    // Light background (very subtle)
    const bg = hexToRgb(ModernColorPalette.background.subtle);
    if (bg) pdf.setFillColor(bg[0], bg[1], bg[2]);
    pdf.rect(0, y, pageWidth, 25, 'F');

    // Logo (text-based fallback if no base64 provided)
    if (logoBase64) {
      pdf.addImage(logoBase64, 'PNG', 12, y + 8, 27, 10);
    } else {
      // Text-based logo fallback (burgundy for brand identity)
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'bold');
      const burgundy = hexToRgb(ModernColorPalette.primary);
      if (burgundy) pdf.setTextColor(burgundy[0], burgundy[1], burgundy[2]);
      pdf.text('BERKSHIRE HATHAWAY', 12, y + 12);
      pdf.setFontSize(6);
      pdf.setFont('helvetica', 'normal');
      pdf.text('HomeServices', 12, y + 16);
    }

    // Page title (burgundy for visual interest - brand color)
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    const titleColor = hexToRgb(ModernColorPalette.primary);
    if (titleColor) pdf.setTextColor(titleColor[0], titleColor[1], titleColor[2]);
    const titleWidth = pdf.getTextWidth(pageTitle);
    pdf.text(pageTitle, pageWidth - 15 - titleWidth, y + 15);

    // Bottom border (light gray)
    const border = hexToRgb(ModernColorPalette.border.light);
    if (border) pdf.setDrawColor(border[0], border[1], border[2]);
    pdf.setLineWidth(0.5);
    pdf.line(15, y + 25, pageWidth - 15, y + 25);

    // Reset text color
    const text = hexToRgb(ModernColorPalette.text.dark);
    if (text) pdf.setTextColor(text[0], text[1], text[2]);
  }

  /**
   * Render section header with gradient background (burgundy tints - brand colors)
   */
  renderSectionHeader(
    pdf: jsPDF,
    x: number,
    y: number,
    width: number,
    title: string,
    icon?: string,
    colorScheme: 'burgundy' | 'light' | 'accent' = 'burgundy'
  ): void {
    const height = 15;

    // Choose color based on scheme (using burgundy brand palette)
    const baseColorHex = colorScheme === 'burgundy' ? ModernColorPalette.primary :
                         colorScheme === 'light' ? ModernColorPalette.border.light :
                         ModernColorPalette.chart.primary; // Use chart primary instead of teal

    const baseColor = hexToRgb(baseColorHex);

    // Simple gradient background (light to darker burgundy)
    if (colorScheme === 'burgundy') {
      // Burgundy gradient
      const lightBg = hexToRgb(ModernColorPalette.primaryTints.lightest);
      const mediumBg = hexToRgb(ModernColorPalette.primaryTints.light);
      const darkBg = hexToRgb(ModernColorPalette.primary);

      if (lightBg) pdf.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
      pdf.rect(x, y, width * 0.4, height, 'F');

      if (mediumBg) pdf.setFillColor(mediumBg[0], mediumBg[1], mediumBg[2]);
      pdf.rect(x + width * 0.4, y, width * 0.3, height, 'F');

      if (darkBg) pdf.setFillColor(darkBg[0], darkBg[1], darkBg[2]);
      pdf.rect(x + width * 0.7, y, width * 0.3, height, 'F');
    } else if (baseColor) {
      // Solid color for light scheme
      pdf.setFillColor(baseColor[0], baseColor[1], baseColor[2]);
      pdf.rect(x, y, width, height, 'F');
    }

    // Icon (if provided)
    if (icon) {
      pdf.setFontSize(10);
      pdf.setTextColor(255, 255, 255);
      pdf.text(icon, x + 10, y + 10);
    }

    // Title text
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(255, 255, 255); // white text
    pdf.text(title, x + (icon ? 25 : 10), y + 10);

    // Reset
    const text = hexToRgb(ModernColorPalette.text.dark);
    if (text) pdf.setTextColor(text[0], text[1], text[2]);
  }

  /**
   * Render KPI card with value, label, and trend indicator
   * Uses burgundy colors instead of teal
   */
  renderKPICard(
    pdf: jsPDF,
    x: number,
    y: number,
    width: number,
    height: number,
    config: {
      value: string;
      label: string;
      secondaryLabel?: string;
      trend?: { value: string; direction: 'up' | 'down' | 'neutral' };
      colorIndex?: number; // Use chart color palette
      icon?: string;
    }
  ): void {
    // Use chart colors for variety
    const chartColors = [
      ModernColorPalette.chart.primary,
      ModernColorPalette.chart.secondary,
      ModernColorPalette.chart.tertiary,
      ModernColorPalette.chart.quaternary,
    ];

    const accentColorHex = config.colorIndex !== undefined
      ? chartColors[config.colorIndex % chartColors.length]
      : ModernColorPalette.chart.primary;

    const accentColor = hexToRgb(accentColorHex);

    // Card background (very light burgundy tint)
    const bgColor = hexToRgb(ModernColorPalette.chart.background);
    if (bgColor) pdf.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
    pdf.roundedRect(x, y, width, height, 4, 4, 'F');

    // Card border
    const border = hexToRgb(ModernColorPalette.border.light);
    if (border) pdf.setDrawColor(border[0], border[1], border[2]);
    pdf.setLineWidth(0.5);
    pdf.roundedRect(x, y, width, height, 4, 4, 'S');

    // Left accent border
    if (accentColor) pdf.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
    pdf.rect(x, y, 3, height, 'F');

    // Icon (top-left)
    if (config.icon && accentColor) {
      pdf.setFontSize(12);
      pdf.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
      pdf.text(config.icon, x + 5, y + 10);
    }

    // Label (top)
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    const textSec = hexToRgb(ModernColorPalette.text.body);
    if (textSec) pdf.setTextColor(textSec[0], textSec[1], textSec[2]);
    pdf.text(config.label, x + 8, y + 8);

    // Secondary label (if provided)
    if (config.secondaryLabel) {
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      const textLight = hexToRgb(ModernColorPalette.text.light);
      if (textLight) pdf.setTextColor(textLight[0], textLight[1], textLight[2]);
      pdf.text(config.secondaryLabel, x + 8, y + 14);
    }

    // Value (center)
    pdf.setFontSize(32);
    pdf.setFont('helvetica', 'bold');
    if (accentColor) pdf.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
    const valueY = y + height / 2 + 5;
    pdf.text(config.value, x + 8, valueY);

    // Trend indicator (bottom-right)
    if (config.trend) {
      const trendColorHex = config.trend.direction === 'up' ? ModernColorPalette.accent.success :
                            config.trend.direction === 'down' ? ModernColorPalette.accent.error :
                            ModernColorPalette.text.light;
      const trendColor = hexToRgb(trendColorHex);

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      if (trendColor) pdf.setTextColor(trendColor[0], trendColor[1], trendColor[2]);

      const arrow = config.trend.direction === 'up' ? '↑' : config.trend.direction === 'down' ? '↓' : '→';
      const trendText = `${arrow} ${config.trend.value}`;
      const trendWidth = pdf.getTextWidth(trendText);
      pdf.text(trendText, x + width - trendWidth - 8, y + height - 8);
    }

    // Reset
    const text = hexToRgb(ModernColorPalette.text.dark);
    if (text) pdf.setTextColor(text[0], text[1], text[2]);
  }

  /**
   * Get grid system instance for positioning
   */
  getGrid(): GridSystem {
    return this.grid;
  }

  /**
   * Render AI insight box with burgundy branding
   */
  renderInsightBox(
    pdf: jsPDF,
    x: number,
    y: number,
    width: number,
    insight: {
      title: string;
      content: string;
      confidence?: 'high' | 'medium' | 'low';
      icon?: string;
    }
  ): number {
    const padding = 8;

    // Calculate content height using splitTextToSize
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'italic');
    const lines = pdf.splitTextToSize(insight.content, width - 2 * padding);
    const lineHeight = 5;
    const contentHeight = lines.length * lineHeight;
    const totalHeight = contentHeight + 30; // title + content + padding

    // Burgundy gradient background for AI
    const aiBg = hexToRgb(ModernColorPalette.ai.background);
    if (aiBg) pdf.setFillColor(aiBg[0], aiBg[1], aiBg[2]);
    pdf.roundedRect(x, y, width, totalHeight, 4, 4, 'F');

    // Left accent border (solid burgundy)
    const aiAccent = hexToRgb(ModernColorPalette.ai.accent);
    if (aiAccent) pdf.setFillColor(aiAccent[0], aiAccent[1], aiAccent[2]);
    pdf.rect(x, y, 3, totalHeight, 'F');

    // Sparkle icon
    pdf.setFontSize(14);
    const aiText = hexToRgb(ModernColorPalette.ai.text);
    if (aiText) pdf.setTextColor(aiText[0], aiText[1], aiText[2]);
    pdf.text('✨', x + 8, y + 12);

    // "AI Insight" label
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.text('AI Insight', x + 20, y + 12);

    // Insight title
    pdf.setFontSize(11);
    pdf.text(insight.title, x + padding, y + 20);

    // Content (italic for AI voice)
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(10);
    const textPrimary = hexToRgb(ModernColorPalette.text.dark);
    if (textPrimary) pdf.setTextColor(textPrimary[0], textPrimary[1], textPrimary[2]);
    pdf.text(lines, x + padding, y + 28);

    // Confidence indicator
    if (insight.confidence) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      const confColorHex = insight.confidence === 'high' ? ModernColorPalette.accent.success :
                           insight.confidence === 'medium' ? ModernColorPalette.accent.warning :
                           ModernColorPalette.text.light;
      const confColor = hexToRgb(confColorHex);
      if (confColor) pdf.setTextColor(confColor[0], confColor[1], confColor[2]);
      pdf.text(`${insight.confidence.toUpperCase()} CONFIDENCE`, x + width - 60, y + totalHeight - 5);
    }

    // Reset text color
    if (textPrimary) pdf.setTextColor(textPrimary[0], textPrimary[1], textPrimary[2]);

    return totalHeight + 8; // Return height used including margin
  }

  /**
   * Render horizontal stat bar (for quick stats at bottom of cover page)
   */
  renderStatBar(
    pdf: jsPDF,
    y: number,
    stats: Array<{ icon: string; label: string; value: string }>
  ): void {
    const pageWidth = pdf.internal.pageSize.getWidth();
    const bgGray = hexToRgb(ModernColorPalette.background.subtle);
    const height = 20;

    // Light gray background
    if (bgGray) pdf.setFillColor(bgGray[0], bgGray[1], bgGray[2]);
    pdf.rect(0, y, pageWidth, height, 'F');

    // Distribute stats evenly
    const statWidth = pageWidth / stats.length;

    stats.forEach((stat, index) => {
      const x = index * statWidth;
      const centerX = x + statWidth / 2;

      // Icon (burgundy color)
      pdf.setFontSize(12);
      const iconColor = hexToRgb(ModernColorPalette.chart.primary);
      if (iconColor) pdf.setTextColor(iconColor[0], iconColor[1], iconColor[2]);
      const iconWidth = pdf.getTextWidth(stat.icon);
      pdf.text(stat.icon, centerX - iconWidth / 2, y + 8);

      // Label
      pdf.setFontSize(8);
      const textSec = hexToRgb(ModernColorPalette.text.body);
      if (textSec) pdf.setTextColor(textSec[0], textSec[1], textSec[2]);
      const labelWidth = pdf.getTextWidth(stat.label);
      pdf.text(stat.label, centerX - labelWidth / 2, y + 13);

      // Value
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      const textPrimary = hexToRgb(ModernColorPalette.text.dark);
      if (textPrimary) pdf.setTextColor(textPrimary[0], textPrimary[1], textPrimary[2]);
      const valueWidth = pdf.getTextWidth(stat.value);
      pdf.text(stat.value, centerX - valueWidth / 2, y + 18);
      pdf.setFont('helvetica', 'normal');
    });

    // Reset
    const text = hexToRgb(ModernColorPalette.text.dark);
    if (text) pdf.setTextColor(text[0], text[1], text[2]);
  }

  /**
   * Get color palette (for external access)
   */
  getColors() {
    return ModernColorPalette;
  }
}
