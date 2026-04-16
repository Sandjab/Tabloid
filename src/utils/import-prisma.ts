import type { Column, Relation, Table } from '@/types/schema';
import { createTableId, createColumnId, createRelationId } from '@/utils/id';

interface ImportResult {
  tables: Table[];
  relations: Relation[];
  name: string;
}

const PRISMA_TYPE_MAP: Record<string, string> = {
  Int: 'INTEGER',
  BigInt: 'BIGINT',
  Float: 'FLOAT',
  Decimal: 'DECIMAL',
  String: 'TEXT',
  Boolean: 'BOOLEAN',
  DateTime: 'TIMESTAMP',
  Bytes: 'BLOB',
  Json: 'JSON',
};

const SCALAR_TYPES = new Set(Object.keys(PRISMA_TYPE_MAP));

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

interface PendingRelation {
  ownerModelName: string;
  fkFields: string[];
  referencedModelName: string;
  referencedFields: string[];
}

interface ParsedField {
  name: string;
  type: string;
  optional: boolean;
  isList: boolean;
  attributes: string[];
}

function parseAttributes(rest: string): string[] {
  const attrs: string[] = [];
  let i = 0;
  while (i < rest.length) {
    while (i < rest.length && /\s/.test(rest[i])) i++;
    if (i >= rest.length || rest[i] !== '@') break;
    let current = '';
    let depth = 0;
    while (i < rest.length) {
      const ch = rest[i];
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      if (/\s/.test(ch) && depth === 0) break;
      current += ch;
      i++;
    }
    if (current) attrs.push(current);
  }
  return attrs;
}

function parseFieldLine(line: string): ParsedField | null {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s+([A-Za-z_][A-Za-z0-9_]*)(\?|\[\])?(?:\s+(.*))?$/);
  if (!m) return null;
  return {
    name: m[1],
    type: m[2],
    optional: (m[3] ?? '') === '?',
    isList: (m[3] ?? '') === '[]',
    attributes: parseAttributes(m[4] ?? ''),
  };
}

function extractAttrArgs(attr: string): string | null {
  const m = attr.match(/^@\w+\((.*)\)$/);
  return m ? m[1] : null;
}

function parseRelationAttr(attr: string): { fields: string[]; references: string[] } | null {
  if (!attr.startsWith('@relation')) return null;
  const args = extractAttrArgs(attr);
  if (!args) return { fields: [], references: [] };
  const fieldsMatch = args.match(/fields:\s*\[([^\]]*)\]/);
  const refsMatch = args.match(/references:\s*\[([^\]]*)\]/);
  return {
    fields: fieldsMatch ? fieldsMatch[1].split(',').map((s) => s.trim()).filter(Boolean) : [],
    references: refsMatch ? refsMatch[1].split(',').map((s) => s.trim()).filter(Boolean) : [],
  };
}

function parseDefaultAttr(attr: string): { kind: 'autoincrement' | 'value'; value?: string } | null {
  if (!attr.startsWith('@default')) return null;
  const args = extractAttrArgs(attr);
  if (!args) return null;
  const trimmed = args.trim();
  if (trimmed === 'autoincrement()') return { kind: 'autoincrement' };
  if (trimmed === 'cuid()' || trimmed === 'uuid()' || trimmed === 'now()') {
    return { kind: 'value', value: trimmed };
  }
  const quoted = trimmed.match(/^"([^"]*)"$/);
  if (quoted) return { kind: 'value', value: quoted[1] };
  return { kind: 'value', value: trimmed };
}

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

export function parsePrisma(prisma: string): ImportResult {
  const text = stripComments(prisma);
  const tables: Table[] = [];
  const relations: Relation[] = [];
  const tableByModelName = new Map<string, Table>();
  const pending: PendingRelation[] = [];

  const modelHeaderRegex = /model\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/g;
  let mm: RegExpExecArray | null;
  let idx = 0;

  while ((mm = modelHeaderRegex.exec(text)) !== null) {
    const modelName = mm[1];
    const braceIdx = mm.index + mm[0].length - 1;
    const closeIdx = findMatchingBrace(text, braceIdx);
    if (closeIdx === -1) continue;
    const body = text.slice(braceIdx + 1, closeIdx);
    modelHeaderRegex.lastIndex = closeIdx + 1;
    const columns: Column[] = [];

    for (const rawLine of body.split('\n')) {
      const line = rawLine.trim();
      if (!line) continue;
      if (line.startsWith('@@')) continue;
      const field = parseFieldLine(line);
      if (!field) continue;
      if (field.isList) continue;

      if (!SCALAR_TYPES.has(field.type)) {
        const relAttr = field.attributes.find((a) => a.startsWith('@relation'));
        const parsed = relAttr ? parseRelationAttr(relAttr) : null;
        if (parsed && parsed.fields.length > 0 && parsed.references.length > 0) {
          pending.push({
            ownerModelName: modelName,
            fkFields: parsed.fields,
            referencedModelName: field.type,
            referencedFields: parsed.references,
          });
        }
        continue;
      }

      const column: Column = {
        id: createColumnId(),
        name: field.name,
        type: PRISMA_TYPE_MAP[field.type] ?? 'TEXT',
        isPrimaryKey: false,
        isNullable: field.optional,
        isUnique: false,
      };

      for (const attr of field.attributes) {
        if (attr === '@id') {
          column.isPrimaryKey = true;
          column.isNullable = false;
        } else if (attr === '@unique') column.isUnique = true;
        else {
          const def = parseDefaultAttr(attr);
          if (def) {
            if (def.kind === 'autoincrement') column.type = 'SERIAL';
            else if (def.value !== undefined) column.defaultValue = def.value;
          }
        }
      }

      columns.push(column);
    }

    const table: Table = {
      id: createTableId(),
      name: modelName,
      columns,
      position: { x: 100 + idx * 320, y: 100 + (idx % 3) * 60 },
    };
    tables.push(table);
    tableByModelName.set(modelName, table);
    idx++;
  }

  for (const rel of pending) {
    const ownerTable = tableByModelName.get(rel.ownerModelName);
    const refTable = tableByModelName.get(rel.referencedModelName);
    if (!ownerTable || !refTable) continue;
    const count = Math.min(rel.fkFields.length, rel.referencedFields.length);
    for (let i = 0; i < count; i++) {
      const srcCol = ownerTable.columns.find((c) => c.name === rel.fkFields[i]);
      const tgtCol = refTable.columns.find((c) => c.name === rel.referencedFields[i]);
      if (!srcCol || !tgtCol) continue;
      relations.push({
        id: createRelationId(),
        sourceTableId: ownerTable.id,
        sourceColumnId: srcCol.id,
        targetTableId: refTable.id,
        targetColumnId: tgtCol.id,
        type: 'many-to-one',
      });
    }
  }

  return { tables, relations, name: 'Imported Prisma' };
}
