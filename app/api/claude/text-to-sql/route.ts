import { NextResponse } from 'next/server';
import { Anthropic } from '@anthropic-ai/sdk';
import { layers } from '@/config/layers';
import { resolveClaudeModel } from '@/lib/ai/claudeModel';

// Initialize Anthropic client
const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

if (!anthropicApiKey) {
  console.error('CRITICAL: ANTHROPIC_API_KEY is not set in environment variables');
}

const anthropic = new Anthropic({
  apiKey: anthropicApiKey || '',
});

interface Field {
  name: string;
  type: string;
  label: string;
}

interface Layer {
  name: string;
  type: string;
}

// export const runtime = 'edge'; // Disabled due to CommonJS compatibility issues

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'API key not configured' },
      { status: 500 }
    );
  }

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  });

  // Verbose logging for debugging
 // console.log('Received text-to-SQL request');

  try {
    const body = await request.json();
    const { messages, context } = body;

    // Get the user's question from the messages
    const userQuestion = messages[messages.length - 1].content;

    // Prepare context information
    const fieldInfo = context?.fields
      ?.map((field: Field) => `- ${field.name}: ${field.type} (${field.label})`)
      .join('\n') || 'No fields provided';

    const layerInfo = context?.layers
      ?.map((layer: Layer) => `- ${layer.name} (${layer.type})`)
      .join('\n') || 'No layers provided';

    // Get valid fields from layer configurations
    const validFields = Object.values(layers)
      .filter(layer => layer.status === 'active')
      .flatMap(layer => layer.fields)
      .map(field => ({
        name: field.name,
        label: field.label,
        type: field.type
      }));

    // Call Claude API with the same system prompt as before
    const systemPrompt = `You are an expert at converting natural language questions into ArcGIS SQL WHERE clauses. 

Available fields:
${validFields.map(f => `- "${f.name}" (${f.label}): ${f.type}`).join('\n')}

Key ArcGIS SQL differences:
1. Do NOT include the WHERE keyword
2. No subqueries (SELECT within SELECT) are allowed
3. Use simple comparisons and LIKE operators
4. ORDER BY syntax must be exactly: ORDER BY "fieldname" DESC or ORDER BY "fieldname" ASC
5. Field names must be in double quotes
6. String literals must be in single quotes
7. Use AND/OR for multiple conditions

IMPORTANT: 
- Return ONLY the SQL clause, no explanations
- ONLY use fields from the above list
- For ORDER BY, use DESC for highest values, ASC for lowest values
- The word DESC or ASC must be uppercase

Example format:
"Show areas with high values" -> "[valid_field] > 100"`;

    const response = await anthropic.messages.create({
      model: resolveClaudeModel(),
      max_tokens: 200,
      temperature: 0.3,
      system: systemPrompt, // Using the same system prompt as in your original file
      messages: [{ role: 'user', content: userQuestion }]
    });

    // Extract SQL query
    let sqlQuery = '';
    const firstContent = response.content[0];
    if (firstContent && 'text' in firstContent) {
      sqlQuery = firstContent.text.trim();
    }

    return NextResponse.json({ content: sqlQuery || '1=1' });

  } catch (error) {
    console.error('Text-to-SQL Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate SQL query' },
      { status: 500 }
    );
  }
}

export async function OPTIONS(request: Request) {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
} 