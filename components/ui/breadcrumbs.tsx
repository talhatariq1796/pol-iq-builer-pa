'use client';

import React from 'react';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface BreadcrumbItem {
  label: string;
  href?: string;
  count?: number;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className = '' }: BreadcrumbsProps) {
  return (
    <nav className={`flex items-center gap-1.5 text-sm ${className}`} aria-label="Breadcrumb">
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
          )}
          {item.href ? (
            <Link
              href={item.href}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              {item.label}
              {item.count !== undefined && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-gray-100 rounded-full">
                  {item.count}
                </span>
              )}
            </Link>
          ) : (
            <span className="text-gray-900 font-medium">
              {item.label}
              {item.count !== undefined && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-[#33a852]/10 text-[#33a852] rounded-full">
                  {item.count}
                </span>
              )}
            </span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}
