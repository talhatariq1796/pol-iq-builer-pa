/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ProcessedAnalysisData, VisualizationResult, VisualizationConfig } from '../../types';
import { EnhancedRendererBase, EnhancedVisualizationConfig } from './EnhancedRendererBase';

/**
 * HeatmapRenderer - Specialized renderer for density-based heat map visualization
 * 
 * Features:
 * - Point density heat mapping for activity concentration
 * - Rental demand intensity visualization
 * - Market activity density rendering
 * - Risk concentration mapping
 * - Dynamic intensity calculation
 * - Gradient color schemes for heat intensity
 * - Optimal for spatial density analysis
 */
export class HeatmapRenderer extends EnhancedRendererBase {
  
  supportsType(type: string): boolean {
    return type === 'heatmap';
  }

  render(data: ProcessedAnalysisData, config: EnhancedVisualizationConfig): VisualizationResult {
    console.log(`[HeatmapRenderer] Rendering ${data.records.length} records as heat map visualization`);
    
    // Detect heat map intensity field
    const intensityField = this.detectIntensityField(data, config);
    if (!intensityField) {
      console.warn('[HeatmapRenderer] No suitable intensity field found for heat map');
      return this.createFallbackVisualization(data, config);
    }
    
    console.log(`[HeatmapRenderer] Using intensity field: ${intensityField}`);
    
    // Validate data has point coordinates for heat mapping
    if (!this.validatePointData(data)) {
      console.warn('[HeatmapRenderer] Data not suitable for heat map (requires point coordinates)');
      return this.createFallbackVisualization(data, config);
    }
    
    // Create heat map renderer configuration
    const renderer = this.createHeatmapRenderer(data, intensityField, config);
    
    // Create heat map legend
    const legend = this.createHeatmapLegend(data, intensityField);
    
    // Create specialized popup template for heat map
    const popupTemplate = this.createHeatmapPopupTemplate(data, config, intensityField);
    
    return {
      type: 'heatmap' as any,
      config: config,
      success: true,
      renderer,
      legend,
      popupTemplate,
      visualizationType: 'heatmap',
      metadata: {
        intensityField,
        heatmapType: this.getHeatmapType(intensityField),
        pointCount: data.records.length,
        enhancedFeatures: ['density_analysis', 'intensity_gradient', 'spatial_clustering']
      }
    };
  }
  
  /**
   * Detect the most suitable field for heat map intensity
   */
  private detectIntensityField(data: ProcessedAnalysisData, config: VisualizationConfig): string | null {
    // Check for explicit intensity field in config
    if (config.intensityField && typeof config.intensityField === 'string') {
      return config.intensityField;
    }
    
    if (data.records.length === 0) {
      return null;
    }
    
    const firstRecord = data.records[0];
    const properties = firstRecord.properties;
    
    // Priority order for heat map intensity fields
    const intensityFieldCandidates = [
      'rental_demand',              // Rental demand intensity
      'market_activity',            // Market activity density
      'transaction_volume',         // Transaction volume density
      'property_density',           // Property density
      'market_velocity',            // Market velocity for activity heat
      'foot_traffic',               // Foot traffic density
      'population_density',         // Population density
      'business_density',           // Business density
      'risk_level',                 // Risk concentration
      'investment_activity',        // Investment activity density
      'development_activity',       // Development activity
      'liquidity_index',            // Market liquidity density
      'demand_index',               // General demand index
      'activity_score',             // Activity scoring
      'intensity',                  // Generic intensity field
      'density',                    // Generic density field
      'volume',                     // Generic volume field
      'value'                       // Fallback to primary value
    ];
    
    // Find first matching field with suitable numeric values
    for (const field of intensityFieldCandidates) {
      if (field in properties) {
        const value = properties[field];
        if (typeof value === 'number' && value >= 0) {
          // Verify this field has good distribution across records
          const values = data.records.map(r => Number(r.properties[field]) || 0);
          const maxValue = Math.max(...values);
          const minValue = Math.min(...values);
          const range = maxValue - minValue;
          
          if (range > 0 && maxValue > 0) { // Good distribution for heat mapping
            console.log(`[HeatmapRenderer] Selected intensity field: ${field} (range: ${minValue.toFixed(1)} - ${maxValue.toFixed(1)})`);
            return field;
          }
        }
      }
    }
    
    return null;
  }
  
