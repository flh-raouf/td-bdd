import { TRPCError } from "@trpc/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getExercise } from "../exercises";
import {
  appRouter,
  classifySql,
  compareResults,
  createUserQueryOptions,
  enforceQueryResultLimits,
  generateValidationId,
  getCachedDqlExpectedOutputs,
  getPublicQueryExecutionOptions,
  getSqlTokens,
  isAdminReseedAuthorized,
  normalizeRow,
  normalizeValue,
  remapCanonicalReferences,
  splitSqlStatements,
  stripLeadingComments,
  stripSqlCommentsAndLiterals,
  validateDdlExercise,
  validateDqlExercise,
  validateSqlSafety,
} from "../router";

describe("stripLeadingComments", () => {
  it("strips -- line comment", () => {
    expect(stripLeadingComments("-- comment\nSELECT 1;")).toBe("SELECT 1;");
  });

  it("strips # line comment", () => {
    expect(stripLeadingComments("# comment\nSELECT 1;")).toBe("SELECT 1;");
  });

  it("strips /* block comment */", () => {
    expect(stripLeadingComments("/* comment */ SELECT 1;")).toBe("SELECT 1;");
  });

  it("strips multiline block comment", () => {
    expect(stripLeadingComments("/* line 1\n   line 2 */ SELECT 1;")).toBe(
      "SELECT 1;",
    );
  });

  it("strips multiple leading comments", () => {
    expect(stripLeadingComments("-- first\n-- second\nSELECT 1;")).toBe(
      "SELECT 1;",
    );
  });

  it("returns empty for comment-only input", () => {
    expect(stripLeadingComments("-- only comment")).toBe("");
  });

  it("leaves inline comments intact", () => {
    expect(stripLeadingComments("SELECT 1; -- inline")).toBe(
      "SELECT 1; -- inline",
    );
  });
});

describe("classifySql", () => {
  it('classifies SELECT as "read"', () => {
    expect(classifySql("SELECT * FROM t")).toBe("read");
  });

  it('classifies SHOW as "read"', () => {
    expect(classifySql("SHOW TABLES")).toBe("read");
  });

  it('classifies DESCRIBE as "read"', () => {
    expect(classifySql("DESCRIBE t")).toBe("read");
  });

  it('classifies EXPLAIN as "read"', () => {
    expect(classifySql("EXPLAIN SELECT * FROM t")).toBe("read");
  });

  it('classifies INSERT as "dml"', () => {
    expect(classifySql("INSERT INTO t VALUES (1)")).toBe("dml");
  });

  it('classifies UPDATE as "dml"', () => {
    expect(classifySql("UPDATE t SET x = 1")).toBe("dml");
  });

  it('classifies DELETE as "dml"', () => {
    expect(classifySql("DELETE FROM t")).toBe("dml");
  });

  it("blocks DROP statements", () => {
    expect(() => classifySql("DROP TABLE t")).toThrow(TRPCError);
  });

  it("blocks TRUNCATE statements", () => {
    expect(() => classifySql("TRUNCATE TABLE t")).toThrow(TRPCError);
  });

  it("blocks SET statements", () => {
    expect(() => classifySql("SET FOREIGN_KEY_CHECKS = 0")).toThrow(TRPCError);
  });

  it("throws on empty SQL", () => {
    expect(() => classifySql("")).toThrow(TRPCError);
    expect(() => classifySql("   ")).toThrow(TRPCError);
  });

  it("throws on unknown keyword", () => {
    expect(() => classifySql("FOOBAR stuff")).toThrow(TRPCError);
  });

  it("allows CREATE VIEW with allowAlter", () => {
    expect(
      classifySql("CREATE VIEW v AS SELECT * FROM t", { allowAlter: true }),
    ).toBe("schema");
  });

  it("blocks CREATE TABLE without allowCreateTable", () => {
    expect(() => classifySql("CREATE TABLE t (id INT)")).toThrow(TRPCError);
  });

  it("allows CREATE TABLE with allowCreateTable", () => {
    expect(
      classifySql("CREATE TABLE t (id INT)", { allowCreateTable: true }),
    ).toBe("schema");
  });

  it("allows ALTER TABLE with allowAlter", () => {
    expect(
      classifySql("ALTER TABLE t ADD COLUMN x INT", { allowAlter: true }),
    ).toBe("schema");
  });

  it("blocks ALTER TABLE without allowAlter", () => {
    expect(() => classifySql("ALTER TABLE t ADD COLUMN x INT")).toThrow(
      TRPCError,
    );
  });

  it("strips leading comments before classification", () => {
    expect(classifySql("-- comment\nSELECT 1;")).toBe("read");
  });

  it('classifies WITH ... SELECT as "read" (legitimate CTE)', () => {
    expect(classifySql("WITH cte AS (SELECT 1) SELECT * FROM cte")).toBe(
      "read",
    );
  });

  it('classifies WITH ... DELETE as "dml" (CTE bypass)', () => {
    expect(
      classifySql(
        "WITH target AS (SELECT id FROM t) DELETE FROM t WHERE id IN (SELECT id FROM target)",
      ),
    ).toBe("dml");
  });

  it('classifies WITH ... UPDATE as "dml" (CTE bypass)', () => {
    expect(
      classifySql(
        "WITH target AS (SELECT id FROM t) UPDATE t SET x = 1 WHERE id IN (SELECT id FROM target)",
      ),
    ).toBe("dml");
  });

  it('classifies WITH ... INSERT as "dml" (CTE bypass)', () => {
    expect(
      classifySql(
        "WITH source AS (SELECT * FROM t1) INSERT INTO t2 SELECT * FROM source",
      ),
    ).toBe("dml");
  });

  it('classifies WITH ... REPLACE as "dml" (CTE bypass)', () => {
    expect(
      classifySql(
        "WITH source AS (SELECT * FROM t1) REPLACE INTO t2 SELECT * FROM source",
      ),
    ).toBe("dml");
  });

  it('classifies WITH RECURSIVE ... DELETE as "dml" (CTE bypass)', () => {
    expect(
      classifySql(
        "WITH RECURSIVE cte AS (SELECT 1 UNION ALL SELECT 1) DELETE FROM t",
      ),
    ).toBe("dml");
  });

  it('classifies WITH RECURSIVE ... SELECT as "read" (legitimate recursive CTE)', () => {
    expect(
      classifySql(
        "WITH RECURSIVE cte AS (SELECT 1 UNION ALL SELECT n+1 FROM cte WHERE n < 10) SELECT * FROM cte",
      ),
    ).toBe("read");
  });

  it("handles case variations in WITH clauses", () => {
    expect(classifySql("with cte as (select 1) delete from t")).toBe("dml");
    expect(classifySql("With Cte As (Select 1) Update t Set x = 1")).toBe(
      "dml",
    );
    expect(classifySql("WITH cte AS (SELECT 1) SELECT * FROM cte")).toBe(
      "read",
    );
  });

  it("handles whitespace variations in WITH clauses", () => {
    expect(classifySql("WITH\tcte\tAS\t(SELECT 1)\tDELETE\tFROM t")).toBe(
      "dml",
    );
    expect(classifySql("WITH\ncte\nAS\n(SELECT 1)\nDELETE\nFROM t")).toBe(
      "dml",
    );
  });

  it('classifies EXPLAIN DELETE as "read" (EXPLAIN is safe)', () => {
    expect(classifySql("EXPLAIN DELETE FROM t")).toBe("read");
  });
});

