/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * RankingDetector - Unified query analysis for top/ranking requests
 * 
 * Detects when users are asking for top/highest/lowest/best/worst performers
 * and extracts ranking parameters without removing complete dataset context.
 */

export interface RankingRequest {
  isRankingQuery: boolean;
  rankingType: 'top' | 'bottom' | 'best' | 'worst' | 'highest' | 'lowest' | null;
  count: number;
  metric?: string;
  originalQuery: string;
}

export class RankingDetector {
  
  /**
   * Analyze query to detect ranking requests
   */
  static detectRanking(query: string): RankingRequest {
    const queryLower = query.toLowerCase().trim();
    
    // Ranking keywords with their types
    const rankingPatterns = [
      // Top performers
      { patterns: ['top', 'best', 'highest', 'leading', 'premier'], type: 'top' as const },
      // Bottom performers  
      { patterns: ['bottom', 'worst', 'lowest', 'poorest', 'weakest'], type: 'bottom' as const },
    ];
    
    let isRankingQuery = false;
    let rankingType: 'top' | 'bottom' | 'best' | 'worst' | 'highest' | 'lowest' | null = null;
    let count = 10; // Default count
    let metric: string | undefined;
    
    // Check for ranking patterns
    for (const category of rankingPatterns) {
      for (const pattern of category.patterns) {
        if (queryLower.includes(pattern)) {
          isRankingQuery = true;
          rankingType = pattern as any;
          
          // Extract number if specified
          const numberMatch = this.extractRankingCount(queryLower, pattern);
          if (numberMatch) {
            count = numberMatch;
          }
          
          // Extract metric context
          metric = this.extractMetricContext(queryLower);
          break;
        }
      }
      if (isRankingQuery) break;
    }
    
    return {
      isRankingQuery,
      rankingType,
      count,
      metric,
      originalQuery: query
    };
  }
  
  /**
   * Extract number from ranking queries like "top 5", "best 15", etc.
   */
  private static extractRankingCount(query: string, keyword: string): number | null {
    // Look for patterns like "top 5", "best 15", "highest 20"
    const patterns = [
      new RegExp(`${keyword}\\s+(\\d+)`, 'i'),
      new RegExp(`(\\d+)\\s+${keyword}`, 'i'),
      new RegExp(`${keyword}\\s+(\\d+)\\s+`, 'i')
    ];
    
    for (const pattern of patterns) {
      const match = query.match(pattern);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        // Reasonable bounds (1-50)
        if (num >= 1 && num <= 50) {
          return num;
        }
      }
    }
    
    return null;
  }
  
  /**
   * Extract metric context from query
   */
  private static extractMetricContext(query: string): string | undefined {
    const metricKeywords = [
      'markets', 'areas', 'regions', 'locations', 'zones',
      'opportunities', 'performers', 'candidates', 'targets',
      'scores', 'values', 'potential', 'performance'
    ];
    
    for (const keyword of metricKeywords) {
      if (query.includes(keyword)) {
        return keyword;
      }
    }
    
    return undefined;
  }
  
  /**
   * Generate ranking context for Claude analysis
   */
  static generateRankingContext(ranking: RankingRequest, totalFeatures: number): string {
    if (!ranking.isRankingQuery) {
      return '';
    }
    
    const typeText = ranking.rankingType === 'top' || ranking.rankingType === 'best' || ranking.rankingType === 'highest' 
      ? 'highest-performing' 
      : 'lowest-performing';
    
    const metricText = ranking.metric ? ` ${ranking.metric}` : ' areas';
    
    return `\n=== RANKING ANALYSIS REQUEST ===
User specifically requested the ${ranking.rankingType} ${ranking.count}${metricText}.

**Analysis Instructions:**
- Focus primary attention on the ${ranking.count} ${typeText} areas
- Provide detailed insights about these top performers
- Include complete dataset context (${totalFeatures} total areas) for comparison
- Highlight what makes the top performers unique
- Discuss performance gaps and opportunities across the full dataset

**Key Areas to Highlight:** The ${ranking.count} ${typeText} areas by score
`;
  }
  
  /**
   * Prepare features with ranking emphasis
   */
  static prepareRankedFeatures(
    features: any[], 
    ranking: RankingRequest, 
    valueField: string = 'value'
  ): { 
    allFeatures: any[], 
    topPerformers: any[], 
    rankingContext: string 
  } {
    if (!ranking.isRankingQuery) {
      return {
        allFeatures: features,
        topPerformers: [],
        rankingContext: ''
      };
    }
    
    // Sort features by the specified field
    const sortedFeatures = [...features].sort((a, b) => {
      const aValue = this.getFeatureValue(a, valueField);
      const bValue = this.getFeatureValue(b, valueField);
      
      // For 'bottom', 'worst', 'lowest' - ascending order
      if (ranking.rankingType === 'bottom' || ranking.rankingType === 'worst' || ranking.rankingType === 'lowest') {
        return aValue - bValue;
      }
      
      // For 'top', 'best', 'highest' - descending order  
      return bValue - aValue;
    });
    
    // Get top N performers
    const topPerformers = sortedFeatures.slice(0, ranking.count);
    
    // Mark top performers in the complete dataset
    const allFeaturesWithRanking = features.map(feature => ({
      ...feature,
      isTopPerformer: topPerformers.some(tp => 
        this.getFeatureId(tp) === this.getFeatureId(feature)
      ),
      ranking: ranking
    }));
    
    const rankingContext = this.generateRankingContext(ranking, features.length);
    
    return {
      allFeatures: allFeaturesWithRanking,
      topPerformers,
      rankingContext
    };
  }
  
  /**
   * Extract value from feature using dynamic field access
   */
  private static getFeatureValue(feature: any, valueField: string): number {
    const value = feature.properties?.[valueField] || 
                  feature[valueField] || 
                  feature.properties?.value || 
                  feature.value || 0;
    return typeof value === 'number' ? value : 0;
  }
  
  /**
   * Get unique identifier for feature
   */
  private static getFeatureId(feature: any): string {
    return feature.properties?.ID || 
           feature.properties?.OBJECTID || 
           feature.properties?.id || 
           feature.id || 
           feature.properties?.area_id || 
           'unknown';
  }
}