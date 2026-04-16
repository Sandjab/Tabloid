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
  DialectId,
  Index,
  Relation,
  RelationType,
  HandleSide,
  TableNodeData,
} from '@/types/schema';
import { DEFAULT_SOURCE_SIDE, DEFAULT_TARGET_SIDE } from '@/types/schema';
import { createTableId, createColumnId, createRelationId, makeEdgeHandleId } from '@/utils/id';
import { nextAvailableName } from '@/utils/naming';
import { getCatalogForDialect } from '@/dialects';

function getDefaultPkType(dialect: DialectId): string {
  const catalog = getCatalogForDialect(dialect);
  // Look for SERIAL, BIGSERIAL, or first integer type
  const serial = catalog.find((t) => t.name === 'SERIAL');
  if (serial) return serial.name;
  const integer = catalog.find((t) => t.family === 'integer');
  return integer?.name ?? 'INTEGER';
}

function getDefaultColumnType(dialect: DialectId): string {
  const catalog = getCatalogForDialect(dialect);
  const text = catalog.find((t) => t.name === 'TEXT');
  if (text) return text.name;
  const textFamily = catalog.find((t) => t.family === 'text');
  return textFamily?.name ?? 'TEXT';
}

// --- Store interface ---

export interface SchemaState {
  dialect: DialectId;
  tables: Table[];
  relations: Relation[];
  nodes: Node<TableNodeData>[];
  edges: Edge[];
  schemaName: string;
  setDialect: (dialect: DialectId) => void;
  setSchemaName: (name: string) => void;

  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;

  addTable: (position: { x: number; y: number }) => string;
  removeTable: (tableId: string) => void;
  updateTableName: (tableId: string, name: string) => void;

  addColumn: (tableId: string) => void;
  removeColumn: (tableId: string, columnId: string) => void;
  moveColumn: (tableId: string, fromIndex: number, toIndex: number) => void;
  updateColumnName: (tableId: string, columnId: string, name: string) => void;
  updateColumnType: (tableId: string, columnId: string, type: string) => void;
  toggleColumnPrimaryKey: (tableId: string, columnId: string) => void;
  toggleColumnNullable: (tableId: string, columnId: string) => void;
  toggleColumnUnique: (tableId: string, columnId: string) => void;
  updateColumnDefault: (tableId: string, columnId: string, value: string | undefined) => void;
  updateColumnDescription: (tableId: string, columnId: string, description: string | undefined) => void;

  addRelation: (
    sourceTableId: string,
    sourceColumnId: string,
    targetTableId: string,
    targetColumnId: string,
    type: RelationType,
    sourceSide?: HandleSide,
    targetSide?: HandleSide,
  ) => string;
  removeRelation: (relationId: string) => void;
  updateRelationType: (relationId: string, type: RelationType) => void;
  convertToJunction: (relationId: string) => void;

  updateTableColor: (tableId: string, color: string | undefined) => void;
  updateTableNotes: (tableId: string, notes: string | undefined) => void;
  addIndex: (tableId: string, name: string, columnIds: string[], isUnique: boolean) => void;
  removeIndex: (tableId: string, indexId: string) => void;
  updateIndex: (tableId: string, indexId: string, updates: Partial<Pick<Index, 'name' | 'columnIds' | 'isUnique'>>) => void;

