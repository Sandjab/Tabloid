import type { Table, Column, Relation, ColumnType, Index } from '@/types/schema';
import { createTableId, createColumnId, createRelationId } from '@/utils/id';

// --- Import result (same shape as importJSON) ---

interface ImportResult {
  tables: Table[];
  relations: Relation[];
  name: string;
}

// --- Reverse type mapping: native SQL types → abstract ColumnType ---

const REVERSE_TYPE_MAP: Record<string, ColumnType> = {
  // TEXT family
  TEXT: 'TEXT',
  CLOB: 'TEXT',
  NCLOB: 'TEXT',
  VARCHAR: 'TEXT',
  NVARCHAR: 'TEXT',
  CHAR: 'TEXT',
  NCHAR: 'TEXT',
  'CHARACTER VARYING': 'TEXT',
  NVARCHAR2: 'TEXT',
  VARCHAR2: 'TEXT',

  // INTEGER family
  INT: 'INTEGER',
  INTEGER: 'INTEGER',

  // BIGINT
  BIGINT: 'BIGINT',

  // SMALLINT family
  SMALLINT: 'SMALLINT',
  TINYINT: 'SMALLINT',

  // DECIMAL family
  DECIMAL: 'DECIMAL',
  NUMERIC: 'DECIMAL',
  NUMBER: 'DECIMAL',
  REAL: 'DECIMAL',

  // FLOAT family
  FLOAT: 'FLOAT',
  DOUBLE: 'FLOAT',
  'DOUBLE PRECISION': 'FLOAT',
  BINARY_DOUBLE: 'FLOAT',
  BINARY_FLOAT: 'FLOAT',

  // BOOLEAN family
  BOOLEAN: 'BOOLEAN',
  BIT: 'BOOLEAN',

  // DATE/TIME family
  DATE: 'DATE',
  TIME: 'TIME',
  TIMESTAMP: 'TIMESTAMP',
  DATETIME: 'TIMESTAMP',
  DATETIME2: 'TIMESTAMP',
  'TIMESTAMP WITH TIME ZONE': 'TIMESTAMP',
  TIMESTAMPTZ: 'TIMESTAMP',

  // UUID family
  UUID: 'UUID',
  UNIQUEIDENTIFIER: 'UUID',

  // BLOB family
  BLOB: 'BLOB',
  BYTEA: 'BLOB',
  LONGBLOB: 'BLOB',
  MEDIUMBLOB: 'BLOB',
  TINYBLOB: 'BLOB',
  VARBINARY: 'BLOB',
  IMAGE: 'BLOB',
  RAW: 'BLOB',

  // JSON family
  JSON: 'JSON',
  JSONB: 'JSON',

  // SERIAL family
  SERIAL: 'SERIAL',
  BIGSERIAL: 'SERIAL',
  SMALLSERIAL: 'SERIAL',
};

// --- Helpers ---

/** Strip line comments (--) and block comments from SQL */
function stripComments(sql: string): string {
  let result = '';
  let i = 0;
  while (i < sql.length) {
    // Line comment
    if (sql[i] === '-' && sql[i + 1] === '-') {
      while (i < sql.length && sql[i] !== '\n') i++;
      continue;
    }
    // Block comment
    if (sql[i] === '/' && sql[i + 1] === '*') {
      i += 2;
      while (i < sql.length && !(sql[i] === '*' && sql[i + 1] === '/')) i++;
      i += 2; // skip */
      continue;
    }
    result += sql[i];
    i++;
  }
  return result;
}

/** Remove surrounding quotes from an identifier: "name", `name`, [name] */
function unquote(name: string): string {
  const trimmed = name.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith('`') && trimmed.endsWith('`'))
  ) {
    return trimmed.slice(1, -1);
  }
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * Split a string by a delimiter, but only at top-level (not inside parentheses).
 * This ensures DECIMAL(10,2) does not split on the inner comma.
 */
