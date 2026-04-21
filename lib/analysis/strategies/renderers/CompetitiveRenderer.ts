import { VisualizationRendererStrategy, ProcessedAnalysisData, VisualizationResult, VisualizationConfig } from '../../types';
import { EnhancedRendererBase, EnhancedVisualizationConfig } from './EnhancedRendererBase';
import { ACTIVE_COLOR_SCHEME, STANDARD_OPACITY, standardizeRenderer } from '@/utils/renderer-standardization';
import { getQuintileColorScheme, calculateEqualCountQuintiles } from '../../utils/QuintileUtils';

/**
 * CompetitiveRenderer - Enhanced competitive analysis visualization with animations
 * 
 * Features:
 * - Multi-dimensional symbol rendering with pulsing effects
 * - Animated market share visualization
 * - Competitive position indicators with transitions
 * - Dynamic sizing with smooth scaling
 * - Brand strength visualization with glow effects
 * - Firefly particles for high-opportunity areas
 * - Interactive hover animations
 */
export class CompetitiveRenderer extends EnhancedRendererBase {
  
  supportsType(type: string): boolean {
    return type === 'multi-symbol' || type === 'competitive';
  }

  render(data: ProcessedAnalysisData, config: EnhancedVisualizationConfig): VisualizationResult {
    const valueField = config.valueField || 'value';
    
    try {
      console.log(`[CompetitiveRenderer] Rendering enhanced competitive analysis for ${data.records.length} areas`);
      
      // Set default enhanced effects for competitive analysis
      const enhancedConfig: EnhancedVisualizationConfig = {
        ...config,
        visualEffects: {
          fireflies: {
            enabled: true,
            intensity: 0.8,
            color: '#00FF88', // Green for opportunities
            size: 4,
            speed: 1.2
          },
          gradients: {
            enabled: false, // Points don't need gradients
            type: 'radial',
            colors: [],
            animated: false
          },
          borders: {
            enabled: true,
            style: 'glow',
            width: 2,
            animated: true,
            color: 'transparent'
          },
          hover: {
            enabled: true,
            scale: 1.4,
            glow: true,
            ripple: true,
            colorShift: true
          },
          particles: {
            enabled: true,
            count: 3,
            size: 2,
            opacity: 0.6,
            movement: 'orbit'
          },
          ...config.visualEffects
        },
        animations: {
          entrance: {
            enabled: true,
            duration: 1000,
            easing: 'ease-out',
            delay: 100,
            loop: false
          },
          idle: {
            enabled: true,
            duration: 2500,
            easing: 'ease-in-out',
            delay: 0,
            loop: true
          },
          hover: {
            enabled: true,
            duration: 200,
            easing: 'ease-out',
            delay: 0,
            loop: false
          },
          ...config.animations
        }
      };
      
      // Extract competitive metrics
      const competitiveMetrics = this.extractCompetitiveMetrics(data);
      
      // Determine rendering strategy based on data
      const renderingStrategy = this.determineRenderingStrategy(competitiveMetrics);
      
      // Create enhanced competitive renderer with animations
      const baseRenderer = this.createCompetitiveRenderer(competitiveMetrics, renderingStrategy, enhancedConfig, data.records);
      const renderer = this.createEnhancedRenderer(baseRenderer, data, enhancedConfig);
      
      // Apply standard opacity
      const standardizedRenderer = standardizeRenderer(renderer, 4);
      
      // Generate enhanced popup template with animations
      const popupTemplate = this.createEnhancedPopupTemplate(data, enhancedConfig);
      
      // Create enhanced competitive legend with animations
      const legend = this.createEnhancedCompetitiveLegend(competitiveMetrics, renderingStrategy, data, renderer);
      
      // Add firefly effect configuration for high-opportunity areas
      const fireflyEffect = this.createFireflyEffect(data, enhancedConfig);

      return {
        type: 'multi-symbol',
        config: {
          ...enhancedConfig,
          colorScheme: 'competitive',
          renderingStrategy
        },
        renderer: standardizedRenderer,
        popupTemplate,
        legend,
        _enhancedEffects: {
          fireflies: fireflyEffect,
          marketShareAnimation: this.createMarketShareAnimation(competitiveMetrics),
          competitivePositioning: this.createCompetitivePositioning(data),
          animations: enhancedConfig.animations
        }
      };
    } catch (error) {
      console.error('[CompetitiveRenderer] Error rendering competitive analysis:', error);
      
      // Fallback to simple renderer
      return {
        type: 'multi-symbol',
        config: config,
        renderer: {
          type: 'simple',
          symbol: {
            type: 'simple-marker',
            style: 'circle',
            color: [65, 105, 225, STANDARD_OPACITY],
            size: 12,
            outline: {
              color: [0, 0, 0, 0], // No border
              width: 0
            }
          },
          _useCentroids: true
        },
        popupTemplate: {
          title: '{area_name}',
          content: [{
            type: 'fields',
            fieldInfos: [
              { fieldName: 'area_name', label: 'Area' },
              { fieldName: valueField, label: 'Score' }
            ]
          }]
        },
        legend: {
          title: 'Competitive Analysis',
          items: [{ label: 'Areas', color: '#4169E1', value: 0 }],
          position: 'bottom-right'
        }
      };
    }
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private extractCompetitiveMetrics(data: ProcessedAnalysisData): CompetitiveMetrics {
    const marketShareRange = this.calculateMarketShareRange(data.records);
    const competitiveScoreRange = this.calculateCompetitiveScoreRange(data.records);
    const categories = this.analyzeCompetitiveCategories(data.records);
    
    return {
      marketShareRange,
      competitiveScoreRange,
      categories,
      hasMarketShare: this.hasMarketShareData(data.records),
      hasBrandStrength: this.hasBrandStrengthData(data.records),
      hasCompetitivePosition: this.hasCompetitivePositionData(data.records)
    };
  }

  private determineRenderingStrategy(metrics: CompetitiveMetrics): RenderingStrategy {
    // FORCE quartile-based rendering for consistent visualization across all endpoints
    // This ensures all competitive analysis uses the same 4-color quartile system
    console.log('[CompetitiveRenderer] Forcing quartile-based rendering for consistency');
    
    // Choose strategy based on available data, but prioritize quartile approaches
    if (metrics.hasMarketShare && metrics.hasBrandStrength) {
      return 'market-share-with-brand-strength'; // This already uses quartiles
    } else if (metrics.hasMarketShare) {
      return 'market-share-only';
    } else if (metrics.hasCompetitivePosition) {
      return 'competitive-position';
    } else {
      return 'basic-competitive';
    }
  }

  private createCompetitiveRenderer(
    metrics: CompetitiveMetrics, 
    strategy: RenderingStrategy, 
    config: VisualizationConfig,
    records: any[]
  ): any {
    console.log(`[CompetitiveRenderer] Creating renderer with strategy: ${strategy}`);
    console.log('[CompetitiveRenderer] Metrics for renderer:', {
      competitiveScoreRange: metrics.competitiveScoreRange,
      marketShareRange: metrics.marketShareRange,
      hasMarketShare: metrics.hasMarketShare,
      categories: metrics.categories
    });
    
    let renderer;
    switch (strategy) {
      case 'market-share-with-brand-strength':
        renderer = this.createMarketShareBrandRenderer(metrics, config, records);
        break;
      
      case 'market-share-only':
        renderer = this.createMarketShareRenderer(metrics, config);
        break;
      
      case 'competitive-position':
        renderer = this.createCompetitivePositionRenderer(metrics, config);
        break;
      
      default:
        renderer = this.createBasicCompetitiveRenderer(metrics, config);
        break;
    }
    
    // Ensure _useCentroids is always set for competitive analysis
    renderer._useCentroids = true;
    
    console.log(`[CompetitiveRenderer] Renderer created with _useCentroids: ${renderer._useCentroids}`);
    
    return renderer;
  }

  private createMarketShareBrandRenderer(metrics: CompetitiveMetrics, config: VisualizationConfig, records: any[]): any {
    console.log('[CompetitiveRenderer] Creating quartile-based dual-variable renderer: size=market share, color=competitive advantage');
    const valueField = config.valueField || 'value';
    
    // Extract and sort data for quintile calculation
    const marketShareData = records.map(r => ({
      value: Number(r.properties?.nike_market_share) || 0,
      record: r
    })).filter(item => !isNaN(item.value) && item.value > 0).sort((a, b) => a.value - b.value);
    
    const competitiveScoreData = records.map(r => ({
      value: Number(r.value) || 0,
      record: r
    })).filter(item => !isNaN(item.value) && item.value > 0).sort((a, b) => a.value - b.value);
    
    // Validate we have enough valid data for dual-variable visualization
    if (marketShareData.length === 0) {
      console.warn('[CompetitiveRenderer] No valid market share data found, falling back to basic competitive renderer');
      return this.createBasicCompetitiveRenderer(metrics, config);
    }
    
    if (competitiveScoreData.length === 0) {
      console.warn('[CompetitiveRenderer] No valid competitive score data found, falling back to basic competitive renderer');
      return this.createBasicCompetitiveRenderer(metrics, config);
    }
    
    // Calculate quartile breaks (equal number of features in each class)
    const marketShareQuartiles = this.calculateQuartileBreaks(marketShareData.map(item => item.value));
    const competitiveQuartiles = this.calculateQuartileBreaks(competitiveScoreData.map(item => item.value));
      
    console.log('[CompetitiveRenderer] Quartile-based dual-variable data:', {
      marketShareQuartiles,
      competitiveQuartiles,
      recordCount: records.length
    });
    
    // Create base renderer with visual variables using quartile stops
    const renderer = {
      type: 'simple',
      symbol: {
        type: 'simple-marker',
        style: 'circle',
        color: [65, 105, 225, 0.8], // Default blue
        size: 16,
        outline: {
          color: [0, 0, 0, 0], // No border
          width: 0
        }
      },
      visualVariables: [
        // Size variable: Market share (Nike share determines circle size) - QUARTILES
        {
          type: 'size',
          field: 'nike_market_share',
          stops: this.createQuartileSizeStops(marketShareQuartiles),
          legendOptions: {
            title: 'Nike Market Share (%) - Quartiles'
          }
        },
        // Color variable: Competitive advantage score - QUARTILES
        {
          type: 'color',
          field: valueField,
          stops: this.createQuartileColorStops(competitiveQuartiles),
          legendOptions: {
            title: 'Competitive Advantage - Quartiles'
          }
        }
      ],
      _useCentroids: true,
      // FIREFLY RENDERER ENHANCEMENTS
      _fireflyMode: true,
      _dualVariable: true,
      _quartileBased: true, // Flag for quartile-based rendering
      _visualEffects: {
        glow: true,
        blend: 'screen',
        animation: 'pulse',
        quality: 'high'
      }
    };

    // Store quartile metadata for legend creation
    (renderer as any)._marketShareQuartiles = marketShareQuartiles;
    (renderer as any)._competitiveQuartiles = competitiveQuartiles;
    (renderer as any)._dualVariableConfig = {
      sizeField: 'nike_market_share',
      colorField: 'value',
      sizeTitle: 'Nike Market Share (%) - Quartiles',
      colorTitle: 'Competitive Advantage (1-10 Scale) - Quartiles',
      isQuartileBased: true
    };
    
    return renderer;
  }

  // New method to calculate quartile breaks
  private calculateQuartileBreaks(sortedValues: number[]): number[] {
    if (sortedValues.length === 0) return [0, 25, 50, 75, 100];
    if (sortedValues.length === 1) return [sortedValues[0], sortedValues[0], sortedValues[0], sortedValues[0]];
    
    // For small datasets, fall back to range-based breaks to avoid duplicate values
    if (sortedValues.length <= 4) {
      const min = sortedValues[0];
      const max = sortedValues[sortedValues.length - 1];
      const range = max - min;
      
      if (range === 0) return [min, min, min, min];
      
      return [
        min,
        min + range * 0.25,
        min + range * 0.5,
        min + range * 0.75,
        max
      ].slice(0, 4); // Return 4 breaks
    }
    
    // For larger datasets, use proper quartiles
    const quartiles = [];
    for (let i = 1; i <= 4; i++) {
      const index = Math.ceil((i / 4) * sortedValues.length) - 1;
      const clampedIndex = Math.min(index, sortedValues.length - 1);
      quartiles.push(sortedValues[clampedIndex]);
    }
    
    return quartiles;
  }

  // Create size stops based on quartiles
  private createQuartileSizeStops(quartiles: number[]): any[] {
    if (quartiles.length < 4) return [{ value: 0, size: 16 }];
    
    const sizes = [12, 16, 22, 28]; // Different sizes for each quartile
    
    return quartiles.map((value, index) => ({
      value: value,
      size: sizes[index] || 16
    }));
  }

  // Create color stops based on quartiles using standardized quartile colors
  private createQuartileColorStops(quartiles: number[]): any[] {
    if (quartiles.length < 4) return [{ value: 0, color: '#4169E1' }];
    
    // Use standardized quartile colors to match static layers: red -> orange -> light green -> dark green
    const colors = ACTIVE_COLOR_SCHEME;
    
    return quartiles.map((value, index) => ({
      value: value,
      color: colors[index] || '#4169E1'
    }));
  }

  private createMarketShareRenderer(metrics: CompetitiveMetrics, config: VisualizationConfig): any {
    // Firefly-enhanced graduated symbols based on market share
    const valueField = config.valueField || 'value';
    const classBreaks = this.calculateMarketShareBreaks(metrics.marketShareRange);
    const colors = this.getFireflyColors(classBreaks.length);
    const sizes = [14, 18, 24, 30]; // Firefly graduated sizes
    
    const classBreakInfos = classBreaks.slice(0, -1).map((breakValue, index) => ({
      minValue: breakValue,
      maxValue: classBreaks[index + 1],
      symbol: {
        type: 'simple-marker',
        style: 'circle',
        color: colors[index],
        size: sizes[index] || 18, // Fallback size
        outline: {
          color: colors[index], // Match outline for seamless blend
          width: 0
        },
        // FIREFLY ENHANCEMENT for market share
        _fireflyEffect: {
          glowSize: (sizes[index] || 18) + 8,
          intensity: (index + 1) / 4, // Always 4 quartiles
          pulseSpeed: 1800 + (index * 400),
          blendMode: 'screen'
        }
      },
      label: `${breakValue.toFixed(1)} - ${classBreaks[index + 1].toFixed(1)}`
    }));

    return {
      type: 'class-breaks',
      field: valueField, // Use dynamic field from config
      classBreakInfos,
      defaultSymbol: {
        type: 'simple-marker',
        style: 'circle',
        color: [128, 128, 128, 0.3],
        size: 8
      },
      _useCentroids: true,
      _fireflyMode: true,
      _visualEffects: {
        glow: true,
        blend: 'screen',
        animation: 'pulse',
        quality: 'high'
      }
    };
  }

  private createCompetitivePositionRenderer(metrics: CompetitiveMetrics, config: VisualizationConfig): any {
    // Firefly-enhanced symbols based on competitive position
    const positionColors = {
      'dominant': 'rgba(46, 125, 50, 0.9)',     // Dark Green with glow
      'competitive': 'rgba(56, 142, 60, 0.85)', // Green with glow
      'trailing': 'rgba(255, 160, 0, 0.8)',     // Amber with glow
      'opportunity': 'rgba(211, 47, 47, 0.8)'   // Red with glow
    };

    const positionSizes = {
      'dominant': 28,     // Largest for dominant
      'competitive': 22,  // Large for competitive  
      'trailing': 18,     // Medium for trailing
      'opportunity': 24   // Large for opportunities
    };

    return {
      type: 'unique-value',
      field: 'properties.competitive_position',
      uniqueValueInfos: Object.entries(positionColors).map(([position, color]) => ({
        value: position,
        symbol: {
          type: 'simple-marker',
          style: 'circle',
          color: color,
          size: positionSizes[position as keyof typeof positionSizes],
          outline: {
            color: color, // Match outline for seamless blend
            width: 0
          },
          // FIREFLY ENHANCEMENT for competitive positions
          _fireflyEffect: {
            glowSize: positionSizes[position as keyof typeof positionSizes] + 10,
            intensity: position === 'dominant' ? 0.95 : position === 'opportunity' ? 0.9 : 0.7,
            pulseSpeed: position === 'opportunity' ? 1000 : 2000, // Opportunities pulse faster
            blendMode: 'screen'
          }
        },
        label: position.charAt(0).toUpperCase() + position.slice(1)
      })),
      defaultSymbol: {
        type: 'simple-marker',
        style: 'circle',
        color: [128, 128, 128, 0.3],
        size: 12
      },
      _useCentroids: true,
      _fireflyMode: true,
      _visualEffects: {
        glow: true,
        blend: 'screen',
        animation: 'pulse',
        quality: 'high'
      }
    };
  }

  private createBasicCompetitiveRenderer(metrics: CompetitiveMetrics, config: VisualizationConfig): any {
    // Use polygon fills (same as strategic analysis) for basic competitive scoring
    const valueField = config.valueField || 'value';
    const colors = this.getFireflyColors(4);
    
    // Safe handling of competitive score range
    const competitiveRange = metrics.competitiveScoreRange || [0, 100];
    const [min, max] = competitiveRange;
    const interval = Math.max((max - min) / 4, 1); // Use 4 quartiles

    const classBreakInfos = colors.map((color, index) => ({
      minValue: min + (interval * index),
      maxValue: min + (interval * (index + 1)),
      symbol: {
        type: 'simple-fill', // Use polygon fills for basic competitive score
        color: color,
        outline: {
          color: [0, 0, 0, 0], // No border
          width: 0
        }
      },
      label: `Level ${index + 1}`
    }));

    return {
      type: 'class-breaks',
      field: valueField,
      classBreakInfos,
      defaultSymbol: {
        type: 'simple-fill',
        color: [128, 128, 128, 0.3],
        outline: {
          color: [0, 0, 0, 0], // No border
          width: 0
        }
      }
    };
  }

  private createCompetitivePopupTemplate(data: ProcessedAnalysisData, config: VisualizationConfig): any {
    const content = [
      {
        type: 'text',
        text: '<h3>{area_name}</h3><p><strong>Competitive Advantage Score:</strong> {value}</p>'
      },
      {
        type: 'fields',
        fieldInfos: [
          {
            fieldName: 'nike_market_share',
            label: 'Nike Market Share (%)',
            format: {
              places: 1,
              digitSeparator: true
            }
          },
          {
            fieldName: 'adidas_market_share',
            label: 'Adidas Market Share (%)',
            format: {
              places: 1,
              digitSeparator: true
            }
          },
          {
            fieldName: 'jordan_market_share',
            label: 'Jordan Market Share (%)',
            format: {
              places: 1,
              digitSeparator: true
            }
          },
          {
            fieldName: 'rank',
            label: 'Competitive Rank',
            format: {
              places: 0,
              digitSeparator: true
            }
          },
          {
            fieldName: 'value_TOTPOP_CY',
            label: 'Population',
            format: {
              places: 0,
              digitSeparator: true
            }
          },
          {
            fieldName: 'value_WLTHINDXCY',
            label: 'Wealth Index',
            format: {
              places: 0,
              digitSeparator: true
            }
          }
        ]
      }
    ];

    // Add contextual information
    content.push({
      type: 'text',
      text: '<p><em>Competitive advantage based on Nike vs Adidas positioning, demographic fit, and competitive environment</em></p>'
    });

    return {
      title: 'Competitive Analysis',
      content,
      outFields: ['*'],
      returnGeometry: true
    };
  }

  private createCompetitiveLegend(
    competitiveMetrics: CompetitiveMetrics, 
    renderingStrategy: string, 
    data: ProcessedAnalysisData,
    renderer: any
  ): any {
    
    // FIXED: Use actual data values for legend instead of theoretical ranges
    const actualValues = data.records.map(r => r.value).filter(v => !isNaN(v));
    
    if (actualValues.length === 0) {
      console.warn('[CompetitiveRenderer] No valid values found for legend creation');
      return {
        title: 'Competitive Advantage Score',
        items: [],
        position: 'bottom-right'
      };
    }
    
    const minValue = Math.min(...actualValues);
    const maxValue = Math.max(...actualValues);
    
    // Debug logging for ZIP 16910 investigation
    const zip16910Record = data.records.find(r => r.area_id === '16910' || r.area_name?.includes('16910'));
    if (zip16910Record) {
      console.log('[CompetitiveRenderer] ZIP 16910 legend data:', {
        recordValue: zip16910Record.value,
        recordName: zip16910Record.area_name,
        minValue,
        maxValue,
        allValuesRange: `${minValue} - ${maxValue}`
      });
    }
    
    // Create legend based on actual value distribution
    const legendItems = [];
    
    if (renderingStrategy === 'symbol_size') {
      // For symbol size rendering, show size categories
      const sizeRanges = [
        { min: minValue, max: minValue + (maxValue - minValue) * 0.2, label: 'Low', size: 'small' },
        { min: minValue + (maxValue - minValue) * 0.2, max: minValue + (maxValue - minValue) * 0.6, label: 'Medium', size: 'medium' },
        { min: minValue + (maxValue - minValue) * 0.6, max: maxValue, label: 'High', size: 'large' }
      ];
      
      sizeRanges.forEach(range => {
        legendItems.push({
          label: `${range.label} (${range.min.toFixed(1)} - ${range.max.toFixed(1)})`,
          symbol: 'circle',
          size: range.size,
          value: range.max
        });
      });
      
    } else {
      // For color-based rendering, create class breaks from actual data
      const numClasses = Math.min(5, Math.max(3, actualValues.length));
      const sortedValues = [...actualValues].sort((a, b) => a - b);
      
      for (let i = 0; i < numClasses; i++) {
        const startIndex = Math.floor(i * sortedValues.length / numClasses);
        const endIndex = Math.floor((i + 1) * sortedValues.length / numClasses) - 1;
        
        const minRange = sortedValues[startIndex];
        const maxRange = sortedValues[Math.min(endIndex, sortedValues.length - 1)];
        
        legendItems.push({
          label: `${minRange.toFixed(1)} - ${maxRange.toFixed(1)}`,
          color: this.getColorForRange(i, numClasses),
          value: maxRange
        });
      }
    }

    return {
      title: 'Competitive Advantage Score',
      items: legendItems,
      position: 'bottom-right',
      // Debug info
      _debugInfo: {
        dataRange: `${minValue.toFixed(1)} - ${maxValue.toFixed(1)}`,
        recordCount: actualValues.length,
        strategy: renderingStrategy
      }
    };
  }

  // ============================================================================
  // LEGEND CREATION METHODS
  // ============================================================================

  private createMarketShareBrandLegend(metrics: CompetitiveMetrics, renderer: any): any {
    const dualConfig = renderer._dualVariableConfig;
    
    if (!dualConfig) {
      console.warn('[CompetitiveRenderer] No dual variable config found for legend');
    return {
        title: 'Competitive Analysis',
        items: [],
        position: 'bottom-right'
      };
    }
    
    if (dualConfig.isQuartileBased) {
      // Handle quartile-based legend
      const marketShareQuartiles = renderer._marketShareQuartiles || [];
      const competitiveQuartiles = renderer._competitiveQuartiles || [];
      
      console.log('[CompetitiveRenderer] Creating quartile-based legend:', {
        marketShareQuartiles,
        competitiveQuartiles
      });
      
      // Create dual-variable legend
      return {
        title: 'Competitive Analysis',
        type: 'dual-variable',
        components: [
          {
            title: 'Nike Market Share (%)',
            type: 'size',
            items: marketShareQuartiles.map((quartile: number, index: number) => ({
              label: index === 0 
                ? `≤ ${quartile.toFixed(1)}%` 
                : index === marketShareQuartiles.length - 1
                  ? `> ${marketShareQuartiles[index - 1].toFixed(1)}%`
                  : `${marketShareQuartiles[index - 1].toFixed(1)}% - ${quartile.toFixed(1)}%`,
              size: [8, 12, 16, 20][index], // Convert to actual pixel sizes
              value: quartile,
              quartile: index + 1
            }))
          },
          {
            title: 'Competitive Advantage (1-10 Scale)',
            type: 'color',
            items: competitiveQuartiles.map((quartile: number, index: number) => ({
              label: index === 0 
                ? `≤ ${quartile.toFixed(1)}` 
                : index === competitiveQuartiles.length - 1
                  ? `> ${competitiveQuartiles[index - 1].toFixed(1)}`
                  : `${competitiveQuartiles[index - 1].toFixed(1)} - ${quartile.toFixed(1)}`,
              color: ACTIVE_COLOR_SCHEME[index],
              value: quartile,
              quartile: index + 1
            }))
          }
        ],
        position: 'bottom-right',
        _quartileBased: true
      };
      
    } else {
      // Handle range-based legend (legacy)
      const marketShareRange = renderer._marketShareRange || [0, 100];
      const competitiveRange = renderer._competitiveScoreRange || [1, 10];
      
      return {
        title: 'Competitive Analysis',
        type: 'dual-variable',
        components: [
          {
            title: 'Nike Market Share (%)',
            type: 'size',
            items: [
              { label: `${marketShareRange[0].toFixed(1)}% - Low`, size: 8, value: marketShareRange[0] },
              { label: `${(marketShareRange[0] + (marketShareRange[1] - marketShareRange[0]) * 0.5).toFixed(1)}% - Medium`, size: 16, value: (marketShareRange[0] + marketShareRange[1]) / 2 },
              { label: `${marketShareRange[1].toFixed(1)}% - High`, size: 24, value: marketShareRange[1] }
            ]
          },
          {
            title: 'Competitive Advantage (1-10 Scale)',
            type: 'color',
            items: [
              { label: `${competitiveRange[0].toFixed(1)}/10 - Low Advantage`, color: '#FF6B6B', value: competitiveRange[0] },
              { label: `${((competitiveRange[0] + competitiveRange[1]) / 2).toFixed(1)}/10 - Moderate`, color: '#FFD700', value: (competitiveRange[0] + competitiveRange[1]) / 2 },
              { label: `${competitiveRange[1].toFixed(1)}/10 - High Advantage`, color: '#00FF7F', value: competitiveRange[1] }
            ]
          }
        ],
        position: 'bottom-right'
      };
    }
  }

  private createMarketShareLegend(metrics: CompetitiveMetrics): any {
    const breaks = this.calculateMarketShareBreaks(metrics.marketShareRange);
    const colors = this.getCompetitiveColors(breaks.length);
    
    const items = breaks.slice(0, -1).map((breakValue, index) => ({
      label: `${(breakValue * 100).toFixed(1)}% - ${(breaks[index + 1] * 100).toFixed(1)}%`,
      color: colors[index],
      value: breakValue,
      symbol: 'circle'
    }));

    return {
      title: 'Market Share',
      items,
      position: 'bottom-right',
      type: 'graduated-symbols'
    };
  }

  private createPositionLegend(metrics: CompetitiveMetrics): any {
    const items = metrics.categories.map(category => ({
      label: `${category.label} (${category.count})`,
      color: this.getPositionColor(category.name),
      value: category.name,
      symbol: this.getPositionSymbolType(category.name)
    }));

    return {
      title: 'Competitive Position',
      items,
      position: 'bottom-right',
      type: 'categorical'
    };
  }

  private createBasicCompetitiveLegend(metrics: CompetitiveMetrics): any {
    const breaks = this.calculateCompetitiveScoreBreaks(metrics.competitiveScoreRange);
    const colors = this.getCompetitiveColors(breaks.length);
    
    const items = breaks.slice(0, -1).map((breakValue, index) => ({
      label: `${breakValue.toFixed(1)} - ${breaks[index + 1].toFixed(1)}`,
      color: colors[index],
      value: breakValue
    }));

    return {
      title: 'Competitive Score',
      items,
      position: 'bottom-right',
      type: 'choropleth'
    };
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private calculateMarketShareRange(records: any[]): [number, number] {
    const marketShares = records
      .map(r => r.properties?.nike_market_share || r.properties?.market_share || 0)
      .filter(v => !isNaN(v));
    
    if (marketShares.length === 0) return [0, 100];
    
    return [Math.min(...marketShares), Math.max(...marketShares)];
  }

  private calculateCompetitiveScoreRange(records: any[]): [number, number] {
    const scores = records
      .map(r => r.value)
      .filter(v => !isNaN(v));
    
    if (scores.length === 0) return [0, 100];
    
    return [Math.min(...scores), Math.max(...scores)];
  }

  private analyzeCompetitiveCategories(records: any[]): CategoryInfo[] {
    const categoryMap = new Map<string, number>();
    
    records.forEach(record => {
      const category = record.category || 'unknown';
      categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
    });
    
    return Array.from(categoryMap.entries()).map(([name, count]) => ({
      name,
      label: this.formatCategoryLabel(name),
      count
    }));
  }

  private hasMarketShareData(records: any[]): boolean {
    return records.some(r => 
      r.properties?.nike_market_share !== undefined || 
      r.properties?.market_share !== undefined ||
      r.properties?.value_MP30034A_B_P !== undefined
    );
  }

  private hasBrandStrengthData(records: any[]): boolean {
    return records.some(r => 
      r.properties?.nike_market_share !== undefined || 
      r.properties?.adidas_market_share !== undefined ||
      r.properties?.brand_strength !== undefined ||
      r.properties?.value_MP30034A_B_P !== undefined ||
      r.properties?.value_MP30029A_B_P !== undefined
    );
  }

  private hasCompetitivePositionData(records: any[]): boolean {
    return records.some(r => r.properties.competitive_position !== undefined);
  }

  // ============================================================================
  // VISUAL VARIABLE CONFIGURATION
  // ============================================================================

  private createMarketShareSizeStops(marketShareRange: [number, number]): any[] {
    const [min, max] = marketShareRange;
    const range = max - min;
    
    // Market share percentage determines circle size
    return [
      { value: Math.max(0, min), size: 10 },
      { value: min + range * 0.25, size: 16 },
      { value: min + range * 0.5, size: 22 },
      { value: min + range * 0.75, size: 30 },
      { value: max, size: 40 }
    ];
  }

  private createCompetitiveColorStops(competitiveRange: [number, number]): any[] {
    const [min, max] = competitiveRange;
    const range = max - min;
    
    // Competitive advantage score determines color (red=low, green=high)
    return [
      { value: min, color: '#FF6B6B' },        // Red for low competitive advantage
      { value: min + range * 0.25, color: '#FFB347' }, // Orange
      { value: min + range * 0.5, color: '#FFD700' },  // Yellow/Gold
      { value: min + range * 0.75, color: '#90EE90' }, // Light Green
      { value: max, color: '#00FF7F' }         // Spring Green for high advantage
    ];
  }

  private createBrandStrengthColorStops(): any[] {
    // Color progression for market share (0-1 range) from low (red) to high (green) - standard scheme
    return [
      { value: 0, color: ACTIVE_COLOR_SCHEME[0] },      // Red - low market share
      { value: 0.1, color: ACTIVE_COLOR_SCHEME[1] },    // Orange
      { value: 0.2, color: '#fee08b' },                 // Yellow - moderate (keep intermediate color)
      { value: 0.3, color: ACTIVE_COLOR_SCHEME[2] },    // Light green
      { value: 0.4, color: ACTIVE_COLOR_SCHEME[3] }     // Green - high market share
    ];
  }

  private calculateMarketShareBreaks(range: [number, number]): number[] {
    const [min, max] = range;
    const numClasses = 5;
    const interval = (max - min) / numClasses;
    
    const breaks = [];
    for (let i = 0; i <= numClasses; i++) {
      breaks.push(min + (interval * i));
    }
    
    return breaks;
  }

  private calculateCompetitiveScoreBreaks(range: [number, number]): number[] {
    const [min, max] = range;
    const numClasses = 5;
    const interval = (max - min) / numClasses;
    
    const breaks = [];
    for (let i = 0; i <= numClasses; i++) {
      breaks.push(min + (interval * i));
    }
    
    return breaks;
  }

  private calculateSymbolSize(value: number, range: [number, number]): number {
    const [min, max] = range;
    const normalized = (value - min) / (max - min);
    return 8 + (normalized * 24); // 8-32 pixel range
  }

  private getCompetitiveColors(numClasses: number): string[] {
    // Standard color scheme for competitive analysis
    const colors = [
      ACTIVE_COLOR_SCHEME[0], // Red
      '#f46d43',              // Red-orange (intermediate)
      ACTIVE_COLOR_SCHEME[1], // Orange
      '#fee08b',              // Yellow (intermediate)
      ACTIVE_COLOR_SCHEME[2], // Light green
      '#66bd63',              // Green (intermediate)
      ACTIVE_COLOR_SCHEME[3]  // Dark green
    ];
    
    return colors.slice(0, numClasses);
  }

  private getFireflyColors(numClasses: number): string[] {
    // Firefly-inspired color scheme with bright, glowing colors
    const fireflyColors = [
      'rgba(215, 48, 39, 0.8)',   // Strong red - Low opportunity (matches quartile colors)
      'rgba(253, 174, 97, 0.8)',  // Orange - Moderate opportunity
      'rgba(166, 217, 106, 0.8)', // Light green - High opportunity
      'rgba(26, 152, 80, 0.9)'    // Dark green - Premium opportunity
    ];
    return fireflyColors.slice(0, numClasses);
  }

  private getPositionSymbol(position: string): any {
    const symbolMap: Record<string, any> = {
      'dominant': {
        type: 'simple-marker',
        style: 'diamond',
        color: ACTIVE_COLOR_SCHEME[3], // Green
        size: 16,
        outline: { color: [0, 0, 0, 0], width: 0 } // No border
      },
      'competitive': {
        type: 'simple-marker',
        style: 'circle',
        color: '#66bd63',
        size: 12,
        outline: { color: [0, 0, 0, 0], width: 0 } // No border
      },
      'challenged': {
        type: 'simple-marker',
        style: 'square',
        color: ACTIVE_COLOR_SCHEME[1], // Orange
        size: 10,
        outline: { color: [0, 0, 0, 0], width: 0 } // No border
      },
      'underperforming': {
        type: 'simple-marker',
        style: 'triangle',
        color: ACTIVE_COLOR_SCHEME[0], // Red
        size: 8,
        outline: { color: [0, 0, 0, 0], width: 0 } // No border
      }
    };
    
    return symbolMap[position] || symbolMap['challenged'];
  }

  private getPositionColor(position: string): string {
    const colorMap: Record<string, string> = {
      'dominant': ACTIVE_COLOR_SCHEME[3],     // Green
      'competitive': ACTIVE_COLOR_SCHEME[2],  // Light Green
      'challenged': ACTIVE_COLOR_SCHEME[1],   // Orange
      'underperforming': ACTIVE_COLOR_SCHEME[0] // Red
    };
    
    return colorMap[position] || ACTIVE_COLOR_SCHEME[1];
  }

  private getPositionSymbolType(position: string): string {
    const typeMap: Record<string, string> = {
      'dominant': 'diamond',
      'competitive': 'circle',
      'challenged': 'square',
      'underperforming': 'triangle'
    };
    
    return typeMap[position] || 'square';
  }

  private formatCategoryLabel(category: string): string {
    return category
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/\b\w/g, l => l.toUpperCase())
      .trim();
  }

  private getColorForRange(index: number, totalClasses: number): string {
    // Use standardized color scheme for competitive analysis (low to high)
    return ACTIVE_COLOR_SCHEME[Math.min(index, ACTIVE_COLOR_SCHEME.length - 1)];
  }

  // ============================================================================
  // ENHANCED VISUAL EFFECTS METHODS
  // ============================================================================

  /**
   * Create enhanced competitive legend with animations
   */
  private createEnhancedCompetitiveLegend(
    competitiveMetrics: CompetitiveMetrics, 
    renderingStrategy: RenderingStrategy, 
    data: ProcessedAnalysisData,
    renderer: any
  ): any {
    let baseLegend;
    
    // Use appropriate legend based on rendering strategy
    if (renderingStrategy === 'market-share-with-brand-strength' && renderer._dualVariable) {
      baseLegend = this.createMarketShareBrandLegend(competitiveMetrics, renderer);
    } else {
      baseLegend = this.createCompetitiveLegend(competitiveMetrics, renderingStrategy, data, renderer);
    }
    
    return {
      ...baseLegend,
      _enhancedEffects: {
        animated: true,
        pulseEffect: true,
        hoverExpansion: true,
        competitiveGlow: true
      }
    };
  }

  /**
   * Create market share animation configuration
   */
  private createMarketShareAnimation(competitiveMetrics: CompetitiveMetrics): any {
    return {
      type: 'market-share-pulse',
      enabled: competitiveMetrics.hasMarketShare,
      duration: 2000,
      phases: [
        {
          property: 'size',
          from: 1.0,
          to: 1.2,
          duration: 800,
          easing: 'ease-in-out'
        },
        {
          property: 'opacity',
          from: 0.8,
          to: 1.0,
          duration: 1000,
          easing: 'ease-out'
        },
        {
          property: 'glow',
          from: 0,
          to: 8,
          duration: 600,
          easing: 'ease-in'
        }
      ],
      triggers: {
        highOpportunity: {
          threshold: 70,
          intensityMultiplier: 1.5
        },
        mediumOpportunity: {
          threshold: 40,
          intensityMultiplier: 1.0
        }
      }
    };
  }

  /**
   * Create competitive positioning effects
   */
  private createCompetitivePositioning(data: ProcessedAnalysisData): any {
    return {
      type: 'competitive-positioning',
      enabled: true,
      effects: {
        dominant: {
          color: '#FFD700', // Gold
          glow: 12,
          pulse: true,
          particles: 5
        },
        competitive: {
          color: '#4A90E2', // Blue  
          glow: 8,
          pulse: false,
          particles: 3
        },
        opportunity: {
          color: '#00FF88', // Green
          glow: 10,
          pulse: true,
          particles: 4
        },
        trailing: {
          color: '#FF6B6B', // Red
          glow: 4,
          pulse: false,
          particles: 1
        }
      },
      transitions: {
        duration: 1500,
        easing: 'ease-in-out',
        stagger: 100 // Delay between feature animations
      }
    };
  }
}

// ============================================================================
// INTERFACES
// ============================================================================

interface CompetitiveMetrics {
  marketShareRange: [number, number];
  competitiveScoreRange: [number, number];
  categories: CategoryInfo[];
  hasMarketShare: boolean;
  hasBrandStrength: boolean;
  hasCompetitivePosition: boolean;
}

interface CategoryInfo {
  name: string;
  label: string;
  count: number;
}

type RenderingStrategy = 
  | 'market-share-with-brand-strength'
  | 'market-share-only'
  | 'competitive-position'
  | 'basic-competitive'; 