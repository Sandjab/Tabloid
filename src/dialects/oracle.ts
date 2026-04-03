import type { Dialect } from './types';
import type { Column, ColumnType } from '@/types/schema';
import { defaultFormatDefault, formatDecimalPrecision } from './base';

const TYPE_MAP: Record<ColumnType, string> = {
  TEXT: 'CLOB',
  INTEGER: 'NUMBER(10)',
  BIGINT: 'NUMBER(19)',
  SMALLINT: 'NUMBER(5)',
  DECIMAL: 'NUMBER',
  FLOAT: 'BINARY_DOUBLE',
  BOOLEAN: 'NUMBER(1)',
  DATE: 'DATE',
  TIME: 'TIMESTAMP',
  TIMESTAMP: 'TIMESTAMP',
  UUID: 'RAW(16)',
  BLOB: 'BLOB',
  JSON: 'CLOB',
  SERIAL: 'NUMBER',
};

export const oracle: Dialect = {
  name: 'oracle',

  mapType(column: Column): string {
    if (column.type === 'DECIMAL' && column.precision != null) {
      return formatDecimalPrecision('NUMBER', column);
    }
    return TYPE_MAP[column.type];
  },

  formatDefault: defaultFormatDefault,
  formatAutoIncrement(): string { return 'GENERATED ALWAYS AS IDENTITY'; },
  formatTableName(name: string): string { return `"${name}"`; },
  formatColumnName(name: string): string { return `"${name}"`; },
  supportsIfNotExists: false,
};