  duplicateTable: (tableId: string) => string;
  updateTablePositions: (positions: Map<string, { x: number; y: number }>) => void;
  updateColumnLength: (tableId: string, columnId: string, length: number | undefined) => void;
  updateColumnPrecision: (tableId: string, columnId: string, precision: number | undefined, scale: number | undefined) => void;
  loadSchema: (tables: Table[], relations: Relation[], name?: string, dialect?: DialectId) => void;
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

function getColIndex(tables: Table[], tableId: string, columnId: string): number {
  const table = tables.find((t) => t.id === tableId);
  if (!table) return 0;
  const idx = table.columns.findIndex((c) => c.id === columnId);
  return idx === -1 ? 0 : idx;
}

function buildEdgesFromRelations(relations: Relation[], tables: Table[]): Edge[] {
  const tableY = new Map(tables.map((t) => [t.id, t.position.y]));

  // Group edges by unordered table pair to detect parallel edges
  const pairGroups = new Map<string, number[]>();
  relations.forEach((r, i) => {
    const key = [r.sourceTableId, r.targetTableId].sort().join(':');
    const group = pairGroups.get(key);
    if (group) group.push(i);
    else pairGroups.set(key, [i]);
  });

  // Sort each group so the edge with the longest vertical travel gets the
  // earliest turn (leftmost lane), creating nested paths that can't cross.
  // Direction matters: going DOWN → descending target index; going UP → ascending.
  for (const indices of pairGroups.values()) {
    if (indices.length < 2) continue;
    const r0 = relations[indices[0]];
    const srcY = tableY.get(r0.sourceTableId) ?? 0;
    const tgtY = tableY.get(r0.targetTableId) ?? 0;
    const goingDown = tgtY >= srcY;

    indices.sort((a, b) => {
      const ra = relations[a], rb = relations[b];
      const tgtA = getColIndex(tables, ra.targetTableId, ra.targetColumnId);
      const tgtB = getColIndex(tables, rb.targetTableId, rb.targetColumnId);
      // Going down: descending (bottom target first). Going up: ascending (top target first).
      return goingDown ? tgtB - tgtA : tgtA - tgtB;
    });
  }

  // Assign sibling index and count for each edge in its group
  const siblingInfo = new Array<{ index: number; count: number }>(relations.length);
  for (const indices of pairGroups.values()) {
    for (let j = 0; j < indices.length; j++) {
      siblingInfo[indices[j]] = { index: j, count: indices.length };
    }
  }

  // Compute bundle info: edges from the same source to different targets get
  // different stepPositions so their vertical segments don't overlap.
  // Sort target tables by Y position so upper targets turn earlier.
  const sourceGroups = new Map<string, Set<string>>();
  for (const r of relations) {
    let targets = sourceGroups.get(r.sourceTableId);
    if (!targets) { targets = new Set(); sourceGroups.set(r.sourceTableId, targets); }
    targets.add(r.targetTableId);
  }
  const sortedTargets = new Map<string, string[]>();
  for (const [srcId, targets] of sourceGroups) {
    sortedTargets.set(srcId, [...targets].sort((a, b) => (tableY.get(a) ?? 0) - (tableY.get(b) ?? 0)));
  }

  return relations.map((r, i) => {
    const targets = sortedTargets.get(r.sourceTableId) ?? [r.targetTableId];
    const bundleIndex = targets.indexOf(r.targetTableId);
    const bundleCount = targets.length;
    const sourceSide = r.sourceSide ?? DEFAULT_SOURCE_SIDE;
    const targetSide = r.targetSide ?? DEFAULT_TARGET_SIDE;
    return {
      id: r.id,
      source: r.sourceTableId,
      sourceHandle: makeEdgeHandleId(r.sourceColumnId, sourceSide, 'source'),
      target: r.targetTableId,
      targetHandle: makeEdgeHandleId(r.targetColumnId, targetSide, 'target'),
      type: 'relation',
      data: {
        relationType: r.type,
        siblingIndex: siblingInfo[i].index,
        siblingCount: siblingInfo[i].count,
        bundleIndex,
        bundleCount,
        sourceSide,
        targetSide,
      },
    };
  });
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
      dialect: 'generic' as DialectId,
      tables: [],
      relations: [],
      nodes: [],
      edges: [],
      schemaName: 'Untitled',

      setDialect: (dialect) => {
        set({ dialect });
      },

      onNodesChange: (changes: NodeChange[]) => {
        // Handle node removals by syncing tables and relations
        const removedIds = new Set(
          changes
            .filter((c) => c.type === 'remove')
            .map((c) => c.id),
        );
        if (removedIds.size > 0) {
          for (const id of removedIds) {
            get().removeTable(id);
          }
          // Filter out remove changes — removeTable already handled nodes
          const remaining = changes.filter((c) => c.type !== 'remove');
          if (remaining.length === 0) return;
          changes = remaining;
        }

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

          // On drag end, rebuild edges so sort order reflects new positions
          const dragEnded = changes.some(
            (c) => c.type === 'position' && 'dragging' in c && c.dragging === false,
          );
          if (dragEnded && state.relations.length > 0) {
            return {
              nodes: updatedNodes,
              tables: updatedTables,
              edges: buildEdgesFromRelations(state.relations, updatedTables),
            };
          }

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
        const { tables, dialect } = get();
        const existingNames = tables.map((t) => t.name);
        const tableName = nextAvailableName('table_', existingNames);
        const defaultColumn: Column = {
          id: createColumnId(),
          name: 'id',
          type: getDefaultPkType(dialect),
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
          const updatedTables = state.tables.filter((t) => t.id !== tableId);
          const updatedRelations = state.relations.filter(
            (r) => r.sourceTableId !== tableId && r.targetTableId !== tableId,
          );
          return {
            tables: updatedTables,
            nodes: state.nodes.filter((n) => n.id !== tableId),
            relations: updatedRelations,
            edges: buildEdgesFromRelations(updatedRelations, updatedTables),
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
            type: getDefaultColumnType(state.dialect),
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
            edges: buildEdgesFromRelations(updatedRelations, result.tables),
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

      updateColumnDescription: (tableId, columnId, description) => {
        set((state) =>
          updateTableInState(state.tables, state.nodes, tableId, (t) =>
            updateColumnInTable(t, columnId, (c) => ({
              ...c,
              description,
            })),
          ),
        );
      },

      updateColumnLength: (tableId, columnId, length) => {
        set((state) =>
          updateTableInState(state.tables, state.nodes, tableId, (t) =>
            updateColumnInTable(t, columnId, (c) => ({
              ...c,
              length,
            })),
          ),
        );
      },

      updateColumnPrecision: (tableId, columnId, precision, scale) => {
        set((state) =>
          updateTableInState(state.tables, state.nodes, tableId, (t) =>
            updateColumnInTable(t, columnId, (c) => ({
              ...c,
              precision,
              scale,
            })),
          ),
        );
      },

      addRelation: (sourceTableId, sourceColumnId, targetTableId, targetColumnId, type, sourceSide, targetSide) => {
        const id = createRelationId();
        const relation: Relation = {
          id,
          sourceTableId,
          sourceColumnId,
          sourceSide,
          targetTableId,
          targetColumnId,
          targetSide,
          type,
        };
        set((state) => {
          const updatedRelations = [...state.relations, relation];
          return {
            relations: updatedRelations,
            edges: buildEdgesFromRelations(updatedRelations, state.tables),
          };
        });
        return id;
      },

      removeRelation: (relationId) => {
        set((state) => {
          const updatedRelations = state.relations.filter((r) => r.id !== relationId);
          return {
            relations: updatedRelations,
            edges: buildEdgesFromRelations(updatedRelations, state.tables),
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
            edges: buildEdgesFromRelations(updatedRelations, state.tables),
          };
        });
      },

      convertToJunction: (relationId) => {
        const state = get();
        const relation = state.relations.find((r) => r.id === relationId);
        if (!relation) return;

        const srcTable = state.tables.find((t) => t.id === relation.sourceTableId);
        const tgtTable = state.tables.find((t) => t.id === relation.targetTableId);
        if (!srcTable || !tgtTable) return;

        const srcCol = srcTable.columns.find((c) => c.id === relation.sourceColumnId);
        const tgtCol = tgtTable.columns.find((c) => c.id === relation.targetColumnId);
        if (!srcCol || !tgtCol) return;

        // Pause undo tracking for atomic operation
        const temporal = useSchemaStore.temporal.getState();
        temporal.pause();

        try {
          // Junction table name and position
          const existingNames = state.tables.map((t) => t.name);
          let junctionName = `${srcTable.name}_${tgtTable.name}`;
          if (existingNames.includes(junctionName)) {
            junctionName = nextAvailableName(`${junctionName}_`, existingNames);
          }
          const midPos = {
            x: (srcTable.position.x + tgtTable.position.x) / 2,
            y: (srcTable.position.y + tgtTable.position.y) / 2,
          };

          // Create junction table with PK + 2 FK columns
          const junctionId = createTableId();
          const pkCol: Column = {
            id: createColumnId(),
            name: 'id',
            type: getDefaultPkType(get().dialect),
            isPrimaryKey: true,
            isNullable: false,
            isUnique: false,
          };
          const fkSrcCol: Column = {
            id: createColumnId(),
            name: `${srcTable.name}_id`,
            type: srcCol.type,
            isPrimaryKey: false,
            isNullable: false,
            isUnique: false,
          };
          const fkTgtCol: Column = {
            id: createColumnId(),
            name: `${tgtTable.name}_id`,
            type: tgtCol.type,
            isPrimaryKey: false,
            isNullable: false,
            isUnique: false,
          };
          const compositeIndex: Index = {
            id: `idx_${createColumnId().slice(4)}`,
            name: `idx_${junctionName}`,
            columnIds: [fkSrcCol.id, fkTgtCol.id],
            isUnique: true,
          };
          const junctionTable: Table = {
            id: junctionId,
            name: junctionName,
            columns: [pkCol, fkSrcCol, fkTgtCol],
            indexes: [compositeIndex],
            position: midPos,
          };
          const junctionNode: Node<TableNodeData> = {
            id: junctionId,
            type: 'table',
            position: midPos,
            data: { table: junctionTable },
          };

          // Two new 1:N relations
          const rel1: Relation = {
            id: createRelationId(),
            sourceTableId: srcTable.id,
            sourceColumnId: srcCol.id,
            sourceSide: relation.sourceSide,
            targetTableId: junctionId,
            targetColumnId: fkSrcCol.id,
            targetSide: relation.sourceSide === 'left' ? 'left' : 'left',
            type: 'one-to-many',
          };
          const rel2: Relation = {
            id: createRelationId(),
            sourceTableId: tgtTable.id,
            sourceColumnId: tgtCol.id,
            sourceSide: relation.targetSide,
            targetTableId: junctionId,
            targetColumnId: fkTgtCol.id,
            targetSide: relation.targetSide === 'right' ? 'right' : 'right',
            type: 'one-to-many',
          };

          // First: add junction table + remove original relation (table appears)
          set((s) => {
            const updatedTables = [...s.tables, junctionTable];
            const updatedRelations = s.relations.filter((r) => r.id !== relationId);
            return {
              tables: updatedTables,
              nodes: [...s.nodes, junctionNode],
              relations: updatedRelations,
              edges: buildEdgesFromRelations(updatedRelations, updatedTables),
            };
          });

          // Then: add the two 1:N relations after a short delay so edges appear after the table
          setTimeout(() => {
            set((s) => {
              const updatedRelations = [...s.relations, rel1, rel2];
              return {
                relations: updatedRelations,
                edges: buildEdgesFromRelations(updatedRelations, s.tables),
              };
            });
            temporal.resume();
          }, 150);
        } catch {
          temporal.resume();
        }
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

      updateIndex: (tableId, indexId, updates) => {
        set((state) =>
          updateTableInState(state.tables, state.nodes, tableId, (t) => ({
            ...t,
            indexes: (t.indexes ?? []).map((idx) =>
              idx.id === indexId ? { ...idx, ...updates } : idx,
            ),
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

      loadSchema: (tables, relations, name, dialect) => {
        set({
          dialect: dialect ?? 'generic',
          schemaName: name ?? 'Untitled',
          tables,
          relations,
          nodes: buildNodesFromTables(tables),
          edges: buildEdgesFromRelations(relations, tables),
        });
        useSchemaStore.temporal.getState().clear();
      },

      setSchemaName: (name) => {
        set({ schemaName: name });
      },

      rebuildNodesFromTables: () => {
        set((state) => ({
          nodes: buildNodesFromTables(state.tables),
          edges: buildEdgesFromRelations(state.relations, state.tables),
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
