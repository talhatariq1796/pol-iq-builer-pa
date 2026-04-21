/**
 * Filter History Manager
 *
 * Manages undo/redo history for segment filter changes.
 * Supports keyboard shortcuts (Cmd+Z, Cmd+Shift+Z) and visual indicators.
 */

import type { ExtendedSegmentFilters } from './types';

const MAX_HISTORY_SIZE = 20;

export interface HistoryPosition {
  current: number;
  total: number;
  label: string;
}

/**
 * Manages filter change history for undo/redo functionality
 */
export class FilterHistoryManager {
  private history: ExtendedSegmentFilters[] = [];
  private currentIndex: number = -1;
  private isUndoRedoAction: boolean = false;

  /**
   * Push a new filter state to history
   * Called on every filter change (unless it's an undo/redo action)
   */
  push(filters: ExtendedSegmentFilters): void {
    // Don't record if this is an undo/redo action
    if (this.isUndoRedoAction) {
      this.isUndoRedoAction = false;
      return;
    }

    // If we're not at the end of history, truncate forward history
    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1);
    }

    // Deep clone the filters to prevent reference issues
    const filtersCopy = JSON.parse(JSON.stringify(filters));

    // Add to history
    this.history.push(filtersCopy);
    this.currentIndex = this.history.length - 1;

    // Trim history if it exceeds max size
    if (this.history.length > MAX_HISTORY_SIZE) {
      this.history = this.history.slice(this.history.length - MAX_HISTORY_SIZE);
      this.currentIndex = this.history.length - 1;
    }
  }

  /**
   * Undo to previous filter state
   * Returns the previous state or null if at beginning
   */
  undo(): ExtendedSegmentFilters | null {
    if (!this.canUndo()) {
      return null;
    }

    this.isUndoRedoAction = true;
    this.currentIndex--;

    // Return deep copy to prevent mutations
    return JSON.parse(JSON.stringify(this.history[this.currentIndex]));
  }

  /**
   * Redo to next filter state
   * Returns the next state or null if at end
   */
  redo(): ExtendedSegmentFilters | null {
    if (!this.canRedo()) {
      return null;
    }

    this.isUndoRedoAction = true;
    this.currentIndex++;

    // Return deep copy to prevent mutations
    return JSON.parse(JSON.stringify(this.history[this.currentIndex]));
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.currentIndex > 0;
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }

  /**
   * Get current position info for UI display
   * Returns null if history is empty
   */
  getPositionInfo(): HistoryPosition | null {
    if (this.history.length === 0) {
      return null;
    }

    return {
      current: this.currentIndex + 1,
      total: this.history.length,
      label: `Step ${this.currentIndex + 1} of ${this.history.length}`,
    };
  }

  /**
   * Get the current filter state without changing history
   */
  getCurrent(): ExtendedSegmentFilters | null {
    if (this.currentIndex < 0 || this.currentIndex >= this.history.length) {
      return null;
    }
    return JSON.parse(JSON.stringify(this.history[this.currentIndex]));
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.history = [];
    this.currentIndex = -1;
  }

  /**
   * Get history length (for debugging)
   */
  getHistoryLength(): number {
    return this.history.length;
  }
}

// Singleton instance
let instance: FilterHistoryManager | null = null;

/**
 * Get the singleton FilterHistoryManager instance
 */
export function getFilterHistoryManager(): FilterHistoryManager {
  if (!instance) {
    instance = new FilterHistoryManager();
  }
  return instance;
}

/**
 * Reset the singleton instance (useful for testing or page changes)
 */
export function resetFilterHistoryManager(): void {
  instance = new FilterHistoryManager();
}
