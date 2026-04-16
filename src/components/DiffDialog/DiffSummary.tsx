import type { SchemaDiff } from '@/types/diff';
import type { Table } from '@/types/schema';
import { isDiffEmpty } from '@/types/diff';

interface DiffSummaryProps {
  diff: SchemaDiff;
}

function tableLabel(t: Table): string {
  return t.name;
}

export default function DiffSummary({ diff }: DiffSummaryProps) {
  if (isDiffEmpty(diff)) {
    return (
      <div
        className="rounded-md bg-muted px-3 py-4 text-center text-sm text-muted-foreground"
        data-testid="diff-summary-empty"
      >
        No changes detected.
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm" data-testid="diff-summary">
      {diff.tables.added.length > 0 && (
        <Section title={`Tables added (${diff.tables.added.length})`} tone="added">
          <ul className="ml-4 list-disc">
            {diff.tables.added.map((t) => (
              <li key={t.id}>{tableLabel(t)}</li>
            ))}
          </ul>
        </Section>
      )}

      {diff.tables.removed.length > 0 && (
        <Section title={`Tables removed (${diff.tables.removed.length})`} tone="removed">
          <ul className="ml-4 list-disc">
            {diff.tables.removed.map((t) => (
              <li key={t.id}>{tableLabel(t)}</li>
            ))}
          </ul>
        </Section>
      )}

      {diff.tables.modified.length > 0 && (
        <Section title={`Tables modified (${diff.tables.modified.length})`} tone="modified">
          <ul className="ml-4 space-y-2 list-disc">
            {diff.tables.modified.map((td) => (
              <li key={td.current.id}>
                <strong>{td.baseline.name}</strong>
                {td.renamed && <span> → <strong>{td.current.name}</strong></span>}
                <ul className="ml-4 mt-1 list-[circle] text-xs text-muted-foreground">
                  {td.columns.added.map((c) => (
                    <li key={c.id}>
                      <span className="text-emerald-600 dark:text-emerald-400">+ column</span> {c.name} ({c.type})
                    </li>
                  ))}
                  {td.columns.removed.map((c) => (
                    <li key={c.id}>
                      <span className="text-red-600 dark:text-red-400">− column</span> {c.name}
                    </li>
                  ))}
                  {td.columns.modified.map((cd) => (
                    <li key={cd.current.id}>
                      <span className="text-amber-600 dark:text-amber-400">~ column</span> {cd.current.name}: {cd.changes.join(', ')}
                      {cd.changes.includes('type') && (
                        <> ({cd.baseline.type} → {cd.current.type})</>
                      )}
                    </li>
                  ))}
                  {td.indexes.added.map((idx) => (
                    <li key={idx.id}>
                      <span className="text-emerald-600 dark:text-emerald-400">+ index</span> {idx.name}
                    </li>
                  ))}
                  {td.indexes.removed.map((idx) => (
                    <li key={idx.id}>
                      <span className="text-red-600 dark:text-red-400">− index</span> {idx.name}
                    </li>
                  ))}
                  {td.indexes.modified.map((idxDiff) => (
                    <li key={idxDiff.current.id}>
                      <span className="text-amber-600 dark:text-amber-400">~ index</span> {idxDiff.current.name}: {idxDiff.changes.join(', ')}
                    </li>
                  ))}
                  {td.notesChanged && (
                    <li>
                      <span className="text-amber-600 dark:text-amber-400">~ notes</span>
                    </li>
                  )}
                </ul>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(diff.relations.added.length > 0 ||
        diff.relations.removed.length > 0 ||
        diff.relations.modified.length > 0) && (
        <Section title="Relations">
          <ul className="ml-4 space-y-1 list-disc text-xs">
            {diff.relations.added.map((r) => (
              <li key={r.id}>
                <span className="text-emerald-600 dark:text-emerald-400">+</span> {r.type}
              </li>
            ))}
            {diff.relations.removed.map((r) => (
              <li key={r.id}>
                <span className="text-red-600 dark:text-red-400">−</span> {r.type}
              </li>
            ))}
            {diff.relations.modified.map((rd) => (
              <li key={rd.current.id}>
                <span className="text-amber-600 dark:text-amber-400">~</span> {rd.baseline.type} → {rd.current.type}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  children,
  tone,
}: {
  title: string;
  children: React.ReactNode;
  tone?: 'added' | 'removed' | 'modified';
}) {
  const toneClass =
    tone === 'added'
      ? 'text-emerald-700 dark:text-emerald-400'
      : tone === 'removed'
        ? 'text-red-700 dark:text-red-400'
        : tone === 'modified'
          ? 'text-amber-700 dark:text-amber-400'
          : 'text-foreground';
  return (
    <div>
      <div className={`mb-1 font-semibold ${toneClass}`}>{title}</div>
      {children}
    </div>
  );
}
