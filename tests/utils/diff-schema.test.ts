import { describe, it, expect } from 'vitest';
import { diffSchema, type SchemaSnapshot } from '@/utils/diff-schema';
import type { BaselineSource } from '@/types/diff';
import type { Column, Relation, Table } from '@/types/schema';

const SRC: BaselineSource = { kind: 'tag', name: 'v1', importedAt: '2026-04-16T00:00:00Z' };

function col(overrides: Partial<Column> & Pick<Column, 'id' | 'name' | 'type'>): Column {
  return {
    isPrimaryKey: false,
    isNullable: true,
    isUnique: false,
    ...overrides,
  };
}

function table(overrides: Partial<Table> & Pick<Table, 'id' | 'name' | 'columns'>): Table {
  return {
    position: { x: 0, y: 0 },
    ...overrides,
  };
}

describe('diffSchema — empty cases', () => {
  it('produces empty diff for identical schemas', () => {
    const snap: SchemaSnapshot = {
      tables: [table({ id: 't1', name: 'users', columns: [col({ id: 'c1', name: 'id', type: 'SERIAL', isPrimaryKey: true })] })],
      relations: [],
    };
    const diff = diffSchema(snap, snap, SRC);
    expect(diff.tables.added).toEqual([]);
    expect(diff.tables.removed).toEqual([]);
    expect(diff.tables.modified).toEqual([]);
    expect(diff.relations.added).toEqual([]);
    expect(diff.relations.removed).toEqual([]);
  });

  it('ignores table position differences', () => {
    const cols: Column[] = [col({ id: 'c1', name: 'id', type: 'SERIAL' })];
    const baseline: SchemaSnapshot = {
      tables: [table({ id: 't1', name: 'users', columns: cols, position: { x: 0, y: 0 } })],
      relations: [],
    };
    const current: SchemaSnapshot = {
      tables: [table({ id: 't1', name: 'users', columns: cols, position: { x: 500, y: 500 } })],
      relations: [],
    };
    const diff = diffSchema(baseline, current, SRC);
    expect(diff.tables.modified).toEqual([]);
  });
});

describe('diffSchema — table-level changes', () => {
  it('detects added tables', () => {
    const baseline: SchemaSnapshot = { tables: [], relations: [] };
    const current: SchemaSnapshot = {
      tables: [table({ id: 't1', name: 'users', columns: [col({ id: 'c1', name: 'id', type: 'SERIAL' })] })],
      relations: [],
    };
    const diff = diffSchema(baseline, current, SRC);
    expect(diff.tables.added).toHaveLength(1);
    expect(diff.tables.added[0].name).toBe('users');
  });

  it('detects removed tables', () => {
    const current: SchemaSnapshot = { tables: [], relations: [] };
    const baseline: SchemaSnapshot = {
      tables: [table({ id: 't1', name: 'users', columns: [col({ id: 'c1', name: 'id', type: 'SERIAL' })] })],
      relations: [],
    };
    const diff = diffSchema(baseline, current, SRC);
    expect(diff.tables.removed).toHaveLength(1);
    expect(diff.tables.removed[0].name).toBe('users');
  });

  it('detects rename when ids match', () => {
    const baseline: SchemaSnapshot = {
      tables: [table({ id: 't1', name: 'users', columns: [col({ id: 'c1', name: 'id', type: 'SERIAL' })] })],
      relations: [],
    };
    const current: SchemaSnapshot = {
      tables: [table({ id: 't1', name: 'customers', columns: [col({ id: 'c1', name: 'id', type: 'SERIAL' })] })],
      relations: [],
    };
    const diff = diffSchema(baseline, current, SRC);
    expect(diff.tables.modified).toHaveLength(1);
    expect(diff.tables.modified[0].renamed).toBe(true);
    expect(diff.tables.modified[0].current.name).toBe('customers');
  });

  it('matches tables by name when ids differ (SQL import case)', () => {
    const baseline: SchemaSnapshot = {
      tables: [table({ id: 'baseline-id', name: 'users', columns: [col({ id: 'bc1', name: 'id', type: 'SERIAL' })] })],
      relations: [],
    };
    const current: SchemaSnapshot = {
      tables: [table({ id: 'current-id', name: 'users', columns: [col({ id: 'cc1', name: 'id', type: 'SERIAL' })] })],
      relations: [],
    };
    const diff = diffSchema(baseline, current, SRC);
    expect(diff.tables.added).toEqual([]);
    expect(diff.tables.removed).toEqual([]);
    expect(diff.tables.modified).toEqual([]); // nothing changed structurally
  });
});

