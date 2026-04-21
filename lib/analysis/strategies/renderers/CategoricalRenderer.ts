/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ProcessedAnalysisData, VisualizationResult, VisualizationConfig } from '../../types';
import { EnhancedRendererBase, EnhancedVisualizationConfig } from './EnhancedRendererBase';

/**
 * CategoricalRenderer - Specialized renderer for categorical data visualization
 * 
 * Features:
 * - Unique value renderer for categorical fields
 * - Smart category detection and color assignment
 * - Market health, trend direction, and stability categories
 * - Enhanced symbols for each category
 * - Accessibility-compliant color schemes
 */
export class CategoricalRenderer extends EnhancedRendererBase {
  
  supportsType(type: string): boolean {
    return type === 'categorical';
  }

  render(data: ProcessedAnalysisData, config: EnhancedVisualizationConfig): VisualizationResult {
    console.log(`[CategoricalRenderer] Rendering ${data.records.length} records with categorical visualization`);
    
    // Detect categorical field to use for visualization
    const categoricalField = this.detectCategoricalField(data, config);
    if (!categoricalField) {
      console.warn('[CategoricalRenderer] No suitable categorical field found, falling back to value-based rendering');
      return this.createFallbackVisualization(data, config);
    }
    
    console.log(`[CategoricalRenderer] Using categorical field: ${categoricalField}`);
    
    // Extract unique categories from data
    const categories = this.extractCategories(data, categoricalField);
    console.log(`[CategoricalRenderer] Found ${categories.length} unique categories:`, categories);
    
    // Create category-based color scheme
    const categoryColors = this.createCategoryColorScheme(categories, categoricalField);
    
    // Create ArcGIS unique value renderer
    const renderer = this.createUniqueValueRenderer(categoricalField, categories, categoryColors);
    
    // Create categorical legend
    const legend = this.createCategoricalLegend(categories, categoryColors, categoricalField);
    
    // Create enhanced popup template
    const popupTemplate = this.createCategoricalPopupTemplate(data, config, categoricalField);
    
    return {
      type: 'categorical' as any,
      config: config,
      success: true,
      renderer,
      legend,
      popupTemplate,
      visualizationType: 'categorical',
      metadata: {
        categoricalField,
        categoryCount: categories.length,
        categories,
        enhancedFeatures: ['categorical_symbols', 'smart_colors', 'accessibility_support']
      }
    };
  }
  
  /**
   * Detect the most suitable categorical field in the data
   */
  private detectCategoricalField(data: ProcessedAnalysisData, config: VisualizationConfig): string | null {
    // Check for explicit categorical field in config
    if (config.categoricalField && typeof config.categoricalField === 'string') {
      return config.categoricalField;
    }
    
    // Get first record to examine available fields
    if (data.records.length === 0) {
      return null;
    }
    
    const firstRecord = data.records[0];
    const properties = firstRecord.properties;
    
    // Priority order for categorical fields
    const categoricalFieldCandidates = [
      'market_health',                    // Market health categories
      'market_trend_direction',           // Trend directions
      'price_stability',                  // Price stability levels
      'supply_demand_balance',            // Supply/demand categories
      'rental_market_strength',           // Rental market categories
      'yield_classification',             // Yield categories
      'tenant_market_profile',            // Tenant categories
      'investment_viability',             // Investment categories
      'prediction_reliability',           // Reliability categories
      'price_prediction_outlook',         // Prediction outlook
      'investment_timing',                // Timing categories
      'risk_assessment',                  // Risk categories
      'valuation_reliability',            // Valuation categories
      'competitive_position',             // Competitive categories
      'market_comparison_strength',       // Comparison categories
      'pricing_strategy_recommendation',  // Strategy categories
      'category'                          // Generic category field
    ];
    
    // Find first matching categorical field with string values
    for (const field of categoricalFieldCandidates) {
      if (field in properties) {
        const value = properties[field];
        if (typeof value === 'string' && value.length > 0) {
          // Verify this field has multiple unique values across records
          const uniqueValues = new Set(
            data.records.map(r => r.properties[field]).filter(v => typeof v === 'string')
          );
          if (uniqueValues.size > 1 && uniqueValues.size <= 10) { // Reasonable number of categories
            console.log(`[CategoricalRenderer] Selected categorical field: ${field} with ${uniqueValues.size} categories`);
            return field;
          }
        }
      }
    }
    
    return null;
  }
  
  /**
   * Extract unique categories from the data
   */
  private extractCategories(data: ProcessedAnalysisData, categoricalField: string): string[] {
    const categorySet = new Set<string>();
    
    data.records.forEach(record => {
      const value = record.properties[categoricalField];
      if (typeof value === 'string' && value.length > 0) {
        categorySet.add(value);
      }
    });
    
    return Array.from(categorySet).sort();
  }
  
