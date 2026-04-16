import type { Column } from '@/types/schema';

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
