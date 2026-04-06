import type { Node, Edge } from '@xyflow/react';

// --- Column Types (abstract, SGBD-agnostic) ---

export type ColumnType =
  | 'TEXT'
  | 'INTEGER'
  | 'BIGINT'
  | 'SMALLINT'
  | 'DECIMAL'
  | 'FLOAT'
  | 'BOOLEAN'
  | 'DATE'
  | 'TIME'
  | 'TIMESTAMP'
  | 'UUID'
  | 'BLOB'
  | 'JSON'
  | 'SERIAL';

export const COLUMN_TYPES: ColumnType[] = [
  'TEXT',
  'INTEGER',
  'BIGINT',
  'SMALLINT',
  'DECIMAL',
  'FLOAT',
  'BOOLEAN',
  'DATE',
  'TIME',
  'TIMESTAMP',
  'UUID',
  'BLOB',
  'JSON',
  'SERIAL',
];

// --- Column ---

export interface Column {
  id: string;
  name: string;
  type: ColumnType;
  isPrimaryKey: boolean;
  isNullable: boolean;
  isUnique: boolean;
  defaultValue?: string;
  precision?: number;
  scale?: number;
}

// --- Table ---

export interface Table {
  id: string;
  name: string;
  columns: Column[];
  color?: string;
  notes?: string;
  indexes?: Index[];
  position: { x: number; y: number };
}

// --- Index ---

export interface Index {
  id: string;
  name: string;
  columnIds: string[];
  isUnique: boolean;
}

// --- Relation ---

export type RelationType =
  | 'one-to-one'
  | 'one-to-many'
  | 'many-to-one'
  | 'many-to-many';

export const RELATION_TYPE_LABELS: Record<RelationType, { long: string }> = {
  'one-to-one': { long: '1:1 — One to One' },
  'one-to-many': { long: '1:N — One to Many' },
  'many-to-one': { long: 'N:1 — Many to One' },
  'many-to-many': { long: 'N:N — Many to Many' },
};

export const ENDPOINT_LABELS: Record<RelationType, { source: string; target: string }> = {
  'one-to-one':   { source: '1', target: '1' },
  'one-to-many':  { source: '1', target: 'N' },
  'many-to-one':  { source: 'N', target: '1' },
  'many-to-many': { source: 'N', target: 'N' },
};

export const EDGE_COLOR = '#8b9bb5';
export const EDGE_COLOR_SELECTED = '#4f6fa0';

export interface Relation {
  id: string;
  sourceTableId: string;
  sourceColumnId: string;
  targetTableId: string;
  targetColumnId: string;
  type: RelationType;
}

// --- React Flow node data ---

export interface TableNodeData {
  table: Table;
  [key: string]: unknown;
}

export type TableFlowNode = Node<TableNodeData, 'table'>;
export type RelationEdge = Edge;

// --- Schema (document format) ---

export interface Schema {
  version: number;
  name: string;
  tables: Table[];
  relations: Relation[];
}
