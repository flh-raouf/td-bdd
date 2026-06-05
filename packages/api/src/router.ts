import type { IncomingMessage } from "node:http";
import { dbConfig, getSeedStatements, pool } from "@bdd-revision/db";
import { initTRPC, TRPCError } from "@trpc/server";
import type {
  FieldPacket,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";
import { z } from "zod";
import {
  type Exercise,
  type ExpectedOutput,
  getExercise,
  getExerciseSummaries,
  getExercisesByPart,
  getNextExerciseId,
  getPreviousExerciseId,
} from "./exercises";

type Context = {
  request?: IncomingMessage;
};

export function createContext({ req }: { req: IncomingMessage }): Context {
  return { request: req };
}

const t = initTRPC.context<Context>().create();

type RateLimitStore = Map<string, number[]>;

const rateLimitStore: RateLimitStore = new Map();
const rateLimitWindowMs = 1_000;
const rateLimitFallbackIp = "unknown";

export function getForwardedIp(header: string | string[] | undefined) {
  const value = Array.isArray(header) ? header[0] : header;

  return value?.split(",")[0]?.trim();
}

function getClientIp(request: IncomingMessage | undefined) {
  if (!request) {
    return rateLimitFallbackIp;
  }

  if (process.env.TRUST_PROXY === "true") {
    const forwardedIp = getForwardedIp(request.headers["x-forwarded-for"]);
    if (forwardedIp) {
      return forwardedIp;
    }
  }

  return request.socket.remoteAddress ?? rateLimitFallbackIp;
}

export function consumeRateLimit(
  store: RateLimitStore,
  key: string,
  now: number,
  limit: number,
  windowMs: number,
) {
  for (const [entryKey, timestamps] of store) {
    const activeTimestamps = timestamps.filter(
      (timestamp) => now - timestamp < windowMs,
    );

    if (activeTimestamps.length === 0) {
      store.delete(entryKey);
      continue;
    }

    store.set(entryKey, activeTimestamps);
  }

  const timestamps = store.get(key) ?? [];

  if (timestamps.length >= limit) {
    return false;
  }

  timestamps.push(now);
  store.set(key, timestamps);

  return true;
}

function createRateLimitMiddleware(limit: number) {
  return t.middleware(async ({ ctx, path, next }) => {
    const clientIp = getClientIp(ctx.request);
    const key = `${path}:${clientIp}`;

    if (
      !consumeRateLimit(
        rateLimitStore,
        key,
        Date.now(),
        limit,
        rateLimitWindowMs,
      )
    ) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Too many requests. Please wait a moment.",
      });
    }

    return next();
  });
}

const executeRateLimitMiddleware = createRateLimitMiddleware(3);
const submitRateLimitMiddleware = createRateLimitMiddleware(2);

const databaseName = dbConfig.database;
const erDiagramPath = "/assets/telecomdz-er-schema-uses.svg";

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
  "WITH",
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

type SqlExecutionOptions = {
  allowAlter?: boolean;
  allowCreateTable?: boolean;
  allowDatabaseSetup?: boolean;
  rollbackDml?: boolean;
};

type ColumnDiff = {
  expected: string[];
  actual: string[];
  missing: string[];
  extra: string[];
};

type RowCountDiff = {
  expected: number;
  actual: number;
};

type DataDiff = {
  missingRows: QueryRow[];
  extraRows: QueryRow[];
};

type ResultDiff = {
  columnDiff?: ColumnDiff;
  rowCountDiff?: RowCountDiff;
  dataDiff?: DataDiff;
  sqlError?: string;
};

type ValidationResponse = {
  passed: boolean;
  exerciseId: string;
  mode: Exercise["type"];
  matchedSolutionIndex?: number;
  result?: QueryResult;
  diff?: ResultDiff;
};

const identifierSchema = z.string().regex(/^[A-Za-z0-9_]+$/);

const quoteIdentifier = (identifier: string) =>
  `\`${identifier.replaceAll("`", "``")}\``;

