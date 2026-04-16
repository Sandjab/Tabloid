import { useMemo } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useSchemaStore } from '@/store/useSchemaStore';
import { validateSchema } from '@/utils/validate-schema';
import type { ValidationSeverity, ValidationWarning } from '@/utils/validate-schema';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertCircle, AlertTriangle, Info, MapPin, CheckCircle2 } from 'lucide-react';

interface ValidationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SEVERITY_ORDER: ValidationSeverity[] = ['error', 'warning', 'info'];

const SEVERITY_ICON = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
} as const;

const SEVERITY_TONE = {
  error: 'text-red-600 dark:text-red-400',
  warning: 'text-amber-600 dark:text-amber-400',
  info: 'text-sky-600 dark:text-sky-400',
} as const;

const SEVERITY_LABEL = {
  error: 'Errors',
  warning: 'Warnings',
  info: 'Hints',
} as const;

export default function ValidationDialog({ open, onOpenChange }: ValidationDialogProps) {
  const tables = useSchemaStore((s) => s.tables);
  const relations = useSchemaStore((s) => s.relations);
  const dialect = useSchemaStore((s) => s.dialect);
  const { fitBounds, getInternalNode } = useReactFlow();

  const warnings = useMemo(
    () => validateSchema(tables, relations, dialect),
    [tables, relations, dialect],
  );

  const grouped = useMemo(() => {
    const byseverity = new Map<ValidationSeverity, ValidationWarning[]>();
    for (const sev of SEVERITY_ORDER) byseverity.set(sev, []);
    for (const w of warnings) byseverity.get(w.severity)?.push(w);
    return byseverity;
  }, [warnings]);

  const focusTable = (tableId: string) => {
    const internal = getInternalNode(tableId);
    if (!internal) return;
    const { position } = internal;
    const width = internal.measured?.width ?? 250;
    const height = internal.measured?.height ?? 100;
    fitBounds(
      { x: position.x, y: position.y, width, height },
      { padding: 1, duration: 400 },
    );
  };

  const total = warnings.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]" data-testid="validation-dialog">
        <DialogHeader>
          <DialogTitle>Schema validation</DialogTitle>
        </DialogHeader>

        {total === 0 ? (
          <div
            className="flex flex-col items-center gap-2 rounded-md bg-muted px-3 py-6 text-sm text-muted-foreground"
            data-testid="validation-empty"
          >
            <CheckCircle2 className="size-8 text-emerald-500" />
            <p className="font-medium text-foreground">No issues found</p>
            <p className="text-xs">Schema passes all checks for the current dialect.</p>
          </div>
        ) : (
          <div className="max-h-[60vh] space-y-4 overflow-auto">
            {SEVERITY_ORDER.map((sev) => {
              const items = grouped.get(sev) ?? [];
              if (items.length === 0) return null;
              const Icon = SEVERITY_ICON[sev];
              return (
                <section key={sev} data-testid={`validation-section-${sev}`}>
                  <h4 className={`mb-2 flex items-center gap-1.5 text-sm font-semibold ${SEVERITY_TONE[sev]}`}>
                    <Icon className="size-4" />
                    {SEVERITY_LABEL[sev]} ({items.length})
                  </h4>
                  <ul className="space-y-1">
                    {items.map((w, i) => (
                      <li
                        key={`${w.type}-${w.tableId}-${w.columnId ?? ''}-${i}`}
                        className="flex items-start justify-between gap-2 rounded-md border border-border px-2 py-1.5 text-sm"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-foreground">{w.message}</div>
                          <div className="text-xs text-muted-foreground">{w.type}</div>
                        </div>
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => focusTable(w.tableId)}
                          title="Focus table on canvas"
                          data-testid={`validation-focus-${i}`}
                        >
                          <MapPin className="size-3.5" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