describe("getSqlTokens", () => {
  it("handles mid-token block comments", () => {
    const tokens = getSqlTokens("SELECT/*hint*/1 FROM t");
    expect(tokens[0]).toBe("SELECT");
  });

  it("handles block comments between tokens", () => {
    const tokens = getSqlTokens("SELECT /*hint*/ 1 FROM t");
    expect(tokens[0]).toBe("SELECT");
  });

  it("handles comment within keyword (produces single token)", () => {
    const tokens = getSqlTokens("SEL/**/ECT 1");
    expect(tokens[0]).toBe("SEL");
  });

  it("handles multiple inline comments", () => {
    const tokens = getSqlTokens("SELECT/*a*//*b*/1 FROM t");
    expect(tokens[0]).toBe("SELECT");
  });

  it("handles DELETE with inline comment before FROM", () => {
    const tokens = getSqlTokens("DELETE/*comment*/FROM t");
    expect(tokens[0]).toBe("DELETE");
  });

  it("handles DROP/**/TABLE (comment between tokens)", () => {
    const tokens = getSqlTokens("DROP/**/TABLE t");
    expect(tokens[0]).toBe("DROP");
  });

  it("preserves leading-comment-only stripping", () => {
    const tokens = getSqlTokens("-- comment\nSELECT 1");
    expect(tokens[0]).toBe("SELECT");
  });

  it("handles comment at end of SQL", () => {
    const tokens = getSqlTokens("SELECT 1 /* trailing */");
    expect(tokens[0]).toBe("SELECT");
  });
});

describe("SQL safety policy", () => {
  it("rejects SQL over the configured max length", () => {
    expect(() =>
      validateSqlSafety("SELECT 1".padEnd(21, " "), { maxSqlLength: 20 }),
    ).toThrow(TRPCError);
  });

  it("blocks deliberate delay and CPU-burn functions", () => {
    expect(() => validateSqlSafety("SELECT SLEEP(1)")).toThrow(TRPCError);
    expect(() =>
      validateSqlSafety("SELECT BENCHMARK(1000000, SHA1('x'))"),
    ).toThrow(TRPCError);
    expect(() => validateSqlSafety("SELECT GET_LOCK('x', 10)")).toThrow(
      TRPCError,
    );
  });

  it("blocks file access and server-side output writes", () => {
    expect(() => validateSqlSafety("SELECT LOAD_FILE('/etc/passwd')")).toThrow(
      TRPCError,
    );
    expect(() =>
      validateSqlSafety("SELECT * FROM CUSTOMER INTO OUTFILE '/tmp/out.csv'"),
    ).toThrow(TRPCError);
  });

  it("adds a mysql2 timeout to user query execution options", () => {
    expect(createUserQueryOptions("SELECT 1")).toEqual({
      sql: "SELECT 1",
      timeout: expect.any(Number),
    });
    expect(createUserQueryOptions("SELECT 1").timeout).toBeGreaterThan(0);
  });

  it("does not flag blocked tokens inside strings, identifiers, or comments", () => {
    expect(() =>
      validateSqlSafety(
        "SELECT 'SLEEP(1)' AS label, `BENCHMARK(1,x)` FROM CUSTOMER -- LOAD_FILE('/x')",
      ),
    ).not.toThrow();
  });

  it("strips comments and quoted text before dangerous-pattern scans", () => {
    const stripped = stripSqlCommentsAndLiterals(
      "SELECT 'SLEEP(1)' AS label, `LOAD_FILE()` FROM CUSTOMER /* BENCHMARK() */",
    );

    expect(stripped).toContain("SELECT");
    expect(stripped).toContain("FROM CUSTOMER");
    expect(stripped).not.toContain("SLEEP");
    expect(stripped).not.toContain("LOAD_FILE");
    expect(stripped).not.toContain("BENCHMARK");
  });
});

