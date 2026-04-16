export type { Dialect, NativeTypeDefinition, TypeFamily } from './types';
export { postgresql } from './postgresql';
export { mysql } from './mysql';
export { sqlite } from './sqlite';
export { oracle } from './oracle';
export { sqlserver } from './sqlserver';

import type { Dialect, NativeTypeDefinition } from './types';
import type { DialectId } from '@/types/schema';
import { postgresql } from './postgresql';
import { mysql } from './mysql';
import { sqlite } from './sqlite';
import { oracle } from './oracle';
import { sqlserver } from './sqlserver';

// --- Generic (abstract) catalog ---

export const genericCatalog: NativeTypeDefinition[] = [
  // integer
  { name: 'SMALLINT', family: 'integer', description: 'Small integer' },
  { name: 'INTEGER', family: 'integer', description: 'Standard integer' },
  { name: 'BIGINT', family: 'integer', description: 'Large integer' },
  { name: 'SERIAL', family: 'integer', description: 'Auto-incrementing integer' },
  // text
  { name: 'TEXT', family: 'text', description: 'Variable length text' },
  // decimal
  { name: 'DECIMAL', family: 'decimal', hasPrecision: true, hasScale: true, description: 'Exact decimal number' },
  { name: 'FLOAT', family: 'decimal', description: 'Floating point number' },
  // boolean
  { name: 'BOOLEAN', family: 'boolean', description: 'True/false value' },
  // date
  { name: 'DATE', family: 'date', description: 'Calendar date' },
  { name: 'TIMESTAMP', family: 'date', description: 'Date and time' },
  // time
  { name: 'TIME', family: 'time', description: 'Time of day' },
  // binary
  { name: 'BLOB', family: 'binary', description: 'Binary data' },
  // json
  { name: 'JSON', family: 'json', description: 'JSON data' },
  // uuid
  { name: 'UUID', family: 'uuid', description: 'Universally unique identifier' },
];

// --- Dialect registry ---

export const DIALECTS: Record<string, Dialect> = {
  postgresql,
  mysql,
  sqlite,
  oracle,
  sqlserver,
};

export const DIALECT_NAMES = Object.keys(DIALECTS);

export const ALL_DIALECT_IDS: DialectId[] = [
  'generic', 'postgresql', 'mysql', 'sqlite', 'oracle', 'sqlserver',
];

export const DIALECT_DISPLAY_NAMES: Record<DialectId, string> = {
  generic: 'Generic',
  postgresql: 'PostgreSQL',
  mysql: 'MySQL',
  sqlite: 'SQLite',
  oracle: 'Oracle',
  sqlserver: 'SQL Server',
};

export function getCatalogForDialect(dialectId: DialectId): NativeTypeDefinition[] {
  if (dialectId === 'generic') return genericCatalog;
  return DIALECTS[dialectId]?.catalog ?? genericCatalog;
}

export function getDialect(dialectId: DialectId): Dialect | undefined {
  if (dialectId === 'generic') return undefined;
  return DIALECTS[dialectId];
}
