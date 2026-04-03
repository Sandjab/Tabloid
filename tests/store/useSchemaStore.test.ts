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

describe('addTable', () => {
  it('creates a table with a default PK column', () => {
    const id = useSchemaStore.getState().addTable({ x: 100, y: 200 });
    const { tables, nodes } = useSchemaStore.getState();

    expect(tables).toHaveLength(1);
    expect(tables[0].id).toBe(id);
    expect(tables[0].name).toBe('table_1');
    expect(tables[0].position).toEqual({ x: 100, y: 200 });
    expect(tables[0].columns).toHaveLength(1);
    expect(tables[0].columns[0].name).toBe('id');
    expect(tables[0].columns[0].type).toBe('SERIAL');
    expect(tables[0].columns[0].isPrimaryKey).toBe(true);
    expect(tables[0].columns[0].isNullable).toBe(false);

    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe(id);
    expect(nodes[0].type).toBe('table');
    expect(nodes[0].data.table).toEqual(tables[0]);
  });

  it('creates multiple tables with unique IDs', () => {
    const id1 = useSchemaStore.getState().addTable({ x: 0, y: 0 });
    const id2 = useSchemaStore.getState().addTable({ x: 100, y: 100 });
    expect(id1).not.toBe(id2);
    expect(useSchemaStore.getState().tables).toHaveLength(2);
  });
});

describe('removeTable', () => {
  it('removes table and its node', () => {
    const id = useSchemaStore.getState().addTable({ x: 0, y: 0 });
    useSchemaStore.getState().removeTable(id);
    expect(useSchemaStore.getState().tables).toHaveLength(0);
    expect(useSchemaStore.getState().nodes).toHaveLength(0);
  });

  it('does not affect other tables', () => {
    const id1 = useSchemaStore.getState().addTable({ x: 0, y: 0 });
    useSchemaStore.getState().addTable({ x: 100, y: 100 });
    useSchemaStore.getState().removeTable(id1);
    expect(useSchemaStore.getState().tables).toHaveLength(1);
    expect(useSchemaStore.getState().nodes).toHaveLength(1);
  });
});

describe('updateTableName', () => {
  it('updates the table name in both tables and nodes', () => {
    const id = useSchemaStore.getState().addTable({ x: 0, y: 0 });
    useSchemaStore.getState().updateTableName(id, 'users');
    const { tables, nodes } = useSchemaStore.getState();
    expect(tables[0].name).toBe('users');
    expect(nodes[0].data.table.name).toBe('users');
  });
});

describe('addColumn', () => {
  it('adds a column with default values', () => {
    const id = useSchemaStore.getState().addTable({ x: 0, y: 0 });
    useSchemaStore.getState().addColumn(id);
    const { tables, nodes } = useSchemaStore.getState();
    expect(tables[0].columns).toHaveLength(2);

    const newCol = tables[0].columns[1];
    expect(newCol.name).toBe('column_1');
    expect(newCol.type).toBe('TEXT');
    expect(newCol.isPrimaryKey).toBe(false);
    expect(newCol.isNullable).toBe(true);
    expect(newCol.isUnique).toBe(false);

    expect(nodes[0].data.table.columns).toHaveLength(2);
  });
});

describe('removeColumn', () => {
  it('removes the specified column', () => {
    const id = useSchemaStore.getState().addTable({ x: 0, y: 0 });
    const colId = useSchemaStore.getState().tables[0].columns[0].id;
    useSchemaStore.getState().removeColumn(id, colId);
    expect(useSchemaStore.getState().tables[0].columns).toHaveLength(0);
    expect(useSchemaStore.getState().nodes[0].data.table.columns).toHaveLength(0);
  });
});

describe('updateColumnName', () => {
  it('changes the column name', () => {
    const id = useSchemaStore.getState().addTable({ x: 0, y: 0 });
    const colId = useSchemaStore.getState().tables[0].columns[0].id;
    useSchemaStore.getState().updateColumnName(id, colId, 'user_id');
    expect(useSchemaStore.getState().tables[0].columns[0].name).toBe('user_id');
    expect(useSchemaStore.getState().nodes[0].data.table.columns[0].name).toBe('user_id');
  });
});

describe('updateColumnType', () => {
  it('changes the column type', () => {
    const id = useSchemaStore.getState().addTable({ x: 0, y: 0 });
    const colId = useSchemaStore.getState().tables[0].columns[0].id;
    useSchemaStore.getState().updateColumnType(id, colId, 'UUID');
    expect(useSchemaStore.getState().tables[0].columns[0].type).toBe('UUID');
  });
});

