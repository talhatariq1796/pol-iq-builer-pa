/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ProcessedAnalysisData, VisualizationResult, VisualizationConfig } from '../../types';
import { EnhancedRendererBase, EnhancedVisualizationConfig } from './EnhancedRendererBase';

/**
 * GraduatedSymbolRenderer - Specialized renderer for multi-variable graduated symbols
 * 
 * Features:
 * - Size-based primary variable encoding (confidence, growth, ROI)
 * - Color-based secondary variable encoding (risk, category, performance)
 * - Opacity-based tertiary variable encoding (certainty, reliability)
 * - Perfect for price predictions with confidence + growth visualization
 * - Investment opportunities with ROI + risk encoding
 * - Property analysis with value + confidence + market position
 * - Optimized for point-based property data
 */
export class GraduatedSymbolRenderer extends EnhancedRendererBase {
  
  supportsType(type: string): boolean {
    return type === 'graduated-symbols';
  }

  render(data: ProcessedAnalysisData, config: EnhancedVisualizationConfig): VisualizationResult {
    console.log(`[GraduatedSymbolRenderer] Rendering ${data.records.length} records with graduated symbols`);
    
    // Detect multi-variable encoding fields
    const visualVariables = this.detectVisualVariables(data, config);
    if (!visualVariables.primaryVariable) {
      console.warn('[GraduatedSymbolRenderer] No suitable primary variable found for graduated symbols');
      return this.createFallbackVisualization(data, config);
    }
    
    console.log(`[GraduatedSymbolRenderer] Visual variables:`, visualVariables);
    
    // Create graduated symbol renderer
    const renderer = this.createGraduatedSymbolRenderer(data, visualVariables, config);
    
    // Create multi-variable legend
    const legend = this.createGraduatedSymbolLegend(data, visualVariables);
    
    // Create enhanced popup template
    const popupTemplate = this.createGraduatedSymbolPopupTemplate(data, config, visualVariables);
    
    return {
      type: 'graduated-symbols' as any,
      config: config,
      success: true,
      renderer,
      legend,
      popupTemplate,
      visualizationType: 'graduated-symbols',
      metadata: {
        ...visualVariables,
        symbolType: this.getSymbolType(visualVariables.primaryVariable),
        multiVariableCount: this.countActiveVariables(visualVariables),
        enhancedFeatures: ['multi_variable_encoding', 'graduated_sizing', 'confidence_opacity']
      }
    };
  }
  
  /**
   * Detect optimal visual variables for multi-dimensional encoding
   */
  private detectVisualVariables(data: ProcessedAnalysisData, config: VisualizationConfig): any {
    if (data.records.length === 0) {
      return { primaryVariable: null };
    }
    
    const firstRecord = data.records[0];
    const properties = firstRecord.properties;
    
    // Define visual variable candidates by priority and type
    const sizeVariableCandidates = [
      'price_confidence',           // Price prediction confidence
      'growth_potential',           // Growth potential
      'roi_potential',              // ROI potential
      'investment_score',           // Investment scoring
      'market_opportunity',         // Market opportunity
      'value_potential',            // Value potential
      'confidence_score',           // General confidence
      'prediction_reliability',     // Prediction reliability
      'market_strength',            // Market strength
      'demand_score',               // Demand scoring
      'value'                       // Primary value as fallback
    ];
    
    const colorVariableCandidates = [
      'risk_level',                 // Risk level (red = high risk)
      'risk_assessment',            // Risk assessment categories
      'market_category',            // Market categories
      'investment_timing',          // Investment timing
      'price_trend',                // Price trend direction
      'market_health',              // Market health categories
      'growth_category',            // Growth categories
      'performance_rating'          // Performance rating
    ];
    
    const opacityVariableCandidates = [
      'data_quality',               // Data quality
      'certainty_score',            // Certainty
      'reliability_index',          // Reliability
      'confidence_level',           // Confidence level
      'accuracy_score',             // Accuracy
      'stability_index'             // Stability
    ];
    
    // Find best variables for each visual dimension
    const primaryVariable = this.findBestVariable(data, sizeVariableCandidates);
    const colorVariable = this.findBestVariable(data, colorVariableCandidates);
    const opacityVariable = this.findBestVariable(data, opacityVariableCandidates);
    
    return {
      primaryVariable,              // SIZE encoding (most important)
      colorVariable,                // COLOR encoding (categorical or risk)
      opacityVariable,              // OPACITY encoding (certainty)
      sizeField: primaryVariable,
      colorField: colorVariable,
      opacityField: opacityVariable
    };
  }
  
