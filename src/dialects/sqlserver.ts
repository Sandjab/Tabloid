import type { Dialect, NativeTypeDefinition } from './types';
import type { Column, ColumnType } from '@/types/schema';
import { defaultFormatDefault, formatDecimalPrecision, defaultFormatType } from './base';

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

export const sqlserverCatalog: NativeTypeDefinition[] = [
  // integer
  { name: 'TINYINT', family: 'integer', description: 'Unsigned 1-byte integer (0 to 255)' },
  { name: 'SMALLINT', family: 'integer', description: 'Signed 2-byte integer' },
  { name: 'INT', family: 'integer', description: 'Signed 4-byte integer' },
  { name: 'BIGINT', family: 'integer', description: 'Signed 8-byte integer' },
  // text
  { name: 'VARCHAR', family: 'text', hasLength: true, description: 'Variable length ASCII string' },
  { name: 'NVARCHAR', family: 'text', hasLength: true, description: 'Variable length Unicode string' },
  { name: 'CHAR', family: 'text', hasLength: true, description: 'Fixed length ASCII string' },
  { name: 'NCHAR', family: 'text', hasLength: true, description: 'Fixed length Unicode string' },
  { name: 'VARCHAR(MAX)', family: 'text', description: 'Variable length ASCII (up to 2GB)' },
  { name: 'NVARCHAR(MAX)', family: 'text', description: 'Variable length Unicode (up to 2GB)' },
  // decimal
  { name: 'DECIMAL', family: 'decimal', hasPrecision: true, hasScale: true, description: 'Exact fixed-point number' },
  { name: 'NUMERIC', family: 'decimal', hasPrecision: true, hasScale: true, description: 'Exact fixed-point number' },
  { name: 'FLOAT', family: 'decimal', description: 'Approximate floating point' },
  { name: 'REAL', family: 'decimal', description: 'Single precision floating point' },
  { name: 'MONEY', family: 'decimal', description: 'Currency value (8 bytes)' },
  { name: 'SMALLMONEY', family: 'decimal', description: 'Currency value (4 bytes)' },
  // boolean
  { name: 'BIT', family: 'boolean', description: 'Boolean (0 or 1)' },
  // date
  { name: 'DATE', family: 'date', description: 'Calendar date' },
  { name: 'DATETIME', family: 'date', description: 'Date and time (3.33ms precision)' },
  { name: 'DATETIME2', family: 'date', description: 'Date and time (100ns precision)' },
  { name: 'SMALLDATETIME', family: 'date', description: 'Date and time (1 min precision)' },
  { name: 'DATETIMEOFFSET', family: 'date', description: 'Date, time, and timezone offset' },
  // time
  { name: 'TIME', family: 'time', description: 'Time of day (100ns precision)' },
  // binary
  { name: 'BINARY', family: 'binary', hasLength: true, description: 'Fixed length binary' },
  { name: 'VARBINARY', family: 'binary', hasLength: true, description: 'Variable length binary' },
  { name: 'VARBINARY(MAX)', family: 'binary', description: 'Variable length binary (up to 2GB)' },
  // uuid
  { name: 'UNIQUEIDENTIFIER', family: 'uuid', description: '16-byte GUID' },
  // other
  { name: 'XML', family: 'other', description: 'XML data' },
  { name: 'GEOGRAPHY', family: 'other', description: 'Geographic spatial data' },
  { name: 'GEOMETRY', family: 'other', description: 'Geometric spatial data' },
  { name: 'HIERARCHYID', family: 'other', description: 'Position in hierarchy' },
];

export const sqlserver: Dialect = {
  name: 'sqlserver',
  catalog: sqlserverCatalog,

  mapType(column: Column): string {
    if (column.type === 'DECIMAL' && column.precision != null) {
      return formatDecimalPrecision('DECIMAL', column);
    }
    return TYPE_MAP[column.type as ColumnType] ?? column.type;
  },

  formatType: defaultFormatType,
  formatDefault: defaultFormatDefault,
  formatAutoIncrement(): string { return 'IDENTITY(1,1)'; },
  formatTableName(name: string): string { return `[${name}]`; },
  formatColumnName(name: string): string { return `[${name}]`; },
  supportsIfNotExists: false,
};
