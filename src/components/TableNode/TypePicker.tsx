import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSchemaStore } from '@/store/useSchemaStore';
import { getCatalogForDialect } from '@/dialects';
import type { NativeTypeDefinition, TypeFamily } from '@/dialects/types';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

const FAMILY_LABELS: Record<TypeFamily, string> = {
  integer: 'Integer',
  text: 'Text',
  decimal: 'Decimal',
  boolean: 'Boolean',
  date: 'Date',
  time: 'Time',
  binary: 'Binary',
  json: 'JSON',
  uuid: 'UUID',
  other: 'Other',
};

interface TypePickerProps {
  value: string;
  onChange: (type: string) => void;
  columnId: string;
}

const TypePicker = memo(function TypePicker({ value, onChange, columnId }: TypePickerProps) {
  const dialect = useSchemaStore((s) => s.dialect);
  const catalog = useMemo(() => getCatalogForDialect(dialect), [dialect]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const grouped = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = q
      ? catalog.filter((t) => t.name.toLowerCase().includes(q))
      : catalog;

    const groups = new Map<TypeFamily, NativeTypeDefinition[]>();
    for (const t of filtered) {
      const list = groups.get(t.family);
      if (list) list.push(t);
      else groups.set(t.family, [t]);
    }
    return groups;
  }, [catalog, search]);

  useEffect(() => {
    if (open) {
      // Small delay to ensure popover is rendered
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const handleSelect = useCallback(
    (type: string) => {
      onChange(type);
      setOpen(false);
      setSearch('');
    },
    [onChange],
  );

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setSearch('');
      }}
    >
      <PopoverTrigger
        className="nowheel w-[90px] shrink-0 cursor-pointer truncate rounded border border-input bg-transparent px-1 text-left text-xs text-muted-foreground hover:bg-accent"
        data-testid={`column-type-${columnId}`}
      >
        {value}
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        className="w-52 p-0"
      >
        <div className="border-b border-border p-1.5">
          <input
            ref={inputRef}
            className="nowheel nopan w-full rounded border-none bg-muted px-2 py-1 text-xs outline-none placeholder:text-muted-foreground/50"
            placeholder="Search types..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setOpen(false);
                setSearch('');
              }
            }}
            data-testid={`type-search-${columnId}`}
          />
        </div>
        <div className="max-h-56 overflow-y-auto p-1">
          {grouped.size === 0 && (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">No types found</div>
          )}
          {[...grouped.entries()].map(([family, types]) => (
            <div key={family}>
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                {FAMILY_LABELS[family]}
              </div>
              {types.map((t) => (
                <button
                  key={t.name}
                  className={`flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs hover:bg-accent ${
                    t.name === value ? 'bg-accent font-medium' : ''
                  }`}
                  onClick={() => handleSelect(t.name)}
                  title={t.description}
                  data-testid={`type-option-${t.name}`}
                >
                  <span>{t.name}{t.hasLength ? '(n)' : ''}{t.hasPrecision ? '(p,s)' : ''}</span>
                  {t.name === value && <span className="text-primary">✓</span>}
                </button>
              ))}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
});

export default TypePicker;
