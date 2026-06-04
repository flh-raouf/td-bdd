import { dbConfig, pool } from "@bdd-revision/db";
import { initTRPC, TRPCError } from "@trpc/server";
import type {
  FieldPacket,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";
import { z } from "zod";

const t = initTRPC.create();

const databaseName = dbConfig.database;
const erDiagramPath = "/assets/telecomdz-er-schema.png";

const blockedExactKeywords = new Set([
  "DROP",
  "TRUNCATE",
  "RENAME",
  "GRANT",
  "REVOKE",
  "LOCK",
  "UNLOCK",
  "FLUSH",
  "KILL",
  "SHUTDOWN",
  "SET",
]);

const readOnlyKeywords = new Set([
  "SELECT",
  "SHOW",
  "DESCRIBE",
  "DESC",
  "EXPLAIN",
]);
const dmlKeywords = new Set(["INSERT", "UPDATE", "DELETE"]);
const schemaChangeKeywords = new Set(["ALTER", "CREATE"]);
const allowedCreateTargets = new Set(["VIEW"]);

type QueryRow = Record<string, unknown>;

type QueryResult = {
  columns: string[];
  rows: QueryRow[];
  affectedRows?: number;
  changedRows?: number;
  warningStatus?: number;
};

type SqlKind = "read" | "dml" | "schema";

const identifierSchema = z.string().regex(/^[A-Za-z0-9_]+$/);

const quoteIdentifier = (identifier: string) =>
  `\`${identifier.replaceAll("`", "``")}\``;

function stripLeadingComments(sql: string) {
  let rest = sql.trimStart();

  while (
    rest.startsWith("--") ||
    rest.startsWith("#") ||
    rest.startsWith("/*")
  ) {
    if (rest.startsWith("--") || rest.startsWith("#")) {
      const nextLineIndex = rest.indexOf("\n");
      if (nextLineIndex === -1) {
        return "";
      }
      rest = rest.slice(nextLineIndex + 1).trimStart();
      continue;
    }

    const commentEndIndex = rest.indexOf("*/");
    if (commentEndIndex === -1) {
      return "";
    }
    rest = rest.slice(commentEndIndex + 2).trimStart();
  }

  return rest;
}

function getSqlTokens(sql: string) {
  return stripLeadingComments(sql)
    .replace(/;\s*$/, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token.replace(/[^A-Za-z_]/g, "").toUpperCase());
}

function classifySql(sql: string, allowAlter: boolean): SqlKind {
  const tokens = getSqlTokens(sql);
  const [keyword, secondKeyword] = tokens;

  if (!keyword) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "SQL query is empty.",
    });
  }

  if (blockedExactKeywords.has(keyword)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `${keyword} statements are blocked for safety.`,
    });
  }

  if (keyword === "CREATE") {
    if (secondKeyword === "DATABASE") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "CREATE DATABASE statements are blocked for safety.",
      });
    }

    if (!allowAlter || !allowedCreateTargets.has(secondKeyword ?? "")) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "CREATE statements are only allowed for supported Part 4 schema exercises.",
      });
    }

    return "schema";
  }

  if (keyword === "ALTER") {
    if (secondKeyword !== "TABLE") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "Only ALTER TABLE statements are allowed for schema exercises.",
      });
    }

    if (!allowAlter) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "ALTER TABLE statements are only allowed for Part 4 exercises.",
      });
    }

    return "schema";
  }

  if (readOnlyKeywords.has(keyword)) {
    return "read";
  }

  if (dmlKeywords.has(keyword)) {
    return "dml";
  }

  if (schemaChangeKeywords.has(keyword)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `${keyword} statements are not allowed in this context.`,
    });
  }

  throw new TRPCError({
    code: "BAD_REQUEST",
    message: `${keyword} statements are not supported by the exercise runner.`,
  });
}

function serializeRows(rows: unknown): QueryRow[] {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows.map((row) => ({ ...(row as QueryRow) }));
}

function mapQueryResult(
  rows: RowDataPacket[] | ResultSetHeader,
  fields: FieldPacket[],
): QueryResult {
  if (Array.isArray(rows)) {
    return {
      columns: fields.map((field) => field.name),
      rows: serializeRows(rows),
    };
  }

  return {
    columns: [],
    rows: [],
    affectedRows: rows.affectedRows,
    changedRows: rows.changedRows,
    warningStatus: rows.warningStatus,
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "SQL execution failed.";
}

async function runQueryForUser(sql: string, allowAlter = false) {
  try {
    return await runQuery(sql, allowAlter);
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error;
    }

    throw new TRPCError({
      code: "BAD_REQUEST",
      message: getErrorMessage(error),
    });
  }
}

async function assertTableExists(tableName: string) {
  const parsedTableName = identifierSchema.parse(tableName);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT TABLE_NAME
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    [databaseName, parsedTableName],
  );

  if (rows.length === 0) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `Table ${parsedTableName} does not exist in ${databaseName}.`,
    });
  }

  return parsedTableName;
}

async function runQuery(sql: string, allowAlter = false): Promise<QueryResult> {
  const sqlKind = classifySql(sql, allowAlter);

  if (sqlKind === "dml") {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows, fields] = await connection.query<
        RowDataPacket[] | ResultSetHeader
      >(sql);
      await connection.rollback();
      return mapQueryResult(rows, fields);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  const [rows, fields] = await pool.query<RowDataPacket[] | ResultSetHeader>(
    sql,
  );
  return mapQueryResult(rows, fields);
}

const schemaRouter = t.router({
  tables: t.procedure.query(async () => {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT TABLE_NAME AS tableName
       FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
       ORDER BY TABLE_NAME`,
      [databaseName],
    );

    return (rows as RowDataPacket[]).map((row) => ({
      tableName: String(row.tableName),
    }));
  }),

  tableColumns: t.procedure.input(identifierSchema).query(async ({ input }) => {
    const tableName = await assertTableExists(input);
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         COLUMN_NAME AS columnName,
         COLUMN_TYPE AS columnType,
         IS_NULLABLE AS isNullable,
         COLUMN_KEY AS columnKey,
         COLUMN_DEFAULT AS columnDefault,
         EXTRA AS extra,
         ORDINAL_POSITION AS ordinalPosition
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
       ORDER BY ORDINAL_POSITION`,
      [databaseName, tableName],
    );

    return (rows as RowDataPacket[]).map((row) => ({
      columnName: String(row.columnName),
      columnType: String(row.columnType),
      isNullable: row.isNullable === "YES",
      columnKey: String(row.columnKey ?? ""),
      columnDefault: row.columnDefault ?? null,
      extra: String(row.extra ?? ""),
      ordinalPosition: Number(row.ordinalPosition),
    }));
  }),

  tableData: t.procedure.input(identifierSchema).query(async ({ input }) => {
    const tableName = await assertTableExists(input);
    return runQueryForUser(
      `SELECT * FROM ${quoteIdentifier(tableName)} LIMIT 10`,
    );
  }),

  erDiagram: t.procedure.query(() => ({ path: erDiagramPath })),
});

const queryRouter = t.router({
  execute: t.procedure
    .input(
      z.object({
        sql: z.string().min(1),
        allowAlter: z.boolean().optional().default(false),
      }),
    )
    .mutation(async ({ input }) =>
      runQueryForUser(input.sql, input.allowAlter),
    ),
});

export const appRouter = t.router({
  health: t.procedure.query(() => ({ status: "ok" as const })),
  schema: schemaRouter,
  query: queryRouter,
});

export type AppRouter = typeof appRouter;
