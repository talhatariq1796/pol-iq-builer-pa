import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}

export function Modal({ isOpen, onClose, children, title }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative z-50 w-[90vw] h-[90vh] theme-dialog rounded-lg theme-shadow-primary flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b flex-shrink-0">
          <h2 className="text-xs font-semibold">{title}</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}