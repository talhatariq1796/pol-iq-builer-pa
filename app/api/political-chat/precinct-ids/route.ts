import { NextRequest, NextResponse } from 'next/server';
import { resolvePrecinctIdsForUserQuery } from '@/lib/political/politicalChatExportIds';

export const maxDuration = 60;
export const fetchCache = 'force-no-store';

/**
 * POST { userQuery: string } → { ids: string[] }
 * Same deterministic list as political-chat `dataPrecinctIds` (for orchestrator path + export retry).
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const userQuery = typeof body.userQuery === 'string' ? body.userQuery : '';
    const ids = await resolvePrecinctIdsForUserQuery(userQuery);
    return NextResponse.json({ ids });
  } catch (error) {
    console.error('[political-chat/precinct-ids]', error);
    return NextResponse.json(
      { ids: [], error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
