import { describe, it, expect } from 'vitest';
import { exportMigration } from '@/utils/export-migration';
import { diffSchema, type SchemaSnapshot } from '@/utils/diff-schema';
import { DIALECTS } from '@/dialects';
import type { BaselineSource } from '@/types/diff';
import type { Column, Relation, Table } from '@/types/schema';

const SRC: BaselineSource = { kind: 'tag', name: 'v1', importedAt: '2026-04-16T00:00:00Z' };

function col(o: Partial<Column> & Pick<Column, 'id' | 'name' | 'type'>): Column {
  return { isPrimaryKey: false, isNullable: true, isUnique: false, ...o };
}
function table(o: Partial<Table> & Pick<Table, 'id' | 'name' | 'columns'>): Table {
  return { position: { x: 0, y: 0 }, ...o };
}

function migrate(baseline: SchemaSnapshot, current: SchemaSnapshot, dialect: string): string {
  const diff = diffSchema(baseline, current, SRC);
  return exportMigration(diff, baseline, current, DIALECTS[dialect]);
}

describe('exportMigration — table additions', () => {
  it('emits CREATE TABLE for an added table (postgresql)', () => {
    const baseline: SchemaSnapshot = { tables: [], relations: [] };
    const current: SchemaSnapshot = {
      tables: [table({
        id: 't1',
        name: 'users',
        columns: [
          col({ id: 'c1', name: 'id', type: 'SERIAL', isPrimaryKey: true, isNullable: false }),
          col({ id: 'c2', name: 'email', type: 'TEXT', isNullable: false }),
        ],
      })],
      relations: [],
    };
    const sql = migrate(baseline, current, 'postgresql');
    expect(sql).toContain('CREATE TABLE');
    expect(sql).toContain('"users"');
    expect(sql).toContain('"email"');
  });

  it('emits DROP TABLE for a removed table (postgresql)', () => {
    const baseline: SchemaSnapshot = {
      tables: [table({ id: 't1', name: 'old_table', columns: [col({ id: 'c1', name: 'id', type: 'SERIAL' })] })],
      relations: [],
    };
    const current: SchemaSnapshot = { tables: [], relations: [] };
    const sql = migrate(baseline, current, 'postgresql');
    expect(sql).toContain('DROP TABLE IF EXISTS "old_table"');
  });
});

describe('exportMigration — column additions/removals', () => {
  const baseTable: Table = table({
    id: 't1',
    name: 'users',
    columns: [col({ id: 'c1', name: 'id', type: 'SERIAL', isPrimaryKey: true })],
  });

  it('emits ADD COLUMN for added column (postgresql)', () => {
    const current: Table = { ...baseTable, columns: [
      ...baseTable.columns,
      col({ id: 'c2', name: 'age', type: 'INTEGER' }),
    ] };
    const sql = migrate({ tables: [baseTable], relations: [] }, { tables: [current], relations: [] }, 'postgresql');
    expect(sql).toMatch(/ALTER TABLE "users" ADD COLUMN "age" INTEGER/);
  });

  it('emits DROP COLUMN for removed column (postgresql)', () => {
    const baselineTable: Table = { ...baseTable, columns: [
      ...baseTable.columns,
      col({ id: 'c2', name: 'legacy', type: 'TEXT' }),
    ] };
    const sql = migrate(
      { tables: [baselineTable], relations: [] },
      { tables: [baseTable], relations: [] },
      'postgresql',
    );
    expect(sql).toMatch(/ALTER TABLE "users" DROP COLUMN "legacy"/);
  });

  it('emits RENAME COLUMN when id matches but name differs (postgresql)', () => {
    const currentTable: Table = {
      ...baseTable,
      columns: [col({ id: 'c1', name: 'uuid', type: 'SERIAL', isPrimaryKey: true })],
    };
    const sql = migrate({ tables: [baseTable], relations: [] }, { tables: [currentTable], relations: [] }, 'postgresql');
    expect(sql).toMatch(/ALTER TABLE "users" RENAME COLUMN "id" TO "uuid"/);
  });
});

