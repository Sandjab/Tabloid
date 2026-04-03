import { memo, useState, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { useSchemaStore } from '@/store/useSchemaStore';
import { useInlineEdit } from '@/hooks/useInlineEdit';
import { makeHandleId } from '@/utils/id';
import type { TableFlowNode } from '@/types/schema';
import ColumnRow from './ColumnRow';
import ColorPicker from './ColorPicker';
import NotesPopover from './NotesPopover';

const TableNode = memo(function TableNode({ id, data }: NodeProps<TableFlowNode>) {
  const { table } = data;
  const updateTableName = useSchemaStore((s) => s.updateTableName);
  const addColumn = useSchemaStore((s) => s.addColumn);
  const updateTableColor = useSchemaStore((s) => s.updateTableColor);
  const updateTableNotes = useSchemaStore((s) => s.updateTableNotes);

  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  const onNameSubmit = useCallback(
    (value: string) => updateTableName(id, value),
    [id, updateTableName],
  );
  const { isEditing, handleSubmit, startEditing, cancelEditing } =
    useInlineEdit(onNameSubmit);

  return (
    <div
      className="min-w-[250px] rounded-lg border border-gray-200 bg-white shadow-md dark:border-gray-700 dark:bg-gray-800"
      data-testid={`table-node-${id}`}
    >
      {/* Header */}
      <div
        className="relative flex items-center justify-between rounded-t-lg px-3 py-2 text-white"
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
          <button
            className="rounded px-1 text-xs hover:bg-white/20"
            onClick={() => setShowColorPicker(!showColorPicker)}
            title="Table color"
            data-testid={`color-btn-${id}`}
          >
            ●
          </button>
          <button
            className={`rounded px-1 text-xs hover:bg-white/20 ${table.notes ? 'opacity-100' : 'opacity-60'}`}
            onClick={() => setShowNotes(!showNotes)}
            title="Notes"
            data-testid={`notes-btn-${id}`}
          >
            ✎
          </button>
          <button
            className="rounded px-1 hover:bg-white/20"
            onClick={() => addColumn(id)}
            title="Add column"
            data-testid={`add-column-btn-${id}`}
          >
            +
          </button>
        </div>
        {showColorPicker && (
          <ColorPicker
            currentColor={table.color ?? '#3b82f6'}
            onSelect={(color) => updateTableColor(id, color)}
            onClose={() => setShowColorPicker(false)}
          />
        )}
        {showNotes && (
          <NotesPopover
            notes={table.notes ?? ''}
            onChange={(notes) => updateTableNotes(id, notes || undefined)}
            onClose={() => setShowNotes(false)}
          />
        )}
      </div>

      {/* Columns with per-column handles */}
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {table.columns.map((column) => (
          <div key={column.id} className="relative">
            <ColumnRow tableId={id} column={column} />
            <Handle
              type="target"
              position={Position.Left}
              id={makeHandleId(column.id, 'target')}
              className="!left-0 !h-2.5 !w-2.5 !-translate-x-1/2 !border-2 !border-white !bg-blue-500 opacity-30 hover:opacity-100"
              data-testid={`handle-target-${column.id}`}
            />
            <Handle
              type="source"
              position={Position.Right}
              id={makeHandleId(column.id, 'source')}
              className="!right-0 !h-2.5 !w-2.5 !translate-x-1/2 !border-2 !border-white !bg-blue-500 opacity-30 hover:opacity-100"
              data-testid={`handle-source-${column.id}`}
            />
          </div>
        ))}
        {table.columns.length === 0 && (
          <div className="px-3 py-2 text-xs text-gray-400 italic">
            No columns
          </div>
        )}
      </div>
    </div>
  );
});

export default TableNode;
