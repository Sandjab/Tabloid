import type { Column } from '@/types/schema';
import type { Dialect } from './types';

// Text-like types that need quoted default values
const TEXT_TYPES = new Set([
  'TEXT', 'VARCHAR', 'CHAR', 'NVARCHAR', 'NCHAR',
  'VARCHAR2', 'NVARCHAR2', 'CITEXT', 'CLOB', 'NCLOB',
  'MEDIUMTEXT', 'LONGTEXT', 'UUID', 'UNIQUEIDENTIFIER',
  'XML', 'INET', 'CIDR', 'MACADDR', 'TSVECTOR',
  'ENUM', 'SET',
]);

export function defaultFormatDefault(value: string, type: string): string {
  if (TEXT_TYPES.has(type)) return `'${value}'`;
  return value;
}

export function formatDecimalPrecision(keyword: string, column: Column): string {
  return `${keyword}(${column.precision}${column.scale != null ? `, ${column.scale}` : ''})`;
}

export function defaultFormatType(column: Column): string {
  let type = column.type;
  if (column.length != null) {
    type += `(${column.length})`;
  } else if (column.precision != null) {
    type += `(${column.precision}${column.scale != null ? `,${column.scale}` : ''})`;
  }
  return type;
}

// Builds a full column definition (name + type + constraints) used in both
// CREATE TABLE and dialect-specific ADD/MODIFY COLUMN statements.
export function columnDefinition(dialect: Dialect, col: Column): string {
  const parts: string[] = [dialect.formatColumnName(col.name)];
  parts.push(dialect.formatType(col));

  if (col.type === 'SERIAL') {
    const autoInc = dialect.formatAutoIncrement(col);
    if (autoInc) parts.push(autoInc);
  }

  if (col.isPrimaryKey) parts.push('PRIMARY KEY');
  if (!col.isNullable) parts.push('NOT NULL');
  if (col.isUnique) parts.push('UNIQUE');
  if (col.defaultValue != null) {
    parts.push(`DEFAULT ${dialect.formatDefault(col.defaultValue, col.type)}`);
  }

  return parts.join(' ');
}

// Standard foreign key constraint name: fk_<srcTable>_<srcCol>
export function defaultForeignKeyName(srcTable: string, srcCol: string): string {
  return `fk_${srcTable}_${srcCol}`;
}