  /**
   * Validate that data is suitable for heat map rendering (requires point coordinates)
   */
  private validatePointData(data: ProcessedAnalysisData): boolean {
    if (data.records.length === 0) {
      return false;
    }
    
    // Check if records have coordinate information
    let pointCount = 0;
    for (const record of data.records) {
      if (record.coordinates && Array.isArray(record.coordinates) && record.coordinates.length >= 2) {
        const [lng, lat] = record.coordinates;
        if (typeof lng === 'number' && typeof lat === 'number' && lng !== 0 && lat !== 0) {
          pointCount++;
        }
      }
    }
    
    const pointRatio = pointCount / data.records.length;
    console.log(`[HeatmapRenderer] Point validation: ${pointCount}/${data.records.length} records (${(pointRatio * 100).toFixed(1)}%) have valid coordinates`);
    
    return pointRatio >= 0.5; // At least 50% of records must have valid coordinates
  }
  
  /**
   * Create ArcGIS heat map renderer
   */
  private createHeatmapRenderer(data: ProcessedAnalysisData, intensityField: string, config: VisualizationConfig): any {
    // Calculate intensity statistics
    const intensityValues = data.records.map(r => Number(r.properties[intensityField]) || 0);
    const maxIntensity = Math.max(...intensityValues);
    const minIntensity = Math.min(...intensityValues);
    
    console.log(`[HeatmapRenderer] Intensity range: ${minIntensity.toFixed(2)} - ${maxIntensity.toFixed(2)}`);
    
    // Create heat map color scheme
    const colorStops = this.createHeatmapColorStops(minIntensity, maxIntensity);
    
    return {
      type: 'heatmap',
      field: intensityField,
      colorStops,
      minPixelIntensity: 0,
      maxPixelIntensity: 255,
      radius: this.calculateOptimalRadius(data),
      blur: this.calculateOptimalBlur(data),
      // Heat map specific properties
      heatmapConfig: {
        gradient: [
          'rgba(0, 0, 255, 0)',      // Transparent blue (no data)
          'rgba(0, 0, 255, 0.6)',    // Blue (low intensity)
          'rgba(0, 255, 255, 0.8)',  // Cyan (medium-low)
          'rgba(0, 255, 0, 0.9)',    // Green (medium)
          'rgba(255, 255, 0, 0.95)', // Yellow (medium-high)
          'rgba(255, 165, 0, 1.0)',  // Orange (high)
          'rgba(255, 0, 0, 1.0)'     // Red (very high intensity)
        ],
        intensityField,
        minIntensity,
        maxIntensity
      }
    };
  }
  
  /**
   * Create color stops for heat map gradient
   */
  private createHeatmapColorStops(minIntensity: number, maxIntensity: number): any[] {
    const range = maxIntensity - minIntensity;
    
    return [
      { ratio: 0.0, color: 'rgba(0, 0, 255, 0)' },       // Transparent (no data)
      { ratio: 0.1, color: 'rgba(0, 0, 255, 0.6)' },     // Blue (low)
      { ratio: 0.3, color: 'rgba(0, 255, 255, 0.7)' },   // Cyan (medium-low)
      { ratio: 0.5, color: 'rgba(0, 255, 0, 0.8)' },     // Green (medium)
      { ratio: 0.7, color: 'rgba(255, 255, 0, 0.9)' },   // Yellow (medium-high)
      { ratio: 0.9, color: 'rgba(255, 165, 0, 1.0)' },   // Orange (high)
      { ratio: 1.0, color: 'rgba(255, 0, 0, 1.0)' }      // Red (maximum)
    ];
  }
  
  /**
   * Calculate optimal radius for heat map based on data density
   */
  private calculateOptimalRadius(data: ProcessedAnalysisData): number {
    const recordCount = data.records.length;
    
    // Base radius on data density
    if (recordCount < 10) return 30;      // Small datasets - larger radius
    if (recordCount < 50) return 25;      // Medium datasets
    if (recordCount < 200) return 20;     // Large datasets
    if (recordCount < 1000) return 15;    // Very large datasets
    return 10;                            // Massive datasets - smaller radius
  }
  
  /**
   * Calculate optimal blur for heat map based on data characteristics
   */
  private calculateOptimalBlur(data: ProcessedAnalysisData): number {
    const recordCount = data.records.length;
    
    // Base blur on data density for smooth gradients
    if (recordCount < 25) return 20;      // Small datasets - more blur
    if (recordCount < 100) return 15;     // Medium datasets
    if (recordCount < 500) return 12;     // Large datasets
    return 10;                            // Very large datasets - less blur
  }
  
