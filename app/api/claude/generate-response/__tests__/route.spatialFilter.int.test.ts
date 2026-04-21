/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';

// Mock Anthropic SDK to avoid real network calls
jest.mock('@anthropic-ai/sdk', () => {
  return {
    Anthropic: class MockAnthropic {
      public messages = {
        create: jest.fn(async () => ({
          id: 'mock-msg',
          type: 'message',
          role: 'assistant',
          content: [
            { type: 'text', text: 'mocked response' }
          ]
        }))
      };
    }
  };
});

describe('API route spatial filter integration', () => {
  beforeAll(() => {
    process.env.ANTHROPIC_API_KEY = 'test_key';
  });

  test('invokes filterFeaturesBySpatialFilterIds when spatialFilterIds are present', async () => {
    const spatialFilterMod = await import('@/lib/analysis/utils/spatialFilter');
    const spy = jest.spyOn(spatialFilterMod, 'filterFeaturesBySpatialFilterIds');

    const { POST } = await import('../route');

    const body = {
      messages: [{ role: 'user', content: 'Analyze selected areas' }],
      metadata: {
        isContextualChat: true,
        spatialFilterIds: ['2', '33333'],
        analysisScope: 'area'
      },
      featureData: [
        {
          layerId: 'test-layer',
          layerName: 'Test',
          features: [
            { properties: { ID: '1', DESCRIPTION: 'ZIP 11111 - A' } },
            { properties: { area_id: '2', DESCRIPTION: 'ZIP 22222 - B' } },
            { properties: { DESCRIPTION: 'ZIP 33333 - C' } }
          ]
        }
      ]
    };

    const req: any = {
      headers: { get: () => 'application/json' },
      json: async () => body
    };

    const res = (await POST(req)) as NextResponse;
    expect(res).toBeTruthy();

    // Ensure the spatial filter utility was invoked
    expect(spy).toHaveBeenCalled();
    const args = spy.mock.calls[0];
    expect(Array.isArray(args[0])).toBe(true); // features
    expect(args[1]).toEqual(['2', '33333']); // ids
    expect(args[2]).toMatchObject({ analysisScope: 'area' });
  });
});
