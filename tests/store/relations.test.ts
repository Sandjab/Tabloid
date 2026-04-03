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
