import { describe, it, expect } from 'vitest';
import { listInferableColumns, parseInferredTypes } from '@/utils/ai/infer-types';
import type { Table } from '@/types/schema';

describe('listInferableColumns', () => {
  it('returns only TEXT columns that are not PKs', () => {
    const tables: Table[] = [
      {
        id: 't1',
        name: 'users',
        columns: [
          { id: 'c1', name: 'id', type: 'SERIAL', isPrimaryKey: true, isNullable: false, isUnique: false },
          { id: 'c2', name: 'email', type: 'TEXT', isPrimaryKey: false, isNullable: true, isUnique: false },
          { id: 'c3', name: 'age', type: 'INTEGER', isPrimaryKey: false, isNullable: true, isUnique: false },
          { id: 'c4', name: 'pk_name', type: 'TEXT', isPrimaryKey: true, isNullable: false, isUnique: false },
        ],
        position: { x: 0, y: 0 },
      },
    ];
    const out = listInferableColumns(tables);
    expect(out.map((c) => c.name)).toEqual(['email']);
  });
});

describe('parseInferredTypes', () => {
  const columns = [
    { id: 'c1', name: 'email', tableName: 'users' },
    { id: 'c2', name: 'created_at', tableName: 'users' },
    { id: 'c3', name: 'is_active', tableName: 'users' },
  ];

  it('maps ids to valid suggested types', () => {
    const raw = { c1: 'TEXT', c2: 'TIMESTAMP', c3: 'BOOLEAN' };
    const out = parseInferredTypes(raw, columns);
    // TEXT is the current type → skip it, even if returned
    expect(out.map((s) => [s.columnName, s.suggestedType])).toEqual([
      ['created_at', 'TIMESTAMP'],
      ['is_active', 'BOOLEAN'],
    ]);
  });

  it('ignores unknown column ids', () => {
    const raw = { unknown: 'TIMESTAMP', c2: 'TIMESTAMP' };
    const out = parseInferredTypes(raw, columns);
    expect(out.map((s) => s.columnId)).toEqual(['c2']);
  });

  it('ignores invalid types', () => {
    const raw = { c1: 'MADE_UP', c2: 'timestamp' };
    const out = parseInferredTypes(raw, columns);
    // timestamp (lowercase) is normalized to uppercase and accepted
    expect(out.map((s) => [s.columnId, s.suggestedType])).toEqual([['c2', 'TIMESTAMP']]);
  });

  it('handles non-object input', () => {
    expect(parseInferredTypes(null, columns)).toEqual([]);
    expect(parseInferredTypes('not an object', columns)).toEqual([]);
  });
});
