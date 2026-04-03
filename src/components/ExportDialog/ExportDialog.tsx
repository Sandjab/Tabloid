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
  onClose: () => void;
}

export default function ExportDialog({ onClose }: ExportDialogProps) {
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
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50"
      onClick={onClose}
      data-testid="export-dialog-backdrop"
    >
      <div
        className="absolute left-1/2 top-1/2 flex w-[600px] max-w-[90vw] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-gray-200 bg-white shadow-xl dark:border-gray-600 dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
        data-testid="export-dialog"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-600">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            Export Schema
          </h2>
          <button
            className="text-gray-400 hover:text-gray-600"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="flex gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-600">
          <div className="flex flex-wrap gap-1.5">
            {FORMATS.map((f) => (
              <button
                key={f.value}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  format === f.value
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                }`}
                onClick={() => setFormat(f.value)}
                data-testid={`export-format-${f.value}`}
              >
                {f.label}
              </button>
            ))}
          </div>
          {format === 'sql' && (
            <select
              className="rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300"
              value={dialect}
              onChange={(e) => setDialect(e.target.value)}
              data-testid="export-dialect-select"
            >
              {DIALECT_NAMES.map((d) => (
                <option key={d} value={d}>
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="max-h-[50vh] overflow-auto px-4 py-3">
          <pre className="whitespace-pre-wrap rounded bg-gray-50 p-3 text-xs text-gray-700 dark:bg-gray-900 dark:text-gray-300" data-testid="export-preview">
            {preview}
          </pre>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 px-4 py-3 dark:border-gray-600">
          {format !== 'png' && format !== 'svg' && (
            <button
              className="rounded px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={handleCopy}
              data-testid="export-copy-btn"
            >
              Copy
            </button>
          )}
          <button
            className="rounded bg-blue-500 px-3 py-1.5 text-sm text-white hover:bg-blue-600"
            onClick={handleDownload}
            data-testid="export-download-btn"
          >
            Download
          </button>
        </div>
      </div>
    </div>
  );
}
