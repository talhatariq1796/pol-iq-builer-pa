import { AnalysisState, StateSubscriber, ProcessingStep, DeepPartial } from './types';

/**
 * StateManager - Central state management for the AnalysisEngine
 * 
 * Replaces scattered state management across multiple components
 * with a single, predictable state store.
 */
export class StateManager {
  private state: AnalysisState;
  private subscribers: StateSubscriber[] = [];

  constructor() {
    this.state = this.initializeState();
  }

  /**
   * Update state with partial updates
   */
  updateState(updates: DeepPartial<AnalysisState>): void {
    this.state = this.mergeState(this.state, updates);
    this.notifySubscribers();
  }

  /**
   * Get current state (returns copy to prevent mutations)
   */
  getState(): AnalysisState {
    return JSON.parse(JSON.stringify(this.state));
  }

  /**
   * Subscribe to state changes
   */
  subscribe(callback: StateSubscriber): () => void {
    this.subscribers.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  /**
   * Reset state to initial values
   */
  reset(): void {
    this.state = this.initializeState();
    this.notifySubscribers();
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private initializeState(): AnalysisState {
    const defaultState: AnalysisState = {
      currentAnalysis: null,
      currentVisualization: null,
      processingStatus: {
        isProcessing: false,
        currentStep: null,
        progress: 0
      },
      errorState: null,
      lastQuery: null,
      selectedEndpoint: undefined,
      history: []
    };
    return defaultState;
  }

  private notifySubscribers(): void {
    const currentState = this.getState();
    this.subscribers.forEach(callback => {
      try {
        callback(currentState);
      } catch (error) {
        console.error('[StateManager] Error notifying subscriber:', error);
      }
    });
  }

  private mergeState(current: AnalysisState, updates: DeepPartial<AnalysisState>): AnalysisState {
    const merged = { ...current };
    
    for (const key in updates) {
      const updateValue = updates[key as keyof AnalysisState];
      if (updateValue !== undefined) {
        if (typeof updateValue === 'object' && updateValue !== null && !Array.isArray(updateValue)) {
          // Deep merge for objects
          merged[key as keyof AnalysisState] = {
            ...((current[key as keyof AnalysisState] as any) || {}),
            ...updateValue
          } as any;
        } else {
          // Direct assignment for primitives and arrays
          merged[key as keyof AnalysisState] = updateValue as any;
        }
      }
    }
    
    return merged;
  }
} 