describe('toggleColumnPrimaryKey', () => {
  it('toggles primary key on and off', () => {
    const id = useSchemaStore.getState().addTable({ x: 0, y: 0 });
    const colId = useSchemaStore.getState().tables[0].columns[0].id;
    expect(useSchemaStore.getState().tables[0].columns[0].isPrimaryKey).toBe(true);

    useSchemaStore.getState().toggleColumnPrimaryKey(id, colId);
    expect(useSchemaStore.getState().tables[0].columns[0].isPrimaryKey).toBe(false);

    useSchemaStore.getState().toggleColumnPrimaryKey(id, colId);
    expect(useSchemaStore.getState().tables[0].columns[0].isPrimaryKey).toBe(true);
  });
});

describe('toggleColumnNullable', () => {
  it('toggles nullable', () => {
    const id = useSchemaStore.getState().addTable({ x: 0, y: 0 });
    const colId = useSchemaStore.getState().tables[0].columns[0].id;
    expect(useSchemaStore.getState().tables[0].columns[0].isNullable).toBe(false);

    useSchemaStore.getState().toggleColumnNullable(id, colId);
    expect(useSchemaStore.getState().tables[0].columns[0].isNullable).toBe(true);

    useSchemaStore.getState().toggleColumnNullable(id, colId);
    expect(useSchemaStore.getState().tables[0].columns[0].isNullable).toBe(false);
  });
});

describe('toggleColumnUnique', () => {
  it('toggles unique', () => {
    const id = useSchemaStore.getState().addTable({ x: 0, y: 0 });
    const colId = useSchemaStore.getState().tables[0].columns[0].id;
    expect(useSchemaStore.getState().tables[0].columns[0].isUnique).toBe(false);

    useSchemaStore.getState().toggleColumnUnique(id, colId);
    expect(useSchemaStore.getState().tables[0].columns[0].isUnique).toBe(true);
  });
});

describe('updateColumnDefault', () => {
  it('sets and clears default value', () => {
    const id = useSchemaStore.getState().addTable({ x: 0, y: 0 });
    const colId = useSchemaStore.getState().tables[0].columns[0].id;

    useSchemaStore.getState().updateColumnDefault(id, colId, 'NOW()');
    expect(useSchemaStore.getState().tables[0].columns[0].defaultValue).toBe('NOW()');

    useSchemaStore.getState().updateColumnDefault(id, colId, undefined);
    expect(useSchemaStore.getState().tables[0].columns[0].defaultValue).toBeUndefined();
  });
});

describe('moveColumn', () => {
  it('moves a column from one index to another', () => {
    const id = useSchemaStore.getState().addTable({ x: 0, y: 0 });
    // Table starts with 'id' column at index 0
    useSchemaStore.getState().addColumn(id); // column_1 at index 1
    useSchemaStore.getState().addColumn(id); // column_2 at index 2
    // Order: [id, column_1, column_2]

    useSchemaStore.getState().moveColumn(id, 0, 2);
    const cols = useSchemaStore.getState().tables[0].columns;
    expect(cols[0].name).toBe('column_1');
    expect(cols[1].name).toBe('column_2');
    expect(cols[2].name).toBe('id');

    // Verify nodes are also updated
    const nodeCols = useSchemaStore.getState().nodes[0].data.table.columns;
    expect(nodeCols[0].name).toBe('column_1');
    expect(nodeCols[2].name).toBe('id');
  });

  it('does nothing when fromIndex equals toIndex', () => {
    const id = useSchemaStore.getState().addTable({ x: 0, y: 0 });
    useSchemaStore.getState().addColumn(id);
    const before = useSchemaStore.getState().tables[0].columns.map((c) => c.id);

    useSchemaStore.getState().moveColumn(id, 0, 0);
    const after = useSchemaStore.getState().tables[0].columns.map((c) => c.id);
    expect(after).toEqual(before);
  });

  it('moves last column to first position', () => {
    const id = useSchemaStore.getState().addTable({ x: 0, y: 0 });
    useSchemaStore.getState().addColumn(id);
    useSchemaStore.getState().addColumn(id);
    // Order: [id, column_1, column_2]

    useSchemaStore.getState().moveColumn(id, 2, 0);
    const cols = useSchemaStore.getState().tables[0].columns;
    expect(cols[0].name).toBe('column_2');
    expect(cols[1].name).toBe('id');
    expect(cols[2].name).toBe('column_1');
  });
});
