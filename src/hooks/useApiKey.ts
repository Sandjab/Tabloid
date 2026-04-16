import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'tabloid-anthropic-key';

type Listener = () => void;
const listeners = new Set<Listener>();

function emit(): void {
  for (const l of listeners) l();
}

function getSnapshot(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function getServerSnapshot(): string {
  return '';
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  // Also listen to cross-tab storage events so the UI stays consistent if
  // the user sets/clears the key in another tab.
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function useApiKey(): {
  key: string;
  hasKey: boolean;
  setKey: (value: string) => void;
  clearKey: () => void;
} {
  const key = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    key,
    hasKey: key.length > 0,
    setKey: (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return;
      try {
        localStorage.setItem(STORAGE_KEY, trimmed);
      } catch { /* storage quota / private mode */ }
      emit();
    },
    clearKey: () => {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch { /* ignore */ }
      emit();
    },
  };
}

// For use outside React components (e.g. unit tests that call AI utils directly).
export function readApiKey(): string {
  return getSnapshot();
}
