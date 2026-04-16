import type { Column, ColumnType, Relation, RelationType, Table } from '@/types/schema';
import { COLUMN_TYPES } from '@/types/schema';
import { createColumnId, createRelationId, createTableId } from '@/utils/id';
import { DEFAULT_MODEL, extractJson, getClient, responseText } from './client';

const SYSTEM_PROMPT = `You are a relational schema designer. Given a description of an application, produce a JSON schema describing its database.

Output strict JSON only — no prose, no markdown fences, no comments. The JSON must match this TypeScript shape:

{
  "tables": [
    {
      "name": string,              // snake_case
      "columns": [
        {
          "name": string,          // snake_case
          "type": "TEXT" | "INTEGER" | "BIGINT" | "SMALLINT" | "DECIMAL" | "FLOAT" | "BOOLEAN" | "DATE" | "TIME" | "TIMESTAMP" | "UUID" | "BLOB" | "JSON" | "SERIAL",
          "isPrimaryKey": boolean,
          "isNullable": boolean,
          "isUnique": boolean
        }
      ]
    }
  ],
  "relations": [
    {
      "sourceTable": string,       // table name (FK side)
      "sourceColumn": string,      // column name on sourceTable
      "targetTable": string,       // table name (PK side)
      "targetColumn": string,      // column name on targetTable
      "type": "one-to-one" | "one-to-many" | "many-to-one" | "many-to-many"
    }
  ]
}

Rules:
- Every table must have exactly one primary key (usually \`id\` with type SERIAL).
- Every FK source column must exist on its source table (type INTEGER or SERIAL matching the target PK).
- Prefer many-to-one for the common "has many" pattern (source = child, target = parent).
- Use TIMESTAMP for dates+times, DATE for dates, BOOLEAN for flags, TEXT for strings, DECIMAL for money.
- Be reasonable: 3–10 tables is typical; don't overmodel.`;

export interface GenerateSchemaResult {
  tables: Table[];
  relations: Relation[];
}

interface RawTable {
  name: string;
  columns: Array<{
    name: string;
    type: string;
    isPrimaryKey?: boolean;
    isNullable?: boolean;
    isUnique?: boolean;
  }>;
}

interface RawRelation {
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  type: string;
}

interface RawSchema {
  tables: RawTable[];
  relations: RawRelation[];
}

const VALID_RELATION_TYPES: RelationType[] = ['one-to-one', 'one-to-many', 'many-to-one', 'many-to-many'];

function normalizeType(type: string): ColumnType {
  const upper = type.toUpperCase();
  return (COLUMN_TYPES as readonly string[]).includes(upper) ? (upper as ColumnType) : 'TEXT';
}

export function parseGeneratedSchema(raw: RawSchema): GenerateSchemaResult {
  if (!raw || !Array.isArray(raw.tables)) {
    throw new Error('Generated schema has no `tables` array');
  }

  const tables: Table[] = [];
  // Maps bare table name → { tableId, column name → column id } so we can
  // resolve FKs in the second pass by name.
  const tableMap = new Map<string, { id: string; columns: Map<string, string> }>();

  raw.tables.forEach((rt, i) => {
    if (!rt.name || !Array.isArray(rt.columns)) return;
    const tableId = createTableId();
    const columnByName = new Map<string, string>();

    const columns: Column[] = rt.columns.map((rc) => {
      const colId = createColumnId();
      columnByName.set(rc.name, colId);
      return {
        id: colId,
        name: String(rc.name),
        type: normalizeType(String(rc.type)),
        isPrimaryKey: Boolean(rc.isPrimaryKey),
        isNullable: rc.isNullable !== false,
        isUnique: Boolean(rc.isUnique),
      };
    });

    tables.push({
      id: tableId,
      name: rt.name,
      columns,
      // Simple grid layout; user can re-run auto-layout after import if needed.
      position: { x: 100 + (i % 4) * 320, y: 100 + Math.floor(i / 4) * 320 },
    });
    tableMap.set(rt.name, { id: tableId, columns: columnByName });
  });

  const relations: Relation[] = [];
  if (Array.isArray(raw.relations)) {
    for (const rel of raw.relations) {
      const src = tableMap.get(rel.sourceTable);
      const tgt = tableMap.get(rel.targetTable);
      if (!src || !tgt) continue;
      const srcCol = src.columns.get(rel.sourceColumn);
      const tgtCol = tgt.columns.get(rel.targetColumn);
      if (!srcCol || !tgtCol) continue;
      const type = VALID_RELATION_TYPES.includes(rel.type as RelationType)
        ? (rel.type as RelationType)
        : 'many-to-one';
      relations.push({
        id: createRelationId(),
        sourceTableId: src.id,
        sourceColumnId: srcCol,
        targetTableId: tgt.id,
        targetColumnId: tgtCol,
        type,
      });
    }
  }

  return { tables, relations };
}

export async function generateSchemaFromDescription(
  description: string,
  apiKey: string,
  model = DEFAULT_MODEL,
): Promise<GenerateSchemaResult> {
  if (!description.trim()) throw new Error('Description is empty');
  const client = getClient(apiKey);
  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: description }],
  });
  const raw = extractJson<RawSchema>(responseText(response));
  return parseGeneratedSchema(raw);
}
