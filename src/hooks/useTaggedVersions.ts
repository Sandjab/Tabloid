import type { DialectId, Relation, Table } from '@/types/schema';
import { exportJSON } from '@/utils/export-json';
import { importJSON } from '@/utils/import-json';

export interface TagMetadata {
  tagName: string;
  createdAt: string;
  tableCount: number;
}

const TAG_PREFIX = 'tabloid-tag-';
const INDEX_PREFIX = 'tabloid-tags-';
const SEPARATOR = '--';

function tagStorageKey(schemaName: string, tagName: string): string {
  return `${TAG_PREFIX}${schemaName}${SEPARATOR}${tagName}`;
}

function indexStorageKey(schemaName: string): string {
  return `${INDEX_PREFIX}${schemaName}`;
}

export function listTags(schemaName: string): TagMetadata[] {
  try {
    const raw = localStorage.getItem(indexStorageKey(schemaName));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeIndex(schemaName: string, list: TagMetadata[]): void {
  localStorage.setItem(indexStorageKey(schemaName), JSON.stringify(list));
}

export function saveTag(
  schemaName: string,
  tagName: string,
  tables: Table[],
  relations: Relation[],
  dialect: DialectId = 'generic',
): void {
  const json = exportJSON(tables, relations, schemaName, dialect);
  localStorage.setItem(tagStorageKey(schemaName, tagName), json);

  const list = listTags(schemaName).filter((t) => t.tagName !== tagName);
  list.unshift({
    tagName,
    createdAt: new Date().toISOString(),
    tableCount: tables.length,
  });
  writeIndex(schemaName, list);
}

export interface LoadedTag {
  tagName: string;
  tables: Table[];
  relations: Relation[];
  createdAt: string;
}

export function loadTag(schemaName: string, tagName: string): LoadedTag | null {
  const raw = localStorage.getItem(tagStorageKey(schemaName, tagName));
  if (!raw) return null;
  try {
    const { tables, relations } = importJSON(raw);
    const meta = listTags(schemaName).find((t) => t.tagName === tagName);
    return {
      tagName,
      tables,
      relations,
      createdAt: meta?.createdAt ?? '',
    };
  } catch {
    return null;
  }
}

export function deleteTag(schemaName: string, tagName: string): void {
  localStorage.removeItem(tagStorageKey(schemaName, tagName));
  writeIndex(
    schemaName,
    listTags(schemaName).filter((t) => t.tagName !== tagName),
  );
}

export function renameSchemaTags(oldSchemaName: string, newSchemaName: string): void {
  const list = listTags(oldSchemaName);
  if (list.length === 0) return;
  for (const t of list) {
    const raw = localStorage.getItem(tagStorageKey(oldSchemaName, t.tagName));
    if (raw) {
      localStorage.setItem(tagStorageKey(newSchemaName, t.tagName), raw);
      localStorage.removeItem(tagStorageKey(oldSchemaName, t.tagName));
    }
  }
  localStorage.removeItem(indexStorageKey(oldSchemaName));
  writeIndex(newSchemaName, list);
}
