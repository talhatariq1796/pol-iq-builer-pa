/**
 * EnhancedQueryAnalyzer - Template-based natural language query processing
 * 
 * Features:
 * - Template-driven configuration for different projects
 * - Minimal core field mappings with project-specific extensions
 * - Automated configuration generation from migration templates
 * - Clean separation between core and project-specific logic
 * - Integration with migration automation system
 */

import { FieldMappingConfig, FieldMapping, EndpointConfig } from '../migration/templates/FieldMappingTemplate';

interface EndpointScore {
  endpoint: string;
  score: number;
  reasons: string[];
}

interface TemplateInfo {
  templateName: string;
  projectName: string;
  generatedAt: string;
  version: string;
}

export class EnhancedQueryAnalyzer {
  private readonly fieldMappings: Record<string, FieldMapping>;
  private readonly endpointConfigs: Record<string, EndpointConfig>;
  private readonly templateInfo: TemplateInfo;

  constructor(config?: FieldMappingConfig) {
    if (config) {
      this.fieldMappings = config.fieldMappings;
      this.endpointConfigs = config.endpointConfigs;
      this.templateInfo = config.templateInfo;
    } else {
      // Use default minimal configuration
      this.fieldMappings = this.getDefaultMappings();
      this.endpointConfigs = this.getDefaultEndpointConfigs();
      this.templateInfo = {
        templateName: 'default',
        projectName: 'default',
        generatedAt: new Date().toISOString(),
        version: '1.0.0'
      };
    }
  }

  /**
   * Get default minimal field mappings - only essential, reusable fields
   */
  private getDefaultMappings(): Record<string, FieldMapping> {
    return {
      // Core Demographics - Essential fields for any project
      population: {
        keywords: ['population', 'people', 'total population'],
        fields: ['TOTPOP_CY'],
        description: 'Total population',
        category: 'demographic',
        priority: 'high'
      },
      income: {
        keywords: ['income', 'earnings', 'salary', 'wealth', 'median income'],
        fields: ['MEDHINC_CY'],
        description: 'Median household income',
        category: 'economic',
        priority: 'high'
      },
      age: {
        keywords: ['age', 'young', 'old', 'elderly', 'senior'],
        fields: ['AGE_MEDIAN'],
        description: 'Age demographics',
        category: 'demographic',
        priority: 'medium'
      },
      
      // Geographic - Essential for location queries
      zipDescription: {
        keywords: ['zip description', 'area description', 'location description'],
        fields: ['DESCRIPTION'],
        description: 'ZIP code area description',
        category: 'geographic',
        priority: 'medium'
      },
      
      // Administrative
      recordId: {
        keywords: ['record id', 'identifier', 'unique id'],
        fields: ['ID'],
        description: 'Record identifier',
        category: 'core',
        priority: 'low'
      }
    };
  }

