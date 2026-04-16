import { describe, it, expect } from 'vitest';
import { parseDBML } from '@/utils/import-dbml';

describe('parseDBML', () => {
  it('parses a basic table with columns and pk', () => {
    const dbml = `
Table users {
  id integer [pk, increment]
  email varchar [unique, not null]
  age int
}
`;
    const { tables, relations } = parseDBML(dbml);
    expect(tables).toHaveLength(1);
    expect(tables[0].name).toBe('users');
    expect(tables[0].columns).toHaveLength(3);

    const [id, email, age] = tables[0].columns;
    expect(id.name).toBe('id');
    expect(id.type).toBe('SERIAL');
    expect(id.isPrimaryKey).toBe(true);
    expect(id.isNullable).toBe(false);

    expect(email.type).toBe('TEXT');
    expect(email.isUnique).toBe(true);
    expect(email.isNullable).toBe(false);

    expect(age.type).toBe('INTEGER');
    expect(age.isNullable).toBe(true);

    expect(relations).toHaveLength(0);
  });

  it('parses inline ref in column settings', () => {
    const dbml = `
Table users {
  id integer [pk]
}
Table posts {
  id integer [pk]
  user_id integer [ref: > users.id]
}
`;
    const { tables, relations } = parseDBML(dbml);
    expect(tables).toHaveLength(2);
    expect(relations).toHaveLength(1);
    expect(relations[0].type).toBe('many-to-one');

    const postsTable = tables.find((t) => t.name === 'posts')!;
    const usersTable = tables.find((t) => t.name === 'users')!;
    expect(relations[0].sourceTableId).toBe(postsTable.id);
    expect(relations[0].targetTableId).toBe(usersTable.id);
  });

  it('parses top-level Ref statement', () => {
    const dbml = `
Table users {
  id integer [pk]
}
Table posts {
  id integer [pk]
  user_id integer
}

Ref: posts.user_id > users.id
`;
    const { relations } = parseDBML(dbml);
    expect(relations).toHaveLength(1);
    expect(relations[0].type).toBe('many-to-one');
  });

  it('handles decimal precision and scale', () => {
    const dbml = `
Table products {
  id int [pk]
  price decimal(10,2) [not null]
}
`;
    const { tables } = parseDBML(dbml);
    const price = tables[0].columns.find((c) => c.name === 'price')!;
    expect(price.type).toBe('DECIMAL');
    expect(price.precision).toBe(10);
    expect(price.scale).toBe(2);
    expect(price.isNullable).toBe(false);
  });

  it('parses default values and notes', () => {
    const dbml = `
Table users {
  id int [pk]
  status varchar [default: 'active']
  bio text [note: 'User biography']
}
`;
    const { tables } = parseDBML(dbml);
    const status = tables[0].columns.find((c) => c.name === 'status')!;
    const bio = tables[0].columns.find((c) => c.name === 'bio')!;
    expect(status.defaultValue).toBe('active');
    expect(bio.description).toBe('User biography');
  });

  it('strips line and block comments', () => {
    const dbml = `
// This is a line comment
/* Block comment */
Table users {
  id int [pk] // inline comment
}
`;
    const { tables } = parseDBML(dbml);
    expect(tables).toHaveLength(1);
    expect(tables[0].columns[0].name).toBe('id');
  });

  it('supports many-to-many and one-to-one operators', () => {
    const dbml = `
Table a { id int [pk] }
Table b { id int [pk] }

Ref: a.id <> b.id
`;
    const { relations } = parseDBML(dbml);
    expect(relations).toHaveLength(1);
    expect(relations[0].type).toBe('many-to-many');
  });

  it('ignores unknown settings without crashing', () => {
    const dbml = `
Table users {
  id int [pk, weird_unknown_setting, increment]
}
`;
    const { tables } = parseDBML(dbml);
    expect(tables[0].columns[0].isPrimaryKey).toBe(true);
    expect(tables[0].columns[0].type).toBe('SERIAL');
  });

  // --- Review-driven improvements ---

  it('preserves length for VARCHAR and CHAR types', () => {
    const dbml = `
Table users {
  id int [pk]
  email varchar(255)
  code char(4)
}
`;
    const { tables } = parseDBML(dbml);
    const email = tables[0].columns.find((c) => c.name === 'email')!;
    const code = tables[0].columns.find((c) => c.name === 'code')!;
    expect(email.length).toBe(255);
    expect(code.length).toBe(4);
  });

  it('parses a Ref block with multiple relations', () => {
    const dbml = `
Table users {
  id int [pk]
}
Table posts {
  id int [pk]
  user_id int
  reviewer_id int
}
Table reviews {
  id int [pk]
  post_id int
}

Ref my_refs {
  posts.user_id > users.id
  posts.reviewer_id > users.id
  reviews.post_id > posts.id
}
`;
    const { relations } = parseDBML(dbml);
    expect(relations).toHaveLength(3);
    expect(relations.every((r) => r.type === 'many-to-one')).toBe(true);
  });

  it('does not skip a column named `indexes` or `note`', () => {
    const dbml = `
Table meta {
  id int [pk]
  indexes text
  note text
}
`;
    const { tables } = parseDBML(dbml);
    const names = tables[0].columns.map((c) => c.name);
    expect(names).toContain('indexes');
    expect(names).toContain('note');
  });

  it('still skips genuine indexes { } and Note: blocks', () => {
    const dbml = `
Table users {
  id int [pk]
  email varchar(255)
  Note: 'A user'
  indexes {
    (email) [unique]
  }
}
`;
    const { tables } = parseDBML(dbml);
    expect(tables).toHaveLength(1);
    const names = tables[0].columns.map((c) => c.name);
    expect(names).toEqual(['id', 'email']);
  });

  it('parses a quoted custom type', () => {
    const dbml = `
Table x {
  id int [pk]
  data "my custom type"
}
`;
    const { tables } = parseDBML(dbml);
    const data = tables[0].columns.find((c) => c.name === 'data')!;
    expect(data.type.toLowerCase()).toBe('my custom type');
  });
});