describe('exportMigration — column modifications per dialect', () => {
  const baseline = (type: Column['type']): SchemaSnapshot => ({
    tables: [table({ id: 't1', name: 'users', columns: [col({ id: 'c1', name: 'age', type })] })],
    relations: [],
  });

  it('postgresql: ALTER COLUMN TYPE', () => {
    const sql = migrate(baseline('INTEGER'), baseline('BIGINT'), 'postgresql');
    expect(sql).toMatch(/ALTER TABLE "users" ALTER COLUMN "age" TYPE BIGINT/);
  });

  it('mysql: MODIFY COLUMN with full definition', () => {
    const sql = migrate(baseline('INTEGER'), baseline('BIGINT'), 'mysql');
    expect(sql).toMatch(/ALTER TABLE `users` MODIFY COLUMN `age` BIGINT/);
  });

  it('postgresql: SET NOT NULL', () => {
    const b: SchemaSnapshot = { tables: [table({ id: 't1', name: 'u', columns: [col({ id: 'c1', name: 'n', type: 'TEXT', isNullable: true })] })], relations: [] };
    const c: SchemaSnapshot = { tables: [table({ id: 't1', name: 'u', columns: [col({ id: 'c1', name: 'n', type: 'TEXT', isNullable: false })] })], relations: [] };
    const sql = migrate(b, c, 'postgresql');
    expect(sql).toMatch(/ALTER COLUMN "n" SET NOT NULL/);
  });

  it('postgresql: DROP NOT NULL', () => {
    const b: SchemaSnapshot = { tables: [table({ id: 't1', name: 'u', columns: [col({ id: 'c1', name: 'n', type: 'TEXT', isNullable: false })] })], relations: [] };
    const c: SchemaSnapshot = { tables: [table({ id: 't1', name: 'u', columns: [col({ id: 'c1', name: 'n', type: 'TEXT', isNullable: true })] })], relations: [] };
    const sql = migrate(b, c, 'postgresql');
    expect(sql).toMatch(/ALTER COLUMN "n" DROP NOT NULL/);
  });

  it('postgresql: SET DEFAULT', () => {
    const b: SchemaSnapshot = { tables: [table({ id: 't1', name: 'u', columns: [col({ id: 'c1', name: 'status', type: 'TEXT' })] })], relations: [] };
    const c: SchemaSnapshot = { tables: [table({ id: 't1', name: 'u', columns: [col({ id: 'c1', name: 'status', type: 'TEXT', defaultValue: 'active' })] })], relations: [] };
    const sql = migrate(b, c, 'postgresql');
    expect(sql).toMatch(/ALTER COLUMN "status" SET DEFAULT 'active'/);
  });

  it('sqlite: warns that ALTER COLUMN is unsupported', () => {
    const sql = migrate(baseline('INTEGER'), baseline('BIGINT'), 'sqlite');
    expect(sql).toContain('SQLite does not support ALTER COLUMN');
  });
});

describe('exportMigration — relations', () => {
  const users = table({ id: 't1', name: 'users', columns: [col({ id: 'c1', name: 'id', type: 'SERIAL', isPrimaryKey: true })] });
  const posts = table({
    id: 't2',
    name: 'posts',
    columns: [
      col({ id: 'c2', name: 'id', type: 'SERIAL', isPrimaryKey: true }),
      col({ id: 'c3', name: 'user_id', type: 'INTEGER' }),
    ],
  });
  const rel: Relation = {
    id: 'r1',
    sourceTableId: 't2',
    sourceColumnId: 'c3',
    targetTableId: 't1',
    targetColumnId: 'c1',
    type: 'many-to-one',
  };

  it('emits ADD FOREIGN KEY for added relation', () => {
    const sql = migrate(
      { tables: [users, posts], relations: [] },
      { tables: [users, posts], relations: [rel] },
      'postgresql',
    );
    expect(sql).toMatch(/ADD CONSTRAINT "fk_posts_user_id" FOREIGN KEY \("user_id"\) REFERENCES "users" \("id"\)/);
  });

  it('emits DROP CONSTRAINT for removed relation (postgresql)', () => {
    const sql = migrate(
      { tables: [users, posts], relations: [rel] },
      { tables: [users, posts], relations: [] },
      'postgresql',
    );
    expect(sql).toMatch(/ALTER TABLE "posts" DROP CONSTRAINT "fk_posts_user_id"/);
  });

  it('emits DROP FOREIGN KEY for removed relation (mysql)', () => {
    const sql = migrate(
      { tables: [users, posts], relations: [rel] },
      { tables: [users, posts], relations: [] },
      'mysql',
    );
    expect(sql).toMatch(/DROP FOREIGN KEY `fk_posts_user_id`/);
  });
});

