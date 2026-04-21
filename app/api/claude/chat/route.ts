import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { Anthropic } from '@anthropic-ai/sdk';
import { resolveClaudeModel } from '@/lib/ai/claudeModel';

export const maxDuration = 120;
export const fetchCache = 'force-no-store';
export const revalidate = 0;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export async function POST(req: NextRequest) {
  console.log('[Chat API] Chat endpoint called');
  
  try {
    const { messages, metadata, featureData, persona } = await req.json();
    
    console.log('[Chat API] Request received:', { 
      messageCount: messages?.length,
      persona: persona,
      hasFeatureData: !!featureData
    });

    // Validate basic requirements
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ 
        error: 'Messages array is required' 
      }, { status: 400 });
    }

    // Get persona instructions
    const personaInstructions = getPersonaInstructions(persona || 'strategist');

    // Build context from feature data if available
    let contextPrompt = '';
    if (featureData && Array.isArray(featureData) && featureData.length > 0) {
      const totalFeatures = featureData.reduce((sum: number, layer: any) => sum + (layer.features?.length || 0), 0);
      contextPrompt = `\n\nYou have access to geographic/analysis data with ${featureData.length} layers and ${totalFeatures} total features.`;
    }

    // Build system message
    const systemMessage = `${personaInstructions}${contextPrompt}

Keep responses concise and focused. If asked for a simple response, provide exactly what was requested.`;

    // Convert our message format to Claude format
    const claudeMessages = messages.map((msg: any) => ({
      role: msg.role,
      content: msg.content
    }));

    console.log('[Chat API] Calling Claude API with persona:', persona);
    const response = await anthropic.messages.create({
      model: resolveClaudeModel(),
      max_tokens: 1000,
      messages: claudeMessages,
      system: systemMessage,
    });

    const content = response.content[0]?.type === 'text' ? response.content[0].text : 'No response generated';

    console.log('[Chat API] Response generated successfully');
    return NextResponse.json({ content });
    
  } catch (error) {
    console.error('[Chat API] Error:', error);
    return NextResponse.json({ 
      error: 'Chat API error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

function getPersonaInstructions(persona: string): string {
  const personas: Record<string, string> = {
    strategist: 'You are a strategic business analyst focused on actionable insights and market opportunities.',
    analyst: 'You are a data analyst providing clear, evidence-based insights from the available data.',
    consultant: 'You are a management consultant offering strategic recommendations based on data analysis.',
  };
  
  return personas[persona] || personas.strategist;
}