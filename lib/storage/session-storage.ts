import { openDB, IDBPDatabase } from 'idb';

/**
 * Schema for the session object stored in IndexedDB.
 */
export interface StoredSession {
  /** Composite key: `${userId}::${sessionId}` */
  key: string;
  /** User that owns the session */
  userId: string;
  /** Unique session ID */
  sessionId: string;
  /** Arbitrary session payload (messages, metadata, etc.) */
  data: any;
  /** Last updated timestamp */
  updatedAt: number;
}

const DEFAULT_DB_NAME = 'mpiQChatDB';
const DEFAULT_STORE_NAME = 'sessions';

/**
 * Wrapper around IndexedDB for chat session persistence with a graceful
 * fallback to `localStorage` when IndexedDB isn't available (SSR or private
 * browsing contexts).
 */
export class SessionStorage {
  private dbPromise: Promise<IDBPDatabase | null>;

  constructor(
    private dbName: string = DEFAULT_DB_NAME,
    private storeName: string = DEFAULT_STORE_NAME
  ) {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      // Running on the server or IndexedDB unavailable – fallback to localStorage only
      this.dbPromise = Promise.resolve(null);
    } else {
      this.dbPromise = openDB(this.dbName, 1, {
        upgrade: (db) => {
          if (!db.objectStoreNames.contains(this.storeName)) {
            db.createObjectStore(this.storeName, { keyPath: 'key' });
          }
        },
      });
    }
  }

  /** Generate composite key combining userId and sessionId */
  private static makeKey(userId: string, sessionId: string): string {
    return `${userId}::${sessionId}`;
  }

  /* -------------------------------------------------------------------------- */
  /*                            Public API Methods                              */
  /* -------------------------------------------------------------------------- */

  /**
   * Persist or update a session record.
   */
  async saveSession(userId: string, sessionId: string, data: any): Promise<void> {
    const key = SessionStorage.makeKey(userId, sessionId);
    const record: StoredSession = {
      key,
      userId,
      sessionId,
      data,
      updatedAt: Date.now(),
    };

    // Attempt IndexedDB first
    try {
      const db = await this.dbPromise;
      if (db) {
        await db.put(this.storeName, record);
        return;
      }
    } catch (err) {
      console.warn('[SessionStorage] IndexedDB save failed, falling back to localStorage', err);
    }

    // Fallback to localStorage
    try {
      window.localStorage.setItem(key, JSON.stringify(record));
    } catch (err) {
      console.error('[SessionStorage] localStorage save failed', err);
    }
  }

  /**
   * Retrieve a session record.
   */
  async getSession<T = any>(userId: string, sessionId: string): Promise<T | null> {
    const key = SessionStorage.makeKey(userId, sessionId);

    // Try IndexedDB
    try {
      const db = await this.dbPromise;
      if (db) {
        const record = (await db.get(this.storeName, key)) as StoredSession | undefined;
        return record ? (record.data as T) : null;
      }
    } catch (err) {
      console.warn('[SessionStorage] IndexedDB get failed, falling back to localStorage', err);
    }

    // Fallback to localStorage
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as StoredSession).data : null;
    } catch (err) {
      console.error('[SessionStorage] localStorage get failed', err);
      return null;
    }
  }

  /**
   * Delete a single session.
   */
  async deleteSession(userId: string, sessionId: string): Promise<void> {
    const key = SessionStorage.makeKey(userId, sessionId);
    try {
      const db = await this.dbPromise;
      if (db) await db.delete(this.storeName, key);
    } catch (err) {
      console.warn('[SessionStorage] IndexedDB delete failed', err);
    }

    try {
      window.localStorage.removeItem(key);
    } catch (_) {
      /* ignore */
    }
  }

  /**
   * List all session IDs for a user.
   */
  async listSessions(userId: string): Promise<string[]> {
    const prefix = `${userId}::`;
    const ids: string[] = [];

    // Try IndexedDB
    try {
      const db = await this.dbPromise;
      if (db) {
        let cursor = await db.transaction(this.storeName).store.openCursor();
        while (cursor) {
          if (cursor.key.toString().startsWith(prefix)) {
            ids.push(cursor.value.sessionId);
          }
          cursor = await cursor.continue();
        }
        return ids;
      }
    } catch (err) {
      console.warn('[SessionStorage] IndexedDB list failed, falling back to localStorage', err);
    }

    // Fallback to localStorage keys
    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          const [, sessionId] = key.split('::');
          ids.push(sessionId);
        }
      }
    } catch (err) {
      console.error('[SessionStorage] localStorage list failed', err);
    }

    return ids;
  }

  /**
   * Clear **all** session data for a user.
   */
  async clearAllSessions(userId: string): Promise<void> {
    const sessions = await this.listSessions(userId);
    await Promise.all(sessions.map((id) => this.deleteSession(userId, id)));
  }
} 