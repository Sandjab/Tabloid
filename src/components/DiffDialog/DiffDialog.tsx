import { useMemo, useState } from 'react';
import { useSchemaStore } from '@/store/useSchemaStore';
import { useDiffStore } from '@/store/useDiffStore';
import { useDiff } from '@/hooks/useDiff';
import { exportMigration } from '@/utils/export-migration';
import { DIALECTS, DIALECT_NAMES } from '@/dialects';
import { downloadText } from '@/utils/download';
import { isDiffEmpty } from '@/types/diff';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { X, Copy, Download } from 'lucide-react';
import DiffSourcePicker from './DiffSourcePicker';
import DiffSummary from './DiffSummary';

interface DiffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Tab = 'summary' | 'sql';

export default function DiffDialog({ open, onOpenChange }: DiffDialogProps) {
  const baseline = useDiffStore((s) => s.baseline);
  const clearBaseline = useDiffStore((s) => s.clearBaseline);
  const tables = useSchemaStore((s) => s.tables);
  const relations = useSchemaStore((s) => s.relations);
  const schemaName = useSchemaStore((s) => s.schemaName);

  const diff = useDiff();
  const [tab, setTab] = useState<Tab>('summary');
  const [dialect, setDialect] = useState('postgresql');

  const sql = useMemo(() => {
    if (!diff || !baseline) return '';
    return exportMigration(
      diff,
      { tables: baseline.tables, relations: baseline.relations },
      { tables, relations },
      DIALECTS[dialect],
    );
  }, [diff, baseline, tables, relations, dialect]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(sql);
  };

  const handleDownload = () => {
    downloadText(sql, `${schemaName}.migration.sql`);
  };

  const handleClear = () => {
    clearBaseline();
    setTab('summary');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px]" data-testid="diff-dialog">
        <DialogHeader>
          <DialogTitle>Schema Diff &amp; Migration</DialogTitle>
        </DialogHeader>

        {!baseline ? (
          <DiffSourcePicker onBaselineApplied={() => setTab('summary')} />
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 rounded-md bg-muted px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <span className="text-muted-foreground">Baseline: </span>
                <span className="font-medium">
                  {baseline.source.kind}:{baseline.source.name}
                </span>
              </div>
              <Button
                size="xs"
                variant="ghost"
                onClick={handleClear}
                data-testid="diff-clear-baseline-btn"
              >
                <X className="mr-1 size-3.5" /> Clear
              </Button>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                <Button
                  size="xs"
                  variant={tab === 'summary' ? 'default' : 'secondary'}
                  onClick={() => setTab('summary')}
                  data-testid="diff-tab-summary"
                >
                  Summary
                </Button>
                <Button
                  size="xs"
                  variant={tab === 'sql' ? 'default' : 'secondary'}
                  onClick={() => setTab('sql')}
                  data-testid="diff-tab-sql"
                >
                  SQL Migration
                </Button>
              </div>
              {tab === 'sql' && (
                <Select
                  value={dialect}
                  onValueChange={(val) => { if (val) setDialect(val); }}
                >
                  <SelectTrigger size="sm" data-testid="diff-dialect-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIALECT_NAMES.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d.charAt(0).toUpperCase() + d.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="max-h-[50vh] overflow-auto">
              {tab === 'summary' && diff && <DiffSummary diff={diff} />}
              {tab === 'sql' && (
                <pre
                  className="whitespace-pre-wrap rounded-md bg-muted p-3 text-xs text-muted-foreground"
                  data-testid="diff-sql-preview"
                >
                  {sql || '(no migration required)'}
                </pre>
              )}
            </div>

            {tab === 'sql' && diff && !isDiffEmpty(diff) && (
              <DialogFooter>
                <Button variant="outline" onClick={handleCopy} data-testid="diff-copy-btn">
                  <Copy className="mr-1 size-3.5" /> Copy
                </Button>
                <Button onClick={handleDownload} data-testid="diff-download-btn">
                  <Download className="mr-1 size-3.5" /> Download
                </Button>
              </DialogFooter>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
