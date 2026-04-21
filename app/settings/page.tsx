'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AppNavigation } from '@/components/navigation/AppNavigation';
import UnifiedAIAssistant from '@/components/ai-native/UnifiedAIAssistant';
import CollapsibleAIPanel from '@/components/ai-native/CollapsibleAIPanel';
import { getStateManager } from '@/lib/ai-native/ApplicationStateManager';
import { getSettingsManager, type AllSettings, type SettingsCategory } from '@/lib/settings';
import { segmentStore } from '@/lib/segmentation/SegmentStore';
import type { SegmentDefinition } from '@/lib/segmentation/types';
import {
  Calendar, Target, Users, MessageSquare, Database, Map, Building2,
  RotateCcw, Download, Upload, Check, Trash2, UsersRound, Link2, CalendarDays,
  Clock, AlertCircle, CheckCircle2, Palette, HelpCircle
} from 'lucide-react';
import type { MapCommand } from '@/lib/ai-native/types';
import { HelpDialog } from '@/components/help/HelpDialog';
import { ErrorBoundary } from '@/components/common/error-boundary';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// Category metadata for UI
const CATEGORY_CONFIG = {
  appearance: {
    label: 'Appearance',
    icon: Palette,
    description: 'Theme, colors, and visual preferences',
  },
  campaign: {
    label: 'Campaign Calendar',
    icon: Calendar,
    description: 'Election dates, deadlines, and campaign phases',
  },
  targeting: {
    label: 'Targeting Strategy',
    icon: Target,
    description: 'Voter targeting weights and thresholds',
  },
  ai: {
    label: 'AI Assistant',
    icon: MessageSquare,
    description: 'Response style, proactive suggestions, and tone',
  },
  data: {
    label: 'Data & Privacy',
    icon: Database,
    description: 'Data sources, export formats, and session memory',
  },
  map: {
    label: 'Map & Visualization',
    icon: Map,
    description: 'Default view, color schemes, and visible layers',
  },
  organization: {
    label: 'Organization',
    icon: Building2,
    description: 'Branding, target areas, and report customization',
  },
  savedSegments: {
    label: 'Saved Segments',
    icon: Users,
    description: 'View and manage your saved voter segments',
  },
  // calendarWidget disabled - use Campaign settings to configure dates
  // calendarWidget: {
  //   label: 'Campaign Calendar',
  //   icon: CalendarDays,
  //   description: 'View upcoming deadlines and election timeline',
  // },
  team: {
    label: 'Team',
    icon: UsersRound,
    description: 'Manage team members and permissions',
  },
  vanApi: {
    label: 'VAN Integration',
    icon: Link2,
    description: 'Configure VAN/VoteBuilder API connection',
  },
} as const;

// Help content for Settings page
const settingsHelp = {
  title: 'Settings & Preferences',
  description: 'Customize your political analysis experience',
  sections: [
    {
      id: 'appearance',
      title: 'Appearance',
      content: 'Choose between light and dark themes to match your preference. Adjust display density for more compact or spacious layouts. Your theme preference is saved to your browser and will persist across sessions.',
    },
    {
      id: 'campaign',
      title: 'Campaign Calendar',
      content: 'Configure critical election dates including primary date, general election date, voter registration deadlines, and early voting periods. The system will automatically detect campaign phases based on these dates, or you can manually override the phase.',
    },
    {
      id: 'targeting',
      title: 'Targeting Strategy',
      content: 'Control how voter targeting scores are calculated. Set minimum thresholds for GOTV and persuasion targets, choose your primary strategy (GOTV, Persuasion, or Hybrid), and adjust the weights used for scoring factors like turnout history and partisan lean.',
    },
    {
      id: 'ai',
      title: 'AI Behavior',
      content: 'Control how the AI assistant communicates with you. Set response style (auto-adaptive, concise, or detailed), choose tone (professional, casual, or urgent), and toggle proactive suggestions. Configure confidence indicators and data source citations.',
    },
    {
      id: 'saved-segments',
      title: 'Saved Segments',
      content: 'View and manage your saved voter segments. Rename segments, export them for use in other tools (JSON format), or delete ones you no longer need. Use batch actions to export or delete multiple segments at once.',
    },
    {
      id: 'data',
      title: 'Data & Privacy',
      content: 'Control data retention settings including exploration history and session memory duration. Toggle data sources like FEC donor data, ESRI Tapestry segments, and Census demographics. Set default export format (CSV, Excel, or PDF).',
    },
    {
      id: 'map',
      title: 'Map & Visualization',
      content: 'Customize default map settings including zoom level, initial metric (partisan lean, swing potential, GOTV priority, etc.), color scheme, and layer visibility. Choose between precinct boundaries and H3 hexagonal grid for uniform visualization.',
    },
    {
      id: 'organization',
      title: 'Organization',
      content: 'Configure organization branding including name, primary color, logo URL, target state, and report header/footer text. These settings will be applied to all generated reports and exports.',
    },
  ],
};

const settingsTutorials: import('@/components/help/HelpDialog').WorkflowTutorial[] = [
  {
    theme: 'segmentation' as const,
    label: 'Customize AI Responses',
    description: 'Adjust how the AI assistant communicates with you',
  },
  {
    theme: 'workflow-build-gotv' as const,
    label: 'Manage Saved Segments',
    description: 'Export, rename, or delete your saved voter segments',
  },
  {
    theme: 'canvassing' as const,
    label: 'Configure Campaign Timeline',
    description: 'Set election dates and important deadlines',
  },
  {
    theme: 'workflow-find-swing' as const,
    label: 'Adjust Targeting Weights',
    description: 'Fine-tune how voter targeting scores are calculated',
  },
];

