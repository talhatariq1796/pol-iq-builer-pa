/**
 * Renderer Standardization Utility
 * 
 * Standardizes color schemes and opacity across all renderers to match
 * the competitive analysis renderer's red-yellow-green color scheme and 0.6 opacity.
 */

// Original standard color scheme
export const STANDARD_COLOR_SCHEME = [
  '#D6191C', // Red (lowest values)
  '#FCAD61', // Orange 
  '#A6D96A', // Light Green
  '#1A9641'  // Green (highest values)
];

// Firefly color scheme (matches LayerController and SampleAreasPanel)
export const FIREFLY_COLOR_SCHEME = [
  '#ff0040', // Firefly Deep Pink (lowest values)
  '#ffbf00', // Firefly Orange 
  '#00ff40', // Firefly Lime Green
  '#00ff80'  // Firefly Bright Green (highest values)
];

// Current active color scheme (change this to switch schemes globally)
export const ACTIVE_COLOR_SCHEME = STANDARD_COLOR_SCHEME;

// Standard opacity for all renderers
export const STANDARD_OPACITY = 0.6;

/**
 * Convert hex color to RGB array with standard opacity
 */
export function hexToRgbWithOpacity(hex: string, opacity: number = STANDARD_OPACITY): number[] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    return [0, 0, 0, opacity];
  }
  return [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16),
    opacity
  ];
}

/**
 * Get standardized color stops for a given number of classes
 */
export function getStandardColorStops(numClasses: number): number[][] {
  return ACTIVE_COLOR_SCHEME.slice(0, numClasses).map(color => 
    hexToRgbWithOpacity(color)
  );
}

/**
 * Apply standard opacity to a renderer
 */
export function applyStandardOpacity(renderer: any): any {
  if (!renderer) return renderer;

  // Handle ClassBreaksRenderer
  if (renderer.type === 'class-breaks' && renderer.classBreakInfos) {
    renderer.classBreakInfos.forEach((breakInfo: any) => {
      if (breakInfo.symbol && breakInfo.symbol.color) {
        if (Array.isArray(breakInfo.symbol.color)) {
          // RGB array - set alpha to standard opacity
          if (breakInfo.symbol.color.length >= 3) {
            breakInfo.symbol.color[3] = STANDARD_OPACITY;
          }
        } else if (typeof breakInfo.symbol.color === 'string') {
          // Hex color - convert to RGB with standard opacity
          breakInfo.symbol.color = hexToRgbWithOpacity(breakInfo.symbol.color);
        }
      }
    });
  }

  // Handle SimpleRenderer
  if (renderer.type === 'simple' && renderer.symbol) {
    if (renderer.symbol.color) {
      if (Array.isArray(renderer.symbol.color)) {
        if (renderer.symbol.color.length >= 3) {
          renderer.symbol.color[3] = STANDARD_OPACITY;
        }
      } else if (typeof renderer.symbol.color === 'string') {
        renderer.symbol.color = hexToRgbWithOpacity(renderer.symbol.color);
      }
    }
  }

  // Handle UniqueValueRenderer
  if (renderer.type === 'unique-value' && renderer.uniqueValueInfos) {
    renderer.uniqueValueInfos.forEach((valueInfo: any) => {
      if (valueInfo.symbol && valueInfo.symbol.color) {
        if (Array.isArray(valueInfo.symbol.color)) {
          if (valueInfo.symbol.color.length >= 3) {
            valueInfo.symbol.color[3] = STANDARD_OPACITY;
          }
        } else if (typeof valueInfo.symbol.color === 'string') {
          valueInfo.symbol.color = hexToRgbWithOpacity(valueInfo.symbol.color);
        }
      }
    });
  }

  return renderer;
}

/**
 * Apply standard color scheme to a renderer
 */
export function applyStandardColorScheme(renderer: any, numClasses: number): any {
  if (!renderer) return renderer;

  const standardColors = getStandardColorStops(numClasses);

  // Handle ClassBreaksRenderer
  if (renderer.type === 'class-breaks' && renderer.classBreakInfos) {
    renderer.classBreakInfos.forEach((breakInfo: any, index: number) => {
      if (breakInfo.symbol && standardColors[index]) {
        breakInfo.symbol.color = standardColors[index];
      }
    });
  }

  // Handle SimpleRenderer
  if (renderer.type === 'simple' && renderer.symbol && standardColors[0]) {
    renderer.symbol.color = standardColors[0];
  }

  // Handle UniqueValueRenderer
  if (renderer.type === 'unique-value' && renderer.uniqueValueInfos) {
    renderer.uniqueValueInfos.forEach((valueInfo: any, index: number) => {
      if (valueInfo.symbol && standardColors[index]) {
        valueInfo.symbol.color = standardColors[index];
      }
    });
  }

  return renderer;
}

/**
 * Standardize a renderer with both color scheme and opacity
 */
export function standardizeRenderer(renderer: any, numClasses: number = 4): any {
  if (!renderer) return renderer;

  // Apply standard color scheme first
  const colorizedRenderer = applyStandardColorScheme(renderer, numClasses);
  
  // Then apply standard opacity
  return applyStandardOpacity(colorizedRenderer);
}

/**
 * Update createQuartileRenderer configuration to use standard colors and opacity
 */
export function getStandardQuartileConfig(config: any): any {
  return {
    ...config,
    colorStops: ACTIVE_COLOR_SCHEME.slice(0, 4).map(color => {
      const rgb = hexToRgbWithOpacity(color, 1); // Get RGB without opacity
      return [rgb[0], rgb[1], rgb[2]]; // Return just RGB array
    }),
    opacity: STANDARD_OPACITY
  };
} 