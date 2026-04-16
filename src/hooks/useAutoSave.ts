import { useEffect, useRef } from 'react';
import { useSchemaStore } from '@/store/useSchemaStore';
import { exportJSON } from '@/utils/export-json';
import { importJSON } from '@/utils/import-json';
import type { Table, Relation, DialectId } from '@/types/schema';

const RECENT_KEY = 'tabloid-recent';
const SCHEMA_PREFIX = 'tabloid-schema-';
const OLD_KEY = 'tabloid-schema';
const MAX_RECENT = 5;
const DEBOUNCE_MS = 500;

export interface RecentEntry {
  name: string;
  tableCount: number;
}

export function getRecentList(): RecentEntry[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecentList(list: RecentEntry[]): void {
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
}

function updateRecentEntry(name: string, tableCount: number): void {
  const list = getRecentList().filter((e) => e.name !== name);
  list.unshift({ name, tableCount });
  saveRecentList(list);
}

function removeRecentEntry(name: string): void {
  const list = getRecentList().filter((e) => e.name !== name);
  saveRecentList(list);
}

function saveSchema(name: string, tables: Table[], relations: Relation[], dialect: DialectId = 'generic'): void {
  const json = exportJSON(tables, relations, name, dialect);
  localStorage.setItem(SCHEMA_PREFIX + name, json);
  updateRecentEntry(name, tables.length);
}

export function saveCurrentSchema(): void {
  const { schemaName, tables, relations, dialect } = useSchemaStore.getState();
  saveSchema(schemaName, tables, relations, dialect);
}

export function loadSchemaByName(name: string): boolean {
  const raw = localStorage.getItem(SCHEMA_PREFIX + name);
  if (!raw) return false;
  try {
    const { tables, relations, name: importedName, dialect } = importJSON(raw);
    useSchemaStore.getState().loadSchema(tables, relations, importedName || name, dialect);
    return true;
  } catch {
    return false;
  }
}

export function renameStoredSchema(oldName: string, newName: string): void {
  const raw = localStorage.getItem(SCHEMA_PREFIX + oldName);
  if (raw) {
    localStorage.removeItem(SCHEMA_PREFIX + oldName);
    localStorage.setItem(SCHEMA_PREFIX + newName, raw);
  }
  const list = getRecentList().map((e) =>
    e.name === oldName ? { ...e, name: newName } : e,
  );
  saveRecentList(list);
}

export function deleteStoredSchema(name: string): void {
  localStorage.removeItem(SCHEMA_PREFIX + name);
  removeRecentEntry(name);
}

export function loadFromLocalStorage(): boolean {
  // Migration: old single-key format
  const oldRaw = localStorage.getItem(OLD_KEY);
  if (oldRaw) {
    try {
      const { tables, relations, dialect } = importJSON(oldRaw);
      useSchemaStore.getState().loadSchema(tables, relations, 'Untitled', dialect);
      saveSchema('Untitled', tables, relations, dialect);
      localStorage.removeItem(OLD_KEY);
      return true;
    } catch {
      localStorage.removeItem(OLD_KEY);
    }
  }

  // Load most recent schema
  const recent = getRecentList();
  if (recent.length > 0) {
    return loadSchemaByName(recent[0].name);
  }
  return false;
}

export function useAutoSave() {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const prevRef = useRef<{ tables: unknown; relations: unknown; schemaName: unknown; dialect: unknown }>({
    tables: null,
    relations: null,
    schemaName: null,
    dialect: null,
  });

  useEffect(() => {
    const unsubscribe = useSchemaStore.subscribe((state) => {
      if (
        state.tables === prevRef.current.tables &&
        state.relations === prevRef.current.relations &&
        state.schemaName === prevRef.current.schemaName &&
        state.dialect === prevRef.current.dialect
      ) {
        return;
      }
      prevRef.current = { tables: state.tables, relations: state.relations, schemaName: state.schemaName, dialect: state.dialect };

      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        saveSchema(state.schemaName, state.tables, state.relations, state.dialect);
      }, DEBOUNCE_MS);
    });
    return () => {
      clearTimeout(timerRef.current);
      unsubscribe();
    };
  }, []);
}