  /**
   * Get default endpoint configurations - minimal set for core functionality
   */
  private getDefaultEndpointConfigs(): Record<string, EndpointConfig> {
    return {
      '/strategic-analysis': {
        primaryKeywords: ['strategic', 'strategy', 'expansion', 'opportunity', 'potential', 'quickly', 'velocity', 'liquidity', 'saturated', 'inventory', 'risks', 'rental rates', 'good time', 'seller'],
        contextKeywords: ['market opportunity', 'strategic value', 'best markets', 'development potential', 'sell in this area', 'liquidity indicators', 'market velocity', 'saturation', 'enough inventory', 'market risks', 'good time to buy', 'buyer or seller', 'seller market', 'rental rates like'],
        avoidTerms: ['growth potential', 'appreciation', 'timing indicators'],
        weight: 1.0
      },
      '/brand-difference': {
        primaryKeywords: ['difference', 'vs', 'versus', 'compare', 'market share'],
        contextKeywords: ['brand difference', 'brand gap', 'percent difference', 'market share difference'],
        avoidTerms: ['correlation'],
        weight: 1.25
      },
      '/competitive-analysis': {
        primaryKeywords: ['competitive', 'competition', 'advantage', 'competitor', 'market performance', 'performing', 'conditions', 'balanced', 'supply', 'demand', 'rental', 'perform'],
        contextKeywords: ['competitive positioning', 'market position', 'brand positioning', 'market activity', 'performance metrics', 'market conditions', 'supply and demand', 'rental market', 'current market', 'perform for rentals'],
        avoidTerms: ['market positioning relative'],
        weight: 1.2
      },
      '/market-trend-analysis': {
        primaryKeywords: ['trend', 'trends', 'price trend', 'price trends', 'market trend', 'market trends', 'momentum', 'forecast', 'forecasts', 'prediction', 'predicted', 'stability', 'stable', 'volatile', 'volatility', 'appreciation', 'vary', 'variation', 'likely', 'appreciate'],
        contextKeywords: ['price change', 'appreciation trend', 'market direction', 'market cycle', 'timing indicators', 'sensitivity', 'price variation', 'heading', 'value changes', 'gentrification', 'change indicators', 'prices vary', 'likely to appreciate', 'appreciate in value'],
        avoidTerms: [],
        weight: 1.45
      },
      '/demographic-insights': {
        primaryKeywords: ['demographic', 'demographics', 'population', 'age', 'income', 'unique', 'characteristics', 'livability'],
        contextKeywords: ['customer demographics', 'demographic opportunity', 'quality of life', 'key characteristics', 'residents'],
        avoidTerms: ['customer personas'],
        weight: 1.2
      },
      '/comparative-analysis': {
        primaryKeywords: ['compare', 'comparison', 'between', 'cities', 'regions', 'similar', 'rank', 'livability'],
        contextKeywords: ['compare performance', 'city comparison', 'market positioning', 'similar markets', 'rank among', 'nearby neighborhoods', 'relative to', 'rank for livability'],
        avoidTerms: ['correlation'],
        weight: 1.15
      },
      '/correlation-analysis': {
        primaryKeywords: ['correlation', 'correlate', 'relationship', 'factors predict'],
        contextKeywords: ['demographic factors', 'economic factors'],
        avoidTerms: [],
        weight: 1.0
      },
      '/analyze': {
        primaryKeywords: ['analyze', 'analysis', 'overview', 'insights'],
        contextKeywords: ['comprehensive analysis', 'market insights'],
  avoidTerms: ['strategic'],
        weight: 1.3
      },
      '/customer-profile': {
        primaryKeywords: ['buyer', 'buyers', 'customer', 'persona', 'audience', 'desirable'],
        contextKeywords: ['buyer activity', 'buyer types', 'customer profile', 'buyer mix', 'desirable to buyers', 'types of buyers'],
        avoidTerms: ['seller', 'market conditions'],
        weight: 1.3
      }
    };
  }

  /**
   * Analyze query and return the best endpoint with detailed reasoning
   */
  public analyzeQuery(query: string): EndpointScore[] {
    const lowerQuery = query.toLowerCase();
    const scores: EndpointScore[] = [];

    // First, identify what fields/concepts are mentioned
    const mentionedFields = this.identifyMentionedFields(lowerQuery);
    const queryIntent = this.identifyQueryIntent(lowerQuery);

    // Score each endpoint
    for (const [endpoint, config] of Object.entries(this.endpointConfigs)) {
      let score = 0;
      const reasons: string[] = [];

      // Check primary keywords
      const primaryMatches = config.primaryKeywords.filter(kw => 
        this.smartMatch(lowerQuery, kw)
      );
      if (primaryMatches.length > 0) {
        score += primaryMatches.length * 3 * config.weight;
        reasons.push(`Primary keywords: ${primaryMatches.join(', ')}`);
      }

      // Check context keywords
      const contextMatches = config.contextKeywords.filter(kw => 
        lowerQuery.includes(kw)
      );
      if (contextMatches.length > 0) {
        score += contextMatches.length * 2 * config.weight;
        reasons.push(`Context matches: ${contextMatches.join(', ')}`);
      }

      // Penalty for avoid terms
      const avoidMatches = config.avoidTerms.filter(term => 
        lowerQuery.includes(term)
      );
      if (avoidMatches.length > 0) {
        score -= avoidMatches.length * 2;
        reasons.push(`Avoid terms present: ${avoidMatches.join(', ')}`);
      }

      // Special handling based on query intent
      score += this.applyIntentBonus(endpoint, queryIntent, reasons);

      // Field-specific bonuses
      score += this.applyFieldBonus(endpoint, mentionedFields, reasons);

      scores.push({ endpoint, score, reasons });
    }

    // Sort by score descending
    return scores.sort((a, b) => b.score - a.score);
  }

  /**
   * Get the best endpoint for a query
   */
  public getBestEndpoint(query: string): string {
  const scores = this.analyzeQuery(query);
    
    // Default to strategic-analysis if no good match
    if (scores.length === 0 || scores[0].score <= 0) {
      return '/strategic-analysis';
    }

    // Prefer more specific endpoints when tied to generic comparison words and brand terms
    const top = scores[0];
    const q = query.toLowerCase();
    if (/(vs|versus|difference|market share)/i.test(q)) {
      // steer to brand-difference when comparing brands
      const mentionsBrands = /(h&r\s*block|turbotax|nike|adidas|red bull|monster)/i.test(q);
      if (mentionsBrands) {
        const bd = scores.find(s => s.endpoint === '/brand-difference');
        if (bd && bd.score >= top.score - 1) return '/brand-difference';
      }
    }
    // If the query is just "strategic analysis" or similar, force strategic endpoint
    if (/^\s*(strategic\s+analysis|strategic)\s*$/i.test(q)) {
      return '/strategic-analysis';
    }
    return top.endpoint;
  }

