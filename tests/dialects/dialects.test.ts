import { describe, it, expect } from 'vitest';
import { DIALECTS } from '@/dialects';
import { COLUMN_TYPES } from '@/types/schema';
import type { Column, ColumnType } from '@/types/schema';

function makeColumn(type: ColumnType, overrides?: Partial<Column>): Column {
  return {
    id: 'c1',
    name: 'test_col',
    type,
    isPrimaryKey: false,
    isNullable: true,
    isUnique: false,
    ...overrides,
  };
}

describe.each(Object.entries(DIALECTS))('%s dialect', (_name, dialect) => {
  it('maps all abstract types without throwing', () => {
    for (const type of COLUMN_TYPES) {
      const result = dialect.mapType(makeColumn(type));
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    }
  });

  it('maps DECIMAL with precision and scale', () => {
    const col = makeColumn('DECIMAL', { precision: 10, scale: 2 });
    const result = dialect.mapType(col);
    // SQLite maps DECIMAL to REAL regardless of precision
    if (_name !== 'sqlite') {
      expect(result).toContain('10');
      expect(result).toContain('2');
    } else {
      expect(result).toBe('REAL');
    }
  });

  it('formats table names', () => {
    const result = dialect.formatTableName('users');
    expect(result).toContain('users');
    expect(result.length).toBeGreaterThan('users'.length);
  });

  it('formats column names', () => {
    const result = dialect.formatColumnName('email');
    expect(result).toContain('email');
  });

  it('formats default values for TEXT', () => {
    const result = dialect.formatDefault('hello', 'TEXT');
    expect(result).toContain('hello');
  });

  it('has a non-empty name', () => {
    expect(dialect.name.length).toBeGreaterThan(0);
  });
});

describe('dialect-specific behaviors', () => {
  it('postgresql uses SERIAL for SERIAL type', () => {
    expect(DIALECTS.postgresql.mapType(makeColumn('SERIAL'))).toBe('SERIAL');
  });

  it('postgresql uses JSONB for JSON', () => {
    expect(DIALECTS.postgresql.mapType(makeColumn('JSON'))).toBe('JSONB');
  });

  it('mysql uses TINYINT(1) for BOOLEAN', () => {
    expect(DIALECTS.mysql.mapType(makeColumn('BOOLEAN'))).toBe('TINYINT(1)');
  });

  it('mysql formatAutoIncrement returns AUTO_INCREMENT', () => {
    expect(DIALECTS.mysql.formatAutoIncrement(makeColumn('SERIAL'))).toBe('AUTO_INCREMENT');
  });

  it('sqlite maps everything to simple types', () => {
    expect(DIALECTS.sqlite.mapType(makeColumn('BOOLEAN'))).toBe('INTEGER');
    expect(DIALECTS.sqlite.mapType(makeColumn('TIMESTAMP'))).toBe('TEXT');
    expect(DIALECTS.sqlite.mapType(makeColumn('UUID'))).toBe('TEXT');
  });

  it('sqlserver uses brackets for quoting', () => {
    expect(DIALECTS.sqlserver.formatTableName('users')).toBe('[users]');
    expect(DIALECTS.sqlserver.formatColumnName('id')).toBe('[id]');
  });

  it('oracle does not support IF NOT EXISTS', () => {
    expect(DIALECTS.oracle.supportsIfNotExists).toBe(false);
  });

  it('postgresql supports IF NOT EXISTS', () => {
    expect(DIALECTS.postgresql.supportsIfNotExists).toBe(true);
  });
});
