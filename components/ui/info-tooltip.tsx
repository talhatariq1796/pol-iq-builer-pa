import React, { useState } from 'react';
import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface InfoTooltipProps {
  title: string;
  description: string;
  formula?: string;
  example?: string;
  className?: string;
}

export const InfoTooltip: React.FC<InfoTooltipProps> = ({
  title,
  description,
  formula,
  example,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Tooltip open={isOpen} onOpenChange={(open: boolean) => {
      // Only allow closing, not opening via hover
      if (!open) {
        setIsOpen(false);
      }
    }}>
      <TooltipTrigger asChild>
        <button
          className={`inline-flex items-center justify-center w-4 h-4 ml-1 transition-colors ${className}`}
          style={{ 
            color: 'var(--theme-text-muted)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--theme-accent-primary)';
            e.preventDefault();
            e.stopPropagation();
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--theme-text-muted)';
            e.preventDefault();
            e.stopPropagation();
          }}
          onPointerEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onPointerLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={(e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          aria-label={`Info about ${title}`}
        >
          <Info className="w-3.5 h-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm p-3 space-y-2 theme-tooltip">
        <div className="font-semibold text-xs" style={{ color: 'var(--theme-text-primary)' }}>{title}</div>
        <div className="text-xs" style={{ color: 'var(--theme-text-secondary)' }}>{description}</div>
        {formula && (
          <div className="text-xs">
            <span className="font-semibold" style={{ color: 'var(--theme-text-primary)' }}>Formula: </span>
            <code className="theme-code text-[11px]">{formula}</code>
          </div>
        )}
        {example && (
          <div className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
            <span className="font-semibold" style={{ color: 'var(--theme-text-primary)' }}>Example: </span>
            {example}
          </div>
        )}
      </TooltipContent>
    </Tooltip>
  );
};