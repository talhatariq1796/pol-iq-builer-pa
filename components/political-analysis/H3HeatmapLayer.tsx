/**
 * H3HeatmapLayer Component
 *
 * Visualizes political metrics on H3 hexagonal grid for uniform analysis.
 * Supports multiple metrics with color-coded rendering and interactive tooltips.
 *
 * Metrics available:
 * - partisan_lean: -100 (R) to +100 (D)
 * - gotv_priority: 0-100 (Get Out The Vote priority)
 * - persuasion_opportunity: 0-100 (persuadable voters)
 * - combined_score: 0-100 (overall targeting score)
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import GeoJSONLayer from '@arcgis/core/layers/GeoJSONLayer';
import ClassBreaksRenderer from '@arcgis/core/renderers/ClassBreaksRenderer';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol';
import PopupTemplate from '@arcgis/core/PopupTemplate';
import { politicalDataService } from '@/lib/services/PoliticalDataService';

// ============================================================================
// Types
// ============================================================================

export type H3Metric = 'partisan_lean' | 'swing_potential' | 'gotv_priority' | 'persuasion_opportunity' | 'combined_score';

interface H3HeatmapLayerProps {
  view: __esri.MapView;
  metric: H3Metric;
  visible?: boolean;
  opacity?: number;
  onCellClick?: (h3Index: string, cellData: any) => void;
  onCellHover?: (h3Index: string | null, cellData: any | null) => void;
}

interface MetricConfig {
  label: string;
  description: string;
  unit: string;
  colorRamp: 'diverging' | 'sequential';
  breaks: number[];
  colors: [number, number, number, number][];
  formatValue: (value: number) => string;
}

// ============================================================================
// Metric Configurations
// ============================================================================

const METRIC_CONFIGS: Record<H3Metric, MetricConfig> = {
  partisan_lean: {
    label: 'Partisan Lean',
    description: 'Historical voting pattern (D+/R+)',
    unit: 'points',
    colorRamp: 'diverging',
    breaks: [-100, -20, -10, -5, 0, 5, 10, 20, 100],
    colors: [
      [185, 28, 28, 0.85],   // Strong Republican: Red (#b91c1c) | -100 to -20
      [239, 68, 68, 0.8],    // Lean Republican: Light red (#ef4444) | -20 to -10
      [248, 113, 113, 0.7],  // Lean Republican (lighter) | -10 to -5
      [124, 58, 237, 0.65],  // Toss-up: Purple (#7c3aed) | -5 to 0
      [124, 58, 237, 0.65],  // Toss-up: Purple (#7c3aed) | 0 to 5
      [59, 130, 246, 0.7],   // Lean Democrat: Light blue (#3b82f6) | 5 to 10
      [37, 99, 235, 0.8],    // Lean Democrat (darker) | 10 to 20
      [30, 64, 175, 0.85],   // Strong Democrat: Blue (#1e40af) | 20 to 100
    ],
    formatValue: (value: number) => {
      const abs = Math.abs(value);
      const party = value >= 0 ? 'D' : 'R';
      return `${party}+${abs.toFixed(1)}`;
    },
  },
  swing_potential: {
    label: 'Swing Potential',
    description: 'Electoral volatility and persuadability (0-100)',
    unit: 'score',
    colorRamp: 'sequential',
    breaks: [0, 20, 40, 60, 80, 100],
    colors: [
      [192, 132, 252, 0.75], // purple-400  | 0-20 (low swing) - visible base
      [168, 85, 247, 0.8],   // purple-500  | 20-40
      [147, 51, 234, 0.85],  // purple-600  | 40-60
      [126, 34, 206, 0.9],   // purple-700  | 60-80
      [107, 33, 168, 0.95],  // purple-800  | 80-100 (high swing) - deep purple
    ],
    formatValue: (value: number) => value.toFixed(0),
  },
  gotv_priority: {
    label: 'GOTV Priority',
    description: 'Get Out The Vote targeting score',
    unit: 'score',
    colorRamp: 'sequential',
    breaks: [0, 20, 40, 60, 80, 100],
    colors: [
      [254, 240, 138, 0.7], // yellow-200  | 0-20
      [252, 211, 77, 0.7],  // yellow-300  | 20-40
      [251, 191, 36, 0.7],  // yellow-400  | 40-60
      [245, 158, 11, 0.8],  // yellow-500  | 60-80
      [217, 119, 6, 0.8],   // yellow-600  | 80-100
    ],
    formatValue: (value: number) => value.toFixed(0),
  },
  persuasion_opportunity: {
    label: 'Persuasion Opportunity',
    description: 'Likelihood of persuadable voters',
    unit: 'score',
    colorRamp: 'sequential',
    breaks: [0, 20, 40, 60, 80, 100],
    colors: [
      [233, 213, 255, 0.7], // purple-200  | 0-20
      [216, 180, 254, 0.7], // purple-300  | 20-40
      [192, 132, 252, 0.7], // purple-400  | 40-60
      [168, 85, 247, 0.8],  // purple-500  | 60-80
      [147, 51, 234, 0.8],  // purple-600  | 80-100
    ],
    formatValue: (value: number) => value.toFixed(0),
  },
  combined_score: {
    label: 'Combined Targeting Score',
    description: 'Overall campaign targeting priority',
    unit: 'score',
    colorRamp: 'sequential',
    breaks: [0, 20, 40, 60, 80, 100],
    colors: [
      [186, 230, 253, 0.7], // sky-200  | 0-20
      [125, 211, 252, 0.7], // sky-300  | 20-40
      [56, 189, 248, 0.7],  // sky-400  | 40-60
      [14, 165, 233, 0.8],  // sky-500  | 60-80
      [2, 132, 199, 0.8],   // sky-600  | 80-100
    ],
    formatValue: (value: number) => value.toFixed(0),
  },
};

// ============================================================================
// Component
// ============================================================================

export function H3HeatmapLayer({
  view,
  metric,
  visible = true,
  opacity = 0.7,
  onCellClick,
  onCellHover,
}: H3HeatmapLayerProps) {
  const layerRef = useRef<GeoJSONLayer | null>(null);
  const clickHandlerRef = useRef<IHandle | null>(null);
  const hoverHandlerRef = useRef<IHandle | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create renderer for the selected metric
  const createRenderer = useCallback((metricKey: H3Metric) => {
    const config = METRIC_CONFIGS[metricKey];

    const classBreaks = [];
    for (let i = 0; i < config.breaks.length - 1; i++) {
      const minValue = config.breaks[i];
      const maxValue = config.breaks[i + 1];
      const color = config.colors[i];

      classBreaks.push({
        minValue,
        maxValue,
        symbol: new SimpleFillSymbol({
          color,
          outline: new SimpleLineSymbol({
            color: [255, 255, 255, 0.3],
            width: 0.5,
          }),
        }),
        label: `${config.formatValue(minValue)} - ${config.formatValue(maxValue)}`,
      });
    }

    return new ClassBreaksRenderer({
      field: metricKey,
      classBreakInfos: classBreaks,
      defaultSymbol: new SimpleFillSymbol({
        color: [220, 220, 220, 0.6],  // More visible gray for "no data"
        outline: new SimpleLineSymbol({
          color: [100, 100, 100, 0.6],  // Darker outline for visibility
          width: 1,
        }),
      }),
      defaultLabel: 'No data',
    });
  }, []);

  // Create popup template
  const createPopupTemplate = useCallback((metricKey: H3Metric): PopupTemplate => {
    const config = METRIC_CONFIGS[metricKey];

    return new PopupTemplate({
      title: 'H3 Cell Analysis',
      content: [
        {
          type: 'fields',
          fieldInfos: [
            {
              fieldName: 'h3_index',
              label: 'H3 Index',
            },
            {
              fieldName: 'precinct_count',
              label: 'Precincts in Cell',
            },
            {
              fieldName: 'total_population',
              label: 'Total Population',
              format: {
                digitSeparator: true,
                places: 0,
              },
            },
            {
              fieldName: metricKey,
              label: config.label,
              format: {
                digitSeparator: true,
                places: 1,
              },
            },
            {
              fieldName: 'partisan_lean',
              label: 'Partisan Lean',
              format: {
                digitSeparator: false,
                places: 1,
              },
            },
            {
              fieldName: 'gotv_priority',
              label: 'GOTV Priority',
              format: {
                digitSeparator: false,
                places: 1,
              },
            },
            {
              fieldName: 'persuasion_opportunity',
              label: 'Persuasion Opportunity',
              format: {
                digitSeparator: false,
                places: 1,
              },
            },
            {
              fieldName: 'dem_affiliation_pct',
              label: 'Democratic %',
              format: {
                digitSeparator: false,
                places: 1,
              },
            },
            {
              fieldName: 'rep_affiliation_pct',
              label: 'Republican %',
              format: {
                digitSeparator: false,
                places: 1,
              },
            },
          ],
        },
        {
          type: 'text',
          text: `<p><em>${config.description}</em></p>`,
        },
      ],
    });
  }, []);

  // Load H3 GeoJSON and create layer
  useEffect(() => {
    if (!view) {
      return;
    }

    const loadLayer = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Initialize service first (ensures data is loaded)
        await politicalDataService.initialize();

        // Load H3 GeoJSON from the political data service
        const rawGeojson = await politicalDataService.loadH3GeoJSON();

        // Debug: Log raw data
        console.log(`[H3HeatmapLayer] Raw GeoJSON loaded: ${rawGeojson?.features?.length || 0} features`);

        // Filter out features with null values for the current metric
        // This prevents grey hexagons from appearing
        const filteredFeatures = rawGeojson.features.filter(feature => {
          const value = feature.properties?.[metric];
          return value !== null && value !== undefined && !isNaN(value);
        });

        const geojson: GeoJSON.FeatureCollection = {
          type: 'FeatureCollection',
          features: filteredFeatures,
        };

        console.log(`[H3HeatmapLayer] Filtered ${rawGeojson.features.length} -> ${filteredFeatures.length} features for metric '${metric}'`);

        // Debug: Show metric value distribution
        if (filteredFeatures.length > 0) {
          const values = filteredFeatures.map(f => f.properties?.[metric] as number).filter(v => v !== null);
          const min = Math.min(...values);
          const max = Math.max(...values);
          const avg = values.reduce((a, b) => a + b, 0) / values.length;
          console.log(`[H3HeatmapLayer] Metric '${metric}' stats: min=${min.toFixed(2)}, max=${max.toFixed(2)}, avg=${avg.toFixed(2)}`);
          console.log(`[H3HeatmapLayer] Sample feature:`, {
            h3_index: filteredFeatures[0].properties?.h3_index,
            [metric]: filteredFeatures[0].properties?.[metric],
            gotv_priority: filteredFeatures[0].properties?.gotv_priority,
            partisan_lean: filteredFeatures[0].properties?.partisan_lean,
          });
        }

        // Remove existing layer
        if (layerRef.current) {
          view.map.remove(layerRef.current);
          layerRef.current = null;
        }

        // Create Blob from GeoJSON for ArcGIS to consume
        const blob = new Blob([JSON.stringify(geojson)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        // Create GeoJSON layer
        const layer = new GeoJSONLayer({
          url,
          title: 'H3 Political Heatmap',
          visible,
          opacity,
          renderer: createRenderer(metric),
          popupTemplate: createPopupTemplate(metric),
          outFields: ['*'],
        });

        // Add to map
        view.map.add(layer);
        layerRef.current = layer;

        // Wait for layer to load
        await layer.load();

        console.log(`[H3HeatmapLayer] Layer loaded successfully with ${filteredFeatures.length} cells`);
      } catch (err) {
        console.error('[H3HeatmapLayer] Error loading layer:', err);
        setError(err instanceof Error ? err.message : 'Failed to load H3 heatmap');
      } finally {
        setIsLoading(false);
      }
    };

    loadLayer();

    // Cleanup
    return () => {
      if (layerRef.current) {
        view.map.remove(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [view, createRenderer, createPopupTemplate, metric, visible, opacity]);

  // Update renderer when metric changes
  useEffect(() => {
    if (layerRef.current) {
      layerRef.current.renderer = createRenderer(metric);
      layerRef.current.popupTemplate = createPopupTemplate(metric);
    }
  }, [metric, createRenderer, createPopupTemplate]);

  // Update visibility
  useEffect(() => {
    if (layerRef.current) {
      layerRef.current.visible = visible;
    }
  }, [visible]);

  // Update opacity
  useEffect(() => {
    if (layerRef.current) {
      layerRef.current.opacity = opacity;
    }
  }, [opacity]);

  // Set up click handler
  useEffect(() => {
    if (!view || !layerRef.current || !onCellClick) {
      return;
    }

    const layer = layerRef.current;

    clickHandlerRef.current?.remove();
    clickHandlerRef.current = view.on('click', async (event) => {
      try {
        // Use hit test with specific layer to improve accuracy
        const response = await view.hitTest(event, {
          include: [layer],
        });

        console.log('[H3HeatmapLayer] Click hit test results:', response.results.length);

        const hit = response.results.find(
          (result) => result.type === 'graphic' && 'graphic' in result
        ) as { graphic: __esri.Graphic } | undefined;

        if (hit) {
          const h3Index = hit.graphic.getAttribute('h3_index');
          const cellData = hit.graphic.attributes;
          console.log('[H3HeatmapLayer] H3 cell clicked:', h3Index);
          if (h3Index) {
            onCellClick(String(h3Index), cellData);
          }
        }
      } catch (err) {
        console.error('[H3HeatmapLayer] Click handler error:', err);
      }
    });

    return () => {
      clickHandlerRef.current?.remove();
    };
  }, [view, onCellClick]);

  // Set up hover handler
  useEffect(() => {
    if (!view || !layerRef.current || !onCellHover) {
      return;
    }

    hoverHandlerRef.current?.remove();
    hoverHandlerRef.current = view.on('pointer-move', async (event) => {
      const response = await view.hitTest(event);
      const hit = response.results.find(
        (result) => 'graphic' in result && result.graphic.layer === layerRef.current
      ) as { graphic: __esri.Graphic } | undefined;

      if (hit) {
        const h3Index = hit.graphic.getAttribute('h3_index');
        const cellData = hit.graphic.attributes;
        onCellHover(h3Index ? String(h3Index) : null, cellData);
      } else {
        onCellHover(null, null);
      }
    });

    return () => {
      hoverHandlerRef.current?.remove();
    };
  }, [view, onCellHover]);

  return null; // Non-visual component
}

// ============================================================================
// Legend Component
// ============================================================================

interface H3HeatmapLegendProps {
  metric: H3Metric;
  className?: string;
}

export function H3HeatmapLegend({ metric, className = '' }: H3HeatmapLegendProps) {
  const config = METRIC_CONFIGS[metric];

  return (
    <div className={`bg-white rounded-lg shadow-md p-4 ${className}`}>
      <h3 className="font-semibold text-xs mb-2">{config.label}</h3>
      <p className="text-xs text-gray-600 mb-3">{config.description}</p>
      <div className="space-y-1">
        {config.breaks.slice(0, -1).map((minValue, index) => {
          const maxValue = config.breaks[index + 1];
          const color = config.colors[index];
          const rgbaStr = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3]})`;

          return (
            <div key={index} className="flex items-center text-xs">
              <div
                className="w-6 h-4 border border-gray-300 mr-2 flex-shrink-0"
                style={{ backgroundColor: rgbaStr }}
              />
              <span>
                {config.formatValue(minValue)} - {config.formatValue(maxValue)}
              </span>
            </div>
          );
        })}
        <div className="flex items-center text-xs text-gray-500 mt-2 pt-2 border-t">
          <div className="w-6 h-4 bg-gray-300 border border-gray-400 mr-2 flex-shrink-0" />
          <span>No data</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Metric Selector Component
// ============================================================================

interface MetricSelectorProps {
  value: H3Metric;
  onChange: (metric: H3Metric) => void;
  className?: string;
}

export function MetricSelector({ value, onChange, className = '' }: MetricSelectorProps) {
  return (
    <div className={`bg-white rounded-lg shadow-md p-4 ${className}`}>
      <label htmlFor="metric-select" className="block text-xs font-semibold mb-2">
        Select Metric
      </label>
      <select
        id="metric-select"
        value={value}
        onChange={(e) => onChange(e.target.value as H3Metric)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33a852]"
      >
        {Object.entries(METRIC_CONFIGS).map(([key, config]) => (
          <option key={key} value={key}>
            {config.label}
          </option>
        ))}
      </select>
      <p className="text-xs text-gray-600 mt-2">{METRIC_CONFIGS[value].description}</p>
    </div>
  );
}

// ============================================================================
// Combined Control Panel Component
// ============================================================================

interface H3HeatmapControlsProps {
  metric: H3Metric;
  onMetricChange: (metric: H3Metric) => void;
  visible?: boolean;
  onVisibilityChange?: (visible: boolean) => void;
  opacity?: number;
  onOpacityChange?: (opacity: number) => void;
  className?: string;
}

export function H3HeatmapControls({
  metric,
  onMetricChange,
  visible = true,
  onVisibilityChange,
  opacity = 0.7,
  onOpacityChange,
  className = '',
}: H3HeatmapControlsProps) {
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Metric Selector */}
      <MetricSelector value={metric} onChange={onMetricChange} />

      {/* Visibility and Opacity Controls */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="space-y-3">
          {/* Visibility Toggle */}
          {onVisibilityChange && (
            <div className="flex items-center justify-between">
              <label htmlFor="layer-visible" className="text-xs font-medium">
                Show Layer
              </label>
              <input
                id="layer-visible"
                type="checkbox"
                checked={visible}
                onChange={(e) => onVisibilityChange(e.target.checked)}
                className="w-4 h-4 text-[#33a852] border-gray-300 rounded focus:ring-[#33a852]"
              />
            </div>
          )}

          {/* Opacity Slider */}
          {onOpacityChange && (
            <div>
              <label htmlFor="layer-opacity" className="text-xs font-medium block mb-1">
                Opacity: {Math.round(opacity * 100)}%
              </label>
              <div className="relative">
                <input
                  id="layer-opacity"
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={opacity}
                  onChange={(e) => onOpacityChange(parseFloat(e.target.value))}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-200"
                  style={{
                    background: `linear-gradient(to right, #33a852 0%, #33a852 ${opacity * 100}%, #e5e7eb ${opacity * 100}%, #e5e7eb 100%)`
                  }}
                />
                <style dangerouslySetInnerHTML={{ __html: `
                  input[type="range"]::-webkit-slider-thumb {
                    appearance: none;
                    width: 16px;
                    height: 16px;
                    border-radius: 50%;
                    background: #33a852;
                    border: 2px solid white;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
                    cursor: pointer;
                  }
                  input[type="range"]::-moz-range-thumb {
                    width: 16px;
                    height: 16px;
                    border-radius: 50%;
                    background: #33a852;
                    border: 2px solid white;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
                    cursor: pointer;
                  }
                ` }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <H3HeatmapLegend metric={metric} />
    </div>
  );
}

export default H3HeatmapLayer;