  /**
   * Identify mentioned fields in the query
   */
  private identifyMentionedFields(query: string): string[] {
    const mentioned: string[] = [];

    for (const [key, mapping] of Object.entries(this.fieldMappings)) {
      if (mapping.keywords.some(kw => query.includes(kw))) {
        mentioned.push(key);
      }
    }

    return mentioned;
  }

  /**
   * Identify the primary intent of the query
   */
  private identifyQueryIntent(query: string): string {
    // Check for relationship questions first (more specific)
    if (query.includes('relationship') || 
        (query.includes('relate') && !query.includes('unrelated')) ||
        query.includes('influence') ||
        query.includes('affect') ||
        query.includes('factor')) {
      return 'relationship';
    }

    const intents = {
      comparison: ['compare', 'versus', 'vs', 'difference'],
      ranking: ['top', 'best', 'highest', 'lowest', 'rank'],
      location: ['where', 'which areas', 'which markets', 'which cities'],
      analysis: ['analyze', 'show', 'what', 'how'],
      demographic: ['who', 'demographic', 'population', 'age', 'income']
    };

    // Special handling for 'between' - only comparison if it's city vs city
    if (query.includes('between')) {
      // Check if it's comparing specific locations/cities
      const locationPatterns = [
        /between\s+[A-Z][a-z]+\s+and\s+[A-Z][a-z]+/, // "between Boston and NYC"
        /between\s+\w+\s+vs?\s+\w+/  // "between NYC vs Boston"
      ];
      
      if (locationPatterns.some(pattern => pattern.test(query))) {
        return 'comparison';
      } else {
        // "between demographics and preference" = relationship
        return 'relationship';
      }
    }

    for (const [intent, keywords] of Object.entries(intents)) {
      if (keywords.some(kw => query.includes(kw))) {
        return intent;
      }
    }

    return 'analysis';
  }

  /**
   * Smart keyword matching with word boundaries
   */
  private smartMatch(query: string, keyword: string): boolean {
    // Create word boundary regex for better matching
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    return regex.test(query);
  }

  /**
   * Apply bonus based on query intent
   */
  private applyIntentBonus(endpoint: string, intent: string, reasons: string[]): number {
    const intentBonuses: Record<string, Record<string, number>> = {
      comparison: {
        '/comparative-analysis': 3,
        '/strategic-analysis': 1
      },
      ranking: {
        '/strategic-analysis': 3,
        '/demographic-insights': 2
      },
      demographic: {
        '/demographic-insights': 3
      },
      relationship: {
        '/correlation-analysis': 3,
        '/demographic-insights': 2
      }
    };

    const bonus = intentBonuses[intent]?.[endpoint] || 0;
    if (bonus > 0) {
      reasons.push(`Intent bonus: ${intent} (+${bonus})`);
    }

    return bonus;
  }

  /**
   * Apply bonus based on mentioned fields
   */
  private applyFieldBonus(endpoint: string, fields: string[], reasons: string[]): number {
    let bonus = 0;

    // Demographic bonuses
    const demographicFields = ['population', 'age', 'income'];
    const hasDemographics = fields.some(f => demographicFields.includes(f));
    
    if (hasDemographics) {
      if (endpoint === '/demographic-insights') {
        bonus += 2;
        reasons.push('Demographic fields mentioned');
      }
    }

    return bonus;
  }

  /**
   * Get field information for a query
   */
  public getQueryFields(query: string): Array<{field: string, description: string}> {
    const lowerQuery = query.toLowerCase();
    const fields: Array<{field: string, description: string}> = [];

    for (const mapping of Object.values(this.fieldMappings)) {
      if (mapping.keywords.some(kw => lowerQuery.includes(kw))) {
        mapping.fields.forEach(field => {
          fields.push({ field, description: mapping.description });
        });
      }
    }

    return fields;
  }

  /**
   * Get template information (for debugging/monitoring)
   */
  public getTemplateInfo() {
    return this.templateInfo;
  }

  /**
   * Get available field mappings (for debugging/monitoring)
   */
  public getFieldMappings() {
    return this.fieldMappings;
  }

  /**
   * Get endpoint configurations (for debugging/monitoring)
   */
  public getEndpointConfigs() {
    return this.endpointConfigs;
  }
}