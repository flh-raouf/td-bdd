import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import {
  appRouter,
  classifySql,
  compareResults,
  createUserQueryOptions,
  enforceQueryResultLimits,
  getPublicQueryExecutionOptions,
  isAdminReseedAuthorized,
  normalizeRow,
  normalizeValue,
  splitSqlStatements,
  stripLeadingComments,
  stripSqlCommentsAndLiterals,
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
        allowAlter: true,
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
