import { memo, useCallback, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useSchemaStore } from '@/store/useSchemaStore';
import { useInlineEdit } from '@/hooks/useInlineEdit';
import type { Column } from '@/types/schema';
import { getCatalogForDialect } from '@/dialects';
import { GripVertical, KeyRound, MessageSquare } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { useColumnHighlight } from '@/hooks/useHighlight';
import TypePicker from './TypePicker';

interface ColumnRowProps {
  tableId: string;
  column: Column;
  index: number;
  isDragging: boolean;
  isDragOver: boolean;
  dragBelow: boolean;
  isIndexHighlighted?: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOverIndex: (index: number) => void;
}

const ColumnRow = memo(function ColumnRow({
  tableId,
  column,
  index,
  isDragging,
  isDragOver,
  dragBelow,
  isIndexHighlighted,
  onDragStart,
  onDragEnd,
  onDragOverIndex,
}: ColumnRowProps) {
  const {
    updateColumnName,
    updateColumnType,
    updateColumnLength,
    updateColumnPrecision,
    updateColumnDescription,
    toggleColumnPrimaryKey,
    toggleColumnNullable,
    toggleColumnUnique,
    removeColumn,
  } = useSchemaStore(
    useShallow((s) => ({
      updateColumnName: s.updateColumnName,
      updateColumnType: s.updateColumnType,
      updateColumnLength: s.updateColumnLength,
      updateColumnPrecision: s.updateColumnPrecision,
      updateColumnDescription: s.updateColumnDescription,
      toggleColumnPrimaryKey: s.toggleColumnPrimaryKey,
      toggleColumnNullable: s.toggleColumnNullable,
      toggleColumnUnique: s.toggleColumnUnique,
      removeColumn: s.removeColumn,
    })),
  );

  const dialect = useSchemaStore((s) => s.dialect);
  const catalog = useMemo(() => getCatalogForDialect(dialect), [dialect]);
  const typeDef = useMemo(
    () => catalog.find((t) => t.name === column.type),
    [catalog, column.type],
  );

  const [descOpen, setDescOpen] = useState(false);

  const highlight = useColumnHighlight(tableId, column.id);

  const onNameSubmit = useCallback(
    (value: string) => updateColumnName(tableId, column.id, value),
    [tableId, column.id, updateColumnName],
  );
  const { isEditing, handleSubmit, startEditing, cancelEditing } =
    useInlineEdit(onNameSubmit);

  return (
    <div
      className={`nodrag flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors duration-150 ${
        isDragging ? 'opacity-30' : ''
      } ${isDragOver && !isDragging ? (dragBelow ? 'border-b-2 border-primary' : 'border-t-2 border-primary') : ''} ${
        isIndexHighlighted
          ? 'bg-violet-500/10'
          : highlight === 'error'
            ? 'bg-red-500/10'
            : highlight === 'warning'
              ? 'bg-orange-500/10'
              : ''
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        onDragOverIndex(index);
      }}
      onDrop={(e) => e.preventDefault()}
      data-testid={`column-row-${column.id}`}
    >
      <div
        className="shrink-0 cursor-grab text-muted-foreground/40 transition-opacity hover:text-foreground group-hover/row:text-muted-foreground"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move';
          onDragStart();
        }}
        onDragEnd={onDragEnd}
        data-testid={`column-drag-handle-${column.id}`}
      >
        <GripVertical className="size-3.5" />
      </div>

      <button
        className={`w-4 shrink-0 flex items-center justify-center transition-colors duration-150 ${
          column.isPrimaryKey ? 'text-amber-500' : 'text-border'
        }`}
        onClick={() => toggleColumnPrimaryKey(tableId, column.id)}
        title="Toggle Primary Key"
        data-testid={`column-pk-${column.id}`}
      >
        {column.isPrimaryKey ? <KeyRound className="size-3" /> : <span className="text-xs">·</span>}
      </button>

      {isEditing ? (
        <input
          className="nowheel min-w-[120px] flex-1 rounded border border-input px-1 text-sm"
          defaultValue={column.name}
          maxLength={64}
          autoFocus
          onBlur={(e) => handleSubmit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit(e.currentTarget.value);
            if (e.key === 'Escape') cancelEditing();
          }}
          data-testid={`column-name-input-${column.id}`}
        />
      ) : (
        <Tooltip>
          <TooltipTrigger
            className={`min-w-[120px] max-w-[180px] flex-1 truncate text-left cursor-pointer ${
              highlight === 'error'
                ? 'italic text-red-700 dark:text-red-400'
                : highlight === 'warning'
                  ? 'italic text-orange-500'
                  : 'text-foreground'
            }`}
            render={<span />}
            onDoubleClick={startEditing}
            data-testid={`column-name-${column.id}`}
          >
            {column.name}
          </TooltipTrigger>
          <TooltipContent side="top" className="flex flex-col gap-1 max-w-none">
            <span className="font-medium whitespace-nowrap">{column.name}</span>
            <span className="flex items-center gap-1.5">
              <span className="text-background/70">{column.type}{column.length != null ? `(${column.length})` : ''}{column.precision != null ? `(${column.precision}${column.scale != null ? `,${column.scale}` : ''})` : ''}</span>
              {column.isPrimaryKey && <span className="rounded bg-amber-500/20 px-1 text-amber-400 dark:text-amber-700">PK</span>}
              {!column.isNullable && <span className="rounded bg-rose-500/20 px-1 text-rose-400 dark:text-rose-700">NN</span>}
              {column.isUnique && <span className="rounded bg-violet-500/20 px-1 text-violet-400 dark:text-violet-700">UQ</span>}
              {column.defaultValue && (
                <>
                  <span className="text-background/40">·</span>
                  <span className="text-background/70">= {column.defaultValue}</span>
                </>
              )}
            </span>
            {column.description && (
              <span className="text-background/60 italic">{column.description}</span>
            )}
          </TooltipContent>
        </Tooltip>
      )}

      <Popover open={descOpen} onOpenChange={setDescOpen}>
        <PopoverTrigger
          className={`shrink-0 transition-opacity ${
            column.description
              ? 'text-sky-500'
              : 'text-muted-foreground/40 opacity-0 group-hover/row:opacity-100'
          }`}
          title="Column description"
          data-testid={`column-desc-${column.id}`}
        >
          <MessageSquare className="size-3" />
        </PopoverTrigger>
        <PopoverContent side="top" className="w-64 p-2">
          <textarea
            className="nowheel nopan w-full resize-none rounded border border-input bg-transparent px-2 py-1 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
            rows={3}
            placeholder="Column description..."
            defaultValue={column.description ?? ''}
            autoFocus
            onBlur={(e) => {
              const val = e.target.value.trim();
              updateColumnDescription(tableId, column.id, val || undefined);
              setDescOpen(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setDescOpen(false);
            }}
            data-testid={`column-desc-input-${column.id}`}
          />
        </PopoverContent>
      </Popover>

      <TypePicker
        value={column.type}
        onChange={(type) => {
          updateColumnType(tableId, column.id, type);
          // Clear params when switching types
          const newDef = catalog.find((t) => t.name === type);
          if (!newDef?.hasLength && column.length != null) {
            updateColumnLength(tableId, column.id, undefined);
          }
          if (!newDef?.hasPrecision && column.precision != null) {
            updateColumnPrecision(tableId, column.id, undefined, undefined);
          }
        }}
        columnId={column.id}
      />
      {typeDef?.hasLength && (
        <input
          className="nowheel w-10 shrink-0 rounded border border-input bg-transparent px-1 text-center text-xs text-muted-foreground"
          type="number"
          min={1}
          placeholder="n"
          value={column.length ?? ''}
          onChange={(e) => {
            const v = e.target.value ? parseInt(e.target.value, 10) : undefined;
            updateColumnLength(tableId, column.id, v && v > 0 ? v : undefined);
          }}
          title="Length"
          data-testid={`column-length-${column.id}`}
        />
      )}
      {typeDef?.hasPrecision && (
        <>
          <input
            className="nowheel w-10 shrink-0 rounded border border-input bg-transparent px-1 text-center text-xs text-muted-foreground"
            type="number"
            min={1}
            placeholder="p"
            value={column.precision ?? ''}
            onChange={(e) => {
              const v = e.target.value ? parseInt(e.target.value, 10) : undefined;
              updateColumnPrecision(tableId, column.id, v && v > 0 ? v : undefined, column.scale);
            }}
            title="Precision"
            data-testid={`column-precision-${column.id}`}
          />
          <input
            className="nowheel w-10 shrink-0 rounded border border-input bg-transparent px-1 text-center text-xs text-muted-foreground"
            type="number"
            min={0}
            placeholder="s"
            value={column.scale ?? ''}
            onChange={(e) => {
              const v = e.target.value ? parseInt(e.target.value, 10) : undefined;
              updateColumnPrecision(tableId, column.id, column.precision, v != null && v >= 0 ? v : undefined);
            }}
            title="Scale"
            data-testid={`column-scale-${column.id}`}
          />
        </>
      )}

      <button
        className={`shrink-0 text-xs transition-colors duration-150 ${
          !column.isNullable
            ? 'font-semibold text-rose-500'
            : 'text-muted-foreground/60'
        }`}
        onClick={() => toggleColumnNullable(tableId, column.id)}
        title="Toggle NOT NULL"
        data-testid={`column-nn-${column.id}`}
      >
        NN
      </button>

      <button
        className={`shrink-0 text-xs transition-colors duration-150 ${
          column.isUnique
            ? 'font-semibold text-violet-500'
            : 'text-muted-foreground/60'
        }`}
        onClick={() => toggleColumnUnique(tableId, column.id)}
        title="Toggle UNIQUE"
        data-testid={`column-uq-${column.id}`}
      >
        UQ
      </button>

      <button
        className="ml-auto shrink-0 text-muted-foreground hover:text-destructive"
        onClick={() => removeColumn(tableId, column.id)}
        title="Remove column"
        data-testid={`column-remove-${column.id}`}
      >
        ×
      </button>
    </div>
  );
});

export default ColumnRow;
