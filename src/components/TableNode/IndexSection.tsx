import { useState } from 'react';
import { Plus } from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { useSchemaStore } from '@/store/useSchemaStore';
import IndexDialog from './IndexDialog';
import type { Column, Index } from '@/types/schema';

interface IndexSectionProps {
  tableId: string;
  indexes: Index[];
  columns: Column[];
  onHoverIndex?: (columnIds: string[]) => void;
}

export default function IndexSection({ tableId, indexes, columns, onHoverIndex }: IndexSectionProps) {
  const addIndex = useSchemaStore((s) => s.addIndex);
  const removeIndex = useSchemaStore((s) => s.removeIndex);
  const updateIndex = useSchemaStore((s) => s.updateIndex);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<Index | null>(null);

  const handleCreate = (name: string, columnIds: string[], isUnique: boolean) => {
    addIndex(tableId, name, columnIds, isUnique);
    setDialogOpen(false);
  };

  const handleEdit = (name: string, columnIds: string[], isUnique: boolean) => {
    if (!editingIndex) return;
    updateIndex(tableId, editingIndex.id, { name, columnIds, isUnique });
    setEditingIndex(null);
  };

  const colName = (colId: string) =>
    columns.find((c) => c.id === colId)?.name ?? colId;

  return (
    <>
      {/* Dashed separator */}
      <div className="border-t border-dashed border-border" />

      {/* Index rows */}
      <div className="px-1 py-1">
        {indexes.map((idx) => (
          <ContextMenu key={idx.id}>
            <ContextMenuTrigger>
              <div
                className="group flex items-center gap-1.5 rounded px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted/50"
                data-testid={`index-row-${idx.id}`}
                onMouseEnter={() => onHoverIndex?.(idx.columnIds)}
                onMouseLeave={() => onHoverIndex?.([])}
              >
                <span className={idx.isUnique ? 'text-violet-500' : ''} title={idx.isUnique ? 'Unique' : 'Non-unique'}>
                  {idx.isUnique ? '✦' : '·'}
                </span>
                <span className="truncate font-medium">{idx.name}</span>
                <span className="truncate text-muted-foreground/60">
                  ({idx.columnIds.map(colName).join(', ')})
                </span>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onClick={() => setEditingIndex(idx)}>
                Edit
              </ContextMenuItem>
              <ContextMenuItem onClick={() => updateIndex(tableId, idx.id, { isUnique: !idx.isUnique })}>
                {idx.isUnique ? 'Make non-unique' : 'Make unique'}
              </ContextMenuItem>
              <ContextMenuItem
                className="text-destructive"
                onClick={() => removeIndex(tableId, idx.id)}
              >
                Delete
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        ))}

        {/* Add button */}
        <button
          type="button"
          className="flex w-full items-center gap-1 rounded px-2 py-0.5 text-xs text-muted-foreground/60 hover:bg-muted/50 hover:text-muted-foreground"
          onClick={() => setDialogOpen(true)}
          data-testid={`add-index-btn-${tableId}`}
        >
          <Plus className="h-3 w-3" />
          <span>Add index</span>
        </button>
      </div>

      {/* Create dialog */}
      <IndexDialog
        open={dialogOpen}
        columns={columns}
        onConfirm={handleCreate}
        onCancel={() => setDialogOpen(false)}
      />

      {/* Edit dialog */}
      {editingIndex && (
        <IndexDialog
          open={!!editingIndex}
          columns={columns}
          initialName={editingIndex.name}
          initialColumnIds={editingIndex.columnIds}
          initialIsUnique={editingIndex.isUnique}
          onConfirm={handleEdit}
          onCancel={() => setEditingIndex(null)}
        />
      )}
    </>
  );
}
