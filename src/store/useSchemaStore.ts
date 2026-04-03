import { create } from 'zustand';
import { temporal } from 'zundo';
import {
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
} from '@xyflow/react';
import type {
  Table,
  Column,
  ColumnType,
  Index,
  Relation,
  RelationType,
  TableNodeData,
} from '@/types/schema';
import { createTableId, createColumnId, createRelationId, makeHandleId } from '@/utils/id';
import { nextAvailableName } from '@/utils/naming';

// --- Store interface ---

export interface SchemaState {
  tables: Table[];
  relations: Relation[];
  nodes: Node<TableNodeData>[];
  edges: Edge[];

  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;

  addTable: (position: { x: number; y: number }) => string;
  removeTable: (tableId: string) => void;
  updateTableName: (tableId: string, name: string) => void;

  addColumn: (tableId: string) => void;
  removeColumn: (tableId: string, columnId: string) => void;
  moveColumn: (tableId: string, fromIndex: number, toIndex: number) => void;
  updateColumnName: (tableId: string, columnId: string, name: string) => void;
  updateColumnType: (tableId: string, columnId: string, type: ColumnType) => void;
  toggleColumnPrimaryKey: (tableId: string, columnId: string) => void;
  toggleColumnNullable: (tableId: string, columnId: string) => void;
  toggleColumnUnique: (tableId: string, columnId: string) => void;
  updateColumnDefault: (tableId: string, columnId: string, value: string | undefined) => void;

  addRelation: (
    sourceTableId: string,
    sourceColumnId: string,
    targetTableId: string,
    targetColumnId: string,
    type: RelationType,
  ) => string;
  removeRelation: (relationId: string) => void;
  updateRelationType: (relationId: string, type: RelationType) => void;

  updateTableColor: (tableId: string, color: string | undefined) => void;
  updateTableNotes: (tableId: string, notes: string | undefined) => void;
  addIndex: (tableId: string, name: string, columnIds: string[], isUnique: boolean) => void;
  removeIndex: (tableId: string, indexId: string) => void;

  duplicateTable: (tableId: string) => string;
  updateTablePositions: (positions: Map<string, { x: number; y: number }>) => void;
  loadSchema: (tables: Table[], relations: Relation[]) => void;
  rebuildNodesFromTables: () => void;
}

// --- Internal helpers ---

function updateTableInState(
  tables: Table[],
  nodes: Node<TableNodeData>[],
  tableId: string,
  updater: (table: Table) => Table,
): { tables: Table[]; nodes: Node<TableNodeData>[] } {
  let updatedTable: Table | undefined;
  const updatedTables = tables.map((t) => {
    if (t.id !== tableId) return t;
    updatedTable = updater(t);
    return updatedTable;
  });
  const updatedNodes = nodes.map((n) =>
    n.id === tableId && updatedTable
      ? { ...n, data: { table: updatedTable } }
      : n,
  );
  return { tables: updatedTables, nodes: updatedNodes };
}

function updateColumnInTable(
  table: Table,
  columnId: string,
  updater: (col: Column) => Column,
): Table {
  return {
    ...table,
    columns: table.columns.map((c) =>
      c.id === columnId ? updater(c) : c,
    ),
  };
}

function buildEdgesFromRelations(relations: Relation[]): Edge[] {
  return relations.map((r) => ({
    id: r.id,
    source: r.sourceTableId,
    sourceHandle: makeHandleId(r.sourceColumnId, 'source'),
    target: r.targetTableId,
    targetHandle: makeHandleId(r.targetColumnId, 'target'),
    type: 'relation',
    data: { relationType: r.type },
  }));
}

function buildNodesFromTables(tables: Table[]): Node<TableNodeData>[] {
  return tables.map((table) => ({
    id: table.id,
    type: 'table' as const,
    position: table.position,
    data: { table },
  }));
}

// --- Store ---

