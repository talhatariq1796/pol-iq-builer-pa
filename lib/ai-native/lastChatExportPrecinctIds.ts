/**
 * Persists precinct IDs from the last /api/political-chat response that included
 * `dataPrecinctIds`, so CSV/VAN export can match the assistant's filtered list
 * (not the full statewide file). Shared across AI chat UIs in the same tab.
 */
const STORAGE_KEY = 'pol-iq:last-chat-export-precinct-ids';
const LAST_USER_QUERY_KEY = 'pol-iq:last-user-query-for-export';

export function setLastChatExportPrecinctIds(ids: string[]): void {
  if (typeof sessionStorage === 'undefined') return;
  if (ids.length > 0) {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  }
}

export function getLastChatExportPrecinctIds(): string[] {
  if (typeof sessionStorage === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as string[]).filter(Boolean) : [];
  } catch {
    return [];
  }
}

/** True for short follow-ups like "export to csv" (no new filter). */
export function isExportOnlyUserMessage(q: string): boolean {
  const t = q.trim().toLowerCase();
  if (t.length >= 200) return false;
  if (!/^(export|download|save)\b/i.test(t)) return false;
  if (/\b(show|find|list|which|where|margin|swing|lean|rank)\b/i.test(t)) return false;
  return true;
}

/** Remember last non-export user message so export can re-resolve IDs if storage was empty. */
export function setLastUserQueryForExport(q: string): void {
  if (typeof sessionStorage === 'undefined') return;
  const t = q.trim();
  if (!t) return;
  if (isExportOnlyUserMessage(t)) return;
  sessionStorage.setItem(LAST_USER_QUERY_KEY, t);
}

export function getLastUserQueryForExport(): string {
  if (typeof sessionStorage === 'undefined') return '';
  return sessionStorage.getItem(LAST_USER_QUERY_KEY) || '';
}
