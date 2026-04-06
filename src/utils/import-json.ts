import { COLUMN_TYPES } from '@/types/schema';
import type { Table, Relation, Column, ColumnType, HandleSide } from '@/types/schema';

interface ImportResult {
  tables: Table[];
  relations: Relation[];
  name: string;
}

function isValidColumnType(type: string): type is ColumnType {
  return (COLUMN_TYPES as readonly string[]).includes(type);
}

function validateColumn(col: unknown, index: number, tableId: string): Column {
  if (typeof col !== 'object' || col === null) {
    throw new Error(`Invalid column at index ${index} in table ${tableId}`);
  }
  const c = col as Record<string, unknown>;
  if (typeof c.id !== 'string') throw new Error(`Column missing id in table ${tableId}`);
  if (typeof c.name !== 'string') throw new Error(`Column missing name in table ${tableId}`);
  if (typeof c.type !== 'string' || !isValidColumnType(c.type)) {
    throw new Error(`Invalid column type "${String(c.type)}" in table ${tableId}`);
  }
  return {
    id: c.id,
    name: c.name,
    type: c.type,
    isPrimaryKey: c.isPrimaryKey === true,
    isNullable: c.isNullable !== false,
    isUnique: c.isUnique === true,
    defaultValue: typeof c.defaultValue === 'string' ? c.defaultValue : undefined,
    precision: typeof c.precision === 'number' ? c.precision : undefined,
    scale: typeof c.scale === 'number' ? c.scale : undefined,
  };
}

function validateTable(table: unknown, index: number): Table {
  if (typeof table !== 'object' || table === null) {
    throw new Error(`Invalid table at index ${index}`);
  }
  const t = table as Record<string, unknown>;
  if (typeof t.id !== 'string') throw new Error(`Table at index ${index} missing id`);
  if (typeof t.name !== 'string') throw new Error(`Table at index ${index} missing name`);
  if (!Array.isArray(t.columns)) throw new Error(`Table "${t.name}" missing columns array`);

  const pos = typeof t.position === 'object' && t.position !== null
    ? (t.position as Record<string, unknown>)
    : undefined;
  return {
    id: t.id,
    name: t.name,
    columns: t.columns.map((c: unknown, i: number) => validateColumn(c, i, t.id as string)),
    color: typeof t.color === 'string' ? t.color : undefined,
    notes: typeof t.notes === 'string' ? t.notes : undefined,
    position: {
      x: typeof pos?.x === 'number' ? pos.x : 100 + index * 300,
      y: typeof pos?.y === 'number' ? pos.y : 100,
    },
  };
}

function validateRelation(rel: unknown, index: number): Relation {
  if (typeof rel !== 'object' || rel === null) {
    throw new Error(`Invalid relation at index ${index}`);
  }
  const r = rel as Record<string, unknown>;
  if (typeof r.id !== 'string') throw new Error(`Relation at index ${index} missing id`);
  if (typeof r.sourceTableId !== 'string') throw new Error(`Relation "${r.id}" missing sourceTableId`);
  if (typeof r.sourceColumnId !== 'string') throw new Error(`Relation "${r.id}" missing sourceColumnId`);
  if (typeof r.targetTableId !== 'string') throw new Error(`Relation "${r.id}" missing targetTableId`);
  if (typeof r.targetColumnId !== 'string') throw new Error(`Relation "${r.id}" missing targetColumnId`);

  const validTypes = ['one-to-one', 'one-to-many', 'many-to-one', 'many-to-many'];
  if (typeof r.type !== 'string' || !validTypes.includes(r.type)) {
    throw new Error(`Invalid relation type "${String(r.type)}" in relation "${r.id}"`);
  }
  const type = r.type;

  const validSides = ['left', 'right'];
  const sourceSide = typeof r.sourceSide === 'string' && validSides.includes(r.sourceSide)
    ? (r.sourceSide as HandleSide) : undefined;
  const targetSide = typeof r.targetSide === 'string' && validSides.includes(r.targetSide)
    ? (r.targetSide as HandleSide) : undefined;

  return {
    id: r.id,
    sourceTableId: r.sourceTableId,
    sourceColumnId: r.sourceColumnId,
    sourceSide,
    targetTableId: r.targetTableId,
    targetColumnId: r.targetColumnId,
    targetSide,
    type: type as Relation['type'],
  };
}

export function importJSON(raw: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Invalid JSON');
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('JSON root must be an object');
  }

  const doc = parsed as Record<string, unknown>;
  if (doc.version !== 1 && doc.version !== 2) {
    throw new Error(`Unsupported version: ${String(doc.version)}`);
  }

  const tables = Array.isArray(doc.tables)
    ? doc.tables.map((t: unknown, i: number) => validateTable(t, i))
    : [];

  const relations = Array.isArray(doc.relations)
    ? doc.relations.map((r: unknown, i: number) => validateRelation(r, i))
    : [];

  return {
    tables,
    relations,
    name: typeof doc.name === 'string' ? doc.name : 'Imported Schema',
  };
}
