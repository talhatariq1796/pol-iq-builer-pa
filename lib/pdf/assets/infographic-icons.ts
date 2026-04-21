/**
 * Infographic Icons Library
 * Base64-encoded SVG icons for modern infographic design
 *
 * These icons match the clean, professional style from the reference design.
 * All icons are simple, flat design in single colors (blue, grey, etc.)
 */

/**
 * Chart and Graph Icons
 */
export const CHART_ICONS = {
  /**
   * Bar Chart Icon (vertical bars)
   * Usage: Market data, price distributions
   */
  barChart: 'data:image/svg+xml;base64,' + Buffer.from(`
    <svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="28" width="6" height="12" fill="#8B1538" rx="1"/>
      <rect x="16" y="20" width="6" height="20" fill="#8B1538" rx="1"/>
      <rect x="24" y="16" width="6" height="24" fill="#8B1538" rx="1"/>
      <rect x="32" y="24" width="6" height="16" fill="#8B1538" rx="1"/>
    </svg>
  `).toString('base64'),

  /**
   * Line Chart Icon (trending line)
   * Usage: Trends, time series data
   */
  lineChart: 'data:image/svg+xml;base64,' + Buffer.from(`
    <svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <polyline points="8,32 16,24 24,28 32,16 40,20" fill="none" stroke="#8B1538" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="8" cy="32" r="2.5" fill="#8B1538"/>
      <circle cx="16" cy="24" r="2.5" fill="#8B1538"/>
      <circle cx="24" cy="28" r="2.5" fill="#8B1538"/>
      <circle cx="32" cy="16" r="2.5" fill="#8B1538"/>
      <circle cx="40" cy="20" r="2.5" fill="#8B1538"/>
    </svg>
  `).toString('base64'),

  /**
   * Pie Chart Icon (segmented circle)
   * Usage: Distributions, percentages
   */
  pieChart: 'data:image/svg+xml;base64,' + Buffer.from(`
    <svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <circle cx="24" cy="24" r="16" fill="none" stroke="#E0E0E0" stroke-width="2"/>
      <path d="M24 8 A16 16 0 0 1 40 24 L24 24 Z" fill="#8B1538"/>
      <path d="M24 24 L40 24 A16 16 0 0 1 32 38 Z" fill="#A8668A"/>
      <path d="M24 24 L32 38 A16 16 0 0 1 8 24 Z" fill="#BDBDBD"/>
    </svg>
  `).toString('base64'),
};

/**
 * Property and Real Estate Icons
 */
export const PROPERTY_ICONS = {
  /**
   * House Icon
   * Usage: Property listings, real estate
   */
  house: 'data:image/svg+xml;base64,' + Buffer.from(`
    <svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 24L24 8L42 24V40H32V28H16V40H6V24Z" fill="#8B1538"/>
      <rect x="18" y="30" width="4" height="10" fill="#4D0229"/>
      <rect x="26" y="30" width="4" height="10" fill="#4D0229"/>
    </svg>
  `).toString('base64'),

  /**
   * Location Pin Icon
   * Usage: Location data, maps
   */
  locationPin: 'data:image/svg+xml;base64,' + Buffer.from(`
    <svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 4C16.268 4 10 10.268 10 18C10 28 24 44 24 44C24 44 38 28 38 18C38 10.268 31.732 4 24 4Z" fill="#8B1538"/>
      <circle cx="24" cy="18" r="6" fill="#FFFFFF"/>
    </svg>
  `).toString('base64'),

  /**
   * Key Icon
   * Usage: Key features, access
   */
  key: 'data:image/svg+xml;base64,' + Buffer.from(`
    <svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <circle cx="14" cy="14" r="8" fill="none" stroke="#8B1538" stroke-width="2"/>
      <rect x="18" y="18" width="22" height="4" fill="#8B1538" rx="2"/>
      <rect x="32" y="16" width="2" height="8" fill="#8B1538"/>
      <rect x="36" y="16" width="2" height="8" fill="#8B1538"/>
    </svg>
  `).toString('base64'),
};

/**
 * Business and Analytics Icons
 */
export const BUSINESS_ICONS = {
  /**
   * Trending Up Icon
   * Usage: Growth, positive trends
   */
  trendingUp: 'data:image/svg+xml;base64,' + Buffer.from(`
    <svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <polyline points="8,36 18,26 26,32 40,12" fill="none" stroke="#8B1538" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <polyline points="32,12 40,12 40,20" fill="none" stroke="#8B1538" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `).toString('base64'),

  /**
   * Dollar Sign Icon
   * Usage: Pricing, financial data
   */
  dollarSign: 'data:image/svg+xml;base64,' + Buffer.from(`
    <svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 4V44M18 12C18 12 18 8 24 8C30 8 30 12 30 12C30 16 24 16 24 16H24C24 16 18 16 18 20C18 20 18 24 24 24C30 24 30 20 30 20M24 16C24 16 30 16 30 20C30 24 24 24 24 24C18 24 18 20 18 20C18 16 24 16 24 16Z" stroke="#8B1538" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    </svg>
  `).toString('base64'),

  /**
   * Calendar Icon
   * Usage: Time periods, dates
   */
  calendar: 'data:image/svg+xml;base64,' + Buffer.from(`
    <svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="12" width="32" height="28" rx="2" fill="none" stroke="#8B1538" stroke-width="2"/>
      <line x1="8" y1="20" x2="40" y2="20" stroke="#8B1538" stroke-width="2"/>
      <line x1="16" y1="8" x2="16" y2="16" stroke="#8B1538" stroke-width="2" stroke-linecap="round"/>
      <line x1="32" y1="8" x2="32" y2="16" stroke="#8B1538" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `).toString('base64'),

  /**
   * Users/People Icon
   * Usage: Demographics, community
   */
  users: 'data:image/svg+xml;base64,' + Buffer.from(`
    <svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <circle cx="18" cy="14" r="6" fill="#8B1538"/>
      <path d="M8 40C8 32 12 28 18 28C24 28 28 32 28 40" fill="#8B1538"/>
      <circle cx="32" cy="16" r="5" fill="#A8668A"/>
      <path d="M24 40C24 34 27 30 32 30C37 30 40 34 40 40" fill="#A8668A"/>
    </svg>
  `).toString('base64'),
};

