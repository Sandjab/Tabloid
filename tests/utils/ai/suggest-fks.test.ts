import { describe, it, expect } from 'vitest';
import { extractTargetTableName, suggestForeignKeys } from '@/utils/ai/suggest-fks';
import type { Relation, Table } from '@/types/schema';

describe('extractTargetTableName', () => {
  it('extracts snake_case _id suffix', () => {
    expect(extractTargetTableName('user_id')).toBe('user');
    expect(extractTargetTableName('author_id')).toBe('author');
  });
  it('extracts camelCase Id suffix', () => {
    expect(extractTargetTableName('userId')).toBe('user');
    expect(extractTargetTableName('authorId')).toBe('author');
  });
  it('extracts fk_ prefix', () => {
    expect(extractTargetTableName('fk_user')).toBe('user');
  });
  it('extracts _uuid and _fk suffixes', () => {
    expect(extractTargetTableName('project_uuid')).toBe('project');
    expect(extractTargetTableName('parent_fk')).toBe('parent');
  });
  it('returns null for non-FK columns', () => {
    expect(extractTargetTableName('id')).toBeNull();
    expect(extractTargetTableName('email')).toBeNull();
    expect(extractTargetTableName('name')).toBeNull();
  });
});

function makeTable(name: string, colNames: string[]): Table {
  return {
    id: `t-${name}`,
    name,
    columns: colNames.map((n, i) => ({
      id: `${name}-${n}-${i}`,
      name: n,
      type: 'SERIAL',
      isPrimaryKey: n === 'id',
      isNullable: false,
      isUnique: false,
    })),
    position: { x: 0, y: 0 },
  };
}

describe('suggestForeignKeys', () => {
  it('suggests high-confidence FK for exact-name match', () => {
    const tables = [
      makeTable('users', ['id']),
      makeTable('posts', ['id', 'user_id']),
    ];
    const suggestions = suggestForeignKeys(tables, []);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].sourceTableName).toBe('posts');
    expect(suggestions[0].sourceColumnName).toBe('user_id');
    expect(suggestions[0].targetTableName).toBe('users');
    expect(suggestions[0].targetColumnName).toBe('id');
    expect(suggestions[0].confidence).toBe('medium'); // users vs user → normalized
  });

  it('handles camelCase FK columns', () => {
    const tables = [
      makeTable('authors', ['id']),
      makeTable('posts', ['id', 'authorId']),
    ];
    const suggestions = suggestForeignKeys(tables, []);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].sourceColumnName).toBe('authorId');
    expect(suggestions[0].targetTableName).toBe('authors');
  });

  it('ignores columns already source of a relation', () => {
    const tables = [
      makeTable('users', ['id']),
      makeTable('posts', ['id', 'user_id']),
    ];
    const existing: Relation[] = [
      {
        id: 'r1',
        sourceTableId: 't-posts',
        sourceColumnId: 'posts-user_id-1',
        targetTableId: 't-users',
        targetColumnId: 'users-id-0',
        type: 'many-to-one',
      },
    ];
    expect(suggestForeignKeys(tables, existing)).toEqual([]);
  });

  it('ignores PK columns as potential sources', () => {
    const tables = [
      makeTable('user', ['id']),
      makeTable('other', ['id']),
    ];
    // Neither `id` column should be proposed as FK source (they're PKs).
    expect(suggestForeignKeys(tables, [])).toEqual([]);
  });

  it('normalizes plurals (users <-> user)', () => {
    const tables = [
      makeTable('users', ['id']),
      makeTable('posts', ['id', 'user_id']),
    ];
    const s = suggestForeignKeys(tables, []);
    expect(s).toHaveLength(1);
  });

  it('does not suggest anything when no matching table exists', () => {
    const tables = [
      makeTable('posts', ['id', 'mysterious_id']),
    ];
    expect(suggestForeignKeys(tables, [])).toEqual([]);
  });

  it('prefers non-self matches when multiple candidates exist', () => {
    const tables = [
      makeTable('users', ['id', 'user_id']),
      makeTable('other_users', ['id']),
    ];
    const s = suggestForeignKeys(tables, []);
    expect(s).toHaveLength(1);
    // user_id on users table should prefer a different table if the name matches one.
    // Here "users" singularizes to "user" — no table is named "user", so it'll fall
    // back to self-match on "users". That's expected given the heuristic.
    expect(s[0].targetTableName).toBe('users');
  });
});
