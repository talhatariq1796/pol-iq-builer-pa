/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./dialog"

interface ContentModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function ContentModal({ isOpen, onClose, title, children }: ContentModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open: any) => !open && onClose()}>
      <DialogContent className="max-w-[90vw] max-h-[90vh] h-[90vh] w-fit overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="mt-4 flex-1 min-h-0 overflow-y-auto">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}