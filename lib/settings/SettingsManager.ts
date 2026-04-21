/**
 * Settings Manager - Phase 17.1
 *
 * Singleton manager for application settings with LocalStorage persistence.
 * Handles loading, saving, migration, and change notifications.
 */

import type {
  AllSettings,
  SettingsCategory,
  SettingsChangeEvent,
  PersistedSettings,
  CampaignState,
  CampaignPhase,
} from './types';
import { SETTINGS_VERSION, SETTINGS_STORAGE_KEY } from './types';
import { DEFAULT_SETTINGS, cloneSettings } from './defaults';

// =============================================================================
// Types
// =============================================================================

type SettingsListener = (event: SettingsChangeEvent) => void;
type CategoryListener<K extends SettingsCategory> = (settings: AllSettings[K]) => void;

// =============================================================================
// Settings Manager Singleton
// =============================================================================

let instance: SettingsManager | null = null;

export class SettingsManager {
  private settings: AllSettings;
  private listeners: Map<string, Set<SettingsListener>>;
  private categoryListeners: Map<SettingsCategory, Set<CategoryListener<SettingsCategory>>>;
  private initialized: boolean = false;

  private constructor() {
    this.settings = cloneSettings(DEFAULT_SETTINGS);
    this.listeners = new Map();
    this.categoryListeners = new Map();
  }

  /**
   * Get singleton instance.
   */
  static getInstance(): SettingsManager {
    if (!instance) {
      instance = new SettingsManager();
    }
    return instance;
  }

  /**
   * Initialize settings from storage.
   * Should be called once on app startup.
   */
  initialize(): void {
    if (this.initialized) return;

    try {
      this.loadFromStorage();
    } catch (error) {
      console.warn('[SettingsManager] Failed to load settings, using defaults:', error);
      this.settings = cloneSettings(DEFAULT_SETTINGS);
    }

    this.initialized = true;
  }

  // ===========================================================================
  // Getters
  // ===========================================================================

  /**
   * Get all settings.
   */
  getAll(): AllSettings {
    return cloneSettings(this.settings);
  }

  /**
   * Get settings for a specific category.
   */
  get<K extends SettingsCategory>(category: K): AllSettings[K] {
    return cloneSettings(this.settings[category]);
  }

  /**
   * Get a specific setting value.
   */
  getValue<K extends SettingsCategory, V extends keyof AllSettings[K]>(
    category: K,
    key: V
  ): AllSettings[K][V] {
    return this.settings[category][key];
  }

  // ===========================================================================
  // Setters
  // ===========================================================================

  /**
   * Update a single setting.
   */
  set<K extends SettingsCategory, V extends keyof AllSettings[K]>(
    category: K,
    key: V,
    value: AllSettings[K][V]
  ): void {
    const oldValue = this.settings[category][key];
    if (JSON.stringify(oldValue) === JSON.stringify(value)) {
      return; // No change
    }

    this.settings[category][key] = value;
    this.saveToStorage();

    const event: SettingsChangeEvent = {
      category,
      key: key as string,
      oldValue,
      newValue: value,
      timestamp: new Date(),
    };

    this.notifyListeners(event);
  }

  /**
   * Update multiple settings in a category.
   */
  updateCategory<K extends SettingsCategory>(
    category: K,
    updates: Partial<AllSettings[K]>
  ): void {
    const oldSettings = cloneSettings(this.settings[category]);
    let hasChanges = false;

    for (const [key, value] of Object.entries(updates)) {
      const typedKey = key as keyof AllSettings[K];
      if (JSON.stringify(this.settings[category][typedKey]) !== JSON.stringify(value)) {
        (this.settings[category] as unknown as Record<string, unknown>)[key] = value;
        hasChanges = true;

        const event: SettingsChangeEvent = {
          category,
          key,
          oldValue: oldSettings[typedKey],
          newValue: value,
          timestamp: new Date(),
        };

        this.notifyListeners(event);
      }
    }

    if (hasChanges) {
      this.saveToStorage();
      this.notifyCategoryListeners(category);
    }
  }

  /**
   * Reset a category to defaults.
   */
  resetCategory<K extends SettingsCategory>(category: K): void {
    this.settings[category] = cloneSettings(DEFAULT_SETTINGS[category]);
    this.saveToStorage();
    this.notifyCategoryListeners(category);
  }