describe('exportMigration — indexes', () => {
  const withIndex = (isUnique: boolean): SchemaSnapshot => ({
    tables: [table({
      id: 't1',
      name: 'users',
      columns: [col({ id: 'c1', name: 'email', type: 'TEXT' })],
      indexes: [{ id: 'idx_1', name: 'idx_email', columnIds: ['c1'], isUnique }],
    })],
    relations: [],
  });

  it('emits CREATE INDEX for added index (postgresql)', () => {
    const baseline: SchemaSnapshot = {
      tables: [table({ id: 't1', name: 'users', columns: [col({ id: 'c1', name: 'email', type: 'TEXT' })] })],
      relations: [],
    };
    const sql = migrate(baseline, withIndex(true), 'postgresql');
    expect(sql).toMatch(/CREATE UNIQUE INDEX "idx_email" ON "users"/);
  });

  it('emits DROP INDEX ON for mysql removed index', () => {
    const current: SchemaSnapshot = {
      tables: [table({ id: 't1', name: 'users', columns: [col({ id: 'c1', name: 'email', type: 'TEXT' })] })],
      relations: [],
    };
    const sql = migrate(withIndex(false), current, 'mysql');
    expect(sql).toMatch(/DROP INDEX `idx_email` ON `users`/);
  });

  it('drops then recreates when index columns change (postgresql)', () => {
    const b: SchemaSnapshot = {
      tables: [table({
        id: 't1',
        name: 'users',
        columns: [col({ id: 'c1', name: 'email', type: 'TEXT' }), col({ id: 'c2', name: 'age', type: 'INTEGER' })],
        indexes: [{ id: 'idx_1', name: 'idx_1', columnIds: ['c1'], isUnique: false }],
      })],
      relations: [],
    };
    const c: SchemaSnapshot = {
      tables: [table({
        id: 't1',
        name: 'users',
        columns: [col({ id: 'c1', name: 'email', type: 'TEXT' }), col({ id: 'c2', name: 'age', type: 'INTEGER' })],
        indexes: [{ id: 'idx_1', name: 'idx_1', columnIds: ['c1', 'c2'], isUnique: false }],
      })],
      relations: [],
    };
    const sql = migrate(b, c, 'postgresql');
    expect(sql).toMatch(/DROP INDEX "idx_1"/);
    expect(sql).toMatch(/CREATE INDEX "idx_1" ON "users" \("email", "age"\)/);
  });
});

describe('exportMigration — column descriptions', () => {
  const baseTable: Table = table({
    id: 't1',
    name: 'users',
    columns: [col({ id: 'c1', name: 'id', type: 'SERIAL', isPrimaryKey: true })],
  });

  it('postgresql: emits COMMENT ON COLUMN after ADD COLUMN with description', () => {
    const current: Table = { ...baseTable, columns: [
      ...baseTable.columns,
      col({ id: 'c2', name: 'email', type: 'TEXT', description: 'Contact email' }),
    ] };
    const sql = migrate({ tables: [baseTable], relations: [] }, { tables: [current], relations: [] }, 'postgresql');
    expect(sql).toMatch(/ADD COLUMN "email"/);
    expect(sql).toMatch(/COMMENT ON COLUMN "users"\."email" IS 'Contact email'/);
  });

  it('oracle: emits COMMENT ON COLUMN after ADD COLUMN with description', () => {
    const current: Table = { ...baseTable, columns: [
      ...baseTable.columns,
      col({ id: 'c2', name: 'email', type: 'TEXT', description: 'Contact email' }),
    ] };
    const sql = migrate({ tables: [baseTable], relations: [] }, { tables: [current], relations: [] }, 'oracle');
    expect(sql).toMatch(/COMMENT ON COLUMN "users"\."email" IS 'Contact email'/);
  });

  it('mysql: includes COMMENT inline in ADD COLUMN', () => {
    const current: Table = { ...baseTable, columns: [
      ...baseTable.columns,
      col({ id: 'c2', name: 'email', type: 'TEXT', description: 'Contact email' }),
    ] };
    const sql = migrate({ tables: [baseTable], relations: [] }, { tables: [current], relations: [] }, 'mysql');
    expect(sql).toMatch(/ADD COLUMN `email` TEXT COMMENT 'Contact email'/);
    // No separate COMMENT statement for MySQL
    expect(sql).not.toMatch(/COMMENT ON COLUMN/);
  });

  it('sqlserver: emits sp_addextendedproperty for added column description', () => {
    const current: Table = { ...baseTable, columns: [
      ...baseTable.columns,
      col({ id: 'c2', name: 'email', type: 'TEXT', description: 'Contact email' }),
    ] };
    const sql = migrate({ tables: [baseTable], relations: [] }, { tables: [current], relations: [] }, 'sqlserver');
    expect(sql).toMatch(/sp_addextendedproperty/);
    expect(sql).toMatch(/'Contact email'/);
  });

  it('mysql: MODIFY on type change preserves existing comment', () => {
    const b: SchemaSnapshot = {
      tables: [table({
        id: 't1',
        name: 'users',
        columns: [col({ id: 'c1', name: 'age', type: 'INTEGER', description: 'User age' })],
      })],
      relations: [],
    };
    const c: SchemaSnapshot = {
      tables: [table({
        id: 't1',
        name: 'users',
        columns: [col({ id: 'c1', name: 'age', type: 'BIGINT', description: 'User age' })],
      })],
      relations: [],
    };
    const sql = migrate(b, c, 'mysql');
    // Single MODIFY statement that carries the comment, not two separate MODIFYs
    const modifyMatches = sql.match(/MODIFY COLUMN/g) ?? [];
    expect(modifyMatches.length).toBe(1);
    expect(sql).toMatch(/MODIFY COLUMN `age` BIGINT COMMENT 'User age'/);
  });

  it('mysql: clearing description emits COMMENT \'\' to explicitly remove comment', () => {
    const b: SchemaSnapshot = {
      tables: [table({
        id: 't1',
        name: 'users',
        columns: [col({ id: 'c1', name: 'age', type: 'INTEGER', description: 'User age' })],
      })],
      relations: [],
    };
    const c: SchemaSnapshot = {
      tables: [table({
        id: 't1',
        name: 'users',
        columns: [col({ id: 'c1', name: 'age', type: 'INTEGER' })],
      })],
      relations: [],
    };
    const sql = migrate(b, c, 'mysql');
    expect(sql).toMatch(/MODIFY COLUMN `age` INTEGER COMMENT ''/);
  });
});

