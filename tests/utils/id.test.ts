import { describe, it, expect } from 'vitest';
import { createTableId, createColumnId, createRelationId, makeEdgeHandleId, parseHandleId, parseHandleSide } from '@/utils/id';

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

describe('edge handle IDs', () => {
  it('makeEdgeHandleId creates left-source handle ID', () => {
    expect(makeEdgeHandleId('col_abc', 'left', 'source')).toBe('col_abc-left-source');
  });

  it('makeEdgeHandleId creates right-target handle ID', () => {
    expect(makeEdgeHandleId('col_abc', 'right', 'target')).toBe('col_abc-right-target');
  });
});

describe('handle ID parsing', () => {
  it('parseHandleId extracts column ID from left-target handle', () => {
    expect(parseHandleId('col_abc-left-target')).toBe('col_abc');
  });

  it('parseHandleId extracts column ID from right-source handle', () => {
    expect(parseHandleId('col_abc-right-source')).toBe('col_abc');
  });

  it('parseHandleId extracts column ID from simple left handle', () => {
    expect(parseHandleId('col_abc-left')).toBe('col_abc');
  });

  it('parseHandleId extracts column ID from simple right handle', () => {
    expect(parseHandleId('col_abc-right')).toBe('col_abc');
  });

  it('parseHandleId returns empty string for null', () => {
    expect(parseHandleId(null)).toBe('');
  });

  it('parseHandleSide returns left for left handle', () => {
    expect(parseHandleSide('col_abc-left-target')).toBe('left');
  });

  it('parseHandleSide returns right for right handle', () => {
    expect(parseHandleSide('col_abc-right-source')).toBe('right');
  });

  it('parseHandleSide defaults to right for null', () => {
    expect(parseHandleSide(null)).toBe('right');
  });
});
