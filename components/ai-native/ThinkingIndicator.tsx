'use client';

import { useState, useEffect } from 'react';
import { Bot, Search, BarChart3, MapPin, Users, DollarSign, TrendingUp, Layers } from 'lucide-react';

/**
 * Query context types for contextual thinking messages
 */
export type QueryContext =
  | 'swing'           // Swing/competitive precincts
  | 'gotv'            // GOTV/turnout analysis
  | 'demographics'    // Demographics/population
  | 'comparison'      // Comparing areas
  | 'donors'          // Donor/fundraising
  | 'canvassing'      // Canvassing/field ops
  | 'targeting'       // Voter targeting
  | 'tapestry'        // Lifestyle segments
  | 'general';        // Default/unknown

/**
 * Message sets for different query contexts
 */
const CONTEXT_MESSAGES: Record<QueryContext, string[]> = {
  swing: [
    'Analyzing competitive precincts...',
    'Calculating swing potential scores...',
    'Reviewing historical voting patterns...',
    'Identifying persuadable areas...',
    'Assessing margin volatility...',
  ],
  gotv: [
    'Calculating GOTV priority scores...',
    'Analyzing turnout potential...',
    'Identifying mobilization targets...',
    'Estimating voter contact impact...',
    'Ranking precincts by turnout opportunity...',
  ],
  demographics: [
    'Querying demographic data...',
    'Analyzing population characteristics...',
    'Reviewing census indicators...',
    'Processing age and income data...',
    'Aggregating community profiles...',
  ],
  comparison: [
    'Comparing area characteristics...',
    'Analyzing demographic differences...',
    'Calculating metric deltas...',
    'Identifying key distinctions...',
    'Building comparison summary...',
  ],
  donors: [
    'Searching FEC contribution data...',
    'Analyzing donor patterns...',
    'Calculating giving concentrations...',
    'Identifying fundraising opportunities...',
    'Processing donor segments...',
  ],
  canvassing: [
    'Calculating doors per precinct...',
    'Estimating volunteer hours...',
    'Analyzing geographic clusters...',
    'Optimizing canvassing routes...',
    'Building field operation plan...',
  ],
  targeting: [
    'Calculating targeting scores...',
    'Analyzing voter segments...',
    'Prioritizing outreach areas...',
    'Building voter universe...',
    'Scoring persuasion opportunity...',
  ],
  tapestry: [
    'Analyzing lifestyle segments...',
    'Reviewing Tapestry profiles...',
    'Identifying dominant segments...',
    'Mapping psychographic patterns...',
    'Building segment summary...',
  ],
  general: [
    'Analyzing your question...',
    'Searching precinct data...',
    'Processing electoral metrics...',
    'Preparing response...',
    'Gathering relevant insights...',
  ],
};

/**
 * Detect query context from user input
 */
export function detectQueryContext(query: string): QueryContext {
  const q = query.toLowerCase();

  // Check for specific keywords
  if (q.includes('swing') || q.includes('competitive') || q.includes('toss-up') || q.includes('margin')) {
    return 'swing';
  }
  if (q.includes('gotv') || q.includes('turnout') || q.includes('mobiliz') || q.includes('get out the vote')) {
    return 'gotv';
  }
  if (q.includes('demograph') || q.includes('population') || q.includes('age') || q.includes('income') || q.includes('education')) {
    return 'demographics';
  }
  if (q.includes('compare') || q.includes('vs') || q.includes('versus') || q.includes('difference') || q.includes('differ')) {
    return 'comparison';
  }
  if (q.includes('donor') || q.includes('fundrais') || q.includes('contribut') || q.includes('fec') || q.includes('giving')) {
    return 'donors';
  }
  if (q.includes('canvass') || q.includes('door') || q.includes('volunteer') || q.includes('knock') || q.includes('field')) {
    return 'canvassing';
  }
  if (q.includes('target') || q.includes('persuad') || q.includes('universe') || q.includes('segment')) {
    return 'targeting';
  }
  if (q.includes('tapestry') || q.includes('lifestyle') || q.includes('psychograph')) {
    return 'tapestry';
  }

  return 'general';
}