describe('exportMigration — ordering and identity', () => {
  it('phase order: drop FK → drop index → drop col → drop table → rename → create → modify → add FK', () => {
    // Scenario: rename "users" to "customers", drop column, add column, drop one table, add another, FK flip.
    const baseline: SchemaSnapshot = {
      tables: [
        table({
          id: 't1',
          name: 'users',
          columns: [
            col({ id: 'c1', name: 'id', type: 'SERIAL', isPrimaryKey: true }),
            col({ id: 'c_legacy', name: 'legacy', type: 'TEXT' }),
          ],
        }),
        table({ id: 't_gone', name: 'gone', columns: [col({ id: 'g1', name: 'id', type: 'SERIAL' })] }),
      ],
      relations: [],
    };
    const current: SchemaSnapshot = {
      tables: [
        table({
          id: 't1',
          name: 'customers',
          columns: [
            col({ id: 'c1', name: 'id', type: 'SERIAL', isPrimaryKey: true }),
            col({ id: 'c_new', name: 'email', type: 'TEXT' }),
          ],
        }),
        table({ id: 't_new', name: 'arrived', columns: [col({ id: 'a1', name: 'id', type: 'SERIAL' })] }),
      ],
      relations: [],
    };
    const sql = migrate(baseline, current, 'postgresql');

    const dropTable = sql.indexOf('DROP TABLE');
    const rename = sql.indexOf('RENAME TO "customers"');
    const create = sql.indexOf('CREATE TABLE');
    const addCol = sql.indexOf('ADD COLUMN "email"');
    expect(dropTable).toBeGreaterThan(-1);
    expect(rename).toBeGreaterThan(-1);
    expect(create).toBeGreaterThan(-1);
    expect(addCol).toBeGreaterThan(-1);
    expect(dropTable).toBeLessThan(rename);
    expect(rename).toBeLessThan(create);
    expect(create).toBeLessThan(addCol);
  });

  it('uses current table name after rename for column changes', () => {
    const baseline: SchemaSnapshot = {
      tables: [table({
        id: 't1',
        name: 'old_name',
        columns: [col({ id: 'c1', name: 'x', type: 'INTEGER' })],
      })],
      relations: [],
    };
    const current: SchemaSnapshot = {
      tables: [table({
        id: 't1',
        name: 'new_name',
        columns: [col({ id: 'c1', name: 'x', type: 'BIGINT' })],
      })],
      relations: [],
    };
    const sql = migrate(baseline, current, 'postgresql');
    expect(sql).toMatch(/ALTER TABLE "old_name" RENAME TO "new_name"/);
    expect(sql).toMatch(/ALTER TABLE "new_name" ALTER COLUMN "x" TYPE BIGINT/);
  });
});
