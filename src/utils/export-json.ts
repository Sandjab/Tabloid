import type { Table, Relation, Schema } from '@/types/schema';

export function buildSchema(
  tables: Table[],
  relations: Relation[],
  name: string,
): Schema {
  return { version: 1, name, tables, relations };
}

export function exportJSON(
  tables: Table[],
  relations: Relation[],
  name: string,
): string {
  return JSON.stringify(buildSchema(tables, relations, name), null, 2);
}
