import { describe, it, expect } from 'vitest';
import { parsePrisma } from '@/utils/import-prisma';

describe('parsePrisma', () => {
  it('parses a basic model with scalar fields', () => {
    const prisma = `
model User {
  id    Int     @id @default(autoincrement())
  email String  @unique
  name  String?
  age   Int
}
`;
    const { tables, relations } = parsePrisma(prisma);
    expect(tables).toHaveLength(1);
    expect(tables[0].name).toBe('User');
    expect(tables[0].columns).toHaveLength(4);

    const [id, email, name, age] = tables[0].columns;
    expect(id.type).toBe('SERIAL');
    expect(id.isPrimaryKey).toBe(true);
    expect(id.isNullable).toBe(false);

    expect(email.type).toBe('TEXT');
    expect(email.isUnique).toBe(true);
    expect(email.isNullable).toBe(false);

    expect(name.type).toBe('TEXT');
    expect(name.isNullable).toBe(true);

    expect(age.type).toBe('INTEGER');
    expect(age.isNullable).toBe(false);

    expect(relations).toHaveLength(0);
  });

  it('parses a @relation with FK + creates a relation, skips the object field', () => {
    const prisma = `
model User {
  id    Int     @id @default(autoincrement())
  posts Post[]
}

model Post {
  id     Int  @id @default(autoincrement())
  userId Int
  user   User @relation(fields: [userId], references: [id])
}
`;
    const { tables, relations } = parsePrisma(prisma);
    expect(tables).toHaveLength(2);

    const postTable = tables.find((t) => t.name === 'Post')!;
    const userTable = tables.find((t) => t.name === 'User')!;

    // user object field must not become a column; only userId should
    const postColumns = postTable.columns.map((c) => c.name);
    expect(postColumns).toEqual(['id', 'userId']);

    expect(relations).toHaveLength(1);
    expect(relations[0].sourceTableId).toBe(postTable.id);
    expect(relations[0].targetTableId).toBe(userTable.id);
    expect(relations[0].type).toBe('many-to-one');

    const srcCol = postTable.columns.find((c) => c.id === relations[0].sourceColumnId)!;
    const tgtCol = userTable.columns.find((c) => c.id === relations[0].targetColumnId)!;
    expect(srcCol.name).toBe('userId');
    expect(tgtCol.name).toBe('id');
  });

  it('maps Prisma native types to abstract Tabloid types', () => {
    const prisma = `
model X {
  a BigInt
  b Float
  c Decimal
  d Boolean
  e DateTime
  f Bytes
  g Json
  h String
}
`;
    const { tables } = parsePrisma(prisma);
    const types = tables[0].columns.map((c) => c.type);
    expect(types).toEqual(['BIGINT', 'FLOAT', 'DECIMAL', 'BOOLEAN', 'TIMESTAMP', 'BLOB', 'JSON', 'TEXT']);
  });

  it('extracts string default values', () => {
    const prisma = `
model User {
  id     Int    @id @default(autoincrement())
  status String @default("active")
}
`;
    const { tables } = parsePrisma(prisma);
    const status = tables[0].columns.find((c) => c.name === 'status')!;
    expect(status.defaultValue).toBe('active');
  });

  it('ignores @@id, @@unique, @@index block-level attributes', () => {
    const prisma = `
model User {
  id    Int     @id
  email String  @unique

  @@index([email])
}
`;
    const { tables } = parsePrisma(prisma);
    expect(tables[0].columns).toHaveLength(2);
  });

  it('skips list-typed back-reference fields (Post[])', () => {
    const prisma = `
model User {
  id    Int    @id
  posts Post[]
}
model Post {
  id Int @id
}
`;
    const { tables } = parsePrisma(prisma);
    const user = tables.find((t) => t.name === 'User')!;
    expect(user.columns.map((c) => c.name)).toEqual(['id']);
  });

  it('strips line and block comments', () => {
    const prisma = `
// comment
/* block */
model User {
  id Int @id // inline
}
`;
    const { tables } = parsePrisma(prisma);
    expect(tables).toHaveLength(1);
  });
});
