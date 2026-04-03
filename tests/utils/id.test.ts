import { describe, it, expect } from 'vitest';
import { createTableId, createColumnId, createRelationId } from '@/utils/id';

describe('id generation', () => {
  it('createTableId returns prefixed unique IDs', () => {
    const id = createTableId();
    expect(id).toMatch(/^table_/);
    expect(id.length).toBeGreaterThan(6);
    expect(createTableId()).not.toBe(id);
  });

  it('createColumnId returns prefixed unique IDs', () => {
    const id = createColumnId();
    expect(id).toMatch(/^col_/);
    expect(createColumnId()).not.toBe(id);
  });

  it('createRelationId returns prefixed unique IDs', () => {
    const id = createRelationId();
    expect(id).toMatch(/^rel_/);
    expect(createRelationId()).not.toBe(id);
  });
});
