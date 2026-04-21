/**
 * Multi-Endpoint Detector for Chat
 * 
 * Analyzes user queries to determine what additional endpoint data might be needed
 * beyond the current analysis. Enables cross-endpoint insights and conversations.
 */

export interface EndpointContext {
  endpoint: string;
  reason: string;
  keywords: string[];
  priority: 'high' | 'medium' | 'low';
}

export interface MultiEndpointDetectionResult {
  additionalEndpoints: EndpointContext[];
  shouldFetch: boolean;
  reasoning: string;
}

export class MultiEndpointDetector {
  // Map keywords and phrases to their corresponding endpoints
  private endpointKeywords: Record<string, {
    endpoint: string;
    keywords: string[];
    phrases: string[];
    priority: 'high' | 'medium' | 'low';
  }> = {
    competitive: {
      endpoint: '/competitive-analysis',
      keywords: ['competitive', 'competition', 'competitor', 'rivals', 'market share', 'positioning'],
      phrases: ['competitive landscape', 'market position', 'versus competition', 'competitive advantage'],
      priority: 'high'
    },
    demographic: {
      endpoint: '/demographic-insights',
      keywords: ['demographic', 'population', 'age', 'income', 'education', 'household', 'residents'],
      phrases: ['demographic profile', 'population characteristics', 'customer demographics', 'resident profile'],
      priority: 'high'
    },
    strategic: {
      endpoint: '/strategic-analysis',
      keywords: ['strategic', 'strategy', 'opportunity', 'market', 'potential', 'growth', 'expansion'],
      phrases: ['strategic opportunity', 'market potential', 'growth opportunity', 'expansion strategy'],
      priority: 'high'
    },
    brands: {
      endpoint: '/brand-difference',
      keywords: ['brand', 'brands', 'loyalty', 'preference', 'share', 'penetration'],
      phrases: ['brand performance', 'brand share', 'brand preference', 'market penetration'],
      priority: 'medium'
    },
    clustering: {
      endpoint: '/spatial-clusters',
      keywords: ['similar', 'cluster', 'grouping', 'segments', 'patterns', 'alike'],
      phrases: ['similar areas', 'cluster analysis', 'area groupings', 'market segments'],
      priority: 'medium'
    },
    comparative: {
      endpoint: '/comparative-analysis',
      keywords: ['compare', 'comparison', 'versus', 'vs', 'differences', 'contrast'],
      phrases: ['compare areas', 'area comparison', 'versus analysis', 'side by side'],
      priority: 'high'
    },
    correlation: {
      endpoint: '/correlation-analysis',
      keywords: ['correlation', 'relationship', 'connection', 'related', 'linked', 'associated'],
      phrases: ['how related', 'correlation between', 'relationship analysis', 'connected factors'],
      priority: 'medium'
    },
    interactions: {
      endpoint: '/feature-interactions',
      keywords: ['interaction', 'factors', 'variables', 'drivers', 'influences', 'affects'],
      phrases: ['what drives', 'key factors', 'variable interactions', 'driving factors'],
      priority: 'low'
    }
  };