export function stripLeadingComments(sql: string) {
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

export function getSqlTokens(sql: string) {
  return stripLeadingComments(sql)
    .replace(/;\s*$/, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token.replace(/[^A-Za-z_]/g, "").toUpperCase());
}

export function classifySql(
  sql: string,
  options: SqlExecutionOptions = {},
): SqlKind {
  const allowAlter = options.allowAlter ?? false;
  const allowCreateTable = options.allowCreateTable ?? false;
  const allowDatabaseSetup = options.allowDatabaseSetup ?? false;
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
      if (allowDatabaseSetup) {
        return "schema";
      }

      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "CREATE DATABASE statements are blocked for safety.",
      });
    }

    if (secondKeyword === "TABLE") {
      if (allowCreateTable) {
        return "schema";
      }

      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "CREATE TABLE statements are only allowed during DDL validation.",
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

  if (keyword === "USE") {
    if (allowDatabaseSetup) {
      return "schema";
    }

    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "USE statements are only allowed during DDL validation.",
    });
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
    return await runQuery(sql, { allowAlter });
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

export function splitSqlStatements(sql: string) {
  const statements: string[] = [];
  let current = "";
  let quote: "'" | '"' | "`" | null = null;
  let isLineComment = false;
  let isBlockComment = false;

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const nextChar = sql[index + 1];

    if (isLineComment) {
      current += char;
      if (char === "\n") {
        isLineComment = false;
      }
      continue;
    }

    if (isBlockComment) {
      current += char;
      if (char === "*" && nextChar === "/") {
        current += nextChar;
        index += 1;
        isBlockComment = false;
      }
      continue;
    }

    if (!quote && char === "-" && nextChar === "-") {
      current += char;
      current += nextChar;
      index += 1;
      isLineComment = true;
      continue;
    }

    if (!quote && char === "#") {
      current += char;
      isLineComment = true;
      continue;
    }

    if (!quote && char === "/" && nextChar === "*") {
      current += char;
      current += nextChar;
      index += 1;
      isBlockComment = true;
      continue;
    }

    if (quote) {
      current += char;
      if (char === "\\") {
        current += nextChar ?? "";
        index += 1;
        continue;
      }
      if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === "'" || char === '"' || char === "`") {
      quote = char;
      current += char;
      continue;
    }

    if (char === ";") {
      const statement = current.trim();
      if (statement) {
        statements.push(statement);
      }
      current = "";
      continue;
    }

    current += char;
  }

  const finalStatement = current.trim();
  if (finalStatement) {
    statements.push(finalStatement);
  }

  return statements;
}

function toQueryResult(expectedOutput: ExpectedOutput): QueryResult {
  return {
    columns: expectedOutput.columns,
    rows: expectedOutput.rows,
  };
}

function isNumericLike(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (typeof value !== "string") {
    return false;
  }

  if (/^0\d+/.test(value)) {
    return false;
  }

  return value.trim() !== "" && Number.isFinite(Number(value));
}

export function normalizeValue(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (isNumericLike(value)) {
    return Number(value).toString();
  }

  if (value === null || value === undefined) {
    return null;
  }

  return String(value);
}

export function normalizeRow(row: QueryRow, columns: string[]) {
  return JSON.stringify(
    Object.fromEntries(
      columns.map((column) => [column, normalizeValue(row[column])]),
    ),
  );
}

