'use client';

/**
 * HelpDialog - Reusable help dialog component
 *
 * Provides a consistent help experience across all pages with
 * customizable content sections and AI-powered question answering.
 */

import { ReactNode, useState, useRef, useEffect } from 'react';
import { getTourSteps, TOUR_STEP_COUNTS, type TourTheme } from '@/lib/tour/tourConfig';
import { driver, type Driver } from 'driver.js';
import { DEFAULT_TOUR_CONFIG } from '@/lib/tour/tourConfig';

// Section types for structured help content
export interface HelpSection {
  id: string;
  title: string;
  icon?: ReactNode;
  content: ReactNode;
}

/** Workflow tutorial definition */
export interface WorkflowTutorial {
  theme: TourTheme;
  label: string;
  description: string;
}

export interface HelpDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  sections: HelpSection[];
  footerText?: string;
  /** Tool context for AI help (e.g., 'segments', 'donors') */
  toolContext?: string;
  /** Enable AI-powered question input */
  enableAIHelp?: boolean;
  /** Workflow tutorials to show for this page */
  tutorials?: WorkflowTutorial[];
}

// Pre-built icons for common section types
export const HelpIcons = {
  Question: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Info: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Lightbulb: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  ),
  Controls: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
    </svg>
  ),
  Chat: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
    </svg>
  ),
  List: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
  ),
  Map: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
  ),
  Filter: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
    </svg>
  ),
  Chart: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  Users: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  Dollar: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Route: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
  ),
  Compare: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
    </svg>
  ),
  Graph: (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <circle cx="10" cy="10" r="6" />
    </svg>
  ),
  Arrow: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
    </svg>
  ),
};

// Help button component for headers
export function HelpButton({ onClick, className = '' }: { onClick: () => void; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={`p-2 text-slate-500 hover:text-[#33a852] hover:bg-[#33a852]/10 rounded-lg transition-colors ${className}`}
      title="Help & Instructions"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </button>
  );
}

