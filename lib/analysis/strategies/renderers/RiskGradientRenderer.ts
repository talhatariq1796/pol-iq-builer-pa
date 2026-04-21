import { VisualizationRendererStrategy, ProcessedAnalysisData, VisualizationResult, VisualizationConfig } from '../../types';
import { STANDARD_OPACITY } from '@/utils/renderer-standardization';

/**
 * RiskGradientRenderer - Risk-based gradient visualization
 *
 * Features:
 * - Red (high risk) to green (low risk) gradient
 * - Risk threshold indicators
 * - Warning zones for critical values
 */
export class RiskGradientRenderer implements VisualizationRendererStrategy {

  supportsType(type: string): boolean {
    return type === 'risk-gradient';
  }

  render(data: ProcessedAnalysisData, config: VisualizationConfig): VisualizationResult {
    console.log(`[RiskGradientRenderer] Rendering ${data.records.length} features with risk gradient`);

    const valueField = config.valueField || 'value';

    // Extract risk values
    const riskRange = this.extractRiskRange(data.records, valueField);

    if (!riskRange) {
      console.warn('[RiskGradientRenderer] No valid risk values found');
      return this.createFallbackVisualization(data, config);
    }

    // Create risk breaks
    const riskBreaks = this.calculateRiskBreaks(riskRange);

    // Create risk gradient renderer
    const renderer = this.createRiskGradientRenderer(riskBreaks, valueField, config);

    // Generate popup template
    const popupTemplate = this.createPopupTemplate(data, config);

    // Create risk gradient legend
    const legend = this.createRiskGradientLegend(riskBreaks, data);

    return {
      type: 'risk-gradient',
      config: {
        ...config,
        riskBreaks,
        colorScheme: 'risk'
      },
      renderer,
      popupTemplate,
      legend
    };
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private extractRiskRange(records: any[], field: string): { min: number; max: number } | null {
    const values = records
      .map(r => (r as any)[field])
      .filter(v => v !== undefined && !isNaN(v));

    if (values.length === 0) return null;

    return {
      min: Math.min(...values),
      max: Math.max(...values)
    };
  }

  private calculateRiskBreaks(range: { min: number; max: number }): number[] {
    const { min, max } = range;
    const span = max - min;

    if (span === 0) {
      return [min, min];
    }

    // Create 5 risk classes: Very Low, Low, Moderate, High, Very High
    return [
      min,
      min + span * 0.2,
      min + span * 0.4,
      min + span * 0.6,
      min + span * 0.8,
      max
    ];
  }

  private getRiskColors(): string[] {
    // Risk gradient: green (safe) to red (dangerous)
    return [
      '#1a9850', // Very Low Risk - Dark green
      '#91cf60', // Low Risk - Light green
      '#ffffbf', // Moderate Risk - Yellow
      '#fc8d59', // High Risk - Orange
      '#d73027'  // Very High Risk - Red
    ];
  }

  private getRiskLabels(): string[] {
    return [
      'Very Low Risk',
      'Low Risk',
      'Moderate Risk',
      'High Risk',
      'Very High Risk'
    ];
  }

  private createRiskGradientRenderer(breaks: number[], field: string, config: VisualizationConfig): any {
    const colors = this.getRiskColors();
    const labels = this.getRiskLabels();
    const geometryType = (config as any).geometryType;

    const classBreakInfos = breaks.slice(0, -1).map((breakValue, index) => {
      const color = colors[index];

      if (geometryType === 'point') {
        return {
          minValue: breakValue,
          maxValue: breaks[index + 1],
          symbol: {
            type: 'simple-marker',
            style: 'circle',
            color: this.hexToRgba(color, 0.8),
            size: 12,
            outline: {
              color: [255, 255, 255, 0.8],
              width: 1
            }
          },
          label: `${labels[index]} (${this.formatNumber(breakValue)} - ${this.formatNumber(breaks[index + 1])})`
        };
      }

      return {
        minValue: breakValue,
        maxValue: breaks[index + 1],
        symbol: {
          type: 'simple-fill',
          color: this.hexToRgba(color, STANDARD_OPACITY),
          outline: {
            color: [0, 0, 0, 0],
            width: 0
          }
        },
        label: `${labels[index]} (${this.formatNumber(breakValue)} - ${this.formatNumber(breaks[index + 1])})`
      };
    });

    const renderer: any = {
      type: 'class-breaks',
      field: field,
      classBreakInfos,
      defaultSymbol: geometryType === 'point' ? {
        type: 'simple-marker',
        style: 'circle',
        color: [128, 128, 128, 0.5],
        size: 8
      } : {
        type: 'simple-fill',
        color: [128, 128, 128, STANDARD_OPACITY],
        outline: {
          color: [0, 0, 0, 0],
          width: 0
        }
      }
    };

    if (geometryType === 'point') {
      renderer._useCentroids = true;
    }

    return renderer;
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
              label: data.targetVariable || 'Risk Score',
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

  private createRiskGradientLegend(breaks: number[], data: ProcessedAnalysisData): any {
    const colors = this.getRiskColors();
    const labels = this.getRiskLabels();

    return {
      title: data.targetVariable || 'Risk Assessment',
      items: breaks.slice(0, -1).map((breakValue, index) => ({
        label: `${labels[index]}: ${this.formatNumber(breakValue)} - ${this.formatNumber(breaks[index + 1])}`,
        color: colors[index],
        value: (breakValue + breaks[index + 1]) / 2
      })),
      position: 'bottom-right',
      type: 'risk-gradient'
    };
  }

  private formatNumber(value: number): string {
    if (Math.abs(value) >= 1000000) {
      return (value / 1000000).toFixed(1) + 'M';
    } else if (Math.abs(value) >= 1000) {
      return (value / 1000).toFixed(1) + 'K';
    } else if (value % 1 === 0) {
      return value.toString();
    } else {
      return value.toFixed(2);
    }
  }

  private hexToRgba(hex: string, opacity: number): number[] {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) {
      return [128, 128, 128, opacity];
    }
    return [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16),
      opacity
    ];
  }

  private createFallbackVisualization(data: ProcessedAnalysisData, config: VisualizationConfig): VisualizationResult {
    return {
      type: 'risk-gradient',
      config: config,
      renderer: {
        type: 'simple',
        symbol: {
          type: 'simple-fill',
          color: [128, 128, 128, STANDARD_OPACITY],
          outline: {
            color: [0, 0, 0, 0],
            width: 0
          }
        }
      },
      popupTemplate: {
        title: '{area_name}',
        content: 'No risk data available'
      },
      legend: {
        title: 'Risk Assessment',
        items: [{ label: 'No data', color: '#808080' }],
        position: 'bottom-right'
      }
    };
  }
}