  /**
   * Find the best variable from candidates that exists in data
   */
  private findBestVariable(data: ProcessedAnalysisData, candidates: string[]): string | null {
    const firstRecord = data.records[0];
    const properties = firstRecord.properties;
    
    for (const candidate of candidates) {
      if (candidate in properties) {
        const value = properties[candidate];
        // Check if it's a suitable numeric or categorical value
        if (typeof value === 'number' || typeof value === 'string') {
          // Verify good distribution across records
          const values = data.records.map(r => r.properties[candidate]);
          const uniqueValues = new Set(values);
          
          if (uniqueValues.size > 1) { // Must have variation
            console.log(`[GraduatedSymbolRenderer] Selected variable: ${candidate}`);
            return candidate;
          }
        }
      }
    }
    
    return null;
  }
  
  /**
   * Create ArcGIS graduated symbol renderer with multi-variable encoding
   */
  private createGraduatedSymbolRenderer(data: ProcessedAnalysisData, visualVariables: any, config: VisualizationConfig): any {
    const { primaryVariable, colorVariable, opacityVariable } = visualVariables;
    
    // Calculate size stops for primary variable
    const sizeStops = this.calculateSizeStops(data, primaryVariable);
    
    // Build visual variables array for ArcGIS
    const arcgisVisualVariables: any[] = [];
    
    // Add size visual variable (primary)
    arcgisVisualVariables.push({
      type: 'size',
      field: primaryVariable,
      stops: sizeStops,
      legendOptions: {
        title: this.formatFieldTitle(primaryVariable)
      }
    });
    
    // Add color visual variable if available
    if (colorVariable) {
      const colorStops = this.calculateColorStops(data, colorVariable);
      arcgisVisualVariables.push({
        type: 'color',
        field: colorVariable,
        stops: colorStops,
        legendOptions: {
          title: this.formatFieldTitle(colorVariable)
        }
      });
    }
    
    // Add opacity visual variable if available
    if (opacityVariable) {
      const opacityStops = this.calculateOpacityStops(data, opacityVariable);
      arcgisVisualVariables.push({
        type: 'opacity',
        field: opacityVariable,
        stops: opacityStops,
        legendOptions: {
          title: this.formatFieldTitle(opacityVariable)
        }
      });
    }
    
    return {
      type: 'simple',
      symbol: {
        type: 'simple-marker',
        style: 'circle',
        color: [60, 175, 240, 0.8], // Default blue
        outline: {
          color: [255, 255, 255, 0.8],
          width: 1
        },
        size: 12 // Base size
      },
      visualVariables: arcgisVisualVariables,
      // Enhanced graduated symbol properties
      graduatedSymbolConfig: {
        primaryVariable,
        colorVariable,
        opacityVariable,
        multiVariableEncoding: true,
        symbolStyle: 'circle'
      }
    };
  }
  
  /**
   * Calculate size stops for primary variable
   */
  private calculateSizeStops(data: ProcessedAnalysisData, field: string): any[] {
    const values = data.records.map(r => Number(r.properties[field]) || 0);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const midValue = (minValue + maxValue) / 2;
    
    return [
      { value: minValue, size: 8 },      // Small symbols for low values
      { value: midValue, size: 16 },     // Medium symbols for mid values
      { value: maxValue, size: 32 }      // Large symbols for high values
    ];
  }
  
