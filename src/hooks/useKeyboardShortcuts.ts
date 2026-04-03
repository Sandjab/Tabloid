import { useEffect, useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useUndoRedo } from './useUndoRedo';
import { useSchemaStore } from '@/store/useSchemaStore';
import { isMac } from '@/utils/platform';

interface KeyboardShortcutsOptions {
  onSearchOpen: () => void;
}

export function useKeyboardShortcuts({ onSearchOpen }: KeyboardShortcutsOptions) {
  const { undo, redo } = useUndoRedo();
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const mod = isMac ? e.metaKey : e.ctrlKey;

      if (mod) {
        switch (e.key) {
          case 'z':
            e.preventDefault();
            if (e.shiftKey) {
              redo();
            } else {
              undo();
            }
            break;
          case 'y':
            if (!isMac) {
              e.preventDefault();
              redo();
            }
            break;
          case 'd': {
            e.preventDefault();
            const selectedNodes = useSchemaStore.getState().nodes.filter((n) => n.selected);
            for (const node of selectedNodes) {
              useSchemaStore.getState().duplicateTable(node.id);
            }
            break;
          }
          case 's':
            e.preventDefault();
            break;
          case 'a':
            e.preventDefault();
            useSchemaStore.getState().onNodesChange(
              useSchemaStore.getState().nodes.map((n) => ({
                type: 'select' as const,
                id: n.id,
                selected: true,
              })),
            );
            break;
          case 'f':
            e.preventDefault();
            onSearchOpen();
            break;
          case '=':
          case '+':
            e.preventDefault();
            zoomIn();
            break;
          case '-':
            e.preventDefault();
            zoomOut();
            break;
          case '0':
            e.preventDefault();
            fitView({ padding: 0.2 });
            break;
        }
      }
    },
    [undo, redo, zoomIn, zoomOut, fitView, onSearchOpen],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
