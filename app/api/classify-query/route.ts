import { NextRequest, NextResponse } from 'next/server';

type QueryClassification = 'follow-up' | 'new-analysis';

/**
 * API endpoint to classify user queries as follow-up questions or new analysis requests
 */
export async function POST(request: NextRequest) {
  try {
    const { query, conversationHistory } = await request.json();

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const classification = classifyUserQuery(query, conversationHistory || '');
    
    return NextResponse.json(classification, { status: 200 });
  } catch (error) {
    console.error('[classify-query] Error:', error);
    return NextResponse.json('new-analysis', { status: 200 }); // Default to new analysis on error
  }
}

/**
 * Simple rule-based classification to determine if a query is a follow-up or new analysis
 */
function classifyUserQuery(query: string, conversationHistory: string): QueryClassification {
  const queryLower = query.toLowerCase().trim();
  
  // If no conversation history, it's definitely a new analysis
  if (!conversationHistory || conversationHistory.trim().length === 0) {
    return 'new-analysis';
  }

  // Follow-up indicators - short clarifying questions
  const followUpPatterns = [
    // Question words with short queries
    /^(what|why|how|where|when|which|who)\s.{1,30}$/i,
    
    // Short responses/confirmations
    /^(yes|no|ok|okay|thanks|thank you|sure|exactly|right|correct|interesting)\.?$/i,
    
    // Clarification requests
    /^(can you\s)?(explain|clarify|elaborate|tell me more|expand|detail)/i,
    /\b(more details?|more info|explain that|what do you mean|how so)\b/i,
    
    // Reference to previous analysis
    /\b(this analysis|these results|the data|the map|this visualization)\b/i,
    /\b(above|previous|earlier|before|that)\b/i,
    
    // Short comparative questions
    /^(what about|how about|and)\s/i,
    
    // Short metric questions
    /^(what.{1,15}(score|value|number|percentage|metric))/i,
  ];

  // New analysis indicators - longer, specific requests
  const newAnalysisPatterns = [
    // Geographic analysis requests
    /\b(show me|analyze|compare|find|identify)\s.*\b(area|region|market|city|state|zip|neighborhood)\b/i,
    
    // Brand comparison requests
    /\b(nike|adidas|puma|jordan|new balance|under armour)\s.*(vs|versus|against|compared to)/i,
    
    // Analysis type requests
    /\b(strategic|competitive|demographic|customer|market|spatial|cluster|trend)\s.*(analysis|insights|data)/i,
    
    // Data visualization requests
    /\b(visualize|plot|chart|graph|map)\b/i,
    
    // Specific metric requests with geographic scope
    /.{20,}(opportunity|penetration|performance|share|potential)/i,
  ];

  // Check for follow-up patterns first (more specific)
  for (const pattern of followUpPatterns) {
    if (pattern.test(queryLower)) {
      console.log('[Query Classification] Matched follow-up pattern:', pattern.source);
      return 'follow-up';
    }
  }

  // Check for new analysis patterns
  for (const pattern of newAnalysisPatterns) {
    if (pattern.test(queryLower)) {
      console.log('[Query Classification] Matched new analysis pattern:', pattern.source);
      return 'new-analysis';
    }
  }

  // Heuristics based on query length and complexity
  if (queryLower.length < 20) {
    // Short queries are more likely to be follow-ups
    return 'follow-up';
  }
  
  if (queryLower.length > 50 && /\b(show|analyze|compare|find)\b/.test(queryLower)) {
    // Long queries with action words are likely new analysis
    return 'new-analysis';
  }

  // Default: if conversation exists and query is ambiguous, treat as follow-up
  return 'follow-up';
}