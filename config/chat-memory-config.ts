export const MEMORY_CONFIG = {
  MAX_MEMORY_MESSAGES: 50,
  SUMMARIZE_THRESHOLD: 15,
  CONTEXT_BADGE_COLOR: '#33a852',
  STORAGE_KEY: 'mpiQ_conversation_memory',
  PERSONA_STORAGE_KEY: 'mpiQ_selected_persona',
  SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes
  USER_SCOPE_ENABLED: true, // Enable user-scoped sessions
  FALLBACK_USER_ID: 'anonymous', // Fallback when no user ID available
};

export const SESSION_CONFIG = {
  CLASSIFICATION_API: '/api/classify-query',
  NEW_SESSION_TRIGGERS: ['new-analysis', 'manual-clear', 'timeout'] as const,
  PRESERVE_ACROSS_SESSIONS: ['persona', 'ui-preferences'] as const,
  SESSION_ID_PREFIX: 'session_',
  SESSION_STORAGE_KEY: 'mpiQ_current_session',
  USER_SESSION_PREFIX: 'user_', // Prefix for user-scoped storage
};

export type SessionTrigger = typeof SESSION_CONFIG.NEW_SESSION_TRIGGERS[number];
export type PreserveItem = typeof SESSION_CONFIG.PRESERVE_ACROSS_SESSIONS[number];

// Session state interfaces
export interface SessionMetadata {
  sessionId: string;
  startTime: number;
  lastActivity: number;
  messageCount: number;
  classification: 'follow-up' | 'new-analysis';
  analysisType?: string;
  userId?: string; // Track which user owns this session
}

export interface SessionState extends SessionMetadata {
  activePersona: string;
  analysisContext: {
    type: string;
    metrics: string[];
    regions: string[];
    lastResults?: any;
  };
}

// User-scoped storage utilities
export function getUserScopedKey(baseKey: string, userId?: string): string {
  if (!MEMORY_CONFIG.USER_SCOPE_ENABLED || !userId) {
    return baseKey;
  }
  return `${SESSION_CONFIG.USER_SESSION_PREFIX}${userId}_${baseKey}`;
}

export function getCurrentUserId(): string | null {
  // Try to get user ID from various sources
  if (typeof window === 'undefined') return null;

  // 1. Check URL parameters (e.g., ?userId=123)
  const urlParams = new URLSearchParams(window.location.search);
  const urlUserId = urlParams.get('userId');
  if (urlUserId) return urlUserId;

  // 2. Check session storage for temporary user ID
  const sessionUserId = sessionStorage.getItem('mpiQ_user_id');
  if (sessionUserId) return sessionUserId;

  // 3. Check localStorage for persistent user ID
  const persistentUserId = localStorage.getItem('mpiQ_persistent_user_id');
  if (persistentUserId) return persistentUserId;

  // 4. Generate and store a browser-session unique ID
  const generatedId = generateBrowserSessionId();
  sessionStorage.setItem('mpiQ_user_id', generatedId);
  return generatedId;
}

export function generateBrowserSessionId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const browserFingerprint = getBrowserFingerprint();
  return `browser_${timestamp}_${random}_${browserFingerprint}`;
}

function getBrowserFingerprint(): string {
  if (typeof window === 'undefined') return 'server';
  
  // Create a simple browser fingerprint
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx?.fillText('fingerprint', 10, 10);
  const canvasFingerprint = canvas.toDataURL().slice(-10);
  
  const fingerprint = [
    navigator.userAgent.slice(-10),
    screen.width,
    screen.height,
    new Date().getTimezoneOffset(),
    canvasFingerprint
  ].join('');
  
  // Hash to shorter string
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36).substring(0, 6);
}

export function setUserId(userId: string, persistent: boolean = false): void {
  if (typeof window === 'undefined') return;
  
  sessionStorage.setItem('mpiQ_user_id', userId);
  
  if (persistent) {
    localStorage.setItem('mpiQ_persistent_user_id', userId);
  }
}

export function clearUserSession(): void {
  if (typeof window === 'undefined') return;
  
  sessionStorage.removeItem('mpiQ_user_id');
  // Note: We don't clear persistent user ID on logout
}

// Memory configuration validation
export function validateMemoryConfig(): boolean {
  return (
    MEMORY_CONFIG.MAX_MEMORY_MESSAGES > 0 &&
    MEMORY_CONFIG.SUMMARIZE_THRESHOLD > 0 &&
    MEMORY_CONFIG.SUMMARIZE_THRESHOLD <= MEMORY_CONFIG.MAX_MEMORY_MESSAGES &&
    MEMORY_CONFIG.SESSION_TIMEOUT > 0
  );
}

// Session ID generation with user scope
export function generateSessionId(userId?: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  const userPrefix = userId ? `${userId.substring(0, 8)}_` : '';
  return `${SESSION_CONFIG.SESSION_ID_PREFIX}${userPrefix}${timestamp}_${random}`;
}

// Session timeout check
export function isSessionExpired(lastActivity: number): boolean {
  return Date.now() - lastActivity > MEMORY_CONFIG.SESSION_TIMEOUT;
} 