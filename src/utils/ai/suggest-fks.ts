import type { Relation, Table } from '@/types/schema';

export interface FkSuggestion {
  sourceTableId: string;
  sourceTableName: string;
  sourceColumnId: string;
  sourceColumnName: string;
  targetTableId: string;
  targetTableName: string;
  targetColumnId: string;
  targetColumnName: string;
  confidence: 'high' | 'medium';
}

// Extract a candidate table name from common FK column-name patterns.
// Returns null if the column name doesn't look like an FK.
export function extractTargetTableName(columnName: string): string | null {
  // snake_case: user_id, author_id, project_uuid
  const snake = columnName.match(/^([a-z][a-z0-9_]*?)_(id|uuid|fk|key)$/i);
  if (snake) return snake[1];

  // fk_<table>
  const fkPrefix = columnName.match(/^fk_([a-z][a-z0-9_]*)$/i);
  if (fkPrefix) return fkPrefix[1];

  // camelCase: userId, authorUuid
  const camel = columnName.match(/^([a-z][a-zA-Z0-9]*?)(Id|Uuid|Fk|Key)$/);
  if (camel) {
    // Only capture when the suffix starts with uppercase AND there's at
    // least one uppercase in the name (distinguishes `userId` from `id`).
    if (/[A-Z]/.test(columnName)) return camel[1].toLowerCase();
  }

  return null;
}

// Simple singular/plural normalization. Not linguistically perfect, covers the
// common cases: trailing s, ies→y, es.
function normalize(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith('ies')) return lower.slice(0, -3) + 'y';
  if (lower.endsWith('es') && lower.length > 3) return lower.slice(0, -2);
  if (lower.endsWith('s') && !lower.endsWith('ss')) return lower.slice(0, -1);
  return lower;
}

function namesMatch(a: string, b: string): boolean {
  return normalize(a) === normalize(b);
}

export function suggestForeignKeys(tables: Table[], relations: Relation[]): FkSuggestion[] {
  const suggestions: FkSuggestion[] = [];

  // Set of (sourceTableId, sourceColumnId) pairs that are already FKs.
  const existingSources = new Set(
    relations.map((r) => `${r.sourceTableId}:${r.sourceColumnId}`),
  );

  for (const table of tables) {
    for (const col of table.columns) {
      // PKs are targets, not sources.
      if (col.isPrimaryKey) continue;
      // Already a source of a relation? Skip.
      if (existingSources.has(`${table.id}:${col.id}`)) continue;

      const candidate = extractTargetTableName(col.name);
      if (!candidate) continue;

      // Find a target table whose name matches the extracted hint.
      // Exclude self-table to avoid trivial self-FK suggestions (can be legit
      // but surface them as medium confidence only).
      const matches = tables.filter((t) => namesMatch(t.name, candidate));
      if (matches.length === 0) continue;

      // Prefer a match that is NOT the current table if multiple candidates exist.
      const target = matches.find((t) => t.id !== table.id) ?? matches[0];
      const targetPk = target.columns.find((c) => c.isPrimaryKey);
      if (!targetPk) continue;

      // Confidence heuristic: exact name match → high; normalized match → medium.
      const confidence: 'high' | 'medium' =
        target.name.toLowerCase() === candidate.toLowerCase() ? 'high' : 'medium';

      suggestions.push({
        sourceTableId: table.id,
        sourceTableName: table.name,
        sourceColumnId: col.id,
        sourceColumnName: col.name,
        targetTableId: target.id,
        targetTableName: target.name,
        targetColumnId: targetPk.id,
        targetColumnName: targetPk.name,
        confidence,
      });
    }
  }

  return suggestions;
}
