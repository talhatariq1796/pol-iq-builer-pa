'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  // Initialize theme on mount
  useEffect(() => {
    // Check localStorage first but default to light
    const savedTheme = localStorage.getItem('theme') as Theme;
    console.log('🎨 [THEME INIT] Saved theme from localStorage:', savedTheme);
    
    if (savedTheme === 'dark') {
      console.log('🎨 [THEME INIT] Found dark theme in localStorage, but defaulting to light');
      // Override dark theme preference and start with light
      setThemeState('light');
      localStorage.setItem('theme', 'light');
    } else {
      // Use saved theme or default to light
      const themeToUse = savedTheme === 'light' ? 'light' : 'light';
      console.log('🎨 [THEME INIT] Using theme:', themeToUse);
      setThemeState(themeToUse);
      localStorage.setItem('theme', themeToUse);
    }
    setMounted(true);
  }, []);

  // Apply theme to document
  useEffect(() => {
    if (!mounted) return;
    
    // Set protection flags
    document.documentElement.setAttribute('data-theme-switching', 'true');
    window.__themeTransitioning = true;
    
    console.log(`🎨 [THEME SWITCH] Switching to ${theme} theme with protection flags set`);
    
    // Apply theme change
    requestAnimationFrame(() => {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('theme', theme);
      
      // Notify widgets about theme change
      window.dispatchEvent(new CustomEvent('theme-changed', { 
        detail: { theme, timestamp: Date.now() }
      }));
    });
    
    // Remove protection flags after delay
    setTimeout(() => {
      document.documentElement.removeAttribute('data-theme-switching');
      window.__themeTransitioning = false;
      console.log('🎨 [THEME SWITCH] Protection flags removed');
    }, 2000);
  }, [theme, mounted]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    setThemeState((prevTheme: any) => prevTheme === 'light' ? 'dark' : 'light');
  };

  // Prevent hydration mismatch - always render children with theme context
  // Don't conditionally render to avoid component unmounting
  return (
    <ThemeContext.Provider value={{ theme: mounted ? theme : 'light', toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export default ThemeProvider;