/**
 * MultiEndpointQueryDetector - Detects queries requiring multiple endpoints
 * 
 * Analyzes user queries to determine:
 * 1. Whether multiple endpoints are needed
 * 2. Which specific endpoints to combine
 * 3. How to combine them (overlay, comparison, sequential)
 */

export interface MultiEndpointQuery {
  isMultiEndpoint: boolean;
  primaryEndpoint: string;
  secondaryEndpoints: string[];
  combinationStrategy: 'overlay' | 'comparison' | 'sequential' | 'correlation';
  confidence: number;
  reasoning: string;
}

export interface QueryPattern {
  keywords: string[];
  endpoints: string[];
  strategy: 'overlay' | 'comparison' | 'sequential' | 'correlation';
  weight: number;
}

export class MultiEndpointQueryDetector {
  
  private readonly multiEndpointPatterns: QueryPattern[] = [
    // Market Entry & Strategic Analysis
    {
      keywords: ['expand', 'entry', 'new store', 'investment', 'opportunity', 'where should'],
      endpoints: ['/competitive-analysis', '/demographic-insights', '/spatial-clusters', '/predictive-modeling'],
      strategy: 'overlay',
      weight: 0.9
    },
    
    // Risk & Opportunity Analysis  
    {
      keywords: ['risk', 'opportunity', 'investment', 'safe', 'potential', 'growth'],
      endpoints: ['/anomaly-detection', '/trend-analysis', '/competitive-analysis', '/demographic-insights'],
      strategy: 'overlay',
      weight: 0.85
    },
    
    // Performance Diagnosis
    {
      keywords: ['underperform', 'why', 'problem', 'diagnosis', 'failing', 'issue'],
      endpoints: ['/outlier-detection', '/competitive-analysis', '/feature-interactions', '/spatial-clusters'],
      strategy: 'sequential',
      weight: 0.8
    },
    
    // Comprehensive Comparison
    {
      keywords: ['compare', 'versus', 'vs', 'difference', 'better', 'benchmark'],
      endpoints: ['/competitive-analysis', '/comparative-analysis', '/demographic-insights'],
      strategy: 'comparison',
      weight: 0.75
    },
    
    // Product/Strategy Optimization
    {
      keywords: ['optimize', 'improve', 'enhance', 'strategy', 'mix', 'focus'],
      endpoints: ['/feature-interactions', '/demographic-insights', '/trend-analysis', '/sensitivity-analysis'],
      strategy: 'correlation',
      weight: 0.7
    },
    
    // Customer Profile + Demographics
    {
      keywords: ['demographic', 'fit', 'target', 'customer', 'profile'],
      endpoints: ['/strategic-analysis', '/segment-profiling'],
      strategy: 'correlation',
      weight: 0.85
    },
    
    // Customer Profile + Strategic Analysis
    {
      keywords: ['customer', 'strategic', 'opportunit', 'compare', 'analyz'],
      endpoints: ['/customer-profile', '/strategic-analysis'],
      strategy: 'comparison',
      weight: 0.9
    },
    
    // Demographic Opportunity Analysis
    {
      keywords: ['demographic', 'opportunity', 'scores'],
      endpoints: ['/strategic-analysis'],
      strategy: 'overlay',
      weight: 0.9
    },
    
    // Clustering + Demographics
    {
      keywords: ['segment', 'similar', 'cluster', 'group', 'demographic'],
      endpoints: ['/spatial-clusters', '/demographic-insights', '/segment-profiling'],
      strategy: 'overlay',
      weight: 0.75
    },
    
    // Predictive + Risk Analysis
    {
      keywords: ['forecast', 'predict', 'future', 'trend', 'projection'],
      endpoints: ['/predictive-modeling', '/trend-analysis', '/anomaly-detection'],
      strategy: 'sequential',
      weight: 0.8
    },
    
    // Comprehensive Market Analysis
    {
      keywords: ['market', 'analysis', 'comprehensive', 'complete', 'full', 'overall'],
      endpoints: ['/analyze', '/competitive-analysis', '/demographic-insights', '/spatial-clusters'],
      strategy: 'overlay',
      weight: 0.6
    }
  ];

