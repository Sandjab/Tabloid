import { useState } from 'react';
import { RELATION_TYPE_LABELS } from '@/types/schema';
import type { RelationType } from '@/types/schema';

interface RelationTypeDialogProps {
  onConfirm: (type: RelationType) => void;
  onCancel: () => void;
}

const RELATION_OPTIONS = (
  Object.entries(RELATION_TYPE_LABELS) as [RelationType, { short: string; long: string }][]
).map(([value, labels]) => ({ value, label: labels.long }));

export default function RelationTypeDialog({
  onConfirm,
  onCancel,
}: RelationTypeDialogProps) {
  const [selected, setSelected] = useState<RelationType>('one-to-many');

  return (
    <div
      className="fixed inset-0 z-50"
      onClick={onCancel}
      data-testid="relation-dialog-backdrop"
    >
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-gray-200 bg-white p-3 shadow-xl dark:border-gray-600 dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
        data-testid="relation-type-dialog"
      >
        <div className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
          Relation Type
        </div>
        <div className="flex flex-col gap-1">
          {RELATION_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <input
                type="radio"
                name="relationType"
                value={opt.value}
                checked={selected === opt.value}
                onChange={() => setSelected(opt.value)}
                data-testid={`relation-option-${opt.value}`}
              />
              <span className="text-gray-700 dark:text-gray-300">
                {opt.label}
              </span>
            </label>
          ))}
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button
            className="rounded px-3 py-1 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={onCancel}
            data-testid="relation-cancel-btn"
          >
            Cancel
          </button>
          <button
            className="rounded bg-blue-500 px-3 py-1 text-sm text-white hover:bg-blue-600"
            onClick={() => onConfirm(selected)}
            data-testid="relation-confirm-btn"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