/**
 * UI and Navigation Icons
 */
export const UI_ICONS = {
  /**
   * Checkmark Circle Icon
   * Usage: Success, completed items
   */
  checkCircle: 'data:image/svg+xml;base64,' + Buffer.from(`
    <svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <circle cx="24" cy="24" r="18" fill="none" stroke="#8B1538" stroke-width="2"/>
      <polyline points="16,24 22,30 32,18" fill="none" stroke="#8B1538" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `).toString('base64'),

  /**
   * Alert Circle Icon
   * Usage: Warnings, important notes
   */
  alertCircle: 'data:image/svg+xml;base64,' + Buffer.from(`
    <svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <circle cx="24" cy="24" r="18" fill="none" stroke="#FF9800" stroke-width="2"/>
      <line x1="24" y1="14" x2="24" y2="26" stroke="#FF9800" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="24" cy="32" r="1.5" fill="#FF9800"/>
    </svg>
  `).toString('base64'),

  /**
   * Info Circle Icon
   * Usage: Information, help
   */
  infoCircle: 'data:image/svg+xml;base64,' + Buffer.from(`
    <svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <circle cx="24" cy="24" r="18" fill="none" stroke="#8B1538" stroke-width="2"/>
      <line x1="24" y1="22" x2="24" y2="34" stroke="#8B1538" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="24" cy="16" r="1.5" fill="#8B1538"/>
    </svg>
  `).toString('base64'),

  /**
   * Star Icon
   * Usage: Ratings, highlights
   */
  star: 'data:image/svg+xml;base64,' + Buffer.from(`
    <svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 4L28.854 17.708L43.416 19.292L33.708 28.542L36.472 43L24 36.292L11.528 43L14.292 28.542L4.584 19.292L19.146 17.708L24 4Z" fill="#8B1538"/>
    </svg>
  `).toString('base64'),
};

/**
 * Numbered Icons (for infographic-style numbered lists)
 */
export const NUMBER_ICONS = {
  /**
   * Create a numbered icon (01, 02, 03, etc.)
   * @param num - Number to display (1-99)
   * @param color - Icon color (default: light blue)
   */
  createNumberIcon: (num: number, color: string = '#8B1538'): string => {
    const numStr = num < 10 ? `0${num}` : `${num}`;
    return 'data:image/svg+xml;base64,' + Buffer.from(`
      <svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
        <text x="32" y="44" font-family="Arial, sans-serif" font-size="40" font-weight="bold" fill="${color}" text-anchor="middle">${numStr}</text>
      </svg>
    `).toString('base64');
  },
};

/**
 * Composite Icons (layered/stacked for infographic diagrams)
 */
export const COMPOSITE_ICONS = {
  /**
   * Stacked Layers Icon
   * Usage: Multi-level data, hierarchy
   */
  stackedLayers: 'data:image/svg+xml;base64,' + Buffer.from(`
    <svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="32" width="32" height="8" rx="1" fill="#8B1538"/>
      <rect x="10" y="24" width="28" height="8" rx="1" fill="#A8668A"/>
      <rect x="12" y="16" width="24" height="8" rx="1" fill="#BDBDBD"/>
      <rect x="14" y="8" width="20" height="8" rx="1" fill="#E0E0E0"/>
    </svg>
  `).toString('base64'),

  /**
   * Comparison Bars Icon
   * Usage: Comparisons, side-by-side data
   */
  comparisonBars: 'data:image/svg+xml;base64,' + Buffer.from(`
    <svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="20" width="12" height="20" fill="#8B1538" rx="1"/>
      <rect x="28" y="12" width="12" height="28" fill="#BDBDBD" rx="1"/>
      <text x="14" y="46" font-family="Arial" font-size="8" fill="#757575" text-anchor="middle">Subject</text>
      <text x="34" y="46" font-family="Arial" font-size="8" fill="#757575" text-anchor="middle">Market</text>
    </svg>
  `).toString('base64'),
};

/**
 * Export all icon categories
 */
export const INFOGRAPHIC_ICONS = {
  ...CHART_ICONS,
  ...PROPERTY_ICONS,
  ...BUSINESS_ICONS,
  ...UI_ICONS,
  ...NUMBER_ICONS,
  ...COMPOSITE_ICONS,
};

/**
 * Helper function to get icon by name
 */
export function getInfographicIcon(name: keyof typeof INFOGRAPHIC_ICONS): string {
  return INFOGRAPHIC_ICONS[name] as string;
}

/**
 * Icon size presets (in mm)
 */
export const ICON_SIZES = {
  tiny: 8,    // 8mm - small inline icons
  small: 12,  // 12mm - list icons
  medium: 16, // 16mm - section headers
  large: 24,  // 24mm - page headers
  xlarge: 32, // 32mm - hero icons
} as const;
