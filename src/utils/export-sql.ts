import type { Table, Relation } from '@/types/schema';
import type { Dialect } from '@/dialects/types';

export function exportSQL(
  tables: Table[],
  relations: Relation[],
  dialect: Dialect,
): string {
  const statements: string[] = [];

  for (const table of tables) {
    const ifNotExists = dialect.supportsIfNotExists ? ' IF NOT EXISTS' : '';
    const cols = table.columns.map((col) => {
      const parts: string[] = [dialect.formatColumnName(col.name)];

      parts.push(dialect.mapType(col));

      if (col.type === 'SERIAL') {
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
