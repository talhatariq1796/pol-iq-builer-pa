/**
 * AI Query Test API
 *
 * Tests the local handler system without requiring Claude API calls.
 * Used for automated testing of query routing, response formatting, etc.
 */

import { NextRequest, NextResponse } from 'next/server';
import { processQuery, canHandleQuery } from '@/lib/ai-native/handlers/ToolOrchestrator';
import { enrich } from '@/lib/context/ContextEnrichmentService';

interface QueryRequest {
  query: string;
  toolContext?: string;
  testMode?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as QueryRequest;
    const { query, toolContext = 'political-ai', testMode = false } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required and must be a string' },
        { status: 400 }
      );
    }

    // Check if handler can process this query
    const canHandle = canHandleQuery(query);

    // Process the query with local handlers (context is optional)
    const result = await processQuery(query);

    // Optionally enrich with RAG/Knowledge Graph
    let enrichmentContext = null;
    if (testMode) {
      try {
        enrichmentContext = await enrich(query, {
          intent: result.metadata?.matchedIntent || '',
          jurisdiction: 'Ingham County',
        });
      } catch (enrichError) {
        console.error('[AI Query API] Enrichment error:', enrichError);
      }
    }

    // Return the result with metadata
    return NextResponse.json({
      success: result.success,
      response: result.response,
      mapCommands: result.mapCommands || [],
      suggestedActions: result.suggestedActions || [],
      metadata: {
        ...result.metadata,
        canHandle,
        enrichment: enrichmentContext
          ? {
              ragScore: enrichmentContext.relevance.ragScore,
              graphScore: enrichmentContext.relevance.graphScore,
              overallScore: enrichmentContext.relevance.overallScore,
              shouldInclude: enrichmentContext.relevance.shouldInclude,
              reasons: enrichmentContext.relevance.reasons,
            }
          : null,
      },
      data: result.data || null,
    });
  } catch (error) {
    console.error('[AI Query API] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// GET endpoint for quick testing
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) {
    return NextResponse.json(
      {
        error: 'Query parameter "q" is required',
        usage: '/api/ai/query?q=Find%20swing%20precincts',
      },
      { status: 400 }
    );
  }

  // Forward to POST handler
  const fakeRequest = {
    json: async () => ({ query, testMode: true }),
  } as NextRequest;

  return POST(fakeRequest);
}
