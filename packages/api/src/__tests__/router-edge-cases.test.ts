import { describe, expect, it } from "vitest";
import {
  compareResults,
  consumeRateLimit,
  getForwardedIp,
  normalizeRow,
  normalizeValue,
  splitSqlStatements,
} from "../router";

describe("rate limiting helpers", () => {
  it("uses the first forwarded IP", () => {
    expect(getForwardedIp("203.0.113.10, 10.0.0.1")).toBe("203.0.113.10");
  });

  it("tracks each IP independently", () => {
    const store = new Map<string, number[]>();

    expect(consumeRateLimit(store, "query.execute:ip-a", 1_000, 1, 1_000)).toBe(
      true,
    );
    expect(consumeRateLimit(store, "query.execute:ip-a", 1_100, 1, 1_000)).toBe(
      false,
    );
    expect(consumeRateLimit(store, "query.execute:ip-b", 1_100, 1, 1_000)).toBe(
      true,
    );
  });

  it("allows requests after the sliding window expires", () => {
    const store = new Map<string, number[]>();

    expect(
      consumeRateLimit(store, "validation.submit:ip-a", 1_000, 1, 1_000),
    ).toBe(true);
    expect(
      consumeRateLimit(store, "validation.submit:ip-a", 2_000, 1, 1_000),
    ).toBe(true);
  });
});

describe("normalizeValue - additional edge cases", () => {
  it("handles boolean true as string", () => {
    expect(normalizeValue(true)).toBe("true");
  });

  it("handles boolean false as string", () => {
    expect(normalizeValue(false)).toBe("false");
  });

  it("handles empty string (not numeric)", () => {
    expect(normalizeValue("")).toBe("");
  });

  it("handles whitespace-only string (not numeric)", () => {
    expect(normalizeValue("   ")).toBe("   ");
  });

  it("handles BigInt safely as string", () => {
    expect(normalizeValue(BigInt(42))).toBe("42");
  });

  it("handles negative numbers", () => {
    expect(normalizeValue(-5)).toBe("-5");
  });

  it("handles float with leading zero", () => {
    expect(normalizeValue(0.5)).toBe("0.5");
  });

  it("treats phone-like strings as non-numeric", () => {
    expect(normalizeValue("0550123456")).toBe("0550123456");
  });

  it("treats decimal-style numeric strings correctly", () => {
    expect(normalizeValue("10.50")).toBe("10.5");
  });
});

describe("normalizeRow - additional edge cases", () => {
  it("handles row with extra columns not in spec", () => {
    const row = { id: 1, name: "Test", secret: "hidden" };
    const result = normalizeRow(row, ["id"]);
    expect(result).toBe(JSON.stringify({ id: "1" }));
  });

  it("handles missing column (undefined value)", () => {
    const row = { id: 1 };
    const result = normalizeRow(row, ["id", "name"]);
    expect(result).toBe(JSON.stringify({ id: "1", name: null }));
  });

  it("produces same output for equivalent rows with different column order", () => {
    const row1 = { a: 1, b: 2 };
    const row2 = { b: 2, a: 1 };
    expect(normalizeRow(row1, ["a", "b"])).toBe(normalizeRow(row2, ["a", "b"]));
  });
});

describe("compareResults - additional edge cases", () => {
  it("handles multiple missing and extra rows mixed", () => {
    const diff = compareResults(
      {
        columns: ["id", "name"],
        rows: [
          { id: 1, name: "A" },
          { id: 3, name: "C" },
          { id: 4, name: "D" },
        ],
      },
      {
        columns: ["id", "name"],
        rows: [
          { id: 1, name: "A" },
          { id: 2, name: "B" },
          { id: 3, name: "C" },
        ],
      },
    );
    expect(diff?.dataDiff?.missingRows).toEqual([{ id: 2, name: "B" }]);
    expect(diff?.dataDiff?.extraRows).toEqual([{ id: 4, name: "D" }]);
  });

  it("handles columns with different sort order", () => {
    const diff = compareResults(
      { columns: ["name", "id"], rows: [{ id: 1, name: "Test" }] },
      { columns: ["id", "name"], rows: [{ id: 1, name: "Test" }] },
    );
    expect(diff).toBeNull();
  });

  it("handles duplicate rows in expected", () => {
    const diff = compareResults(
      { columns: ["id"], rows: [{ id: 1 }, { id: 1 }] },
      { columns: ["id"], rows: [{ id: 1 }, { id: 1 }] },
    );
    expect(diff).toBeNull();
  });

  it("handles duplicate rows in actual not matching expected", () => {
    const diff = compareResults(
      { columns: ["id"], rows: [{ id: 1 }] },
      { columns: ["id"], rows: [{ id: 1 }, { id: 1 }] },
    );
    expect(diff?.dataDiff?.missingRows).toEqual([{ id: 1 }]);
  });

  it("detects row count difference even when data partially overlaps", () => {
    const diff = compareResults(
      {
        columns: ["id"],
        rows: [{ id: 1 }, { id: 2 }, { id: 3 }],
      },
      { columns: ["id"], rows: [{ id: 1 }, { id: 2 }] },
    );
    expect(diff?.rowCountDiff).toEqual({ expected: 2, actual: 3 });
    expect(diff?.dataDiff?.extraRows).toEqual([{ id: 3 }]);
  });
});

describe("splitSqlStatements - real-world SQL patterns", () => {
  it("handles CREATE DATABASE followed by USE", () => {
    const result = splitSqlStatements(
      "CREATE DATABASE IF NOT EXISTS DZTelecom;\nUSE DZTelecom;",
    );
    expect(result).toEqual([
      "CREATE DATABASE IF NOT EXISTS DZTelecom",
      "USE DZTelecom",
    ]);
  });

  it("handles empty statement at end", () => {
    const result = splitSqlStatements("SELECT 1;\nSELECT 2;\n");
    expect(result).toEqual(["SELECT 1", "SELECT 2"]);
  });

  it("handles Windows line endings (\\r\\n)", () => {
    expect(splitSqlStatements("SELECT 1;\r\n-- comment\r\nSELECT 2;")).toEqual([
      "SELECT 1",
      "-- comment\r\nSELECT 2",
    ]);
  });

  it("handles single statement with no semicolon", () => {
    expect(splitSqlStatements("DESCRIBE t")).toEqual(["DESCRIBE t"]);
  });
});