  /**
   * Calculate color stops for secondary variable
   */
  private calculateColorStops(data: ProcessedAnalysisData, field: string): any[] {
    const values = data.records.map(r => r.properties[field]);
    const firstValue = values[0];
    
    // Handle categorical color variables
    if (typeof firstValue === 'string') {
      return this.createCategoricalColorStops(data, field);
    }
    
    // Handle numeric color variables (e.g., risk levels)
    const numericValues = values.map(v => Number(v) || 0);
    const minValue = Math.min(...numericValues);
    const maxValue = Math.max(...numericValues);
    const midValue = (minValue + maxValue) / 2;
    
    // Risk-based color scheme (green = low risk, red = high risk)
    return [
      { value: minValue, color: [46, 125, 50, 0.8] },   // Green (low risk/good)
      { value: midValue, color: [255, 193, 7, 0.8] },   // Yellow (medium risk)
      { value: maxValue, color: [244, 67, 54, 0.8] }    // Red (high risk/bad)
    ];
  }
  
  /**
   * Create categorical color stops for string-based variables
   */
  private createCategoricalColorStops(data: ProcessedAnalysisData, field: string): any[] {
    const values = data.records.map(r => r.properties[field]);
    const uniqueValues = Array.from(new Set(values));
    
    // Predefined color schemes for common categorical fields
    const categoricalColors: Record<string, Record<string, number[]>> = {
      risk_assessment: {
        'Low Risk': [46, 125, 50, 0.8],      // Green
        'Medium Risk': [255, 193, 7, 0.8],   // Yellow
        'High Risk': [244, 67, 54, 0.8],     // Red
        'Very High Risk': [183, 28, 28, 0.8] // Dark Red
      },
      investment_timing: {
        'Buy Now': [46, 125, 50, 0.8],       // Green
        'Monitor Market': [255, 193, 7, 0.8], // Yellow
        'Wait': [244, 67, 54, 0.8]           // Red
      },
      market_health: {
        'Excellent Market Health': [46, 125, 50, 0.8], // Green
        'Good Market Health': [102, 187, 106, 0.8],    // Light Green
        'Fair Market Health': [255, 193, 7, 0.8],      // Yellow
        'Poor Market Health': [244, 67, 54, 0.8],      // Red
        'Distressed Market': [183, 28, 28, 0.8]        // Dark Red
      }
    };
    
    const colorScheme = categoricalColors[field] || {};
    const defaultColors = [
      [33, 150, 243, 0.8],  // Blue
      [76, 175, 80, 0.8],   // Green
      [255, 193, 7, 0.8],   // Yellow
      [244, 67, 54, 0.8],   // Red
      [156, 39, 176, 0.8]   // Purple
    ];
    
    return uniqueValues.map((value, index) => ({
      value: value,
      color: colorScheme[value as string] || defaultColors[index % defaultColors.length]
    }));
  }
  
  /**
   * Calculate opacity stops for tertiary variable
   */
  private calculateOpacityStops(data: ProcessedAnalysisData, field: string): any[] {
    const values = data.records.map(r => Number(r.properties[field]) || 0);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    
    return [
      { value: minValue, opacity: 0.3 },    // Faded for low certainty
      { value: maxValue, opacity: 1.0 }     // Solid for high certainty
    ];
  }
  
  /**
   * Create multi-variable legend for graduated symbols
   */
  private createGraduatedSymbolLegend(data: ProcessedAnalysisData, visualVariables: any): any {
    const { primaryVariable, colorVariable, opacityVariable } = visualVariables;
    
    const legendSections: any[] = [];
    
    // Size legend section
    if (primaryVariable) {
      const values = data.records.map(r => Number(r.properties[primaryVariable]) || 0);
      const minValue = Math.min(...values);
      const maxValue = Math.max(...values);
      
      legendSections.push({
        type: 'size',
        title: this.formatFieldTitle(primaryVariable),
        items: [
          { label: `High ${this.formatFieldTitle(primaryVariable)}`, size: 32, value: maxValue },
          { label: `Medium ${this.formatFieldTitle(primaryVariable)}`, size: 16, value: (minValue + maxValue) / 2 },
          { label: `Low ${this.formatFieldTitle(primaryVariable)}`, size: 8, value: minValue }
        ]
      });
    }
    
    // Color legend section
    if (colorVariable) {
      legendSections.push({
        type: 'color',
        title: this.formatFieldTitle(colorVariable),
        items: this.createColorLegendItems(data, colorVariable)
      });
    }
    
    // Opacity legend section
    if (opacityVariable) {
      legendSections.push({
        type: 'opacity',
        title: this.formatFieldTitle(opacityVariable),
        items: [
          { label: 'High Confidence', opacity: 1.0 },
          { label: 'Low Confidence', opacity: 0.3 }
        ]
      });
    }
    
    return {
      title: 'Graduated Symbols',
      sections: legendSections,
      position: 'bottom-right',
      type: 'multi-variable'
    };
  }
  
