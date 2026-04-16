import type { Dialect, NativeTypeDefinition } from './types';
import type { Column, ColumnType } from '@/types/schema';
import { defaultFormatDefault, formatDecimalPrecision, defaultFormatType } from './base';

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

export const oracleCatalog: NativeTypeDefinition[] = [
  // numeric (Oracle uses NUMBER for both integers and decimals)
  { name: 'NUMBER', family: 'decimal', hasPrecision: true, hasScale: true, description: 'Numeric (variable precision, used for integers and decimals)' },
  // text
  { name: 'VARCHAR2', family: 'text', hasLength: true, description: 'Variable length string' },
  { name: 'CHAR', family: 'text', hasLength: true, description: 'Fixed length string' },
  { name: 'CLOB', family: 'text', description: 'Character large object' },
  { name: 'NVARCHAR2', family: 'text', hasLength: true, description: 'Variable length national character string' },
  { name: 'NCLOB', family: 'text', description: 'National character large object' },
  // decimal
  { name: 'BINARY_FLOAT', family: 'decimal', description: '32-bit floating point' },
  { name: 'BINARY_DOUBLE', family: 'decimal', description: '64-bit floating point' },
  // date
  { name: 'DATE', family: 'date', description: 'Date and time (to seconds)' },
  { name: 'TIMESTAMP', family: 'date', description: 'Date and time with fractional seconds' },
  { name: 'TIMESTAMP WITH TIME ZONE', family: 'date', description: 'Timestamp with timezone' },
  // time
  { name: 'INTERVAL YEAR TO MONTH', family: 'time', description: 'Year-month interval' },
  { name: 'INTERVAL DAY TO SECOND', family: 'time', description: 'Day-second interval' },
  // binary
  { name: 'BLOB', family: 'binary', description: 'Binary large object' },
  { name: 'RAW', family: 'binary', hasLength: true, description: 'Raw binary data' },
  // uuid
  { name: 'RAW(16)', family: 'uuid', description: 'UUID stored as 16-byte RAW' },
];

export const oracle: Dialect = {
  name: 'oracle',
  catalog: oracleCatalog,

  mapType(column: Column): string {
    if (column.type === 'DECIMAL' && column.precision != null) {
      return formatDecimalPrecision('NUMBER', column);
    }
    return TYPE_MAP[column.type as ColumnType] ?? column.type;
  },

  formatType: defaultFormatType,
  formatDefault: defaultFormatDefault,
  formatAutoIncrement(): string { return 'GENERATED ALWAYS AS IDENTITY'; },
  formatTableName(name: string): string { return `"${name}"`; },
  formatColumnName(name: string): string { return `"${name}"`; },
  supportsIfNotExists: false,
};
