import dagre from '@dagrejs/dagre';
import type { Table, Relation } from '@/types/schema';

const NODE_WIDTH = 260;
const ROW_HEIGHT = 32;
const HEADER_HEIGHT = 40;
const PADDING = 16;

function estimateNodeHeight(table: Table): number {
  const columnsHeight = Math.max(table.columns.length, 1) * ROW_HEIGHT;
  return HEADER_HEIGHT + columnsHeight + PADDING;
}

export function computeAutoLayout(
  tables: Table[],
  relations: Relation[],
  direction: 'TB' | 'LR' = 'LR',
): Map<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: direction, nodesep: 60, ranksep: 80 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const table of tables) {
    g.setNode(table.id, {
      width: NODE_WIDTH,
      height: estimateNodeHeight(table),
    });
  }

  for (const rel of relations) {
    g.setEdge(rel.sourceTableId, rel.targetTableId);
  }

  dagre.layout(g);

  const positions = new Map<string, { x: number; y: number }>();
  for (const table of tables) {
    const node = g.node(table.id);
    if (node) {
      // Dagre returns center coordinates; convert to top-left for React Flow
      positions.set(table.id, {
        x: node.x - NODE_WIDTH / 2,
        y: node.y - (node.height ?? 0) / 2,
      });
    }
  }
  return positions;
}
