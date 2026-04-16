import type { Table, Column } from '@/types/schema';

function formatColumnType(col: Column): string {
  let type = col.type;
  if (col.length != null) type += `(${col.length})`;
  else if (col.precision != null) {
    type += `(${col.precision}${col.scale != null ? `,${col.scale}` : ''})`;
  }
  return type;
}

function formatConstraints(col: Column): string {
  const parts: string[] = [];
  if (col.isPrimaryKey) parts.push('PK');
  if (!col.isNullable) parts.push('NN');
  if (col.isUnique) parts.push('UQ');
  return parts.join(', ');
}

export function exportTableMarkdown(table: Table): string {
  const lines: string[] = [];

  lines.push(`## ${table.name}`);
  lines.push('');

  if (table.notes) {
    lines.push(table.notes);
    lines.push('');
  }

  const hasDefault = table.columns.some((c) => c.defaultValue != null);
  const hasDescription = table.columns.some((c) => c.description);

  // Build header
  const headers = ['Column', 'Type', 'Constraints'];
  if (hasDefault) headers.push('Default');
  if (hasDescription) headers.push('Description');

  const separator = headers.map((h) => '-'.repeat(h.length));

  lines.push(`| ${headers.join(' | ')} |`);
  lines.push(`| ${separator.join(' | ')} |`);

  for (const col of table.columns) {
    const cells = [
      col.name,
      formatColumnType(col),
      formatConstraints(col),
    ];
    if (hasDefault) cells.push(col.defaultValue ?? '');
    if (hasDescription) cells.push(col.description ?? '');
    lines.push(`| ${cells.join(' | ')} |`);
  }

  return lines.join('\n');
}
