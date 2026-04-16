import type { Table, Relation, Schema, DialectId } from '@/types/schema';

export function buildSchema(
  tables: Table[],
  relations: Relation[],
  name: string,
  dialect: DialectId = 'generic',
): Schema {
  return { version: 2, dialect, name, tables, relations };
}

export function exportJSON(
  tables: Table[],
  relations: Relation[],
  name: string,
  dialect: DialectId = 'generic',
): string {
  return JSON.stringify(buildSchema(tables, relations, name, dialect), null, 2);
}
