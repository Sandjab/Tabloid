import type { Column, ColumnType, Table } from '@/types/schema';
import { DEFAULT_MODEL, extractJson, getClient, responseText } from './client';

const INFERRABLE_TYPES: ColumnType[] = [
  'TEXT', 'INTEGER', 'BIGINT', 'DECIMAL', 'BOOLEAN', 'DATE', 'TIMESTAMP', 'UUID', 'JSON', 'SERIAL',
];

const SYSTEM_PROMPT = `You infer types for database columns that were left at the default TEXT type. For each column, choose the most likely type based solely on its name.

Allowed types: TEXT, INTEGER, BIGINT, DECIMAL, BOOLEAN, DATE, TIMESTAMP, UUID, JSON, SERIAL.

Heuristics:
- *_id or *Id → INTEGER (PK columns named just "id" → SERIAL)
- *_at, *_date, *_on → TIMESTAMP or DATE
- is_*, has_*, *_enabled → BOOLEAN
- email, url, name, title, description → TEXT
- amount, price, total, cost → DECIMAL
- count, quantity → INTEGER
- uuid, guid → UUID
- metadata, config, settings → JSON

Output strict JSON only (no markdown fences, no prose). Format:
{ "<columnId>": "<TYPE>" }

Only include columns for which the name gives a strong signal. Omit ambiguous ones.`;

export interface InferableColumn {
  id: string;
  name: string;
  tableName: string;
}

export interface TypeSuggestion {
  columnId: string;
  columnName: string;
  tableName: string;
  suggestedType: ColumnType;
}

// Returns columns that are currently TEXT (the default from addColumn) and
// whose name hints at a different type. Target for the Infer Types tab.
export function listInferableColumns(tables: Table[]): InferableColumn[] {
  const out: InferableColumn[] = [];
  for (const t of tables) {
    for (const c of t.columns) {
      if (c.type !== 'TEXT') continue;
      if (c.isPrimaryKey) continue; // PKs are already handled
      out.push({ id: c.id, name: c.name, tableName: t.name });
    }
  }
  return out;
}

export function parseInferredTypes(raw: unknown, columns: InferableColumn[]): TypeSuggestion[] {
  if (typeof raw !== 'object' || raw === null) return [];
  const map = raw as Record<string, unknown>;
  const byId = new Map(columns.map((c) => [c.id, c]));
  const suggestions: TypeSuggestion[] = [];

  for (const [colId, rawType] of Object.entries(map)) {
    const col = byId.get(colId);
    if (!col || typeof rawType !== 'string') continue;
    const upper = rawType.toUpperCase();
    if (!(INFERRABLE_TYPES as readonly string[]).includes(upper)) continue;
    const suggested = upper as ColumnType;
    // Skip "suggestions" that just re-propose TEXT (no-op).
    if (suggested === 'TEXT') continue;
    // Skip if suggestion matches the current type (column is still TEXT here).
    suggestions.push({
      columnId: col.id,
      columnName: col.name,
      tableName: col.tableName,
      suggestedType: suggested,
    });
  }

  return suggestions;
}

export async function inferColumnTypes(
  tables: Table[],
  apiKey: string,
  model = DEFAULT_MODEL,
): Promise<TypeSuggestion[]> {
  const columns = listInferableColumns(tables);
  if (columns.length === 0) return [];

  const userContent = columns
    .map((c) => `${c.id}: ${c.tableName}.${c.name}`)
    .join('\n');

  const client = getClient(apiKey);
  const response = await client.messages.create({
    model,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }],
  });
  const raw = extractJson<Record<string, string>>(responseText(response));
  return parseInferredTypes(raw, columns);
}

// Exported for the column lookup in unit tests.
export const _private = { INFERRABLE_TYPES };
// Re-export for tests that need to type-check.
export type { Column };