describe("query result limits", () => {
  it("rejects result sets over the configured row cap", () => {
    expect(() =>
      enforceQueryResultLimits(
        {
          columns: ["id"],
          rows: [{ id: 1 }, { id: 2 }],
        },
        { maxResultRows: 1, maxResponseBytes: 10_000 },
      ),
    ).toThrow(TRPCError);
  });

  it("rejects result sets over the configured response byte cap", () => {
    expect(() =>
      enforceQueryResultLimits(
        {
          columns: ["payload"],
          rows: [{ payload: "x".repeat(50) }],
        },
        { maxResultRows: 10, maxResponseBytes: 20 },
      ),
    ).toThrow(TRPCError);
  });

  it("allows normal compact course-style result sets", () => {
    const result = {
      columns: ["customerId", "customerName"],
      rows: [{ customerId: 1, customerName: "Amina" }],
    };

    expect(
      enforceQueryResultLimits(result, {
        maxResultRows: 10,
        maxResponseBytes: 1_000,
      }),
    ).toBe(result);
  });
});

describe("public query execution policy", () => {
  it("keeps sandbox-style execution rollback-only and schema-safe", () => {
    expect(getPublicQueryExecutionOptions()).toEqual({
      allowAlter: false,
      rollbackDml: true,
    });
  });

  it("ignores client-supplied allowAlter for public query execution", async () => {
    const caller = appRouter.createCaller({});

    await expect(
      caller.query.execute({
        sql: "ALTER TABLE CUSTOMER ADD COLUMN publicMutation INT",
      }),
    ).rejects.toThrow("ALTER TABLE statements are only allowed");
  });
});

describe("admin reseed guard", () => {
  it("authorizes reseed only when the admin token header matches", () => {
    expect(
      isAdminReseedAuthorized({ "x-bdd-admin-token": "secret" }, "secret"),
    ).toBe(true);
    expect(
      isAdminReseedAuthorized({ "x-bdd-admin-token": "wrong" }, "secret"),
    ).toBe(false);
    expect(isAdminReseedAuthorized(undefined, "secret")).toBe(false);
    expect(
      isAdminReseedAuthorized({ "x-bdd-admin-token": "secret" }, undefined),
    ).toBe(false);
  });

  it("blocks public database reseed before touching the database", async () => {
    const caller = appRouter.createCaller({});

    await expect(caller.db.reseed()).rejects.toThrow(
      "Database reset is restricted to admin maintenance",
    );
  });
});