  /**
   * Create color scheme optimized for categorical data
   */
  private createCategoryColorScheme(categories: string[], categoricalField: string): Record<string, string> {
    const colorSchemes: Record<string, string[]> = {
      // Market health color scheme (green to red)
      market_health: [
        '#26A69A',  // Excellent - Teal
        '#66BB6A',  // Good - Green  
        '#FFA726',  // Fair - Orange
        '#EF5350',  // Poor - Red
        '#B71C1C'   // Distressed - Dark Red
      ],
      
      // Trend direction color scheme (blue to red)
      market_trend_direction: [
        '#1976D2',  // Rapidly Rising - Blue
        '#42A5F5',  // Rising - Light Blue
        '#66BB6A',  // Stable - Green
        '#FF7043',  // Declining - Orange
        '#E53935'   // Rapidly Declining - Red
      ],
      
      // Price stability color scheme (green to red)
      price_stability: [
        '#2E7D32',  // Very Stable - Dark Green
        '#4CAF50',  // Stable - Green
        '#FFC107',  // Moderate - Yellow
        '#FF9800',  // High Volatility - Orange
        '#F44336'   // Very Volatile - Red
      ],
      
      // Default qualitative color scheme
      default: [
        '#1f77b4',  // Blue
        '#ff7f0e',  // Orange
        '#2ca02c',  // Green
        '#d62728',  // Red
        '#9467bd',  // Purple
        '#8c564b',  // Brown
        '#e377c2',  // Pink
        '#7f7f7f',  // Gray
        '#bcbd22',  // Olive
        '#17becf'   // Cyan
      ]
    };
    
    // Select appropriate color scheme
    const colors = colorSchemes[categoricalField] || colorSchemes.default;
    
    // Map categories to colors
    const categoryColors: Record<string, string> = {};
    categories.forEach((category, index) => {
      categoryColors[category] = colors[index % colors.length];
    });
    
    return categoryColors;
  }
  
  /**
   * Create ArcGIS unique value renderer for categorical data
   */
  private createUniqueValueRenderer(field: string, categories: string[], categoryColors: Record<string, string>): any {
    const uniqueValueInfos = categories.map(category => ({
      value: category,
      symbol: {
        type: 'simple-fill',
        color: this.hexToRgba(categoryColors[category], 0.7),
        outline: {
          color: this.hexToRgba(categoryColors[category], 1.0),
          width: 1.5
        }
      },
      label: category
    }));
    
    return {
      type: 'unique-value',
      field: field,
      uniqueValueInfos,
      defaultSymbol: {
        type: 'simple-fill',
        color: [128, 128, 128, 0.5],
        outline: {
          color: [128, 128, 128, 0.8],
          width: 1
        }
      },
      defaultLabel: 'Other'
    };
  }
  
  /**
   * Create legend for categorical visualization
   */
  private createCategoricalLegend(categories: string[], categoryColors: Record<string, string>, field: string): any {
    const legendItems = categories.map(category => ({
      label: category,
      color: categoryColors[category],
      symbol: 'square',
      value: category
    }));
    
    return {
      title: this.formatCategoricalFieldTitle(field),
      items: legendItems,
      position: 'bottom-right',
      type: 'categorical'
    };
  }
  
  /**
   * Create popup template optimized for categorical data
   */
  private createCategoricalPopupTemplate(data: ProcessedAnalysisData, config: VisualizationConfig, categoricalField: string): any {
    const content: any[] = [
      {
        type: 'text',
        text: '<h3>{' + (config.labelField || 'area_name') + '}</h3>'
      },
      {
        type: 'text', 
        text: `<p><strong>${this.formatCategoricalFieldTitle(categoricalField)}:</strong> {${categoricalField}}</p>`
      }
    ];
    
    // Add additional relevant fields
    const additionalFields = this.getRelevantFields(data, categoricalField);
    if (additionalFields.length > 0) {
      content.push({
        type: 'fields',
        fieldInfos: additionalFields.map(field => ({
          fieldName: field,
          label: this.formatCategoricalFieldLabel(field)
        }))
      });
    }
    
    return {
      title: '{' + (config.labelField || 'area_name') + '}',
      content
    };
  }
  
  /**
   * Create fallback visualization when no categorical field is found
   */
  private createFallbackVisualization(data: ProcessedAnalysisData, config: EnhancedVisualizationConfig): VisualizationResult {
    return {
      type: 'choropleth' as any,
      config: config,
      renderer: null,
      popupTemplate: null,
      legend: { title: 'No Data', items: [], position: 'bottom-right' },
      success: false,
      error: 'No suitable categorical field found for categorical visualization',
      fallback: 'choropleth',
      metadata: {
        reason: 'missing_categorical_field',
        suggestion: 'Use choropleth or other visualization type'
      }
    };
  }
  
  /**
   * Get relevant fields to display alongside the categorical field
   */
  private getRelevantFields(data: ProcessedAnalysisData, categoricalField: string): string[] {
    if (data.records.length === 0) return [];
    
    const properties = data.records[0].properties;
    const relevantFields: string[] = [];
    
    // Add value field if available
    if ('value' in properties) {
      relevantFields.push('value');
    }
    
    // Add numeric fields related to the categorical field
    const numericFields = Object.keys(properties).filter(key => {
      const value = properties[key];
      return typeof value === 'number' && key !== 'value' && !key.includes('_id');
    });
    
    // Limit to most relevant numeric fields (3-5)
    relevantFields.push(...numericFields.slice(0, 4));
    
    return relevantFields;
  }
  
  /**
   * Format categorical field name for display
   */
  private formatCategoricalFieldTitle(field: string): string {
    return field
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/\b\w/g, l => l.toUpperCase())
      .trim();
  }
  
  /**
   * Format field name for display
   */
  private formatCategoricalFieldLabel(field: string): string {
    return field
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/\b\w/g, l => l.toUpperCase())
      .trim();
  }
  
  /**
   * Convert hex color to RGBA array
   */
  private hexToRgba(hex: string, alpha: number): number[] {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b, alpha];
  }
}