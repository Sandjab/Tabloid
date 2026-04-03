import { describe, it, expect } from 'vitest';
import { nextAvailableName } from '@/utils/naming';

describe('nextAvailableName', () => {
  it('returns prefix + 1 when no names exist', () => {
    expect(nextAvailableName('table_', [])).toBe('table_1');
  });

  it('increments past existing names', () => {
    expect(nextAvailableName('table_', ['table_1', 'table_2'])).toBe('table_3');
  });

  it('reuses freed indices', () => {
    expect(nextAvailableName('table_', ['table_2', 'table_3'])).toBe('table_1');
  });

  it('finds the lowest gap', () => {
    expect(nextAvailableName('column_', ['column_1', 'column_3', 'column_5'])).toBe('column_2');
  });

  it('ignores names that do not match the pattern', () => {
    expect(nextAvailableName('table_', ['users', 'posts', 'table_2'])).toBe('table_1');
  });

  it('works with column prefix', () => {
    expect(nextAvailableName('column_', ['id', 'column_1'])).toBe('column_2');
  });
});
