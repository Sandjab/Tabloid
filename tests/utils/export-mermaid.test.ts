import { describe, it, expect } from 'vitest';
import { exportMermaid } from '@/utils/export-mermaid';
import type { Table, Relation } from '@/types/schema';

const TABLES: Table[] = [
  {
    id: 't1',
    name: 'users',
    columns: [
      { id: 'c1', name: 'id', type: 'SERIAL', isPrimaryKey: true, isNullable: false, isUnique: false },
      { id: 'c2', name: 'email', type: 'TEXT', isPrimaryKey: false, isNullable: false, isUnique: true },
    ],
    position: { x: 0, y: 0 },
  },
  {
    id: 't2',
    name: 'posts',
    columns: [
      { id: 'c3', name: 'id', type: 'SERIAL', isPrimaryKey: true, isNullable: false, isUnique: false },
      { id: 'c4', name: 'author_id', type: 'INTEGER', isPrimaryKey: false, isNullable: false, isUnique: false },
    ],
    position: { x: 300, y: 0 },
  },
];

const RELATIONS: Relation[] = [
  {
    id: 'r1',
    sourceTableId: 't2',
    sourceColumnId: 'c4',
    targetTableId: 't1',
    targetColumnId: 'c1',
    type: 'many-to-one',
  },
];

describe('exportMermaid', () => {
  it('starts with erDiagram', () => {
    const result = exportMermaid(TABLES, RELATIONS);
    expect(result.startsWith('erDiagram')).toBe(true);
  });

  it('includes table definitions with columns', () => {
    const result = exportMermaid(TABLES, RELATIONS);
    expect(result).toContain('users {');
    expect(result).toContain('SERIAL id PK');
    expect(result).toContain('TEXT email');
  });

  it('includes relation with correct notation', () => {
    const result = exportMermaid(TABLES, RELATIONS);
    expect(result).toContain('posts }o--|| users');
  });

  it('marks FK columns', () => {
    const result = exportMermaid(TABLES, RELATIONS);
    expect(result).toContain('INTEGER author_id FK');
  });
});
