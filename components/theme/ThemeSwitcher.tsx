'use client';

import React, { useEffect, useState } from 'react';
import { useTheme } from './ThemeProvider';

interface ThemeSwitcherProps {
  className?: string;
  style?: React.CSSProperties;
}

export function ThemeSwitcher({ className = '', style = {} }: ThemeSwitcherProps) {
  // Use light theme as default fallback
  let theme = 'light';
  let toggleTheme = () => {};
  
  try {
    const themeContext = useTheme();
    theme = themeContext.theme;
    toggleTheme = themeContext.toggleTheme;
  } catch (error) {
    // Silently use default values if context not available
  }
  
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // Check for reduced motion preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return (
    <button
      onClick={toggleTheme}
      className={`theme-switcher ${className}`}
      style={{
        position: 'relative',
        width: '24px',
        height: '24px',
        border: '1px solid var(--theme-border)',
        borderRadius: '50%',
        backgroundColor: 'var(--theme-bg-tertiary)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.3s ease',
        boxShadow: theme === 'dark' 
          ? '0 0 8px var(--theme-accent-primary)' 
          : '0 1px 4px rgba(0,0,0,0.2)',
        ...style
      }}
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      {/* Icon Container */}
      <div
        style={{
          width: '12px',
          height: '12px',
          position: 'relative',
          transition: 'transform 0.3s ease',
          transform: theme === 'light' ? 'rotate(180deg)' : 'rotate(0deg)'
        }}
      >
        {theme === 'dark' ? (
          // Moon icon for dark mode
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--theme-accent-primary)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        ) : (
          // Sun icon for light mode
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--theme-accent-primary)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="5" />
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
        )}
      </div>
      
      {/* Glow effect for dark mode (respects reduced motion preference) */}
      {theme === 'dark' && !prefersReducedMotion && (
        <div
          style={{
            position: 'absolute',
            inset: '-4px',
            borderRadius: '50%',
            background: `radial-gradient(circle, var(--theme-accent-primary) 0%, transparent 70%)`,
            opacity: 0.3,
            animation: 'firefly-glow 2s ease-in-out infinite alternate',
            pointerEvents: 'none'
          }}
        />
      )}
      
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes firefly-glow {
          0% {
            opacity: 0.2;
            transform: scale(1);
          }
          100% {
            opacity: 0.4;
            transform: scale(1.1);
          }
        }

        .theme-switcher:hover {
          transform: scale(1.05);
          border-color: var(--theme-accent-primary);
        }

        .theme-switcher:active {
          transform: scale(0.95);
        }
      ` }} />
    </button>
  );
}

export default ThemeSwitcher;