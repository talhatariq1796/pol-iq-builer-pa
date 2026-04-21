/**
 * ComparisonHistoryStore - Manages saved comparison history in localStorage
 */

export interface SavedComparison {
  id: string;
  leftEntityId: string;
  rightEntityId: string;
  leftEntityName: string;
  rightEntityName: string;
  boundaryType: string;
  savedAt: string;
}

const STORAGE_KEY = 'comparison_history';
const MAX_HISTORY_ITEMS = 10;

/**
 * Get all saved comparisons from localStorage
 */
export function getComparisonHistory(): SavedComparison[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const history = JSON.parse(stored) as SavedComparison[];
    // Sort by savedAt descending (most recent first)
    return history.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
  } catch (error) {
    console.error('[ComparisonHistoryStore] Error reading history:', error);
    return [];
  }
}

/**
 * Save a new comparison to history
 */
export function saveComparison(
  leftEntityId: string,
  rightEntityId: string,
  leftEntityName: string,
  rightEntityName: string,
  boundaryType: string
): SavedComparison {
  const newEntry: SavedComparison = {
    id: Date.now().toString(),
    leftEntityId,
    rightEntityId,
    leftEntityName,
    rightEntityName,
    boundaryType,
    savedAt: new Date().toISOString(),
  };

  const history = getComparisonHistory();

  // Check if this exact comparison already exists (regardless of left/right order)
  const isDuplicate = history.some(
    (item) =>
      item.boundaryType === boundaryType &&
      ((item.leftEntityId === leftEntityId && item.rightEntityId === rightEntityId) ||
        (item.leftEntityId === rightEntityId && item.rightEntityId === leftEntityId))
  );

  if (isDuplicate) {
    // Remove the old entry and add the new one to update timestamp
    const filtered = history.filter(
      (item) =>
        !(
          item.boundaryType === boundaryType &&
          ((item.leftEntityId === leftEntityId && item.rightEntityId === rightEntityId) ||
            (item.leftEntityId === rightEntityId && item.rightEntityId === leftEntityId))
        )
    );
    const updated = [newEntry, ...filtered].slice(0, MAX_HISTORY_ITEMS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } else {
    // Add new entry
    const updated = [newEntry, ...history].slice(0, MAX_HISTORY_ITEMS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }

  return newEntry;
}

/**
 * Delete a saved comparison by ID
 */
export function deleteComparison(id: string): void {
  const history = getComparisonHistory();
  const filtered = history.filter((item) => item.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

/**
 * Clear all saved comparisons
 */
export function clearComparisonHistory(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Get a specific comparison by ID
 */
export function getComparisonById(id: string): SavedComparison | null {
  const history = getComparisonHistory();
  return history.find((item) => item.id === id) || null;
}
