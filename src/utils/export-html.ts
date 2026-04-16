import type { Column, DialectId, Relation, Table } from '@/types/schema';

export function htmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// URL-safe, lowercase anchor. Always suffixes with `-<index>` so different
// tables never collide even when their names normalise to the same slug
// (e.g. "User Profile" and "User_Profile" both slugify to "user-profile").
export function slugify(name: string, index: number): string {
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'table'}-${index}`;
}

function formatColumnType(col: Column): string {
  let type = col.type;
  if (col.length != null) type += `(${col.length})`;
  else if (col.precision != null) {
    type += `(${col.precision}${col.scale != null ? `,${col.scale}` : ''})`;
  }
  return type;
}

function constraintBadges(col: Column): string {
  const badges: string[] = [];
  if (col.isPrimaryKey) badges.push('<span class="badge pk">PK</span>');
  if (!col.isNullable) badges.push('<span class="badge nn">NN</span>');
  if (col.isUnique) badges.push('<span class="badge uq">UQ</span>');
  return badges.join(' ');
}

interface ResolvedRelation {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  type: Relation['type'];
}

function resolveRelations(tables: Table[], relations: Relation[]): ResolvedRelation[] {
  // Index tables once so resolution stays O(R) instead of O(R*T).
  const tableById = new Map(tables.map((t) => [t.id, t]));
  const out: ResolvedRelation[] = [];
  for (const rel of relations) {
    const src = tableById.get(rel.sourceTableId);
    const tgt = tableById.get(rel.targetTableId);
    if (!src || !tgt) continue;
    const srcCol = src.columns.find((c) => c.id === rel.sourceColumnId);
    const tgtCol = tgt.columns.find((c) => c.id === rel.targetColumnId);
    if (!srcCol || !tgtCol) continue;
    out.push({
      fromTable: src.name,
      fromColumn: srcCol.name,
      toTable: tgt.name,
      toColumn: tgtCol.name,
      type: rel.type,
    });
  }
  return out;
}

const CSS = `
  :root {
    --fg: #1f2937;
    --fg-muted: #6b7280;
    --bg: #ffffff;
    --bg-soft: #f9fafb;
    --border: #e5e7eb;
    --accent: #3b82f6;
    --pk: #f59e0b;
    --nn: #ef4444;
    --uq: #8b5cf6;
    --mono: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --fg: #f3f4f6;
      --fg-muted: #9ca3af;
      --bg: #0f172a;
      --bg-soft: #1e293b;
      --border: #334155;
    }
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: var(--bg); color: var(--fg); }
  body {
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    line-height: 1.5;
    max-width: 960px;
    margin: 0 auto;
    padding: 2rem 1.5rem 4rem;
  }
  header { border-bottom: 1px solid var(--border); padding-bottom: 1rem; margin-bottom: 2rem; }
  header h1 { margin: 0 0 0.25rem; font-size: 1.75rem; }
  header .meta { color: var(--fg-muted); font-size: 0.875rem; }
  nav.toc { background: var(--bg-soft); border: 1px solid var(--border); border-radius: 8px; padding: 1rem 1.25rem; margin-bottom: 2rem; }
  nav.toc h2 { margin: 0 0 0.5rem; font-size: 1rem; }
  nav.toc ul { margin: 0; padding-left: 1.25rem; columns: 2 220px; column-gap: 1.5rem; }
  nav.toc li { break-inside: avoid; }
  nav.toc a { color: var(--accent); text-decoration: none; }
  nav.toc a:hover { text-decoration: underline; }
  section.erd { margin-bottom: 2rem; }
  section.erd img { max-width: 100%; height: auto; display: block; border: 1px solid var(--border); border-radius: 8px; padding: 1rem; background: var(--bg-soft); }
  article.table { border: 1px solid var(--border); border-radius: 8px; padding: 1.25rem 1.5rem; margin-bottom: 1.5rem; }
  article.table h2 { margin: 0 0 0.25rem; font-size: 1.25rem; font-family: var(--mono); }
  article.table .notes { color: var(--fg-muted); font-style: italic; margin: 0.25rem 0 1rem; }
  table.columns { width: 100%; border-collapse: collapse; margin-bottom: 1rem; }
  table.columns th, table.columns td { text-align: left; padding: 0.4rem 0.6rem; font-size: 0.875rem; border-bottom: 1px solid var(--border); }
  table.columns th { font-weight: 600; color: var(--fg-muted); text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.03em; }
  table.columns td.col-name, table.columns td.col-type, table.columns td.col-default { font-family: var(--mono); }
  table.columns td.col-desc { color: var(--fg-muted); }
  .badge { display: inline-block; padding: 0 0.4rem; border-radius: 4px; font-size: 0.7rem; font-weight: 600; margin-right: 0.2rem; }
  .badge.pk { background: rgba(245, 158, 11, 0.15); color: #b45309; }
  .badge.nn { background: rgba(239, 68, 68, 0.15); color: #b91c1c; }
  .badge.uq { background: rgba(139, 92, 246, 0.15); color: #6d28d9; }
  @media (prefers-color-scheme: dark) {
    .badge.pk { color: #fbbf24; }
    .badge.nn { color: #fca5a5; }
    .badge.uq { color: #c4b5fd; }
  }
  h3.subhead { margin: 1rem 0 0.4rem; font-size: 0.875rem; color: var(--fg-muted); text-transform: uppercase; letter-spacing: 0.03em; }
  ul.rels, ul.indexes { margin: 0; padding-left: 1.25rem; font-size: 0.875rem; }
  ul.rels a { color: var(--accent); text-decoration: none; font-family: var(--mono); }
  ul.rels a:hover { text-decoration: underline; }
  ul.indexes .unique { color: var(--uq); font-weight: 600; }
  footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid var(--border); color: var(--fg-muted); font-size: 0.8rem; text-align: center; }
  @media print {
    body { max-width: none; padding: 1cm; }
    nav.toc { break-after: page; }
    article.table { break-inside: avoid; }
  }
`;

export interface ExportHtmlOptions {
  tables: Table[];
  relations: Relation[];
  schemaName: string;
  dialect: DialectId;
  svgDataUrl?: string | null;
  generatedAt?: Date;
}

export function exportHTML(opts: ExportHtmlOptions): string {
  const { tables, relations, schemaName, dialect, svgDataUrl, generatedAt } = opts;
  const ts = (generatedAt ?? new Date()).toISOString();
  const resolved = resolveRelations(tables, relations);
  const anchorByName = new Map<string, string>();
  tables.forEach((t, i) => anchorByName.set(t.name, slugify(t.name, i)));

  // Pre-group relations by table name so the per-table render loop below is O(R)
  // total instead of O(T*R).
  const outgoingByTable = new Map<string, ResolvedRelation[]>();
  const incomingByTable = new Map<string, ResolvedRelation[]>();
  for (const rel of resolved) {
    const from = outgoingByTable.get(rel.fromTable) ?? [];
    from.push(rel);
    outgoingByTable.set(rel.fromTable, from);
    const to = incomingByTable.get(rel.toTable) ?? [];
    to.push(rel);
    incomingByTable.set(rel.toTable, to);
  }

  const toc = tables
    .map((t) => `<li><a href="#${htmlEscape(anchorByName.get(t.name)!)}">${htmlEscape(t.name)}</a></li>`)
    .join('');

  const erdSection = svgDataUrl
    ? `<section class="erd"><h2>Diagram</h2><img src="${htmlEscape(svgDataUrl)}" alt="Schema diagram"/></section>`
    : '';

  const tableBlocks = tables
    .map((t, i) => {
      const anchor = anchorByName.get(t.name)!;
      const notesHtml = t.notes ? `<p class="notes">${htmlEscape(t.notes)}</p>` : '';

      const rows = t.columns
        .map(
          (c) => `
            <tr>
              <td class="col-name">${htmlEscape(c.name)}</td>
              <td class="col-type">${htmlEscape(formatColumnType(c))}</td>
              <td>${constraintBadges(c)}</td>
              <td class="col-default">${c.defaultValue != null ? htmlEscape(c.defaultValue) : ''}</td>
              <td class="col-desc">${c.description ? htmlEscape(c.description) : ''}</td>
            </tr>`,
        )
        .join('');

      const indexesBlock = (t.indexes ?? []).length
        ? `<h3 class="subhead">Indexes</h3>
          <ul class="indexes">${(t.indexes ?? [])
            .map((idx) => {
              const cols = idx.columnIds
                .map((cid) => t.columns.find((c) => c.id === cid)?.name ?? cid)
                .map(htmlEscape)
                .join(', ');
              const uq = idx.isUnique ? '<span class="unique">unique</span> ' : '';
              return `<li>${uq}${htmlEscape(idx.name)} (${cols})</li>`;
            })
            .join('')}</ul>`
        : '';

      const outgoing = outgoingByTable.get(t.name) ?? [];
      const incoming = incomingByTable.get(t.name) ?? [];
      const relBlocks: string[] = [];
      if (outgoing.length > 0) {
        relBlocks.push(
          `<ul class="rels">${outgoing
            .map((r) => {
              const tgt = anchorByName.get(r.toTable);
              const tgtLink = tgt ? `<a href="#${htmlEscape(tgt)}">${htmlEscape(r.toTable)}</a>` : htmlEscape(r.toTable);
              return `<li><code>${htmlEscape(r.fromColumn)}</code> → ${tgtLink}.<code>${htmlEscape(r.toColumn)}</code> (${r.type})</li>`;
            })
            .join('')}</ul>`,
        );
      }
      if (incoming.length > 0) {
        relBlocks.push(
          `<h3 class="subhead">Referenced by</h3><ul class="rels">${incoming
            .map((r) => {
              const src = anchorByName.get(r.fromTable);
              const srcLink = src ? `<a href="#${htmlEscape(src)}">${htmlEscape(r.fromTable)}</a>` : htmlEscape(r.fromTable);
              return `<li>${srcLink}.<code>${htmlEscape(r.fromColumn)}</code> → <code>${htmlEscape(r.toColumn)}</code> (${r.type})</li>`;
            })
            .join('')}</ul>`,
        );
      }
      const relationsBlock = relBlocks.length
        ? `<h3 class="subhead">Relations</h3>${relBlocks.join('')}`
        : '';

      const tableNumber = i + 1;
      return `
        <article class="table" id="${htmlEscape(anchor)}">
          <h2>${tableNumber}. ${htmlEscape(t.name)}</h2>
          ${notesHtml}
          <table class="columns">
            <thead>
              <tr>
                <th>Column</th><th>Type</th><th>Constraints</th><th>Default</th><th>Description</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          ${indexesBlock}
          ${relationsBlock}
        </article>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${htmlEscape(schemaName)} — Schema</title>
  <style>${CSS}</style>
</head>
<body>
  <header>
    <h1>${htmlEscape(schemaName)}</h1>
    <p class="meta">${tables.length} tables · ${relations.length} relations · dialect: <code>${htmlEscape(dialect)}</code> · generated ${htmlEscape(ts)}</p>
  </header>
  <nav class="toc">
    <h2>Tables</h2>
    <ul>${toc}</ul>
  </nav>
  ${erdSection}
  <section class="tables">
    ${tableBlocks}
  </section>
  <footer><small>Generated by Tabloid</small></footer>
</body>
</html>`;
}
