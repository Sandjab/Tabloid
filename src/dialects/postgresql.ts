import type { Dialect, NativeTypeDefinition } from './types';
import type { Column, ColumnType } from '@/types/schema';
import { defaultFormatDefault, formatDecimalPrecision, defaultFormatType } from './base';

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

export const postgresqlCatalog: NativeTypeDefinition[] = [
  // integer
  { name: 'SMALLINT', family: 'integer', description: 'Signed 2-byte integer' },
  { name: 'INTEGER', family: 'integer', description: 'Signed 4-byte integer' },
  { name: 'BIGINT', family: 'integer', description: 'Signed 8-byte integer' },
  { name: 'SERIAL', family: 'integer', description: 'Auto-incrementing 4-byte integer' },
  { name: 'BIGSERIAL', family: 'integer', description: 'Auto-incrementing 8-byte integer' },
  // text
  { name: 'TEXT', family: 'text', description: 'Variable unlimited length string' },
  { name: 'VARCHAR', family: 'text', hasLength: true, description: 'Variable length string with limit' },
  { name: 'CHAR', family: 'text', hasLength: true, description: 'Fixed length string' },
  // decimal
  { name: 'NUMERIC', family: 'decimal', hasPrecision: true, hasScale: true, description: 'Exact numeric with selectable precision' },
  { name: 'REAL', family: 'decimal', description: 'Single precision floating point (4 bytes)' },
  { name: 'DOUBLE PRECISION', family: 'decimal', description: 'Double precision floating point (8 bytes)' },
  // boolean
  { name: 'BOOLEAN', family: 'boolean', description: 'Logical boolean (true/false)' },
  // date
  { name: 'DATE', family: 'date', description: 'Calendar date (no time)' },
  { name: 'TIMESTAMP', family: 'date', description: 'Date and time (no timezone)' },
  { name: 'TIMESTAMPTZ', family: 'date', description: 'Date and time with timezone' },
  // time
  { name: 'TIME', family: 'time', description: 'Time of day (no date)' },
  { name: 'TIMETZ', family: 'time', description: 'Time of day with timezone' },
  { name: 'INTERVAL', family: 'time', description: 'Time interval' },
  // binary
  { name: 'BYTEA', family: 'binary', description: 'Binary data (byte array)' },
  // json
  { name: 'JSON', family: 'json', description: 'JSON data (text storage)' },
  { name: 'JSONB', family: 'json', description: 'JSON data (binary storage, indexable)' },
  // uuid
  { name: 'UUID', family: 'uuid', description: 'Universally unique identifier' },
  // other
  { name: 'XML', family: 'other', description: 'XML data' },
  { name: 'INET', family: 'other', description: 'IPv4 or IPv6 host address' },
  { name: 'CIDR', family: 'other', description: 'IPv4 or IPv6 network address' },
  { name: 'MACADDR', family: 'other', description: 'MAC address' },
  { name: 'TSVECTOR', family: 'other', description: 'Full-text search document' },
  { name: 'POINT', family: 'other', description: 'Geometric point' },
];

export const postgresql: Dialect = {
  name: 'postgresql',
  catalog: postgresqlCatalog,

  mapType(column: Column): string {
    if (column.type === 'DECIMAL' && column.precision != null) {
      return formatDecimalPrecision('NUMERIC', column);
    }
    return TYPE_MAP[column.type as ColumnType] ?? column.type;
  },

  formatType: defaultFormatType,
  formatDefault: defaultFormatDefault,
  formatAutoIncrement(): string { return ''; },
  formatTableName(name: string): string { return `"${name}"`; },
  formatColumnName(name: string): string { return `"${name}"`; },
  supportsIfNotExists: true,
};
