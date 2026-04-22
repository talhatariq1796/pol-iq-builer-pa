/**
 * Client-side: resolve which precinct IDs to export so CSV matches /api/political-chat counts.
 * Always re-fetches from /api/political-chat/precinct-ids first (deterministic, same as server).
 */
import {
  getLastChatExportPrecinctIds,
  setLastChatExportPrecinctIds,
  getLastUserQueryForExport,
} from '@/lib/ai-native/lastChatExportPrecinctIds';

export async function fetchPoliticalExportPrecinctIdsFromServer(userQuery: string): Promise<string[] | null> {
  const q = userQuery.trim();
  if (!q) return null;
  try {
    const res = await fetch('/api/political-chat/precinct-ids', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userQuery: q }),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { ids?: string[] };
    if (Array.isArray(j.ids) && j.ids.length > 0) {
      return j.ids;
    }
  } catch (e) {
    console.warn('[resolvePoliticalExportPrecinctIds] precinct-ids API failed', e);
  }
  return null;
}

export type ResolvePoliticalExportPrecinctIdsOptions = {
  metadataPrecinctIds?: string[] | undefined;
  segmentMatchingPrecincts?: string[] | undefined;
};

export async function resolvePoliticalExportPrecinctIds(
  options: ResolvePoliticalExportPrecinctIdsOptions = {}
): Promise<string[]> {
  const fromMeta = (options.metadataPrecinctIds ?? []).filter(Boolean);
  if (fromMeta.length > 0) return fromMeta;

  const lastQ = getLastUserQueryForExport().trim();
  if (lastQ.length > 0) {
    const serverIds = await fetchPoliticalExportPrecinctIdsFromServer(lastQ);
    if (serverIds && serverIds.length > 0) {
      setLastChatExportPrecinctIds(serverIds);
      return serverIds;
    }
  }

  const cached = getLastChatExportPrecinctIds();
  if (cached.length > 0) return cached;

  return (options.segmentMatchingPrecincts ?? []).filter(Boolean);
}