  /**
   * Analyze query to determine if multiple endpoints are needed
   */
  analyzeQuery(query: string): MultiEndpointQuery {
    const lowerQuery = query.toLowerCase();
    console.log(`[MultiEndpointQueryDetector] Analyzing query: "${query}"`);
    
    // Check for explicit multi-endpoint indicators
    const explicitMultiEndpoint = this.detectExplicitMultiEndpoint(lowerQuery);
    if (explicitMultiEndpoint) {
      return explicitMultiEndpoint;
    }
    
    // Score patterns against query
    const patternScores = this.scorePatterns(lowerQuery);
    const bestPattern = patternScores[0];
    
    // Determine if multi-endpoint is needed (lowered threshold)
    const isMultiEndpoint = bestPattern && bestPattern.score >= 0.4;
    
    if (isMultiEndpoint) {
      const result: MultiEndpointQuery = {
        isMultiEndpoint: true,
        primaryEndpoint: bestPattern.pattern.endpoints[0],
        secondaryEndpoints: bestPattern.pattern.endpoints.slice(1),
        combinationStrategy: bestPattern.pattern.strategy,
        confidence: bestPattern.score,
        reasoning: `Detected multi-endpoint query matching pattern: ${bestPattern.pattern.keywords.join(', ')}`
      };
      
      console.log(`[MultiEndpointQueryDetector] Multi-endpoint detected:`, result);
      return result;
    }
    
    // Default to single endpoint
    return {
      isMultiEndpoint: false,
      primaryEndpoint: this.detectSingleEndpoint(lowerQuery),
      secondaryEndpoints: [],
      combinationStrategy: 'overlay',
      confidence: 0.5,
      reasoning: 'No multi-endpoint patterns detected, using single endpoint'
    };
  }

  /**
   * Detect explicit multi-endpoint requests
   */
  private detectExplicitMultiEndpoint(query: string): MultiEndpointQuery | null {
    // Look for explicit "and" combinations
    const andCombinations = [
      {
        pattern: /compet.*and.*demograph/,
        endpoints: ['/competitive-analysis', '/demographic-insights'],
        strategy: 'comparison' as const
      },
      {
        pattern: /cluster.*and.*trend/,
        endpoints: ['/spatial-clusters', '/trend-analysis'], 
        strategy: 'overlay' as const
      },
      {
        pattern: /risk.*and.*opportun/,
        endpoints: ['/anomaly-detection', '/competitive-analysis', '/predictive-modeling'],
        strategy: 'overlay' as const
      },
      {
        pattern: /(performance|outlier).*and.*(competition|demographic)/,
        endpoints: ['/outlier-detection', '/competitive-analysis', '/demographic-insights'],
        strategy: 'sequential' as const
      }
    ];
    
    for (const combo of andCombinations) {
      if (combo.pattern.test(query)) {
        return {
          isMultiEndpoint: true,
          primaryEndpoint: combo.endpoints[0],
          secondaryEndpoints: combo.endpoints.slice(1),
          combinationStrategy: combo.strategy,
          confidence: 0.95,
          reasoning: `Explicit multi-endpoint request detected: ${combo.pattern}`
        };
      }
    }
    
    return null;
  }

  /**
   * Score all patterns against the query
   */
  private scorePatterns(query: string): Array<{pattern: QueryPattern, score: number}> {
    const scores = this.multiEndpointPatterns.map(pattern => {
      let score = 0;
      let matchCount = 0;
      const matchedKeywords: string[] = [];
      
      // Count keyword matches
      for (const keyword of pattern.keywords) {
        if (query.includes(keyword)) {
          score += pattern.weight;
          matchCount++;
          matchedKeywords.push(keyword);
        }
      }
      
      // More lenient scoring: if we match at least 2 keywords, apply partial score
      let normalizedScore = 0;
      if (matchCount >= 2) {
        // Award points for matching multiple keywords
        const matchRatio = matchCount / pattern.keywords.length;
        normalizedScore = pattern.weight * matchRatio * Math.min(1, matchCount / 2);
      } else if (matchCount === 1) {
        // Single keyword match gets lower score
        normalizedScore = pattern.weight * 0.3;
      }
      
      // Debug logging for patterns with matches
      if (matchCount > 0) {
        console.log(`[MultiEndpointQueryDetector] Pattern match:`, {
          keywords: pattern.keywords,
          matched: matchedKeywords,
          matchCount,
          rawScore: score,
          normalizedScore,
          endpoints: pattern.endpoints
        });
      }
      
      return { pattern, score: normalizedScore };
    });
    
    // Sort by score descending
    return scores.sort((a, b) => b.score - a.score);
  }

