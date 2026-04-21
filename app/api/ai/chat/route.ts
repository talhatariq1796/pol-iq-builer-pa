import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ToolContext {
  toolName: string;
  toolDescription: string;
}

interface UserContext {
  exploredPrecincts: string[];
  currentTool: string;
  recentQueries: string[];
  expertiseLevel: 'novice' | 'intermediate' | 'power_user';
  sessionDuration: number;
}

interface ChatRequest {
  messages: Message[];
  toolContext?: ToolContext;
  context?: UserContext;
}

// Import system prompt generator (async version for blob storage data)
import { getSystemPromptAsync } from '@/lib/ai/toolPrompts';
import { resolveClaudeModel } from '@/lib/ai/claudeModel';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    // Validate API key
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY is not configured' },
        { status: 500 }
      );
    }

    // Parse request body
    const body = await request.json() as ChatRequest;
    const { messages, toolContext, context } = body;

    // Validate messages
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Invalid messages array' },
        { status: 400 }
      );
    }

    // Build system prompt based on tool context (async to fetch blob data)
    const baseSystemPrompt = await getSystemPromptAsync(toolContext);

    // Build context-aware system prompt
    const contextPrompt = context ? `

USER CONTEXT (use to personalize responses):
- Explored precincts: ${context.exploredPrecincts?.join(', ') || 'none yet'}
- Current tool: ${context.currentTool || 'political-ai'}
- Recent queries: ${context.recentQueries?.slice(-3).join('; ') || 'none'}
- Session duration: ${Math.round((context.sessionDuration || 0) / 60000)} minutes
- Expertise level: ${context.expertiseLevel || 'intermediate'}

Adjust response detail based on expertise level:
- novice: Explain terminology, be thorough, provide context and examples
- intermediate: Moderate detail, assume basic knowledge, balance thoroughness with efficiency
- power_user: Be concise, use technical terms freely, skip basic explanations, provide data-dense responses
` : '';

    const systemPrompt = baseSystemPrompt + contextPrompt;

    // Create AbortController for timeout handling
    const abortController = new AbortController();
    const TIMEOUT_MS = 60000; // 60 seconds timeout
    const timeoutId = setTimeout(() => {
      console.warn('AI chat stream timeout reached');
      abortController.abort();
    }, TIMEOUT_MS);

    // Create streaming response from Claude
    let stream: any;
    try {
      stream = await anthropic.messages.stream({
        model: resolveClaudeModel(),
        max_tokens: 4096,
        system: systemPrompt,
        messages: messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
      });
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }

    // Create a ReadableStream to send to the client
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        let streamEnded = false;

        // Handle abort (timeout)
        const handleAbort = () => {
          if (!streamEnded) {
            console.error('Stream aborted due to timeout');
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'error',
                  content: 'Request timed out. Please try again.'
                })}\n\n`
              )
            );
            controller.close();
            streamEnded = true;
          }
        };

        abortController.signal.addEventListener('abort', handleAbort);

        try {
          // Handle text deltas from Claude
          stream.on('text', (text: string) => {
            if (!streamEnded && !abortController.signal.aborted) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text', content: text })}\n\n`));
            }
          });

          // Handle completion
          stream.on('end', () => {
            if (!streamEnded && !abortController.signal.aborted) {
              clearTimeout(timeoutId);
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'end' })}\n\n`));
              controller.close();
              streamEnded = true;
            }
          });

          // Handle errors (consolidated handler for all error types)
          stream.on('error', (error: any) => {
            if (!streamEnded) {
              console.error('Stream error:', error);
              clearTimeout(timeoutId);

              // Check for rate limit errors specifically
              const errorMessage = error.type === 'rate_limit_error'
                ? 'Rate limit exceeded. Please try again in a moment.'
                : 'An error occurred while processing your request.';

              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'error',
                    content: errorMessage
                  })}\n\n`
                )
              );
              controller.close();
              streamEnded = true;
            }
          });

        } catch (error) {
          console.error('Stream initialization error:', error);
          clearTimeout(timeoutId);
          controller.error(error);
        }
      },
      cancel() {
        // Clean up when client disconnects
        clearTimeout(timeoutId);
      },
    });

    // Return streaming response with appropriate headers
    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: any) {
    console.error('API route error:', error);

    // Handle rate limit errors
    if (error?.status === 429) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again in a moment.' },
        { status: 429 }
      );
    }

    // Handle authentication errors
    if (error?.status === 401) {
      return NextResponse.json(
        { error: 'Invalid API key configuration' },
        { status: 500 }
      );
    }

    // Handle other API errors
    if (error?.status) {
      return NextResponse.json(
        { error: error.message || 'API error occurred' },
        { status: error.status }
      );
    }

    // Generic error handler
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
