import type { Dialect, NativeTypeDefinition } from './types';
import type { Column, ColumnType } from '@/types/schema';
import { defaultFormatDefault, defaultFormatType, columnDefinition } from './base';

const TYPE_MAP: Record<ColumnType, string> = {
  TEXT: 'TEXT',
  INTEGER: 'INTEGER',
  BIGINT: 'INTEGER',
  SMALLINT: 'INTEGER',
  DECIMAL: 'REAL',
  FLOAT: 'REAL',
  BOOLEAN: 'INTEGER',
  DATE: 'TEXT',
  TIME: 'TEXT',
  TIMESTAMP: 'TEXT',
  UUID: 'TEXT',
  BLOB: 'BLOB',
  JSON: 'TEXT',
  SERIAL: 'INTEGER',
};

export const sqliteCatalog: NativeTypeDefinition[] = [
  // integer
  { name: 'INTEGER', family: 'integer', description: 'Signed integer (1, 2, 3, 4, 6, or 8 bytes)' },
  // text
  { name: 'TEXT', family: 'text', description: 'Text string (UTF-8, UTF-16)' },
  // decimal
  { name: 'REAL', family: 'decimal', description: '8-byte floating point' },
  { name: 'NUMERIC', family: 'decimal', description: 'Numeric with type affinity' },
  // binary
  { name: 'BLOB', family: 'binary', description: 'Binary large object' },
];

export const sqlite: Dialect = {
  name: 'sqlite',
  catalog: sqliteCatalog,

  mapType(column: Column): string {
    return TYPE_MAP[column.type as ColumnType] ?? column.type;
  },

  formatType: defaultFormatType,
  formatDefault: defaultFormatDefault,
  formatAutoIncrement(): string { return 'AUTOINCREMENT'; },
  formatTableName(name: string): string { return `"${name}"`; },
  formatColumnName(name: string): string { return `"${name}"`; },
  supportsIfNotExists: true,

  formatDropTable(name: string): string {
    return `DROP TABLE IF EXISTS ${this.formatTableName(name)};`;
  },
  formatRenameTable(oldName: string, newName: string): string {
    return `ALTER TABLE ${this.formatTableName(oldName)} RENAME TO ${this.formatTableName(newName)};`;
  },

  formatAddColumn(tableName: string, column: Column): string {
    return `ALTER TABLE ${this.formatTableName(tableName)} ADD COLUMN ${columnDefinition(this, column)};`;
  },
  formatDropColumn(tableName: string, columnName: string): string {
    // SQLite 3.35+ supports DROP COLUMN
    return `ALTER TABLE ${this.formatTableName(tableName)} DROP COLUMN ${this.formatColumnName(columnName)}; -- WARNING: requires SQLite 3.35+`;
  },
  formatRenameColumn(tableName: string, oldName: string, newName: string): string {
    return `ALTER TABLE ${this.formatTableName(tableName)} RENAME COLUMN ${this.formatColumnName(oldName)} TO ${this.formatColumnName(newName)}; -- WARNING: requires SQLite 3.25+`;
  },

  formatAlterColumn(
    tableName: string,
    _baseline: Column,
    current: Column,
  ): string[] {
    return [
      `-- WARNING: SQLite does not support ALTER COLUMN. To change \`${current.name}\` on \`${tableName}\`, recreate the table:`,
      `--   1. BEGIN TRANSACTION;`,
      `--   2. CREATE TABLE ${this.formatTableName(tableName + '_new')} (... new definition ...);`,
      `--   3. INSERT INTO ${this.formatTableName(tableName + '_new')} SELECT ... FROM ${this.formatTableName(tableName)};`,
      `--   4. DROP TABLE ${this.formatTableName(tableName)};`,
      `--   5. ALTER TABLE ${this.formatTableName(tableName + '_new')} RENAME TO ${this.formatTableName(tableName)};`,
      `--   6. COMMIT;`,
    ];
  },

  formatAddForeignKey(): string {
    return `-- WARNING: SQLite does not support ADD CONSTRAINT. Foreign keys must be declared at table creation.`;
  },
  formatDropForeignKey(): string {
    return `-- WARNING: SQLite does not support DROP CONSTRAINT. Recreate the table without the FK.`;
  },

  formatCreateIndex(tableName, indexName, columnNames, isUnique): string {
    const unique = isUnique ? ' UNIQUE' : '';
    const cols = columnNames.map((n) => this.formatColumnName(n)).join(', ');
    return `CREATE${unique} INDEX ${this.formatColumnName(indexName)} ON ${this.formatTableName(tableName)} (${cols});`;
  },
  formatDropIndex(_tableName: string, indexName: string): string {
    return `DROP INDEX ${this.formatColumnName(indexName)};`;
  },
};
