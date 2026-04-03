import { describe, it, expect, beforeEach } from 'vitest';
import { useSchemaStore } from '@/store/useSchemaStore';

function undoAndRebuild() {
  const temporal = useSchemaStore.temporal.getState();
  temporal.undo();
  temporal.pause();
  useSchemaStore.getState().rebuildNodesFromTables();
  temporal.resume();
}

function redoAndRebuild() {
  const temporal = useSchemaStore.temporal.getState();
  temporal.redo();
  temporal.pause();
  useSchemaStore.getState().rebuildNodesFromTables();
  temporal.resume();
}

beforeEach(() => {
  useSchemaStore.setState({
    tables: [],
    relations: [],
    nodes: [],
    edges: [],
  });
  useSchemaStore.temporal.getState().clear();
});

describe('undo/redo', () => {
  it('undoes addTable', () => {
    useSchemaStore.getState().addTable({ x: 0, y: 0 });
    expect(useSchemaStore.getState().tables).toHaveLength(1);

    undoAndRebuild();
    expect(useSchemaStore.getState().tables).toHaveLength(0);
    expect(useSchemaStore.getState().nodes).toHaveLength(0);
  });

  it('redoes addTable', () => {
    useSchemaStore.getState().addTable({ x: 0, y: 0 });
    undoAndRebuild();

    redoAndRebuild();
    expect(useSchemaStore.getState().tables).toHaveLength(1);
    expect(useSchemaStore.getState().nodes).toHaveLength(1);
  });

  it('undoes removeTable', () => {
    const id = useSchemaStore.getState().addTable({ x: 0, y: 0 });
    useSchemaStore.getState().removeTable(id);
    expect(useSchemaStore.getState().tables).toHaveLength(0);

    undoAndRebuild();
    expect(useSchemaStore.getState().tables).toHaveLength(1);
  });

  it('undoes addRelation', () => {
    const id1 = useSchemaStore.getState().addTable({ x: 0, y: 0 });
    const id2 = useSchemaStore.getState().addTable({ x: 300, y: 0 });
    const col1 = useSchemaStore.getState().tables[0].columns[0].id;
    const col2 = useSchemaStore.getState().tables[1].columns[0].id;

    useSchemaStore.getState().addRelation(id1, col1, id2, col2, 'one-to-many');
    expect(useSchemaStore.getState().relations).toHaveLength(1);

    undoAndRebuild();
    expect(useSchemaStore.getState().relations).toHaveLength(0);
    expect(useSchemaStore.getState().edges).toHaveLength(0);
  });

  it('undoes column changes', () => {
    const id = useSchemaStore.getState().addTable({ x: 0, y: 0 });
    const colId = useSchemaStore.getState().tables[0].columns[0].id;

    useSchemaStore.getState().updateColumnName(id, colId, 'user_id');
    expect(useSchemaStore.getState().tables[0].columns[0].name).toBe('user_id');

    undoAndRebuild();
    expect(useSchemaStore.getState().tables[0].columns[0].name).toBe('id');
  });

  it('can undo multiple consecutive steps', () => {
    useSchemaStore.getState().addTable({ x: 0, y: 0 });
    useSchemaStore.getState().addTable({ x: 100, y: 0 });
    useSchemaStore.getState().addTable({ x: 200, y: 0 });
    expect(useSchemaStore.getState().tables).toHaveLength(3);

    undoAndRebuild();
    expect(useSchemaStore.getState().tables).toHaveLength(2);

    undoAndRebuild();
    expect(useSchemaStore.getState().tables).toHaveLength(1);

    undoAndRebuild();
    expect(useSchemaStore.getState().tables).toHaveLength(0);
  });

  it('pastStates shrink correctly through consecutive undos', () => {
    useSchemaStore.getState().addTable({ x: 0, y: 0 });
    useSchemaStore.getState().addTable({ x: 100, y: 0 });
    useSchemaStore.getState().addTable({ x: 200, y: 0 });

    const temporal = useSchemaStore.temporal.getState();
    expect(temporal.pastStates).toHaveLength(3);

    // First undo
    undoAndRebuild();
    expect(useSchemaStore.temporal.getState().pastStates).toHaveLength(2);

    // Second undo
    undoAndRebuild();
    expect(useSchemaStore.temporal.getState().pastStates).toHaveLength(1);

    // Third undo
    undoAndRebuild();
    expect(useSchemaStore.temporal.getState().pastStates).toHaveLength(0);
  });

  it('tracks pastStates and futureStates', () => {
    expect(useSchemaStore.temporal.getState().pastStates).toHaveLength(0);
    expect(useSchemaStore.temporal.getState().futureStates).toHaveLength(0);

    useSchemaStore.getState().addTable({ x: 0, y: 0 });
    expect(useSchemaStore.temporal.getState().pastStates.length).toBeGreaterThan(0);

    useSchemaStore.temporal.getState().undo();
    expect(useSchemaStore.temporal.getState().futureStates.length).toBeGreaterThan(0);
  });
});
