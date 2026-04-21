"use client"

import React from 'react';

// Define the context type and create the context first
// Context definition moved to top
interface TabsContextType {
  value: string;
  onValueChange: (value: string) => void;
}

const TabsContext = React.createContext(null as TabsContextType | null);

interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  'aria-label'?: string;
  className?: string;
  children: React.ReactNode;
}

interface TabsListProps {
  className?: string;
  children: React.ReactNode;
}

interface TabsTriggerProps {
  value: string;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}

interface TabsContentProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  value,
  onValueChange,
  'aria-label': ariaLabel,
  className = '',
  children
}) => {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div
        role="tablist"
        aria-label={ariaLabel}
        className={`flex flex-col ${className}`}
      >
        {children}
      </div>
    </TabsContext.Provider>
  );
};

export const TabsList: React.FC<TabsListProps> = ({
  className = '',
  children
}) => {
  return (
    <div
      role="tablist"
      className={`flex ${className}`}
      style={{ borderBottom: '1px solid var(--theme-border)' }}
    >
      {children}
    </div>
  );
};

export const TabsTrigger: React.FC<TabsTriggerProps> = ({
  value,
  disabled,
  children,
  className = ''
}) => {
  const context = React.useContext(TabsContext);
  const isSelected = context?.value === value;

  return (
    <button
      role="tab"
      aria-selected={isSelected}
      onClick={() => context?.onValueChange(value)}
      disabled={disabled}
      className={`
        px-4 py-2 text-xs font-medium
        ${isSelected ? 'theme-tab-active' : 'theme-tab-inactive'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        transition-colors duration-200
        ${className}
      `}
    >
      {children}
    </button>
  );
};

export const TabsContent: React.FC<TabsContentProps> = ({
  value,
  children,
  className = ''
}) => {
  const context = React.useContext(TabsContext);
  const isSelected = context?.value === value;

  if (!isSelected) return null;

  return (
    <div
      role="tabpanel"
      className={`mt-2 ${className}`}
    >
      {children}
    </div>
  );
};

export const TabsProvider: React.FC<TabsContextType & { children: React.ReactNode }> = ({
  value,
  onValueChange,
  children
}) => {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      {children}
    </TabsContext.Provider>
  );
};