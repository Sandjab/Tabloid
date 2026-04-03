import type { Dialect } from './types';
import type { Column, ColumnType } from '@/types/schema';
import { defaultFormatDefault, formatDecimalPrecision } from './base';

const TYPE_MAP: Record<ColumnType, string> = {
  TEXT: 'NVARCHAR(MAX)',
  INTEGER: 'INT',
  BIGINT: 'BIGINT',
  SMALLINT: 'SMALLINT',
  DECIMAL: 'DECIMAL',
  FLOAT: 'FLOAT',
  BOOLEAN: 'BIT',
  DATE: 'DATE',
  TIME: 'TIME',
  TIMESTAMP: 'DATETIME2',
  UUID: 'UNIQUEIDENTIFIER',
  BLOB: 'VARBINARY(MAX)',
  JSON: 'NVARCHAR(MAX)',
  SERIAL: 'INT',
};

export const sqlserver: Dialect = {
  name: 'sqlserver',

  mapType(column: Column): string {
    if (column.type === 'DECIMAL' && column.precision != null) {
      return formatDecimalPrecision('DECIMAL', column);
    }
    return TYPE_MAP[column.type];
  },

  formatDefault: defaultFormatDefault,
  formatAutoIncrement(): string { return 'IDENTITY(1,1)'; },
  formatTableName(name: string): string { return `[${name}]`; },
  formatColumnName(name: string): string { return `[${name}]`; },
  supportsIfNotExists: false,
};