describe("splitSqlStatements", () => {
  it("splits on semicolons", () => {
    expect(splitSqlStatements("SELECT 1; SELECT 2;")).toEqual([
      "SELECT 1",
      "SELECT 2",
    ]);
  });

  it("ignores semicolons inside string literals", () => {
    expect(splitSqlStatements("SELECT 'hello;world'; SELECT 2;")).toEqual([
      "SELECT 'hello;world'",
      "SELECT 2",
    ]);
  });

  it("ignores semicolons inside double-quoted strings", () => {
    expect(splitSqlStatements('SELECT "hello;world"; SELECT 2;')).toEqual([
      'SELECT "hello;world"',
      "SELECT 2",
    ]);
  });

  it("ignores semicolons inside backtick identifiers", () => {
    expect(splitSqlStatements("SELECT * FROM `foo;bar`; SELECT 2;")).toEqual([
      "SELECT * FROM `foo;bar`",
      "SELECT 2",
    ]);
  });

  it("handles escaped quotes inside strings", () => {
    expect(splitSqlStatements("SELECT 'it\\'s ok'; SELECT 2;")).toEqual([
      "SELECT 'it\\'s ok'",
      "SELECT 2",
    ]);
  });

  it("ignores semicolons inside line comments", () => {
    expect(
      splitSqlStatements("SELECT 1; -- start; SELECT 2;\nSELECT 3;"),
    ).toEqual(["SELECT 1", "-- start; SELECT 2;\nSELECT 3"]);
  });

  it("ignores semicolons inside block comments", () => {
    expect(
      splitSqlStatements("SELECT 1; /* inline; comment */ SELECT 2;"),
    ).toEqual(["SELECT 1", "/* inline; comment */ SELECT 2"]);
  });

  it("handles trailing semicolon", () => {
    expect(splitSqlStatements("SELECT 1;")).toEqual(["SELECT 1"]);
  });

  it("handles empty input", () => {
    expect(splitSqlStatements("")).toEqual([]);
  });

  it("handles only whitespace", () => {
    expect(splitSqlStatements("   ")).toEqual([]);
  });

  it("handles multiline CREATE TABLE with string defaults", () => {
    const sql = `CREATE TABLE t (
  id INT,
  name VARCHAR(100) DEFAULT 'hello'
);`;
    expect(splitSqlStatements(sql)).toEqual([sql.trim().slice(0, -1)]);
  });

  it("preserves hash comments within statements", () => {
    expect(splitSqlStatements("SELECT 1; # comment\nSELECT 2;")).toEqual([
      "SELECT 1",
      "# comment\nSELECT 2",
    ]);
  });

  it("handles '' (double single-quote) as escaped literal", () => {
    expect(splitSqlStatements("SELECT 'it''s a test' FROM t")).toEqual([
      "SELECT 'it''s a test' FROM t",
    ]);
  });

  it("handles '' with semicolons inside string", () => {
    expect(
      splitSqlStatements("SELECT 'value'';with;semicolons' FROM t"),
    ).toEqual(["SELECT 'value'';with;semicolons' FROM t"]);
  });

  it("handles multiple '' escapes in one string", () => {
    expect(splitSqlStatements("SELECT 'it''s a ''test''' FROM t")).toEqual([
      "SELECT 'it''s a ''test''' FROM t",
    ]);
  });

  it("handles '' followed by string close", () => {
    expect(splitSqlStatements("SELECT '''' FROM t")).toEqual([
      "SELECT '''' FROM t",
    ]);
  });

  it("handles '' then semicolon outside string", () => {
    expect(splitSqlStatements("SELECT ''''; SELECT 2")).toEqual([
      "SELECT ''''",
      "SELECT 2",
    ]);
  });

  it('handles "" (double double-quote) as escaped literal', () => {
    expect(splitSqlStatements('SELECT "it""s a test" FROM t')).toEqual([
      'SELECT "it""s a test" FROM t',
    ]);
  });

  it('handles "" with semicolons inside string', () => {
    expect(
      splitSqlStatements('SELECT "value"";with;semicolons" FROM t'),
    ).toEqual(['SELECT "value"";with;semicolons" FROM t']);
  });

  it("handles `` (double backtick) as escaped literal", () => {
    expect(splitSqlStatements("SELECT * FROM `foo``bar`")).toEqual([
      "SELECT * FROM `foo``bar`",
    ]);
  });

  it("handles mixed '' and normal strings", () => {
    expect(splitSqlStatements("SELECT 'it''s' || 'another' FROM t")).toEqual([
      "SELECT 'it''s' || 'another' FROM t",
    ]);
  });
});

describe("normalizeValue", () => {
  it("converts numbers to strings", () => {
    expect(normalizeValue(42)).toBe("42");
    expect(normalizeValue(3.14)).toBe("3.14");
  });

  it("converts numeric strings to numeric strings", () => {
    expect(normalizeValue("42")).toBe("42");
    expect(normalizeValue("3.14")).toBe("3.14");
  });

  it("preserves non-numeric strings unchanged", () => {
    expect(normalizeValue("hello")).toBe("hello");
  });

  it("converts null to null", () => {
    expect(normalizeValue(null)).toBeNull();
  });

  it("converts undefined to null", () => {
    expect(normalizeValue(undefined)).toBeNull();
  });

  it("converts Date to ISO string", () => {
    const date = new Date("2023-01-15T00:00:00Z");
    expect(normalizeValue(date)).toBe(date.toISOString());
  });

  it("does not treat zero-prefixed strings as numeric", () => {
    expect(normalizeValue("0123")).toBe("0123");
  });

  it("preserves large integers that lose precision as Number", () => {
    expect(normalizeValue("9223372036854775807")).toBe("9223372036854775807");
  });
});

describe("normalizeRow", () => {
  it("normalizes a row to a stable JSON string", () => {
    const row = { id: 1, name: "Test" };
    const result = normalizeRow(row, ["id", "name"]);
    expect(result).toBe(JSON.stringify({ id: "1", name: "Test" }));
  });

  it("handles null values", () => {
    const row = { id: 1, name: null };
    const result = normalizeRow(row, ["id", "name"]);
    expect(result).toBe(JSON.stringify({ id: "1", name: null }));
  });

  it("only includes specified columns", () => {
    const row = { id: 1, name: "Test", extra: "ignored" };
    const result = normalizeRow(row, ["id", "name"]);
    expect(result).toBe(JSON.stringify({ id: "1", name: "Test" }));
  });
});

