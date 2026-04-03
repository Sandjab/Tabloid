import type { Dialect } from './types';
import type { Column, ColumnType } from '@/types/schema';
import { defaultFormatDefault, formatDecimalPrecision } from './base';

const TYPE_MAP: Record<ColumnType, string> = {
  TEXT: 'TEXT',
  INTEGER: 'INTEGER',
  BIGINT: 'BIGINT',
  SMALLINT: 'SMALLINT',
  DECIMAL: 'NUMERIC',
  FLOAT: 'DOUBLE PRECISION',
  BOOLEAN: 'BOOLEAN',
  DATE: 'DATE',
  TIME: 'TIME',
  TIMESTAMP: 'TIMESTAMP',
  UUID: 'UUID',
  BLOB: 'BYTEA',
  JSON: 'JSONB',
  SERIAL: 'SERIAL',
};

export const postgresql: Dialect = {
  name: 'postgresql',

  mapType(column: Column): string {
    if (column.type === 'DECIMAL' && column.precision != null) {
      return formatDecimalPrecision('NUMERIC', column);
    }
    return TYPE_MAP[column.type];
  },

  formatDefault: defaultFormatDefault,
  formatAutoIncrement(): string { return ''; },
  formatTableName(name: string): string { return `"${name}"`; },
  formatColumnName(name: string): string { return `"${name}"`; },
  supportsIfNotExists: true,
};
