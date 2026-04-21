/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ProcessedAnalysisData, VisualizationResult, VisualizationConfig, VisualizationType } from '../../types';
import { EnhancedRendererBase, EnhancedVisualizationConfig } from './EnhancedRendererBase';

/**
 * BivariateRenderer - Specialized renderer for two-variable comparative analysis
 * 
 * Features:
 * - 2D color matrix for comparative market analysis (price vs. market strength)
 * - Affordability analysis (price vs. income levels)
 * - Risk vs. opportunity analysis 
 * - Performance vs. stability comparisons
 * - 3x3 or 4x4 bivariate color matrices
 * - Optimal for CMA and comparative analysis endpoints
 * - Clear legend showing variable relationships
 */
export class BivariateRenderer extends EnhancedRendererBase {
  
  supportsType(type: string): boolean {
    return type === 'bivariate';
  }

  render(data: ProcessedAnalysisData, config: EnhancedVisualizationConfig): VisualizationResult {
    console.log(`[BivariateRenderer] Rendering ${data.records.length} records with bivariate analysis`);
    
    // Detect optimal bivariate variable pair
    const bivariateVariables = this.detectBivariateVariables(data, config);
    if (!bivariateVariables.xVariable || !bivariateVariables.yVariable) {
      console.warn('[BivariateRenderer] Could not find suitable bivariate variable pair');
      return this.createFallbackVisualization(data, config);
    }
    
    console.log(`[BivariateRenderer] Bivariate variables: X=${bivariateVariables.xVariable}, Y=${bivariateVariables.yVariable}`);
    
    // Create bivariate classification matrix
    const classificationMatrix = this.createBivariateClassification(data, bivariateVariables);
    
    // Create bivariate renderer
    const renderer = this.createBivariateRenderer(data, bivariateVariables, classificationMatrix);
    
    // Create bivariate legend with 2D matrix
    const legend = this.createBivariateLegend(bivariateVariables, classificationMatrix);
    
    // Create enhanced popup template
    const popupTemplate = this.createBivariatePopupTemplate(data, config, bivariateVariables);
    
    return {
      type: 'bivariate',
      config,
      renderer,
      legend,
      popupTemplate,
      success: true,
      visualizationType: 'bivariate',
      metadata: {
        ...bivariateVariables,
        matrixSize: classificationMatrix.gridSize,
        analysisType: this.getBivariateAnalysisType(bivariateVariables),
        enhancedFeatures: ['bivariate_matrix', 'comparative_analysis', '2d_color_encoding']
      }
    };
  }
  
  /**
   * Detect optimal bivariate variable pair for comparative analysis
   */
  private detectBivariateVariables(data: ProcessedAnalysisData, config: VisualizationConfig): any {
    if (data.records.length === 0) {
      return { xVariable: null, yVariable: null };
    }
    
    const firstRecord = data.records[0];
    const properties = firstRecord.properties;
    
    // Define bivariate analysis patterns for different endpoints
    const bivariatePatterns: Record<string, { x: string[], y: string[] }> = {
      // CMA Analysis: Price vs Market Strength
      cma_analysis: {
        x: ['price_level', 'property_price', 'avg_price', 'price_comparison', 'current_price'],
        y: ['market_strength', 'market_position', 'market_health', 'competitive_position', 'value_accuracy']
      },
      
      // Affordability Analysis: Price vs Income
      affordability: {
        x: ['property_price', 'price_level', 'avg_price', 'housing_cost'],
        y: ['income_level', 'median_income', 'household_income', 'affordability_index']
      },
      
      // Investment Analysis: ROI vs Risk
      investment: {
        x: ['roi_potential', 'return_rate', 'investment_score', 'profit_potential'],
        y: ['risk_level', 'risk_score', 'volatility', 'stability_index']
      },
      
      // Market Analysis: Performance vs Stability
      market_performance: {
        x: ['market_performance', 'growth_rate', 'appreciation_rate', 'performance_score'],
        y: ['market_stability', 'price_stability', 'volatility_index', 'stability_score']
      },
      
      // General comparative patterns
      general: {
        x: ['value', 'score', 'rating', 'performance', 'opportunity'],
        y: ['risk', 'stability', 'confidence', 'quality', 'strength']
      }
    };
    
    // Try to detect analysis type and use appropriate pattern
    const analysisType = this.detectAnalysisType(data);
    const pattern = bivariatePatterns[analysisType] || bivariatePatterns.general;
    
    // Find best X variable (horizontal axis)
    const xVariable = this.findBestBivariateVariable(data, pattern.x);
    
    // Find best Y variable (vertical axis)
    const yVariable = this.findBestBivariateVariable(data, pattern.y);
    
    return {
      xVariable,
      yVariable,
      analysisType,
      xAxisTitle: xVariable ? this.formatFieldTitle(xVariable) : 'X Variable',
      yAxisTitle: yVariable ? this.formatFieldTitle(yVariable) : 'Y Variable'
    };
  }
  