describe('diffSchema — column-level changes', () => {
  function makeTable(columns: Column[]): SchemaSnapshot {
    return { tables: [table({ id: 't1', name: 'users', columns })], relations: [] };
  }

  it('detects added column', () => {
    const b = makeTable([col({ id: 'c1', name: 'id', type: 'SERIAL' })]);
    const c = makeTable([
      col({ id: 'c1', name: 'id', type: 'SERIAL' }),
      col({ id: 'c2', name: 'email', type: 'TEXT' }),
    ]);
    const diff = diffSchema(b, c, SRC);
    expect(diff.tables.modified).toHaveLength(1);
    expect(diff.tables.modified[0].columns.added).toHaveLength(1);
    expect(diff.tables.modified[0].columns.added[0].name).toBe('email');
  });

  it('detects removed column', () => {
    const b = makeTable([
      col({ id: 'c1', name: 'id', type: 'SERIAL' }),
      col({ id: 'c2', name: 'email', type: 'TEXT' }),
    ]);
    const c = makeTable([col({ id: 'c1', name: 'id', type: 'SERIAL' })]);
    const diff = diffSchema(b, c, SRC);
    expect(diff.tables.modified[0].columns.removed).toHaveLength(1);
    expect(diff.tables.modified[0].columns.removed[0].name).toBe('email');
  });

  it('detects type change', () => {
    const b = makeTable([col({ id: 'c1', name: 'age', type: 'INTEGER' })]);
    const c = makeTable([col({ id: 'c1', name: 'age', type: 'BIGINT' })]);
    const diff = diffSchema(b, c, SRC);
    const cd = diff.tables.modified[0].columns.modified[0];
    expect(cd.changes).toContain('type');
    expect(cd.baseline.type).toBe('INTEGER');
    expect(cd.current.type).toBe('BIGINT');
  });

  it('detects nullable and default changes', () => {
    const b = makeTable([col({ id: 'c1', name: 'name', type: 'TEXT', isNullable: true })]);
    const c = makeTable([col({ id: 'c1', name: 'name', type: 'TEXT', isNullable: false, defaultValue: "'anon'" })]);
    const diff = diffSchema(b, c, SRC);
    const cd = diff.tables.modified[0].columns.modified[0];
    expect(cd.changes).toContain('nullable');
    expect(cd.changes).toContain('default');
  });

  it('detects column rename (id match)', () => {
    const b = makeTable([col({ id: 'c1', name: 'username', type: 'TEXT' })]);
    const c = makeTable([col({ id: 'c1', name: 'login', type: 'TEXT' })]);
    const diff = diffSchema(b, c, SRC);
    const cd = diff.tables.modified[0].columns.modified[0];
    expect(cd.changes).toEqual(['name']);
  });
});

