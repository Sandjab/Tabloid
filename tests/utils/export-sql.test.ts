import { describe, it, expect } from 'vitest';
import { exportSQL } from '@/utils/export-sql';
import { DIALECTS } from '@/dialects';
import type { Table, Relation } from '@/types/schema';

const TABLES: Table[] = [
  {
    id: 't1',
    name: 'users',
    columns: [
      { id: 'c1', name: 'id', type: 'SERIAL', isPrimaryKey: true, isNullable: false, isUnique: false },
      { id: 'c2', name: 'email', type: 'TEXT', isPrimaryKey: false, isNullable: false, isUnique: true },
      { id: 'c3', name: 'age', type: 'INTEGER', isPrimaryKey: false, isNullable: true, isUnique: false, defaultValue: '0' },
    ],
    position: { x: 0, y: 0 },
  },
  {
    id: 't2',
    name: 'posts',
    columns: [
      { id: 'c4', name: 'id', type: 'SERIAL', isPrimaryKey: true, isNullable: false, isUnique: false },
      { id: 'c5', name: 'author_id', type: 'INTEGER', isPrimaryKey: false, isNullable: false, isUnique: false },
      { id: 'c6', name: 'title', type: 'TEXT', isPrimaryKey: false, isNullable: false, isUnique: false },
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

describe('exportSQL', () => {
  it('generates CREATE TABLE statements', () => {
    const sql = exportSQL(TABLES, [], DIALECTS.postgresql);
    expect(sql).toContain('CREATE TABLE');
    expect(sql).toContain('"users"');
    expect(sql).toContain('"posts"');
  });

  it('includes column definitions with constraints', () => {
    const sql = exportSQL(TABLES, [], DIALECTS.postgresql);
    expect(sql).toContain('PRIMARY KEY');
    expect(sql).toContain('NOT NULL');
    expect(sql).toContain('UNIQUE');
    expect(sql).toContain('DEFAULT 0');
  });

  it('generates FK constraints via ALTER TABLE', () => {
    const sql = exportSQL(TABLES, RELATIONS, DIALECTS.postgresql);
    expect(sql).toContain('ALTER TABLE');
    expect(sql).toContain('FOREIGN KEY');
    expect(sql).toContain('REFERENCES');
    expect(sql).toContain('"users"');
  });

  it('uses IF NOT EXISTS for supporting dialects', () => {
    const pgSql = exportSQL(TABLES, [], DIALECTS.postgresql);
    expect(pgSql).toContain('IF NOT EXISTS');

    const oracleSql = exportSQL(TABLES, [], DIALECTS.oracle);
    expect(oracleSql).not.toContain('IF NOT EXISTS');
  });

  it('uses dialect-specific quoting', () => {
    const mysqlSql = exportSQL(TABLES, [], DIALECTS.mysql);
    expect(mysqlSql).toContain('`users`');

    const ssSql = exportSQL(TABLES, [], DIALECTS.sqlserver);
    expect(ssSql).toContain('[users]');
  });

  it('handles empty tables', () => {
    const sql = exportSQL([], [], DIALECTS.postgresql);
    expect(sql).toBe('');
  });
});
