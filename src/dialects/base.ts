import type { Column, ColumnType } from '@/types/schema';

export function defaultFormatDefault(value: string, type: ColumnType): string {
  if (type === 'TEXT' || type === 'UUID') return `'${value}'`;
  return value;
}

export function formatDecimalPrecision(keyword: string, column: Column): string {
  return `${keyword}(${column.precision}${column.scale != null ? `, ${column.scale}` : ''})`;
}
