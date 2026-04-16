import { describe, it, expect } from 'vitest';
import { exportHTML, htmlEscape, slugify } from '@/utils/export-html';
import type { Relation, Table } from '@/types/schema';

const FIXED_DATE = new Date('2026-04-17T00:00:00Z');

function makeTables(): Table[] {
  return [
    {
      id: 't1',
      name: 'users',
      notes: 'Application users',
      columns: [
        { id: 'c1', name: 'id', type: 'SERIAL', isPrimaryKey: true, isNullable: false, isUnique: false },
        { id: 'c2', name: 'email', type: 'TEXT', isPrimaryKey: false, isNullable: false, isUnique: true, description: 'Login email' },
      ],
      indexes: [{ id: 'idx1', name: 'idx_email', columnIds: ['c2'], isUnique: true }],
      position: { x: 0, y: 0 },
    },
    {
      id: 't2',
      name: 'posts',
      columns: [
        { id: 'c3', name: 'id', type: 'SERIAL', isPrimaryKey: true, isNullable: false, isUnique: false },
        { id: 'c4', name: 'user_id', type: 'INTEGER', isPrimaryKey: false, isNullable: false, isUnique: false },
      ],
      position: { x: 300, y: 0 },
    },
  ];
}

const RELATIONS: Relation[] = [
  { id: 'r1', sourceTableId: 't2', sourceColumnId: 'c4', targetTableId: 't1', targetColumnId: 'c1', type: 'many-to-one' },
];

describe('htmlEscape', () => {
  it('escapes the five dangerous characters', () => {
    expect(htmlEscape(`<script>alert("x" & 'y')</script>`)).toBe(
      '&lt;script&gt;alert(&quot;x&quot; &amp; &#39;y&#39;)&lt;/script&gt;',
    );
  });
});

describe('slugify', () => {
  it('lowercases and replaces non-alphanumerics', () => {
    expect(slugify('Order Items!', 0)).toBe('order-items');
  });
  it('strips diacritics', () => {
    expect(slugify('Résumé', 0)).toBe('resume');
  });
  it('falls back for empty slug', () => {
    expect(slugify('😀', 3)).toBe('table-3');
  });
});

describe('exportHTML', () => {
  it('produces a valid-looking HTML document with the expected structure', () => {
    const html = exportHTML({
      tables: makeTables(),
      relations: RELATIONS,
      schemaName: 'blog_db',
      dialect: 'postgresql',
      generatedAt: FIXED_DATE,
    });

    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain('<title>blog_db — Schema</title>');
    expect(html).toContain('2 tables · 1 relations');
    expect(html).toContain('generated 2026-04-17T00:00:00.000Z');
  });

  it('produces a TOC with one entry per table', () => {
    const html = exportHTML({
      tables: makeTables(),
      relations: [],
      schemaName: 's',
      dialect: 'generic',
      generatedAt: FIXED_DATE,
    });
    expect(html).toContain('<nav class="toc">');
    expect(html).toContain('<a href="#users">users</a>');
    expect(html).toContain('<a href="#posts">posts</a>');
  });

  it('renders constraint badges and descriptions', () => {
    const html = exportHTML({
      tables: makeTables(),
      relations: [],
      schemaName: 's',
      dialect: 'generic',
      generatedAt: FIXED_DATE,
    });
    expect(html).toContain('<span class="badge pk">PK</span>');
    expect(html).toContain('<span class="badge nn">NN</span>');
    expect(html).toContain('<span class="badge uq">UQ</span>');
    expect(html).toContain('Login email');
  });

  it('renders indexes with unique marker', () => {
    const html = exportHTML({
      tables: makeTables(),
      relations: [],
      schemaName: 's',
      dialect: 'generic',
      generatedAt: FIXED_DATE,
    });
    expect(html).toContain('<span class="unique">unique</span>');
    expect(html).toContain('idx_email');
    expect(html).toContain('(email)');
  });

  it('renders outgoing and incoming relations with anchor links', () => {
    const html = exportHTML({
      tables: makeTables(),
      relations: RELATIONS,
      schemaName: 's',
      dialect: 'generic',
      generatedAt: FIXED_DATE,
    });
    // Outgoing from posts → users
    expect(html).toMatch(/<code>user_id<\/code> → <a href="#users">users<\/a>\.<code>id<\/code>/);
    // Incoming on users from posts
    expect(html).toMatch(/Referenced by/);
    expect(html).toMatch(/<a href="#posts">posts<\/a>\.<code>user_id<\/code>/);
  });

  it('HTML-escapes malicious content in column description', () => {
    const tables: Table[] = [
      {
        id: 't1',
        name: 'x',
        columns: [
          {
            id: 'c1',
            name: 'f',
            type: 'TEXT',
            isPrimaryKey: false,
            isNullable: true,
            isUnique: false,
            description: '<script>alert(1)</script>',
          },
        ],
        position: { x: 0, y: 0 },
      },
    ];
    const html = exportHTML({
      tables,
      relations: [],
      schemaName: 's',
      dialect: 'generic',
      generatedAt: FIXED_DATE,
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('HTML-escapes table name used in anchor target', () => {
    const tables: Table[] = [
      {
        id: 't1',
        name: `evil"name`,
        columns: [],
        position: { x: 0, y: 0 },
      },
    ];
    const html = exportHTML({
      tables,
      relations: [],
      schemaName: 's',
      dialect: 'generic',
      generatedAt: FIXED_DATE,
    });
    // Quote must be escaped wherever the name appears
    expect(html).not.toContain(`evil"name`);
    expect(html).toContain('evil&quot;name');
  });

  it('embeds the svg data URL when provided', () => {
    const html = exportHTML({
      tables: makeTables(),
      relations: [],
      schemaName: 's',
      dialect: 'generic',
      svgDataUrl: 'data:image/svg+xml;base64,PHN2Zy8+',
      generatedAt: FIXED_DATE,
    });
    expect(html).toContain('<section class="erd">');
    expect(html).toContain('src="data:image/svg+xml;base64,PHN2Zy8+"');
  });

  it('omits the ERD section when svgDataUrl is absent', () => {
    const html = exportHTML({
      tables: makeTables(),
      relations: [],
      schemaName: 's',
      dialect: 'generic',
      generatedAt: FIXED_DATE,
    });
    expect(html).not.toContain('class="erd"');
  });
});