describe('diffSchema — relations', () => {
  const baseTables: Table[] = [
    table({
      id: 't1',
      name: 'users',
      columns: [col({ id: 'c1', name: 'id', type: 'SERIAL', isPrimaryKey: true })],
    }),
    table({
      id: 't2',
      name: 'posts',
      columns: [
        col({ id: 'c2', name: 'id', type: 'SERIAL', isPrimaryKey: true }),
        col({ id: 'c3', name: 'user_id', type: 'INTEGER' }),
      ],
    }),
  ];

  it('detects added relation', () => {
    const baseline: SchemaSnapshot = { tables: baseTables, relations: [] };
    const rel: Relation = {
      id: 'r1',
      sourceTableId: 't2',
      sourceColumnId: 'c3',
      targetTableId: 't1',
      targetColumnId: 'c1',
      type: 'many-to-one',
    };
    const current: SchemaSnapshot = { tables: baseTables, relations: [rel] };
    const diff = diffSchema(baseline, current, SRC);
    expect(diff.relations.added).toHaveLength(1);
  });

  it('detects removed relation', () => {
    const rel: Relation = {
      id: 'r1',
      sourceTableId: 't2',
      sourceColumnId: 'c3',
      targetTableId: 't1',
      targetColumnId: 'c1',
      type: 'many-to-one',
    };
    const baseline: SchemaSnapshot = { tables: baseTables, relations: [rel] };
    const current: SchemaSnapshot = { tables: baseTables, relations: [] };
    const diff = diffSchema(baseline, current, SRC);
    expect(diff.relations.removed).toHaveLength(1);
  });

  it('detects type change on matched relation', () => {
    const baseline: SchemaSnapshot = {
      tables: baseTables,
      relations: [{
        id: 'r1',
        sourceTableId: 't2',
        sourceColumnId: 'c3',
        targetTableId: 't1',
        targetColumnId: 'c1',
        type: 'many-to-one',
      }],
    };
    const current: SchemaSnapshot = {
      tables: baseTables,
      relations: [{
        id: 'r1-new',
        sourceTableId: 't2',
        sourceColumnId: 'c3',
        targetTableId: 't1',
        targetColumnId: 'c1',
        type: 'one-to-one',
      }],
    };
    const diff = diffSchema(baseline, current, SRC);
    expect(diff.relations.modified).toHaveLength(1);
    expect(diff.relations.modified[0].changes).toContain('type');
  });

  it('matches relation across id regeneration (SQL import)', () => {
    const baselineTables: Table[] = [
      table({ id: 'B-t1', name: 'users', columns: [col({ id: 'B-c1', name: 'id', type: 'SERIAL' })] }),
      table({
        id: 'B-t2',
        name: 'posts',
        columns: [col({ id: 'B-c2', name: 'user_id', type: 'INTEGER' })],
      }),
    ];
    const currentTables: Table[] = [
      table({ id: 'C-t1', name: 'users', columns: [col({ id: 'C-c1', name: 'id', type: 'SERIAL' })] }),
      table({
        id: 'C-t2',
        name: 'posts',
        columns: [col({ id: 'C-c2', name: 'user_id', type: 'INTEGER' })],
      }),
    ];
    const baseline: SchemaSnapshot = {
      tables: baselineTables,
      relations: [{
        id: 'B-r1',
        sourceTableId: 'B-t2',
        sourceColumnId: 'B-c2',
        targetTableId: 'B-t1',
        targetColumnId: 'B-c1',
        type: 'many-to-one',
      }],
    };
    const current: SchemaSnapshot = {
      tables: currentTables,
      relations: [{
        id: 'C-r1',
        sourceTableId: 'C-t2',
        sourceColumnId: 'C-c2',
        targetTableId: 'C-t1',
        targetColumnId: 'C-c1',
        type: 'many-to-one',
      }],
    };
    const diff = diffSchema(baseline, current, SRC);
    expect(diff.relations.added).toEqual([]);
    expect(diff.relations.removed).toEqual([]);
    expect(diff.relations.modified).toEqual([]);
  });
});

describe('diffSchema — indexes', () => {
  it('detects added index', () => {
    const cols = [col({ id: 'c1', name: 'email', type: 'TEXT' })];
    const b = table({ id: 't1', name: 'users', columns: cols, indexes: [] });
    const c = table({
      id: 't1',
      name: 'users',
      columns: cols,
      indexes: [{ id: 'idx_1', name: 'idx_email', columnIds: ['c1'], isUnique: true }],
    });
    const diff = diffSchema({ tables: [b], relations: [] }, { tables: [c], relations: [] }, SRC);
    expect(diff.tables.modified[0].indexes.added).toHaveLength(1);
  });

  it('detects index column change by resolved name', () => {
    const bCols = [col({ id: 'c1', name: 'email', type: 'TEXT' }), col({ id: 'c2', name: 'age', type: 'INTEGER' })];
    const cCols = [col({ id: 'x1', name: 'email', type: 'TEXT' }), col({ id: 'x2', name: 'phone', type: 'TEXT' })];
    const b = table({
      id: 't1',
      name: 'users',
      columns: bCols,
      indexes: [{ id: 'idx_1', name: 'idx_multi', columnIds: ['c1', 'c2'], isUnique: false }],
    });
    const c = table({
      id: 't1',
      name: 'users',
      columns: cCols,
      indexes: [{ id: 'idx_1', name: 'idx_multi', columnIds: ['x1', 'x2'], isUnique: false }],
    });
    const diff = diffSchema({ tables: [b], relations: [] }, { tables: [c], relations: [] }, SRC);
    // age→phone in the composite — index should be modified AND column age removed / phone added
    expect(diff.tables.modified[0].indexes.modified).toHaveLength(1);
    expect(diff.tables.modified[0].indexes.modified[0].changes).toContain('columnIds');
  });
});
