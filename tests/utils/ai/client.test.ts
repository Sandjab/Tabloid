import { describe, it, expect } from 'vitest';
import { extractJson } from '@/utils/ai/client';

describe('extractJson', () => {
  it('parses clean JSON objects', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it('parses clean JSON arrays', () => {
    expect(extractJson('[1, 2, 3]')).toEqual([1, 2, 3]);
  });

  it('strips ```json markdown fences', () => {
    const text = '```json\n{"a":1}\n```';
    expect(extractJson(text)).toEqual({ a: 1 });
  });

  it('strips plain ``` fences', () => {
    const text = '```\n{"a":1}\n```';
    expect(extractJson(text)).toEqual({ a: 1 });
  });

  it('extracts the first JSON object when surrounded by prose', () => {
    const text = 'Here is the schema you requested:\n\n{"tables": [{"name": "users"}]}\n\nLet me know if you need changes.';
    expect(extractJson(text)).toEqual({ tables: [{ name: 'users' }] });
  });

  it('extracts a JSON array when prose precedes it', () => {
    const text = 'The results are: [1, 2, 3]';
    expect(extractJson(text)).toEqual([1, 2, 3]);
  });

  it('throws when there is no JSON at all', () => {
    expect(() => extractJson('Just some prose without any braces.')).toThrow(/No JSON/);
  });
});
