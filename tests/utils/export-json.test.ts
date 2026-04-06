import { describe, it, expect } from 'vitest';
import { exportJSON } from '@/utils/export-json';
import { importJSON } from '@/utils/import-json';
import type { Table, Relation } from '@/types/schema';

const TABLES: Table[] = [
  {
    id: 't1',
    name: 'users',
    columns: [
      { id: 'c1', name: 'id', type: 'SERIAL', isPrimaryKey: true, isNullable: false, isUnique: false },
      { id: 'c2', name: 'email', type: 'TEXT', isPrimaryKey: false, isNullable: false, isUnique: true },
    ],
    position: { x: 100, y: 200 },
    color: '#3B82F6',
  },
];

const RELATIONS: Relation[] = [
  {
    id: 'r1',
    sourceTableId: 't2',
    sourceColumnId: 'c3',
    targetTableId: 't1',
    targetColumnId: 'c1',
    type: 'many-to-one',
  },
];

describe('JSON round-trip', () => {
  it('exports and imports without data loss', () => {
    const json = exportJSON(TABLES, RELATIONS, 'test schema');
    const result = importJSON(json);

    expect(result.name).toBe('test schema');
    expect(result.tables).toHaveLength(1);
    expect(result.tables[0].name).toBe('users');
    expect(result.tables[0].columns).toHaveLength(2);
    expect(result.tables[0].color).toBe('#3B82F6');
    expect(result.tables[0].position).toEqual({ x: 100, y: 200 });
    expect(result.relations).toHaveLength(1);
    expect(result.relations[0].type).toBe('many-to-one');
  });
});

describe('JSON round-trip with indexes', () => {
  it('preserves indexes on tables', () => {
    const tablesWithIndexes: Table[] = [{
      ...TABLES[0],
      indexes: [{
        id: 'idx_1',
        name: 'idx_email',
        columnIds: ['c2'],
        isUnique: true,
      }],
    }];
    const json = exportJSON(tablesWithIndexes, [], 'test');
    const result = importJSON(json);
    expect(result.tables[0].indexes).toHaveLength(1);
    expect(result.tables[0].indexes![0].name).toBe('idx_email');
    expect(result.tables[0].indexes![0].isUnique).toBe(true);
    expect(result.tables[0].indexes![0].columnIds).toEqual(['c2']);
  });

  it('handles tables without indexes', () => {
    const json = exportJSON(TABLES, [], 'test');
    const result = importJSON(json);
    expect(result.tables[0].indexes).toBeUndefined();
  });
});

describe('JSON round-trip with sides', () => {
  it('preserves sourceSide and targetSide', () => {
    const relations: Relation[] = [{
      id: 'r1',
      sourceTableId: 't1',
      sourceColumnId: 'c1',
      sourceSide: 'left',
      targetTableId: 't2',
      targetColumnId: 'c2',
      targetSide: 'right',
      type: 'one-to-many',
    }];
    const json = exportJSON(TABLES, relations, 'test');
    const result = importJSON(json);
    expect(result.relations[0].sourceSide).toBe('left');
    expect(result.relations[0].targetSide).toBe('right');
  });

  it('imports v1 JSON without sides gracefully', () => {
    const v1Json = JSON.stringify({
      version: 1,
      name: 'v1 schema',
      tables: TABLES,
      relations: RELATIONS,
    });
    const result = importJSON(v1Json);
    expect(result.relations[0].sourceSide).toBeUndefined();
    expect(result.relations[0].targetSide).toBeUndefined();
  });
});

describe('importJSON validation', () => {
  it('rejects invalid JSON', () => {
    expect(() => importJSON('not json')).toThrow('Invalid JSON');
  });

  it('rejects wrong version', () => {
    expect(() => importJSON('{"version": 99}')).toThrow('Unsupported version');
  });

  it('rejects invalid column types', () => {
    const json = JSON.stringify({
      version: 1,
      tables: [{
        id: 't1',
        name: 'test',
        columns: [{ id: 'c1', name: 'x', type: 'INVALID_TYPE', isPrimaryKey: false }],
        position: { x: 0, y: 0 },
      }],
    });
    expect(() => importJSON(json)).toThrow('Invalid column type');
  });

  it('handles missing optional fields gracefully', () => {
    const json = JSON.stringify({
      version: 1,
      tables: [{
        id: 't1',
        name: 'test',
        columns: [{ id: 'c1', name: 'x', type: 'TEXT' }],
      }],
    });
    const result = importJSON(json);
    expect(result.tables[0].columns[0].isPrimaryKey).toBe(false);
    expect(result.tables[0].columns[0].isNullable).toBe(true);
    expect(result.tables[0].color).toBeUndefined();
    expect(result.relations).toHaveLength(0);
  });
});
