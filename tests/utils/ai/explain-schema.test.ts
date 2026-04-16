import { describe, it, expect } from 'vitest';
import { summarizeSchema } from '@/utils/ai/explain-schema';
import type { Relation, Table } from '@/types/schema';

describe('summarizeSchema', () => {
  it('produces a readable compact listing of tables and columns', () => {
    const tables: Table[] = [
      {
        id: 't1',
        name: 'users',
        notes: 'app users',
        columns: [
          { id: 'c1', name: 'id', type: 'SERIAL', isPrimaryKey: true, isNullable: false, isUnique: false },
          { id: 'c2', name: 'email', type: 'TEXT', isPrimaryKey: false, isNullable: false, isUnique: true },
        ],
        position: { x: 0, y: 0 },
      },
    ];
    const summary = summarizeSchema(tables, []);
    expect(summary).toContain('- users (app users):');
    expect(summary).toContain('id SERIAL [PK,NN]');
    expect(summary).toContain('email TEXT [NN,UQ]');
  });

  it('lists relations', () => {
    const tables: Table[] = [
      {
        id: 't1',
        name: 'users',
        columns: [{ id: 'c1', name: 'id', type: 'SERIAL', isPrimaryKey: true, isNullable: false, isUnique: false }],
        position: { x: 0, y: 0 },
      },
      {
        id: 't2',
        name: 'posts',
        columns: [{ id: 'c2', name: 'user_id', type: 'INTEGER', isPrimaryKey: false, isNullable: false, isUnique: false }],
        position: { x: 0, y: 0 },
      },
    ];
    const relations: Relation[] = [
      { id: 'r1', sourceTableId: 't2', sourceColumnId: 'c2', targetTableId: 't1', targetColumnId: 'c1', type: 'many-to-one' },
    ];
    const summary = summarizeSchema(tables, relations);
    expect(summary).toContain('RELATIONS:');
    expect(summary).toContain('posts.user_id → users.id (many-to-one)');
  });

  it('omits the RELATIONS section when there are no relations', () => {
    const summary = summarizeSchema(
      [
        {
          id: 't',
          name: 'x',
          columns: [{ id: 'c', name: 'id', type: 'SERIAL', isPrimaryKey: true, isNullable: false, isUnique: false }],
          position: { x: 0, y: 0 },
        },
      ],
      [],
    );
    expect(summary).not.toContain('RELATIONS:');
  });
});
