'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { driver, type Driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { HelpCircle, Play, BookOpen, Users, BarChart3, Target, Search, Vote, Scale, Building2, Landmark } from 'lucide-react';
import {
  getTourSteps,
  DEFAULT_TOUR_CONFIG,
  TOUR_STEP_COUNTS,
  type TourTheme,
  type TourStepWithAction,
} from '@/lib/tour/tourConfig';
import { executeTourActions, executeTourAction, prepareStepForWait } from '@/lib/tour/tourActions';

/**
 * Local storage key for tracking if user has seen the tour
 */
const TOUR_SEEN_KEY = 'political-platform-tour-seen';

/**
 * Props for the GuidedTour component
 */
export interface GuidedTourProps {
  /** Whether to show the tour automatically on first visit */
  autoStart?: boolean;

  /** Tour theme to use */
  theme?: TourTheme;

  /** Callback when tour completes */
  onComplete?: () => void;

  /** Callback when tour is dismissed */
  onDismiss?: () => void;

  /** Custom trigger button (if not provided, uses default) */
  customTrigger?: React.ReactNode;

  /** Whether to show the dropdown menu with tour options */
  showMenu?: boolean;

  /** Button variant */
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';

  /** Button size */
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

/**
 * Tour menu item type
 */
type TourMenuItem = {
  theme: TourTheme;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

/**
 * Demo scenario tours - comprehensive campaign walkthroughs
 */
const DEMO_SCENARIO_ITEMS: TourMenuItem[] = [
  {
    theme: 'demo-scenario',
    label: 'State House Campaign',
    description: 'District 73 GOTV strategy (D+32)',
    icon: Target,
  },
  {
    theme: 'demo-scenario-senate',
    label: 'US Senate Campaign',
    description: 'Statewide race, county focus',
    icon: Landmark,
  },
  {
    theme: 'demo-scenario-congress',
    label: 'US House Campaign',
    description: 'PA-07-style competitive House scenario',
    icon: Building2,
  },
];

/**
 * Feature tour menu items - explain what tools do
 */
const FEATURE_TOUR_ITEMS: TourMenuItem[] = [
  {
    theme: 'welcome',
    label: 'Quick Start',
    description: 'Get started in 2 minutes',
    icon: Play,
  },
  {
    theme: 'full',
    label: 'Full Platform Tour',
    description: 'Complete walkthrough of all features',
    icon: BookOpen,
  },
  {
    theme: 'segmentation',
    label: 'Voter Segmentation',
    description: 'Build custom voter universes',
    icon: Users,
  },
  {
    theme: 'comparison',
    label: 'Comparison Tools',
    description: 'Compare jurisdictions and precincts',
    icon: BarChart3,
  },
];

/**
 * Workflow tour menu items - teach how to accomplish tasks
 */
const WORKFLOW_TOUR_ITEMS: TourMenuItem[] = [
  {
    theme: 'workflow-find-swing',
    label: 'Find Swing Precincts',
    description: 'Identify competitive areas',
    icon: Target,
  },
  {
    theme: 'workflow-analyze-precinct',
    label: 'Analyze a Precinct',
    description: 'Deep-dive into any precinct',
    icon: Search,
  },
  {
    theme: 'workflow-build-gotv',
    label: 'Build a GOTV Universe',
    description: 'Create turnout targeting list',
    icon: Vote,
  },
  {
    theme: 'workflow-compare-areas',
    label: 'Compare Two Areas',
    description: 'Side-by-side comparison',
    icon: Scale,
  },
];

/**
 * Combined tour menu items (for backward compatibility)
 */
const TOUR_MENU_ITEMS: TourMenuItem[] = FEATURE_TOUR_ITEMS;

/**
 * GuidedTour component
 *
 * Provides interactive guided tours of the platform using driver.js.
 * Supports multiple tour themes for different user needs.
 *
 * Each tour step can have an `onActivate` callback that triggers app state
 * changes when the step is highlighted, ensuring the UI matches what the
 * step describes.
 */
export function GuidedTour({
  autoStart = false,
  theme = 'welcome',
  onComplete,
  onDismiss,
  customTrigger,
  showMenu = true,
  variant = 'outline',
  size = 'default',
}: GuidedTourProps) {
  const router = useRouter();
  const driverRef = React.useRef<Driver | null>(null);
  const [isRunning, setIsRunning] = React.useState(false);
  const stepsRef = React.useRef<TourStepWithAction[]>([]);

  // Check if user has seen the tour
  const hasSeenTour = React.useMemo(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem(TOUR_SEEN_KEY) === 'true';
  }, []);

  // Initialize driver instance
  React.useEffect(() => {
    return () => {
      if (driverRef.current) {
        driverRef.current.destroy();
      }
    };
  }, []);

  // Auto-start tour for first-time users
  React.useEffect(() => {
    if (autoStart && !hasSeenTour) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        startTour('welcome');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [autoStart, hasSeenTour]);

  /**
   * Execute onActivate actions for a step
   */
  const executeStepActions = React.useCallback((stepIndex: number) => {
    const step = stepsRef.current[stepIndex];
    if (step?.onActivate && step.onActivate.length > 0) {
      console.log('[GuidedTour] Executing actions for step', stepIndex, step.onActivate);
      executeTourActions(step.onActivate);
    }
  }, []);

  /**
   * Internal tour start logic (after navigation if needed)
   */
  const startTourInternal = React.useCallback(
    (tourTheme: TourTheme) => {
      // Reset map to clean state before starting any tour
      // This clears existing layers, highlights, and resets the view
      executeTourAction('resetMap');

      const steps = getTourSteps(tourTheme);
      stepsRef.current = steps;

      // Filter steps to only include elements that exist in the DOM
      const validSteps = steps.filter((step) => {
        if (!step.element) return true; // No element means it's a general step
        const el = document.querySelector(step.element as string);
        return el !== null;
      });

      if (validSteps.length === 0) {
        console.warn('No valid tour steps found. Make sure elements have data-tour attributes.');
        return;
      }

      // Destroy existing driver if any
      if (driverRef.current) {
        driverRef.current.destroy();
      }

      // Create new driver instance
      driverRef.current = driver({
        ...DEFAULT_TOUR_CONFIG,
        steps: validSteps,
        onHighlightStarted: (element, step, options) => {
          // Find the index of this step in our full steps array
          const stepIndex = stepsRef.current.findIndex(
            (s) => s.element === step.element && s.popover?.title === step.popover?.title
          );
          console.log('[GuidedTour] onHighlightStarted - step title:', step.popover?.title);
          console.log('[GuidedTour] onHighlightStarted - stepIndex:', stepIndex);
          console.log('[GuidedTour] onHighlightStarted - step element:', step.element);
          if (stepIndex !== -1) {
            const stepConfig = stepsRef.current[stepIndex];
            console.log('[GuidedTour] onHighlightStarted - onActivate actions:', JSON.stringify(stepConfig?.onActivate, null, 2));

            // IMMEDIATELY disable Next button if step has typeInChat with wait
            // This happens BEFORE actions execute (which may have delays)
            if (stepConfig?.onActivate) {
              prepareStepForWait(stepConfig.onActivate);
            }

            // Execute the step's onActivate actions
            executeStepActions(stepIndex);
          } else {
            console.warn('[GuidedTour] onHighlightStarted - could not find step index!');
          }
        },
        onDestroyStarted: () => {
          setIsRunning(false);
          // Mark tour as seen
          if (typeof window !== 'undefined') {
            localStorage.setItem(TOUR_SEEN_KEY, 'true');
          }
          onDismiss?.();
        },
        onDestroyed: () => {
          setIsRunning(false);
        },
        onNextClick: () => {
          // Check if this is the last step (Done button)
          const currentIndex = driverRef.current?.getActiveIndex() ?? 0;
          const isLastStep = currentIndex === validSteps.length - 1;

          if (isLastStep) {
            // This is the "Done" button click
            setIsRunning(false);
            if (typeof window !== 'undefined') {
              localStorage.setItem(TOUR_SEEN_KEY, 'true');
            }
            driverRef.current?.destroy();
            onComplete?.();
          } else {
            driverRef.current?.moveNext();
          }
        },
        onPrevClick: () => {
          driverRef.current?.movePrevious();
        },
        onCloseClick: () => {
          driverRef.current?.destroy();
        },
      });

      // Start the tour
      setIsRunning(true);

      // Execute actions for the first step BEFORE starting the tour
      // This ensures the UI is in the right state when the first step appears
      const firstValidStepIndex = stepsRef.current.findIndex(
        (s) => !s.element || document.querySelector(s.element as string)
      );
      if (firstValidStepIndex !== -1) {
        executeStepActions(firstValidStepIndex);
      }

      // Small delay to let actions execute before showing tour
      setTimeout(() => {
        driverRef.current?.drive();
      }, 150);

      // Handle completion
      const checkCompletion = setInterval(() => {
        if (!driverRef.current?.isActive()) {
          clearInterval(checkCompletion);
          setIsRunning(false);
          if (typeof window !== 'undefined') {
            localStorage.setItem(TOUR_SEEN_KEY, 'true');
          }
          onComplete?.();
        }
      }, 500);
    },
    [onComplete, onDismiss, executeStepActions]
  );

  /**
   * Start a tour with the specified theme
   */
  const startTour = React.useCallback(
    (tourTheme: TourTheme) => {
      // Navigate to correct page for tool-specific tours and workflow tours
      const navigationMap: Partial<Record<TourTheme, string>> = {
        // Feature tours
        'segmentation': '/segments',
        'comparison': '/compare',
        // Workflow tours - navigate to the relevant tool page
        'workflow-find-swing': '/political-ai',  // Main analysis page
        'workflow-analyze-precinct': '/political-ai',  // Main analysis page
        'workflow-build-gotv': '/segments',  // Segmentation tool
        'workflow-compare-areas': '/compare',  // Comparison tool
      };

      const targetPage = navigationMap[tourTheme];

      // If navigation is needed and we're not already on that page
      if (targetPage && typeof window !== 'undefined' && window.location.pathname !== targetPage) {
        router.push(targetPage);
        // Wait for navigation and DOM to settle before starting tour
        setTimeout(() => {
          startTourInternal(tourTheme);
        }, 800);
        return;
      }

      // Otherwise start tour immediately
      startTourInternal(tourTheme);
    },
    [router, startTourInternal]
  );

  /**
   * Stop the current tour
   */
  const stopTour = React.useCallback(() => {
    if (driverRef.current) {
      driverRef.current.destroy();
    }
    setIsRunning(false);
  }, []);

  // If custom trigger is provided, use it
  if (customTrigger) {
    return (
      <div onClick={() => startTour(theme)} className="cursor-pointer">
        {customTrigger}
      </div>
    );
  }

  // If menu is disabled, show simple button
  if (!showMenu) {
    return (
      <Button
        variant={variant}
        size={size}
        onClick={() => (isRunning ? stopTour() : startTour(theme))}
        className="gap-2"
      >
        <HelpCircle className="h-4 w-4" />
        {isRunning ? 'Stop Tour' : 'Take Tour'}
      </Button>
    );
  }

  // Helper to render tour menu items
  const renderTourItems = (items: TourMenuItem[]) =>
    items.map((item) => {
      const Icon = item.icon;
      const stepCount = TOUR_STEP_COUNTS[item.theme];
      return (
        <DropdownMenuItem
          key={item.theme}
          onClick={() => startTour(item.theme)}
          className="flex items-start gap-3 py-2"
        >
          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="flex-1">
            <div className="font-medium text-sm">{item.label}</div>
            <div className="text-xs text-muted-foreground">
              {item.description} ({stepCount} steps)
            </div>
          </div>
        </DropdownMenuItem>
      );
    });

  // Show dropdown menu with tour options
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} className="gap-2">
          <HelpCircle className="h-4 w-4" />
          {size !== 'icon' && 'Tours'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 max-h-[70vh] overflow-y-auto bg-white border shadow-lg">
        <DropdownMenuLabel>🎯 Campaign Demos</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {renderTourItems(DEMO_SCENARIO_ITEMS)}

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Feature Tours</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {renderTourItems(FEATURE_TOUR_ITEMS)}

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Workflow Tutorials</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {renderTourItems(WORKFLOW_TOUR_ITEMS)}

        {isRunning && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={stopTour} className="text-destructive">
              Stop Current Tour
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Hook to control the guided tour programmatically
 */
export function useGuidedTour() {
  const [hasSeenTour, setHasSeenTour] = React.useState(true);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      setHasSeenTour(localStorage.getItem(TOUR_SEEN_KEY) === 'true');
    }
  }, []);

  const resetTourStatus = React.useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TOUR_SEEN_KEY);
      setHasSeenTour(false);
    }
  }, []);

  const markTourAsSeen = React.useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(TOUR_SEEN_KEY, 'true');
      setHasSeenTour(true);
    }
  }, []);

  return {
    hasSeenTour,
    resetTourStatus,
    markTourAsSeen,
  };
}

export default GuidedTour;
