import jsPDF from 'jspdf';
import { BRAND_COLORS } from '../components/KPICard';

export interface ChartTitleOptions {
  title: string;
  emoji?: string;
  fontSize?: number;
  color?: string;
  align?: 'left' | 'center' | 'right';
  bold?: boolean;
}

/**
 * Render a chart title above a chart area
 * @param pdf - jsPDF instance
 * @param x - X position (left edge for left align, center for center align)
 * @param y - Y position (baseline of title text)
 * @param width - Width of chart area (for center alignment)
 * @param options - Title options
 */
export function renderChartTitle(
  pdf: jsPDF,
  x: number,
  y: number,
  width: number,
  options: ChartTitleOptions
): void {
  const {
    title,
    emoji = '',
    fontSize = 10,
    color = BRAND_COLORS.darkGray,
    align = 'left',
    bold = true,
  } = options;

  // Set font
  pdf.setFont('helvetica', bold ? 'bold' : 'normal');
  pdf.setFontSize(fontSize);

  // Parse color (hex or RGB)
  if (color.startsWith('#')) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    pdf.setTextColor(r, g, b);
  } else {
    // Assume it's already in RGB format or a named color
    pdf.setTextColor(color);
  }

  // Build title text
  const titleText = emoji ? `${emoji} ${title}` : title;

  // Calculate position based on alignment
  let textX = x;
  const textAlign: 'left' | 'center' | 'right' = align;

  if (align === 'center') {
    textX = x + width / 2;
  } else if (align === 'right') {
    textX = x + width;
  }

  // Render title
  pdf.text(titleText, textX, y, { align: textAlign });

  // Reset
  pdf.setTextColor(0);
  pdf.setFont('helvetica', 'normal');
}

/**
 * Common chart title presets for consistency across all pages
 */
export const CHART_TITLES = {
  // Page 2: Market Statistics
  PRICE_HISTORY: { title: 'Price History', emoji: '📈' },
  INVENTORY_TREND: { title: 'Active Inventory', emoji: '📦' },
  DAYS_ON_MARKET: { title: 'Days on Market Trend', emoji: '⏱️' },

  // Page 4: Demographics
  AGE_DISTRIBUTION: { title: 'Age Distribution', emoji: '👥' },
  INCOME_DISTRIBUTION: { title: 'Household Income', emoji: '💰' },
  EDUCATION_LEVELS: { title: 'Education Levels', emoji: '🎓' },

  // Page 5: Market Indexes
  HOT_GROWTH_INDEX: { title: 'Hot Growth Index', emoji: '🔥' },
  AFFORDABILITY_INDEX: { title: 'Affordability Index', emoji: '💵' },
  NEW_HOMEOWNERS_INDEX: { title: 'New Homeowners Index', emoji: '🏠' },
  MARKET_SCORE: { title: 'Overall Market Score', emoji: '⭐' },

  // Page 6: Market Trends
  PRICE_TREND_12MO: { title: '12-Month Price Trend', emoji: '📈' },
  INVENTORY_TREND_12MO: { title: 'Inventory Trend', emoji: '📊' },
  SUPPLY_DEMAND: { title: 'Supply & Demand Balance', emoji: '⚖️' },
};