function splitTopLevel(text: string, delimiter: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;

    if (depth === 0 && text.substring(i, i + delimiter.length) === delimiter) {
      parts.push(current);
      current = '';
      i += delimiter.length - 1;
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current);
  return parts;
}

/**
 * Parse a native SQL type string into an abstract ColumnType plus optional precision/scale.
 */
function parseNativeType(raw: string): { type: ColumnType; precision?: number; scale?: number } {
  const trimmed = raw.trim();

  // Extract base type and parenthesized arguments: e.g. DECIMAL(10,2) → base=DECIMAL, args="10,2"
  const parenMatch = trimmed.match(/^([A-Z0-9_ ]+?)\s*\((.+)\)$/i);
  const baseType = parenMatch ? parenMatch[1].trim().toUpperCase() : trimmed.toUpperCase();
  const args = parenMatch ? parenMatch[2] : null;

  // Special case: TINYINT(1) → BOOLEAN (MySQL convention)
  if (baseType === 'TINYINT' && args === '1') {
    return { type: 'BOOLEAN' };
  }

  // Look up the base type in the reverse map
  const mapped = REVERSE_TYPE_MAP[baseType];
  const abstractType = mapped ?? 'TEXT';

  // Extract precision/scale for DECIMAL/NUMERIC types
  if ((abstractType === 'DECIMAL') && args) {
    const numParts = args.split(',').map((s) => parseInt(s.trim(), 10));
    return {
      type: 'DECIMAL',
      precision: isNaN(numParts[0]) ? undefined : numParts[0],
      scale: numParts.length > 1 && !isNaN(numParts[1]) ? numParts[1] : undefined,
    };
  }

  return { type: abstractType };
}

/**
 * Check if a column definition contains auto-increment markers.
 */
function hasAutoIncrement(defn: string): boolean {
  const upper = defn.toUpperCase();
  return (
    upper.includes('AUTO_INCREMENT') ||
    upper.includes('AUTOINCREMENT') ||
    /\bIDENTITY\b/.test(upper) ||
    /GENERATED\s+.*\s+AS\s+IDENTITY/.test(upper)
  );
}

/**
 * Extract DEFAULT value from a column definition string.
 * Returns the default value string or undefined.
 */
