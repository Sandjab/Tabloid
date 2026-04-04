import { describe, it, expect } from 'vitest';
import { exportDBML } from '@/utils/export-dbml';
import type { Table, Relation } from '@/types/schema';

const TABLES: Table[] = [
  {
    id: 't1',
    name: 'users',
    columns: [
      { id: 'c1', name: 'id', type: 'SERIAL', isPrimaryKey: true, isNullable: false, isUnique: false },
      { id: 'c2', name: 'email', type: 'TEXT', isPrimaryKey: false, isNullable: false, isUnique: true },
      { id: 'c3', name: 'name', type: 'TEXT', isPrimaryKey: false, isNullable: true, isUnique: false, defaultValue: 'anonymous' },
    ],
    notes: 'User accounts',
    indexes: [
      { id: 'i1', name: 'idx_email', columnIds: ['c2'], isUnique: true },
      { id: 'i2', name: 'idx_name_email', columnIds: ['c3', 'c2'], isUnique: false },
    ],
    position: { x: 0, y: 0 },
  },
  {
    id: 't2',
    name: 'posts',
    columns: [
      { id: 'c4', name: 'id', type: 'SERIAL', isPrimaryKey: true, isNullable: false, isUnique: false },
      { id: 'c5', name: 'author_id', type: 'INTEGER', isPrimaryKey: false, isNullable: false, isUnique: false },
      { id: 'c6', name: 'score', type: 'DECIMAL', isPrimaryKey: false, isNullable: true, isUnique: false, precision: 10, scale: 2 },
    ],
    position: { x: 300, y: 0 },
  },
];

const RELATIONS: Relation[] = [
  {
    id: 'r1',
    sourceTableId: 't2',
    sourceColumnId: 'c5',
    targetTableId: 't1',
    targetColumnId: 'c1',
    type: 'many-to-one',
  },
];

describe('exportDBML', () => {
  it('generates Table blocks with lowercase types', () => {
    const result = exportDBML(TABLES, RELATIONS);
    expect(result).toContain('Table users {');
    expect(result).toContain('  id serial [pk]');
    expect(result).toContain('Table posts {');
  });

  it('includes not null and unique settings', () => {
    const result = exportDBML(TABLES, RELATIONS);
    expect(result).toContain('  email text [not null, unique]');
  });

  it('skips not null for primary keys', () => {
    const result = exportDBML(TABLES, RELATIONS);
    expect(result).toContain('  id serial [pk]');
    expect(result).not.toContain('pk, not null');
  });

  it('includes default values', () => {
    const result = exportDBML(TABLES, RELATIONS);
    expect(result).toContain("  name text [default: 'anonymous']");
  });

  it('includes table notes with escaped quotes', () => {
    const result = exportDBML(TABLES, RELATIONS);
    expect(result).toContain("  Note: 'User accounts'");
  });

  it('generates indexes block', () => {
    const result = exportDBML(TABLES, RELATIONS);
    expect(result).toContain('  indexes {');
    expect(result).toContain("    email [unique, name: 'idx_email']");
    expect(result).toContain("    (name, email) [name: 'idx_name_email']");
  });

  it('generates Ref lines with correct operators', () => {
    const result = exportDBML(TABLES, RELATIONS);
    expect(result).toContain('Ref: posts.author_id > users.id');
  });

  it('handles all four relation types', () => {
    const allRels: Relation[] = [
      { id: 'r1', sourceTableId: 't2', sourceColumnId: 'c5', targetTableId: 't1', targetColumnId: 'c1', type: 'one-to-one' },
      { id: 'r2', sourceTableId: 't2', sourceColumnId: 'c5', targetTableId: 't1', targetColumnId: 'c1', type: 'one-to-many' },
      { id: 'r3', sourceTableId: 't2', sourceColumnId: 'c5', targetTableId: 't1', targetColumnId: 'c1', type: 'many-to-one' },
      { id: 'r4', sourceTableId: 't2', sourceColumnId: 'c5', targetTableId: 't1', targetColumnId: 'c1', type: 'many-to-many' },
    ];
    const result = exportDBML(TABLES, allRels);
    expect(result).toContain('Ref: posts.author_id - users.id');
    expect(result).toContain('Ref: posts.author_id < users.id');
    expect(result).toContain('Ref: posts.author_id > users.id');
    expect(result).toContain('Ref: posts.author_id <> users.id');
  });

  it('handles decimal with precision and scale', () => {
    const result = exportDBML(TABLES, RELATIONS);
    expect(result).toContain('  score decimal(10,2)');
  });

  it('handles empty schema', () => {
    const result = exportDBML([], []);
    expect(result).toBe('');
  });

  it('escapes single quotes in notes', () => {
    const tables: Table[] = [{
      id: 't1',
      name: 'test',
      columns: [],
      notes: "it's a test",
      position: { x: 0, y: 0 },
    }];
    const result = exportDBML(tables, []);
    expect(result).toContain("Note: 'it\\'s a test'");
  });
});
