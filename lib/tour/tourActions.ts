/**
 * Tour Action Handlers
 *
 * These functions trigger app state changes during guided tour steps.
 * When a tour step highlights an element, the corresponding action
 * ensures the app is in the correct state for that step.
 *
 * Supports:
 * - Panel state (expand/collapse)
 * - AI session state (cards vs chat)
 * - Map commands (heatmaps, highlights, fly-to)
 * - AI queries (submit demo queries)
 * - Precinct selection (simulate clicks)
 */

import { getStateManager } from '@/lib/ai-native/ApplicationStateManager';
import type { MapCommand } from '@/components/ai-native/AIPoliticalSessionHost';

/**
 * Available tour actions that can be triggered during tour steps
 */
export type TourAction =
  // Panel state actions
  | 'expandAIPanel'
  | 'collapseAIPanel'
  | 'expandAnalysisPanel'
  | 'collapseAnalysisPanel'
  // AI session state actions
  | 'switchToActiveChat'
  | 'switchToWelcomeCards'
  | 'focusChatInput'
  | 'scrollChatToBottom'
  // Workflow actions
  | 'selectWorkflow'
  | 'clearSelection'
  // Map command actions
  | 'resetMap'           // Clear all layers, highlights, and reset to default view
  | 'showHeatmap'
  | 'showChoropleth'
  | 'highlightPrecincts'
  | 'clearHighlight'
  | 'flyToLocation'
  | 'zoomToExtent'
  // AI query actions
  | 'submitQuery'
  | 'typeInChat'
  // Feature selection actions
  | 'selectPrecinct'
  | 'showFeatureCard'
  // Navigation actions (for cross-tool tours)
  | 'navigateTo'
  // Legacy
  | 'showMapControls';

/**
 * Session state type for AI panel
 */
export type AISessionState = 'welcome' | 'active' | 'loading';

/**
 * Global tour state manager
 * Stores callbacks registered by page components
 */
interface TourCallbacks {
  // Panel state
  setLeftPanelCollapsed?: (collapsed: boolean) => void;
  setRightPanelCollapsed?: (collapsed: boolean) => void;
  // AI session state
  setSessionState?: (state: AISessionState) => void;
  focusChatInput?: () => void;
  scrollChatToBottom?: () => void;
  // Workflow selection
  selectWorkflow?: (workflowId: string) => void;
  // Map commands
  sendMapCommand?: (command: MapCommand) => void;
  // AI queries
  submitAIQuery?: (query: string) => void;
  typeInChatInput?: (text: string) => void;
  // Feature selection
  selectPrecinctById?: (precinctId: string) => void;
  showFeatureCardForPrecinct?: (precinctId: string) => void;
}

let tourCallbacks: TourCallbacks = {};

/**
 * Animated typewriter effect for chat input
 * Types text character by character with natural timing
 * Optionally auto-submits the form after typing completes
 * Works with both input and textarea elements
 */
/**
 * Disable/enable the tour Next button
 */
function setTourNextButtonEnabled(enabled: boolean): void {
  // driver.js uses .driver-popover-navigation-btns for its Next/Previous buttons
  // Find the Next button by looking for button text content
  const navBtns = document.querySelector('.driver-popover-navigation-btns');
  console.log('[setTourNextButtonEnabled] navBtns found:', !!navBtns);

  if (navBtns) {
    const buttons = navBtns.querySelectorAll('button');
    console.log('[setTourNextButtonEnabled] Found', buttons.length, 'buttons');

    buttons.forEach(btn => {
      const text = btn.textContent?.toLowerCase() || '';
      console.log('[setTourNextButtonEnabled] Button text:', text);

      if (text.includes('next')) {
        btn.disabled = !enabled;
        if (enabled) {
          btn.classList.remove('driver-popover-btn-disabled');
          btn.style.opacity = '1';
          btn.style.cursor = 'pointer';
        } else {
          btn.classList.add('driver-popover-btn-disabled');
          btn.style.opacity = '0.5';
          btn.style.cursor = 'wait';
        }
        console.log('[setTourNextButtonEnabled]', enabled ? 'Enabled' : 'Disabled', 'Next button');
      }
    });
  } else {
    console.log('[setTourNextButtonEnabled] No navigation buttons container found');
  }
}