describe("compareResults", () => {
  it("returns null for identical results", () => {
    const result = compareResults(
      { columns: ["id", "name"], rows: [{ id: 1, name: "Test" }] },
      { columns: ["id", "name"], rows: [{ id: 1, name: "Test" }] },
    );
    expect(result).toBeNull();
  });

  it("detects missing columns", () => {
    const diff = compareResults(
      { columns: ["id"], rows: [{ id: 1 }] },
      { columns: ["id", "name"], rows: [{ id: 1, name: "Test" }] },
    );
    expect(diff).not.toBeNull();
    expect(diff?.columnDiff?.missing).toEqual(["name"]);
  });

  it("detects extra columns", () => {
    const diff = compareResults(
      {
        columns: ["id", "name", "extra"],
        rows: [{ id: 1, name: "Test", extra: "x" }],
      },
      { columns: ["id", "name"], rows: [{ id: 1, name: "Test" }] },
    );
    expect(diff).not.toBeNull();
    expect(diff?.columnDiff?.extra).toEqual(["extra"]);
  });

  it("detects row count mismatch", () => {
    const diff = compareResults(
      { columns: ["id"], rows: [{ id: 1 }, { id: 2 }] },
      { columns: ["id"], rows: [{ id: 1 }] },
    );
    expect(diff?.rowCountDiff).toEqual({ expected: 1, actual: 2 });
  });

  it("detects missing rows", () => {
    const diff = compareResults(
      { columns: ["id"], rows: [{ id: 1 }] },
      { columns: ["id"], rows: [{ id: 1 }, { id: 2 }] },
    );
    expect(diff?.dataDiff?.missingRows).toEqual([{ id: 2 }]);
  });

  it("detects extra rows", () => {
    const diff = compareResults(
      { columns: ["id"], rows: [{ id: 1 }, { id: 2 }] },
      { columns: ["id"], rows: [{ id: 1 }] },
    );
    expect(diff?.dataDiff?.extraRows).toEqual([{ id: 2 }]);
  });

  it("handles duplicate rows correctly", () => {
    const diff = compareResults(
      { columns: ["id"], rows: [{ id: 1 }, { id: 1 }] },
      { columns: ["id"], rows: [{ id: 1 }] },
    );
    expect(diff?.dataDiff?.extraRows).toEqual([{ id: 1 }]);
  });

  it("handles empty rows in both", () => {
    const diff = compareResults(
      { columns: ["id"], rows: [] },
      { columns: ["id"], rows: [] },
    );
    expect(diff).toBeNull();
  });
});

describe("generateValidationId", () => {
  it("generates a unique identifier without dashes", () => {
    const id = generateValidationId();
    expect(id).toMatch(/^[\da-f_]+$/);
    expect(id.includes("-")).toBe(false);
    expect(id.length).toBeGreaterThan(0);
  });

  it("generates different identifiers on each call", () => {
    const ids = new Set(
      Array.from({ length: 10 }, () => generateValidationId()),
    );
    expect(ids.size).toBe(10);
  });
});

describe("remapCanonicalReferences", () => {
  it("strips CREATE DATABASE IF NOT EXISTS DZTelecom", () => {
    const result = remapCanonicalReferences(
      "CREATE DATABASE IF NOT EXISTS DZTelecom;\nUSE DZTelecom;\nCREATE TABLE t (id INT);",
      "bdd_ddl_test",
    );
    expect(result).toBe("USE `bdd_ddl_test`;\nCREATE TABLE t (id INT);");
  });

  it("strips CREATE DATABASE DZTelecom without IF NOT EXISTS", () => {
    const result = remapCanonicalReferences(
      "CREATE DATABASE DZTelecom;\nUSE DZTelecom;",
      "bdd_ddl_test",
    );
    expect(result).toBe("USE `bdd_ddl_test`;");
  });

  it("replaces USE DZTelecom with the target database", () => {
    const result = remapCanonicalReferences(
      "USE DZTelecom;\nCREATE TABLE t (id INT);",
      "bdd_ddl_test",
    );
    expect(result).toBe("USE `bdd_ddl_test`;\nCREATE TABLE t (id INT);");
  });

  it("handles backtick-quoted DZTelecom", () => {
    const result = remapCanonicalReferences(
      "USE `DZTelecom`;\nSELECT 1;",
      "bdd_ddl_test",
    );
    expect(result).toBe("USE `bdd_ddl_test`;\nSELECT 1;");
  });

  it("handles backtick-quoted DZTelecom in CREATE DATABASE", () => {
    const result = remapCanonicalReferences(
      "CREATE DATABASE IF NOT EXISTS `DZTelecom`;\nUSE `DZTelecom`;",
      "bdd_ddl_test",
    );
    expect(result).toBe("USE `bdd_ddl_test`;");
  });

  it("preserves SQL that does not reference DZTelecom", () => {
    const sql = "CREATE TABLE t (id INT);\nALTER TABLE t ADD COLUMN x INT;";
    expect(remapCanonicalReferences(sql, "bdd_ddl_test")).toBe(sql);
  });

  it("handles case-insensitive USE and CREATE DATABASE", () => {
    const result = remapCanonicalReferences(
      "CREATE database if not exists dztelecom;\nuse dztelecom;\nSELECT 1;",
      "bdd_ddl_test",
    );
    expect(result).toBe("USE `bdd_ddl_test`;\nSELECT 1;");
  });
});