  /**
   * Reset all settings to defaults.
   */
  resetAll(): void {
    this.settings = cloneSettings(DEFAULT_SETTINGS);
    this.saveToStorage();

    // Notify all category listeners
    for (const category of Object.keys(this.settings) as SettingsCategory[]) {
      this.notifyCategoryListeners(category);
    }
  }

  // ===========================================================================
  // Persistence
  // ===========================================================================

  /**
   * Load settings from LocalStorage.
   */
  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;

    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!stored) return;

    const persisted: PersistedSettings = JSON.parse(stored);

    // Handle version migrations
    if (persisted.version < SETTINGS_VERSION) {
      this.migrateSettings(persisted);
    } else {
      this.settings = this.mergeWithDefaults(persisted.settings);
    }
  }

  /**
   * Save settings to LocalStorage.
   */
  private saveToStorage(): void {
    if (typeof window === 'undefined') return;

    const persisted: PersistedSettings = {
      version: SETTINGS_VERSION,
      lastModified: new Date().toISOString(),
      settings: this.settings,
    };

    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(persisted));
  }

  /**
   * Merge stored settings with defaults to handle new fields.
   */
  private mergeWithDefaults(stored: Partial<AllSettings>): AllSettings {
    const merged = cloneSettings(DEFAULT_SETTINGS);

    for (const category of Object.keys(stored) as SettingsCategory[]) {
      if (stored[category]) {
        // Use Object.assign to avoid TypeScript's strict type checking on spread
        Object.assign(merged[category], stored[category]);
      }
    }

    return merged;
  }

  /**
   * Migrate settings from older versions.
   */
  private migrateSettings(persisted: PersistedSettings): void {
    // Version 1 is current, no migrations needed yet
    // Future migrations go here:
    // if (persisted.version < 2) { ... }

    this.settings = this.mergeWithDefaults(persisted.settings);
    this.saveToStorage(); // Save with new version
  }

  // ===========================================================================
  // Listeners
  // ===========================================================================

  /**
   * Subscribe to all settings changes.
   */
  subscribe(listener: SettingsListener): () => void {
    const key = 'all';
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(listener);

    return () => {
      this.listeners.get(key)?.delete(listener);
    };
  }

  /**
   * Subscribe to changes in a specific category.
   */
  subscribeToCategory<K extends SettingsCategory>(
    category: K,
    listener: CategoryListener<K>
  ): () => void {
    if (!this.categoryListeners.has(category)) {
      this.categoryListeners.set(category, new Set());
    }
    this.categoryListeners.get(category)!.add(listener as CategoryListener<SettingsCategory>);

    return () => {
      this.categoryListeners.get(category)?.delete(listener as CategoryListener<SettingsCategory>);
    };
  }

  private notifyListeners(event: SettingsChangeEvent): void {
    this.listeners.get('all')?.forEach(listener => listener(event));
  }

  private notifyCategoryListeners<K extends SettingsCategory>(category: K): void {
    this.categoryListeners.get(category)?.forEach(listener => {
      listener(this.settings[category]);
    });
  }

  // ===========================================================================
  // Campaign State Computation
  // ===========================================================================

  /**
   * Compute current campaign state from settings.
   */
  getCampaignState(): CampaignState {
    const campaign = this.settings.campaign;
    const now = new Date();

    // Parse dates
    const generalDate = new Date(campaign.generalElectionDate);
    const primaryDate = campaign.primaryDate ? new Date(campaign.primaryDate) : null;

    // Calculate days
    const daysUntilElection = Math.ceil(
      (generalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    const daysUntilPrimary = primaryDate
      ? Math.ceil((primaryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    // Determine current phase
    const currentPhase = this.determinePhase(daysUntilElection, daysUntilPrimary, campaign.forcePhase);

    // Gather upcoming deadlines
    const upcomingDeadlines = this.getUpcomingDeadlines(campaign, now);

    // Find next deadline
    const nextDeadline = upcomingDeadlines.length > 0 ? upcomingDeadlines[0] : null;

    // Calculate phase progress (rough estimate)
    const phaseProgress = this.calculatePhaseProgress(currentPhase, daysUntilElection);

    return {
      currentPhase,
      daysUntilElection,
      daysUntilPrimary,
      nextDeadline,
      upcomingDeadlines,
      phaseProgress,
    };
  }

  private determinePhase(
    daysUntilElection: number,
    daysUntilPrimary: number | null,
    forcePhase: CampaignPhase | 'auto'
  ): CampaignPhase {
    if (forcePhase !== 'auto') {
      return forcePhase;
    }

    // Check if primary is upcoming
    if (daysUntilPrimary !== null && daysUntilPrimary > 0) {
      if (daysUntilPrimary <= 14) {
        return 'primary_gotv';
      }
      return 'pre_primary';
    }

    // General election phases
    if (daysUntilElection <= 0) {
      return 'post_election';
    }
    if (daysUntilElection <= 14) {
      return 'general_gotv';
    }
    if (daysUntilElection <= 45) {
      return 'general_persuasion';
    }
    if (daysUntilElection <= 120) {
      return 'general_id';
    }

    // Post-primary, pre-general
    return 'general_id';
  }

  private getUpcomingDeadlines(
    campaign: typeof this.settings.campaign,
    now: Date
  ): CampaignState['upcomingDeadlines'] {
    const deadlines: CampaignState['upcomingDeadlines'] = [];

    // Standard deadlines
    const standardDeadlines = [
      { name: 'Voter Registration', date: campaign.voterRegistrationDeadline },
      { name: 'Early Voting Starts', date: campaign.earlyVotingStart },
      { name: 'Early Voting Ends', date: campaign.earlyVotingEnd },
      { name: 'Absentee Request', date: campaign.absenteeRequestDeadline },
      { name: 'Primary Election', date: campaign.primaryDate },
      { name: 'General Election', date: campaign.generalElectionDate },
    ];

    for (const { name, date } of standardDeadlines) {
      if (!date) continue;
      const deadlineDate = new Date(date);
      const daysRemaining = Math.ceil(
        (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysRemaining > 0) {
        deadlines.push({
          name,
          date: deadlineDate,
          daysRemaining,
          isUrgent: daysRemaining <= 7,
        });
      }
    }

    // Custom deadlines
    for (const custom of campaign.customDeadlines) {
      const deadlineDate = new Date(custom.date);
      const daysRemaining = Math.ceil(
        (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysRemaining > 0) {
        deadlines.push({
          name: custom.name,
          date: deadlineDate,
          daysRemaining,
          isUrgent: daysRemaining <= 7,
        });
      }
    }

    // Sort by date
    return deadlines.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  private calculatePhaseProgress(phase: CampaignPhase, daysUntilElection: number): number {
    // Rough progress estimates based on typical phase durations
    switch (phase) {
      case 'general_gotv':
        return Math.min(100, Math.max(0, ((14 - daysUntilElection) / 14) * 100));
      case 'general_persuasion':
        return Math.min(100, Math.max(0, ((45 - daysUntilElection) / 31) * 100));
      case 'general_id':
        return Math.min(100, Math.max(0, ((120 - daysUntilElection) / 75) * 100));
      case 'post_election':
        return 100;
      default:
        return 50; // Midpoint for other phases
    }
  }

  // ===========================================================================
  // Import/Export
  // ===========================================================================

  /**
   * Export settings as JSON string.
   */
  exportSettings(): string {
    const persisted: PersistedSettings = {
      version: SETTINGS_VERSION,
      lastModified: new Date().toISOString(),
      settings: this.settings,
    };
    return JSON.stringify(persisted, null, 2);
  }

  /**
   * Import settings from JSON string.
   */
  importSettings(json: string): boolean {
    try {
      const persisted: PersistedSettings = JSON.parse(json);

      // Validate structure
      if (!persisted.settings || typeof persisted.settings !== 'object') {
        throw new Error('Invalid settings structure');
      }

      // Merge with defaults to handle missing fields
      this.settings = this.mergeWithDefaults(persisted.settings);
      this.saveToStorage();

      // Notify all listeners
      for (const category of Object.keys(this.settings) as SettingsCategory[]) {
        this.notifyCategoryListeners(category);
      }

      return true;
    } catch (error) {
      console.error('[SettingsManager] Failed to import settings:', error);
      return false;
    }
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get the settings manager singleton.
 */
export function getSettingsManager(): SettingsManager {
  const manager = SettingsManager.getInstance();
  manager.initialize();
  return manager;
}

/**
 * Quick access to get a setting value.
 */
export function getSetting<K extends SettingsCategory, V extends keyof AllSettings[K]>(
  category: K,
  key: V
): AllSettings[K][V] {
  return getSettingsManager().getValue(category, key);
}

/**
 * Quick access to get campaign state.
 */
export function getCampaignState(): CampaignState {
  return getSettingsManager().getCampaignState();
}