/**
 * Show a loading indicator in the tour popover
 */
function showTourLoadingIndicator(show: boolean): void {
  const popover = document.querySelector('.driver-popover-description');
  if (!popover) return;

  const existingIndicator = popover.querySelector('.tour-loading-indicator');

  if (show && !existingIndicator) {
    const indicator = document.createElement('div');
    indicator.className = 'tour-loading-indicator';
    indicator.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; margin-top: 12px; padding: 8px; background: #f0f9ff; border-radius: 6px; border: 1px solid #bae6fd;">
        <div style="width: 16px; height: 16px; border: 2px solid #0ea5e9; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
        <span style="color: #0369a1; font-size: 13px;">Waiting for AI response...</span>
      </div>
      <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
    `;
    popover.appendChild(indicator);
  } else if (!show && existingIndicator) {
    existingIndicator.remove();
  }
}

/**
 * Wait for AI response after form submission
 * Waits until the input is re-enabled (processing complete) - no arbitrary timeout
 * Disables Next button and shows loading indicator while waiting
 */
/**
 * Legacy wait function - now a no-op since notifyTourAIResponseComplete
 * is called directly by the AI component when response is complete.
 * Kept for backwards compatibility with typewriterEffect.
 */
function waitForAIResponse(): Promise<void> {
  console.log('[waitForAIResponse] Called - notification will come from AI component');
  return Promise.resolve();
}

function typewriterEffect(
  element: HTMLInputElement | HTMLTextAreaElement,
  text: string,
  options?: {
    autoSubmit?: boolean;
    waitForResponse?: boolean;
    onComplete?: () => void;
  }
): void {
  console.log('[typewriterEffect] Starting to type:', text);
  console.log('[typewriterEffect] Element type:', element.tagName);
  console.log('[typewriterEffect] Element name:', element.name);
  console.log('[typewriterEffect] Parent form exists:', !!element.closest('form'));

  let index = 0;
  const baseDelay = 35; // Base delay between characters (ms)
  const variability = 15; // Random variability to feel more natural

  // Clear existing text and focus
  element.value = '';
  element.focus();

  function typeNextChar() {
    if (index < text.length) {
      const char = text[index];
      element.value += char;

      // Trigger React's onChange to update state
      // Use the appropriate prototype based on element type
      const prototype = element instanceof HTMLTextAreaElement
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
      const nativeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
      if (nativeValueSetter) {
        nativeValueSetter.call(element, element.value);
      }
      element.dispatchEvent(new Event('input', { bubbles: true }));

      index++;

      // Calculate delay - longer pauses after punctuation
      let delay = baseDelay + Math.random() * variability;
      if (char === '.' || char === '?' || char === '!') {
        delay += 150; // Pause after sentence end
      } else if (char === ',') {
        delay += 80; // Shorter pause after comma
      } else if (char === ' ') {
        delay += 20; // Tiny pause between words
      }

      setTimeout(typeNextChar, delay);
    } else {
      // Typing complete - optionally auto-submit
      console.log('[typewriterEffect] Typing complete, autoSubmit:', options?.autoSubmit);
      if (options?.autoSubmit) {
        // Brief pause before submit for visual effect
        setTimeout(async () => {
          const form = element.closest('form');
          console.log('[typewriterEffect] Found form:', !!form);
          if (form) {
            // Use requestSubmit() which properly triggers React's onSubmit handler
            console.log('[typewriterEffect] Calling form.requestSubmit()');
            form.requestSubmit();

            // Wait for AI response if requested (default true for tour demos)
            const shouldWait = options.waitForResponse !== false;
            if (shouldWait) {
              console.log('[typewriterEffect] Waiting for AI response...');
              await waitForAIResponse();
              console.log('[typewriterEffect] AI response complete or timeout');
            }
          }

          if (options.onComplete) {
            options.onComplete();
          }
        }, 300);
      } else if (options?.onComplete) {
        options.onComplete();
      }
    }
  }

  // Start typing
  typeNextChar();
}

/**
 * Register callbacks from page components
 * Called by the page component on mount to allow tour actions to control state
 */
export function registerTourCallbacks(callbacks: Partial<TourCallbacks>) {
  tourCallbacks = { ...tourCallbacks, ...callbacks };
  console.log('[TourActions] Callbacks registered:', Object.keys(callbacks));
}

/**
 * Unregister callbacks when component unmounts
 */
export function unregisterTourCallbacks() {
  tourCallbacks = {};
  console.log('[TourActions] Callbacks unregistered');
}

// Track if tour is waiting for AI response
let tourWaitingForResponse = false;

/**
 * Check if a step has actions that require waiting for AI response
 * If so, immediately disable the Next button and show loading indicator
 * This should be called at the START of a step, before actions execute with delays
 */
export function prepareStepForWait(actions: Array<{ action: TourAction; params?: Record<string, unknown>; delay?: number }>) {
  const hasWaitingAction = actions.some(a =>
    a.action === 'typeInChat' &&
    (a.params?.waitForResponse !== false)
  );

  if (hasWaitingAction) {
    console.log('[TourActions] prepareStepForWait - step has typeInChat with wait, disabling Next button immediately');
    tourWaitingForResponse = true;
    setTourNextButtonEnabled(false);
    showTourLoadingIndicator(true);
    return true;
  }
  return false;
}

/**
 * Called by AI component when a response is complete
 * This is the proper way to signal tour continuation - not polling
 */
export function notifyTourAIResponseComplete() {
  if (tourWaitingForResponse) {
    console.log('[TourActions] notifyTourAIResponseComplete - AI response done, enabling Next button');
    tourWaitingForResponse = false;
    setTourNextButtonEnabled(true);
    showTourLoadingIndicator(false);

    // Scroll chat to show the new AI response (last message, not feature card)
    setTimeout(() => {
      // Find all message bubbles and scroll to the last one
      const messages = document.querySelectorAll('[data-tour="ai-chat-panel"] .prose');
      if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        lastMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
        console.log('[TourActions] Scrolled to last AI message');
      }
    }, 200);
  }
}

/**
 * Check if tour is currently waiting for AI response
 */
export function isTourWaitingForResponse(): boolean {
  return tourWaitingForResponse;
}

/**
 * Execute a tour action
 * Called by GuidedTour when a step is highlighted
 */
export function executeTourAction(action: TourAction, params?: Record<string, unknown>) {
  console.log('[TourActions] Executing action:', action, params);
  console.log('[TourActions] Registered callbacks:', Object.keys(tourCallbacks));

  switch (action) {
    // =========================================================================
    // Panel State Actions
    // =========================================================================
    case 'expandAIPanel':
      console.log('[TourActions] expandAIPanel - callback exists:', !!tourCallbacks.setLeftPanelCollapsed);
      if (tourCallbacks.setLeftPanelCollapsed) {
        tourCallbacks.setLeftPanelCollapsed(false);
        console.log('[TourActions] expandAIPanel - called setLeftPanelCollapsed(false)');
      } else {
        console.error('[TourActions] expandAIPanel - callback not registered!');
      }
      break;

    case 'collapseAIPanel':
      if (tourCallbacks.setLeftPanelCollapsed) {
        tourCallbacks.setLeftPanelCollapsed(true);
      }
      break;

    case 'expandAnalysisPanel':
      if (tourCallbacks.setRightPanelCollapsed) {
        tourCallbacks.setRightPanelCollapsed(false);
      }
      break;

    case 'collapseAnalysisPanel':
      if (tourCallbacks.setRightPanelCollapsed) {
        tourCallbacks.setRightPanelCollapsed(true);
      }
      break;

    // =========================================================================
    // AI Session State Actions
    // =========================================================================
    case 'switchToActiveChat':
      console.log('[TourActions] switchToActiveChat - callback exists:', !!tourCallbacks.setSessionState);
      if (tourCallbacks.setSessionState) {
        tourCallbacks.setSessionState('active');
        console.log('[TourActions] switchToActiveChat - set session state to active');
      } else {
        console.error('[TourActions] switchToActiveChat - callback not registered!');
      }
      break;

    case 'switchToWelcomeCards':
      if (tourCallbacks.setSessionState) {
        tourCallbacks.setSessionState('welcome');
      }
      break;

    case 'focusChatInput':
      if (tourCallbacks.focusChatInput) {
        tourCallbacks.focusChatInput();
      } else {
        // Fallback: try to focus the element directly (textarea or input)
        const element = (
          document.querySelector('[data-tour="ai-chat-panel"] textarea[name="input"]') ||
          document.querySelector('[data-tour="ai-chat-panel"] input[name="input"]')
        ) as HTMLElement | null;
        if (element) {
          element.focus();
        }
      }
      break;

    case 'scrollChatToBottom':
      if (tourCallbacks.scrollChatToBottom) {
        tourCallbacks.scrollChatToBottom();
      } else {
        // Fallback: try to scroll directly
        const messagesEnd = document.querySelector('[data-tour="ai-chat-panel"] .messages-end');
        if (messagesEnd) {
          messagesEnd.scrollIntoView({ behavior: 'smooth' });
        }
      }
      break;

    // =========================================================================
    // Workflow Actions
    // =========================================================================
    case 'selectWorkflow':
      if (tourCallbacks.selectWorkflow && params?.workflowId) {
        tourCallbacks.selectWorkflow(params.workflowId as string);
      }
      break;

    case 'clearSelection':
      // Dispatch clear selection event to state manager
      const stateManager = getStateManager();
      stateManager.dispatch({
        type: 'FEATURE_DESELECTED',
        payload: {},
        timestamp: new Date(),
      });
      break;

    // =========================================================================
    // Map Command Actions
    // =========================================================================
    case 'resetMap':
      // Reset map to clean state: clear highlights, remove heatmap, show choropleth, reset zoom
      if (tourCallbacks.sendMapCommand) {
        // Clear any highlights first
        tourCallbacks.sendMapCommand({
          type: 'clearHighlight',
        });
        // Show default choropleth layer (clears heatmap)
        tourCallbacks.sendMapCommand({
          type: 'showChoropleth',
        });
        // Reset zoom to county extent
        tourCallbacks.sendMapCommand({
          type: 'zoom',
          zoom: 10,
        });
      }
      // Also clear any selected features from state
      const resetStateManager = getStateManager();
      resetStateManager.dispatch({
        type: 'FEATURE_DESELECTED',
        payload: {},
        timestamp: new Date(),
      });
      break;

    case 'showHeatmap':
      console.log('[TourActions] showHeatmap - params received:', JSON.stringify(params));
      console.log('[TourActions] showHeatmap - sendMapCommand callback exists:', !!tourCallbacks.sendMapCommand);
      if (tourCallbacks.sendMapCommand) {
        const metric = (params?.metric as string) || 'swing_potential';
        console.log('[TourActions] showHeatmap - resolved metric:', metric);
        const command = { type: 'showHeatmap' as const, metric };
        console.log('[TourActions] showHeatmap - sending command:', JSON.stringify(command));
        tourCallbacks.sendMapCommand(command);
        console.log('[TourActions] showHeatmap - command sent successfully');
      } else {
        console.error('[TourActions] showHeatmap - sendMapCommand callback not registered!');
        console.error('[TourActions] showHeatmap - registered callbacks are:', Object.keys(tourCallbacks));
      }
      break;

    case 'showChoropleth':
      if (tourCallbacks.sendMapCommand) {
        tourCallbacks.sendMapCommand({
          type: 'showChoropleth',
        });
      }
      break;

    case 'highlightPrecincts':
      if (tourCallbacks.sendMapCommand && params?.precincts) {
        const precincts = params.precincts as string[];
        tourCallbacks.sendMapCommand({
          type: 'highlight',
          target: precincts,
        });
      }
      break;

    case 'clearHighlight':
      if (tourCallbacks.sendMapCommand) {
        tourCallbacks.sendMapCommand({
          type: 'clearHighlight',
        });
      }
      break;

    case 'flyToLocation':
      if (tourCallbacks.sendMapCommand && params?.target) {
        tourCallbacks.sendMapCommand({
          type: 'flyTo',
          target: params.target as string,
        });
      }
      break;

    case 'zoomToExtent':
      if (tourCallbacks.sendMapCommand && params?.zoom) {
        tourCallbacks.sendMapCommand({
          type: 'zoom',
          zoom: params.zoom as number,
        });
      }
      break;

    // =========================================================================
    // AI Query Actions
    // =========================================================================
    case 'submitQuery':
      if (tourCallbacks.submitAIQuery && params?.query) {
        tourCallbacks.submitAIQuery(params.query as string);
      }
      break;

    case 'typeInChat':
      if (params?.text) {
        // Try textarea first (new format), then input (legacy)
        const element = (
          document.querySelector('[data-tour="ai-chat-panel"] textarea[name="input"]') ||
          document.querySelector('[data-tour="ai-chat-panel"] input[name="input"]')
        ) as HTMLInputElement | HTMLTextAreaElement | null;

        console.log('[TourActions] typeInChat - element found:', !!element);
        console.log('[TourActions] typeInChat - element disabled:', element?.disabled);

        // Default to waiting for AI response so user sees the result
        const autoSubmit = params.autoSubmit !== false;
        const waitForResponse = params.waitForResponse !== false;

        // IMMEDIATELY disable Next button and show loading when typeInChat starts
        // This prevents user from advancing before the AI responds
        if (waitForResponse) {
          setTourNextButtonEnabled(false);
          showTourLoadingIndicator(true);
          console.log('[TourActions] typeInChat - disabled Next button at start of action');
        }

        if (element) {
          // Check if element is disabled (isProcessing state)
          if (element.disabled) {
            console.warn('[TourActions] typeInChat - element is disabled, waiting...');
            // Wait for processing to complete and retry with max attempts
            let attempts = 0;
            const maxAttempts = 75; // 15 seconds max wait (75 * 200ms)
            const waitForEnabled = () => {
              attempts++;
              console.log('[TourActions] typeInChat - waitForEnabled attempt:', attempts, 'disabled:', element.disabled);
              if (!element.disabled) {
                console.log('[TourActions] typeInChat - element enabled, starting typewriter');
                typewriterEffect(element, params.text as string, { autoSubmit, waitForResponse });
              } else if (attempts >= maxAttempts) {
                console.error('[TourActions] typeInChat - gave up waiting after', attempts, 'attempts');
                // Force type anyway - user can see it even if disabled
                typewriterEffect(element, params.text as string, { autoSubmit, waitForResponse });
              } else {
                setTimeout(waitForEnabled, 200);
              }
            };
            waitForEnabled();
          } else {
            // Use animated typewriter effect for natural feel
            console.log('[TourActions] typeInChat - element ready, autoSubmit:', autoSubmit, 'waitForResponse:', waitForResponse);
            typewriterEffect(element, params.text as string, { autoSubmit, waitForResponse });
          }
        } else {
          console.error('[TourActions] typeInChat - no input element found!');
          console.error('[TourActions] typeInChat - looking for: [data-tour="ai-chat-panel"] textarea/input[name="input"]');
        }
      }
      break;

    // =========================================================================
    // Feature Selection Actions
    // =========================================================================
    case 'selectPrecinct':
      if (tourCallbacks.selectPrecinctById && params?.precinctId) {
        tourCallbacks.selectPrecinctById(params.precinctId as string);
      }
      break;

    case 'showFeatureCard':
      if (tourCallbacks.showFeatureCardForPrecinct && params?.precinctId) {
        tourCallbacks.showFeatureCardForPrecinct(params.precinctId as string);
      }
      break;

    // =========================================================================
    // Navigation Actions (Cross-Tool Tours)
    // =========================================================================
    case 'navigateTo':
      if (params?.path) {
        const path = params.path as string;
        const queryParams = params.queryParams as Record<string, string> | undefined;

        // Build URL with query parameters
        let url = path;
        if (queryParams && Object.keys(queryParams).length > 0) {
          const searchParams = new URLSearchParams();
          Object.entries(queryParams).forEach(([key, value]) => {
            searchParams.set(key, value);
          });
          url = `${path}?${searchParams.toString()}`;
        }

        console.log('[TourActions] Navigating to:', url);

        // Store tour continuation state in sessionStorage for cross-page tours
        if (params.continueTour) {
          const tourState = {
            theme: params.tourTheme as string,
            stepIndex: params.stepIndex as number,
            timestamp: Date.now(),
          };
          sessionStorage.setItem('tour_continuation', JSON.stringify(tourState));
        }

        // Use Next.js navigation if available, otherwise fallback to window.location
        if (typeof window !== 'undefined') {
          // Small delay to allow the user to see the current step before navigating
          setTimeout(() => {
            window.location.href = url;
          }, params.delay ? (params.delay as number) : 500);
        }
      }
      break;

    // =========================================================================
    // Legacy Actions
    // =========================================================================
    case 'showMapControls':
      // Map controls are always visible, this is a no-op
      break;

    default:
      console.warn('[TourActions] Unknown action:', action);
  }
}

/**
 * Execute multiple tour actions in sequence
 */
export function executeTourActions(actions: Array<{ action: TourAction; params?: Record<string, unknown>; delay?: number }>) {
  let totalDelay = 0;

  actions.forEach(({ action, params, delay = 0 }) => {
    totalDelay += delay;
    if (totalDelay > 0) {
      setTimeout(() => executeTourAction(action, params), totalDelay);
    } else {
      executeTourAction(action, params);
    }
  });
}

/**
 * Predefined action sets for common tour scenarios
 */
export const TOUR_ACTION_PRESETS = {
  // Ensure AI panel is expanded and in chat mode
  prepareForAIChat: [
    { action: 'expandAIPanel' as TourAction },
    { action: 'switchToActiveChat' as TourAction, delay: 100 },
    { action: 'focusChatInput' as TourAction, delay: 200 },
  ],

  // Ensure AI panel shows workflow cards
  prepareForWorkflowSelection: [
    { action: 'expandAIPanel' as TourAction },
    { action: 'switchToWelcomeCards' as TourAction, delay: 100 },
  ],

  // Ensure analysis panel is visible
  prepareForAnalysis: [
    { action: 'expandAnalysisPanel' as TourAction },
  ],

  // Show both panels
  showAllPanels: [
    { action: 'expandAIPanel' as TourAction },
    { action: 'expandAnalysisPanel' as TourAction },
  ],

  // Focus on map (collapse side panels)
  focusOnMap: [
    { action: 'collapseAIPanel' as TourAction },
    { action: 'collapseAnalysisPanel' as TourAction },
  ],

  // Demo: Show swing potential heatmap
  demoSwingHeatmap: [
    { action: 'showHeatmap' as TourAction, params: { metric: 'swing_potential' } },
  ],

  // Demo: Show GOTV priority heatmap
  demoGOTVHeatmap: [
    { action: 'showHeatmap' as TourAction, params: { metric: 'gotv_priority' } },
  ],

  // Demo: Highlight East Lansing precincts
  demoHighlightEastLansing: [
    { action: 'highlightPrecincts' as TourAction, params: { precincts: ['East Lansing 1', 'East Lansing 3', 'East Lansing 4', 'East Lansing 6', 'East Lansing 7'] } },
  ],

  // Demo: Select a precinct and show feature card
  demoSelectPrecinct: [
    { action: 'expandAIPanel' as TourAction },
    { action: 'switchToActiveChat' as TourAction, delay: 100 },
    { action: 'selectPrecinct' as TourAction, params: { precinctId: 'East Lansing 1' }, delay: 200 },
  ],
};

/**
 * Demo queries for tour demonstrations
 */
export const TOUR_DEMO_QUERIES = {
  swingPrecincts: 'Show me the most competitive swing precincts',
  gotvPriority: 'Which precincts have the highest GOTV priority?',
  compareAreas: 'Compare Lansing vs East Lansing',
  demographics: 'What are the demographics of Meridian Township?',
};