export function HelpDialog({
  isOpen,
  onClose,
  title,
  subtitle,
  sections,
  footerText = "Got it, let's go!",
  toolContext,
  enableAIHelp = true,
  tutorials,
}: HelpDialogProps) {
  const [question, setQuestion] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showAISection, setShowAISection] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const responseRef = useRef<HTMLDivElement>(null);
  const driverRef = useRef<Driver | null>(null);

  // Start a workflow tutorial
  const startTutorial = (theme: TourTheme) => {
    const steps = getTourSteps(theme);
    const validSteps = steps.filter((step) => {
      if (!step.element) return true;
      const el = document.querySelector(step.element as string);
      return el !== null;
    });

    if (validSteps.length === 0) {
      console.warn('[HelpDialog] No valid tour steps found for theme:', theme);
      return;
    }

    // Close the help dialog first
    onClose();

    // Small delay to let dialog close
    setTimeout(() => {
      if (driverRef.current) {
        driverRef.current.destroy();
      }

      driverRef.current = driver({
        ...DEFAULT_TOUR_CONFIG,
        steps: validSteps,
        onDestroyed: () => {
          driverRef.current = null;
        },
      });

      driverRef.current.drive();
    }, 300);
  };

  // Cleanup driver on unmount
  useEffect(() => {
    return () => {
      if (driverRef.current) {
        driverRef.current.destroy();
      }
    };
  }, []);

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setQuestion('');
      setAiResponse(null);
      setShowAISection(false);
    }
  }, [isOpen]);

  // Scroll to response when it appears
  useEffect(() => {
    if (aiResponse && responseRef.current) {
      responseRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [aiResponse]);

  const handleAskQuestion = async () => {
    if (!question.trim()) return;

    setIsLoading(true);
    setAiResponse(null);

    try {
      // Build context-aware help prompt
      const helpContext = toolContext
        ? `The user is on the ${toolContext} tool page. `
        : '';

      const systemPrompt = `You are a helpful assistant for a political analysis platform. ${helpContext}Answer the user's question about how to use the tool concisely and helpfully. Focus on practical guidance. Keep responses under 150 words.`;

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: question }
          ],
          stream: false,
        }),
      });

      if (!response.ok) throw new Error('Failed to get response');

      const data = await response.json();
      setAiResponse(data.content || data.message || 'Sorry, I could not generate a response.');
    } catch (error) {
      console.error('[HelpDialog] AI error:', error);
      setAiResponse('Sorry, I encountered an error. Please try the AI chat panel on the left side of the page for more help.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAskQuestion();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#33a852] to-[#2d9944] px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{title}</h2>
              {subtitle && <p className="text-white/80 text-sm">{subtitle}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors p-1"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {sections.map((section, index) => (
            <section key={section.id} className={index < sections.length - 1 ? 'mb-6' : ''}>
              <h3 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#33a852]/10 text-[#33a852] flex items-center justify-center text-sm">
                  {section.icon || HelpIcons.Info}
                </span>
                {section.title}
              </h3>
              <div className="text-sm text-slate-600">
                {section.content}
              </div>
            </section>
          ))}

          {/* Tutorials Section */}
          {tutorials && tutorials.length > 0 && (
            <section className="mt-6 pt-6 border-t border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
                Interactive Tutorials
              </h3>
              <p className="text-sm text-slate-500 mb-3">
                Step-by-step walkthroughs that guide you through common tasks.
              </p>
              <div className="grid gap-2">
                {tutorials.map((tutorial) => {
                  const stepCount = TOUR_STEP_COUNTS[tutorial.theme];
                  return (
                    <button
                      key={tutorial.theme}
                      onClick={() => startTutorial(tutorial.theme)}
                      className="flex items-center justify-between p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors text-left group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center transition-colors">
                          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          </svg>
                        </div>
                        <div>
                          <div className="font-medium text-slate-800">{tutorial.label}</div>
                          <div className="text-xs text-slate-500">{tutorial.description}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span>{stepCount} steps</span>
                        <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* AI Help Section */}
          {enableAIHelp && (
            <section className="mt-6 pt-6 border-t border-slate-200" ref={responseRef}>
              {!showAISection ? (
                <button
                  onClick={() => {
                    setShowAISection(true);
                    setTimeout(() => inputRef.current?.focus(), 100);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors text-slate-600 hover:text-slate-800"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium">Have a specific question? Ask AI</span>
                </button>
              ) : (
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[#33a852]/10 text-[#33a852] flex items-center justify-center text-sm">
                      {HelpIcons.Chat}
                    </span>
                    Ask AI
                  </h3>

                  {/* Input */}
                  <div className="flex gap-2">
                    <input
                      ref={inputRef}
                      type="text"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="How do I create a voter segment?"
                      className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33a852]/50 focus:border-[#33a852] text-sm"
                      disabled={isLoading}
                    />
                    <button
                      onClick={handleAskQuestion}
                      disabled={isLoading || !question.trim()}
                      className="px-4 py-2 bg-[#33a852] text-white rounded-lg hover:bg-[#2d9944] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isLoading ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                      )}
                    </button>
                  </div>

                  {/* Response */}
                  {aiResponse && (
                    <div className="bg-[#33a852]/5 border border-[#33a852]/20 rounded-lg p-4">
                      <div className="flex items-start gap-2">
                        <div className="w-6 h-6 rounded-full bg-[#33a852] flex items-center justify-center flex-shrink-0 mt-0.5">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                          {aiResponse}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Suggestion chips */}
                  {!aiResponse && !isLoading && (
                    <div className="flex flex-wrap gap-2">
                      {[
                        'How do I get started?',
                        'What can the AI do?',
                        'How do I export data?',
                      ].map((suggestion) => (
                        <button
                          key={suggestion}
                          onClick={() => {
                            setQuestion(suggestion);
                            setTimeout(() => handleAskQuestion(), 100);
                          }}
                          className="px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 rounded-full text-slate-600 transition-colors"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-6 py-4 bg-slate-50 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-[#33a852] text-white rounded-lg hover:bg-[#2d9944] transition-colors font-medium"
          >
            {footerText}
          </button>
        </div>
      </div>
    </div>
  );
}

// Pre-built content helpers
export const HelpContent = {
  // Numbered tip list
  TipList: ({ tips }: { tips: string[] }) => (
    <ul className="space-y-2">
      {tips.map((tip, i) => (
        <li key={i} className="flex items-start gap-2">
          <span className="text-[#33a852] mt-0.5 font-medium">{i + 1}.</span>
          <span>{tip}</span>
        </li>
      ))}
    </ul>
  ),

  // Bulleted list
  BulletList: ({ items }: { items: string[] }) => (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i}>• {item}</li>
      ))}
    </ul>
  ),

  // Grid of controls
  ControlsGrid: ({ controls }: { controls: { action: string; description: string }[] }) => (
    <div className="bg-slate-50 rounded-lg p-4">
      <div className="grid grid-cols-2 gap-3">
        {controls.map((control, i) => (
          <div key={i}>
            <p className="font-medium text-slate-700">{control.action}</p>
            <p className="text-slate-500">{control.description}</p>
          </div>
        ))}
      </div>
    </div>
  ),

  // AI example queries
  AIExamples: ({ examples }: { examples: string[] }) => (
    <div className="bg-[#33a852]/5 border border-[#33a852]/20 rounded-lg p-4">
      <p className="text-slate-700 mb-3">The AI assistant can help you. Try asking:</p>
      <ul className="text-slate-600 space-y-1">
        {examples.map((ex, i) => (
          <li key={i}>&quot;{ex}&quot;</li>
        ))}
      </ul>
    </div>
  ),

  // Color-coded legend
  ColorLegend: ({ items }: { items: { color: string; label: string; description: string }[] }) => (
    <div className="grid grid-cols-2 gap-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2 p-2 bg-slate-50 rounded">
          <div className={`w-3 h-3 rounded-full ${item.color}`}></div>
          <span><strong>{item.label}</strong> - {item.description}</span>
        </div>
      ))}
    </div>
  ),

  // Simple paragraph
  Paragraph: ({ children }: { children: ReactNode }) => (
    <p className="leading-relaxed">{children}</p>
  ),

  // Key-value definitions
  Definitions: ({ items }: { items: { term: string; definition: string }[] }) => (
    <div className="space-y-1">
      {items.map((item, i) => (
        <p key={i}><strong>{item.term}</strong> - {item.definition}</p>
      ))}
    </div>
  ),
};

export default HelpDialog;