  /**
   * Detect analysis type based on data characteristics
   */
  private detectAnalysisType(data: ProcessedAnalysisData): string {
    const dataType = data.type || '';
    
    if (dataType.includes('cma') || dataType.includes('comparative')) {
      return 'cma_analysis';
    }
    if (dataType.includes('afford')) {
      return 'affordability';
    }
    if (dataType.includes('invest')) {
      return 'investment';
    }
    if (dataType.includes('market') || dataType.includes('performance')) {
      return 'market_performance';
    }
    
    return 'general';
  }
  
  /**
   * Find best bivariate variable from candidates
   */
  private findBestBivariateVariable(data: ProcessedAnalysisData, candidates: string[]): string | null {
    const firstRecord = data.records[0];
    const properties = firstRecord.properties;
    
    for (const candidate of candidates) {
      if (candidate in properties) {
        const value = properties[candidate];
        if (typeof value === 'number') {
          // Verify good distribution across records
          const values = data.records.map(r => Number(r.properties[candidate]) || 0);
          const uniqueValues = new Set(values);
          const range = Math.max(...values) - Math.min(...values);
          
          if (uniqueValues.size > 2 && range > 0) { // Good variation for bivariate analysis
            console.log(`[BivariateRenderer] Selected bivariate variable: ${candidate}`);
            return candidate;
          }
        }
      }
    }
    
    return null;
  }
  
  /**
   * Create bivariate classification matrix (3x3 or 4x4)
   */
  private createBivariateClassification(data: ProcessedAnalysisData, bivariateVariables: any): any {
    const { xVariable, yVariable } = bivariateVariables;
    
    // Calculate quantiles for both variables
    const xValues = data.records.map(r => Number(r.properties[xVariable]) || 0);
    const yValues = data.records.map(r => Number(r.properties[yVariable]) || 0);
    
    const xQuantiles = this.calculateQuantiles(xValues, 3); // 3x3 matrix
    const yQuantiles = this.calculateQuantiles(yValues, 3);
    
    // Create bivariate color matrix
    const colorMatrix = this.createBivariateColorMatrix(3, bivariateVariables);
    
    return {
      gridSize: 3,
      xQuantiles,
      yQuantiles,
      colorMatrix,
      xVariable,
      yVariable
    };
  }
  
  /**
   * Calculate quantiles for dividing variable into classes
   */
  private calculateQuantiles(values: number[], classes: number): number[] {
    const sortedValues = [...values].sort((a, b) => a - b);
    const quantiles: number[] = [];
    
    for (let i = 1; i < classes; i++) {
      const index = Math.floor((i / classes) * sortedValues.length);
      quantiles.push(sortedValues[index]);
    }
    
    return quantiles;
  }
  
