'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GitCompare, Users, MessageSquare, Settings } from 'lucide-react';
import Image from 'next/image';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const navItems: NavItem[] = [
  {
    href: '/political-ai',
    label: 'AI Assistant',
    icon: <MessageSquare className="h-5 w-5" />,
    description: 'AI-powered political analysis',
  },
  {
    href: '/compare',
    label: 'Compare',
    icon: <GitCompare className="h-5 w-5" />,
    description: 'Side-by-side comparison',
  },
  {
    href: '/segments',
    label: 'Segments',
    icon: <Users className="h-5 w-5" />,
    description: 'Voter segmentation tool',
  },
];

interface AppNavigationProps {
  variant?: 'sidebar' | 'header';
  className?: string;
}

/**
 * Shared navigation component for the Political Landscape Analysis app.
 * Can be rendered as a vertical sidebar or horizontal header.
 */
export function AppNavigation({ variant = 'sidebar', className = '' }: AppNavigationProps) {
  const pathname = usePathname();

  if (variant === 'header') {
    return (
      <nav className={`flex items-center gap-4 ${className}`}>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800'
                }`}
              title={item.description}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    );
  }

  // Sidebar variant (default)
  return (
    <div
      className={`flex flex-col h-full ${className}`}
      style={{
        backgroundColor: 'var(--theme-bg-secondary)',
        borderRight: '1px solid var(--theme-border)',
      }}
    >
      {/* Logo at top */}
      <div className="p-3 flex justify-center border-b" style={{ borderColor: 'var(--theme-border)' }}>
        <Link href="/" title="Home">
          <Image
            src="/mpiq_pin2.png"
            alt="Political Analysis"
            width={28}
            height={28}
            priority
          />
        </Link>
      </div>

      {/* Navigation items */}
      <nav className="flex-1 flex flex-col items-center py-4 gap-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group relative flex items-center justify-center w-10 h-10 rounded-lg transition-all ${isActive
                ? 'bg-[#33a852] text-white shadow-md'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800'
                }`}
              title={item.label}
            >
              {item.icon}

              {/* Tooltip */}
              <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 pointer-events-none">
                {item.label}
                <span className="block text-gray-400 text-[10px]">{item.description}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Bottom section: Tour and Settings */}
      <div className="pb-4 flex flex-col items-center gap-2 border-t pt-2 " style={{ borderColor: 'var(--theme-border)' }}>
        {/* Guided Tour Button */}
        {/* <div className="group relative flex items-center justify-center w-10 h-10" data-tour="tour-button"> */}
        {/* <GuidedTour
            autoStart={false}
            theme="welcome"
            variant="ghost"
            size="icon"
            showMenu={true}
          /> */}
        {/* Tooltip */}
        {/* <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 pointer-events-none">
            Tours
            <span className="block text-gray-400 text-[10px]">Interactive platform guides</span>
          </div> */}
        {/* </div> */}

        {/* Settings Button */}
        <Link
          href="/settings"
          className={`group relative flex items-center justify-center w-10 h-10 rounded-lg transition-all ${pathname === '/settings'
            ? 'bg-[#33a852] text-white shadow-md'
            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800'
            }`}
          title="Settings"
        >
          <Settings className="h-5 w-5" />

          {/* Tooltip */}
          <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 pointer-events-none">
            Settings
            <span className="block text-gray-400 text-[10px]">Configure your analysis platform</span>
          </div>
        </Link>
      </div>
    </div>
  );
}

/**
 * Navigation buttons only (without container) for embedding in existing toolbars
 */
export function NavigationButtons({ className = '' }: { className?: string }) {
  const pathname = usePathname();

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`group relative flex items-center justify-center w-10 h-10 rounded-lg transition-all ${isActive
              ? 'bg-[#33a852] text-white shadow-md'
              : 'hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            style={{
              color: isActive ? 'white' : 'var(--theme-text-secondary)',
            }}
            title={item.label}
          >
            {item.icon}

            {/* Tooltip */}
            <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 pointer-events-none">
              {item.label}
              <span className="block text-gray-400 text-[10px]">{item.description}</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export default AppNavigation;