/**
 * Get icon for query context
 */
function getContextIcon(context: QueryContext) {
  switch (context) {
    case 'swing':
      return TrendingUp;
    case 'gotv':
      return Users;
    case 'demographics':
      return BarChart3;
    case 'comparison':
      return Layers;
    case 'donors':
      return DollarSign;
    case 'canvassing':
      return MapPin;
    case 'targeting':
      return Search;
    case 'tapestry':
      return Users;
    default:
      return Search;
  }
}

interface ThinkingIndicatorProps {
  /** Query context for contextual messages */
  context?: QueryContext;
  /** Custom initial message (optional) */
  initialMessage?: string;
  /** Interval between message changes (ms) */
  interval?: number;
  /** Show compact version (just dots + message) */
  compact?: boolean;
}

/**
 * ThinkingIndicator - Animated loading indicator with rotating contextual messages
 *
 * Shows the user what the AI is working on while waiting for a response.
 * Messages rotate every few seconds and are contextual to the query type.
 */
export function ThinkingIndicator({
  context = 'general',
  initialMessage,
  interval = 2500,
  compact = false,
}: ThinkingIndicatorProps) {
  const messages = CONTEXT_MESSAGES[context];
  const [messageIndex, setMessageIndex] = useState(0);
  const [currentMessage, setCurrentMessage] = useState(initialMessage || messages[0]);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Rotate through messages
  useEffect(() => {
    const timer = setInterval(() => {
      setIsTransitioning(true);

      setTimeout(() => {
        setMessageIndex((prev: number) => {
          const next = (prev + 1) % messages.length;
          setCurrentMessage(messages[next]);
          return next;
        });
        setIsTransitioning(false);
      }, 150); // Fade out duration
    }, interval);

    return () => clearInterval(timer);
  }, [messages, interval]);

  const ContextIcon = getContextIcon(context);

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-gray-500">
        <div className="flex gap-1">
          <span className="w-2 h-2 bg-[#33a852] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-[#33a852] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-[#33a852] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        <span
          className={`text-sm transition-opacity duration-150 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}
        >
          {currentMessage}
        </span>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      {/* Bot avatar with pulse effect */}
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-[#33a852] to-[#2d8f47] flex items-center justify-center shadow-md animate-pulse">
        <Bot className="w-6 h-6 text-white" />
      </div>

      {/* Message card */}
      <div className="bg-gradient-to-br from-emerald-50 to-green-50 border-2 border-emerald-200 rounded-xl px-4 py-3 shadow-lg max-w-[85%] sm:max-w-xs">
        {/* Animated dots row */}
        <div className="flex items-center gap-3 mb-2.5">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 bg-[#33a852] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2.5 h-2.5 bg-[#33a852] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2.5 h-2.5 bg-[#33a852] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span className="text-xs text-emerald-700 uppercase tracking-wider font-semibold">AI Thinking</span>
        </div>

        {/* Contextual message with icon */}
        <div className="flex items-center gap-2.5">
          <ContextIcon className={`w-5 h-5 text-[#33a852] transition-opacity duration-150 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`} />
          <span
            className={`text-sm text-gray-700 font-medium transition-opacity duration-150 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}
          >
            {currentMessage}
          </span>
        </div>

        {/* Subtle progress bar - uses sliding animation */}
        <div className="mt-3 h-1.5 bg-emerald-100 rounded-full overflow-hidden relative">
          <div
            className="absolute h-full w-1/3 bg-gradient-to-r from-[#33a852] to-[#4ade80] rounded-full shadow-sm"
            style={{
              animation: 'progress-slide 1.5s ease-in-out infinite',
            }}
          />
        </div>
      </div>

      {/* Keyframes animation using a standard style tag */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes progress-slide {
            0% { transform: translateX(-100%); }
            50% { transform: translateX(200%); }
            100% { transform: translateX(-100%); }
          }
        `
      }} />
    </div>
  );
}

export default ThinkingIndicator;
