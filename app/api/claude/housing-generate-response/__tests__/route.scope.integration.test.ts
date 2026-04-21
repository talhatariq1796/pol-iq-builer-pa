/* eslint-disable @typescript-eslint/no-explicit-any */
import { POST } from '../route';

// Mock Anthropic SDK to avoid network calls
jest.mock('@anthropic-ai/sdk', () => {
  return {
    Anthropic: class {
      messages = {
        create: async () => ({
          content: [
            {
              type: 'text',
              text: [
                'Analyzing 999 areas...',
                '',
                'Market Analysis Overview:',
                '• 999 markets analyzed',
                '• Average performance: 0',
                '• Performance range: 0 – 0',
                '',
                'Top Strategic Markets:',
                '',
                '- placeholder -',
                '',
                'Footer section'
              ].join('\n')
            }
          ]
        })
      };
  constructor() {}
    }
  };
});

// Mock GeoAwarenessEngine to avoid unnecessary processing
jest.mock('../../../../../lib/geo/GeoAwarenessEngine', () => ({
  GeoAwarenessEngine: {
    getInstance: () => ({
      processGeoQuery: async () => ({ matchedEntities: [], filterStats: { filterMethod: 'none' } })
    })
  }
}));

// Mock NextResponse to avoid Next.js runtime dependency in tests
jest.mock('next/server', () => ({
  NextResponse: {
    json: (obj: any, init?: any) => ({ json: async () => obj, status: init?.status || 200 })
  },
  NextRequest: class {}
}));

function feature(id: string, name: string, score: number) {
  return { type: 'Feature', properties: { ID: id, DESCRIPTION: name, area_name: name, strategic_analysis_score: score } };
}

describe('API route POST scope behavior (integration)', () => {
  const baseMessages = [{ role: 'user', content: 'Run strategic analysis' }];
  const features = [
    feature('10101', 'ZIP 10101 (City A)', 80),
    feature('20202', 'ZIP 20202 (City B)', 60),
    feature('30303', 'ZIP 30303 (City C)', 70)
  ];
  const layer = { layerId: 'test-layer', features };

  beforeAll(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
  });

  async function callPost(body: any) {
    const req: any = {
  headers: { get: (k: string) => (k.toLowerCase() === 'content-type' ? 'application/json' : '') },
      json: async () => body
    };
    const res = await POST(req as any);
    const json = await (res as any).json();
    return json as { content: string };
  }

  it('enforces selection-scoped study area and top list when spatialFilterIds provided', async () => {
    const metadata = { spatialFilterIds: ['20202', '30303'], targetVariable: 'strategic_analysis_score' };
    const body = { messages: baseMessages, metadata, featureData: [layer] };
    const { content } = await callPost(body);

    // Header count normalized
    expect(content).toMatch(/Analyzing\s+2\s+areas\.\.\./);
    // Top list contains only filtered IDs (by names)
    expect(content).toContain('30303 (City C)');
    expect(content).toContain('20202 (City B)');
    expect(content).not.toContain('10101 (City A)');
  });

  it('bypasses selection when analysisScope=project and includes all candidates', async () => {
    const metadata = { spatialFilterIds: ['20202'], analysisScope: 'project', targetVariable: 'strategic_analysis_score' };
    const body = { messages: baseMessages, metadata, featureData: [layer] };
    const { content } = await callPost(body);

    expect(content).toMatch(/Analyzing\s+3\s+areas\.\.\./);
    expect(content).toContain('10101 (City A)');
    expect(content).toContain('20202 (City B)');
    expect(content).toContain('30303 (City C)');
  });
});
