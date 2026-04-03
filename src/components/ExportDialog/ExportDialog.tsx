import { useState, useMemo } from 'react';
import { useSchemaStore } from '@/store/useSchemaStore';
import { DIALECTS, DIALECT_NAMES } from '@/dialects';
import { exportSQL } from '@/utils/export-sql';
import { exportJSON } from '@/utils/export-json';
import { exportYAML } from '@/utils/export-yaml';
import { exportMermaid } from '@/utils/export-mermaid';
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

type ExportFormat = 'sql' | 'json' | 'yaml' | 'mermaid' | 'excalidraw' | 'png' | 'svg';

const FORMATS: { value: ExportFormat; label: string }[] = [
  { value: 'sql', label: 'SQL' },
  { value: 'json', label: 'JSON (.tabloid.json)' },
  { value: 'yaml', label: 'YAML' },
  { value: 'mermaid', label: 'Mermaid' },
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

  const preview = useMemo(() => {
    switch (format) {
      case 'sql':
        return exportSQL(tables, relations, DIALECTS[dialect]);
      case 'json':
        return exportJSON(tables, relations, 'schema');
      case 'yaml':
        return exportYAML(tables, relations, 'schema');
      case 'mermaid':
        return exportMermaid(tables, relations);
      case 'excalidraw':
        return exportExcalidraw(tables, relations);
      case 'png':
      case 'svg':
        return `(${format.toUpperCase()} will be exported as an image file)`;
    }
  }, [format, dialect, tables, relations]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(preview);
  };

  const handleDownload = async () => {
    switch (format) {
      case 'sql':
        downloadText(preview, 'schema.sql');
        break;
      case 'json':
        downloadText(preview, 'schema.tabloid.json', 'application/json');
        break;
      case 'yaml':
        downloadText(preview, 'schema.yaml', 'text/yaml');
        break;
      case 'mermaid':
        downloadText(preview, 'schema.mmd');
        break;
      case 'excalidraw':
        downloadText(preview, 'schema.excalidraw', 'application/json');
        break;
      case 'png':
        await exportPNG('schema.png');
        break;
      case 'svg':
        await exportSVG('schema.svg');
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
              data-testid="export-copy-btn"
            >
              Copy
            </Button>
          )}
          <Button
            onClick={handleDownload}
            data-testid="export-download-btn"
          >
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
