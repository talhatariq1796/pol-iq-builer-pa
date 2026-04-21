import { VisualizationRendererStrategy, ProcessedAnalysisData, VisualizationResult, VisualizationConfig } from '../../types';
import { ACTIVE_COLOR_SCHEME, STANDARD_OPACITY } from '@/utils/renderer-standardization';

/**
 * SymbolRenderer - Single symbol visualization for all features
 *
 * Features:
 * - Uniform symbol rendering
 * - Customizable marker styles
 * - Simple, clean visualization
 */
export class SymbolRenderer implements VisualizationRendererStrategy {

  supportsType(type: string): boolean {
    return type === 'symbol';
  }

  render(data: ProcessedAnalysisData, config: VisualizationConfig): VisualizationResult {
    console.log(`[SymbolRenderer] Rendering ${data.records.length} features with uniform symbols`);

    // Determine symbol type from config or data
    const symbolType = this.determineSymbolType(data, config);

    // Create simple symbol renderer
    const renderer = this.createSymbolRenderer(symbolType, config);

    // Generate popup template
    const popupTemplate = this.createPopupTemplate(data, config);

    // Create simple legend
    const legend = this.createLegend(data, config);

    return {
      type: 'symbol',
      config: {
        ...config,
        symbolType
      },
      renderer,
      popupTemplate,
      legend
    };
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private determineSymbolType(data: ProcessedAnalysisData, config: VisualizationConfig): 'point' | 'polygon' {
    // Check config first
    const geometryType = (config as any).geometryType;
    if (geometryType === 'point' || geometryType === 'polygon') {
      return geometryType;
    }

    // Default to point for symbol renderer
    return 'point';
  }

  private createSymbolRenderer(symbolType: 'point' | 'polygon', config: VisualizationConfig): any {
    const color = (config as any).color || ACTIVE_COLOR_SCHEME[2]; // Default to medium green

    if (symbolType === 'polygon') {
      return {
        type: 'simple',
        symbol: {
          type: 'simple-fill',
          color: this.parseColor(color, STANDARD_OPACITY),
          outline: {
            color: [0, 0, 0, 0],
            width: 0
          }
        }
      };
    }

    // Point symbols
    return {
      type: 'simple',
      symbol: {
        type: 'simple-marker',
        style: (config as any).markerStyle || 'circle',
        color: this.parseColor(color, 0.8),
        size: (config as any).size || 12,
        outline: {
          color: [255, 255, 255, 0.8],
          width: 1
        }
      },
      _useCentroids: true
    };
  }

  private createPopupTemplate(data: ProcessedAnalysisData, config: VisualizationConfig): any {
    return {
      title: '{' + (config.labelField || 'area_name') + '}',
      content: [
        {
          type: 'fields',
          fieldInfos: [
            {
              fieldName: config.valueField || 'value',
              label: data.targetVariable || 'Value',
              format: {
                digitSeparator: true,
                places: 2
              }
            }
          ]
        }
      ],
      outFields: ['*'],
      returnGeometry: true
    };
  }

  private createLegend(data: ProcessedAnalysisData, config: VisualizationConfig): any {
    const color = (config as any).color || ACTIVE_COLOR_SCHEME[2];

    return {
      title: data.targetVariable || 'Features',
      items: [
        {
          label: `${data.records.length} areas`,
          color: color,
          value: 0
        }
      ],
      position: 'bottom-right'
    };
  }

  private parseColor(color: string, opacity: number): number[] {
    // Handle hex colors
    if (color.startsWith('#')) {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
      if (result) {
        return [
          parseInt(result[1], 16),
          parseInt(result[2], 16),
          parseInt(result[3], 16),
          opacity
        ];
      }
    }

    // Handle rgba colors
    if (color.startsWith('rgba')) {
      const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (match) {
        return [
          parseInt(match[1]),
          parseInt(match[2]),
          parseInt(match[3]),
          opacity
        ];
      }
    }

    // Default fallback
    return [128, 128, 128, opacity];
  }
}
