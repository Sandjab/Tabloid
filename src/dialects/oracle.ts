import type { Dialect, NativeTypeDefinition, AlterableColumnField } from './types';
import type { Column, ColumnType } from '@/types/schema';
import { defaultFormatDefault, formatDecimalPrecision, defaultFormatType, columnDefinition } from './base';

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

  formatDropTable(name: string): string {
    return `DROP TABLE ${this.formatTableName(name)} CASCADE CONSTRAINTS;`;
  },
  formatRenameTable(oldName: string, newName: string): string {
    return `ALTER TABLE ${this.formatTableName(oldName)} RENAME TO ${this.formatTableName(newName)};`;
  },

  formatAddColumn(tableName: string, column: Column): string {
    return `ALTER TABLE ${this.formatTableName(tableName)} ADD (${columnDefinition(this, column)});`;
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
    const col = this.formatColumnName(current.name);
    const out: string[] = [];

    const modifyFields: AlterableColumnField[] = ['type', 'nullable', 'default', 'precision', 'scale'];
    const needsModify = changes.some((ch) => modifyFields.includes(ch));
    if (needsModify) {
      const parts: string[] = [col, this.formatType(current)];
      if (changes.includes('default')) {
        if (current.defaultValue != null) {
          parts.push(`DEFAULT ${this.formatDefault(current.defaultValue, current.type)}`);
        } else {
          parts.push(`DEFAULT NULL`);
        }
      }
      if (changes.includes('nullable')) {
        parts.push(current.isNullable ? 'NULL' : 'NOT NULL');
      }
      out.push(`ALTER TABLE ${t} MODIFY (${parts.join(' ')});`);
    }
    if (changes.includes('description')) {
      const esc = (current.description ?? '').replace(/'/g, "''");
      out.push(`COMMENT ON COLUMN ${t}.${col} IS '${esc}';`);
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
    return `ALTER TABLE ${this.formatTableName(tableName)} DROP CONSTRAINT ${this.formatColumnName(constraintName)};`;
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
