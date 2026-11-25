import { useCallback, useEffect, useState } from 'react';

const MAX_HISTORY = 30;

/**
 * Local Undo / Redo stack for Silicon Architect drafts with Ctrl+Z / Ctrl+Y support.
 */
export function useDraftHistory<T>(
  current: T,
  onApply: (next: T) => void
): {
  pushAndApply: (next: T) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  clearHistory: () => void;
} {
  const [past, setPast] = useState<T[]>([]);
  const [future, setFuture] = useState<T[]>([]);

  const pushAndApply = useCallback(
    (next: T) => {
      setPast((prev) => [...prev.slice(-(MAX_HISTORY - 1)), current]);
      setFuture([]);
      onApply(next);
    },
    [current, onApply]
  );

  const undo = useCallback(() => {
    setPast((prev) => {
      if (prev.length === 0) return prev;
      const previous = prev[prev.length - 1];
      setFuture((f) => [current, ...f.slice(0, MAX_HISTORY - 1)]);
      onApply(previous);
      return prev.slice(0, -1);
    });
  }, [current, onApply]);

  const redo = useCallback(() => {
    setFuture((prev) => {
      if (prev.length === 0) return prev;
      const next = prev[0];
      setPast((p) => [...p.slice(-(MAX_HISTORY - 1)), current]);
      onApply(next);
      return prev.slice(1);
    });
  }, [current, onApply]);

  const clearHistory = useCallback(() => {
    setPast([]);
    setFuture([]);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        if (past.length > 0) {
          e.preventDefault();
          undo();
        }
      } else if (
        (e.ctrlKey || e.metaKey) &&
        (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))
      ) {
        if (future.length > 0) {
          e.preventDefault();
          redo();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [past.length, future.length, undo, redo]);

  return {
    pushAndApply,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    clearHistory,
  };
}
