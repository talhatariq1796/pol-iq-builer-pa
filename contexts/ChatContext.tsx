'use client';

import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { ConversationMemory, MemoryMessage } from '@/components/common/conversation-memory';

interface PersistedMemory {
  messages: MemoryMessage[];
  summaries: any[];
}

interface ChatContextType {
  addMessage: (message: { role: 'user' | 'assistant' | 'system'; content: string;[key: string]: any }) => void;
  contextSummary: string;
  refreshContextSummary: () => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [contextSummary, setContextSummary] = useState('');

  const memoryRef = useRef<ConversationMemory>(new ConversationMemory({ maxMessages: 50, summarizeThreshold: 10 }));

  // Load persisted memory
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('mpiQ_conversation_memory');
      if (raw) {
        const parsed: PersistedMemory = JSON.parse(raw);
        memoryRef.current.import(parsed);
        // Pre-compute summary into state
        const formatted = memoryRef.current.getFormattedContext({ recentMessagesCount: 3 });
        setContextSummary(formatted);
      }
    } catch (e) {
      console.warn('[ChatContext] failed to restore memory', e);
    }
  }, []);

  // Persist on change
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const interval = setInterval(() => {
      try {
        const data = memoryRef.current.export();
        localStorage.setItem('mpiQ_conversation_memory', JSON.stringify(data));
      } catch { }
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const callSummarizationApi = async (): Promise<string | null> => {
    try {
      const res = await fetch('/api/summarize-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: memoryRef.current.getMessages() }),
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json.summary as string;
    } catch (e) {
      console.warn('[ChatContext] summarize-context failed', e);
      return null;
    }
  };

  const refreshContextSummary = async (): Promise<void> => {
    const summary = await callSummarizationApi();
    if (summary) {
      memoryRef.current.addSummary(summary);
      setContextSummary(summary);
    }
  };

  const addMessage = (message: { role: 'user' | 'assistant' | 'system'; content: string;[key: string]: any }) => {
    memoryRef.current.addMessage({ role: message.role, content: message.content });
    // Trigger summarization if threshold reached
    if (memoryRef.current.getMessages().length % 10 === 0) {
      refreshContextSummary();
    }
  };

  return (
    <ChatContext.Provider value={{ addMessage, contextSummary, refreshContextSummary }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
} 