  /**
   * Detect single endpoint for fallback
   */
  private detectSingleEndpoint(query: string): string {
    const singleEndpointPatterns: Record<string, string[]> = {
      '/competitive-analysis': ['compet', 'nike', 'adidas', 'brand', 'market share'],
      '/demographic-insights': ['demographic', 'population', 'income', 'age', 'household'],
      '/spatial-clusters': ['cluster', 'similar', 'group', 'area', 'region'],
      '/trend-analysis': ['trend', 'temporal', 'time', 'seasonal', 'change'],
      '/predictive-modeling': ['predict', 'forecast', 'future', 'model', 'projection'],
      '/anomaly-detection': ['anomaly', 'unusual', 'outlier', 'abnormal', 'detect'],
      '/outlier-detection': ['outlier', 'underperform', 'extreme', 'exception'],
      '/feature-interactions': ['interaction', 'relationship', 'correlation', 'factor'],
      '/sensitivity-analysis': ['sensitivity', 'impact', 'effect', 'influence'],
      '/segment-profiling': ['segment', 'profile', 'customer', 'target']
    };
    
    let bestMatch = { endpoint: '/analyze', score: 0 };
    
    for (const [endpoint, keywords] of Object.entries(singleEndpointPatterns)) {
      const score = keywords.reduce((sum, keyword) => 
        sum + (query.includes(keyword) ? 1 : 0), 0
      );
      
      if (score > bestMatch.score) {
        bestMatch = { endpoint, score };
      }
    }
    
    return bestMatch.endpoint;
  }

  /**
   * Get suggested multi-endpoint combinations for a query type
   */
  getSuggestedCombinations(queryType: string): string[][] {
    const combinations: Record<string, string[][]> = {
      'market_entry': [
        ['/competitive-analysis', '/demographic-insights', '/spatial-clusters'],
        ['/predictive-modeling', '/anomaly-detection', '/trend-analysis']
      ],
      'performance_diagnosis': [
        ['/outlier-detection', '/competitive-analysis', '/feature-interactions'],
        ['/spatial-clusters', '/demographic-insights']
      ],
      'risk_analysis': [
        ['/anomaly-detection', '/trend-analysis', '/predictive-modeling'],
        ['/competitive-analysis', '/demographic-insights']
      ],
      'opportunity_analysis': [
        ['/competitive-analysis', '/demographic-insights', '/predictive-modeling'],
        ['/spatial-clusters', '/trend-analysis']
      ]
    };
    
    return combinations[queryType] || [];
  }

  /**
   * Validate endpoint combination makes sense
   */
  validateCombination(endpoints: string[]): boolean {
    // Ensure we don't have conflicting endpoints
    const conflictingPairs = [
      ['/outlier-detection', '/anomaly-detection'], // Similar functionality
      ['/competitive-analysis', '/comparative-analysis'] // Overlapping scope
    ];
    
    for (const [endpoint1, endpoint2] of conflictingPairs) {
      if (endpoints.includes(endpoint1) && endpoints.includes(endpoint2)) {
        console.warn(`[MultiEndpointQueryDetector] Conflicting endpoints detected: ${endpoint1}, ${endpoint2}`);
        return false;
      }
    }
    
    // Ensure reasonable number of endpoints (2-4 is optimal)
    if (endpoints.length < 2 || endpoints.length > 4) {
      console.warn(`[MultiEndpointQueryDetector] Suboptimal number of endpoints: ${endpoints.length}`);
      return false;
    }
    
    return true;
  }
}

// Usage examples
export const EXAMPLE_MULTI_ENDPOINT_QUERIES = [
  {
    query: "Where should Nike expand stores considering competition and demographics?",
    expected: {
      isMultiEndpoint: true,
      endpoints: ['/competitive-analysis', '/demographic-insights', '/spatial-clusters'],
      strategy: 'overlay'
    }
  },
  {
    query: "Why is our Vancouver store underperforming and what's the root cause?", 
    expected: {
      isMultiEndpoint: true,
      endpoints: ['/outlier-detection', '/competitive-analysis', '/feature-interactions'],
      strategy: 'sequential'
    }
  },
  {
    query: "Show me high-opportunity, low-risk markets for investment",
    expected: {
      isMultiEndpoint: true,
      endpoints: ['/anomaly-detection', '/competitive-analysis', '/predictive-modeling'],
      strategy: 'overlay'
    }
  },
  {
    query: "Compare Nike vs Adidas performance across different demographic segments",
    expected: {
      isMultiEndpoint: true,
      endpoints: ['/competitive-analysis', '/demographic-insights', '/comparative-analysis'],
      strategy: 'comparison'
    }
  }
]; 