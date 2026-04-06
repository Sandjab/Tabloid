import { nanoid } from 'nanoid';
import type { HandleSide } from '@/types/schema';

export function createTableId(): string {
  return `table_${nanoid(8)}`;
}

export function createColumnId(): string {
  return `col_${nanoid(8)}`;
}

export function createRelationId(): string {
  return `rel_${nanoid(8)}`;
}

/** Build a handle ID for edge construction: `{colId}-{side}-{source|target}` */
export function makeEdgeHandleId(columnId: string, side: HandleSide, type: 'source' | 'target'): string {
  return `${columnId}-${side}-${type}`;
}

/** Extract the column ID from any handle ID format */
export function parseHandleId(handleId: string | null): string {
  if (!handleId) return '';
  return handleId.replace(/-(?:left|right)(?:-(?:source|target))?$/, '');
}

/** Extract the side from a handle ID */
export function parseHandleSide(handleId: string | null): HandleSide {
  if (!handleId) return 'right';
  if (handleId.includes('-left')) return 'left';
  return 'right';
}
