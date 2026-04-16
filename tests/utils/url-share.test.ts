import { describe, it, expect } from 'vitest';
import {
  encodeSchemaToHash,
  decodeSchemaFromHash,
  buildShareUrl,
  URL_HASH_PARAM,
} from '@/utils/url-share';
import type { Relation, Table } from '@/types/schema';

const TABLES: Table[] = [
  {
    id: 't1',
    name: 'users',
    columns: [
      { id: 'c1', name: 'id', type: 'SERIAL', isPrimaryKey: true, isNullable: false, isUnique: false },
      { id: 'c2', name: 'email', type: 'TEXT', isPrimaryKey: false, isNullable: false, isUnique: true, description: 'Login email' },
    ],
    position: { x: 100, y: 100 },
  },
];

const RELATIONS: Relation[] = [];

describe('url-share', () => {
  it('encodes then decodes a schema roundtrip', () => {
    const payload = { tables: TABLES, relations: RELATIONS, name: 'mySchema', dialect: 'postgresql' as const };
    const hash = encodeSchemaToHash(payload);
    expect(hash).toMatch(new RegExp(`^${URL_HASH_PARAM}=`));
    const decoded = decodeSchemaFromHash(hash);
    expect(decoded).not.toBeNull();
    expect(decoded!.name).toBe('mySchema');
    expect(decoded!.dialect).toBe('postgresql');
    expect(decoded!.tables).toHaveLength(1);
    expect(decoded!.tables[0].columns[1].description).toBe('Login email');
  });

  it('decodes hash with leading #', () => {
    const hash = encodeSchemaToHash({ tables: TABLES, relations: RELATIONS, name: 'x', dialect: 'generic' });
    const decoded = decodeSchemaFromHash(`#${hash}`);
    expect(decoded).not.toBeNull();
    expect(decoded!.tables).toHaveLength(1);
  });

  it('returns null for empty or absent hash', () => {
    expect(decodeSchemaFromHash('')).toBeNull();
    expect(decodeSchemaFromHash('#')).toBeNull();
    expect(decodeSchemaFromHash('#other=foo')).toBeNull();
  });

  it('returns null for malformed payload', () => {
    expect(decodeSchemaFromHash(`${URL_HASH_PARAM}=not-a-valid-lz`)).toBeNull();
  });

  it('compresses meaningfully (output shorter than raw JSON for typical schemas)', () => {
    const bigTables: Table[] = Array.from({ length: 10 }, (_, i) => ({
      id: `t${i}`,
      name: `table_${i}`,
      columns: [
        { id: `t${i}-c1`, name: 'id', type: 'SERIAL', isPrimaryKey: true, isNullable: false, isUnique: false },
        { id: `t${i}-c2`, name: 'name', type: 'TEXT', isPrimaryKey: false, isNullable: false, isUnique: false },
        { id: `t${i}-c3`, name: 'created_at', type: 'TIMESTAMP', isPrimaryKey: false, isNullable: false, isUnique: false },
      ],
      position: { x: i * 300, y: 0 },
    }));
    const hash = encodeSchemaToHash({ tables: bigTables, relations: [], name: 'big', dialect: 'generic' });
    const rawJson = JSON.stringify({ version: 2, dialect: 'generic', name: 'big', tables: bigTables, relations: [] });
    expect(hash.length).toBeLessThan(rawJson.length);
  });

  it('builds a full shareable URL', () => {
    const url = buildShareUrl(
      { tables: TABLES, relations: RELATIONS, name: 'x', dialect: 'generic' },
      'https://example.com/tabloid/',
    );
    expect(url).toMatch(/^https:\/\/example\.com\/tabloid\/#s=/);
  });
});