  /**
   * Create bivariate color matrix for different variable combinations
   */
  private createBivariateColorMatrix(gridSize: number, bivariateVariables: any): string[][] {
    const { xVariable, yVariable, analysisType } = bivariateVariables;
    
    // Define color matrices for different analysis types
    const colorMatrices: Record<string, string[][]> = {
      // CMA Analysis: Price (X) vs Market Strength (Y)
      // High price + High strength = Purple (premium market)
      // Low price + High strength = Green (opportunity)
      // High price + Low strength = Red (overpriced)
      // Low price + Low strength = Yellow (caution)
      cma_analysis: [
        ['#fee08c', '#fdcc8a', '#fc8d59'], // Low Y (Low strength): Yellow to Orange
        ['#d9f0a3', '#a1d99b', '#74c476'], // Mid Y (Medium strength): Light to Medium Green
        ['#d9d9f3', '#9e9ac8', '#756bb1']  // High Y (High strength): Light to Dark Purple
      ],
      
      // Investment Analysis: ROI (X) vs Risk (Y)
      // High ROI + Low Risk = Dark Green (excellent)
      // Low ROI + High Risk = Dark Red (poor)
      investment: [
        ['#2166ac', '#762a83', '#d01c8b'], // Low Y (Low risk): Blue to Purple
        ['#f7f7f7', '#dfc27d', '#bf812d'], // Mid Y (Medium risk): Neutral tones
        ['#fdbf6f', '#e31a1c', '#800026']  // High Y (High risk): Orange to Dark Red
      ],
      
      // General bivariate: Blue-Purple-Red scheme
      general: [
        ['#e0ecf4', '#9ebcda', '#8856a7'], // Low Y: Light Blue to Purple
        ['#f0f0f0', '#bdbdbd', '#636363'], // Mid Y: Grays
        ['#fee5d9', '#fcae91', '#de2d26']  // High Y: Light Red to Dark Red
      ]
    };
    
    return colorMatrices[analysisType] || colorMatrices.general;
  }
  
  /**
   * Create ArcGIS bivariate renderer
   */
  private createBivariateRenderer(data: ProcessedAnalysisData, bivariateVariables: any, classificationMatrix: any): any {
    const { xVariable, yVariable } = bivariateVariables;
    const { xQuantiles, yQuantiles, colorMatrix } = classificationMatrix;
    
    // Create class break infos for bivariate classification
    const classBreakInfos = this.createBivariateClassBreaks(
      data,
      xVariable,
      yVariable,
      xQuantiles,
      yQuantiles,
      colorMatrix
    );
    
    return {
      type: 'class-breaks',
      field: xVariable, // Primary field for ArcGIS compatibility
      classBreakInfos,
      // Bivariate-specific configuration
      bivariateConfig: {
        xVariable,
        yVariable,
        xQuantiles,
        yQuantiles,
        colorMatrix,
        gridSize: colorMatrix.length
      },
      // Custom bivariate renderer properties
      _bivariateMode: true,
      _secondaryField: yVariable
    };
  }
  
  /**
   * Create class breaks for bivariate classification
   */
  private createBivariateClassBreaks(
    data: ProcessedAnalysisData,
    xVariable: string,
    yVariable: string,
    xQuantiles: number[],
    yQuantiles: number[],
    colorMatrix: string[][]
  ): any[] {
    const classBreaks: any[] = [];
    
    // Classify each record into bivariate classes
    data.records.forEach(record => {
      const xValue = Number(record.properties[xVariable]) || 0;
      const yValue = Number(record.properties[yVariable]) || 0;
      
      const xClass = this.getClassIndex(xValue, xQuantiles);
      const yClass = this.getClassIndex(yValue, yQuantiles);
      
      const color = this.hexToRgba(colorMatrix[yClass][xClass], 0.8);
      
      classBreaks.push({
        minValue: xValue - 0.001, // Slight offset for unique classification
        maxValue: xValue + 0.001,
        symbol: {
          type: 'simple-fill',
          color,
          outline: {
            color: [255, 255, 255, 0.5],
            width: 1
          }
        },
        label: `${this.getClassLabel(xClass)} X, ${this.getClassLabel(yClass)} Y`,
        bivariateClass: { x: xClass, y: yClass }
      });
    });
    
    return classBreaks;
  }
  
  /**
   * Get class index for a value based on quantiles
   */
  private getClassIndex(value: number, quantiles: number[]): number {
    for (let i = 0; i < quantiles.length; i++) {
      if (value <= quantiles[i]) {
        return i;
      }
    }
    return quantiles.length; // Highest class
  }
  
  /**
   * Get class label (Low, Medium, High)
   */
  private getClassLabel(classIndex: number): string {
    const labels = ['Low', 'Medium', 'High'];
    return labels[classIndex] || 'High';
  }
  
