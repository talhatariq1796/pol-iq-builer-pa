import {
  SESSION_CONFIG,
  SessionState,
  SessionMetadata,
  generateSessionId,
  isSessionExpired,
  SessionTrigger
} from '@/config/chat-memory-config';
import { ConversationMemory } from '@/components/common/conversation-memory';

export type QueryClassification = 'follow-up' | 'new-analysis';

export interface SessionDecision {
  classification: QueryClassification;
  isNewSession: boolean;
  sessionId: string;
  shouldClearContext: boolean;
  sessionAction: 'continue' | 'start-new' | 'timeout-restart';
  trigger?: SessionTrigger;
}

export class ChatSessionManager {
  private currentSession: SessionState | null = null;
  private conversationMemory: ConversationMemory;

  constructor(conversationMemory?: ConversationMemory) {
    this.conversationMemory = conversationMemory || new ConversationMemory();
  }

  /**
   * Handle a new query and determine session action
   */
  async handleNewQuery(
    query: string,
    conversationHistory: string,
    persona?: string,
    analysisType?: string,
    userId?: string
  ): Promise<SessionDecision> {
    try {
      // Check for session timeout first
      if (this.currentSession && isSessionExpired(this.currentSession.lastActivity)) {
        console.log(`[SessionManager] Session expired: ${this.currentSession.sessionId}`);
        return this.createSessionDecision('new-analysis', 'timeout-restart', analysisType, userId);
      }

      // Classify the query
      const classification = await this.classifyQuery(query, conversationHistory);

      if (classification === 'new-analysis') {
        return this.createSessionDecision(classification, 'start-new', analysisType, userId);
      } else {
        // Follow-up: continue current session or start new if none exists
        if (!this.currentSession) {
          return this.createSessionDecision('new-analysis', 'start-new', analysisType, userId);
        }
        return this.createSessionDecision(classification, 'continue', analysisType, userId);
      }
    } catch (error) {
      console.error('[SessionManager] Error handling query:', error);
      // Fallback to new session on error
      return this.createSessionDecision('new-analysis', 'start-new', analysisType, userId);
    }
  }

