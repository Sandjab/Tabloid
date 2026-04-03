import type { Dialect } from './types';
import type { Column, ColumnType } from '@/types/schema';
import { defaultFormatDefault, formatDecimalPrecision } from './base';

const TYPE_MAP: Record<ColumnType, string> = {
  TEXT: 'TEXT',
  INTEGER: 'INT',
  BIGINT: 'BIGINT',
  SMALLINT: 'SMALLINT',
  DECIMAL: 'DECIMAL',
  FLOAT: 'DOUBLE',
  BOOLEAN: 'TINYINT(1)',
  DATE: 'DATE',
  TIME: 'TIME',
  TIMESTAMP: 'DATETIME',
  UUID: 'CHAR(36)',
  BLOB: 'LONGBLOB',
  JSON: 'JSON',
  SERIAL: 'INT',
};

export const mysql: Dialect = {
  name: 'mysql',

  mapType(column: Column): string {
    if (column.type === 'DECIMAL' && column.precision != null) {
      return formatDecimalPrecision('DECIMAL', column);
    }
    return TYPE_MAP[column.type];
  },

  formatDefault: defaultFormatDefault,
  formatAutoIncrement(): string { return 'AUTO_INCREMENT'; },
  formatTableName(name: string): string { return `\`${name}\``; },
  formatColumnName(name: string): string { return `\`${name}\``; },
  supportsIfNotExists: true,
};
