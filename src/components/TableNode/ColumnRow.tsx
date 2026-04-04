import { memo, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useSchemaStore } from '@/store/useSchemaStore';
import { useInlineEdit } from '@/hooks/useInlineEdit';
import { COLUMN_TYPES } from '@/types/schema';
import type { Column, ColumnType } from '@/types/schema';
import { GripVertical, KeyRound } from 'lucide-react';
import { useColumnHighlight } from '@/hooks/useHighlight';

interface ColumnRowProps {
  tableId: string;
  column: Column;
  index: number;
  isDragging: boolean;
  isDragOver: boolean;
  dragBelow: boolean;
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
  onDragStart,
  onDragEnd,
  onDragOverIndex,
}: ColumnRowProps) {
  const {
    updateColumnName,
    updateColumnType,
    toggleColumnPrimaryKey,
    toggleColumnNullable,
    toggleColumnUnique,
    removeColumn,
  } = useSchemaStore(
    useShallow((s) => ({
      updateColumnName: s.updateColumnName,
      updateColumnType: s.updateColumnType,
      toggleColumnPrimaryKey: s.toggleColumnPrimaryKey,
      toggleColumnNullable: s.toggleColumnNullable,
      toggleColumnUnique: s.toggleColumnUnique,
      removeColumn: s.removeColumn,
    })),
  );

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
        highlight === 'error'
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
        className="shrink-0 cursor-grab text-muted-foreground hover:text-foreground"
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
          className="nowheel w-[120px] rounded border border-input px-1 text-sm"
          defaultValue={column.name}
          autoFocus
          onBlur={(e) => handleSubmit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit(e.currentTarget.value);
            if (e.key === 'Escape') cancelEditing();
          }}
          data-testid={`column-name-input-${column.id}`}
        />
      ) : (
        <span
          className={`w-[120px] cursor-pointer truncate ${
            highlight === 'error'
              ? 'text-red-700 dark:text-red-400'
              : highlight === 'warning'
                ? 'text-orange-500'
                : 'text-foreground'
          }`}
          onDoubleClick={startEditing}
          title={column.name}
          data-testid={`column-name-${column.id}`}
        >
          {column.name}
        </span>
      )}

      <select
        className="nowheel rounded border border-input bg-transparent px-0.5 text-xs text-muted-foreground"
        value={column.type}
        onChange={(e) =>
          updateColumnType(tableId, column.id, e.target.value as ColumnType)
        }
        data-testid={`column-type-${column.id}`}
      >
        {COLUMN_TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>

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
