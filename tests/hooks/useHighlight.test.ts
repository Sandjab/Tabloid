import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSchemaStore } from '@/store/useSchemaStore';
import { useTableHighlight, useColumnHighlight } from '@/hooks/useHighlight';

beforeEach(() => {
  useSchemaStore.setState({ tables: [], relations: [], nodes: [], edges: [] });
});

describe('useTableHighlight', () => {
  it('returns null when only info-severity issues apply (orphan tables on empty canvas)', () => {
    useSchemaStore.getState().addTable({ x: 0, y: 0 });
    const id2 = useSchemaStore.getState().addTable({ x: 200, y: 0 });

    const { result } = renderHook(() => useTableHighlight(id2));
    expect(result.current).toBeNull();
  });

  it("returns 'warning' for warning-severity issues (empty table)", () => {
    const id = useSchemaStore.getState().addTable({ x: 0, y: 0 });
    useSchemaStore.setState((s) => ({
      tables: s.tables.map((t) => (t.id === id ? { ...t, columns: [] } : t)),
    }));

    const { result } = renderHook(() => useTableHighlight(id));
    expect(result.current).toBe('warning');
  });

  it("returns 'error' for error-severity issues (duplicate table names)", () => {
    const id1 = useSchemaStore.getState().addTable({ x: 0, y: 0 });
    const id2 = useSchemaStore.getState().addTable({ x: 200, y: 0 });
    const name1 = useSchemaStore.getState().tables.find((t) => t.id === id1)!.name;
    useSchemaStore.getState().updateTableName(id2, name1);

    const { result } = renderHook(() => useTableHighlight(id2));
    expect(result.current).toBe('error');
  });
});

describe('useColumnHighlight', () => {
  it("returns 'warning' for reserved-word column", () => {
    const id = useSchemaStore.getState().addTable({ x: 0, y: 0 });
    const colId = useSchemaStore.getState().tables[0].columns[0].id;
    useSchemaStore.setState((s) => ({
      tables: s.tables.map((t) =>
        t.id === id
          ? { ...t, columns: t.columns.map((c) => (c.id === colId ? { ...c, name: 'order' } : c)) }
          : t,
      ),
    }));

    const { result } = renderHook(() => useColumnHighlight(id, colId));
    expect(result.current).toBe('warning');
  });
});