  /**
   * Create legend for heat map visualization
   */
  private createHeatmapLegend(data: ProcessedAnalysisData, intensityField: string): any {
    const intensityValues = data.records.map(r => Number(r.properties[intensityField]) || 0);
    const maxIntensity = Math.max(...intensityValues);
    const minIntensity = Math.min(...intensityValues);
    
    const legendItems = [
      {
        label: `High ${this.formatFieldTitle(intensityField)}`,
        color: 'rgba(255, 0, 0, 1.0)',
        value: maxIntensity,
        symbol: 'gradient-high'
      },
      {
        label: `Medium ${this.formatFieldTitle(intensityField)}`,
        color: 'rgba(255, 255, 0, 0.9)',
        value: (maxIntensity + minIntensity) / 2,
        symbol: 'gradient-medium'
      },
      {
        label: `Low ${this.formatFieldTitle(intensityField)}`,
        color: 'rgba(0, 0, 255, 0.6)',
        value: minIntensity,
        symbol: 'gradient-low'
      }
    ];
    
    return {
      title: `${this.formatFieldTitle(intensityField)} Density`,
      items: legendItems,
      position: 'bottom-right',
      type: 'heatmap-gradient'
    };
  }
  
  /**
   * Create popup template optimized for heat map data
   */
  private createHeatmapPopupTemplate(data: ProcessedAnalysisData, config: VisualizationConfig, intensityField: string): any {
    const content: any[] = [
      {
        type: 'text',
        text: '<h3>{' + (config.labelField || 'area_name') + '}</h3>'
      },
      {
        type: 'text',
        text: `<p><strong>${this.formatFieldTitle(intensityField)}:</strong> {${intensityField}}</p>`
      }
    ];
    
    // Add density category
    content.push({
      type: 'text',
      text: `<p><strong>Density Category:</strong> {density_category}</p>`
    });
    
    // Add additional relevant fields
    const relevantFields = this.getHeatmapRelevantFields(data, intensityField);
    if (relevantFields.length > 0) {
      content.push({
        type: 'fields',
        fieldInfos: relevantFields.map(field => ({
          fieldName: field,
          label: this.formatFieldTitle(field)
        }))
      });
    }
    
    return {
      title: '{' + (config.labelField || 'area_name') + '}',
      content
    };
  }
  
  /**
   * Get relevant fields to display in heat map popups
   */
  private getHeatmapRelevantFields(data: ProcessedAnalysisData, intensityField: string): string[] {
    if (data.records.length === 0) return [];
    
    const properties = data.records[0].properties;
    const relevantFields: string[] = [];
    
    // Add complementary fields based on intensity field type
    const complementaryFields: Record<string, string[]> = {
      rental_demand: ['rental_yield', 'vacancy_rate', 'rent_growth'],
      market_activity: ['transaction_volume', 'market_velocity', 'liquidity_index'],
      property_density: ['avg_property_value', 'property_type_mix'],
      risk_level: ['risk_factors', 'mitigation_score']
    };
    
    const complementary = complementaryFields[intensityField] || [];
    for (const field of complementary) {
      if (field in properties) {
        relevantFields.push(field);
      }
    }
    
    // Add primary value if available and different from intensity field
    if ('value' in properties && intensityField !== 'value') {
      relevantFields.push('value');
    }
    
    return relevantFields.slice(0, 4); // Limit to 4 additional fields
  }
  
  /**
   * Get heat map type based on intensity field
   */
  private getHeatmapType(intensityField: string): string {
    const heatmapTypes: Record<string, string> = {
      rental_demand: 'rental_demand_density',
      market_activity: 'market_activity_density',
      transaction_volume: 'transaction_density',
      property_density: 'property_concentration',
      risk_level: 'risk_concentration',
      population_density: 'demographic_density',
      foot_traffic: 'activity_density'
    };
    
    return heatmapTypes[intensityField] || 'general_density';
  }
  
  /**
   * Create fallback visualization when heat map is not suitable
   */
  private createFallbackVisualization(data: ProcessedAnalysisData, config: EnhancedVisualizationConfig): VisualizationResult {
    return {
      type: 'choropleth' as any,
      config: config,
      renderer: null,
      popupTemplate: null,
      legend: { title: 'No Data', items: [], position: 'bottom-right' },
      success: false,
      error: 'Data not suitable for heat map visualization',
      fallback: 'choropleth',
      metadata: {
        reason: 'missing_intensity_field_or_coordinates',
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