import { describe, it, expect } from 'vitest';
import { validateSchema } from '@/utils/validate-schema';
import type { Table, Relation } from '@/types/schema';

function makeTable(id: string, overrides?: Partial<Table>): Table {
  return {
    id,
    name: id,
    columns: [
      { id: `${id}-c1`, name: 'id', type: 'SERIAL', isPrimaryKey: true, isNullable: false, isUnique: false },
    ],
    position: { x: 0, y: 0 },
    ...overrides,
  };
}

describe('validateSchema', () => {
  it('returns no warnings for a valid schema', () => {
    const tables = [makeTable('t1'), makeTable('t2')];
    const relations: Relation[] = [{
      id: 'r1',
      sourceTableId: 't2',
      sourceColumnId: 't2-c1',
      targetTableId: 't1',
      targetColumnId: 't1-c1',
      type: 'many-to-one',
    }];
    expect(validateSchema(tables, relations)).toHaveLength(0);
  });

  it('warns on empty table', () => {
    const tables = [makeTable('t1', { columns: [] })];
    const warnings = validateSchema(tables, []);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].type).toBe('empty-table');
  });

  it('warns on missing primary key', () => {
    const tables = [makeTable('t1', {
      columns: [{ id: 'c1', name: 'name', type: 'TEXT', isPrimaryKey: false, isNullable: true, isUnique: false }],
    })];
    const warnings = validateSchema(tables, []);
    expect(warnings.some((w) => w.type === 'missing-primary-key')).toBe(true);
  });

  it('errors on duplicate column names', () => {
    const tables = [makeTable('t1', {
      columns: [
        { id: 'c1', name: 'id', type: 'SERIAL', isPrimaryKey: true, isNullable: false, isUnique: false },
        { id: 'c2', name: 'id', type: 'TEXT', isPrimaryKey: false, isNullable: true, isUnique: false },
      ],
    })];
    const warnings = validateSchema(tables, []);
    expect(warnings.some((w) => w.type === 'duplicate-column-name')).toBe(true);
  });

  it('errors on FK referencing missing column', () => {
    const tables = [makeTable('t1')];
    const relations: Relation[] = [{
      id: 'r1',
      sourceTableId: 't1',
      sourceColumnId: 'nonexistent',
      targetTableId: 't1',
      targetColumnId: 't1-c1',
      type: 'one-to-one',
    }];
    const warnings = validateSchema(tables, relations);
    expect(warnings.some((w) => w.type === 'fk-missing-column')).toBe(true);
  });

  it('warns on FK with incompatible types', () => {
    const tables = [
      makeTable('t1'),
      makeTable('t2', {
        columns: [{ id: 't2-c1', name: 'ref', type: 'TEXT', isPrimaryKey: false, isNullable: true, isUnique: false }],
      }),
    ];
    const relations: Relation[] = [{
      id: 'r1',
      sourceTableId: 't2',
      sourceColumnId: 't2-c1',
      targetTableId: 't1',
      targetColumnId: 't1-c1',
      type: 'many-to-one',
    }];
    const warnings = validateSchema(tables, relations);
    expect(warnings.some((w) => w.type === 'fk-incompatible-types')).toBe(true);
  });

  it('does not warn on FK between SERIAL and INTEGER', () => {
    const tables = [
      makeTable('t1'),
      makeTable('t2', {
        columns: [{ id: 't2-c1', name: 'ref', type: 'INTEGER', isPrimaryKey: false, isNullable: true, isUnique: false }],
      }),
    ];
    const relations: Relation[] = [{
      id: 'r1',
      sourceTableId: 't2',
      sourceColumnId: 't2-c1',
      targetTableId: 't1',
      targetColumnId: 't1-c1',
      type: 'many-to-one',
    }];
    const warnings = validateSchema(tables, relations);
    expect(warnings.some((w) => w.type === 'fk-incompatible-types')).toBe(false);
  });

  it('errors on index referencing missing column', () => {
    const tables = [makeTable('t1', {
      indexes: [{ id: 'idx1', name: 'idx_test', columnIds: ['nonexistent'], isUnique: false }],
    })];
    const warnings = validateSchema(tables, []);
    expect(warnings.some((w) => w.type === 'index-missing-column')).toBe(true);
  });

  it('errors on duplicate table names', () => {
    const tables = [makeTable('t1', { name: 'users' }), makeTable('t2', { name: 'users' })];
    const warnings = validateSchema(tables, []);
    expect(warnings.some((w) => w.type === 'duplicate-table-name')).toBe(true);
  });

  it('catches case-insensitive duplicate table names', () => {
    const tables = [makeTable('t1', { name: 'Users' }), makeTable('t2', { name: 'users' })];
    const warnings = validateSchema(tables, []);
    expect(warnings.some((w) => w.type === 'duplicate-table-name')).toBe(true);
  });

  it('handles empty schema', () => {
    expect(validateSchema([], [])).toHaveLength(0);
  });

  // --- New rules: fk-cycle, fk-missing-index, orphan-table, reserved-word, naming-inconsistency ---

  it('flags FK column without index as info-level hint', () => {
    const tables: Table[] = [
      makeTable('users'),
      {
        id: 'posts',
        name: 'posts',
        columns: [
          { id: 'posts-c1', name: 'id', type: 'SERIAL', isPrimaryKey: true, isNullable: false, isUnique: false },
          { id: 'posts-c2', name: 'user_id', type: 'SERIAL', isPrimaryKey: false, isNullable: false, isUnique: false },
        ],
        position: { x: 0, y: 0 },
      },
    ];
    const relations: Relation[] = [{
      id: 'r1',
      sourceTableId: 'posts',
      sourceColumnId: 'posts-c2',
      targetTableId: 'users',
      targetColumnId: 'users-c1',
      type: 'many-to-one',
    }];
    const warnings = validateSchema(tables, relations);
    const hint = warnings.find((w) => w.type === 'fk-missing-index');
    expect(hint).toBeDefined();
    expect(hint!.severity).toBe('info');
    expect(hint!.tableId).toBe('posts');
  });

  it('does not flag FK-missing-index when the FK column has an index', () => {
    const tables: Table[] = [
      makeTable('users'),
      {
        id: 'posts',
        name: 'posts',
        columns: [
          { id: 'posts-c1', name: 'id', type: 'SERIAL', isPrimaryKey: true, isNullable: false, isUnique: false },
          { id: 'posts-c2', name: 'user_id', type: 'SERIAL', isPrimaryKey: false, isNullable: false, isUnique: false },
        ],
        indexes: [{ id: 'idx1', name: 'idx_user_id', columnIds: ['posts-c2'], isUnique: false }],
        position: { x: 0, y: 0 },
      },
    ];
    const relations: Relation[] = [{
      id: 'r1',
      sourceTableId: 'posts',
      sourceColumnId: 'posts-c2',
      targetTableId: 'users',
      targetColumnId: 'users-c1',
      type: 'many-to-one',
    }];
    const warnings = validateSchema(tables, relations);
    expect(warnings.some((w) => w.type === 'fk-missing-index')).toBe(false);
  });

  it('detects FK cycles', () => {
    const tables: Table[] = ['a', 'b', 'c'].map((name) => ({
      id: name,
      name,
      columns: [
        { id: `${name}-id`, name: 'id', type: 'SERIAL', isPrimaryKey: true, isNullable: false, isUnique: false },
        { id: `${name}-ref`, name: 'ref', type: 'SERIAL', isPrimaryKey: false, isNullable: false, isUnique: false },
      ],
      position: { x: 0, y: 0 },
    }));
    // a → b → c → a
    const relations: Relation[] = [
      { id: 'r1', sourceTableId: 'a', sourceColumnId: 'a-ref', targetTableId: 'b', targetColumnId: 'b-id', type: 'many-to-one' },
      { id: 'r2', sourceTableId: 'b', sourceColumnId: 'b-ref', targetTableId: 'c', targetColumnId: 'c-id', type: 'many-to-one' },
      { id: 'r3', sourceTableId: 'c', sourceColumnId: 'c-ref', targetTableId: 'a', targetColumnId: 'a-id', type: 'many-to-one' },
    ];
    const warnings = validateSchema(tables, relations);
    expect(warnings.filter((w) => w.type === 'fk-cycle').length).toBeGreaterThanOrEqual(1);
  });

  it('does not flag self-FK as a cycle', () => {
    const tables: Table[] = [
      {
        id: 'tree',
        name: 'tree',
        columns: [
          { id: 'tree-id', name: 'id', type: 'SERIAL', isPrimaryKey: true, isNullable: false, isUnique: false },
          { id: 'tree-parent', name: 'parent_id', type: 'SERIAL', isPrimaryKey: false, isNullable: true, isUnique: false },
        ],
        position: { x: 0, y: 0 },
      },
    ];
    const relations: Relation[] = [
      { id: 'r1', sourceTableId: 'tree', sourceColumnId: 'tree-parent', targetTableId: 'tree', targetColumnId: 'tree-id', type: 'many-to-one' },
    ];
    const warnings = validateSchema(tables, relations);
    expect(warnings.some((w) => w.type === 'fk-cycle')).toBe(false);
  });

  it('flags orphan tables as info hints', () => {
    const tables = [makeTable('t1'), makeTable('t2'), makeTable('isolated')];
    const relations: Relation[] = [
      { id: 'r1', sourceTableId: 't2', sourceColumnId: 't2-c1', targetTableId: 't1', targetColumnId: 't1-c1', type: 'many-to-one' },
    ];
    const warnings = validateSchema(tables, relations);
    const orphan = warnings.find((w) => w.type === 'orphan-table');
    expect(orphan).toBeDefined();
    expect(orphan!.tableId).toBe('isolated');
  });

  it('flags reserved SQL words in table and column names', () => {
    const tables: Table[] = [
      {
        id: 't1',
        name: 'user',
        columns: [
          { id: 't1-c1', name: 'order', type: 'SERIAL', isPrimaryKey: true, isNullable: false, isUnique: false },
        ],
        position: { x: 0, y: 0 },
      },
    ];
    const warnings = validateSchema(tables, []);
    const reserved = warnings.filter((w) => w.type === 'reserved-word');
    expect(reserved).toHaveLength(2);
  });

  it('flags mixed naming styles across tables', () => {
    const tables = [
      { ...makeTable('users'), name: 'users' },
      { ...makeTable('orderItems'), name: 'orderItems' },
    ];
    const warnings = validateSchema(tables, []);
    expect(warnings.some((w) => w.type === 'naming-inconsistency')).toBe(true);
  });

  it('does not flag naming-inconsistency for all snake_case', () => {
    const tables = [
      { ...makeTable('users'), name: 'users' },
      { ...makeTable('order_items'), name: 'order_items' },
    ];
    const warnings = validateSchema(tables, []);
    expect(warnings.some((w) => w.type === 'naming-inconsistency')).toBe(false);
  });

  // --- Review-driven fixes ---

  it('cycle detection flags only relations on the actual cycle, not the approach path', () => {
    // Graph: A -> B -> C -> D -> B  (cycle is B→C→D→B; A→B is NOT in the cycle)
    const tables: Table[] = ['a', 'b', 'c', 'd'].map((name) => ({
      id: name,
      name,
      columns: [
        { id: `${name}-id`, name: 'id', type: 'SERIAL', isPrimaryKey: true, isNullable: false, isUnique: false },
        { id: `${name}-ref`, name: 'ref', type: 'SERIAL', isPrimaryKey: false, isNullable: false, isUnique: false },
      ],
      position: { x: 0, y: 0 },
    }));
    const relations: Relation[] = [
      { id: 'rAB', sourceTableId: 'a', sourceColumnId: 'a-ref', targetTableId: 'b', targetColumnId: 'b-id', type: 'many-to-one' },
      { id: 'rBC', sourceTableId: 'b', sourceColumnId: 'b-ref', targetTableId: 'c', targetColumnId: 'c-id', type: 'many-to-one' },
      { id: 'rCD', sourceTableId: 'c', sourceColumnId: 'c-ref', targetTableId: 'd', targetColumnId: 'd-id', type: 'many-to-one' },
      { id: 'rDB', sourceTableId: 'd', sourceColumnId: 'd-ref', targetTableId: 'b', targetColumnId: 'b-id', type: 'many-to-one' },
    ];
    const warnings = validateSchema(tables, relations);
    const cycleIssues = warnings.filter((w) => w.type === 'fk-cycle');
    const flaggedRels = new Set(cycleIssues.map((w) => w.columnId));

    // B→C, C→D, D→B should be flagged (via their sourceColumnIds)
    expect(flaggedRels.has('b-ref')).toBe(true);
    expect(flaggedRels.has('c-ref')).toBe(true);
    expect(flaggedRels.has('d-ref')).toBe(true);
    // A→B is on the approach path, NOT in the cycle
    expect(flaggedRels.has('a-ref')).toBe(false);
  });

  it('flags case-insensitive duplicate column names', () => {
    const tables = [makeTable('t1', {
      columns: [
        { id: 'c1', name: 'Email', type: 'TEXT', isPrimaryKey: false, isNullable: true, isUnique: false },
        { id: 'c2', name: 'email', type: 'TEXT', isPrimaryKey: false, isNullable: true, isUnique: false },
      ],
    })];
    const warnings = validateSchema(tables, []);
    expect(warnings.some((w) => w.type === 'duplicate-column-name')).toBe(true);
  });
});