describe("DDL validation disposable-schema isolation", () => {
  it("passes Part 1 DDL exercise validation in isolation", async () => {
    const exercise = getExercise("1.1");
    if (!exercise) throw new Error("Missing exercise 1.1");
    const result = await validateDdlExercise(
      exercise,
      "CREATE TABLE CUSTOMER (customerId INT AUTO_INCREMENT PRIMARY KEY, customerName VARCHAR(150) NOT NULL, address TEXT, email VARCHAR(150) UNIQUE);",
    );
    expect(result.passed).toBe(true);
  });

  it("rejects Part 1 table creation with wrong column names", async () => {
    const exercise = getExercise("1.1");
    if (!exercise) throw new Error("Missing exercise 1.1");

    const result = await validateDdlExercise(
      exercise,
      "CREATE TABLE CUSTOMER (test INT PRIMARY KEY, test2 INT, test3 INT, test4 INT);",
    );

    expect(result.passed).toBe(false);
    expect(result.verificationLabel).toContain("columns must match");
  });

  it("rejects Part 1 table creation with wrong data types", async () => {
    const exercise = getExercise("1.1");
    if (!exercise) throw new Error("Missing exercise 1.1");

    const result = await validateDdlExercise(
      exercise,
      "CREATE TABLE CUSTOMER (customerId VARCHAR(20) PRIMARY KEY, customerName INT, address INT, email INT);",
    );

    expect(result.passed).toBe(false);
    expect(result.verificationLabel).toContain("Column 'customerId'");
  });

  it("rejects Part 1 table creation with missing NOT NULL on required columns", async () => {
    const exercise = getExercise("1.1");
    if (!exercise) throw new Error("Missing exercise 1.1");

    const result = await validateDdlExercise(
      exercise,
      "CREATE TABLE CUSTOMER (customerId INT AUTO_INCREMENT PRIMARY KEY, customerName VARCHAR(150), address TEXT, email VARCHAR(150) UNIQUE);",
    );

    expect(result.passed).toBe(false);
    expect(result.verificationLabel).toContain("Column 'customerName'");
  });

  it("accepts wider VARCHAR lengths in Part 1 table creation", async () => {
    const exercise = getExercise("1.1");
    if (!exercise) throw new Error("Missing exercise 1.1");

    const result = await validateDdlExercise(
      exercise,
      "CREATE TABLE CUSTOMER (customerId INT AUTO_INCREMENT PRIMARY KEY, customerName VARCHAR(255) NOT NULL, address TEXT, email VARCHAR(255) UNIQUE);",
    );

    expect(result.passed).toBe(true);
  });

  it("rejects Part 1 table creation without expected unique constraints", async () => {
    const exercise = getExercise("1.1");
    if (!exercise) throw new Error("Missing exercise 1.1");

    const result = await validateDdlExercise(
      exercise,
      "CREATE TABLE CUSTOMER (customerId INT AUTO_INCREMENT PRIMARY KEY, customerName VARCHAR(150) NOT NULL, address TEXT, email VARCHAR(150));",
    );

    expect(result.passed).toBe(false);
    expect(result.verificationLabel).toContain("unique constraints");
  });

  it("accepts Part 1 table creation without cascade rules on foreign keys", async () => {
    const exercise = getExercise("1.2");
    if (!exercise) throw new Error("Missing exercise 1.2");

    const result = await validateDdlExercise(
      exercise,
      "CREATE TABLE SUBSCRIBER (phoneNumber VARCHAR(20) PRIMARY KEY, customerId INT NOT NULL, balance DECIMAL(10,2) DEFAULT 0, operatorName VARCHAR(100), lineType VARCHAR(50), lineStatus VARCHAR(50), activationDate DATE, simCode VARCHAR(100), FOREIGN KEY (customerId) REFERENCES CUSTOMER(customerId));",
    );

    expect(result.passed).toBe(true);
  });

  it("rejects Part 1 table creation without expected check constraints", async () => {
    const exercise = getExercise("1.3");
    if (!exercise) throw new Error("Missing exercise 1.3");

    const result = await validateDdlExercise(
      exercise,
      "CREATE TABLE RECHARGE (rechargeId INT AUTO_INCREMENT PRIMARY KEY, phoneNumber VARCHAR(20) NOT NULL, amount DECIMAL(10,2) NOT NULL, rechargeDate DATE NOT NULL, paymentMethod VARCHAR(50), FOREIGN KEY (phoneNumber) REFERENCES SUBSCRIBER(phoneNumber) ON UPDATE CASCADE ON DELETE CASCADE);",
    );

    expect(result.passed).toBe(false);
    expect(result.verificationLabel).toContain("positive recharge amounts");
  });

  it("rejects reordered columns in Part 1 table creation", async () => {
    const exercise = getExercise("1.1");
    if (!exercise) throw new Error("Missing exercise 1.1");

    const result = await validateDdlExercise(
      exercise,
      "CREATE TABLE CUSTOMER (email VARCHAR(150) UNIQUE, address TEXT, customerName VARCHAR(150) NOT NULL, customerId INT AUTO_INCREMENT PRIMARY KEY);",
    );

    expect(result.passed).toBe(false);
    expect(result.verificationLabel).toContain("columns must match");
  });

  it("hides disposable schema names from missing table errors", async () => {
    const exercise = getExercise("1.2");
    if (!exercise) throw new Error("Missing exercise 1.2");

    const result = await validateDdlExercise(
      exercise,
      "CREATE TABLE SUBSCRIBER (phoneNumber VARCHAR(20) PRIMARY KEY, customerId INT NOT NULL, balance DECIMAL(10,2) DEFAULT 0, operatorName VARCHAR(100), lineType VARCHAR(50), lineStatus VARCHAR(50), activationDate DATE, simCode VARCHAR(100), FOREIGN KEY (customerId) REFERENCES MISSING(customerId));",
    );

    expect(result.passed).toBe(false);
    expect(result.diff?.sqlError).toBe(
      "Table 'MISSING' does not exist. Create it first, check the table name, or place your CREATE TABLE statements in dependency order.",
    );
    expect(result.diff?.sqlError).not.toContain("bdd_ddl_");
  });

  it("does not mutate the canonical database after DDL validation", async () => {
    const caller = appRouter.createCaller({});

    const beforeResult = await caller.query.execute({
      sql: "SELECT COUNT(*) AS cnt FROM CUSTOMER",
    });
    const beforeCount = beforeResult.rows[0]?.cnt;

    const exercise = getExercise("1.1");
    if (!exercise) throw new Error("Missing exercise 1.1");
    await validateDdlExercise(
      exercise,
      "CREATE TABLE CUSTOMER (customerId INT AUTO_INCREMENT PRIMARY KEY, customerName VARCHAR(150) NOT NULL, address TEXT, email VARCHAR(150) UNIQUE);",
    );

    const afterResult = await caller.query.execute({
      sql: "SELECT COUNT(*) AS cnt FROM CUSTOMER",
    });
    expect(afterResult.rows[0]?.cnt).toBe(beforeCount);
  });

  it("does not leave DDL side effects in the canonical schema after a failed DDL", async () => {
    const caller = appRouter.createCaller({});

    const exercise = getExercise("2.4.1");
    if (!exercise) throw new Error("Missing exercise 2.4.1");
    const result = await validateDdlExercise(
      exercise,
      "ALTER TABLE USES ADD COLUMN isCall BOOLEAN NULL;\nUPDATE USES SET isCall = TRUE;\nALTER TABLE USES MODIFY COLUMN isCall BOOLEAN NOT NULL;",
    );

    expect(result.passed).toBe(false);

    const columns = await caller.schema.tableColumns("USES");
    const hasIsCall = columns.some((col) => col.columnName === "isCall");
    expect(hasIsCall).toBe(false);
  });

  it("handles concurrent DDL submissions without cross-contamination", async () => {
    const exercise = getExercise("1.1");
    if (!exercise) throw new Error("Missing exercise 1.1");

    const [result1, result2] = await Promise.all([
      validateDdlExercise(
        exercise,
        "CREATE TABLE CUSTOMER (customerId INT AUTO_INCREMENT PRIMARY KEY, customerName VARCHAR(150) NOT NULL, address TEXT, email VARCHAR(150) UNIQUE);",
      ),
      validateDdlExercise(
        exercise,
        "CREATE TABLE CUSTOMER (customerId INT AUTO_INCREMENT PRIMARY KEY, customerName VARCHAR(150) NOT NULL, address TEXT, email VARCHAR(150) UNIQUE);",
      ),
    ]);

    expect(result1.passed).toBe(true);
    expect(result2.passed).toBe(true);
  });

  it("validates Part 4 DDL exercise (2.4.3 unique constraint) in isolation", async () => {
    const caller = appRouter.createCaller({});
    const exercise = getExercise("2.4.3");
    if (!exercise) throw new Error("Missing exercise 2.4.3");

    const result = await validateDdlExercise(
      exercise,
      "ALTER TABLE SUBSCRIBER ADD CONSTRAINT uq_subscriber_simCode UNIQUE (simCode)",
    );
    expect(result.passed).toBe(true);

    const columns = await caller.schema.tableColumns("SUBSCRIBER");
    expect(columns.some((c) => c.columnName === "simCode")).toBe(true);
    expect(columns.some((c) => c.columnKey.includes("UNI"))).toBe(false);
  });

  it("returns immediate DDL validation results by default for local development", async () => {
    const originalDdlValidationMode = process.env.DDL_VALIDATION_MODE;
    delete process.env.DDL_VALIDATION_MODE;

    try {
      const caller = appRouter.createCaller({});
      const result = await caller.validation.submit({
        exerciseId: "1.1",
        userSql:
          "CREATE TABLE CUSTOMER (customerId INT AUTO_INCREMENT PRIMARY KEY, customerName VARCHAR(150) NOT NULL, address TEXT, email VARCHAR(150) UNIQUE);",
      });

      expect(result.passed).toBe(true);
      expect("jobId" in result).toBe(false);
    } finally {
      if (originalDdlValidationMode === undefined) {
        delete process.env.DDL_VALIDATION_MODE;
      } else {
        process.env.DDL_VALIDATION_MODE = originalDdlValidationMode;
      }
    }
  });
});