function SettingsPageContent() {
  const [settings, setSettings] = useState<AllSettings | null>(null);
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('appearance');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [showHelp, setShowHelp] = useState(false);
  const stateManager = getStateManager();

  useEffect(() => {
    stateManager.setCurrentTool('settings');
    const manager = getSettingsManager();
    setSettings(manager.getAll());

    // Check if we should open a specific category (from deep link)
    if (typeof window !== 'undefined') {
      const storedCategory = sessionStorage.getItem('settings_active_category');
      if (storedCategory && Object.keys(CATEGORY_CONFIG).includes(storedCategory)) {
        setActiveCategory(storedCategory as SettingsCategory);
        sessionStorage.removeItem('settings_active_category');
      }
    }

    // Subscribe to changes
    return manager.subscribe(() => {
      setSettings(manager.getAll());
    });
  }, [stateManager]);

  const handleSettingChange = useCallback(<K extends SettingsCategory>(
    category: K,
    key: keyof AllSettings[K],
    value: AllSettings[K][typeof key]
  ) => {
    const manager = getSettingsManager();
    manager.set(category, key, value);
    setSaveStatus('saving');
    setTimeout(() => setSaveStatus('saved'), 500);
    setTimeout(() => setSaveStatus('idle'), 2000);
  }, []);

  const handleResetCategory = useCallback((category: SettingsCategory) => {
    const manager = getSettingsManager();
    manager.resetCategory(category);
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  }, []);

  const handleExport = useCallback(() => {
    const manager = getSettingsManager();
    const json = manager.exportSettings();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'political-settings.json';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const text = await file.text();
      const manager = getSettingsManager();
      const success = manager.importSettings(text);
      if (success) {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        alert('Failed to import settings. Please check the file format.');
      }
    };
    input.click();
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleMapCommand = (command: MapCommand) => {
    // Settings page doesn't use map commands, but the interface requires it
  };

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--theme-bg-primary, #f8f8f8)' }}>
      {/* Help Dialog */}
      <HelpDialog
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
        title={settingsHelp.title}
        subtitle={settingsHelp.description}
        sections={settingsHelp.sections}
        tutorials={settingsTutorials}
        toolContext="settings"
      />

      {/* Navigation Sidebar */}
      <div className="w-14 h-full flex-shrink-0 relative z-50">
        <AppNavigation variant="sidebar" />
      </div>

      {/* AI Panel - Left Side */}
      <CollapsibleAIPanel
        position="left"
        defaultCollapsed={false}
        expandedWidth={400}
        storageKey="settings-ai-panel-collapsed"
      >
        <UnifiedAIAssistant
          toolContext="settings"
          onMapCommand={handleMapCommand}
          selectedPrecinct={null}
        />
      </CollapsibleAIPanel>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden flex">
        {/* Category Sidebar */}
        <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Settings</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Configure your analysis platform</p>
          </div>
          <nav className="p-2">
            {(Object.entries(CATEGORY_CONFIG) as [SettingsCategory, typeof CATEGORY_CONFIG[keyof typeof CATEGORY_CONFIG]][]).map(([key, config]) => {
              const Icon = config.icon;
              const isComingSoon = key === 'team' || key === 'vanApi';
              return (
                <button
                  key={key}
                  onClick={() => !isComingSoon && setActiveCategory(key)}
                  disabled={isComingSoon}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${isComingSoon
                    ? 'opacity-50 cursor-not-allowed text-gray-500 dark:text-gray-500'
                    : activeCategory === key
                      ? 'bg-green-50 dark:bg-green-900/20 text-[#33a852] dark:text-green-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  title={isComingSoon ? 'Coming Soon' : undefined}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm flex items-center gap-2">
                      {config.label}
                      {isComingSoon && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded text-xs font-medium">
                          Soon
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Import/Export */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 mt-auto">
            <div className="flex gap-2">
              <button
                onClick={handleExport}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
              <button
                onClick={handleImport}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
              >
                <Upload className="w-4 h-4" />
                Import
              </button>
            </div>
          </div>
        </div>

        {/* Settings Content */}
        <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
          <div className="max-w-3xl mx-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {CATEGORY_CONFIG[activeCategory].label}
                </h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  {CATEGORY_CONFIG[activeCategory].description}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {saveStatus === 'saved' && (
                  <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                    <Check className="w-4 h-4" /> Saved
                  </span>
                )}
                <button
                  onClick={() => setShowHelp(true)}
                  className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title="Help"
                >
                  <HelpCircle className="w-5 h-5" />
                </button>
                {activeCategory !== 'appearance' && (
                  <button
                    onClick={() => handleResetCategory(activeCategory)}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reset to Defaults
                  </button>
                )}
              </div>
            </div>

            <CategorySettings
              category={activeCategory}
              settings={settings}
              onChange={handleSettingChange}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

// Category-specific settings components
interface CategorySettingsProps {
  category: SettingsCategory;
  settings: AllSettings;
  onChange: <K extends SettingsCategory>(
    category: K,
    key: keyof AllSettings[K],
    value: AllSettings[K][typeof key]
  ) => void;
}

function CategorySettings({ category, settings, onChange }: CategorySettingsProps) {
  switch (category) {
    case 'appearance':
      return <AppearanceSettings />;
    case 'campaign':
      return <CampaignSettings settings={settings.campaign} onChange={(key, value) => onChange('campaign', key, value)} />;
    case 'targeting':
      return <TargetingSettings settings={settings.targeting} onChange={(key, value) => onChange('targeting', key, value)} />;
    case 'ai':
      return <AISettings settings={settings.ai} onChange={(key, value) => onChange('ai', key, value)} />;
    case 'data':
      return <DataSettings settings={settings.data} onChange={(key, value) => onChange('data', key, value)} />;
    case 'map':
      return <MapSettings settings={settings.map} onChange={(key, value) => onChange('map', key, value)} />;
    case 'organization':
      return <OrganizationSettings settings={settings.organization} onChange={(key, value) => onChange('organization', key, value)} />;
    case 'savedSegments':
      return <SavedSegmentsSettings />;
    // calendarWidget disabled - use Campaign settings
    case 'team':
      return <TeamPlaceholder />;
    case 'vanApi':
      return <VANApiPlaceholder />;
    default:
      return null;
  }
}

// Reusable form components
function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-4 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1 min-w-0">
          <label className="text-sm font-medium text-gray-900 dark:text-white">{label}</label>
          {description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{description}</p>}
        </div>
        <div className="flex-shrink-0">{children}</div>
      </div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? 'bg-[#33a852]' : 'bg-gray-200 dark:bg-gray-700'
        }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'
          }`}
      />
    </button>
  );
}

function Select({ value, options, onChange }: { value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#33a852]"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}

function NumberInput({ value, min, max, onChange }: { value: number; min?: number; max?: number; onChange: (value: number) => void }) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-24 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#33a852]"
    />
  );
}

function DateInput({ value, onChange }: { value: string | null; onChange: (value: string | null) => void }) {
  return (
    <input
      type="date"
      value={value || ''}
      onChange={(e) => onChange(e.target.value || null)}
      className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#33a852]"
    />
  );
}

// Category-specific settings forms
function AppearanceSettings() {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    // Load theme preference on mount
    const stored = localStorage.getItem('pol_theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = stored === 'dark' || (!stored && prefersDark);
    setIsDarkMode(isDark);
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  const handleToggleDarkMode = (newMode: boolean) => {
    setIsDarkMode(newMode);
    localStorage.setItem('pol_theme', newMode ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', newMode);
  };

  const setTheme = (theme: 'light' | 'dark') => {
    const isDark = theme === 'dark';
    setIsDarkMode(isDark);
    localStorage.setItem('pol_theme', theme);
    document.documentElement.classList.toggle('dark', isDark);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <SettingRow
        label="Dark Mode"
        description="Switch between light and dark themes"
      >
        <Toggle checked={isDarkMode} onChange={handleToggleDarkMode} />
      </SettingRow>

      {/* Theme preview */}
      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
        <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-3">Theme Preview</h4>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setTheme('light')}
            className={`p-3 rounded-lg border-2 transition-colors ${!isDarkMode
              ? 'border-[#33a852] bg-green-50 dark:bg-green-900/20'
              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
          >
            <div className="w-full h-8 bg-white rounded mb-2 border border-gray-200" />
            <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">Light</span>
            {!isDarkMode && (
              <div className="mt-1">
                <CheckCircle2 className="w-4 h-4 text-[#33a852] mx-auto" />
              </div>
            )}
          </button>
          <button
            onClick={() => setTheme('dark')}
            className={`p-3 rounded-lg border-2 transition-colors ${isDarkMode
              ? 'border-[#33a852] bg-green-50 dark:bg-green-900/20'
              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
          >
            <div className="w-full h-8 bg-gray-800 rounded mb-2" />
            <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">Dark</span>
            {isDarkMode && (
              <div className="mt-1">
                <CheckCircle2 className="w-4 h-4 text-[#33a852] mx-auto" />
              </div>
            )}
          </button>
        </div>
      </div>

      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700 rounded-b-lg">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Your theme preference is saved to your browser and will persist across sessions.
          The system will default to your operating system preference if not set.
        </p>
      </div>
    </div>
  );
}

function CampaignSettings({ settings, onChange }: {
  settings: AllSettings['campaign'];
  onChange: (key: keyof AllSettings['campaign'], value: AllSettings['campaign'][typeof key]) => void
}) {
  const [dateValidationError, setDateValidationError] = useState<string | null>(null);

  const handleEarlyVotingStartChange = (value: string | null) => {
    if (value && settings.earlyVotingEnd) {
      const startDate = new Date(value);
      const endDate = new Date(settings.earlyVotingEnd);
      if (startDate > endDate) {
        setDateValidationError('Early voting start date must be before end date');
        return;
      }
    }
    setDateValidationError(null);
    onChange('earlyVotingStart', value);
  };

  const handleEarlyVotingEndChange = (value: string | null) => {
    if (value && settings.earlyVotingStart) {
      const startDate = new Date(settings.earlyVotingStart);
      const endDate = new Date(value);
      if (endDate < startDate) {
        setDateValidationError('Early voting end date must be after start date');
        return;
      }
    }
    setDateValidationError(null);
    onChange('earlyVotingEnd', value);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <SettingRow label="General Election Date" description="The main election day">
        <DateInput value={settings.generalElectionDate} onChange={(v) => v && onChange('generalElectionDate', v)} />
      </SettingRow>
      <SettingRow label="Primary Date" description="Leave empty if no primary">
        <DateInput value={settings.primaryDate} onChange={(v) => onChange('primaryDate', v)} />
      </SettingRow>
      <SettingRow label="Primary Type">
        <Select
          value={settings.primaryType}
          options={[
            { value: 'open', label: 'Open' },
            { value: 'closed', label: 'Closed' },
            { value: 'semi-closed', label: 'Semi-Closed' },
            { value: 'caucus', label: 'Caucus' },
          ]}
          onChange={(v) => onChange('primaryType', v as typeof settings.primaryType)}
        />
      </SettingRow>
      <SettingRow label="Voter Registration Deadline">
        <DateInput value={settings.voterRegistrationDeadline} onChange={(v) => v && onChange('voterRegistrationDeadline', v)} />
      </SettingRow>
      <SettingRow label="Early Voting Start">
        <DateInput value={settings.earlyVotingStart} onChange={handleEarlyVotingStartChange} />
      </SettingRow>
      <SettingRow label="Early Voting End">
        <DateInput value={settings.earlyVotingEnd} onChange={handleEarlyVotingEndChange} />
      </SettingRow>

      {dateValidationError && (
        <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <p className="text-sm font-medium">{dateValidationError}</p>
          </div>
        </div>
      )}

      <SettingRow label="Absentee Request Deadline">
        <DateInput value={settings.absenteeRequestDeadline} onChange={(v) => onChange('absenteeRequestDeadline', v)} />
      </SettingRow>
      <SettingRow label="Campaign Phase Override" description="Auto-detect based on dates, or force a specific phase">
        <Select
          value={settings.forcePhase}
          options={[
            { value: 'auto', label: 'Auto-detect' },
            { value: 'pre_primary', label: 'Pre-Primary' },
            { value: 'primary_gotv', label: 'Primary GOTV' },
            { value: 'general_id', label: 'General ID' },
            { value: 'general_persuasion', label: 'General Persuasion' },
            { value: 'general_gotv', label: 'General GOTV' },
            { value: 'post_election', label: 'Post-Election' },
          ]}
          onChange={(v) => onChange('forcePhase', v as typeof settings.forcePhase)}
        />
      </SettingRow>
    </div>
  );
}

function TargetingSettings({ settings, onChange }: {
  settings: AllSettings['targeting'];
  onChange: (key: keyof AllSettings['targeting'], value: AllSettings['targeting'][typeof key]) => void
}) {
  return (
    <div className="bg-white rounded-lg border">
      <SettingRow label="Strategy" description="Primary focus for voter targeting">
        <Select
          value={settings.strategy}
          options={[
            { value: 'gotv', label: 'GOTV (Mobilization)' },
            { value: 'persuasion', label: 'Persuasion' },
            { value: 'hybrid', label: 'Hybrid' },
          ]}
          onChange={(v) => onChange('strategy', v as typeof settings.strategy)}
        />
      </SettingRow>
      <SettingRow label="GOTV Minimum Score" description="Minimum score (0-100) for GOTV targets">
        <NumberInput value={settings.gotvMinScore} min={0} max={100} onChange={(v) => onChange('gotvMinScore', v)} />
      </SettingRow>
      <SettingRow label="Persuasion Minimum Score" description="Minimum score (0-100) for persuasion targets">
        <NumberInput value={settings.persuasionMinScore} min={0} max={100} onChange={(v) => onChange('persuasionMinScore', v)} />
      </SettingRow>
      <SettingRow label="Target Universe Size" description="Auto or specific number of voters">
        <div className="flex items-center gap-2">
          <Select
            value={settings.targetUniverseSize === 'auto' ? 'auto' : 'custom'}
            options={[
              { value: 'auto', label: 'Auto' },
              { value: 'custom', label: 'Custom' },
            ]}
            onChange={(v) => onChange('targetUniverseSize', v === 'auto' ? 'auto' : 10000)}
          />
          {settings.targetUniverseSize !== 'auto' && (
            <NumberInput
              value={settings.targetUniverseSize}
              min={100}
              max={1000000}
              onChange={(v) => onChange('targetUniverseSize', v)}
            />
          )}
        </div>
      </SettingRow>

      <div className="px-4 py-4 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Score Weights (must sum to 100)</h4>
          <button
            onClick={() => {
              const weights = settings.scoreWeights;
              const currentSum = weights.turnoutHistory + weights.partisanLean + weights.demographicFit + weights.donorPotential;
              if (currentSum === 0) {
                // If all weights are 0, set to equal distribution
                onChange('scoreWeights', {
                  turnoutHistory: 25,
                  partisanLean: 25,
                  demographicFit: 25,
                  donorPotential: 25,
                });
              } else {
                // Normalize proportionally
                const factor = 100 / currentSum;
                onChange('scoreWeights', {
                  turnoutHistory: Math.round(weights.turnoutHistory * factor),
                  partisanLean: Math.round(weights.partisanLean * factor),
                  demographicFit: Math.round(weights.demographicFit * factor),
                  donorPotential: Math.round(weights.donorPotential * factor),
                });
              }
            }}
            className="text-xs px-2 py-1 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded hover:bg-gray-50 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200"
          >
            Normalize
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center justify-between py-2">
            <span className="text-xs text-gray-600 dark:text-gray-400">Turnout History</span>
            <NumberInput
              value={settings.scoreWeights.turnoutHistory}
              min={0}
              max={100}
              onChange={(v) => onChange('scoreWeights', { ...settings.scoreWeights, turnoutHistory: v })}
            />
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-xs text-gray-600 dark:text-gray-400">Partisan Lean</span>
            <NumberInput
              value={settings.scoreWeights.partisanLean}
              min={0}
              max={100}
              onChange={(v) => onChange('scoreWeights', { ...settings.scoreWeights, partisanLean: v })}
            />
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-xs text-gray-600 dark:text-gray-400">Demographic Fit</span>
            <NumberInput
              value={settings.scoreWeights.demographicFit}
              min={0}
              max={100}
              onChange={(v) => onChange('scoreWeights', { ...settings.scoreWeights, demographicFit: v })}
            />
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-xs text-gray-600 dark:text-gray-400">Donor Potential</span>
            <NumberInput
              value={settings.scoreWeights.donorPotential}
              min={0}
              max={100}
              onChange={(v) => onChange('scoreWeights', { ...settings.scoreWeights, donorPotential: v })}
            />
          </div>
        </div>
        {(() => {
          const currentSum = settings.scoreWeights.turnoutHistory + settings.scoreWeights.partisanLean + settings.scoreWeights.demographicFit + settings.scoreWeights.donorPotential;
          const isValid = currentSum === 100;
          return (
            <div className={`flex items-center gap-2 mt-2 text-xs ${isValid ? 'text-green-600' : 'text-red-600'}`}>
              {isValid ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Current total: {currentSum}% (Valid)</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4" />
                  <span>Current total: {currentSum}% (Must equal 100%)</span>
                </>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}



// Response style example previews
const RESPONSE_STYLE_EXAMPLES = {
  concise: {
    title: 'Concise',
    description: 'Data-focused, minimal explanation',
    icon: '⚡',
    example: `**East Lansing Precincts:** 12 precincts, 45,230 voters
- Partisan Lean: D+18
- Swing Potential: 42/100
- Top Issue: Education`,
  },
  detailed: {
    title: 'Detailed',
    description: 'Full context and methodology',
    icon: '📊',
    example: `**East Lansing Analysis**

East Lansing contains 12 precincts with 45,230 registered voters. The area shows strong Democratic lean (D+18) driven by the university population and high-education demographics.

**Key Metrics:**
- Partisan Lean: D+18 (based on 2020-2024 results)
- Swing Potential: 42/100 (moderate)
- Top Issue: Education (85% relevance)

*Data from Michigan SOS and Census ACS 2023.*`,
  },
  auto: {
    title: 'Auto',
    description: 'Adapts based on your expertise',
    icon: '🎯',
    example: `Response length adjusts based on:
• Your query complexity
• Session exploration depth
• Detected expertise level

Power users get concise data.
New users get full explanations.`,
  },
};

const TONE_EXAMPLES = {
  professional: {
    title: 'Professional',
    description: 'Formal, analytical',
    icon: '💼',
    example: 'The data indicates a 12% increase in swing voter registration. We recommend prioritizing persuasion outreach.',
  },
  casual: {
    title: 'Casual',
    description: 'Friendly, approachable',
    icon: '👋',
    example: "Great news! Swing voter registration is up 12%. That's a solid opportunity for persuasion outreach.",
  },
  urgent: {
    title: 'Urgent',
    description: 'Action-oriented, direct',
    icon: '🚨',
    example: '⚠️ Swing voter registration up 12% — prioritize persuasion outreach NOW before registration closes.',
  },
};

function AISettings({ settings, onChange }: {
  settings: AllSettings['ai'];
  onChange: (key: keyof AllSettings['ai'], value: AllSettings['ai'][typeof key]) => void
}) {
  const [showPreview, setShowPreview] = useState<'style' | 'tone' | null>(null);

  return (
    <div className="space-y-6">
      {/* Response Style Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Response Style</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Choose how detailed AI responses should be</p>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-3 gap-3">
            {(Object.entries(RESPONSE_STYLE_EXAMPLES) as [keyof typeof RESPONSE_STYLE_EXAMPLES, typeof RESPONSE_STYLE_EXAMPLES['auto']][]).map(([key, style]) => (
              <button
                key={key}
                onClick={() => onChange('responseStyle', key)}
                className={`relative p-3 rounded-lg border-2 transition-all text-left ${settings.responseStyle === key
                  ? 'border-[#33a852] bg-green-50 dark:bg-green-900/20'
                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{style.icon}</span>
                  <span className="font-medium text-sm text-gray-900 dark:text-white">{style.title}</span>
                  {settings.responseStyle === key && (
                    <Check className="w-4 h-4 text-[#33a852] ml-auto" />
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{style.description}</p>
              </button>
            ))}
          </div>

          {/* Preview Toggle */}
          <button
            onClick={() => setShowPreview(showPreview === 'style' ? null : 'style')}
            className="mt-3 text-xs text-[#33a852] hover:text-green-700 dark:hover:text-green-300 flex items-center gap-1"
          >
            {showPreview === 'style' ? 'Hide preview' : 'Show example response'}
            <span className="text-[10px]">{showPreview === 'style' ? '▲' : '▼'}</span>
          </button>

          {/* Preview Panel */}
          {showPreview === 'style' && (
            <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm">{RESPONSE_STYLE_EXAMPLES[settings.responseStyle].icon}</span>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  {RESPONSE_STYLE_EXAMPLES[settings.responseStyle].title} Style Preview
                </span>
              </div>
              <pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap font-mono leading-relaxed">
                {RESPONSE_STYLE_EXAMPLES[settings.responseStyle].example}
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* Tone Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Communication Tone</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Set the AI&apos;s communication style</p>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-3 gap-3">
            {(Object.entries(TONE_EXAMPLES) as [keyof typeof TONE_EXAMPLES, typeof TONE_EXAMPLES['professional']][]).map(([key, tone]) => (
              <button
                key={key}
                onClick={() => onChange('tone', key)}
                className={`relative p-3 rounded-lg border-2 transition-all text-left ${settings.tone === key
                  ? 'border-[#33a852] bg-green-50 dark:bg-green-900/20'
                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{tone.icon}</span>
                  <span className="font-medium text-sm text-gray-900 dark:text-white">{tone.title}</span>
                  {settings.tone === key && (
                    <Check className="w-4 h-4 text-[#33a852] ml-auto" />
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{tone.description}</p>
              </button>
            ))}
          </div>

          {/* Preview Toggle */}
          <button
            onClick={() => setShowPreview(showPreview === 'tone' ? null : 'tone')}
            className="mt-3 text-xs text-[#33a852] hover:text-green-700 dark:hover:text-green-300 flex items-center gap-1"
          >
            {showPreview === 'tone' ? 'Hide preview' : 'Show example response'}
            <span className="text-[10px]">{showPreview === 'tone' ? '▲' : '▼'}</span>
          </button>

          {/* Preview Panel */}
          {showPreview === 'tone' && (
            <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm">{TONE_EXAMPLES[settings.tone].icon}</span>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  {TONE_EXAMPLES[settings.tone].title} Tone Preview
                </span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 italic">
                &quot;{TONE_EXAMPLES[settings.tone].example}&quot;
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Proactive Suggestions Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Proactive Assistance</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Control when the AI offers suggestions</p>
        </div>

        <SettingRow label="Enable Proactive Suggestions" description="AI suggests actions without being asked">
          <Toggle checked={settings.enableProactiveSuggestions} onChange={(v) => onChange('enableProactiveSuggestions', v)} />
        </SettingRow>

        {settings.enableProactiveSuggestions && (
          <SettingRow label="Suggestion Frequency" description="How often to offer suggestions">
            <div className="flex items-center gap-2">
              {(['low', 'medium', 'high'] as const).map((freq) => (
                <button
                  key={freq}
                  onClick={() => onChange('proactiveFrequency', freq)}
                  className={`px-3 py-1 text-xs rounded-full transition-colors ${settings.proactiveFrequency === freq
                    ? 'bg-[#33a852] text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                >
                  {freq.charAt(0).toUpperCase() + freq.slice(1)}
                </button>
              ))}
            </div>
          </SettingRow>
        )}
      </div>

      {/* Display Options Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Display Options</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Configure what information is shown</p>
        </div>

        <SettingRow label="Show Confidence Indicators" description="Display AI confidence levels (e.g., '85% confident')">
          <Toggle checked={settings.showConfidenceIndicators} onChange={(v) => onChange('showConfidenceIndicators', v)} />
        </SettingRow>
        <SettingRow label="Show Data Sources" description="Cite where data comes from in responses">
          <Toggle checked={settings.showDataSources} onChange={(v) => onChange('showDataSources', v)} />
        </SettingRow>
        <SettingRow label="Show Methodology Links" description="Link to detailed calculation explanations">
          <Toggle checked={settings.showMethodologyLinks} onChange={(v) => onChange('showMethodologyLinks', v)} />
        </SettingRow>
      </div>

      {/* Processing Options Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Processing Options</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Control how queries are handled</p>
        </div>

        <SettingRow label="Prefer Local Handlers" description="Use fast local processing when possible (faster, no API calls)">
          <Toggle checked={settings.preferLocalHandlers} onChange={(v) => onChange('preferLocalHandlers', v)} />
        </SettingRow>
        <SettingRow label="Allow Claude Escalation" description="Send complex queries to Claude API for deeper analysis">
          <Toggle checked={settings.allowClaudeEscalation} onChange={(v) => onChange('allowClaudeEscalation', v)} />
        </SettingRow>
      </div>
    </div>
  );
}

function DataSettings({ settings, onChange }: {
  settings: AllSettings['data'];
  onChange: (key: keyof AllSettings['data'], value: AllSettings['data'][typeof key]) => void
}) {
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [sessionCleared, setSessionCleared] = useState(false);

  const handleClearSession = useCallback(() => {
    // Use ApplicationStateManager's clearSession which handles all storage + state reset
    const stateManager = getStateManager();
    stateManager.clearSession();

    setSessionCleared(true);
    setShowClearConfirm(false);

    // Reset the "cleared" indicator after 3 seconds
    setTimeout(() => setSessionCleared(false), 3000);
  }, []);

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <SettingRow label="Enable Exploration History" description="Track your analysis journey">
          <Toggle checked={settings.enableExplorationHistory} onChange={(v) => onChange('enableExplorationHistory', v)} />
        </SettingRow>
        <SettingRow label="Enable Session Memory" description="AI remembers context within sessions">
          <Toggle checked={settings.enableSessionMemory} onChange={(v) => onChange('enableSessionMemory', v)} />
        </SettingRow>
        <SettingRow label="Session Retention Days" description="How long to keep session data">
          <NumberInput value={settings.sessionRetentionDays} min={1} max={365} onChange={(v) => onChange('sessionRetentionDays', v)} />
        </SettingRow>
        <SettingRow label="Enable Tapestry Segments" description="Include ESRI Tapestry psychographics">
          <Toggle checked={settings.enableTapestrySegments} onChange={(v) => onChange('enableTapestrySegments', v)} />
        </SettingRow>
        <SettingRow label="Enable Census Data" description="Include ACS demographic data">
          <Toggle checked={settings.enableCensusData} onChange={(v) => onChange('enableCensusData', v)} />
        </SettingRow>
        <SettingRow label="Default Export Format">
          <Select
            value={settings.defaultExportFormat}
            options={[
              { value: 'csv', label: 'CSV' },
              { value: 'xlsx', label: 'Excel (XLSX)' },
              { value: 'pdf', label: 'PDF' },
            ]}
            onChange={(v) => onChange('defaultExportFormat', v as typeof settings.defaultExportFormat)}
          />
        </SettingRow>
        <SettingRow label="Include Metadata in Exports" description="Add methodology and timestamps">
          <Toggle checked={settings.includeMetadataInExports} onChange={(v) => onChange('includeMetadataInExports', v)} />
        </SettingRow>

        {/* Clear Session Section */}
        <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1 min-w-0">
              <label className="text-sm font-medium text-gray-900 dark:text-white">Clear Session Data</label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Reset all exploration history, AI context, and navigation state. Start fresh.
              </p>
            </div>
            <div className="flex-shrink-0">
              {sessionCleared ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-700 dark:text-green-400">
                  <CheckCircle2 className="w-4 h-4" />
                  Cleared
                </span>
              ) : (
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 border border-red-300 dark:border-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear Session
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Session Data?</AlertDialogTitle>
            <AlertDialogDescription>
              This will clear all your exploration history, AI conversation context, and navigation state.
              Your saved segments and settings will not be affected. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearSession}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Clear Session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function MapSettings({ settings, onChange }: {
  settings: AllSettings['map'];
  onChange: (key: keyof AllSettings['map'], value: AllSettings['map'][typeof key]) => void
}) {
  return (
    <div className="bg-white rounded-lg border">
      <SettingRow label="Default Zoom Level">
        <NumberInput value={settings.defaultZoom} min={1} max={20} onChange={(v) => onChange('defaultZoom', v)} />
      </SettingRow>
      <SettingRow label="Default Metric" description="Initial visualization metric">
        <Select
          value={settings.defaultMetric}
          options={[
            { value: 'partisan_lean', label: 'Partisan Lean' },
            { value: 'swing_potential', label: 'Swing Potential' },
            { value: 'gotv_priority', label: 'GOTV Priority' },
            { value: 'persuasion_opportunity', label: 'Persuasion Opportunity' },
            { value: 'turnout', label: 'Turnout Rate' },
          ]}
          onChange={(v) => onChange('defaultMetric', v)}
        />
      </SettingRow>
      <SettingRow label="Color Scheme">
        <Select
          value={settings.colorScheme}
          options={[
            { value: 'dem_rep', label: 'Democrat/Republican (Blue/Red)' },
            { value: 'viridis', label: 'Viridis (Neutral)' },
            { value: 'custom', label: 'Custom' },
          ]}
          onChange={(v) => onChange('colorScheme', v as typeof settings.colorScheme)}
        />
      </SettingRow>
      <SettingRow label="Show H3 Hexagons" description="Use uniform hex grid for heatmaps">
        <Toggle checked={settings.showH3Hexagons} onChange={(v) => onChange('showH3Hexagons', v)} />
      </SettingRow>
      <SettingRow label="Show Precinct Boundaries" description="Display precinct outlines">
        <Toggle checked={settings.showPrecinctBoundaries} onChange={(v) => onChange('showPrecinctBoundaries', v)} />
      </SettingRow>
    </div>
  );
}

function OrganizationSettings({ settings, onChange }: {
  settings: AllSettings['organization'];
  onChange: (key: keyof AllSettings['organization'], value: AllSettings['organization'][typeof key]) => void
}) {
  return (
    <div className="bg-white rounded-lg border">
      <SettingRow label="Organization Name">
        <input
          type="text"
          value={settings.organizationName}
          onChange={(e) => onChange('organizationName', e.target.value)}
          className="w-48 px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Your organization"
        />
      </SettingRow>
      <SettingRow label="Primary Color" description="Brand color for reports">
        <input
          type="color"
          value={settings.primaryColor}
          onChange={(e) => onChange('primaryColor', e.target.value)}
          className="w-12 h-8 rounded cursor-pointer"
        />
      </SettingRow>
      <SettingRow label="Logo URL" description="URL to organization logo">
        <input
          type="url"
          value={settings.logoUrl}
          onChange={(e) => onChange('logoUrl', e.target.value)}
          className="w-64 px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="https://..."
        />
      </SettingRow>
      <SettingRow label="Target State">
        <input
          type="text"
          value={settings.targetState}
          onChange={(e) => onChange('targetState', e.target.value.toUpperCase().slice(0, 2))}
          className="w-20 px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="MI"
          maxLength={2}
        />
      </SettingRow>
      <SettingRow label="Report Header Text">
        <input
          type="text"
          value={settings.reportHeaderText}
          onChange={(e) => onChange('reportHeaderText', e.target.value)}
          className="w-64 px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Campaign Analysis Report"
        />
      </SettingRow>
      <SettingRow label="Report Footer Text">
        <input
          type="text"
          value={settings.reportFooterText}
          onChange={(e) => onChange('reportFooterText', e.target.value)}
          className="w-64 px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Generated by..."
        />
      </SettingRow>
      <SettingRow label="Include Organization Logo" description="Show logo on reports">
        <Toggle checked={settings.includeOrganizationLogo} onChange={(v) => onChange('includeOrganizationLogo', v)} />
      </SettingRow>
    </div>
  );
}

// =============================================================================
// Saved Segments Settings
// =============================================================================

function SavedSegmentsSettings() {
  const [segments, setSegments] = useState<SegmentDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  // Wave 4B: Batch selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Delete confirmation state
  const [deleteSegmentId, setDeleteSegmentId] = useState<string | null>(null);
  const [showBatchDeleteDialog, setShowBatchDeleteDialog] = useState(false);

  useEffect(() => {
    // Load segments on mount
    setSegments(segmentStore.getAll());
    setLoading(false);
  }, []);

  const handleDelete = (id: string) => {
    setDeleteSegmentId(id);
  };

  const confirmDelete = () => {
    if (!deleteSegmentId) return;

    segmentStore.delete(deleteSegmentId);
    setSegments(segmentStore.getAll());
    // Remove from selection if it was selected
    setSelectedIds((prev: Set<string>) => {
      const next = new Set(prev);
      next.delete(deleteSegmentId);
      return next;
    });
    setDeleteSegmentId(null);
  };

  // Wave 4B: Batch delete
  const handleBatchDelete = () => {
    const count = selectedIds.size;
    if (count === 0) return;
    setShowBatchDeleteDialog(true);
  };

  const confirmBatchDelete = () => {
    const deletedCount = segmentStore.deleteMany(Array.from(selectedIds));
    setSegments(segmentStore.getAll());
    setSelectedIds(new Set());
    setShowBatchDeleteDialog(false);
    console.log(`Deleted ${deletedCount} segments`);
  };

  // Wave 4B: Batch export
  const handleBatchExport = () => {
    if (selectedIds.size === 0) return;
    segmentStore.exportManyToFile(Array.from(selectedIds));
  };

  // Wave 4B: Toggle selection
  const toggleSelection = (id: string) => {
    setSelectedIds((prev: Set<string>) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Wave 4B: Toggle select all
  const toggleSelectAll = () => {
    if (selectedIds.size === segments.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(segments.map(s => s.id)));
    }
  };

  const handleRename = (id: string, newName: string) => {
    const segment = segmentStore.getById(id);
    if (segment) {
      segmentStore.save({ ...segment, name: newName });
      setSegments(segmentStore.getAll());
      setEditingSegmentId(null);
      setEditingName('');
    }
  };

  const handleExport = (segment: SegmentDefinition) => {
    const json = JSON.stringify(segment, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${segment.name.replace(/\s+/g, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportAll = () => {
    const json = segmentStore.exportToJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'voter-segments.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const startEditing = (segment: SegmentDefinition) => {
    setEditingSegmentId(segment.id);
    setEditingName(segment.name);
  };

  const cancelEditing = () => {
    setEditingSegmentId(null);
    setEditingName('');
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  // Wave 4B: Selection helpers
  const allSelected = selectedIds.size === segments.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < segments.length;

  if (segments.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 text-center">
        <Users className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
        <h3 className="font-medium text-gray-900 dark:text-white mb-1">No Saved Segments</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Segments you create in the Segments tool will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with batch actions */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {segments.length} segment{segments.length !== 1 ? 's' : ''} saved
          </p>
          {selectedIds.size > 0 && (
            <span className="text-sm font-medium text-[#33a852] dark:text-green-400">
              {selectedIds.size} selected
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {selectedIds.size > 0 ? (
            <>
              <button
                onClick={handleBatchExport}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-[#33a852] hover:bg-green-600 text-white rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                Export Selected ({selectedIds.size})
              </button>
              <button
                onClick={handleBatchDelete}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete Selected ({selectedIds.size})
              </button>
            </>
          ) : (
            <button
              onClick={handleExportAll}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Export All
            </button>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        {/* Select All Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
          <input
            type="checkbox"
            checked={allSelected}
            ref={input => {
              if (input) {
                input.indeterminate = someSelected;
              }
            }}
            onChange={toggleSelectAll}
            className="w-4 h-4 text-[#33a852] bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-[#33a852] focus:ring-2"
          />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Select All
          </span>
        </div>

        {/* Segment List */}
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {segments.map(segment => (
            <div key={segment.id} className="p-4">
              <div className="flex items-start gap-3">
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={selectedIds.has(segment.id)}
                  onChange={() => toggleSelection(segment.id)}
                  className="mt-1 w-4 h-4 text-[#33a852] bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-[#33a852] focus:ring-2"
                />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {editingSegmentId === segment.id ? (
                    // Edit mode
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRename(segment.id, editingName);
                          if (e.key === 'Escape') cancelEditing();
                        }}
                        className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#33a852]"
                        placeholder="Segment name"
                        autoFocus
                      />
                      <button
                        onClick={() => handleRename(segment.id, editingName)}
                        className="p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                        title="Save"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={cancelEditing}
                        className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        title="Cancel"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    // Display mode
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 dark:text-white">{segment.name}</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                          {segment.cachedResults?.precinctCount || 0} precincts • Created {new Date(segment.createdAt).toLocaleDateString()}
                        </p>
                        {segment.description && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{segment.description}</p>
                        )}
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => startEditing(segment)}
                          className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          title="Rename segment"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleExport(segment)}
                          className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          title="Export segment"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(segment.id)}
                          className="p-2 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Delete segment"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Single Delete Confirmation Dialog */}
      <AlertDialog open={deleteSegmentId !== null} onOpenChange={(open: boolean) => !open && setDeleteSegmentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Segment?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this segment? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteSegmentId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Batch Delete Confirmation Dialog */}
      <AlertDialog open={showBatchDeleteDialog} onOpenChange={setShowBatchDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} Segment{selectedIds.size > 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedIds.size} segment{selectedIds.size > 1 ? 's' : ''}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowBatchDeleteDialog(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBatchDelete}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              Delete {selectedIds.size} Segment{selectedIds.size > 1 ? 's' : ''}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// =============================================================================
// Campaign Calendar Widget - Visual timeline of campaign deadlines
// =============================================================================

interface CalendarDeadline {
  name: string;
  date: string;
  daysUntil: number;
  isPast: boolean;
  isUrgent: boolean;
  type: 'election' | 'registration' | 'voting' | 'custom';
}

function CampaignCalendarWidget({ settings }: { settings: AllSettings['campaign'] }) {
  const getDeadlines = (): CalendarDeadline[] => {
    const today = new Date();
    const deadlines: CalendarDeadline[] = [];

    const addDeadline = (name: string, dateStr: string | null, type: CalendarDeadline['type']) => {
      if (!dateStr) return;
      const date = new Date(dateStr);
      const daysUntil = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      deadlines.push({
        name,
        date: dateStr,
        daysUntil,
        isPast: daysUntil < 0,
        isUrgent: daysUntil >= 0 && daysUntil <= 7,
        type,
      });
    };

    // Add all deadlines
    addDeadline('Primary Election', settings.primaryDate, 'election');
    addDeadline('General Election', settings.generalElectionDate, 'election');
    addDeadline('Voter Registration Deadline', settings.voterRegistrationDeadline, 'registration');
    addDeadline('Early Voting Starts', settings.earlyVotingStart, 'voting');
    addDeadline('Early Voting Ends', settings.earlyVotingEnd, 'voting');
    addDeadline('Absentee Request Deadline', settings.absenteeRequestDeadline, 'voting');

    // Add custom deadlines
    settings.customDeadlines?.forEach((d) => {
      addDeadline(d.name, d.date, 'custom');
    });

    // Sort by date
    return deadlines.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const deadlines = getDeadlines();
  const upcomingDeadlines = deadlines.filter((d) => !d.isPast);
  const pastDeadlines = deadlines.filter((d) => d.isPast);

  const getTypeIcon = (type: CalendarDeadline['type']) => {
    switch (type) {
      case 'election':
        return <Calendar className="w-4 h-4 text-blue-600" />;
      case 'registration':
        return <Users className="w-4 h-4 text-purple-600" />;
      case 'voting':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'custom':
        return <Clock className="w-4 h-4 text-orange-600" />;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Upcoming Deadlines */}
      <div className="bg-white rounded-lg border">
        <div className="px-4 py-3 border-b bg-gray-50">
          <h3 className="font-medium text-gray-900">Upcoming Deadlines</h3>
        </div>
        {upcomingDeadlines.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <CalendarDays className="w-10 h-10 mx-auto text-gray-300 mb-2" />
            <p>No upcoming deadlines configured</p>
            <p className="text-sm mt-1">Edit Campaign settings to add dates</p>
          </div>
        ) : (
          <div className="divide-y">
            {upcomingDeadlines.map((deadline) => (
              <div
                key={deadline.name}
                className={`p-4 flex items-center justify-between ${deadline.isUrgent ? 'bg-red-50' : ''
                  }`}
              >
                <div className="flex items-center gap-3">
                  {getTypeIcon(deadline.type)}
                  <div>
                    <p className="font-medium text-gray-900">{deadline.name}</p>
                    <p className="text-sm text-gray-500">{formatDate(deadline.date)}</p>
                  </div>
                </div>
                <div className="text-right">
                  {deadline.isUrgent ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                      <AlertCircle className="w-3 h-3" />
                      {deadline.daysUntil === 0 ? 'Today!' : `${deadline.daysUntil} days`}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-500">
                      {deadline.daysUntil} days away
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Past Deadlines */}
      {pastDeadlines.length > 0 && (
        <div className="bg-white rounded-lg border">
          <div className="px-4 py-3 border-b bg-gray-50">
            <h3 className="font-medium text-gray-500">Past Deadlines</h3>
          </div>
          <div className="divide-y opacity-60">
            {pastDeadlines.map((deadline) => (
              <div key={deadline.name} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getTypeIcon(deadline.type)}
                  <div>
                    <p className="font-medium text-gray-600 line-through">{deadline.name}</p>
                    <p className="text-sm text-gray-400">{formatDate(deadline.date)}</p>
                  </div>
                </div>
                <span className="text-sm text-gray-400">
                  {Math.abs(deadline.daysUntil)} days ago
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="bg-gray-50 rounded-lg p-4">
        <p className="text-xs font-medium text-gray-500 mb-2">Deadline Types</p>
        <div className="flex flex-wrap gap-4 text-sm">
          <span className="flex items-center gap-1">
            <Calendar className="w-4 h-4 text-blue-600" /> Election
          </span>
          <span className="flex items-center gap-1">
            <Users className="w-4 h-4 text-purple-600" /> Registration
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4 text-green-600" /> Voting Period
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4 text-orange-600" /> Custom
          </span>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Team Placeholder
// =============================================================================

function TeamPlaceholder() {
  return (
    <div className="bg-white rounded-lg border p-8 text-center">
      <UsersRound className="w-16 h-16 mx-auto text-gray-300 mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">Team Management</h3>
      <p className="text-gray-500 mb-6 max-w-md mx-auto">
        Invite team members, assign roles, and collaborate on campaign analysis.
        Share segments and reports with your team.
      </p>
      <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
        <Clock className="w-4 h-4" />
        Coming Soon
      </div>
      <div className="mt-6 pt-6 border-t">
        <p className="text-sm text-gray-500 mb-3">Planned Features:</p>
        <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto text-sm text-left">
          <div className="flex items-center gap-2 text-gray-600">
            <CheckCircle2 className="w-4 h-4 text-gray-400" />
            <span>User invitations</span>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <CheckCircle2 className="w-4 h-4 text-gray-400" />
            <span>Role-based access</span>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <CheckCircle2 className="w-4 h-4 text-gray-400" />
            <span>Shared segments</span>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <CheckCircle2 className="w-4 h-4 text-gray-400" />
            <span>Activity history</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// VAN API Placeholder
// =============================================================================

function VANApiPlaceholder() {
  return (
    <div className="bg-white rounded-lg border p-8 text-center">
      <Link2 className="w-16 h-16 mx-auto text-gray-300 mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">VAN/VoteBuilder Integration</h3>
      <p className="text-gray-500 mb-6 max-w-md mx-auto">
        Connect to NGP VAN to sync voter data, export canvassing lists,
        and import contact results directly into your campaign database.
      </p>
      <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
        <Clock className="w-4 h-4" />
        Coming Soon
      </div>
      <div className="mt-6 pt-6 border-t">
        <p className="text-sm text-gray-500 mb-3">Planned Features:</p>
        <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto text-sm text-left">
          <div className="flex items-center gap-2 text-gray-600">
            <CheckCircle2 className="w-4 h-4 text-gray-400" />
            <span>Voter file sync</span>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <CheckCircle2 className="w-4 h-4 text-gray-400" />
            <span>Export to MiniVAN</span>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <CheckCircle2 className="w-4 h-4 text-gray-400" />
            <span>Contact result import</span>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <CheckCircle2 className="w-4 h-4 text-gray-400" />
            <span>Survey response sync</span>
          </div>
        </div>
      </div>
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <p className="text-xs text-gray-500">
          VAN integration requires an active NGP VAN subscription and API key.
          Contact your state party for access.
        </p>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <ErrorBoundary fallbackTitle="Settings Error">
      <React.Suspense fallback={
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
            <p className="text-gray-600 text-sm">Loading...</p>
          </div>
        </div>
      }>
        <SettingsPageContent />
      </React.Suspense>
    </ErrorBoundary>
  );
}