export const useSchemaStore = create<SchemaState>()(
  temporal(
    (set, get) => ({
      tables: [],
      relations: [],
      nodes: [],
      edges: [],

      onNodesChange: (changes: NodeChange[]) => {
        set((state) => {
          const updatedNodes = applyNodeChanges(
            changes,
            state.nodes,
          ) as Node<TableNodeData>[];

          const hasPositionChanges = changes.some(
            (c) => c.type === 'position' && 'position' in c && c.position,
          );
          if (!hasPositionChanges) {
            return { nodes: updatedNodes };
          }

          const movedIds = new Set(
            changes
              .filter((c): c is NodeChange & { id: string } =>
                c.type === 'position' && 'id' in c && 'position' in c && !!c.position,
              )
              .map((c) => c.id),
          );
          const updatedTables = state.tables.map((table) => {
            if (!movedIds.has(table.id)) return table;
            const node = updatedNodes.find((n) => n.id === table.id);
            return node ? { ...table, position: node.position } : table;
          });
          return { nodes: updatedNodes, tables: updatedTables };
        });
      },

      onEdgesChange: (changes: EdgeChange[]) => {
        set((state) => ({
          edges: applyEdgeChanges(changes, state.edges),
        }));
      },

      addTable: (position) => {
        const id = createTableId();
        const existingNames = get().tables.map((t) => t.name);
        const tableName = nextAvailableName('table_', existingNames);
        const defaultColumn: Column = {
          id: createColumnId(),
          name: 'id',
          type: 'SERIAL',
          isPrimaryKey: true,
          isNullable: false,
          isUnique: false,
        };
        const table: Table = {
          id,
          name: tableName,
          columns: [defaultColumn],
          position,
        };
        const node: Node<TableNodeData> = {
          id,
          type: 'table',
          position,
          data: { table },
        };
        set((state) => ({
          tables: [...state.tables, table],
          nodes: [...state.nodes, node],
        }));
        return id;
      },

      removeTable: (tableId) => {
        set((state) => {
          const updatedRelations = state.relations.filter(
            (r) => r.sourceTableId !== tableId && r.targetTableId !== tableId,
          );
          return {
            tables: state.tables.filter((t) => t.id !== tableId),
            nodes: state.nodes.filter((n) => n.id !== tableId),
            relations: updatedRelations,
            edges: buildEdgesFromRelations(updatedRelations),
          };
        });
      },

      updateTableName: (tableId, name) => {
        set((state) =>
          updateTableInState(state.tables, state.nodes, tableId, (t) => ({
            ...t,
            name,
          })),
        );
      },

      addColumn: (tableId) => {
        set((state) => {
          const table = state.tables.find((t) => t.id === tableId);
          const existingNames = table ? table.columns.map((c) => c.name) : [];
          const colName = nextAvailableName('column_', existingNames);
          const newCol: Column = {
            id: createColumnId(),
            name: colName,
            type: 'TEXT',
            isPrimaryKey: false,
            isNullable: true,
            isUnique: false,
          };
          return updateTableInState(state.tables, state.nodes, tableId, (t) => ({
            ...t,
            columns: [...t.columns, newCol],
          }));
        });
      },

      removeColumn: (tableId, columnId) => {
        set((state) => {
          const result = updateTableInState(state.tables, state.nodes, tableId, (t) => ({
            ...t,
            columns: t.columns.filter((c) => c.id !== columnId),
          }));
          // Also remove relations referencing this column
          const updatedRelations = state.relations.filter(
            (r) => r.sourceColumnId !== columnId && r.targetColumnId !== columnId,
          );
          return {
            ...result,
            relations: updatedRelations,
            edges: buildEdgesFromRelations(updatedRelations),
          };
        });
      },

      moveColumn: (tableId, fromIndex, toIndex) => {
        if (fromIndex === toIndex) return;
        set((state) =>
          updateTableInState(state.tables, state.nodes, tableId, (t) => {
            const columns = [...t.columns];
            const [moved] = columns.splice(fromIndex, 1);
            columns.splice(toIndex, 0, moved);
            return { ...t, columns };
          }),
        );
      },

      updateColumnName: (tableId, columnId, name) => {
        set((state) =>
          updateTableInState(state.tables, state.nodes, tableId, (t) =>
            updateColumnInTable(t, columnId, (c) => ({ ...c, name })),
          ),
        );
      },

      updateColumnType: (tableId, columnId, type) => {
        set((state) =>
          updateTableInState(state.tables, state.nodes, tableId, (t) =>
            updateColumnInTable(t, columnId, (c) => ({ ...c, type })),
          ),
        );
      },

      toggleColumnPrimaryKey: (tableId, columnId) => {
        set((state) =>
          updateTableInState(state.tables, state.nodes, tableId, (t) =>
            updateColumnInTable(t, columnId, (c) => ({
              ...c,
              isPrimaryKey: !c.isPrimaryKey,
            })),
          ),
        );
      },

      toggleColumnNullable: (tableId, columnId) => {
        set((state) =>
          updateTableInState(state.tables, state.nodes, tableId, (t) =>
            updateColumnInTable(t, columnId, (c) => ({
              ...c,
              isNullable: !c.isNullable,
            })),
          ),
        );
      },

      toggleColumnUnique: (tableId, columnId) => {
        set((state) =>
          updateTableInState(state.tables, state.nodes, tableId, (t) =>
            updateColumnInTable(t, columnId, (c) => ({
              ...c,
              isUnique: !c.isUnique,
            })),
          ),
        );
      },

      updateColumnDefault: (tableId, columnId, value) => {
        set((state) =>
          updateTableInState(state.tables, state.nodes, tableId, (t) =>
            updateColumnInTable(t, columnId, (c) => ({
              ...c,
              defaultValue: value,
            })),
          ),
        );
      },

      addRelation: (sourceTableId, sourceColumnId, targetTableId, targetColumnId, type) => {
        const id = createRelationId();
        const relation: Relation = {
          id,
          sourceTableId,
          sourceColumnId,
          targetTableId,
          targetColumnId,
          type,
        };
        set((state) => {
          const updatedRelations = [...state.relations, relation];
          return {
            relations: updatedRelations,
            edges: buildEdgesFromRelations(updatedRelations),
          };
        });
        return id;
      },

      removeRelation: (relationId) => {
        set((state) => {
          const updatedRelations = state.relations.filter((r) => r.id !== relationId);
          return {
            relations: updatedRelations,
            edges: buildEdgesFromRelations(updatedRelations),
          };
        });
      },

      updateRelationType: (relationId, type) => {
        set((state) => {
          const updatedRelations = state.relations.map((r) =>
            r.id === relationId ? { ...r, type } : r,
          );
          return {
            relations: updatedRelations,
            edges: buildEdgesFromRelations(updatedRelations),
          };
        });
      },

      updateTableColor: (tableId, color) => {
        set((state) =>
          updateTableInState(state.tables, state.nodes, tableId, (t) => ({
            ...t,
            color,
          })),
        );
      },

      updateTableNotes: (tableId, notes) => {
        set((state) =>
          updateTableInState(state.tables, state.nodes, tableId, (t) => ({
            ...t,
            notes,
          })),
        );
      },

      addIndex: (tableId, name, columnIds, isUnique) => {
        const newIndex: Index = { id: `idx_${createColumnId().slice(4)}`, name, columnIds, isUnique };
        set((state) =>
          updateTableInState(state.tables, state.nodes, tableId, (t) => ({
            ...t,
            indexes: [...(t.indexes ?? []), newIndex],
          })),
        );
      },

      removeIndex: (tableId, indexId) => {
        set((state) =>
          updateTableInState(state.tables, state.nodes, tableId, (t) => ({
            ...t,
            indexes: (t.indexes ?? []).filter((idx) => idx.id !== indexId),
          })),
        );
      },

      duplicateTable: (tableId) => {
        const state = get();
        const original = state.tables.find((t) => t.id === tableId);
        if (!original) return '';
        const id = createTableId();
        const columnIdMap = new Map<string, string>();
        const columns: Column[] = original.columns.map((c) => {
          const newId = createColumnId();
          columnIdMap.set(c.id, newId);
          return { ...c, id: newId };
        });
        const table: Table = {
          ...original,
          id,
          name: `${original.name}_copy`,
          columns,
          position: { x: original.position.x + 50, y: original.position.y + 50 },
        };
        const node: Node<TableNodeData> = {
          id,
          type: 'table',
          position: table.position,
          data: { table },
        };
        set((s) => ({
          tables: [...s.tables, table],
          nodes: [...s.nodes, node],
        }));
        return id;
      },

      updateTablePositions: (positions) => {
        set((state) => {
          const nodeById = new Map(state.nodes.map((n) => [n.id, n]));
          const updatedTables = state.tables.map((t) => {
            const pos = positions.get(t.id);
            return pos ? { ...t, position: pos } : t;
          });
          return {
            tables: updatedTables,
            nodes: updatedTables.map((table) => {
              const existing = nodeById.get(table.id);
              return existing
                ? { ...existing, position: table.position, data: { table } }
                : { id: table.id, type: 'table' as const, position: table.position, data: { table } };
            }),
          };
        });
      },

      loadSchema: (tables, relations) => {
        set({
          tables,
          relations,
          nodes: buildNodesFromTables(tables),
          edges: buildEdgesFromRelations(relations),
        });
      },

      rebuildNodesFromTables: () => {
        set((state) => ({
          nodes: buildNodesFromTables(state.tables),
          edges: buildEdgesFromRelations(state.relations),
        }));
      },
    }),
    {
      partialize: (state) => ({
        tables: state.tables,
        relations: state.relations,
      }),
      equality: (pastState, currentState) =>
        pastState.tables === currentState.tables &&
        pastState.relations === currentState.relations,
      limit: 100,
    },
  ),
);