  /**
   * Classify query using the existing API
   */
  private async classifyQuery(query: string, conversationHistory: string): Promise<QueryClassification> {
    try {
      const response = await fetch(SESSION_CONFIG.CLASSIFICATION_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, conversationHistory }),
      });

      if (!response.ok) {
        throw new Error(`Classification API failed: ${response.status}`);
      }

      const result = await response.json();
      const classification = result.classification as QueryClassification;
      console.log(`[SessionManager] Query classified as: ${classification}`);
      return classification;
    } catch (error) {
      console.error('[SessionManager] Query classification failed:', error);
      // Default to new-analysis on error to be safe
      return 'new-analysis';
    }
  }

  /**
   * Create a session decision object
   */
  private createSessionDecision(
    classification: QueryClassification,
    action: 'continue' | 'start-new' | 'timeout-restart',
    analysisType?: string,
    userId?: string
  ): SessionDecision {
    let sessionId: string;
    let shouldClearContext: boolean;
    let trigger: SessionTrigger | undefined;

    switch (action) {
      case 'start-new':
        sessionId = this.startNewSession(analysisType, userId);
        shouldClearContext = true;
        trigger = classification === 'new-analysis' ? 'new-analysis' : undefined;
        break;

      case 'timeout-restart':
        sessionId = this.startNewSession(analysisType, userId);
        shouldClearContext = true;
        trigger = 'timeout';
        break;

      case 'continue':
        sessionId = this.continueCurrentSession();
        shouldClearContext = false;
        break;

      default:
        sessionId = this.startNewSession(analysisType, userId);
        shouldClearContext = true;
    }

    return {
      classification,
      isNewSession: action !== 'continue',
      sessionId,
      shouldClearContext,
      sessionAction: action,
      trigger
    };
  }

  /**
   * Start a new session
   */
  private startNewSession(analysisType?: string, userId?: string): string {
    // Generate user-scoped session ID
    const sessionId = generateSessionId(userId);

    // Clear the conversation memory and start fresh
    this.conversationMemory.clear();

    // Create our session state
    this.currentSession = {
      sessionId,
      startTime: Date.now(),
      lastActivity: Date.now(),
      messageCount: 0,
      classification: 'new-analysis',
      analysisType,
      userId, // Store user ID in session
      activePersona: 'strategist', // Default persona
      analysisContext: {
        type: analysisType || 'unknown',
        metrics: [],
        regions: [],
        lastResults: null
      }
    };

    console.log(`[SessionManager] Started new session: ${sessionId} for user: ${userId || 'anonymous'}`);
    return sessionId;
  }

  /**
   * Continue the current session
   */
  private continueCurrentSession(): string {
    if (!this.currentSession) {
      throw new Error('No current session to continue');
    }

    this.currentSession.lastActivity = Date.now();
    this.currentSession.classification = 'follow-up';
    this.currentSession.messageCount++;

    console.log(`[SessionManager] Continuing session: ${this.currentSession.sessionId}`);
    return this.currentSession.sessionId;
  }

  /**
   * Manually clear the current session
   */
  public clearCurrentSession(): SessionDecision {
    if (this.currentSession) {
      console.log(`[SessionManager] Manually clearing session: ${this.currentSession.sessionId}`);
      this.conversationMemory.clear();
    }

    this.currentSession = null;

    // Return a decision indicating session was cleared (but don't start new one yet)
    return {
      classification: 'new-analysis',
      isNewSession: true,
      sessionId: '', // Will be set when next session starts
      shouldClearContext: true,
      sessionAction: 'start-new',
      trigger: 'manual-clear'
    };
  }

  /**
   * Update session context with analysis results
   */
  public updateSessionContext(
    metrics: string[],
    regions: string[],
    results?: any,
    persona?: string
  ): void {
    if (!this.currentSession) return;

    this.currentSession.analysisContext.metrics = metrics;
    this.currentSession.analysisContext.regions = regions;
    if (results) {
      this.currentSession.analysisContext.lastResults = results;
    }
    if (persona) {
      this.currentSession.activePersona = persona;
    }

    console.log(`[SessionManager] Updated session context for: ${this.currentSession.sessionId}`);
  }

  /**
   * Get current session state
   */
  public getCurrentSession(): SessionState | null {
    return this.currentSession ? { ...this.currentSession } : null;
  }

  /**
   * Get session metadata only
   */
  public getSessionMetadata(): SessionMetadata | null {
    if (!this.currentSession) return null;

    return {
      sessionId: this.currentSession.sessionId,
      startTime: this.currentSession.startTime,
      lastActivity: this.currentSession.lastActivity,
      messageCount: this.currentSession.messageCount,
      classification: this.currentSession.classification,
      analysisType: this.currentSession.analysisType
    };
  }

  /**
   * Check if current session is active and valid
   */
  public isSessionActive(): boolean {
    return this.currentSession !== null && !isSessionExpired(this.currentSession.lastActivity);
  }

  /**
   * Get session duration in minutes
   */
  public getSessionDuration(): number {
    if (!this.currentSession) return 0;
    return Math.floor((Date.now() - this.currentSession.startTime) / (1000 * 60));
  }

  /**
   * Export session state for persistence
   */
  public exportSession(): {
    currentSession: SessionState | null;
    conversationMemory: any;
  } {
    return {
      currentSession: this.currentSession,
      conversationMemory: this.conversationMemory.export()
    };
  }

  /**
   * Import session state from persistence
   */
  public importSession(data: {
    currentSession?: SessionState | null;
    conversationMemory?: any;
  }): void {
    this.currentSession = data.currentSession || null;
    if (data.conversationMemory) {
      this.conversationMemory.import(data.conversationMemory);
    }
  }

  /**
   * Get conversation memory instance
   */
  public getConversationMemory(): ConversationMemory {
    return this.conversationMemory;
  }
} 