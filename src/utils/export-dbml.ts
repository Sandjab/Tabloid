import type { Table, Relation, RelationType } from '@/types/schema';

const DBML_REF_OP: Record<RelationType, string> = {
  'one-to-one': '-',
  'one-to-many': '<',
  'many-to-one': '>',
  'many-to-many': '<>',
};

function formatType(col: { type: string; precision?: number; scale?: number }): string {
  if (col.type === 'DECIMAL' && col.precision != null) {
    return col.scale != null
      ? `decimal(${col.precision},${col.scale})`
      : `decimal(${col.precision})`;
  }
  return col.type.toLowerCase();
}

function escapeQuotes(s: string): string {
  return s.replace(/'/g, "\\'");
}

export function exportDBML(tables: Table[], relations: Relation[]): string {
  const lines: string[] = [];
  const tableMap = new Map(tables.map((t) => [t.id, t]));

  for (const table of tables) {
    lines.push(`Table ${table.name} {`);

    for (const col of table.columns) {
      const settings: string[] = [];
      if (col.isPrimaryKey) settings.push('pk');
      if (!col.isNullable && !col.isPrimaryKey) settings.push('not null');
      if (col.isUnique) settings.push('unique');
      if (col.defaultValue != null) {
        settings.push(`default: '${escapeQuotes(col.defaultValue)}'`);
      }
      const suffix = settings.length > 0 ? ` [${settings.join(', ')}]` : '';
      lines.push(`  ${col.name} ${formatType(col)}${suffix}`);
    }

    if (table.notes) {
      lines.push('');
      lines.push(`  Note: '${escapeQuotes(table.notes)}'`);
    }

    if (table.indexes && table.indexes.length > 0) {
      lines.push('');
      lines.push('  indexes {');
      for (const idx of table.indexes) {
        const colNames = idx.columnIds
          .map((cid) => table.columns.find((c) => c.id === cid)?.name)
          .filter(Boolean) as string[];

        if (colNames.length === 0) continue;

        const colExpr = colNames.length === 1 ? colNames[0] : `(${colNames.join(', ')})`;
        const idxSettings: string[] = [];
        if (idx.isUnique) idxSettings.push('unique');
        if (idx.name) idxSettings.push(`name: '${escapeQuotes(idx.name)}'`);
        const idxSuffix = idxSettings.length > 0 ? ` [${idxSettings.join(', ')}]` : '';
        lines.push(`    ${colExpr}${idxSuffix}`);
      }
      lines.push('  }');
    }

    lines.push('}');
    lines.push('');
  }

  for (const rel of relations) {
    const srcTable = tableMap.get(rel.sourceTableId);
    const tgtTable = tableMap.get(rel.targetTableId);
    const srcCol = srcTable?.columns.find((c) => c.id === rel.sourceColumnId);
    const tgtCol = tgtTable?.columns.find((c) => c.id === rel.targetColumnId);

    if (srcTable && tgtTable && srcCol && tgtCol) {
      const op = DBML_REF_OP[rel.type];
      lines.push(`Ref: ${srcTable.name}.${srcCol.name} ${op} ${tgtTable.name}.${tgtCol.name}`);
    }
  }

  return lines.join('\n').trim();
}
