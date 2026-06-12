import { describe, it, expect, beforeAll } from 'vitest';
import initSqlJs, { type SqlJsStatic } from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';

describe('SQLite Integration', () => {
  let SQL: SqlJsStatic;

  beforeAll(async () => {
    // In node, sql.js requires the wasm binary to be passed or read correctly.
    const wasmPath = path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
    const wasmBinary = fs.readFileSync(wasmPath);

    SQL = await initSqlJs({
      wasmBinary,
    });
  });

  it('should initialize and perform basic CRUD operations', () => {
    const db = new SQL.Database();
    
    // Create
    db.run("CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, active BOOLEAN);");
    
    // Insert
    db.run("INSERT INTO users (username, active) VALUES ('alice', 1), ('bob', 0);");
    
    // Read
    const res = db.exec("SELECT * FROM users;");
    expect(res).toBeDefined();
    expect(res.length).toBe(1);
    expect(res[0].columns).toEqual(['id', 'username', 'active']);
    expect(res[0].values).toEqual([
      [1, 'alice', 1],
      [2, 'bob', 0]
    ]);

    // Update
    db.run("UPDATE users SET active = 1 WHERE username = 'bob';");
    const updateRes = db.exec("SELECT active FROM users WHERE username = 'bob';");
    expect(updateRes[0].values[0][0]).toBe(1);

    // Delete
    db.run("DELETE FROM users WHERE username = 'alice';");
    const countRes = db.exec("SELECT COUNT(*) FROM users;");
    expect(countRes[0].values[0][0]).toBe(1);

    db.close();
  });

  it('should throw errors for invalid SQL syntax', () => {
    const db = new SQL.Database();
    
    expect(() => {
      db.run("CREATE TABL test (id int);"); // Typo in TABLE
    }).toThrow(/syntax error/i);

    expect(() => {
      db.exec("SELECT * FROM non_existent_table;");
    }).toThrow(/no such table/i);

    db.close();
  });

  it('should support exporting and importing databases', () => {
    const db1 = new SQL.Database();
    db1.run("CREATE TABLE settings (key TEXT, value TEXT);");
    db1.run("INSERT INTO settings VALUES ('theme', 'dark');");
    
    // Export DB
    const binaryArray = db1.export();
    expect(binaryArray).toBeInstanceOf(Uint8Array);
    db1.close();

    // Import DB
    const db2 = new SQL.Database(binaryArray);
    const res = db2.exec("SELECT value FROM settings WHERE key = 'theme';");
    expect(res[0].values[0][0]).toBe('dark');
    
    db2.close();
  });

  it('should handle complex queries like JOINs and aggregations', () => {
    const db = new SQL.Database();
    
    db.run(`
      CREATE TABLE departments (id INTEGER PRIMARY KEY, name TEXT);
      CREATE TABLE employees (id INTEGER PRIMARY KEY, name TEXT, dept_id INTEGER);
      
      INSERT INTO departments (name) VALUES ('Engineering'), ('Sales');
      INSERT INTO employees (name, dept_id) VALUES 
        ('Alice', 1), 
        ('Bob', 1), 
        ('Charlie', 2), 
        ('Dave', NULL);
    `);

    // INNER JOIN and GROUP BY
    const res = db.exec(`
      SELECT d.name, COUNT(e.id) as emp_count
      FROM departments d
      LEFT JOIN employees e ON d.id = e.dept_id
      GROUP BY d.id
      ORDER BY emp_count DESC;
    `);

    expect(res[0].columns).toEqual(['name', 'emp_count']);
    expect(res[0].values).toEqual([
      ['Engineering', 2],
      ['Sales', 1]
    ]);

    db.close();
  });

  it('should support schema querying from sqlite_master', () => {
    const db = new SQL.Database();
    db.run("CREATE TABLE records (id int, data blob);");
    db.run("CREATE INDEX idx_records_id ON records(id);");

    const schemaRes = db.exec("SELECT type, name FROM sqlite_master ORDER BY name;");
    
    // Should list both the table and the index
    expect(schemaRes[0].values).toEqual([
      ['index', 'idx_records_id'],
      ['table', 'records']
    ]);
    
    db.close();
  });
});
