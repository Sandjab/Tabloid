import type { Column, ColumnType } from '@/types/schema';

export interface Dialect {
  name: string;
  mapType(column: Column): string;
  formatDefault(value: string, type: ColumnType): string;
  formatAutoIncrement(column: Column): string;
  formatTableName(name: string): string;
  formatColumnName(name: string): string;
  supportsIfNotExists: boolean;
}
