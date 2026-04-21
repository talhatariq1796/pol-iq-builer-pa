import { SessionDecision } from '@/lib/chat/session-manager';

/** Types of analytics events we capture */
export type SessionAnalyticsEvent =
  | {
      type: 'session_start';
      userId: string;
      sessionId: string;
      classification: 'new-analysis' | 'follow-up';
      timestamp: number;
    }
  | {
      type: 'session_end';
      userId: string;
      sessionId: string;
      durationMs: number;
      messageCount: number;
      timestamp: number;
    }
  | {
      type: 'classification';
      userId: string;
      sessionId: string;
      classification: 'new-analysis' | 'follow-up';
      confidence?: number;
      timestamp: number;
    };

/**
 * Very lightweight analytics manager.
 * In production this could forward events to a backend or telemetry service.
 */
class SessionAnalyticsManager {
  private queue: SessionAnalyticsEvent[] = [];

  track(event: SessionAnalyticsEvent) {
    this.queue.push(event);
    // For now we simply log; replace with real transport later.
    if (process.env.NODE_ENV !== 'test') {
      // eslint-disable-next-line no-console
      console.log('[Analytics]', event);
    }
  }

  /** Convenience helpers */
  trackDecision(userId: string, decision: SessionDecision) {
    this.track({
      type: 'classification',
      userId,
      sessionId: decision.sessionId,
      classification: decision.classification,
      timestamp: Date.now(),
    });
    if (decision.isNewSession) {
      this.track({
        type: 'session_start',
        userId,
        sessionId: decision.sessionId,
        classification: decision.classification,
        timestamp: Date.now(),
      });
    }
  }
}

export const sessionAnalytics = new SessionAnalyticsManager(); 