function extractDefault(defn: string): string | undefined {
  const match = defn.match(/\bDEFAULT\s+('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|\S+)/i);
  if (!match) return undefined;
  let val = match[1];
  // Strip surrounding quotes
  if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
    val = val.slice(1, -1);
  }
  return val;
}

/**
 * Extract the type portion from a column definition.
 * The type comes right after the column name and before any constraint keywords.
 */
function extractTypeFromDef(tokens: string[]): string {
  // tokens[0] is column name, tokens[1+] form the type + constraints
  // We need to grab tokens that form the type, stopping at constraint keywords
  const constraintKeywords = new Set([
    'PRIMARY', 'NOT', 'NULL', 'UNIQUE', 'DEFAULT', 'CHECK',
    'REFERENCES', 'CONSTRAINT', 'AUTO_INCREMENT', 'AUTOINCREMENT',
    'GENERATED', 'IDENTITY', 'COLLATE',
  ]);

  const typeParts: string[] = [];
  for (let i = 1; i < tokens.length; i++) {
    const upper = tokens[i].toUpperCase();
    // Stop at constraint keywords
    if (constraintKeywords.has(upper)) break;
    typeParts.push(tokens[i]);
  }
  return typeParts.join(' ');
}

// --- Main parser ---

export function parseSQL(sql: string): ImportResult {
  if (!sql || !sql.trim()) {
    return { tables: [], relations: [], name: 'Imported SQL' };
  }

  const cleaned = stripComments(sql);

  // Split into statements by semicolons (at top level)
  const statements = splitTopLevel(cleaned, ';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const tables: Table[] = [];
  const relations: Relation[] = [];
  let indexCounter = 0;

  // Maps for resolving references: tableName (lowercase) → Table
  const tableByName = new Map<string, Table>();
  // Maps for resolving column references: tableName.columnName (lowercase) → Column
  const columnByFullName = new Map<string, { table: Table; column: Column }>();

  function registerTable(table: Table): void {
    tableByName.set(table.name.toLowerCase(), table);
    for (const col of table.columns) {
      columnByFullName.set(`${table.name.toLowerCase()}.${col.name.toLowerCase()}`, { table, column: col });
    }
  }

  function findTable(name: string): Table | undefined {
    return tableByName.get(name.toLowerCase());
  }

  function findColumn(tableName: string, colName: string): { table: Table; column: Column } | undefined {
    return columnByFullName.get(`${tableName.toLowerCase()}.${colName.toLowerCase()}`);
  }

  /**
   * Tokenize respecting parenthesized groups and quoted strings.
   * Returns tokens where parenthesized groups stay together: e.g. "DECIMAL(10,2)" stays as one token.
   */
  function tokenize(text: string): string[] {
    const tokens: string[] = [];
    let i = 0;
    while (i < text.length) {
      // Skip whitespace
      if (/\s/.test(text[i])) { i++; continue; }

      // Quoted string (single quotes)
      if (text[i] === "'") {
        let tok = "'";
        i++;
        while (i < text.length && text[i] !== "'") {
          if (text[i] === '\\') { tok += text[i]; i++; }
          tok += text[i]; i++;
        }
        if (i < text.length) { tok += "'"; i++; }
        tokens.push(tok);
        continue;
      }

      // Quoted identifier
      if (text[i] === '"' || text[i] === '`' || text[i] === '[') {
        const close = text[i] === '[' ? ']' : text[i];
        let tok = text[i];
        i++;
        while (i < text.length && text[i] !== close) { tok += text[i]; i++; }
        if (i < text.length) { tok += text[i]; i++; }
        tokens.push(tok);
        continue;
      }

      // Comma as its own token
      if (text[i] === ',') { tokens.push(','); i++; continue; }

      // Parenthesized group: capture everything including nested parens
      if (text[i] === '(') {
        let tok = '(';
        let depth = 1;
        i++;
        while (i < text.length && depth > 0) {
          if (text[i] === '(') depth++;
          else if (text[i] === ')') depth--;
          tok += text[i]; i++;
        }
        tokens.push(tok);
        continue;
      }

      // Regular word
      let tok = '';
      while (i < text.length && !/[\s,()'"` [\]]/.test(text[i])) {
        tok += text[i]; i++;
      }
      // Check if next non-space char is '(' → attach it (for types like DECIMAL(10,2))
      const saved = i;
      while (i < text.length && text[i] === ' ') i++;
      if (i < text.length && text[i] === '(') {
        let paren = '(';
        let depth = 1;
        i++;
        while (i < text.length && depth > 0) {
          if (text[i] === '(') depth++;
          else if (text[i] === ')') depth--;
          paren += text[i]; i++;
        }
        tok += paren;
      } else {
        i = saved;
      }
      if (tok) tokens.push(tok);
    }
    return tokens;
  }

  // --- Process each statement ---
  for (const stmt of statements) {
    const upper = stmt.toUpperCase().replace(/\s+/g, ' ').trim();

    // ========== CREATE TABLE ==========
    if (/^CREATE\s+TABLE/i.test(upper)) {
      parseCreateTable(stmt);
    }
    // ========== ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY ==========
    else if (/^ALTER\s+TABLE/i.test(upper) && /FOREIGN\s+KEY/i.test(upper)) {
      parseAlterTableFK(stmt);
    }
    // ========== CREATE [UNIQUE] INDEX ==========
    else if (/^CREATE\s+(UNIQUE\s+)?INDEX/i.test(upper)) {
      parseCreateIndex(stmt);
    }
  }

  function parseCreateTable(stmt: string): void {
    // Extract table name: CREATE TABLE [IF NOT EXISTS] tableName (...)
    const headerMatch = stmt.match(
      /^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(["`[\]A-Z0-9_.]+)\s*\(/i,
    );
    if (!headerMatch) return;

    const rawTableName = unquote(headerMatch[1]);
    // Strip schema prefix if present (e.g. dbo.users → users)
    const tableName = rawTableName.includes('.') ? rawTableName.split('.').pop()! : rawTableName;

    const tableId = createTableId();
    const tableIndex = tables.length;
    const col = tableIndex % 4;
    const row = Math.floor(tableIndex / 4);

    const table: Table = {
      id: tableId,
      name: tableName,
      columns: [],
      position: { x: col * 300, y: row * 300 },
    };

    // Extract the content between the outermost parentheses
    const firstParen = stmt.indexOf('(');
    let depth = 0;
    let lastParen = -1;
    for (let i = firstParen; i < stmt.length; i++) {
      if (stmt[i] === '(') depth++;
      else if (stmt[i] === ')') {
        depth--;
        if (depth === 0) { lastParen = i; break; }
      }
    }
    if (lastParen === -1) return;

    const body = stmt.substring(firstParen + 1, lastParen);
    const defs = splitTopLevel(body, ',');

    const deferredFKs: Array<{ colName: string; refTable: string; refCol: string }> = [];

    for (const def of defs) {
      const trimmed = def.trim();
      if (!trimmed) continue;

      const upperDef = trimmed.toUpperCase().replace(/\s+/g, ' ').trim();

      // --- Table-level PRIMARY KEY(col1, col2) ---
      if (/^PRIMARY\s+KEY\s*\(/i.test(upperDef) || /^CONSTRAINT\s+\S+\s+PRIMARY\s+KEY\s*\(/i.test(upperDef)) {
        const pkMatch = trimmed.match(/PRIMARY\s+KEY\s*\(([^)]+)\)/i);
        if (pkMatch) {
          const pkCols = pkMatch[1].split(',').map((c) => unquote(c.trim()));
          for (const pkCol of pkCols) {
            const col = table.columns.find((c) => c.name.toLowerCase() === pkCol.toLowerCase());
            if (col) col.isPrimaryKey = true;
          }
        }
        continue;
      }

      // --- Table-level UNIQUE(col1, ...) ---
      if (/^UNIQUE\s*\(/i.test(upperDef) || /^CONSTRAINT\s+\S+\s+UNIQUE\s*\(/i.test(upperDef)) {
        const uqMatch = trimmed.match(/UNIQUE\s*\(([^)]+)\)/i);
        if (uqMatch) {
          const uqCols = uqMatch[1].split(',').map((c) => unquote(c.trim()));
          for (const uqCol of uqCols) {
            const col = table.columns.find((c) => c.name.toLowerCase() === uqCol.toLowerCase());
            if (col) col.isUnique = true;
          }
        }
        continue;
      }

      // --- Table-level FOREIGN KEY(col) REFERENCES other(col) ---
      if (/^(?:CONSTRAINT\s+\S+\s+)?FOREIGN\s+KEY/i.test(upperDef)) {
        const fkMatch = trimmed.match(
          /FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+(["`[\]A-Z0-9_.]+)\s*\(([^)]+)\)/i,
        );
        if (fkMatch) {
          const srcCol = unquote(fkMatch[1].trim());
          const refTable = unquote(fkMatch[2].trim());
          const refCol = unquote(fkMatch[3].trim());
          deferredFKs.push({ colName: srcCol, refTable, refCol });
        }
        continue;
      }

      // --- CHECK constraint at table level ---
      if (/^CHECK\s*\(/i.test(upperDef) || /^CONSTRAINT\s+\S+\s+CHECK\s*\(/i.test(upperDef)) {
        continue;
      }

      // --- Column definition ---
      parseColumnDef(trimmed, table);
    }

    tables.push(table);
    registerTable(table);

    // Process deferred foreign keys (table-level FOREIGN KEY constraints)
    for (const fk of deferredFKs) {
      const srcCol = table.columns.find((c) => c.name.toLowerCase() === fk.colName.toLowerCase());
      const targetInfo = findColumn(fk.refTable, fk.refCol);
      if (srcCol && targetInfo) {
        relations.push({
          id: createRelationId(),
          sourceTableId: table.id,
          sourceColumnId: srcCol.id,
          targetTableId: targetInfo.table.id,
          targetColumnId: targetInfo.column.id,
          type: 'many-to-one',
        });
      }
    }
  }

  function parseColumnDef(defn: string, table: Table): void {
    const tokens = tokenize(defn);
    if (tokens.length < 2) return;

    const colName = unquote(tokens[0]);
    const rawType = extractTypeFromDef(tokens);
    const { type: abstractType, precision, scale } = parseNativeType(rawType);

    const upperDefn = defn.toUpperCase();

    const colId = createColumnId();
    const autoInc = hasAutoIncrement(defn);
    const finalType: ColumnType = autoInc ? 'SERIAL' : abstractType;

    const column: Column = {
      id: colId,
      name: colName,
      type: finalType,
      isPrimaryKey: /\bPRIMARY\s+KEY\b/i.test(defn),
      isNullable: !/\bNOT\s+NULL\b/i.test(upperDefn),
      isUnique: /\bUNIQUE\b/i.test(upperDefn),
      defaultValue: extractDefault(defn),
      ...(precision !== undefined ? { precision } : {}),
      ...(scale !== undefined ? { scale } : {}),
    };

    table.columns.push(column);

    // Inline REFERENCES
    const refMatch = defn.match(
      /\bREFERENCES\s+(["`[\]A-Z0-9_.]+)\s*\(([^)]+)\)/i,
    );
    if (refMatch) {
      const refTableName = unquote(refMatch[1].trim());
      const refColName = unquote(refMatch[2].trim());
      const targetInfo = findColumn(refTableName, refColName);
      if (targetInfo) {
        relations.push({
          id: createRelationId(),
          sourceTableId: table.id,
          sourceColumnId: colId,
          targetTableId: targetInfo.table.id,
          targetColumnId: targetInfo.column.id,
          type: 'many-to-one',
        });
      }
    }
  }

  function parseAlterTableFK(stmt: string): void {
    const match = stmt.match(
      /ALTER\s+TABLE\s+(["`[\]A-Z0-9_.]+)\s+ADD\s+(?:CONSTRAINT\s+\S+\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+(["`[\]A-Z0-9_.]+)\s*\(([^)]+)\)/i,
    );
    if (!match) return;

    const srcTableName = unquote(match[1].trim());
    const srcColName = unquote(match[2].trim());
    const refTableName = unquote(match[3].trim());
    const refColName = unquote(match[4].trim());

    const srcInfo = findColumn(srcTableName, srcColName);
    const tgtInfo = findColumn(refTableName, refColName);

    if (srcInfo && tgtInfo) {
      relations.push({
        id: createRelationId(),
        sourceTableId: srcInfo.table.id,
        sourceColumnId: srcInfo.column.id,
        targetTableId: tgtInfo.table.id,
        targetColumnId: tgtInfo.column.id,
        type: 'many-to-one',
      });
    }
  }

  function parseCreateIndex(stmt: string): void {
    const match = stmt.match(
      /CREATE\s+(UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?(["`[\]A-Z0-9_.]+)\s+ON\s+(["`[\]A-Z0-9_.]+)\s*\(([^)]+)\)/i,
    );
    if (!match) return;

    const isUnique = !!match[1];
    const indexName = unquote(match[2].trim());
    const tableName = unquote(match[3].trim());
    const colNames = match[4].split(',').map((c) => unquote(c.trim()));

    const table = findTable(tableName);
    if (!table) return;

    indexCounter++;
    const columnIds = colNames
      .map((name) => table.columns.find((c) => c.name.toLowerCase() === name.toLowerCase()))
      .filter(Boolean)
      .map((c) => c!.id);

    if (columnIds.length === 0) return;

    const index: Index = {
      id: `idx_${indexCounter}`,
      name: indexName,
      columnIds,
      isUnique,
    };

    if (!table.indexes) table.indexes = [];
    table.indexes.push(index);
  }

  return { tables, relations, name: 'Imported SQL' };
}
