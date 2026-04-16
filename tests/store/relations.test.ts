import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSchemaStore } from '@/store/useSchemaStore';

beforeEach(() => {
  useSchemaStore.setState({
    tables: [],
    relations: [],
    nodes: [],
    edges: [],
  });
});

function createTwoTables() {
  const id1 = useSchemaStore.getState().addTable({ x: 0, y: 0 });
  const id2 = useSchemaStore.getState().addTable({ x: 300, y: 0 });
  const col1 = useSchemaStore.getState().tables[0].columns[0].id;
  const col2 = useSchemaStore.getState().tables[1].columns[0].id;
  return { id1, id2, col1, col2 };
}

describe('addRelation', () => {
  it('creates a relation and an edge', () => {
    const { id1, id2, col1, col2 } = createTwoTables();
    const relId = useSchemaStore.getState().addRelation(id1, col1, id2, col2, 'one-to-many');

    const { relations, edges } = useSchemaStore.getState();
    expect(relations).toHaveLength(1);
    expect(relations[0].id).toBe(relId);
    expect(relations[0].sourceTableId).toBe(id1);
    expect(relations[0].sourceColumnId).toBe(col1);
    expect(relations[0].targetTableId).toBe(id2);
    expect(relations[0].targetColumnId).toBe(col2);
    expect(relations[0].type).toBe('one-to-many');

    expect(edges).toHaveLength(1);
    expect(edges[0].id).toBe(relId);
    expect(edges[0].source).toBe(id1);
    expect(edges[0].target).toBe(id2);
  });
});

describe('removeRelation', () => {
  it('removes a relation and its edge', () => {
    const { id1, id2, col1, col2 } = createTwoTables();
    const relId = useSchemaStore.getState().addRelation(id1, col1, id2, col2, 'one-to-many');
    useSchemaStore.getState().removeRelation(relId);

    expect(useSchemaStore.getState().relations).toHaveLength(0);
    expect(useSchemaStore.getState().edges).toHaveLength(0);
  });
});

describe('updateRelationType', () => {
  it('changes the relation type', () => {
    const { id1, id2, col1, col2 } = createTwoTables();
    const relId = useSchemaStore.getState().addRelation(id1, col1, id2, col2, 'one-to-many');
    useSchemaStore.getState().updateRelationType(relId, 'many-to-many');

    expect(useSchemaStore.getState().relations[0].type).toBe('many-to-many');
  });
});

describe('removeTable cleans up relations', () => {
  it('removes relations when source table is deleted', () => {
    const { id1, id2, col1, col2 } = createTwoTables();
    useSchemaStore.getState().addRelation(id1, col1, id2, col2, 'one-to-many');
    useSchemaStore.getState().removeTable(id1);

    expect(useSchemaStore.getState().relations).toHaveLength(0);
    expect(useSchemaStore.getState().edges).toHaveLength(0);
  });
});

describe('removeColumn cleans up relations', () => {
  it('removes relations when a referenced column is deleted', () => {
    const { id1, id2, col1, col2 } = createTwoTables();
    useSchemaStore.getState().addRelation(id1, col1, id2, col2, 'one-to-many');
    useSchemaStore.getState().removeColumn(id1, col1);

    expect(useSchemaStore.getState().relations).toHaveLength(0);
    expect(useSchemaStore.getState().edges).toHaveLength(0);
  });
});

describe('addRelation with sides', () => {
  it('stores sourceSide and targetSide', () => {
    const { id1, id2, col1, col2 } = createTwoTables();
    useSchemaStore.getState().addRelation(id1, col1, id2, col2, 'one-to-many', 'left', 'right');

    const rel = useSchemaStore.getState().relations[0];
    expect(rel.sourceSide).toBe('left');
    expect(rel.targetSide).toBe('right');
  });

  it('defaults sides to undefined when not provided', () => {
    const { id1, id2, col1, col2 } = createTwoTables();
    useSchemaStore.getState().addRelation(id1, col1, id2, col2, 'one-to-many');

    const rel = useSchemaStore.getState().relations[0];
    expect(rel.sourceSide).toBeUndefined();
    expect(rel.targetSide).toBeUndefined();
  });

  it('builds edges with correct handle IDs for non-default sides', () => {
    const { id1, id2, col1, col2 } = createTwoTables();
    useSchemaStore.getState().addRelation(id1, col1, id2, col2, 'one-to-many', 'left', 'right');

    const edge = useSchemaStore.getState().edges[0];
    expect(edge.sourceHandle).toBe(`${col1}-left-source`);
    expect(edge.targetHandle).toBe(`${col2}-right-target`);
  });
});

