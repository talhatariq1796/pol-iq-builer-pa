import { 
  AnalysisContext, 
  ProjectType, 
  FieldMappings, 
  Terminology, 
  ScoreRange,
  ScoreRanges,
  SummaryTemplates,
  ProcessorConfig
} from '../../config/analysis-contexts/base-context';
import { 
  getAnalysisContext, 
  isProjectTypeSupported, 
  getAvailableProjectTypes,
  RETAIL_CONTEXT 
} from '../../config/analysis-contexts';

/**
 * Singleton manager for analysis configuration
 * Provides centralized access to project-specific configurations
 */
export class AnalysisConfigurationManager {
  private static instance: AnalysisConfigurationManager | null = null;
  private currentContext: AnalysisContext;
  private currentProjectType: string;

  private constructor() {
    // Default to retail for backward compatibility
    this.currentProjectType = 'retail';
    this.currentContext = RETAIL_CONTEXT;
    
    console.log('[AnalysisConfigurationManager] Initialized with default project type: retail');
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): AnalysisConfigurationManager {
    if (!AnalysisConfigurationManager.instance) {
      AnalysisConfigurationManager.instance = new AnalysisConfigurationManager();
    }
    return AnalysisConfigurationManager.instance;
  }

  /**
   * Set the current project type and load its configuration
   */
  public setProjectType(projectType: string): void {
    if (!isProjectTypeSupported(projectType)) {
      console.warn(`[AnalysisConfigurationManager] Unsupported project type: ${projectType}`);
      console.log(`[AnalysisConfigurationManager] Available types: ${getAvailableProjectTypes().join(', ')}`);
      return;
    }

    this.currentProjectType = projectType;
    this.currentContext = getAnalysisContext(projectType);
    
    console.log(`[AnalysisConfigurationManager] Switched to project type: ${projectType}`);
    console.log(`[AnalysisConfigurationManager] Domain: ${this.currentContext.domain}`);
  }

  /**
   * Get the current analysis context
   */
  public getCurrentContext(): AnalysisContext {
    return this.currentContext;
  }

  /**
   * Get the current project type
   */
  public getCurrentProjectType(): string {
    return this.currentProjectType;
  }

  /**
   * Get field mappings for data extraction
   */
  public getFieldMappings(): FieldMappings {
    return this.currentContext.fieldMappings;
  }

  /**
   * Get specific field mapping category
   */
  public getFieldMapping(category: keyof FieldMappings): string[] {
    return this.currentContext.fieldMappings[category] || [];
  }

  /**
   * Get terminology configuration
   */
  public getTerminology(): Terminology {
    return this.currentContext.terminology;
  }

  /**
   * Get score interpretation for a given score
   */
  public getScoreInterpretation(score: number): ScoreRange {
    const ranges = this.currentContext.scoreRanges;
    
    if (score >= ranges.excellent.min) return ranges.excellent;
    if (score >= ranges.good.min) return ranges.good;
    if (score >= ranges.moderate.min) return ranges.moderate;
    return ranges.poor;
  }

  /**
   * Get all score ranges
   */
  public getScoreRanges(): ScoreRanges {
    return this.currentContext.scoreRanges;
  }

  /**
   * Get summary templates
   */
  public getSummaryTemplates(): SummaryTemplates {
    return this.currentContext.summaryTemplates;
  }

  /**
   * Get processor-specific configuration
   */
  public getProcessorConfig(): ProcessorConfig {
    return this.currentContext.processorConfig;
  }

  /**
   * Get configuration for a specific processor
   */
  public getProcessorSpecificConfig<T>(processorType: keyof ProcessorConfig): T | undefined {
    return this.currentContext.processorConfig[processorType] as T;
  }

