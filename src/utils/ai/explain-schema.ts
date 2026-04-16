import type { Relation, Table } from '@/types/schema';
import { DEFAULT_MODEL, getClient, responseText } from './client';

const SYSTEM_PROMPT = `You are explaining a relational database schema to a developer who will paste your output into a README. Produce concise markdown with three sections: an "Overview" paragraph, a "Main tables" list with one sentence per table, and a "Relationships" section summarizing the FK graph. Neutral tone, no preamble, no postscript. Use heading level 2 (##) for sections. Start directly with the first heading.`;

function summarizeSchema(tables: Table[], relations: Relation[]): string {
  const lines: string[] = [];
  lines.push('SCHEMA:');
  for (const t of tables) {
    const cols = t.columns
      .map((c) => {
        const flags: string[] = [];
        if (c.isPrimaryKey) flags.push('PK');
        if (!c.isNullable) flags.push('NN');
        if (c.isUnique) flags.push('UQ');
        const suffix = flags.length ? ` [${flags.join(',')}]` : '';
        return `  - ${c.name} ${c.type}${suffix}`;
      })
      .join('\n');
    lines.push(`- ${t.name}${t.notes ? ` (${t.notes})` : ''}:\n${cols}`);
  }
  if (relations.length) {
    lines.push('\nRELATIONS:');
    for (const rel of relations) {
      const src = tables.find((t) => t.id === rel.sourceTableId);
      const tgt = tables.find((t) => t.id === rel.targetTableId);
      if (!src || !tgt) continue;
      const srcCol = src.columns.find((c) => c.id === rel.sourceColumnId);
      const tgtCol = tgt.columns.find((c) => c.id === rel.targetColumnId);
      if (!srcCol || !tgtCol) continue;
      lines.push(`- ${src.name}.${srcCol.name} → ${tgt.name}.${tgtCol.name} (${rel.type})`);
    }
  }
  return lines.join('\n');
}

export async function explainSchema(
  tables: Table[],
  relations: Relation[],
  apiKey: string,
  model = DEFAULT_MODEL,
): Promise<string> {
  if (tables.length === 0) throw new Error('Schema is empty');
  const client = getClient(apiKey);
  const response = await client.messages.create({
    model,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: summarizeSchema(tables, relations) }],
  });
  return responseText(response).trim();
}

// Exported for testing without an API call.
export { summarizeSchema };
