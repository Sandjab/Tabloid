import type { Column, Relation, RelationType, Table } from '@/types/schema';
import { createTableId, createColumnId, createRelationId } from '@/utils/id';

interface ImportResult {
  tables: Table[];
  relations: Relation[];
  name: string;
}

// DBML native -> abstract Tabloid type
const DBML_TYPE_MAP: Record<string, string> = {
  int: 'INTEGER',
  integer: 'INTEGER',
  bigint: 'BIGINT',
  smallint: 'SMALLINT',
  tinyint: 'SMALLINT',
  varchar: 'TEXT',
  char: 'TEXT',
  text: 'TEXT',
  string: 'TEXT',
  boolean: 'BOOLEAN',
  bool: 'BOOLEAN',
  date: 'DATE',
  time: 'TIME',
  datetime: 'TIMESTAMP',
  timestamp: 'TIMESTAMP',
  timestamptz: 'TIMESTAMP',
  decimal: 'DECIMAL',
  numeric: 'DECIMAL',
  float: 'FLOAT',
  double: 'FLOAT',
  uuid: 'UUID',
  json: 'JSON',
  jsonb: 'JSON',
  blob: 'BLOB',
  bytea: 'BLOB',
};

function stripComments(text: string): string {
  let out = '';
  let i = 0;
  while (i < text.length) {
    if (text[i] === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      continue;
    }
    if (text[i] === '/' && text[i + 1] === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    out += text[i];
    i++;
  }
  return out;
}

function normalizeType(raw: string): { type: string; precision?: number; scale?: number } {
  const m = raw.match(/^([A-Za-z_]+)(?:\(([^)]+)\))?$/);
  if (!m) return { type: raw.toUpperCase() };
  const base = DBML_TYPE_MAP[m[1].toLowerCase()] ?? m[1].toUpperCase();
  const args = m[2];
  if (args && base === 'DECIMAL') {
    const [p, s] = args.split(',').map((x) => parseInt(x.trim(), 10));
    return {
      type: base,
      precision: Number.isNaN(p) ? undefined : p,
      scale: Number.isNaN(s) ? undefined : s,
    };
  }
  return { type: base };
}

// DBML operator reads source OP target. e.g. posts.user_id > users.id = many posts per user.
function opToRelationType(op: string): RelationType {
  switch (op) {
    case '>': return 'many-to-one';
    case '<': return 'one-to-many';
    case '<>': return 'many-to-many';
    default: return 'one-to-one';
  }
}

interface PendingRef {
  sourceTableName: string;
  sourceColumnId: string;
  op: string;
  targetTableName: string;
  targetColumnName: string;
}

