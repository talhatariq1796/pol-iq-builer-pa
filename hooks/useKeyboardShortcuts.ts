import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface ShortcutHandlers {
  onShowHelp?: () => void;
  onFocusInput?: () => void;
  onSave?: () => void;
  onExport?: () => void;
  onToggleMap?: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  const router = useRouter();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ignore if typing in input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

    // ? for help (no modifier needed)
    if (e.key === '?' && !cmdOrCtrl && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      handlers.onShowHelp?.();
      return;
    }

    // Cmd+K for focus input
    if (cmdOrCtrl && e.key === 'k') {
      e.preventDefault();
      handlers.onFocusInput?.();
      return;
    }

    // Cmd+S for save
    if (cmdOrCtrl && e.key === 's') {
      e.preventDefault();
      handlers.onSave?.();
      return;
    }

    // Cmd+E for export
    if (cmdOrCtrl && e.key === 'e') {
      e.preventDefault();
      handlers.onExport?.();
      return;
    }

    // Cmd+M for map toggle
    if (cmdOrCtrl && e.key === 'm') {
      e.preventDefault();
      handlers.onToggleMap?.();
      return;
    }

    // Cmd+1-4 for navigation
    if (cmdOrCtrl && ['1', '2', '3', '4'].includes(e.key)) {
      e.preventDefault();
      const routes = ['/political-ai', '/segments'];
      router.push(routes[parseInt(e.key) - 1]);
      return;
    }
  }, [handlers, router]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
