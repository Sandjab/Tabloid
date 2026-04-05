import { describe, it, expect } from 'vitest';
import { parseSQL } from '@/utils/import-sql';

describe('parseSQL', () => {
  // 1. Basic CREATE TABLE with columns and types
  it('parses a basic CREATE TABLE with columns and types', () => {
    const sql = `
      CREATE TABLE users (
        id INTEGER,
        name VARCHAR(100),
        email TEXT
      );
    `;
    const result = parseSQL(sql);
    expect(result.tables).toHaveLength(1);
    expect(result.tables[0].name).toBe('users');
    expect(result.tables[0].columns).toHaveLength(3);
    expect(result.tables[0].columns[0].name).toBe('id');
    expect(result.tables[0].columns[0].type).toBe('INTEGER');
    expect(result.tables[0].columns[1].name).toBe('name');
    expect(result.tables[0].columns[1].type).toBe('TEXT'); // VARCHAR → TEXT
    expect(result.tables[0].columns[2].name).toBe('email');
    expect(result.tables[0].columns[2].type).toBe('TEXT');
    expect(result.name).toBe('Imported SQL');
  });

  // 2. PRIMARY KEY, NOT NULL, UNIQUE, DEFAULT constraints
  it('parses inline column constraints', () => {
    const sql = `
      CREATE TABLE products (
        id INTEGER PRIMARY KEY NOT NULL,
        sku TEXT UNIQUE NOT NULL,
        price DECIMAL(10,2) DEFAULT 0,
        description TEXT
      );
    `;
    const result = parseSQL(sql);
    const cols = result.tables[0].columns;

    expect(cols[0].isPrimaryKey).toBe(true);
    expect(cols[0].isNullable).toBe(false);

    expect(cols[1].isUnique).toBe(true);
    expect(cols[1].isNullable).toBe(false);

    expect(cols[2].defaultValue).toBe('0');
    expect(cols[2].type).toBe('DECIMAL');
    expect(cols[2].precision).toBe(10);
    expect(cols[2].scale).toBe(2);

    expect(cols[3].isNullable).toBe(true);
  });

  // 3. Table-level PRIMARY KEY(...)
  it('parses table-level PRIMARY KEY constraint', () => {
    const sql = `
      CREATE TABLE order_items (
        order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER,
        PRIMARY KEY (order_id, product_id)
      );
    `;
    const result = parseSQL(sql);
    const cols = result.tables[0].columns;
    expect(cols[0].isPrimaryKey).toBe(true);
    expect(cols[1].isPrimaryKey).toBe(true);
    expect(cols[2].isPrimaryKey).toBe(false);
  });

  // 4. Inline FOREIGN KEY REFERENCES → relation created
  it('creates a relation from inline REFERENCES', () => {
    const sql = `
      CREATE TABLE departments (
        id INTEGER PRIMARY KEY,
        name TEXT
      );
      CREATE TABLE employees (
        id INTEGER PRIMARY KEY,
        dept_id INTEGER REFERENCES departments(id),
        name TEXT
      );
    `;
    const result = parseSQL(sql);
    expect(result.tables).toHaveLength(2);
    expect(result.relations).toHaveLength(1);

    const rel = result.relations[0];
    expect(rel.sourceTableId).toBe(result.tables[1].id); // employees
    expect(rel.targetTableId).toBe(result.tables[0].id); // departments
    expect(rel.type).toBe('many-to-one');
  });

  // 5. ALTER TABLE ADD CONSTRAINT FOREIGN KEY → relation created
  it('creates a relation from ALTER TABLE FOREIGN KEY', () => {
    const sql = `
      CREATE TABLE authors (
        id INTEGER PRIMARY KEY,
        name TEXT
      );
      CREATE TABLE books (
        id INTEGER PRIMARY KEY,
        author_id INTEGER,
        title TEXT
      );
      ALTER TABLE books ADD CONSTRAINT fk_author FOREIGN KEY (author_id) REFERENCES authors(id);
    `;
    const result = parseSQL(sql);
    expect(result.tables).toHaveLength(2);
    expect(result.relations).toHaveLength(1);

    const rel = result.relations[0];
    const booksTable = result.tables.find((t) => t.name === 'books')!;
    const authorsTable = result.tables.find((t) => t.name === 'authors')!;
    expect(rel.sourceTableId).toBe(booksTable.id);
    expect(rel.targetTableId).toBe(authorsTable.id);
    expect(rel.type).toBe('many-to-one');
  });

  // 6. CREATE UNIQUE INDEX → index on table
  it('parses CREATE UNIQUE INDEX', () => {
    const sql = `
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        email TEXT,
        username TEXT
      );
      CREATE UNIQUE INDEX idx_users_email ON users(email);
      CREATE INDEX idx_users_username ON users(username);
    `;
    const result = parseSQL(sql);
    const table = result.tables[0];
    expect(table.indexes).toHaveLength(2);

    expect(table.indexes![0].name).toBe('idx_users_email');
    expect(table.indexes![0].isUnique).toBe(true);
    expect(table.indexes![0].columnIds).toHaveLength(1);
    expect(table.indexes![0].id).toBe('idx_1');

    expect(table.indexes![1].name).toBe('idx_users_username');
    expect(table.indexes![1].isUnique).toBe(false);
    expect(table.indexes![1].id).toBe('idx_2');
  });

  // 7. Reverse type mapping
  it('maps native SQL types to abstract ColumnType', () => {
    const sql = `
      CREATE TABLE type_test (
        a VARCHAR(255),
        b NVARCHAR(100),
        c BIGINT,
        d SMALLINT,
        e FLOAT,
        f DOUBLE PRECISION,
        g BOOLEAN,
        h TIMESTAMP,
        i DATETIME,
        j UUID,
        k BYTEA,
        l JSONB,
        m SERIAL
      );
    `;
    const result = parseSQL(sql);
    const cols = result.tables[0].columns;

    expect(cols[0].type).toBe('TEXT');       // VARCHAR
    expect(cols[1].type).toBe('TEXT');       // NVARCHAR
    expect(cols[2].type).toBe('BIGINT');     // BIGINT
    expect(cols[3].type).toBe('SMALLINT');   // SMALLINT
    expect(cols[4].type).toBe('FLOAT');      // FLOAT
    expect(cols[5].type).toBe('FLOAT');      // DOUBLE PRECISION
    expect(cols[6].type).toBe('BOOLEAN');    // BOOLEAN
    expect(cols[7].type).toBe('TIMESTAMP');  // TIMESTAMP
    expect(cols[8].type).toBe('TIMESTAMP');  // DATETIME
    expect(cols[9].type).toBe('UUID');       // UUID
    expect(cols[10].type).toBe('BLOB');      // BYTEA
    expect(cols[11].type).toBe('JSON');      // JSONB
    expect(cols[12].type).toBe('SERIAL');    // SERIAL
  });

  // 7b. TINYINT(1) → BOOLEAN
  it('maps TINYINT(1) to BOOLEAN', () => {
    const sql = `
      CREATE TABLE flags (
        is_active TINYINT(1)
      );
    `;
    const result = parseSQL(sql);
    expect(result.tables[0].columns[0].type).toBe('BOOLEAN');
  });

  // 8. Quoted identifiers
  it('handles double-quoted identifiers', () => {
    const sql = `
      CREATE TABLE "user" (
        "id" INTEGER PRIMARY KEY,
        "full name" TEXT
      );
    `;
    const result = parseSQL(sql);
    expect(result.tables[0].name).toBe('user');
    expect(result.tables[0].columns[0].name).toBe('id');
    expect(result.tables[0].columns[1].name).toBe('full name');
  });

  it('handles backtick-quoted identifiers', () => {
    const sql = 'CREATE TABLE `users` (`id` INTEGER PRIMARY KEY, `name` TEXT);';
    const result = parseSQL(sql);
    expect(result.tables[0].name).toBe('users');
    expect(result.tables[0].columns[0].name).toBe('id');
  });

  it('handles square-bracket identifiers', () => {
    const sql = 'CREATE TABLE [users] ([id] INTEGER PRIMARY KEY, [name] TEXT);';
    const result = parseSQL(sql);
    expect(result.tables[0].name).toBe('users');
    expect(result.tables[0].columns[0].name).toBe('id');
  });

  // 9. Comments stripped
  it('strips line comments and block comments', () => {
    const sql = `
      -- This is a comment
      CREATE TABLE test (
        id INTEGER, -- inline comment
        /* block
           comment */
        name TEXT
      );
    `;
    const result = parseSQL(sql);
    expect(result.tables).toHaveLength(1);
    expect(result.tables[0].columns).toHaveLength(2);
    expect(result.tables[0].columns[0].name).toBe('id');
    expect(result.tables[0].columns[1].name).toBe('name');
  });

  // 10. Empty input → empty result
  it('returns empty result for empty input', () => {
    expect(parseSQL('')).toEqual({ tables: [], relations: [], name: 'Imported SQL' });
    expect(parseSQL('   ')).toEqual({ tables: [], relations: [], name: 'Imported SQL' });
  });

  // 11. AUTO_INCREMENT / IDENTITY → SERIAL
  it('maps AUTO_INCREMENT column to SERIAL', () => {
    const sql = `
      CREATE TABLE items (
        id INTEGER AUTO_INCREMENT PRIMARY KEY
      );
    `;
    const result = parseSQL(sql);
    expect(result.tables[0].columns[0].type).toBe('SERIAL');
  });

  it('maps IDENTITY column to SERIAL', () => {
    const sql = `
      CREATE TABLE items (
        id INTEGER IDENTITY PRIMARY KEY
      );
    `;
    const result = parseSQL(sql);
    expect(result.tables[0].columns[0].type).toBe('SERIAL');
  });

  it('maps GENERATED ALWAYS AS IDENTITY to SERIAL', () => {
    const sql = `
      CREATE TABLE items (
        id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY
      );
    `;
    const result = parseSQL(sql);
    expect(result.tables[0].columns[0].type).toBe('SERIAL');
  });

  // 12. DECIMAL with precision/scale
  it('extracts precision and scale from DECIMAL(p,s)', () => {
    const sql = `
      CREATE TABLE accounts (
        balance DECIMAL(18,4)
      );
    `;
    const result = parseSQL(sql);
    const col = result.tables[0].columns[0];
    expect(col.type).toBe('DECIMAL');
    expect(col.precision).toBe(18);
    expect(col.scale).toBe(4);
  });

  it('extracts precision only from NUMERIC(p)', () => {
    const sql = `
      CREATE TABLE stats (
        value NUMERIC(10)
      );
    `;
    const result = parseSQL(sql);
    const col = result.tables[0].columns[0];
    expect(col.type).toBe('DECIMAL');
    expect(col.precision).toBe(10);
    expect(col.scale).toBeUndefined();
  });

  // Additional edge cases
  it('handles IF NOT EXISTS', () => {
    const sql = `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY
      );
    `;
    const result = parseSQL(sql);
    expect(result.tables).toHaveLength(1);
    expect(result.tables[0].name).toBe('users');
  });

  it('ignores non-DDL statements', () => {
    const sql = `
      DROP TABLE IF EXISTS old_table;
      INSERT INTO users VALUES (1, 'test');
      CREATE TABLE actual (id INTEGER);
      CREATE VIEW v AS SELECT * FROM actual;
    `;
    const result = parseSQL(sql);
    expect(result.tables).toHaveLength(1);
    expect(result.tables[0].name).toBe('actual');
  });

  it('lays out tables in a grid', () => {
    const sql = `
      CREATE TABLE t1 (id INTEGER);
      CREATE TABLE t2 (id INTEGER);
      CREATE TABLE t3 (id INTEGER);
      CREATE TABLE t4 (id INTEGER);
      CREATE TABLE t5 (id INTEGER);
    `;
    const result = parseSQL(sql);
    expect(result.tables[0].position).toEqual({ x: 0, y: 0 });
    expect(result.tables[1].position).toEqual({ x: 300, y: 0 });
    expect(result.tables[2].position).toEqual({ x: 600, y: 0 });
    expect(result.tables[3].position).toEqual({ x: 900, y: 0 });
    expect(result.tables[4].position).toEqual({ x: 0, y: 300 });   // wraps to next row
  });

  it('handles table-level FOREIGN KEY constraint', () => {
    const sql = `
      CREATE TABLE parents (
        id INTEGER PRIMARY KEY
      );
      CREATE TABLE children (
        id INTEGER PRIMARY KEY,
        parent_id INTEGER,
        FOREIGN KEY (parent_id) REFERENCES parents(id)
      );
    `;
    const result = parseSQL(sql);
    expect(result.relations).toHaveLength(1);
    const rel = result.relations[0];
    const children = result.tables.find((t) => t.name === 'children')!;
    const parents = result.tables.find((t) => t.name === 'parents')!;
    expect(rel.sourceTableId).toBe(children.id);
    expect(rel.targetTableId).toBe(parents.id);
  });

  it('handles DEFAULT with quoted string', () => {
    const sql = `
      CREATE TABLE settings (
        key TEXT,
        value TEXT DEFAULT 'N/A'
      );
    `;
    const result = parseSQL(sql);
    expect(result.tables[0].columns[1].defaultValue).toBe('N/A');
  });

  it('maps unknown types to TEXT', () => {
    const sql = `
      CREATE TABLE exotic (
        data SOMECUSTOMTYPE
      );
    `;
    const result = parseSQL(sql);
    expect(result.tables[0].columns[0].type).toBe('TEXT');
  });

  it('handles multi-column index', () => {
    const sql = `
      CREATE TABLE events (
        id INTEGER PRIMARY KEY,
        date DATE,
        type TEXT
      );
      CREATE INDEX idx_events_date_type ON events(date, type);
    `;
    const result = parseSQL(sql);
    const idx = result.tables[0].indexes![0];
    expect(idx.columnIds).toHaveLength(2);
  });

  it('handles multiple tables with inter-table relations via ALTER', () => {
    const sql = `
      CREATE TABLE customers (
        id INTEGER PRIMARY KEY,
        name TEXT
      );
      CREATE TABLE orders (
        id INTEGER PRIMARY KEY,
        customer_id INTEGER,
        total DECIMAL(10,2)
      );
      CREATE TABLE order_items (
        id INTEGER PRIMARY KEY,
        order_id INTEGER,
        product TEXT
      );
      ALTER TABLE orders ADD CONSTRAINT fk_cust FOREIGN KEY (customer_id) REFERENCES customers(id);
      ALTER TABLE order_items ADD CONSTRAINT fk_order FOREIGN KEY (order_id) REFERENCES orders(id);
    `;
    const result = parseSQL(sql);
    expect(result.tables).toHaveLength(3);
    expect(result.relations).toHaveLength(2);
  });
});
