'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Clock, X, Trash2 } from 'lucide-react';
import { getSearchHistoryManager, SearchHistoryManager } from '@/lib/ai-native/SearchHistoryManager';
import type { SearchHistoryEntry } from '@/lib/ai-native/SearchHistoryManager';

interface RecentSearchesProps {
  /** Whether dropdown is visible */
  isOpen: boolean;
  /** Callback when user selects a search */
  onSelect: (query: string) => void;
  /** Callback to close dropdown */
  onClose: () => void;
  /** Optional tool context for filtering */
  tool?: string;
  /** Position relative to input */
  position?: 'above' | 'below';
}

/**
 * Recent Searches Dropdown Component
 *
 * Shows recent AI queries that can be clicked to re-run.
 * Supports keyboard navigation and history management.
 */
export function RecentSearches({
  isOpen,
  onSelect,
  onClose,
  tool,
  position = 'above',
}: RecentSearchesProps) {
  const [searches, setSearches] = useState<SearchHistoryEntry[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const historyManager = useRef(getSearchHistoryManager());

  // Load searches when dropdown opens
  useEffect(() => {
    if (isOpen) {
      const recentSearches = historyManager.current.getRecent(10, tool);
      setSearches(recentSearches);
      setSelectedIndex(-1);
    }
  }, [isOpen, tool]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen || searches.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev: number) =>
          prev < searches.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev: number) =>
          prev > 0 ? prev - 1 : searches.length - 1
        );
        break;
      case 'Enter':
        if (selectedIndex >= 0 && selectedIndex < searches.length) {
          e.preventDefault();
          onSelect(searches[selectedIndex].query);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [isOpen, searches, selectedIndex, onSelect, onClose]);

  // Add keyboard listener
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      // Delay to prevent immediate close on focus
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 100);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  const handleRemove = (e: React.MouseEvent, query: string) => {
    e.stopPropagation();
    historyManager.current.remove(query);
    setSearches((prev: SearchHistoryEntry[]) => prev.filter(s => s.query !== query));
  };

  const handleClearAll = () => {
    historyManager.current.clear();
    setSearches([]);
  };

  if (!isOpen || searches.length === 0) {
    return null;
  }

  const positionClasses = position === 'above'
    ? 'bottom-full mb-2'
    : 'top-full mt-2';

  return (
    <div
      ref={dropdownRef}
      className={`absolute left-0 right-0 ${positionClasses} z-50 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <Clock className="h-3 w-3" />
          <span>Recent searches</span>
        </div>
        <button
          onClick={handleClearAll}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          title="Clear history"
        >
          <Trash2 className="h-3 w-3" />
          Clear
        </button>
      </div>

      {/* Search List */}
      <div className="max-h-64 overflow-y-auto">
        {searches.map((entry, index) => (
          <div
            key={`${entry.query}-${entry.timestamp}`}
            className={`flex items-center justify-between px-3 py-2 cursor-pointer group transition-colors ${
              index === selectedIndex
                ? 'bg-[#33a852]/10 dark:bg-green-900/20'
                : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
            }`}
            onClick={() => onSelect(entry.query)}
            role="option"
            aria-selected={index === selectedIndex}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-700 dark:text-gray-200 truncate">
                {entry.query}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {SearchHistoryManager.formatTimeAgo(entry.timestamp)}
                {entry.tool && (
                  <span className="ml-2 text-gray-300 dark:text-gray-600">
                    • {entry.tool}
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={(e) => handleRemove(e, entry.query)}
              className="ml-2 p-1 text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Remove from history"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>

      {/* Footer hint */}
      <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-400 dark:text-gray-500">
          ↑↓ to navigate • Enter to select • Esc to close
        </p>
      </div>
    </div>
  );
}