export function compareResults(
  actual: QueryResult,
  expected: QueryResult,
): ResultDiff | null {
  const expectedColumns = [...expected.columns].sort();
  const actualColumns = [...actual.columns].sort();
  const missingColumns = expectedColumns.filter(
    (column) => !actualColumns.includes(column),
  );
  const extraColumns = actualColumns.filter(
    (column) => !expectedColumns.includes(column),
  );

  if (missingColumns.length > 0 || extraColumns.length > 0) {
    return {
      columnDiff: {
        expected: expected.columns,
        actual: actual.columns,
        missing: missingColumns,
        extra: extraColumns,
      },
    };
  }

  const diff: ResultDiff = {};

  if (actual.rows.length !== expected.rows.length) {
    diff.rowCountDiff = {
      expected: expected.rows.length,
      actual: actual.rows.length,
    };
  }

  const comparisonColumns = expectedColumns;
  const actualCounts = new Map<string, { row: QueryRow; count: number }>();
  for (const row of actual.rows) {
    const key = normalizeRow(row, comparisonColumns);
    const existing = actualCounts.get(key);
    actualCounts.set(key, { row, count: (existing?.count ?? 0) + 1 });
  }

  const missingRows: QueryRow[] = [];
  for (const row of expected.rows) {
    const key = normalizeRow(row, comparisonColumns);
    const existing = actualCounts.get(key);
    if (!existing || existing.count === 0) {
      missingRows.push(row);
      continue;
    }
    existing.count -= 1;
  }

  const extraRows = Array.from(actualCounts.values()).flatMap(
    ({ row, count }) => Array.from({ length: count }, () => row),
  );

  if (missingRows.length > 0 || extraRows.length > 0) {
    diff.dataDiff = {
      missingRows,
      extraRows,
    };
  }

  return Object.keys(diff).length === 0 ? null : diff;
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

async function runQuery(
  sql: string,
  options: SqlExecutionOptions = {},
): Promise<QueryResult> {
  const sqlKind = classifySql(sql, options);
  const rollbackDml = options.rollbackDml ?? true;

  if (sqlKind === "dml" && rollbackDml) {
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

async function runSqlStatements(
  sql: string,
  options: SqlExecutionOptions = {},
) {
  const statements = splitSqlStatements(sql);

  if (statements.length === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "SQL query is empty.",
    });
  }

  let result: QueryResult = { columns: [], rows: [] };
  for (const statement of statements) {
    result = await runQuery(statement, options);
  }

  return result;
}

async function dropAllSchemaObjects() {
  await pool.query("SET FOREIGN_KEY_CHECKS = 0");
  await pool.query("DROP VIEW IF EXISTS activeSubscribers");

  for (const tableName of [
    "SIGNUP",
    "FEATURE",
    "USES",
    "RECHARGE",
    "SUBSCRIBER",
    "SERVICE",
    "PLAN",
    "CUSTOMER",
  ]) {
    await pool.query(`DROP TABLE IF EXISTS ${quoteIdentifier(tableName)}`);
  }

  await pool.query("SET FOREIGN_KEY_CHECKS = 1");
}

async function reseedDatabase() {
  await dropAllSchemaObjects();

  const statements = await getSeedStatements({ includeDatabaseSetup: false });
  for (const statement of statements) {
    await pool.query(statement);
  }
}

const exerciseOneDependencies: Record<string, string[]> = {
  "1.1": [],
  "1.2": ["1.1"],
  "1.3": ["1.1", "1.2"],
  "1.4": [],
  "1.5": ["1.1", "1.2", "1.4"],
  "1.6": [],
  "1.7": ["1.6"],
  "1.8": ["1.1", "1.2", "1.6"],
};

async function prepareDdlValidation(exercise: Exercise) {
  if (exercise.id.startsWith("1.")) {
    await dropAllSchemaObjects();

    for (const dependencyId of exerciseOneDependencies[exercise.id] ?? []) {
      const dependency = getExercise(dependencyId);
      if (!dependency) {
        continue;
      }

      await runSqlStatements(dependency.solutionQueries[0], {
        allowAlter: true,
        allowCreateTable: true,
        allowDatabaseSetup: true,
        rollbackDml: false,
      });
    }
    return;
  }

  await reseedDatabase();
}

async function acquireDdlLock(exerciseId: string) {
  const lockKey = `bdd_ddl_${exerciseId}`;
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT GET_LOCK(?, 15) AS acquiredLock",
    [lockKey],
  );
  const acquiredLock = Number(rows[0]?.acquiredLock ?? 0);

  if (acquiredLock !== 1) {
    throw new TRPCError({
      code: "TIMEOUT",
      message: "DDL validation is busy for this exercise. Please try again.",
    });
  }

  return lockKey;
}

