import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import type { Column } from '@/types/schema';

interface IndexDialogProps {
  open: boolean;
  columns: Column[];
  initialName?: string;
  initialColumnIds?: string[];
  initialIsUnique?: boolean;
  onConfirm: (name: string, columnIds: string[], isUnique: boolean) => void;
  onCancel: () => void;
}

export default function IndexDialog({
  open,
  columns,
  initialName,
  initialColumnIds,
  initialIsUnique,
  onConfirm,
  onCancel,
}: IndexDialogProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(initialColumnIds ?? []);
  const [isUnique, setIsUnique] = useState(initialIsUnique ?? false);
  const [name, setName] = useState(initialName ?? '');

  // Auto-generate name from selected columns
  useEffect(() => {
    if (initialName) return; // don't override manual name in edit mode
    const colNames = selectedIds
      .map((id) => columns.find((c) => c.id === id)?.name)
      .filter(Boolean);
    setName(colNames.length > 0 ? `idx_${colNames.join('_')}` : '');
  }, [selectedIds, columns, initialName]);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedIds(initialColumnIds ?? []);
      setIsUnique(initialIsUnique ?? false);
      setName(initialName ?? '');
    }
  }, [open, initialColumnIds, initialIsUnique, initialName]);

  const toggleColumn = (colId: string) => {
    setSelectedIds((prev) =>
      prev.includes(colId)
        ? prev.filter((id) => id !== colId)
        : [...prev, colId],
    );
  };

  const handleConfirm = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (selectedIds.length === 0 || !name.trim()) return;
    onConfirm(name.trim(), selectedIds, isUnique);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="nodrag nopan sm:max-w-sm" data-testid="index-dialog">
        <DialogHeader>
          <DialogTitle>{initialName ? 'Edit Index' : 'Create Index'}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {/* Name */}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="index-name-input"
            />
          </div>

          {/* Columns */}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Columns {selectedIds.length > 1 && <span className="text-muted-foreground/60">(order matters)</span>}
            </label>
            <div className="max-h-40 overflow-y-auto rounded-md border p-1">
              {columns.map((col) => {
                const isSelected = selectedIds.includes(col.id);
                const order = isSelected ? selectedIds.indexOf(col.id) + 1 : null;
                return (
                  <button
                    key={col.id}
                    type="button"
                    className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm transition-colors ${
                      isSelected ? 'bg-accent font-medium' : 'hover:bg-muted'
                    }`}
                    onClick={() => toggleColumn(col.id)}
                    data-testid={`index-col-${col.id}`}
                  >
                    <span className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] ${
                      isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-input'
                    }`}>
                      {order}
                    </span>
                    <span>{col.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{col.type}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Unique toggle */}
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={isUnique}
              onCheckedChange={(checked) => setIsUnique(checked as boolean)}
              data-testid="index-unique-toggle"
            />
            Unique index
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={selectedIds.length === 0 || !name.trim()}
            onClick={handleConfirm}
            data-testid="index-confirm-btn"
          >
            {initialName ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
