import type { Table, Relation, DialectId } from '@/types/schema';
import type { Dialect } from '@/dialects/types';

// Auto-increment type names by dialect
const SERIAL_TYPES: Record<string, Set<string>> = {
  generic: new Set(['SERIAL']),
  postgresql: new Set(['SERIAL', 'BIGSERIAL', 'SMALLSERIAL']),
  mysql: new Set(), // MySQL uses AUTO_INCREMENT keyword, not a type
  sqlite: new Set(), // SQLite uses AUTOINCREMENT keyword
  oracle: new Set(), // Oracle uses GENERATED AS IDENTITY
  sqlserver: new Set(), // SQL Server uses IDENTITY
};

function isAutoIncrementType(type: string, dialectId: DialectId): boolean {
  return SERIAL_TYPES[dialectId]?.has(type) ?? type === 'SERIAL';
}

export function exportSQL(
  tables: Table[],
  relations: Relation[],
  dialect: Dialect,
  projectDialect: DialectId = 'generic',
): string {
  const isNative = projectDialect !== 'generic';
  const statements: string[] = [];

  for (const table of tables) {
    const ifNotExists = dialect.supportsIfNotExists ? ' IF NOT EXISTS' : '';
    const cols = table.columns.map((col) => {
      const parts: string[] = [dialect.formatColumnName(col.name)];

      if (isNative) {
        parts.push(dialect.formatType(col));
      } else {
        parts.push(dialect.mapType(col));
      }

      if (isAutoIncrementType(col.type, projectDialect)) {
        const autoInc = dialect.formatAutoIncrement(col);
        if (autoInc) parts.push(autoInc);
      }

      if (col.isPrimaryKey) parts.push('PRIMARY KEY');
      if (!col.isNullable) parts.push('NOT NULL');
      if (col.isUnique) parts.push('UNIQUE');
      if (col.defaultValue != null) {
        parts.push(`DEFAULT ${dialect.formatDefault(col.defaultValue, col.type)}`);
      }

      return parts.join(' ');
    });

    statements.push(
      `CREATE TABLE${ifNotExists} ${dialect.formatTableName(table.name)} (\n  ${cols.join(',\n  ')}\n);`,
    );
  }

  const tableMap = new Map(tables.map((t) => [t.id, t]));

  for (const rel of relations) {
    const srcTable = tableMap.get(rel.sourceTableId);
    const tgtTable = tableMap.get(rel.targetTableId);
    const srcCol = srcTable?.columns.find((c) => c.id === rel.sourceColumnId);
    const tgtCol = tgtTable?.columns.find((c) => c.id === rel.targetColumnId);

    if (srcTable && tgtTable && srcCol && tgtCol) {
      const fkName = `fk_${srcTable.name}_${srcCol.name}`;
      statements.push(
        `ALTER TABLE ${dialect.formatTableName(srcTable.name)} ADD CONSTRAINT ${dialect.formatColumnName(fkName)} FOREIGN KEY (${dialect.formatColumnName(srcCol.name)}) REFERENCES ${dialect.formatTableName(tgtTable.name)} (${dialect.formatColumnName(tgtCol.name)});`,
      );
    }
  }

  // Column comments
  for (const table of tables) {
    for (const col of table.columns) {
      if (col.description) {
        const escaped = col.description.replace(/'/g, "''");
        statements.push(
          `COMMENT ON COLUMN ${dialect.formatTableName(table.name)}.${dialect.formatColumnName(col.name)} IS '${escaped}';`,
        );
      }
    }
  }

  // Index statements
  for (const table of tables) {
    for (const idx of table.indexes ?? []) {
      const colNames = idx.columnIds
        .map((cid) => table.columns.find((c) => c.id === cid))
        .filter(Boolean)
        .map((c) => dialect.formatColumnName(c!.name));

      if (colNames.length > 0) {
        const unique = idx.isUnique ? ' UNIQUE' : '';
        statements.push(
          `CREATE${unique} INDEX ${dialect.formatColumnName(idx.name)} ON ${dialect.formatTableName(table.name)} (${colNames.join(', ')});`,
        );
      }
    }
  }

  return statements.join('\n\n');
}