async function releaseDdlLock(lockKey: string) {
  await pool.query("SELECT RELEASE_LOCK(?)", [lockKey]);
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
    .use(executeRateLimitMiddleware)
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

const exerciseIdSchema = z.string().min(1);

const exercisesRouter = t.router({
  list: t.procedure.query(() => getExerciseSummaries()),
  byPart: t.procedure.query(() => getExercisesByPart()),
  get: t.procedure.input(exerciseIdSchema).query(({ input }) => {
    const exercise = getExercise(input);

    if (!exercise) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `Exercise ${input} does not exist.`,
      });
    }

    return {
      ...exercise,
      nextExerciseId: getNextExerciseId(input),
      previousExerciseId: getPreviousExerciseId(input),
    };
  }),
});

function sqlErrorDiff(error: unknown): ResultDiff {
  return { sqlError: getErrorMessage(error) };
}

async function validateDqlExercise(
  exercise: Exercise,
  userSql: string,
): Promise<ValidationResponse> {
  let userResult: QueryResult;

  try {
    userResult = await runQueryForUser(userSql, false);
  } catch (error) {
    return {
      passed: false,
      exerciseId: exercise.id,
      mode: exercise.type,
      diff: sqlErrorDiff(error),
    };
  }

  let firstDiff: ResultDiff | undefined;

  for (const [index, solutionQuery] of exercise.solutionQueries.entries()) {
    try {
      const expectedResult = await runQuery(solutionQuery, {
        rollbackDml: true,
      });
      const diff = compareResults(userResult, expectedResult);

      if (!diff) {
        return {
          passed: true,
          exerciseId: exercise.id,
          mode: exercise.type,
          matchedSolutionIndex: index + 1,
          result: userResult,
        };
      }

      firstDiff ??= diff;
    } catch (error) {
      firstDiff ??= sqlErrorDiff(error);
    }
  }

  return {
    passed: false,
    exerciseId: exercise.id,
    mode: exercise.type,
    result: userResult,
    diff: firstDiff,
  };
}

async function validateDdlExercise(
  exercise: Exercise,
  userSql: string,
): Promise<ValidationResponse> {
  let lockKey: string | undefined;

  try {
    lockKey = await acquireDdlLock(exercise.id);
    await prepareDdlValidation(exercise);
    await runSqlStatements(userSql, {
      allowAlter: true,
      allowCreateTable: true,
      allowDatabaseSetup: true,
      rollbackDml: true,
    });

    for (const verificationQuery of exercise.verificationQueries ?? []) {
      const actualResult = await runQuery(verificationQuery.sql, {
        rollbackDml: true,
      });

      if (!verificationQuery.expectedOutput) {
        continue;
      }

      const expectedResult = toQueryResult(verificationQuery.expectedOutput);
      const diff = compareResults(actualResult, expectedResult);

      if (diff) {
        return {
          passed: false,
          exerciseId: exercise.id,
          mode: exercise.type,
          result: actualResult,
          diff,
        };
      }
    }

    return {
      passed: true,
      exerciseId: exercise.id,
      mode: exercise.type,
      matchedSolutionIndex: 1,
    };
  } catch (error) {
    return {
      passed: false,
      exerciseId: exercise.id,
      mode: exercise.type,
      diff: sqlErrorDiff(error),
    };
  } finally {
    if (lockKey) {
      try {
        await reseedDatabase();
      } finally {
        await releaseDdlLock(lockKey);
      }
    }
  }
}

const validationRouter = t.router({
  submit: t.procedure
    .use(submitRateLimitMiddleware)
    .input(
      z.object({
        exerciseId: exerciseIdSchema,
        userSql: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const exercise = getExercise(input.exerciseId);

      if (!exercise) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Exercise ${input.exerciseId} does not exist.`,
        });
      }

      if (exercise.type === "ddl") {
        return validateDdlExercise(exercise, input.userSql);
      }

      return validateDqlExercise(exercise, input.userSql);
    }),
});

const dbRouter = t.router({
  reseed: t.procedure.mutation(async () => {
    await reseedDatabase();
    return { status: "ok" as const };
  }),
});

export const appRouter = t.router({
  health: t.procedure.query(() => ({ status: "ok" as const })),
  db: dbRouter,
  exercises: exercisesRouter,
  schema: schemaRouter,
  query: queryRouter,
  validation: validationRouter,
});

export type AppRouter = typeof appRouter;
