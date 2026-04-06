import { useState } from 'react';
import { RELATION_TYPE_LABELS } from '@/types/schema';
import type { RelationType } from '@/types/schema';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface RelationTypeDialogProps {
  open: boolean;
  onConfirm: (type: RelationType) => void;
  onCancel: () => void;
}

const RELATION_OPTIONS = (
  Object.entries(RELATION_TYPE_LABELS) as [RelationType, { long: string }][]
).map(([value, labels]) => ({ value, label: labels.long }));

export default function RelationTypeDialog({
  open,
  onConfirm,
  onCancel,
}: RelationTypeDialogProps) {
  const [selected, setSelected] = useState<RelationType>('one-to-many');

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onCancel(); }}>
      <DialogContent data-testid="relation-type-dialog">
        <DialogHeader>
          <DialogTitle>Relation Type</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-1">
          {RELATION_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
            >
              <input
                type="radio"
                name="relationType"
                value={opt.value}
                checked={selected === opt.value}
                onChange={() => setSelected(opt.value)}
                data-testid={`relation-option-${opt.value}`}
              />
              <span className="text-foreground">
                {opt.label}
              </span>
            </label>
          ))}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onCancel}
            data-testid="relation-cancel-btn"
          >
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm(selected)}
            data-testid="relation-confirm-btn"
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
