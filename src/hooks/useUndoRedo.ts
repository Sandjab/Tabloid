import { useCallback } from 'react';
import { useStore } from 'zustand';
import { useSchemaStore } from '@/store/useSchemaStore';

export function useUndoRedo() {
  const temporalStore = useSchemaStore.temporal;

  const canUndo = useStore(temporalStore, (s) => s.pastStates.length > 0);
  const canRedo = useStore(temporalStore, (s) => s.futureStates.length > 0);

  const undo = useCallback(() => {
    const temporal = temporalStore.getState();
    temporal.undo();
    temporal.pause();
    try {
      useSchemaStore.getState().rebuildNodesFromTables();
    } finally {
      temporal.resume();
    }
  }, [temporalStore]);

  const redo = useCallback(() => {
    const temporal = temporalStore.getState();
    temporal.redo();
    temporal.pause();
    try {
      useSchemaStore.getState().rebuildNodesFromTables();
    } finally {
      temporal.resume();
    }
  }, [temporalStore]);

  return { undo, redo, canUndo, canRedo };
}
