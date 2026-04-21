/* eslint-disable prefer-const */
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { hasOwnProperty } from '@/utils/lint-helpers';
import { mapQueryToVisualizations, QueryIntent } from '@/utils/visualizations/query-mapper';
import { resolveClaudeModel, resolveClaudeRetryModel } from '@/lib/ai/claudeModel';
import { VisualizationType } from '@/config/dynamic-layers';

// Inline type definitions for Anthropic API
type ImageBlockParam = {
  type: 'image';
  source: {
    type: 'base64';
    media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
    data: string;
  };
};

type TextBlockParam = {
  type: 'text';
  text: string;
};

type ToolUseBlockParam = {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
};

type ContentBlockParam = TextBlockParam | ImageBlockParam | ToolUseBlockParam;

type MessageParam = {
  role: 'user' | 'assistant';
  content: string | ContentBlockParam[];
};

type MessageCreateParamsBase = {
  max_tokens: number;
  temperature?: number;
  system?: string;
  messages: MessageParam[];
  model: string;
  stream?: boolean;
};

type Message = {
  id: string;
  content: Array<{
    type: string;
    text?: string;
    [key: string]: any;
  }>;
  role: 'assistant';
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' | null;
  stop_sequence: string | null;
  type: 'message';
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
};

type ClaudeAPIError = {
  type: string;
  error: {
    type: string;
    message: string;
  };
};

type APIResponse = Message | ClaudeAPIError;

function isAPIError(response: APIResponse): response is ClaudeAPIError {
  return 'error' in response;
}

// Check for API key at startup
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error('CRITICAL: ANTHROPIC_API_KEY is not set in environment variables');
}

const anthropic = new Anthropic({
  apiKey: apiKey || '',
});

const systemPrompt = `You are an AI assistant that analyzes user queries to determine the most appropriate visualization type and data requirements.
Your task is to:
1. Understand the user's intent
2. Identify relevant layers and fields
3. Determine the query type
4. Suggest appropriate visualization types

The system supports the following query types:
- correlation: Analyze relationships between variables
- distribution: Show patterns and distributions
- ranking: Compare values or identify top/bottom areas
- temporal: Analyze changes over time
- spatial: Analyze spatial relationships
- composite: Combine multiple analysis types
- joint_high: Identify areas meeting multiple criteria
- difference: Calculate and visualize differences between two datasets (e.g., "Nike vs Adidas", "where is X higher than Y")
- single_layer: Basic visualization of a single metric

For each query, provide a JSON response with:
{
  "intent": "string describing the user's goal",
  "relevantLayers": ["array of layer names"],
  "relevantFields": ["array of field names"],
  "queryType": "one of the supported query types",
  "visualizationType": "suggested visualization type",
  "confidence": number between 0 and 1
}

Be specific about the intent and include all potentially relevant layers and fields, even if you're not completely certain.`;

export async function POST(req: Request) {
  try {
    const { query } = await req.json();

    const primaryModel = resolveClaudeModel();
    const fallbackModel = resolveClaudeRetryModel(primaryModel);

    // Call Claude API to analyze the query using the SDK
    const response = await anthropic.messages.create({
      model: primaryModel,
      max_tokens: 1000,
      system: systemPrompt,
      messages: [
        { role: 'user', content: query }
      ]
    });

    let data: APIResponse = response;

    // Log the full response for debugging
    console.log('Claude API response:', JSON.stringify(data, null, 2));

    // Handle potential error response
    if (isAPIError(data)) {
      console.error('Claude API error:', data);

      // If primary model fails, try fallback model
      if (data.error.type === 'invalid_request_error' || data.error.type === 'model_not_found') {
        console.log('Primary model failed, trying fallback model...');
        const fallbackResponse = await anthropic.messages.create({
          model: fallbackModel,
          max_tokens: 1000,
          system: systemPrompt,
          messages: [
            { role: 'user', content: query }
          ]
        });

        if (isAPIError(fallbackResponse)) {
          console.error('Fallback model also failed:', fallbackResponse);
          throw new Error(fallbackResponse.error.message || 'Failed to analyze query with both models');
        }

        // Use fallback data instead
        data = fallbackResponse;
      } else {
        throw new Error(data.error.message || 'Failed to analyze query');
      }
    }

    // Extract the content from the response
    const content = data.content?.[0]?.text;
    if (!content) {
      console.error('Invalid response structure:', data);
      throw new Error('Invalid response format from Claude API');
    }

    let analysis;
    try {
      // Extract just the JSON part from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      analysis = JSON.parse(jsonMatch[0]);
      console.log('Parsed analysis:', analysis);
    } catch (parseError) {
      console.error('Failed to parse analysis:', content);
      throw new Error('Failed to parse analysis response');
    }

    // Create query intent from analysis
    const queryIntent: QueryIntent = {
      type: analysis.queryType,
      fields: analysis.relevantFields,
      geometryType: 'polygon', // Default to polygon, can be updated based on layer metadata
      filters: {} // Can be populated based on query analysis
    };

    // Get visualization suggestions
    const suggestions = mapQueryToVisualizations(queryIntent);
    const bestSuggestion = suggestions[0];
    const alternatives = suggestions.slice(1);

    return NextResponse.json({
      intent: analysis.intent,
      relevantLayers: analysis.relevantLayers,
      relevantFields: analysis.relevantFields,
      queryType: analysis.queryType,
      visualizationType: bestSuggestion?.type || VisualizationType.SINGLE_LAYER,
      confidence: bestSuggestion?.confidence || 0.5,
      alternativeVisualizations: alternatives.map(suggestion => ({
        type: suggestion.type,
        confidence: suggestion.confidence,
        reason: suggestion.reason
      }))
    });
  } catch (error) {
    console.error('Error analyzing query:', error);
    return NextResponse.json(
      { error: 'Failed to analyze query' },
      { status: 500 }
    );
  }
}