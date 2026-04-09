import { useState, useMemo } from 'react';
import { useSchemaStore } from '@/store/useSchemaStore';
import { validateSchema } from '@/utils/validate-schema';
import { DIALECTS, DIALECT_NAMES } from '@/dialects';
import { exportSQL } from '@/utils/export-sql';
import { exportYAML } from '@/utils/export-yaml';
import { exportMermaid } from '@/utils/export-mermaid';
import { exportDBML } from '@/utils/export-dbml';
import { exportExcalidraw } from '@/utils/export-excalidraw';
import { exportPNG, exportSVG } from '@/utils/export-image';
import { downloadText } from '@/utils/download';
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

type ExportFormat = 'sql' | 'yaml' | 'mermaid' | 'dbml' | 'excalidraw' | 'png' | 'svg';

const FORMATS: { value: ExportFormat; label: string }[] = [
  { value: 'sql', label: 'SQL' },
  { value: 'yaml', label: 'YAML' },
  { value: 'mermaid', label: 'Mermaid' },
  { value: 'dbml', label: 'DBML' },
  { value: 'excalidraw', label: 'Excalidraw' },
  { value: 'png', label: 'PNG Image' },
  { value: 'svg', label: 'SVG Image' },
];

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ExportDialog({ open, onOpenChange }: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>('sql');
  const [dialect, setDialect] = useState('postgresql');

  const tables = useSchemaStore((s) => s.tables);
  const relations = useSchemaStore((s) => s.relations);
  const schemaName = useSchemaStore((s) => s.schemaName);

  const validationIssues = useMemo(() => validateSchema(tables, relations), [tables, relations]);
  const hasIssues = validationIssues.length > 0;
  const exportBlocked = hasIssues;

  const preview = useMemo(() => {
    switch (format) {
      case 'sql':
        return exportSQL(tables, relations, DIALECTS[dialect]);
      case 'yaml':
        return exportYAML(tables, relations, schemaName);
      case 'mermaid':
        return exportMermaid(tables, relations);
      case 'dbml':
        return exportDBML(tables, relations);
      case 'excalidraw':
        return exportExcalidraw(tables, relations);
      case 'png':
      case 'svg':
        return `(${format.toUpperCase()} will be exported as an image file)`;
    }
  }, [format, dialect, tables, relations, schemaName]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(preview);
  };

  const handleDownload = async () => {
    switch (format) {
      case 'sql':
        downloadText(preview, `${schemaName}.sql`);
        break;
      case 'yaml':
        downloadText(preview, `${schemaName}.yaml`, 'text/yaml');
        break;
      case 'mermaid':
        downloadText(preview, `${schemaName}.mmd`);
        break;
      case 'dbml':
        downloadText(preview, `${schemaName}.dbml`);
        break;
      case 'excalidraw':
        downloadText(preview, `${schemaName}.excalidraw`, 'application/json');
        break;
      case 'png':
        await exportPNG(`${schemaName}.png`);
        break;
      case 'svg':
        await exportSVG(`${schemaName}.svg`);
        break;
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[600px]"
        data-testid="export-dialog"
      >
        <DialogHeader>
          <DialogTitle>Export Schema</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-3">
          <div className="flex flex-wrap gap-1.5">
            {FORMATS.map((f) => (
              <Button
                key={f.value}
                variant={format === f.value ? 'default' : 'secondary'}
                size="xs"
                onClick={() => setFormat(f.value)}
                data-testid={`export-format-${f.value}`}
              >
                {f.label}
              </Button>
            ))}
          </div>
          {format === 'sql' && (
            <Select
              value={dialect}
              onValueChange={(val) => { if (val) setDialect(val); }}
            >
              <SelectTrigger
                size="sm"
                data-testid="export-dialect-select"
              >
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

        {exportBlocked && (
          <div
            className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            data-testid="export-validation-banner"
          >
            Schema has {validationIssues.filter((w) => w.severity === 'error').length || 'no'} error(s) and{' '}
            {validationIssues.filter((w) => w.severity === 'warning').length || 'no'} warning(s).
            Fix all issues before exporting to {format.toUpperCase()}.
          </div>
        )}

        <div className="max-h-[50vh] overflow-auto">
          <pre
            className="whitespace-pre-wrap rounded-md bg-muted p-3 text-xs text-muted-foreground"
            data-testid="export-preview"
          >
            {preview}
          </pre>
        </div>

        <DialogFooter>
          {format !== 'png' && format !== 'svg' && (
            <Button
              variant="outline"
              onClick={handleCopy}
              disabled={exportBlocked}
              data-testid="export-copy-btn"
            >
              Copy
            </Button>
          )}
          <Button
            onClick={handleDownload}
            disabled={exportBlocked}
            data-testid="export-download-btn"
          >
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
