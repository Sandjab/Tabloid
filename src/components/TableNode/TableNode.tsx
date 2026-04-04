import { memo, useState, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { useSchemaStore } from '@/store/useSchemaStore';
import { useInlineEdit } from '@/hooks/useInlineEdit';
import { makeHandleId } from '@/utils/id';
import type { TableFlowNode } from '@/types/schema';
import { useTableHighlight } from '@/hooks/useHighlight';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import ColumnRow from './ColumnRow';
import ColorPicker from './ColorPicker';
import NotesPopover from './NotesPopover';

const TableNode = memo(function TableNode({ id, data, selected }: NodeProps<TableFlowNode>) {
  const { table } = data;
  const updateTableName = useSchemaStore((s) => s.updateTableName);
  const addColumn = useSchemaStore((s) => s.addColumn);
  const updateTableColor = useSchemaStore((s) => s.updateTableColor);
  const updateTableNotes = useSchemaStore((s) => s.updateTableNotes);

  const highlight = useTableHighlight(id);

  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const moveColumn = useSchemaStore((s) => s.moveColumn);

  const onNameSubmit = useCallback(
    (value: string) => updateTableName(id, value),
    [id, updateTableName],
  );
  const { isEditing, handleSubmit, startEditing, cancelEditing } =
    useInlineEdit(onNameSubmit);

  return (
    <div
      className={`min-w-[250px] rounded-md border bg-popover shadow-sm transition-shadow duration-200 hover:shadow-md ${
        highlight === 'error'
          ? 'border-red-500 ring-2 ring-red-500/30'
          : highlight === 'warning'
            ? 'border-orange-500 ring-2 ring-orange-500/30'
            : selected
              ? 'border-primary ring-2 ring-primary/30'
              : 'border-border'
      }`}
      data-testid={`table-node-${id}`}
    >
      {/* Header */}
      <div
        className="relative flex items-center justify-between rounded-t-md px-3 py-1.5 text-white"
        style={{ backgroundColor: table.color ?? '#3b82f6' }}
      >
        {isEditing ? (
          <input
            className="nodrag nowheel w-full rounded bg-white/20 px-1 text-white placeholder-white/60 outline-none"
            defaultValue={table.name}
            autoFocus
            onBlur={(e) => handleSubmit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit(e.currentTarget.value);
              if (e.key === 'Escape') cancelEditing();
            }}
            data-testid={`table-name-input-${id}`}
          />
        ) : (
          <span
            className="cursor-pointer truncate font-semibold"
            onDoubleClick={startEditing}
            data-testid={`table-name-${id}`}
          >
            {table.name}
          </span>
        )}
        <div className="nodrag flex shrink-0 items-center gap-0.5">
          <Popover open={showColorPicker} onOpenChange={setShowColorPicker}>
            <PopoverTrigger
              className="rounded px-1 text-xs hover:bg-white/20"
              data-testid={`color-btn-${id}`}
            >
              ●
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-2">
              <ColorPicker
                currentColor={table.color ?? '#3b82f6'}
                onSelect={(color) => {
                  updateTableColor(id, color);
                  setShowColorPicker(false);
                }}
              />
            </PopoverContent>
          </Popover>
          <Popover open={showNotes} onOpenChange={setShowNotes}>
            <PopoverTrigger
              className={`rounded px-1 text-xs hover:bg-white/20 ${table.notes ? 'opacity-100' : 'opacity-60'}`}
              data-testid={`notes-btn-${id}`}
            >
              ✎
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56">
              <NotesPopover
                notes={table.notes ?? ''}
                onChange={(notes) => updateTableNotes(id, notes || undefined)}
                onClose={() => setShowNotes(false)}
              />
            </PopoverContent>
          </Popover>
          <button
            className="rounded px-1 hover:bg-white/20"
            onClick={() => addColumn(id)}
            title="Add column"
            data-testid={`add-column-btn-${id}`}
          >
            +
          </button>
        </div>
      </div>

      {/* Columns with per-column handles */}
      <div className="divide-y divide-border">
        {table.columns.map((column, index) => (
          <div key={column.id} className="group/row relative">
            <ColumnRow
              tableId={id}
              column={column}
              index={index}
              isDragging={draggedIndex === index}
              isDragOver={dragOverIndex === index}
              dragBelow={draggedIndex !== null && draggedIndex < index}
              onDragStart={() => setDraggedIndex(index)}
              onDragEnd={() => {
                if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
                  moveColumn(id, draggedIndex, dragOverIndex);
                }
                setDraggedIndex(null);
                setDragOverIndex(null);
              }}
              onDragOverIndex={setDragOverIndex}
            />
            <Handle
              type="target"
              position={Position.Left}
              id={makeHandleId(column.id, 'target')}
              className="!left-0 !h-2.5 !w-2.5 !border-2 !border-white !bg-blue-500 !opacity-0 transition-opacity hover:!opacity-100"
              data-testid={`handle-target-${column.id}`}
            />
            <Handle
              type="source"
              position={Position.Right}
              id={makeHandleId(column.id, 'source')}
              className="!right-0 !h-2.5 !w-2.5 !border-2 !border-white !bg-blue-500 !opacity-0 transition-opacity hover:!opacity-100"
              data-testid={`handle-source-${column.id}`}
            />
          </div>
        ))}
        {table.columns.length === 0 && (
          <div className="px-3 py-2 text-xs text-muted-foreground italic">
            No columns
          </div>
        )}
      </div>
    </div>
  );
});

export default TableNode;