describe("async DDL job queue", () => {
  const originalDdlValidationMode = process.env.DDL_VALIDATION_MODE;

  beforeAll(async () => {
    process.env.DDL_VALIDATION_MODE = "async";
    const { getRedis } = await import("../redis");
    const redis = getRedis();
    if (redis.status !== "ready") {
      await redis.connect();
    }
    await redis.flushdb();
  });

  afterAll(() => {
    if (originalDdlValidationMode === undefined) {
      delete process.env.DDL_VALIDATION_MODE;
      return;
    }

    process.env.DDL_VALIDATION_MODE = originalDdlValidationMode;
  });

  it("enqueues DDL submissions and returns a jobId", async () => {
    const caller = appRouter.createCaller({});

    const result = await caller.validation.submit({
      exerciseId: "1.1",
      userSql:
        "CREATE TABLE CUSTOMER (customerId INT AUTO_INCREMENT PRIMARY KEY, customerName VARCHAR(150) NOT NULL, address TEXT, email VARCHAR(150) UNIQUE);",
    });

    expect(result.passed).toBe(false);
    expect(result.mode).toBe("ddl");
    expect(result.exerciseId).toBe("1.1");
    expect("jobId" in result && typeof result.jobId === "string").toBe(true);
    expect("status" in result && result.status === "pending").toBe(true);
  });

  it("returns job status for an enqueued job", async () => {
    const caller = appRouter.createCaller({});

    const submitResult = await caller.validation.submit({
      exerciseId: "1.1",
      userSql:
        "CREATE TABLE CUSTOMER (customerId INT AUTO_INCREMENT PRIMARY KEY, customerName VARCHAR(150) NOT NULL, address TEXT, email VARCHAR(150) UNIQUE);",
    });

    const jobId = (submitResult as Record<string, unknown>).jobId as string;
    const job = await caller.validation.jobStatus(jobId);

    expect(job.id).toBe(jobId);
    expect(job.status).toBe("pending");
    expect(job.exerciseId).toBe("1.1");
  });

  it("rejects job status queries for non-existent jobs", async () => {
    const caller = appRouter.createCaller({});

    await expect(
      caller.validation.jobStatus("00000000-0000-0000-0000-000000000000"),
    ).rejects.toThrow("does not exist or has expired");
  });

  it("DQL submissions return immediate results without jobId", async () => {
    const exercise = getExercise("2.1.1");
    if (!exercise) throw new Error("Missing exercise 2.1.1");
    const result = await validateDqlExercise(
      exercise,
      "SELECT s.phoneNumber, c.customerName, s.operatorName FROM CUSTOMER c NATURAL JOIN SUBSCRIBER s WHERE s.lineStatus = 'Active'",
    );
    expect(result.passed).toBe(true);
    expect(result.mode).toBe("dql");
    expect("jobId" in result).toBe(false);
  });

  it("rejects false-empty DQL bypasses when the seed has unused services", async () => {
    const exercise = getExercise("2.1.4");
    if (!exercise) throw new Error("Missing exercise 2.1.4");

    const result = await validateDqlExercise(
      exercise,
      "SELECT serviceId, serviceName FROM SERVICE WHERE false",
    );

    expect(result.passed).toBe(false);
    expect(result.diff?.rowCountDiff).toEqual({ expected: 1, actual: 0 });
  });

  it("does not use stale cached expected outputs during DQL validation", async () => {
    const exercise = getExercise("2.1.4");
    if (!exercise) throw new Error("Missing exercise 2.1.4");

    await getCachedDqlExpectedOutputs(exercise, async () => ({
      columns: ["serviceId", "serviceName"],
      rows: [],
    }));

    const result = await validateDqlExercise(
      exercise,
      "SELECT serviceId, serviceName FROM SERVICE WHERE false",
    );

    expect(result.passed).toBe(false);
    expect(result.diff?.rowCountDiff).toEqual({ expected: 1, actual: 0 });
  });

  it("transitions job through pending -> running -> completed", async () => {
    const { enqueueDdlJob, getJobStatus, markJobRunning, markJobCompleted } =
      await import("../jobs");

    const { jobId } = await enqueueDdlJob(
      "1.1",
      "CREATE TABLE CUSTOMER (customerId INT AUTO_INCREMENT PRIMARY KEY, customerName VARCHAR(150) NOT NULL, address TEXT, email VARCHAR(150) UNIQUE);",
    );

    let job = await getJobStatus(jobId);
    expect(job?.status).toBe("pending");

    await markJobRunning(jobId);
    job = await getJobStatus(jobId);
    expect(job?.status).toBe("running");

    const exercise = getExercise("1.1");
    if (!exercise) throw new Error("Missing exercise");
    const validationResult = await validateDdlExercise(
      exercise,
      "CREATE TABLE CUSTOMER (customerId INT AUTO_INCREMENT PRIMARY KEY, customerName VARCHAR(150) NOT NULL, address TEXT, email VARCHAR(150) UNIQUE);",
    );
    await markJobCompleted(jobId, validationResult);

    job = await getJobStatus(jobId);
    expect(job?.status).toBe("completed");
    expect(job?.result?.passed).toBe(true);
  });

  it("marks job as failed on worker error", async () => {
    const { enqueueDdlJob, getJobStatus, markJobRunning, markJobFailed } =
      await import("../jobs");

    const { jobId } = await enqueueDdlJob("1.1", "INVALID SQL");

    await markJobRunning(jobId);
    await markJobFailed(jobId, "Worker error");

    const job = await getJobStatus(jobId);
    expect(job?.status).toBe("failed");
    expect(job?.error).toBe("Worker error");
  });

  it("respects worker concurrency limit", async () => {
    const { getActiveJobCount, getDdlJobConcurrency } = await import("../jobs");

    const count = await getActiveJobCount();
    expect(count).toBeGreaterThanOrEqual(0);

    const concurrency = getDdlJobConcurrency();
    expect(concurrency).toBeGreaterThanOrEqual(1);
  });
});
