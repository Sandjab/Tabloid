import type { Dialect } from './types';
import type { Column, ColumnType } from '@/types/schema';
import { defaultFormatDefault } from './base';

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

export const sqlite: Dialect = {
  name: 'sqlite',

  mapType(column: Column): string {
    return TYPE_MAP[column.type];
  },

  formatDefault: defaultFormatDefault,
  formatAutoIncrement(): string { return 'AUTOINCREMENT'; },
  formatTableName(name: string): string { return `"${name}"`; },
  formatColumnName(name: string): string { return `"${name}"`; },
  supportsIfNotExists: true,
};
