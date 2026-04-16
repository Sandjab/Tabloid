import { describe, it, expect } from 'vitest';
import { parseGeneratedSchema } from '@/utils/ai/generate-schema';

describe('parseGeneratedSchema', () => {
  it('builds tables with generated ids and resolves relations by name', () => {
    const raw = {
      tables: [
        {
          name: 'users',
          columns: [
            { name: 'id', type: 'SERIAL', isPrimaryKey: true, isNullable: false },
            { name: 'email', type: 'TEXT', isNullable: false, isUnique: true },
          ],
        },
        {
          name: 'posts',
          columns: [
            { name: 'id', type: 'SERIAL', isPrimaryKey: true, isNullable: false },
            { name: 'user_id', type: 'INTEGER', isNullable: false },
          ],
        },
      ],
      relations: [
        {
          sourceTable: 'posts',
          sourceColumn: 'user_id',
          targetTable: 'users',
          targetColumn: 'id',
          type: 'many-to-one',
        },
      ],
    };

    const { tables, relations } = parseGeneratedSchema(raw);
    expect(tables).toHaveLength(2);
    expect(tables[0].name).toBe('users');
    expect(tables[0].columns).toHaveLength(2);

    expect(relations).toHaveLength(1);
    const posts = tables.find((t) => t.name === 'posts')!;
    const users = tables.find((t) => t.name === 'users')!;
    expect(relations[0].sourceTableId).toBe(posts.id);
    expect(relations[0].targetTableId).toBe(users.id);
    expect(relations[0].type).toBe('many-to-one');
  });

  it('coerces unknown column types to TEXT', () => {
    const raw = {
      tables: [
        {
          name: 't1',
          columns: [
            { name: 'id', type: 'SERIAL', isPrimaryKey: true, isNullable: false },
            { name: 'weird', type: 'MADE_UP_TYPE', isNullable: true },
          ],
        },
      ],
      relations: [],
    };
    const { tables } = parseGeneratedSchema(raw);
    expect(tables[0].columns[1].type).toBe('TEXT');
  });

  it('drops relations that reference unknown tables or columns', () => {
    const raw = {
      tables: [
        { name: 'users', columns: [{ name: 'id', type: 'SERIAL', isPrimaryKey: true }] },
      ],
      relations: [
        { sourceTable: 'posts', sourceColumn: 'user_id', targetTable: 'users', targetColumn: 'id', type: 'many-to-one' },
        { sourceTable: 'users', sourceColumn: 'nope', targetTable: 'users', targetColumn: 'id', type: 'many-to-one' },
      ],
    };
    const { relations } = parseGeneratedSchema(raw);
    expect(relations).toEqual([]);
  });

  it('throws on missing tables array', () => {
    expect(() => parseGeneratedSchema({} as never)).toThrow();
    expect(() => parseGeneratedSchema({ tables: 'not-an-array' } as never)).toThrow();
  });

  it('defaults isNullable to true when omitted', () => {
    const raw = {
      tables: [{ name: 't', columns: [{ name: 'c', type: 'TEXT' }] }],
      relations: [],
    };
    const { tables } = parseGeneratedSchema(raw);
    expect(tables[0].columns[0].isNullable).toBe(true);
  });

  it('defaults unknown relation type to many-to-one', () => {
    const raw = {
      tables: [
        { name: 'a', columns: [{ name: 'id', type: 'SERIAL', isPrimaryKey: true }] },
        { name: 'b', columns: [{ name: 'a_id', type: 'INTEGER' }] },
      ],
      relations: [
        { sourceTable: 'b', sourceColumn: 'a_id', targetTable: 'a', targetColumn: 'id', type: 'some-nonsense' },
      ],
    };
    const { relations } = parseGeneratedSchema(raw);
    expect(relations).toHaveLength(1);
    expect(relations[0].type).toBe('many-to-one');
  });
});
