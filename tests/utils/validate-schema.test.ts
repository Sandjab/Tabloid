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
});
