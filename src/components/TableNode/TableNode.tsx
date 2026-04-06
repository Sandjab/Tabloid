import { memo, useState, useCallback } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { useSchemaStore } from '@/store/useSchemaStore';
import { useInlineEdit } from '@/hooks/useInlineEdit';
import type { TableFlowNode } from '@/types/schema';
import { useTableHighlight } from '@/hooks/useHighlight';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { isMac } from '@/utils/platform';
import { Plus, Copy, Pencil, StickyNote, Trash2, Palette, ListOrdered } from 'lucide-react';
import ColumnRow from './ColumnRow';
import ColorPicker from './ColorPicker';
import NotesPopover from './NotesPopover';
import IndexSection from './IndexSection';
import IndexDialog from './IndexDialog';

const TableNode = memo(function TableNode({ id, data, selected }: NodeProps<TableFlowNode>) {
  const { table } = data;
  const updateTableName = useSchemaStore((s) => s.updateTableName);
  const addColumn = useSchemaStore((s) => s.addColumn);
  const updateTableColor = useSchemaStore((s) => s.updateTableColor);
  const updateTableNotes = useSchemaStore((s) => s.updateTableNotes);
  const removeTable = useSchemaStore((s) => s.removeTable);
  const duplicateTable = useSchemaStore((s) => s.duplicateTable);

  const highlight = useTableHighlight(id);

  const addIndex = useSchemaStore((s) => s.addIndex);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showIndexDialog, setShowIndexDialog] = useState(false);
  const [indexHighlightIds, setIndexHighlightIds] = useState<string[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const moveColumn = useSchemaStore((s) => s.moveColumn);

  const onNameSubmit = useCallback(
    (value: string) => updateTableName(id, value),
    [id, updateTableName],
  );
  const { isEditing, handleSubmit, startEditing, cancelEditing } =
    useInlineEdit(onNameSubmit);

  const { fitBounds, getInternalNode } = useReactFlow();

  const handleHeaderDoubleClick = useCallback(() => {
    const internal = getInternalNode(id);
    if (!internal) return;
    const { position } = internal;
    const width = internal.measured?.width ?? 250;
    const height = internal.measured?.height ?? 100;
    fitBounds(
      { x: position.x, y: position.y, width, height },
      { padding: 1, duration: 400 },
    );
  }, [id, fitBounds, getInternalNode]);

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
      <ContextMenu>
      <ContextMenuTrigger
        className="relative flex items-center justify-between rounded-t-md px-3 py-1.5 text-white"
        style={{ backgroundColor: table.color ?? '#3b82f6' }}
        onDoubleClick={handleHeaderDoubleClick}
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
            onContextMenu={(e) => e.stopPropagation()}
            data-testid={`table-name-input-${id}`}
          />
        ) : (
          <span
            className={`cursor-pointer truncate font-semibold ${
              highlight === 'error'
                ? 'italic text-red-200'
                : highlight === 'warning'
                  ? 'italic text-orange-200'
                  : ''
            }`}
            onDoubleClick={(e) => { e.stopPropagation(); startEditing(); }}
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
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48" data-testid={`table-context-menu-${id}`}>
        <ContextMenuItem onClick={startEditing} data-testid={`ctx-rename-${id}`}>
          <Pencil className="mr-2 size-3.5" />
          Rename table
        </ContextMenuItem>
        <ContextMenuItem onClick={() => addColumn(id)} data-testid={`ctx-add-column-${id}`}>
          <Plus className="mr-2 size-3.5" />
          Add column
        </ContextMenuItem>
        <ContextMenuItem onClick={() => setShowIndexDialog(true)} data-testid={`ctx-add-index-${id}`}>
          <ListOrdered className="mr-2 size-3.5" />
          Add index
        </ContextMenuItem>
        <ContextMenuItem onClick={() => duplicateTable(id)} data-testid={`ctx-duplicate-${id}`}>
          <Copy className="mr-2 size-3.5" />
          Duplicate table
          <ContextMenuShortcut>{isMac ? '⌘D' : 'Ctrl+D'}</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuSub>
          <ContextMenuSubTrigger data-testid={`ctx-color-${id}`}>
            <Palette className="mr-2 size-3.5" />
            Color
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="p-2">
            <ColorPicker
              currentColor={table.color ?? '#3b82f6'}
              onSelect={(color) => updateTableColor(id, color)}
            />
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuItem onClick={() => setShowNotes(true)} data-testid={`ctx-notes-${id}`}>
          <StickyNote className="mr-2 size-3.5" />
          {table.notes ? 'Edit notes' : 'Add note'}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={() => removeTable(id)}
          className="text-destructive focus:text-destructive"
          data-testid={`ctx-delete-${id}`}
        >
          <Trash2 className="mr-2 size-3.5" />
          Delete table
          <ContextMenuShortcut>Del</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
      </ContextMenu>

      {/* Columns with per-column handles */}
      <div
        className="divide-y divide-border"
        onContextMenu={(e) => {
          if ((e.target as HTMLElement).tagName === 'INPUT') {
            e.stopPropagation();
          } else {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
      >
        {table.columns.map((column, index) => (
          <div key={column.id} className="group/row relative">
            <ColumnRow
              tableId={id}
              column={column}
              index={index}
              isDragging={draggedIndex === index}
              isDragOver={dragOverIndex === index}
              dragBelow={draggedIndex !== null && draggedIndex < index}
              isIndexHighlighted={indexHighlightIds.includes(column.id)}
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
            {/* Left: visible handle + hidden twin for edge rendering */}
            <Handle
              type="target"
              position={Position.Left}
              id={`${column.id}-left-target`}
              className="!left-0 !h-[13px] !w-[13px] !border-2 !border-white !bg-blue-500 !opacity-0 transition-opacity hover:!opacity-100"
              data-testid={`handle-left-${column.id}`}
            />
            <Handle
              type="source"
              position={Position.Left}
              id={`${column.id}-left-source`}
              className="!left-0 !h-[13px] !w-[13px] !opacity-0 !pointer-events-none"
            />
            {/* Right: visible handle + hidden twin for edge rendering */}
            <Handle
              type="source"
              position={Position.Right}
              id={`${column.id}-right-source`}
              className="!right-0 !h-[13px] !w-[13px] !border-2 !border-white !bg-blue-500 !opacity-0 transition-opacity hover:!opacity-100"
              data-testid={`handle-right-${column.id}`}
            />
            <Handle
              type="target"
              position={Position.Right}
              id={`${column.id}-right-target`}
              className="!right-0 !h-[13px] !w-[13px] !opacity-0 !pointer-events-none"
            />
          </div>
        ))}
        {table.columns.length === 0 && (
          <div className="px-3 py-2 text-xs text-muted-foreground italic">
            No columns
          </div>
        )}
        {/* Index section — only visible when indexes exist */}
        {table.indexes && table.indexes.length > 0 && (
          <IndexSection
            tableId={id}
            indexes={table.indexes}
            columns={table.columns}
            onHoverIndex={setIndexHighlightIds}
          />
        )}
      </div>

      {/* Index dialog triggered from context menu */}
      <IndexDialog
        open={showIndexDialog}
        columns={table.columns}
        onConfirm={(name, columnIds, isUnique) => {
          addIndex(id, name, columnIds, isUnique);
          setShowIndexDialog(false);
        }}
        onCancel={() => setShowIndexDialog(false)}
      />
    </div>
  );
});

export default TableNode;