  /**
   * Extract primary metric from a record using configured field mappings
   */
  public extractPrimaryMetric(record: any): number {
    const primaryFields = this.getFieldMapping('primaryMetric');

    // Try configured primary fields first
    for (const field of primaryFields) {
      if (record[field] !== undefined && record[field] !== null) {
        const value = Number(record[field]);
        if (!isNaN(value)) {
          return value;
        }
      }
    }

    // Conservative fallbacks for common legacy or analysis-specific fields
    // - Accept 'strategic_analysis_score' which appears in some payloads
    // - Accept any field that looks like a value_* numeric field (e.g., value_TOTPOP_CY)
    if (record['strategic_analysis_score'] !== undefined && record['strategic_analysis_score'] !== null) {
      const v = Number(record['strategic_analysis_score']);
      if (!isNaN(v)) return v;
    }

    for (const key of Object.keys(record)) {
      if (/^value_/i.test(key)) {
        const v = Number(record[key]);
        if (!isNaN(v)) return v;
      }
    }

    console.warn('[AnalysisConfigurationManager] No primary metric found in record', {
      availableFields: Object.keys(record),
      expectedFields: primaryFields
    });

    return 0; // Fallback
  }

  /**
   * Extract geographic ID from a record using configured field mappings
   */
  public extractGeographicId(record: any): string {
    const geoFields = this.getFieldMapping('geographicId');
    
    for (const field of geoFields) {
      if (record[field] !== undefined && record[field] !== null) {
        return String(record[field]);
      }
    }
    
    return 'unknown';
  }

  /**
   * Extract descriptive name from a record using configured field mappings
   */
  public extractDescriptiveName(record: any): string {
    const descriptiveFields = this.getFieldMapping('descriptiveFields');
    
    for (const field of descriptiveFields) {
      if (record[field] !== undefined && record[field] !== null) {
        const value = String(record[field]);
        if (value.trim() && !value.toLowerCase().includes('unknown')) {
          return value;
        }
      }
    }
    
    // Fallback to geographic ID
    return this.extractGeographicId(record);
  }

  /**
   * Apply template substitutions to a string
   */
  public applyTemplate(template: string, substitutions: Record<string, any>): string {
    let result = template;
    
    // Apply terminology substitutions
    const terminology = this.getTerminology();
    result = result.replace(/\{metricName\}/g, terminology.metricName);
    result = result.replace(/\{entityType\}/g, terminology.entityType);
    result = result.replace(/\{scoreDescription\}/g, terminology.scoreDescription);
    result = result.replace(/\{comparisonContext\}/g, terminology.comparisonContext);
    
    // Apply custom substitutions
    Object.entries(substitutions).forEach(([key, value]) => {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      result = result.replace(regex, String(value));
    });
    
    return result;
  }

  /**
   * Reset to default configuration
   */
  public reset(): void {
    this.setProjectType('retail');
  }

  // ============================================================================
  // MULTI-TARGET ANALYSIS CONFIGURATION
  // ============================================================================

  /**
   * Get multi-target configuration for the current project type
   */
  public getMultiTargetConfig(): MultiTargetConfig {
    // Return real estate specific config for real estate projects, default for others
    if (this.currentProjectType === 'real_estate') {
      return this.getRealEstateMultiTargetConfig();
    }
    
    return {
      enabled: false,
      defaultTargets: ['value'],
      targetMappings: {
        value: { fields: ['value'], type: 'custom' }
      },
      correlationAnalysis: { enabled: false },
      visualizationStrategy: 'single'
    };
  }