  /**
   * Create color legend items for categorical or numeric variables
   */
  private createColorLegendItems(data: ProcessedAnalysisData, field: string): any[] {
    const values = data.records.map(r => r.properties[field]);
    const firstValue = values[0];
    
    if (typeof firstValue === 'string') {
      // Categorical legend items
      const uniqueValues = Array.from(new Set(values));
      return uniqueValues.map(value => ({
        label: value,
        color: this.getCategoryColor(field, value as string),
        value
      }));
    } else {
      // Numeric legend items
      const numericValues = values.map(v => Number(v) || 0);
      const minValue = Math.min(...numericValues);
      const maxValue = Math.max(...numericValues);
      
      return [
        { label: 'High Risk', color: [244, 67, 54, 0.8], value: maxValue },
        { label: 'Medium Risk', color: [255, 193, 7, 0.8], value: (minValue + maxValue) / 2 },
        { label: 'Low Risk', color: [46, 125, 50, 0.8], value: minValue }
      ];
    }
  }
  
  /**
   * Get color for a specific category
   */
  private getCategoryColor(field: string, value: string): number[] {
    // This would use the same logic as createCategoricalColorStops
    return [33, 150, 243, 0.8]; // Default blue
  }
  
  /**
   * Create popup template for graduated symbols
   */
  private createGraduatedSymbolPopupTemplate(data: ProcessedAnalysisData, config: VisualizationConfig, visualVariables: any): any {
    const { primaryVariable, colorVariable, opacityVariable } = visualVariables;
    
    const content: any[] = [
      {
        type: 'text',
        text: '<h3>{' + (config.labelField || 'area_name') + '}</h3>'
      }
    ];
    
    // Add visual variable information
    if (primaryVariable) {
      content.push({
        type: 'text',
        text: `<p><strong>${this.formatFieldTitle(primaryVariable)}:</strong> {${primaryVariable}}</p>`
      });
    }
    
    if (colorVariable) {
      content.push({
        type: 'text',
        text: `<p><strong>${this.formatFieldTitle(colorVariable)}:</strong> {${colorVariable}}</p>`
      });
    }
    
    if (opacityVariable) {
      content.push({
        type: 'text',
        text: `<p><strong>${this.formatFieldTitle(opacityVariable)}:</strong> {${opacityVariable}}</p>`
      });
    }
    
    return {
      title: '{' + (config.labelField || 'area_name') + '}',
      content
    };
  }
  
  /**
   * Get symbol type based on primary variable
   */
  private getSymbolType(primaryVariable: string): string {
    const symbolTypes: Record<string, string> = {
      price_confidence: 'confidence_circles',
      growth_potential: 'growth_symbols',
      roi_potential: 'investment_symbols',
      risk_level: 'risk_symbols'
    };
    
    return symbolTypes[primaryVariable] || 'graduated_circles';
  }
  
  /**
   * Count active visual variables
   */
  private countActiveVariables(visualVariables: any): number {
    let count = 0;
    if (visualVariables.primaryVariable) count++;
    if (visualVariables.colorVariable) count++;
    if (visualVariables.opacityVariable) count++;
    return count;
  }
  
  /**
   * Create fallback visualization
   */
  private createFallbackVisualization(data: ProcessedAnalysisData, config: EnhancedVisualizationConfig): VisualizationResult {
    return {
      type: 'choropleth' as any,
      config: config,
      renderer: null,
      popupTemplate: null,
      legend: { title: 'No Data', items: [], position: 'bottom-right' },
      success: false,
      error: 'No suitable variables found for graduated symbols',
      fallback: 'choropleth',
      metadata: {
        reason: 'missing_suitable_variables',
        suggestion: 'Use choropleth or categorical visualization'
      }
    };
  }
  
  /**
   * Format field name for display
   */
  private formatFieldTitle(field: string): string {
    return field
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/\b\w/g, l => l.toUpperCase())
      .trim();
  }
}