describe('convertToJunction', () => {
  it('creates a junction table with 2 relations and removes the original', () => {
    vi.useFakeTimers();
    const { id1, id2, col1, col2 } = createTwoTables();
    const relId = useSchemaStore.getState().addRelation(id1, col1, id2, col2, 'many-to-many');

    useSchemaStore.getState().convertToJunction(relId);
    vi.advanceTimersByTime(200);
    vi.useRealTimers();

    const { tables, relations } = useSchemaStore.getState();

    // Original relation removed, 2 new ones
    expect(relations).toHaveLength(2);
    expect(relations.find((r) => r.id === relId)).toBeUndefined();

    // Junction table created (3 tables total)
    expect(tables).toHaveLength(3);
    const junctionTable = tables[2];
    expect(junctionTable.columns).toHaveLength(3); // id + 2 FK columns
    expect(junctionTable.columns[0].name).toBe('id');
    expect(junctionTable.columns[0].isPrimaryKey).toBe(true);
  });

  it('names the junction table {src}_{tgt}', () => {
    const { id1, id2, col1, col2 } = createTwoTables();
    const relId = useSchemaStore.getState().addRelation(id1, col1, id2, col2, 'many-to-many');

    const srcName = useSchemaStore.getState().tables[0].name;
    const tgtName = useSchemaStore.getState().tables[1].name;

    useSchemaStore.getState().convertToJunction(relId);

    const junctionTable = useSchemaStore.getState().tables[2];
    expect(junctionTable.name).toBe(`${srcName}_${tgtName}`);
  });

  it('creates a unique composite index on the junction table', () => {
    vi.useFakeTimers();
    const { id1, id2, col1, col2 } = createTwoTables();
    const relId = useSchemaStore.getState().addRelation(id1, col1, id2, col2, 'many-to-many');

    useSchemaStore.getState().convertToJunction(relId);
    vi.advanceTimersByTime(200);
    vi.useRealTimers();

    const junctionTable = useSchemaStore.getState().tables[2];
    expect(junctionTable.indexes).toHaveLength(1);
    expect(junctionTable.indexes![0].isUnique).toBe(true);
    expect(junctionTable.indexes![0].columnIds).toHaveLength(2);
  });

  it('positions the junction table at the midpoint', () => {
    const { id1, id2, col1, col2 } = createTwoTables();
    const relId = useSchemaStore.getState().addRelation(id1, col1, id2, col2, 'many-to-many');

    useSchemaStore.getState().convertToJunction(relId);

    const junctionTable = useSchemaStore.getState().tables[2];
    // Tables are at (0,0) and (300,0), midpoint is (150,0)
    expect(junctionTable.position.x).toBe(150);
    expect(junctionTable.position.y).toBe(0);
  });

  it('creates two one-to-many relations to the junction table', () => {
    vi.useFakeTimers();
    const { id1, id2, col1, col2 } = createTwoTables();
    const relId = useSchemaStore.getState().addRelation(id1, col1, id2, col2, 'many-to-many');

    useSchemaStore.getState().convertToJunction(relId);
    vi.advanceTimersByTime(200);
    vi.useRealTimers();

    const { relations } = useSchemaStore.getState();
    expect(relations).toHaveLength(2);
    expect(relations[0].type).toBe('one-to-many');
    expect(relations[1].type).toBe('one-to-many');

    // Both target the junction table
    const junctionId = useSchemaStore.getState().tables[2].id;
    expect(relations[0].targetTableId).toBe(junctionId);
    expect(relations[1].targetTableId).toBe(junctionId);
  });
});

describe('self-referencing relation', () => {
  it('allows relation between different columns of the same table', () => {
    const id1 = useSchemaStore.getState().addTable({ x: 0, y: 0 });
    useSchemaStore.getState().addColumn(id1);
    const cols = useSchemaStore.getState().tables[0].columns;
    const col1 = cols[0].id;
    const col2 = cols[1].id;

    useSchemaStore.getState().addRelation(id1, col1, id1, col2, 'one-to-many', 'right', 'right');

    const { relations, edges } = useSchemaStore.getState();
    expect(relations).toHaveLength(1);
    expect(relations[0].sourceTableId).toBe(id1);
    expect(relations[0].targetTableId).toBe(id1);
    expect(edges).toHaveLength(1);
    expect(edges[0].source).toBe(id1);
    expect(edges[0].target).toBe(id1);
  });
});