  /**
   * Get real estate specific multi-target configuration
   */
  private getRealEstateMultiTargetConfig(): MultiTargetConfig {
    return {
      enabled: true,
      defaultTargets: ['time_on_market', 'avg_sold_price', 'avg_rent_price', 'price_delta'],
      targetMappings: {
        time_on_market: {
          fields: ['time_on_market', 'days_on_market', 'dom', 'time_to_sale'],
          type: 'time_on_market'
        },
        avg_sold_price: {
          fields: ['avg_sold_price', 'average_sold_price', 'mean_sold_price', 'sold_price_avg'],
          type: 'avg_sold_price'
        },
        avg_rent_price: {
          fields: ['avg_rent_price', 'average_rent_price', 'mean_rent_price', 'rent_price_avg'],
          type: 'avg_rent_price'
        },
        price_delta: {
          fields: ['price_delta', 'asking_sold_delta', 'price_difference', 'sale_price_variance'],
          type: 'price_delta'
        },
        market_velocity: {
          fields: ['market_velocity', 'turnover_rate', 'sales_velocity', 'market_activity'],
          type: 'market_velocity'
        },
        appreciation_rate: {
          fields: ['appreciation_rate', 'value_growth', 'price_appreciation', 'growth_rate'],
          type: 'appreciation_rate'
        }
      },
      correlationAnalysis: {
        enabled: true,
        minimumCorrelation: 0.3,
        significanceLevel: 0.05
      },
      visualizationStrategy: 'multi_target'
    };
  }

  /**
   * Extract multiple target variables from a record
   */
  public extractMultiTargetValues(record: any, targetVariables: string[]): Record<string, number> {
    const config = this.getMultiTargetConfig();
    const values: Record<string, number> = {};

    targetVariables.forEach(target => {
      const mapping = config.targetMappings[target];
      if (mapping) {
        for (const field of mapping.fields) {
          if (record[field] !== undefined && record[field] !== null) {
            const value = Number(record[field]);
            if (!isNaN(value)) {
              values[target] = value;
              break; // Use first valid field found
            }
          }
        }
      }
    });

    return values;
  }

  /**
   * Get target variable type mapping
   */
  public getTargetVariableType(targetVariable: string): TargetVariableType {
    const config = this.getMultiTargetConfig();
    const mapping = config.targetMappings[targetVariable];
    
    if (mapping && mapping.type !== 'custom') {
      return mapping.type as TargetVariableType;
    }

    // Fallback to pattern matching
    const varLower = targetVariable.toLowerCase();
    if (varLower.includes('time') && varLower.includes('market')) return 'time_on_market';
    if (varLower.includes('sold') && varLower.includes('price')) return 'avg_sold_price';
    if (varLower.includes('rent') && varLower.includes('price')) return 'avg_rent_price';
    if (varLower.includes('price') && varLower.includes('delta')) return 'price_delta';
    if (varLower.includes('velocity') || varLower.includes('activity')) return 'market_velocity';
    if (varLower.includes('appreciation')) return 'appreciation_rate';
    if (varLower.includes('inventory')) return 'inventory_levels';
    
    return 'custom';
  }

  /**
   * Check if multi-target analysis is enabled for current project
   */
  public isMultiTargetEnabled(): boolean {
    return this.getMultiTargetConfig().enabled;
  }

  /**
   * Get default target variables for current project
   */
  public getDefaultTargetVariables(): string[] {
    return this.getMultiTargetConfig().defaultTargets;
  }

  /**
   * Get field mappings for a specific target variable
   */
  public getTargetVariableFields(targetVariable: string): string[] {
    const config = this.getMultiTargetConfig();
    const mapping = config.targetMappings[targetVariable];
    return mapping ? mapping.fields : [targetVariable];
  }

