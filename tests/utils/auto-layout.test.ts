import { describe, it, expect } from 'vitest';
import { computeAutoLayout } from '@/utils/auto-layout';
import type { Table, Relation } from '@/types/schema';

function makeTable(id: string, x: number, y: number, colCount = 2): Table {
  return {
    id,
    name: id,
    columns: Array.from({ length: colCount }, (_, i) => ({
      id: `${id}-c${i}`,
      name: `col${i}`,
      type: 'TEXT' as const,
      isPrimaryKey: i === 0,
      isNullable: true,
      isUnique: false,
    })),
    position: { x, y },
  };
}

describe('computeAutoLayout', () => {
  it('returns positions for all tables', () => {
    const tables = [makeTable('t1', 0, 0), makeTable('t2', 0, 0), makeTable('t3', 0, 0)];
    const positions = computeAutoLayout(tables, []);
    expect(positions.size).toBe(3);
    expect(positions.has('t1')).toBe(true);
    expect(positions.has('t2')).toBe(true);
    expect(positions.has('t3')).toBe(true);
  });

  it('produces valid numeric positions', () => {
    const tables = [makeTable('t1', 0, 0), makeTable('t2', 0, 0)];
    const positions = computeAutoLayout(tables, []);
    for (const pos of positions.values()) {
      expect(typeof pos.x).toBe('number');
      expect(typeof pos.y).toBe('number');
      expect(Number.isFinite(pos.x)).toBe(true);
      expect(Number.isFinite(pos.y)).toBe(true);
    }
  });

  it('separates tables so they do not overlap', () => {
    const tables = [
      makeTable('t1', 0, 0, 3),
      makeTable('t2', 0, 0, 3),
      makeTable('t3', 0, 0, 3),
    ];
    const positions = computeAutoLayout(tables, []);
    const coords = [...positions.values()];
    // At least some tables should be at different positions
    const allSame = coords.every((c) => c.x === coords[0].x && c.y === coords[0].y);
    expect(allSame).toBe(false);
  });

  it('uses relations to inform layout order', () => {
    const tables = [makeTable('t1', 0, 0), makeTable('t2', 0, 0)];
    const relations: Relation[] = [
      {
        id: 'r1',
        sourceTableId: 't1',
        sourceColumnId: 't1-c0',
        targetTableId: 't2',
        targetColumnId: 't2-c0',
        type: 'one-to-many',
      },
    ];
    const positions = computeAutoLayout(tables, relations);
    // With LR direction, source should be left of target
    expect(positions.get('t1')!.x).toBeLessThan(positions.get('t2')!.x);
  });

  it('handles empty tables array', () => {
    const positions = computeAutoLayout([], []);
    expect(positions.size).toBe(0);
  });
});
