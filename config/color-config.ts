// Default colors for the application
export const DEFAULT_COLORS = {
  // Primary colors
  primary: {
    light: '#60a5fa',
    DEFAULT: '#3b82f6',
    dark: '#2563eb',
  },
  
  // Secondary colors
  secondary: {
    light: '#a5b4fc',
    DEFAULT: '#818cf8',
    dark: '#6366f1',
  },
  
  // Accent colors
  accent: {
    light: '#c4b5fd',
    DEFAULT: '#a78bfa',
    dark: '#8b5cf6',
  },
  
  // Neutral/gray colors
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },
  
  // Status colors
  success: {
    light: '#86efac',
    DEFAULT: '#22c55e',
    dark: '#16a34a',
  },
  error: {
    light: '#fca5a5',
    DEFAULT: '#ef4444',
    dark: '#dc2626',
  },
  warning: {
    light: '#fdba74',
    DEFAULT: '#f97316',
    dark: '#ea580c',
  },
  info: {
    light: '#7dd3fc',
    DEFAULT: '#0ea5e9',
    dark: '#0284c7',
  },
  
  // Visualization colors for maps, charts, etc.
  visualization: {
    sequential: [
      '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#084594'
    ],
    divergent: [
      '#d73027', '#fc8d59', '#fee090', '#e0f3f8', '#91bfdb', '#4575b4'
    ],
    categorical: [
      '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
      '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'
    ],
    heatmap: [
      '#ffffcc', '#ffeda0', '#fed976', '#feb24c', '#fd8d3c',
      '#fc4e2a', '#e31a1c', '#bd0026', '#800026'
    ]
  }
};

// Export a function to get a color from the configuration
export function getColor(path: string, fallback: string = '#3b82f6'): string {
  const parts = path.split('.');
  let current: any = DEFAULT_COLORS;
  
  for (const part of parts) {
    if (current[part] === undefined) {
      return fallback;
    }
    current = current[part];
  }
  
  return typeof current === 'string' ? current : fallback;
}

export default DEFAULT_COLORS;

// Color calculations for derived colors
export const adjustColor = (color: string, amount: number): string => {
  // Simple color utility to lighten/darken colors
  // In a real app, you might use a more sophisticated approach
  return color; // Placeholder for actual implementation
};

// Generate a contrasting text color based on background
export const getContrastText = (backgroundColor: string): string => {
  // Simple algorithm to determine if text should be light or dark
  // In a real app, you might calculate based on luminance
  return "#ffffff"; // Placeholder for actual implementation
};

// Color ramps for different map renderers
export const COLOR_RAMPS = {
  // Sequential ramps
  blueRamp: ["#f7fbff", "#deebf7", "#c6dbef", "#9ecae1", "#6baed6", "#4292c6", "#2171b5", "#08519c", "#08306b"],
  redRamp: ["#fff5f0", "#fee0d2", "#fcbba1", "#fc9272", "#fb6a4a", "#ef3b2c", "#cb181d", "#a50f15", "#67000d"],
  greenRamp: ["#f7fcf5", "#e5f5e0", "#c7e9c0", "#a1d99b", "#74c476", "#41ab5d", "#238b45", "#006d2c", "#00441b"],
  
  // Diverging ramps
  redBlueRamp: ["#d73027", "#f46d43", "#fdae61", "#fee090", "#ffffbf", "#e0f3f8", "#abd9e9", "#74add1", "#4575b4"],
  brownTealRamp: ["#8c510a", "#bf812d", "#dfc27d", "#f6e8c3", "#f5f5f5", "#c7eae5", "#80cdc1", "#35978f", "#01665e"],
  
  // Single-hue ramps
  blueMonochrome: ["#f7fbff", "#d0e1f2", "#a6c5e5", "#7ba9d8", "#508ccb", "#2370be", "#0355b1"],
  redMonochrome: ["#fff5f0", "#fdd6cc", "#fbb8a7", "#f99a82", "#f77c5d", "#f65e39", "#f44014"],
  greenMonochrome: ["#f7fcf5", "#d4eece", "#b0dfa7", "#8cd17f", "#67c258", "#43b230", "#1fa209"]
};

// Color utilities for modifying colors
export const colorUtils = {
  // Lighten a color by percentage (0-100)
  lighten: (color: string, percent: number): string => {
    const num = parseInt(color.slice(1), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return "#" + (
      0x1000000 +
      (R < 255 ? (R < 0 ? 0 : R) : 255) * 0x10000 +
      (G < 255 ? (G < 0 ? 0 : G) : 255) * 0x100 +
      (B < 255 ? (B < 0 ? 0 : B) : 255)
    ).toString(16).slice(1);
  },
  
  // Darken a color by percentage (0-100)
  darken: (color: string, percent: number): string => {
    return colorUtils.lighten(color, -percent);
  },
  
  // Generate a color scale between two colors
  colorScale: (startColor: string, endColor: string, steps: number): string[] => {
    const start = {
      r: parseInt(startColor.slice(1, 3), 16),
      g: parseInt(startColor.slice(3, 5), 16),
      b: parseInt(startColor.slice(5, 7), 16)
    };
    
    const end = {
      r: parseInt(endColor.slice(1, 3), 16),
      g: parseInt(endColor.slice(3, 5), 16),
      b: parseInt(endColor.slice(5, 7), 16)
    };
    
    const colors = [];
    for (let i = 0; i < steps; i++) {
      const r = Math.round(start.r + (end.r - start.r) * i / (steps - 1));
      const g = Math.round(start.g + (end.g - start.g) * i / (steps - 1));
      const b = Math.round(start.b + (end.b - start.b) * i / (steps - 1));
      colors.push(`#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`);
    }
    
    return colors;
  }
}; 