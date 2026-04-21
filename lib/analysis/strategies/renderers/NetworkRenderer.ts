import { VisualizationRendererStrategy, ProcessedAnalysisData, VisualizationResult, VisualizationConfig } from '../../types';
import { ACTIVE_COLOR_SCHEME, STANDARD_OPACITY } from '@/utils/renderer-standardization';

/**
 * NetworkRenderer - Network/relationship visualization
 *
 * Features:
 * - Node visualization with connections
 * - Size-based on connectivity
 * - Color-based on network centrality
 *
 * Note: For MVP, renders nodes only. Full network edges require separate layer.
 */
export class NetworkRenderer implements VisualizationRendererStrategy {

  supportsType(type: string): boolean {
    return type === 'network';
  }

  render(data: ProcessedAnalysisData, config: VisualizationConfig): VisualizationResult {
    console.log(`[NetworkRenderer] Rendering ${data.records.length} network nodes`);

    const valueField = config.valueField || 'value';

    // Extract network metrics
    const networkMetrics = this.extractNetworkMetrics(data.records, valueField);

    // Create network node renderer
    const renderer = this.createNetworkRenderer(networkMetrics, valueField, config);

    // Generate popup template
    const popupTemplate = this.createPopupTemplate(data, config);

    // Create network legend
    const legend = this.createNetworkLegend(networkMetrics, data);

    return {
      type: 'network',
      config: {
        ...config,
        networkMetrics
      },
      renderer,
      popupTemplate,
      legend
    };
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private extractNetworkMetrics(records: any[], field: string): { min: number; max: number; avg: number } {
    const values = records
      .map(r => (r as any)[field])
      .filter(v => v !== undefined && !isNaN(v));

    if (values.length === 0) {
      return { min: 0, max: 1, avg: 0.5 };
    }

    return {
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((sum, v) => sum + v, 0) / values.length
    };
  }

  private createNetworkRenderer(metrics: { min: number; max: number; avg: number }, field: string, config: VisualizationConfig): any {
    // Create graduated symbol renderer based on network centrality/value
    const classBreaks = this.calculateNodeSizeBreaks(metrics);
    const colors = this.getNetworkColors();

    const classBreakInfos = classBreaks.slice(0, -1).map((breakValue, index) => ({
      minValue: breakValue,
      maxValue: classBreaks[index + 1],
      symbol: {
        type: 'simple-marker',
        style: 'circle',
        color: this.hexToRgba(colors[index], 0.8),
        size: 10 + (index * 4), // Size increases with value
        outline: {
          color: [255, 255, 255, 0.9],
          width: 2
        }
      },
      label: this.formatNetworkLabel(breakValue, classBreaks[index + 1], index)
    }));

    return {
      type: 'class-breaks',
      field: field,
      classBreakInfos,
      defaultSymbol: {
        type: 'simple-marker',
        style: 'circle',
        color: [128, 128, 128, 0.5],
        size: 8,
        outline: {
          color: [255, 255, 255, 0.8],
          width: 1
        }
      },
      _useCentroids: true
    };
  }

  private calculateNodeSizeBreaks(metrics: { min: number; max: number; avg: number }): number[] {
    const { min, max } = metrics;
    const range = max - min;

    if (range === 0) {
      return [min, min];
    }

    // Create 4 classes
    return [
      min,
      min + range * 0.25,
      min + range * 0.5,
      min + range * 0.75,
      max
    ];
  }

  private getNetworkColors(): string[] {
    // Use standard color scheme for network centrality
    return ACTIVE_COLOR_SCHEME;
  }

  private formatNetworkLabel(min: number, max: number, index: number): string {
    const labels = ['Low Connectivity', 'Moderate', 'High', 'Very High'];
    return `${labels[index]} (${min.toFixed(1)}-${max.toFixed(1)})`;
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
              label: 'Network Centrality',
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

  private createNetworkLegend(metrics: { min: number; max: number; avg: number }, data: ProcessedAnalysisData): any {
    const colors = this.getNetworkColors();
    const range = metrics.max - metrics.min;

    return {
      title: data.targetVariable || 'Network Centrality',
      items: [
        { label: 'Low Connectivity', color: colors[0], symbol: 'circle', size: 10, value: metrics.min },
        { label: 'Moderate', color: colors[1], symbol: 'circle', size: 14, value: metrics.min + range * 0.375 },
        { label: 'High', color: colors[2], symbol: 'circle', size: 18, value: metrics.min + range * 0.625 },
        { label: 'Very High', color: colors[3], symbol: 'circle', size: 22, value: metrics.max }
      ],
      position: 'bottom-right',
      type: 'graduated-symbols'
    };
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
}
