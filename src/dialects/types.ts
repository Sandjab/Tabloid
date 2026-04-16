import type { Column } from '@/types/schema';

// --- Type families for FK compatibility ---

export type TypeFamily =
  | 'integer'
  | 'text'
  | 'decimal'
  | 'boolean'
  | 'date'
  | 'time'
  | 'binary'
  | 'json'
  | 'uuid'
  | 'other';

export interface NativeTypeDefinition {
  name: string;
  family: TypeFamily;
  hasLength?: boolean;
  hasPrecision?: boolean;
  hasScale?: boolean;
  description?: string;
}

// --- Dialect interface ---

export interface Dialect {
  name: string;
  catalog: NativeTypeDefinition[];
  mapType(column: Column): string;
  formatType(column: Column): string;
  formatDefault(value: string, type: string): string;
  formatAutoIncrement(column: Column): string;
  formatTableName(name: string): string;
  formatColumnName(name: string): string;
  supportsIfNotExists: boolean;
}