function parseSettings(raw: string | undefined): string[] {
  if (!raw) return [];
  const inner = raw.slice(1, -1);
  // Split on top-level commas so ref: > t.c (with embedded parens in defaults) still works.
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of inner) {
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

// Find the matching close brace starting from openIdx (pointing at '{'),
// respecting nested {} (e.g. `indexes { ... }` inside a Table block).
function findMatchingBrace(text: string, openIdx: number): number {
  let depth = 0;
  for (let i = openIdx; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

export function parseDBML(dbml: string): ImportResult {
  const text = stripComments(dbml);
  const tables: Table[] = [];
  const relations: Relation[] = [];
  const tableByName = new Map<string, Table>();
  const columnByFullName = new Map<string, { table: Table; column: Column }>();
  const pendingRefs: PendingRef[] = [];

  const tableHeaderRegex = /Table\s+(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_.]*))\s*(?:\[[^\]]*\])?\s*\{/g;
  let tm: RegExpExecArray | null;
  let col = 0;

  while ((tm = tableHeaderRegex.exec(text)) !== null) {
    const tableName = tm[1] ?? tm[2];
    const braceIdx = tm.index + tm[0].length - 1;
    const closeIdx = findMatchingBrace(text, braceIdx);
    if (closeIdx === -1) continue;
    const body = text.slice(braceIdx + 1, closeIdx);
    tableHeaderRegex.lastIndex = closeIdx + 1;
    const columns: Column[] = [];

    for (const rawLine of body.split('\n')) {
      const line = rawLine.trim();
      if (!line) continue;
      if (/^(indexes|note)\b/i.test(line)) continue;
      if (line === '{' || line === '}') continue;

      const colMatch = line.match(
        /^(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_]*))\s+([A-Za-z_][A-Za-z0-9_]*(?:\([^)]+\))?)\s*(\[[^\]]*\])?\s*(?:\/\/.*)?$/,
      );
      if (!colMatch) continue;

      const colName = colMatch[1] ?? colMatch[2];
      const typeStr = colMatch[3];
      const settings = parseSettings(colMatch[4]);
      const { type, precision, scale } = normalizeType(typeStr);

      const column: Column = {
        id: createColumnId(),
        name: colName,
        type,
        isPrimaryKey: false,
        isNullable: true,
        isUnique: false,
      };
      if (precision !== undefined) column.precision = precision;
      if (scale !== undefined) column.scale = scale;

      for (const s of settings) {
        const lower = s.toLowerCase();
        if (lower === 'pk' || lower === 'primary key') {
          column.isPrimaryKey = true;
          column.isNullable = false;
        } else if (lower === 'not null') column.isNullable = false;
        else if (lower === 'unique') column.isUnique = true;
        else if (lower === 'increment' || lower === 'autoincrement') column.type = 'SERIAL';
        else if (lower.startsWith('default:')) {
          column.defaultValue = s.slice(s.indexOf(':') + 1).trim().replace(/^['"`]|['"`]$/g, '');
        } else if (lower.startsWith('note:')) {
          column.description = s.slice(s.indexOf(':') + 1).trim().replace(/^['"`]|['"`]$/g, '');
        } else if (lower.startsWith('ref:')) {
          const rm = s.match(/ref:\s*(<>|[<>-])\s*(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_.]*))\.(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_]*))/i);
          if (rm) {
            pendingRefs.push({
              sourceTableName: tableName,
              sourceColumnId: column.id,
              op: rm[1],
              targetTableName: rm[2] ?? rm[3],
              targetColumnName: rm[4] ?? rm[5],
            });
          }
        }
      }

      columns.push(column);
    }

    const table: Table = {
      id: createTableId(),
      name: tableName,
      columns,
      position: { x: 100 + col * 320, y: 100 + (col % 3) * 50 },
    };
    tables.push(table);
    tableByName.set(tableName.toLowerCase(), table);
    for (const c of columns) {
      columnByFullName.set(`${tableName.toLowerCase()}.${c.name.toLowerCase()}`, { table, column: c });
    }
    col++;
  }

  // Top-level Ref statements: `Ref: a.x > b.y` or `Ref name { a.x > b.y }`
  const refRegex = /Ref(?:\s+[A-Za-z_][A-Za-z0-9_]*)?\s*(?::|\{)\s*(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_.]*))\.(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_]*))\s*(<>|[<>-])\s*(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_.]*))\.(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_]*))/g;
  let rm: RegExpExecArray | null;
  while ((rm = refRegex.exec(text)) !== null) {
    const srcTable = rm[1] ?? rm[2];
    const srcCol = rm[3] ?? rm[4];
    const op = rm[5];
    const tgtTable = rm[6] ?? rm[7];
    const tgtCol = rm[8] ?? rm[9];
    const src = columnByFullName.get(`${srcTable.toLowerCase()}.${srcCol.toLowerCase()}`);
    const tgt = columnByFullName.get(`${tgtTable.toLowerCase()}.${tgtCol.toLowerCase()}`);
    if (src && tgt) {
      relations.push({
        id: createRelationId(),
        sourceTableId: src.table.id,
        sourceColumnId: src.column.id,
        targetTableId: tgt.table.id,
        targetColumnId: tgt.column.id,
        type: opToRelationType(op),
      });
    }
  }

  for (const ref of pendingRefs) {
    const src = tableByName.get(ref.sourceTableName.toLowerCase());
    const srcCol = src?.columns.find((c) => c.id === ref.sourceColumnId);
    const tgt = columnByFullName.get(`${ref.targetTableName.toLowerCase()}.${ref.targetColumnName.toLowerCase()}`);
    if (src && srcCol && tgt) {
      relations.push({
        id: createRelationId(),
        sourceTableId: src.id,
        sourceColumnId: srcCol.id,
        targetTableId: tgt.table.id,
        targetColumnId: tgt.column.id,
        type: opToRelationType(ref.op),
      });
    }
  }

  return { tables, relations, name: 'Imported DBML' };
}
