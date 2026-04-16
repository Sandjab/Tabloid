import type { Dialect, NativeTypeDefinition } from './types';
import type { Column, ColumnType } from '@/types/schema';
import { defaultFormatDefault, defaultFormatType } from './base';

const TYPE_MAP: Record<ColumnType, string> = {
  TEXT: 'TEXT',
  INTEGER: 'INTEGER',
  BIGINT: 'INTEGER',
  SMALLINT: 'INTEGER',
  DECIMAL: 'REAL',
  FLOAT: 'REAL',
  BOOLEAN: 'INTEGER',
  DATE: 'TEXT',
  TIME: 'TEXT',
  TIMESTAMP: 'TEXT',
  UUID: 'TEXT',
  BLOB: 'BLOB',
  JSON: 'TEXT',
  SERIAL: 'INTEGER',
};

export const sqliteCatalog: NativeTypeDefinition[] = [
  // integer
  { name: 'INTEGER', family: 'integer', description: 'Signed integer (1, 2, 3, 4, 6, or 8 bytes)' },
  // text
  { name: 'TEXT', family: 'text', description: 'Text string (UTF-8, UTF-16)' },
  // decimal
  { name: 'REAL', family: 'decimal', description: '8-byte floating point' },
  { name: 'NUMERIC', family: 'decimal', description: 'Numeric with type affinity' },
  // binary
  { name: 'BLOB', family: 'binary', description: 'Binary large object' },
];

export const sqlite: Dialect = {
  name: 'sqlite',
  catalog: sqliteCatalog,

  mapType(column: Column): string {
    return TYPE_MAP[column.type as ColumnType] ?? column.type;
  },

  formatType: defaultFormatType,
  formatDefault: defaultFormatDefault,
  formatAutoIncrement(): string { return 'AUTOINCREMENT'; },
  formatTableName(name: string): string { return `"${name}"`; },
  formatColumnName(name: string): string { return `"${name}"`; },
  supportsIfNotExists: true,
};
