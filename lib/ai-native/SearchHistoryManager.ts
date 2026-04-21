/**
 * Search History Manager
 *
 * Manages recent AI queries in localStorage for quick access.
 * Supports filtering by tool context and deduplication.
 */

const STORAGE_KEY = 'pol_recent_searches';
const MAX_HISTORY_SIZE = 10;

export interface SearchHistoryEntry {
  query: string;
  timestamp: string;
  tool?: string; // Optional tool context (segments, donors, canvass, etc.)
}

/**
 * Manages search history for AI queries
 */
export class SearchHistoryManager {
  private storageAvailable: boolean = true;

  constructor() {
    // Check localStorage availability
    try {
      localStorage.setItem('__test__', 'test');
      localStorage.removeItem('__test__');
    } catch {
      this.storageAvailable = false;
      console.warn('[SearchHistoryManager] localStorage not available');
    }
  }

  /**
   * Add a query to search history
   * Deduplicates (case-insensitive) and maintains max size
   */
  add(query: string, tool?: string): void {
    if (!this.storageAvailable) return;

    // Skip empty queries or very short ones
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 3) return;

    try {
      const history = this.getAll();

      // Remove existing duplicate (case-insensitive)
      const filteredHistory = history.filter(
        entry => entry.query.toLowerCase() !== trimmedQuery.toLowerCase()
      );

      // Add new entry at the beginning
      const newEntry: SearchHistoryEntry = {
        query: trimmedQuery,
        timestamp: new Date().toISOString(),
        tool,
      };

      filteredHistory.unshift(newEntry);

      // Trim to max size
      const trimmedHistory = filteredHistory.slice(0, MAX_HISTORY_SIZE);

      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedHistory));
    } catch (error) {
      console.warn('[SearchHistoryManager] Failed to save search:', error);
    }
  }

  /**
   * Get all search history entries
   * Optionally filter by tool context
   */
  getAll(tool?: string): SearchHistoryEntry[] {
    if (!this.storageAvailable) return [];

    try {
      const json = localStorage.getItem(STORAGE_KEY);
      if (!json) return [];

      const history = JSON.parse(json) as SearchHistoryEntry[];

      if (tool) {
        return history.filter(entry => !entry.tool || entry.tool === tool);
      }

      return history;
    } catch (error) {
      console.warn('[SearchHistoryManager] Failed to read search history:', error);
      return [];
    }
  }

  /**
   * Get recent searches (last N entries)
   */
  getRecent(count: number = 5, tool?: string): SearchHistoryEntry[] {
    return this.getAll(tool).slice(0, count);
  }

  /**
   * Remove a specific entry by query text
   */
  remove(query: string): void {
    if (!this.storageAvailable) return;

    try {
      const history = this.getAll();
      const filtered = history.filter(
        entry => entry.query.toLowerCase() !== query.toLowerCase()
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.warn('[SearchHistoryManager] Failed to remove search:', error);
    }
  }

  /**
   * Clear all search history
   */
  clear(): void {
    if (!this.storageAvailable) return;

    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.warn('[SearchHistoryManager] Failed to clear search history:', error);
    }
  }

  /**
   * Get formatted time ago string
   */
  static formatTimeAgo(timestamp: string): string {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return then.toLocaleDateString();
  }
}

// Singleton instance
let instance: SearchHistoryManager | null = null;

/**
 * Get the singleton SearchHistoryManager instance
 */
export function getSearchHistoryManager(): SearchHistoryManager {
  if (!instance) {
    instance = new SearchHistoryManager();
  }
  return instance;
}
