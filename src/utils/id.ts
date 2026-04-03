import { nanoid } from 'nanoid';

export function createTableId(): string {
  return `table_${nanoid(8)}`;
}

export function createColumnId(): string {
  return `col_${nanoid(8)}`;
}

export function createRelationId(): string {
  return `rel_${nanoid(8)}`;
}

export function makeHandleId(columnId: string, side: 'source' | 'target'): string {
  return `${columnId}-${side}`;
}

export function parseHandleId(handleId: string | null): string {
  if (!handleId) return '';
  return handleId.replace(/-(?:source|target)$/, '');
}
