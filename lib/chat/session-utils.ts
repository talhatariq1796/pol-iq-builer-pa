import { SessionStorage, StoredSession } from '@/lib/storage/session-storage';
import { ChatSessionManager } from '@/lib/chat/session-manager';

export interface MergeOptions {
  /** If true, keep source session after merge */
  keepSource?: boolean;
  /** Merge strategy for messages: concat | source-first | target-first */
  messageStrategy?: 'concat' | 'source-first' | 'target-first';
}

/** Merge two sessions together */
export async function mergeSessions(
  store: SessionStorage,
  userId: string,
  sourceSessionId: string,
  targetSessionId: string,
  options: MergeOptions = {}
): Promise<void> {
  const source = await store.getSession<StoredSession['data']>(userId, sourceSessionId);
  const target = await store.getSession<StoredSession['data']>(userId, targetSessionId);
  if (!source || !target) throw new Error('Source or target session not found');

  const sourceMessages = source.messages ?? [];
  const targetMessages = target.messages ?? [];
  let merged: any[];
  switch (options.messageStrategy) {
    case 'source-first':
      merged = [...sourceMessages, ...targetMessages];
      break;
    case 'target-first':
      merged = [...targetMessages, ...sourceMessages];
      break;
    default:
      merged = [...targetMessages, ...sourceMessages].sort((a, b) => a.timestamp - b.timestamp);
  }

  await store.saveSession(userId, targetSessionId, {
    ...target,
    messages: merged,
    mergedFrom: [...(target.mergedFrom ?? []), sourceSessionId],
  });

  if (!options.keepSource) {
    await store.deleteSession(userId, sourceSessionId);
  }
}

/** Bridge context from a previous session into the current session manager */
export async function bridgeContext(
  store: SessionStorage,
  manager: ChatSessionManager,
  userId: string,
  previousSessionId: string,
  maxMessages: number = 10
) {
  const prev = await store.getSession<any>(userId, previousSessionId);
  if (!prev || !prev.messages) return;
  const msgs = prev.messages.slice(-maxMessages);
  const memory = manager.getConversationMemory();
  msgs.forEach((m: any) => {
    memory.addMessage({ role: m.role, content: m.content }, m.persona);
  });
  manager.updateSessionContext([], []); // trigger metadata update
}

/** Retrieve session history summaries for a user */
export async function listSessionHistory(
  store: SessionStorage,
  userId: string
): Promise<{ sessionId: string; start: number; end: number; messageCount: number }[]> {
  const ids = await store.listSessions(userId);
  const summaries: any[] = [];
  for (const id of ids) {
    const data = await store.getSession<any>(userId, id);
    if (data) {
      summaries.push({
        sessionId: id,
        start: data.messages?.[0]?.timestamp ?? 0,
        end: data.messages?.[data.messages.length - 1]?.timestamp ?? 0,
        messageCount: data.messages?.length ?? 0,
      });
    }
  }
  return summaries.sort((a, b) => b.start - a.start);
} 