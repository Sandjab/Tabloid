import { useEffect, useRef } from 'react';
import { useSchemaStore } from '@/store/useSchemaStore';
import { exportJSON } from '@/utils/export-json';
import { importJSON } from '@/utils/import-json';

const STORAGE_KEY = 'tabloid-schema';
const DEBOUNCE_MS = 500;

export function loadFromLocalStorage(): boolean {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;
  try {
    const { tables, relations } = importJSON(raw);
    useSchemaStore.getState().loadSchema(tables, relations);
    return true;
  } catch {
    return false;
  }
}

export function useAutoSave() {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const prevRef = useRef<{ tables: unknown; relations: unknown }>({ tables: null, relations: null });

  useEffect(() => {
    const unsubscribe = useSchemaStore.subscribe((state) => {
      if (state.tables === prevRef.current.tables && state.relations === prevRef.current.relations) {
        return;
      }
      prevRef.current = { tables: state.tables, relations: state.relations };

      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        const json = exportJSON(state.tables, state.relations, 'autosave');
        localStorage.setItem(STORAGE_KEY, json);
      }, DEBOUNCE_MS);
    });
    return () => {
      clearTimeout(timerRef.current);
      unsubscribe();
    };
  }, []);
}
