/**
 * LocalStorage-based persistence for canvassing universes
 *
 * Manages saving, loading, and deleting canvassing universes from browser localStorage.
 * Handles SSR safety and error handling for all storage operations.
 */

import type { CanvassingUniverse } from './types';

const STORAGE_KEY = 'pol_canvassing_universes';

/**
 * Store for managing canvassing universes with localStorage persistence
 */
export class CanvassingStore {
  /**
   * Check if localStorage is available (SSR safety)
   */
  private isStorageAvailable(): boolean {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
  }

  /**
   * Get all saved universes from localStorage
   */
  getAll(): CanvassingUniverse[] {
    if (!this.isStorageAvailable()) {
      return [];
    }

    try {
      const json = localStorage.getItem(STORAGE_KEY);
      if (!json) return [];
      return JSON.parse(json) as CanvassingUniverse[];
    } catch (error) {
      console.error('Error loading canvassing universes from localStorage:', error);
      return [];
    }
  }

  /**
   * Get a universe by ID
   */
  get(id: string): CanvassingUniverse | null {
    const universes = this.getAll();
    return universes.find(u => u.id === id) || null;
  }

  /**
   * Save a universe (create or update)
   */
  save(universe: CanvassingUniverse): void {
    if (!this.isStorageAvailable()) {
      throw new Error('localStorage is not available');
    }

    try {
      const universes = this.getAll();
      const existingIndex = universes.findIndex(u => u.id === universe.id);

      if (existingIndex >= 0) {
        // Update existing
        universes[existingIndex] = {
          ...universe,
          updatedAt: new Date().toISOString(),
        };
      } else {
        // Create new
        universes.push(universe);
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(universes));
    } catch (error) {
      console.error('Error saving canvassing universe to localStorage:', error);
      throw new Error('Failed to save canvassing universe');
    }
  }

  /**
   * Delete a universe by ID
   */
  delete(id: string): void {
    if (!this.isStorageAvailable()) {
      throw new Error('localStorage is not available');
    }

    try {
      const universes = this.getAll();
      const filtered = universes.filter(u => u.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error deleting canvassing universe from localStorage:', error);
      throw new Error('Failed to delete canvassing universe');
    }
  }

  /**
   * Check if a universe name already exists
   */
  exists(name: string, excludeId?: string): boolean {
    const universes = this.getAll();
    return universes.some(u => u.name === name && u.id !== excludeId);
  }

  /**
   * Get universe count
   */
  getCount(): number {
    return this.getAll().length;
  }

  /**
   * Clear all universes (with caution)
   */
  clearAll(): void {
    if (!this.isStorageAvailable()) {
      throw new Error('localStorage is not available');
    }

    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing canvassing universes from localStorage:', error);
      throw new Error('Failed to clear canvassing universes');
    }
  }

  /**
   * Export all universes to JSON string
   */
  exportToJSON(): string {
    const universes = this.getAll();
    return JSON.stringify(universes, null, 2);
  }

  /**
   * Import universes from JSON string
   */
  importFromJSON(json: string): CanvassingUniverse[] {
    try {
      const imported = JSON.parse(json) as CanvassingUniverse[];

      // Validate structure
      if (!Array.isArray(imported)) {
        throw new Error('Invalid format: expected array of universes');
      }

      // Save each universe
      imported.forEach(universe => {
        if (!universe.id || !universe.name || !universe.precincts) {
          throw new Error('Invalid universe structure');
        }
        this.save(universe);
      });

      return imported;
    } catch (error) {
      console.error('Error importing canvassing universes:', error);
      throw new Error('Failed to import universes: ' + (error as Error).message);
    }
  }

  /**
   * Get universes sorted by creation date (newest first)
   */
  getAllSorted(): CanvassingUniverse[] {
    const universes = this.getAll();
    return universes.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA; // Newest first
    });
  }

  /**
   * Get universes by segment ID
   */
  getBySegmentId(segmentId: string): CanvassingUniverse[] {
    const universes = this.getAll();
    return universes.filter(u => u.segmentId === segmentId);
  }

  /**
   * Duplicate a universe with a new name
   */
  duplicate(id: string, newName: string): CanvassingUniverse | null {
    const original = this.get(id);
    if (!original) return null;

    const duplicated: CanvassingUniverse = {
      ...original,
      id: `canv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: newName,
      createdAt: new Date().toISOString(),
      updatedAt: undefined,
    };

    this.save(duplicated);
    return duplicated;
  }
}

/**
 * Singleton instance for global use
 */
export const canvassingStore = new CanvassingStore();
