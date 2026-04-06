import { describe, it, expect, beforeEach } from 'vitest';
import { useSchemaStore } from '@/store/useSchemaStore';

beforeEach(() => {
  useSchemaStore.setState({
    tables: [],
    relations: [],
    nodes: [],
    edges: [],
  });
});

function createTableWithColumns() {
  const tableId = useSchemaStore.getState().addTable({ x: 0, y: 0 });
  useSchemaStore.getState().addColumn(tableId);
  const table = useSchemaStore.getState().tables[0];
  return { tableId, col1: table.columns[0].id, col2: table.columns[1].id };
}

describe('addIndex', () => {
  it('creates an index on a table', () => {
    const { tableId, col1 } = createTableWithColumns();
    useSchemaStore.getState().addIndex(tableId, 'idx_id', [col1], false);

    const table = useSchemaStore.getState().tables[0];
    expect(table.indexes).toHaveLength(1);
    expect(table.indexes![0].name).toBe('idx_id');
    expect(table.indexes![0].columnIds).toEqual([col1]);
    expect(table.indexes![0].isUnique).toBe(false);
  });

  it('creates a unique composite index', () => {
    const { tableId, col1, col2 } = createTableWithColumns();
    useSchemaStore.getState().addIndex(tableId, 'idx_composite', [col1, col2], true);

    const table = useSchemaStore.getState().tables[0];
    expect(table.indexes).toHaveLength(1);
    expect(table.indexes![0].columnIds).toEqual([col1, col2]);
    expect(table.indexes![0].isUnique).toBe(true);
  });
});

describe('removeIndex', () => {
  it('removes an index from a table', () => {
    const { tableId, col1 } = createTableWithColumns();
    useSchemaStore.getState().addIndex(tableId, 'idx_test', [col1], false);
    const indexId = useSchemaStore.getState().tables[0].indexes![0].id;

    useSchemaStore.getState().removeIndex(tableId, indexId);

    const table = useSchemaStore.getState().tables[0];
    expect(table.indexes ?? []).toHaveLength(0);
  });
});

describe('updateIndex', () => {
  it('updates index name', () => {
    const { tableId, col1 } = createTableWithColumns();
    useSchemaStore.getState().addIndex(tableId, 'idx_old', [col1], false);
    const indexId = useSchemaStore.getState().tables[0].indexes![0].id;

    useSchemaStore.getState().updateIndex(tableId, indexId, { name: 'idx_new' });

    expect(useSchemaStore.getState().tables[0].indexes![0].name).toBe('idx_new');
  });

  it('updates index columns and uniqueness', () => {
    const { tableId, col1, col2 } = createTableWithColumns();
    useSchemaStore.getState().addIndex(tableId, 'idx_test', [col1], false);
    const indexId = useSchemaStore.getState().tables[0].indexes![0].id;

    useSchemaStore.getState().updateIndex(tableId, indexId, {
      columnIds: [col1, col2],
      isUnique: true,
    });

    const idx = useSchemaStore.getState().tables[0].indexes![0];
    expect(idx.columnIds).toEqual([col1, col2]);
    expect(idx.isUnique).toBe(true);
  });
});
