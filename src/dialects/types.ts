import type { Column } from '@/types/schema';
import type { ColumnField } from '@/types/diff';

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

export type AlterableColumnField = Exclude<ColumnField, 'name'>;

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

  // --- Migration (ALTER/DROP) operations ---

  formatDropTable(name: string): string;
  formatRenameTable(oldName: string, newName: string): string;

  formatAddColumn(tableName: string, column: Column): string;
  formatDropColumn(tableName: string, columnName: string): string;
  formatRenameColumn(tableName: string, oldName: string, newName: string): string;

  // Returns 1+ statements. Dialects that need a single full-redefinition
  // (MySQL MODIFY, Oracle MODIFY) emit one; others may emit one per change.
  formatAlterColumn(
    tableName: string,
    baseline: Column,
    current: Column,
    changes: AlterableColumnField[],
  ): string[];

  formatAddForeignKey(
    srcTable: string,
    srcCol: string,
    tgtTable: string,
    tgtCol: string,
    constraintName: string,
  ): string;
  formatDropForeignKey(tableName: string, constraintName: string): string;

  formatCreateIndex(
    tableName: string,
    indexName: string,
    columnNames: string[],
    isUnique: boolean,
  ): string;
  formatDropIndex(tableName: string, indexName: string): string;

  // Returns a standalone column-comment statement for dialects that use them
  // (PostgreSQL / Oracle). Dialects that carry the comment inline in the column
  // definition (MySQL) or don't support comments (SQLite) return an empty string.
  formatColumnComment(tableName: string, columnName: string, description: string): string;
}