  /**
   * Analyze a user query to detect what additional endpoints might be needed
   */
  detectRequiredEndpoints(
    query: string, 
    currentEndpoint: string,
    conversationHistory?: string[]
  ): MultiEndpointDetectionResult {
    const queryLower = query.toLowerCase();
    const detectedEndpoints: EndpointContext[] = [];

    // Analyze query for endpoint keywords and phrases
    for (const [key, config] of Object.entries(this.endpointKeywords)) {
      if (config.endpoint === currentEndpoint) continue; // Skip current endpoint

      const matchedKeywords: string[] = [];
      const matchedPhrases: string[] = [];

      // Check for keyword matches
      for (const keyword of config.keywords) {
        if (queryLower.includes(keyword)) {
          matchedKeywords.push(keyword);
        }
      }

      // Check for phrase matches (higher weight)
      for (const phrase of config.phrases) {
        if (queryLower.includes(phrase)) {
          matchedPhrases.push(phrase);
        }
      }

      // If we found matches, add to detection results
      if (matchedKeywords.length > 0 || matchedPhrases.length > 0) {
        const allMatches = [...matchedKeywords, ...matchedPhrases];
        let reason = `Query mentions: ${allMatches.join(', ')}`;
        
        // Boost priority for phrase matches
        let priority = config.priority;
        if (matchedPhrases.length > 0) {
          priority = priority === 'low' ? 'medium' : priority === 'medium' ? 'high' : 'high';
          reason += ` (phrase matches indicate strong relevance)`;
        }

        detectedEndpoints.push({
          endpoint: config.endpoint,
          reason,
          keywords: allMatches,
          priority
        });
      }
    }

    // Also check conversation history for context
    if (conversationHistory && conversationHistory.length > 0) {
      const recentContext = conversationHistory.slice(-2).join(' ').toLowerCase();
      
      // Look for cross-references in recent conversation
      for (const [key, config] of Object.entries(this.endpointKeywords)) {
        if (config.endpoint === currentEndpoint) continue;
        
        const hasContextualRelevance = config.keywords.some(keyword => 
          recentContext.includes(keyword)
        );
        
        if (hasContextualRelevance && !detectedEndpoints.find(e => e.endpoint === config.endpoint)) {
          detectedEndpoints.push({
            endpoint: config.endpoint,
            reason: 'Referenced in recent conversation context',
            keywords: config.keywords.filter(k => recentContext.includes(k)),
            priority: 'low'
          });
        }
      }
    }

    // Sort by priority and limit results
    const prioritizedEndpoints = detectedEndpoints
      .sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      })
      .slice(0, 3); // Limit to top 3 to avoid overwhelming the system

    const shouldFetch = prioritizedEndpoints.length > 0 && 
                       prioritizedEndpoints.some(e => e.priority === 'high');

    let reasoning = 'No additional endpoints detected';
    if (prioritizedEndpoints.length > 0) {
      const highPriority = prioritizedEndpoints.filter(e => e.priority === 'high');
      const mediumPriority = prioritizedEndpoints.filter(e => e.priority === 'medium');
      
      if (highPriority.length > 0) {
        reasoning = `High-relevance endpoints detected: ${highPriority.map(e => e.endpoint).join(', ')}`;
      } else if (mediumPriority.length > 0) {
        reasoning = `Medium-relevance endpoints detected: ${mediumPriority.map(e => e.endpoint).join(', ')} (not auto-fetching)`;
      } else {
        reasoning = `Low-relevance endpoints detected: ${prioritizedEndpoints.map(e => e.endpoint).join(', ')} (contextual only)`;
      }
    }

    return {
      additionalEndpoints: prioritizedEndpoints,
      shouldFetch,
      reasoning
    };
  }

  /**
   * Get available endpoints that could provide additional context
   */
  getAvailableEndpoints(): string[] {
    return Object.values(this.endpointKeywords).map(config => config.endpoint);
  }

  /**
   * Check if a specific endpoint would be relevant for a query
   */
  isEndpointRelevant(query: string, endpoint: string): boolean {
    const queryLower = query.toLowerCase();
    const config = Object.values(this.endpointKeywords).find(c => c.endpoint === endpoint);
    
    if (!config) return false;
    
    return config.keywords.some(keyword => queryLower.includes(keyword)) ||
           config.phrases.some(phrase => queryLower.includes(phrase));
  }

  /**
   * Generate suggestions for follow-up questions based on current analysis
   */
  generateCrossEndpointSuggestions(
    currentEndpoint: string, 
    topAreas: string[] = []
  ): Array<{question: string; endpoint: string; reason: string}> {
    const suggestions: Array<{question: string; endpoint: string; reason: string}> = [];
    const area = topAreas[0] || 'these areas';

    // Generate contextual suggestions based on current endpoint
    switch (currentEndpoint) {
      case '/demographic-insights':
        suggestions.push(
          {
            question: `What's the competitive landscape in ${area}?`,
            endpoint: '/competitive-analysis',
            reason: 'Competitive context complements demographic insights'
          },
          {
            question: `What strategic opportunities exist in ${area}?`,
            endpoint: '/strategic-analysis', 
            reason: 'Strategic analysis builds on demographic foundation'
          }
        );
        break;
        
      case '/strategic-analysis':
        suggestions.push(
          {
            question: `What demographics drive this opportunity in ${area}?`,
            endpoint: '/demographic-insights',
            reason: 'Demographics explain strategic performance'
          },
          {
            question: `How does competition affect these opportunities?`,
            endpoint: '/competitive-analysis',
            reason: 'Competitive dynamics impact strategic potential'
          }
        );
        break;
        
      case '/competitive-analysis':
        suggestions.push(
          {
            question: `What demographics favor our competitive position?`,
            endpoint: '/demographic-insights',
            reason: 'Demographics explain competitive advantages'
          },
          {
            question: `What strategic moves should we consider?`,
            endpoint: '/strategic-analysis',
            reason: 'Strategy follows from competitive understanding'
          }
        );
        break;
        
      default:
        // Generic cross-endpoint suggestions
        suggestions.push(
          {
            question: `Compare ${area} to similar markets`,
            endpoint: '/comparative-analysis',
            reason: 'Comparison provides broader context'
          }
        );
    }

    return suggestions.slice(0, 3); // Limit to top 3 suggestions
  }
}

// Singleton instance
export const multiEndpointDetector = new MultiEndpointDetector();