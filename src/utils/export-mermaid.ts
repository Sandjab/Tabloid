import type { Table, Relation, RelationType } from '@/types/schema';

const MERMAID_RELATION: Record<RelationType, string> = {
  'one-to-one': '||--||',
  'one-to-many': '||--o{',
  'many-to-one': '}o--||',
  'many-to-many': '}o--o{',
};

export function exportMermaid(tables: Table[], relations: Relation[]): string {
  const lines: string[] = ['erDiagram'];

  const fkColumnIds = new Set(
    relations.flatMap((r) => [r.sourceColumnId, r.targetColumnId]),
  );
  const tableMap = new Map(tables.map((t) => [t.id, t]));

  for (const table of tables) {
    lines.push(`    ${table.name} {`);
    for (const col of table.columns) {
      const constraints: string[] = [];
      if (col.isPrimaryKey) constraints.push('PK');
      if (fkColumnIds.has(col.id) && !col.isPrimaryKey) constraints.push('FK');
      const suffix = constraints.length > 0 ? ` ${constraints.join(',')}` : '';
      lines.push(`        ${col.type} ${col.name}${suffix}`);
    }
    lines.push('    }');
  }

  for (const rel of relations) {
    const srcTable = tableMap.get(rel.sourceTableId);
    const tgtTable = tableMap.get(rel.targetTableId);
    if (srcTable && tgtTable) {
      const arrow = MERMAID_RELATION[rel.type];
      lines.push(`    ${srcTable.name} ${arrow} ${tgtTable.name} : ""`);
    }
  }

  return lines.join('\n');
}
