'use client';

import React from 'react';
import { X, Command } from 'lucide-react';

interface ShortcutItem {
  keys: string[];
  action: string;
  category: 'navigation' | 'ai' | 'actions' | 'map';
}

const shortcuts: ShortcutItem[] = [
  // AI Shortcuts
  { keys: ['⌘', 'K'], action: 'Focus AI input', category: 'ai' },
  { keys: ['⌘', 'Enter'], action: 'Submit message', category: 'ai' },
  { keys: ['Escape'], action: 'Close panel / Clear selection', category: 'ai' },

  // Action Shortcuts
  { keys: ['⌘', 'S'], action: 'Save current segment', category: 'actions' },
  { keys: ['⌘', 'E'], action: 'Export to CSV', category: 'actions' },
  { keys: ['⌘', 'P'], action: 'Generate report', category: 'actions' },

  // Navigation Shortcuts
  { keys: ['⌘', '1'], action: 'Go to Main Analysis', category: 'navigation' },
  { keys: ['⌘', '2'], action: 'Go to Segments', category: 'navigation' },
  { keys: ['⌘', '3'], action: 'Go to Donors', category: 'navigation' },
  { keys: ['⌘', '4'], action: 'Go to Canvassing', category: 'navigation' },

  // Map Shortcuts
  { keys: ['⌘', 'M'], action: 'Toggle map panel', category: 'map' },
  { keys: ['+'], action: 'Zoom in', category: 'map' },
  { keys: ['-'], action: 'Zoom out', category: 'map' },
  { keys: ['R'], action: 'Reset map view', category: 'map' },

  // Help
  { keys: ['?'], action: 'Show this help', category: 'navigation' },
];

interface KeyboardShortcutsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcuts({ isOpen, onClose }: KeyboardShortcutsProps) {
  if (!isOpen) return null;

  const categories = {
    ai: 'AI Assistant',
    actions: 'Quick Actions',
    navigation: 'Navigation',
    map: 'Map Controls',
  };

  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) acc[shortcut.category] = [];
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, ShortcutItem[]>);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Command className="w-5 h-5 text-[#33a852]" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
          {Object.entries(groupedShortcuts).map(([category, items]) => (
            <div key={category} className="mb-6 last:mb-0">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                {categories[category as keyof typeof categories]}
              </h3>
              <div className="space-y-2">
                {items.map((shortcut, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-1.5"
                  >
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {shortcut.action}
                    </span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIndex) => (
                        <kbd
                          key={keyIndex}
                          className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600"
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 text-center">
            Press <kbd className="px-1.5 py-0.5 text-xs bg-white border rounded">?</kbd> anytime to show shortcuts
          </p>
        </div>
      </div>
    </div>
  );
}
