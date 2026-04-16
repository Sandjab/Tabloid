import type { Dialect, NativeTypeDefinition, AlterableColumnField } from './types';
import type { Column, ColumnType } from '@/types/schema';
import { defaultFormatDefault, formatDecimalPrecision, defaultFormatType, columnDefinition } from './base';

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

export const mysqlCatalog: NativeTypeDefinition[] = [
  // integer
  { name: 'TINYINT', family: 'integer', description: 'Signed 1-byte integer (-128 to 127)' },
  { name: 'SMALLINT', family: 'integer', description: 'Signed 2-byte integer' },
  { name: 'MEDIUMINT', family: 'integer', description: 'Signed 3-byte integer' },
  { name: 'INT', family: 'integer', description: 'Signed 4-byte integer' },
  { name: 'BIGINT', family: 'integer', description: 'Signed 8-byte integer' },
  // text
  { name: 'VARCHAR', family: 'text', hasLength: true, description: 'Variable length string with limit' },
  { name: 'CHAR', family: 'text', hasLength: true, description: 'Fixed length string' },
  { name: 'TEXT', family: 'text', description: 'Variable length string (up to 64KB)' },
  { name: 'MEDIUMTEXT', family: 'text', description: 'Variable length string (up to 16MB)' },
  { name: 'LONGTEXT', family: 'text', description: 'Variable length string (up to 4GB)' },
  // decimal
  { name: 'DECIMAL', family: 'decimal', hasPrecision: true, hasScale: true, description: 'Exact fixed-point number' },
  { name: 'FLOAT', family: 'decimal', description: 'Single precision floating point' },
  { name: 'DOUBLE', family: 'decimal', description: 'Double precision floating point' },
  // boolean
  { name: 'BOOLEAN', family: 'boolean', description: 'Alias for TINYINT(1)' },
  // date
  { name: 'DATE', family: 'date', description: 'Calendar date (YYYY-MM-DD)' },
  { name: 'DATETIME', family: 'date', description: 'Date and time' },
  { name: 'TIMESTAMP', family: 'date', description: 'Date and time (UTC stored)' },
  // time
  { name: 'TIME', family: 'time', description: 'Time of day' },
  { name: 'YEAR', family: 'time', description: 'Year value' },
  // binary
  { name: 'BINARY', family: 'binary', hasLength: true, description: 'Fixed length binary' },
  { name: 'VARBINARY', family: 'binary', hasLength: true, description: 'Variable length binary' },
  { name: 'BLOB', family: 'binary', description: 'Binary large object (up to 64KB)' },
  { name: 'LONGBLOB', family: 'binary', description: 'Binary large object (up to 4GB)' },
  // json
  { name: 'JSON', family: 'json', description: 'JSON document' },
  // other
  { name: 'ENUM', family: 'other', description: 'Enumeration of string values' },
  { name: 'SET', family: 'other', description: 'Set of string values' },
];

export const mysql: Dialect = {
  name: 'mysql',
  catalog: mysqlCatalog,

  mapType(column: Column): string {
    if (column.type === 'DECIMAL' && column.precision != null) {
      return formatDecimalPrecision('DECIMAL', column);
    }
    return TYPE_MAP[column.type as ColumnType] ?? column.type;
  },

  formatType: defaultFormatType,
  formatDefault: defaultFormatDefault,
  formatAutoIncrement(): string { return 'AUTO_INCREMENT'; },
  formatTableName(name: string): string { return `\`${name}\``; },
  formatColumnName(name: string): string { return `\`${name}\``; },
  supportsIfNotExists: true,

  formatDropTable(name: string): string {
    return `DROP TABLE IF EXISTS ${this.formatTableName(name)};`;
  },
  formatRenameTable(oldName: string, newName: string): string {
    return `ALTER TABLE ${this.formatTableName(oldName)} RENAME TO ${this.formatTableName(newName)};`;
  },

  formatAddColumn(tableName: string, column: Column): string {
    let stmt = `ALTER TABLE ${this.formatTableName(tableName)} ADD COLUMN ${columnDefinition(this, column)}`;
    if (column.description) {
      const esc = column.description.replace(/'/g, "''");
      stmt += ` COMMENT '${esc}'`;
    }
    return `${stmt};`;
  },
  formatDropColumn(tableName: string, columnName: string): string {
    return `ALTER TABLE ${this.formatTableName(tableName)} DROP COLUMN ${this.formatColumnName(columnName)};`;
  },
  formatRenameColumn(tableName: string, oldName: string, newName: string): string {
    return `ALTER TABLE ${this.formatTableName(tableName)} RENAME COLUMN ${this.formatColumnName(oldName)} TO ${this.formatColumnName(newName)};`;
  },

  formatAlterColumn(
    tableName: string,
    _baseline: Column,
    current: Column,
    changes: AlterableColumnField[],
  ): string[] {
    const t = this.formatTableName(tableName);
    const out: string[] = [];

    // MySQL MODIFY replaces the full column definition. Always include COMMENT
    // when the column has a description, so existing comments are preserved when
    // only the type/nullability/default changes; and emit COMMENT '' to clear it
    // when the user explicitly removes the description.
    const modifyFields: AlterableColumnField[] = ['type', 'nullable', 'default', 'precision', 'scale', 'description'];
    if (changes.some((ch) => modifyFields.includes(ch))) {
      let stmt = `ALTER TABLE ${t} MODIFY COLUMN ${columnDefinition(this, current)}`;
      if (current.description) {
        const esc = current.description.replace(/'/g, "''");
        stmt += ` COMMENT '${esc}'`;
      } else if (changes.includes('description')) {
        stmt += ` COMMENT ''`;
      }
      out.push(`${stmt};`);
    }
    if (changes.includes('primaryKey') || changes.includes('unique')) {
      out.push(`-- TODO: primary key / unique constraint change on ${tableName}.${current.name} requires manual ADD/DROP CONSTRAINT`);
    }
    return out;
  },

  formatAddForeignKey(srcTable, srcCol, tgtTable, tgtCol, constraintName): string {
    return `ALTER TABLE ${this.formatTableName(srcTable)} ADD CONSTRAINT ${this.formatColumnName(constraintName)} FOREIGN KEY (${this.formatColumnName(srcCol)}) REFERENCES ${this.formatTableName(tgtTable)} (${this.formatColumnName(tgtCol)});`;
  },
  formatDropForeignKey(tableName: string, constraintName: string): string {
    return `ALTER TABLE ${this.formatTableName(tableName)} DROP FOREIGN KEY ${this.formatColumnName(constraintName)};`;
  },

  formatCreateIndex(tableName, indexName, columnNames, isUnique): string {
    const unique = isUnique ? ' UNIQUE' : '';
    const cols = columnNames.map((n) => this.formatColumnName(n)).join(', ');
    return `CREATE${unique} INDEX ${this.formatColumnName(indexName)} ON ${this.formatTableName(tableName)} (${cols});`;
  },
  formatDropIndex(tableName: string, indexName: string): string {
    return `DROP INDEX ${this.formatColumnName(indexName)} ON ${this.formatTableName(tableName)};`;
  },

  // MySQL carries the comment inline in ADD COLUMN / MODIFY COLUMN, so no
  // standalone statement is needed.
  formatColumnComment(): string {
    return '';
  },
};