  /**
   * Generate multi-target analysis summary using templates
   */
  public buildMultiTargetSummary(
    targets: TargetVariableAnalysis[],
    primaryTarget: string,
    correlations: TargetCorrelationMatrix,
    customSubstitutions: Record<string, any> = {}
  ): string {
    const templates = this.getSummaryTemplates();
    const terminology = this.getTerminology();
    
    // Multi-target specific substitutions
    const baseSubstitutions = {
      targetCount: targets.length,
      primaryTarget: primaryTarget,
      strongCorrelations: correlations.correlations.filter(c => c.strength === 'strong').length,
      weakCorrelations: correlations.correlations.filter(c => c.strength === 'weak').length,
      ...customSubstitutions
    };

    // Build multi-target summary
    let summary = `## Multi-Target Real Estate Analysis\n\n`;
    
    summary += `This analysis examines **${targets.length} target variables** with focus on **${primaryTarget}**.\n\n`;
    
    // Target variable overview
    summary += `### Target Variables Analyzed:\n`;
    targets.forEach(target => {
      const r2Score = target.modelInfo?.r2 || target.modelInfo?.r2_score || 0;
      summary += `• **${target.variable}**: R² = ${r2Score.toFixed(3)} (${target.type})\n`;
    });
    summary += '\n';

    // Correlation insights
    if (correlations.correlations.length > 0) {
      summary += `### Cross-Target Correlations:\n`;
      const strongCorrs = correlations.correlations.filter(c => c.strength === 'strong');
      if (strongCorrs.length > 0) {
        strongCorrs.slice(0, 3).forEach(corr => {
          summary += `• **Strong correlation** between ${corr.target1} and ${corr.target2} (${corr.coefficient.toFixed(3)})\n`;
        });
      } else {
        summary += `• No strong correlations detected between target variables\n`;
      }
      summary += '\n';
    }

    // Performance ranking
    const sortedByPerformance = targets.sort((a, b) => {
      const aR2 = a.modelInfo?.r2 || a.modelInfo?.r2_score || 0;
      const bR2 = b.modelInfo?.r2 || b.modelInfo?.r2_score || 0;
      return bR2 - aR2;
    });

    summary += `### Model Performance Ranking:\n`;
    sortedByPerformance.forEach((target, index) => {
      const r2Score = target.modelInfo?.r2 || target.modelInfo?.r2_score || 0;
      const performance = r2Score > 0.7 ? 'Excellent' : r2Score > 0.5 ? 'Good' : r2Score > 0.3 ? 'Moderate' : 'Poor';
      summary += `${index + 1}. **${target.variable}**: ${performance} (R² = ${r2Score.toFixed(3)})\n`;
    });

    return summary;
  }

  /**
   * Get debug information about current configuration
   */
  public getDebugInfo(): any {
    const multiTargetConfig = this.getMultiTargetConfig();
    
    return {
      projectType: this.currentProjectType,
      domain: this.currentContext.domain,
      terminology: this.currentContext.terminology,
      primaryMetricFields: this.getFieldMapping('primaryMetric'),
      availableProcessors: Object.keys(this.currentContext.processorConfig),
      scoreRangeCount: Object.keys(this.currentContext.scoreRanges).length,
      multiTargetEnabled: multiTargetConfig.enabled,
      defaultTargets: multiTargetConfig.defaultTargets,
      targetMappingsCount: Object.keys(multiTargetConfig.targetMappings).length
    };
  }
}

// ============================================================================
// MULTI-TARGET CONFIGURATION INTERFACES
// ============================================================================

interface MultiTargetConfig {
  enabled: boolean;
  defaultTargets: string[];
  targetMappings: Record<string, TargetMapping>;
  correlationAnalysis: {
    enabled: boolean;
    minimumCorrelation?: number;
    significanceLevel?: number;
  };
  visualizationStrategy: 'single' | 'multi_target' | 'comparison';
}

interface TargetMapping {
  fields: string[];
  type: string;
}

// Import types for multi-target support
type TargetVariableType = 
  | 'time_on_market'
  | 'avg_sold_price'
  | 'avg_rent_price'
  | 'price_delta'
  | 'market_velocity'
  | 'appreciation_rate'
  | 'inventory_levels'
  | 'custom';

interface TargetVariableAnalysis {
  variable: string;
  type: TargetVariableType;
  statistics: any;
  featureImportance?: any[];
  modelInfo?: {
    target_variable: string;
    feature_count: number;
    accuracy?: number;
    r2?: number;
    r2_score?: number;
    rmse?: number;
    mae?: number;
    model_type?: string;
  };
  predictions?: Record<string, number>;
  confidence?: Record<string, number>;
}

interface TargetCorrelationMatrix {
  correlations: Array<{
    target1: string;
    target2: string;
    coefficient: number;
    significance: number;
    strength: 'weak' | 'moderate' | 'strong';
  }>;
  heatmapData?: number[][];
  labels: string[];
}