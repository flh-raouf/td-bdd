import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { findSeedSqlFilePath, splitStatements, stripComments } from "../seed";

const repoRoot = dirname(fileURLToPath(import.meta.url)).replace(
  /packages\/db\/src\/__tests__$/,
  "",
);

describe("stripComments", () => {
  it("removes lines starting with --", () => {
    const input = "SELECT 1;\n-- this is a comment\nSELECT 2;";
    const result = stripComments(input);
    expect(result).toBe("SELECT 1;\nSELECT 2;");
  });

  it("keeps lines that have -- not at the start", () => {
    const input = "SELECT a -- b\nFROM t";
    const result = stripComments(input);
    expect(result).toBe("SELECT a -- b\nFROM t");
  });

  it("handles empty input", () => {
    expect(stripComments("")).toBe("");
  });

  it("handles only comment lines", () => {
    expect(stripComments("-- comment 1\n-- comment 2")).toBe("");
  });

  it("handles comment lines with leading whitespace", () => {
    expect(stripComments("  -- indented comment\nSELECT 1;")).toBe("SELECT 1;");
  });
});

describe("splitStatements", () => {
  it("splits by semicolon and trims", () => {
    const result = splitStatements("SELECT 1;\n  SELECT 2 ;\nSELECT 3;");
    expect(result).toEqual(["SELECT 1", "SELECT 2", "SELECT 3"]);
  });

  it("filters empty statements", () => {
    const result = splitStatements("SELECT 1;;;SELECT 2;");
    expect(result).toEqual(["SELECT 1", "SELECT 2"]);
  });

  it("handles single statement without trailing semicolon", () => {
    const result = splitStatements("SELECT 1");
    expect(result).toEqual(["SELECT 1"]);
  });

  it("strips comments before splitting", () => {
    const result = splitStatements(
      "-- header comment\nCREATE TABLE t (id INT);\n-- footer\nSELECT * FROM t;",
    );
    expect(result).toEqual(["CREATE TABLE t (id INT)", "SELECT * FROM t"]);
  });

  it("handles multiline statements", () => {
    const result = splitStatements(
      "CREATE TABLE t (\n  id INT,\n  name VARCHAR(100)\n);\nSELECT * FROM t;",
    );
    expect(result).toEqual([
      "CREATE TABLE t (\n  id INT,\n  name VARCHAR(100)\n)",
      "SELECT * FROM t",
    ]);
  });
});

describe("findSeedSqlFilePath", () => {
  it("finds the seed SQL file by walking upward", () => {
    const nestedStartDir = `${repoRoot}packages/db/src/__tests__`;
    expect(findSeedSqlFilePath([nestedStartDir])).toBe(
      `${repoRoot}TelecomDZ_schema_data.sql`,
    );
  });
});
