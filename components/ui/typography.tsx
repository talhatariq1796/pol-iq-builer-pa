"use client";

import React from 'react';

interface TypographyProps {
  variant?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'body1' | 'body2';
  className?: string;
  children: React.ReactNode;
}

export const Typography: React.FC<TypographyProps> = ({
  variant = 'body1',
  className = '',
  children
}) => {
  const baseStyles = {
    h1: 'text-4xl font-bold',
    h2: 'text-3xl font-bold',
    h3: 'text-2xl font-bold',
    h4: 'text-xl font-semibold',
    h5: 'text-lg font-semibold',
    h6: 'text-base font-semibold',
    body1: 'text-base',
    body2: 'text-sm'
  };

  const getElement = (variant: string): 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' => {
    if (variant.startsWith('h')) {
      return variant as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
    }
    return 'p';
  };

  const Element = getElement(variant);

  return (
    <Element className={`${baseStyles[variant]} ${className}`}>
      {children}
    </Element>
  );
}; 