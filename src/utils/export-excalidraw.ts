import { nanoid } from 'nanoid';
import type { Table, Relation } from '@/types/schema';

interface ExcalidrawElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  strokeColor: string;
  backgroundColor: string;
  fillStyle: string;
  strokeWidth: number;
  roughness: number;
  opacity: number;
  groupIds: string[];
  boundElements: { id: string; type: string }[] | null;
  text?: string;
  fontSize?: number;
  fontFamily?: number;
  textAlign?: string;
  verticalAlign?: string;
  containerId?: string | null;
  startBinding?: { elementId: string; focus: number; gap: number } | null;
  endBinding?: { elementId: string; focus: number; gap: number } | null;
  points?: number[][];
  [key: string]: unknown;
}

const COL_WIDTH = 280;
const ROW_H = 24;
const HEADER_H = 36;
const PAD = 8;

export function exportExcalidraw(tables: Table[], relations: Relation[]): string {
  const elements: ExcalidrawElement[] = [];
  const tableRectIds = new Map<string, string>();

  for (const table of tables) {
    const groupId = nanoid(8);
    const rectId = nanoid(8);
    tableRectIds.set(table.id, rectId);
    const h = HEADER_H + table.columns.length * ROW_H + PAD * 2;

    // Table rectangle
    elements.push({
      id: rectId,
      type: 'rectangle',
      x: table.position.x,
      y: table.position.y,
      width: COL_WIDTH,
      height: h,
      strokeColor: '#1e1e1e',
      backgroundColor: table.color ?? '#a5d8ff',
      fillStyle: 'solid',
      strokeWidth: 1,
      roughness: 0,
      opacity: 100,
      groupIds: [groupId],
      boundElements: null,
    });

    // Table name
    elements.push({
      id: nanoid(8),
      type: 'text',
      x: table.position.x + PAD,
      y: table.position.y + PAD,
      width: COL_WIDTH - PAD * 2,
      height: HEADER_H - PAD,
      strokeColor: '#1e1e1e',
      backgroundColor: 'transparent',
      fillStyle: 'solid',
      strokeWidth: 1,
      roughness: 0,
      opacity: 100,
      groupIds: [groupId],
      boundElements: null,
      text: table.name,
      fontSize: 16,
      fontFamily: 1,
      textAlign: 'left',
      verticalAlign: 'top',
      containerId: null,
    });

    // Columns
    table.columns.forEach((col, i) => {
      const pk = col.isPrimaryKey ? 'PK ' : '';
      const nn = !col.isNullable ? ' NOT NULL' : '';
      elements.push({
        id: nanoid(8),
        type: 'text',
        x: table.position.x + PAD,
        y: table.position.y + HEADER_H + i * ROW_H,
        width: COL_WIDTH - PAD * 2,
        height: ROW_H,
        strokeColor: '#495057',
        backgroundColor: 'transparent',
        fillStyle: 'solid',
        strokeWidth: 1,
        roughness: 0,
        opacity: 100,
        groupIds: [groupId],
        boundElements: null,
        text: `${pk}${col.name}: ${col.type}${nn}`,
        fontSize: 14,
        fontFamily: 3,
        textAlign: 'left',
        verticalAlign: 'top',
        containerId: null,
      });
    });
  }

  // Relation arrows
  for (const rel of relations) {
    const srcRectId = tableRectIds.get(rel.sourceTableId);
    const tgtRectId = tableRectIds.get(rel.targetTableId);
    const srcTable = tables.find((t) => t.id === rel.sourceTableId);
    const tgtTable = tables.find((t) => t.id === rel.targetTableId);

    if (srcRectId && tgtRectId && srcTable && tgtTable) {
      elements.push({
        id: nanoid(8),
        type: 'arrow',
        x: srcTable.position.x + COL_WIDTH,
        y: srcTable.position.y + HEADER_H / 2,
        width: tgtTable.position.x - srcTable.position.x - COL_WIDTH,
        height: tgtTable.position.y - srcTable.position.y,
        strokeColor: '#1e1e1e',
        backgroundColor: 'transparent',
        fillStyle: 'solid',
        strokeWidth: 1,
        roughness: 0,
        opacity: 100,
        groupIds: [],
        boundElements: null,
        startBinding: { elementId: srcRectId, focus: 0, gap: 4 },
        endBinding: { elementId: tgtRectId, focus: 0, gap: 4 },
        points: [
          [0, 0],
          [
            tgtTable.position.x - srcTable.position.x - COL_WIDTH,
            tgtTable.position.y - srcTable.position.y,
          ],
        ],
      });
    }
  }

  const file = {
    type: 'excalidraw',
    version: 2,
    source: 'tabloid',
    elements,
    appState: { viewBackgroundColor: '#ffffff' },
    files: {},
  };

  return JSON.stringify(file, null, 2);
}