  /**
   * Create bivariate legend with 2D matrix
   */
  private createBivariateLegend(bivariateVariables: any, classificationMatrix: any): any {
    const { xAxisTitle, yAxisTitle } = bivariateVariables;
    const { colorMatrix } = classificationMatrix;
    
    // Create 2D legend matrix
    const legendMatrix = colorMatrix.map((row: any[], yIndex: number) =>
      row.map((color: any, xIndex: number) => ({
        color,
        xClass: xIndex,
        yClass: yIndex,
        xLabel: this.getClassLabel(xIndex),
        yLabel: this.getClassLabel(yIndex),
        description: this.getBivariateDescription(xIndex, yIndex, bivariateVariables)
      }))
    );
    
    return {
      title: 'Bivariate Analysis',
      type: 'bivariate-matrix',
      xAxisTitle,
      yAxisTitle,
      legendMatrix,
      position: 'bottom-right',
      instructions: `${yAxisTitle} (vertical) vs ${xAxisTitle} (horizontal)`
    };
  }
  
  /**
   * Get description for bivariate combination
   */
  private getBivariateDescription(xClass: number, yClass: number, bivariateVariables: any): string {
    const { analysisType } = bivariateVariables;
    
    const descriptions: Record<string, Record<string, string>> = {
      cma_analysis: {
        '0,0': 'Low Price, Weak Market',      // Bottom-left
        '0,2': 'Low Price, Strong Market',    // Top-left (opportunity)
        '2,0': 'High Price, Weak Market',     // Bottom-right (overpriced)
        '2,2': 'High Price, Strong Market',   // Top-right (premium)
        '1,1': 'Balanced Market'              // Center
      },
      investment: {
        '0,0': 'Low ROI, Low Risk',
        '0,2': 'Low ROI, High Risk',          // Poor investment
        '2,0': 'High ROI, Low Risk',          // Excellent investment
        '2,2': 'High ROI, High Risk',
        '1,1': 'Moderate Investment'
      },
      general: {
        '0,0': 'Low-Low',
        '0,2': 'Low-High',
        '2,0': 'High-Low',
        '2,2': 'High-High',
        '1,1': 'Medium-Medium'
      }
    };
    
    const key = `${xClass},${yClass}`;
    const typeDescriptions = descriptions[analysisType] || descriptions.general;
    return typeDescriptions[key] || typeDescriptions['1,1'];
  }
  
  /**
   * Create popup template for bivariate analysis
   */
  private createBivariatePopupTemplate(data: ProcessedAnalysisData, config: VisualizationConfig, bivariateVariables: any): any {
    const { xVariable, yVariable, xAxisTitle, yAxisTitle } = bivariateVariables;
    
    const content: any[] = [
      {
        type: 'text',
        text: '<h3>{' + (config.labelField || 'area_name') + '}</h3>'
      },
      {
        type: 'text',
        text: `<p><strong>${xAxisTitle}:</strong> {${xVariable}}</p>`
      },
      {
        type: 'text',
        text: `<p><strong>${yAxisTitle}:</strong> {${yVariable}}</p>`
      },
      {
        type: 'text',
        text: '<p><strong>Bivariate Category:</strong> {bivariate_category}</p>'
      }
    ];
    
    return {
      title: '{' + (config.labelField || 'area_name') + '}',
      content
    };
  }
  
  /**
   * Get bivariate analysis type
   */
  private getBivariateAnalysisType(bivariateVariables: any): string {
    const { xVariable, yVariable } = bivariateVariables;
    
    if (xVariable?.includes('price') && yVariable?.includes('market')) {
      return 'price_vs_market_strength';
    }
    if (xVariable?.includes('roi') && yVariable?.includes('risk')) {
      return 'roi_vs_risk';
    }
    if (xVariable?.includes('price') && yVariable?.includes('income')) {
      return 'affordability_analysis';
    }
    
    return 'general_bivariate';
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
  
  /**
   * Create fallback visualization
   */
  private createFallbackVisualization(data: ProcessedAnalysisData, config: EnhancedVisualizationConfig): VisualizationResult {
    return {
      type: 'choropleth' as VisualizationType,
      config: config,
      renderer: null,
      popupTemplate: null,
      legend: { title: 'No Data', items: [], position: 'bottom-right' },
      success: false,
      error: 'Could not find suitable bivariate variable pair',
      fallback: 'choropleth',
      metadata: {
        reason: 'insufficient_bivariate_variables',
        suggestion: 'Use choropleth or graduated symbols instead'
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