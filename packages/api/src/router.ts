import { randomUUID, timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { dbConfig, getSeedStatements, pool } from "@bdd-revision/db";
import { initTRPC, TRPCError } from "@trpc/server";
import type {
  FieldPacket,
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";
import { z } from "zod";
import {
  type Exercise,
  type ExpectedOutput,
  exercises,
  getExercise,
  getExerciseSummaries,
  getExercisesByPart,
  getNextExerciseId,
  getPreviousExerciseId,
} from "./exercises";
import { enqueueDdlJob, getJobStatus } from "./jobs";
import { getMetrics, incrementCounter, recordHistogram } from "./metrics";
import { consumeRateLimit, rateLimitWindowMs } from "./rate-limit";

type Context = {
  request?: IncomingMessage;
};

export function createContext({ req }: { req: IncomingMessage }): Context {
  return { request: req };
}

const t = initTRPC.context<Context>().create();

const rateLimitFallbackIp = "unknown";

export function getForwardedIp(header: string | string[] | undefined) {
  const value = Array.isArray(header) ? header[0] : header;

  return value?.split(",")[0]?.trim();
}

function getHeaderValue(
  headers: IncomingMessage["headers"] | undefined,
  headerName: string,
) {
  const value = headers?.[headerName];
  return Array.isArray(value) ? value[0] : value;
}

export function isAdminReseedAuthorized(
  headers: IncomingMessage["headers"] | undefined,
  expectedToken: string | undefined = adminReseedToken,
) {
  const providedToken = getHeaderValue(headers, adminReseedHeaderName);
  if (!providedToken || !expectedToken) {
    return false;
  }

  const provided = Buffer.from(providedToken);
  const expected = Buffer.from(expectedToken);
  return (
    provided.length === expected.length && timingSafeEqual(provided, expected)
  );
}

function assertAdminReseedAuthorized(
  headers: IncomingMessage["headers"] | undefined,
) {
  if (isAdminReseedAuthorized(headers)) {
    return;
  }

  throw new TRPCError({
    code: "FORBIDDEN",
    message: reseedRestrictedMessage,
  });
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

function createRateLimitMiddleware(limit: number) {
  return t.middleware(async ({ ctx, path, next }) => {
    const clientIp = getClientIp(ctx.request);
    const key = `${path}:${clientIp}`;

    const allowed = await consumeRateLimit(key, limit, rateLimitWindowMs);

    if (!allowed) {
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
const adminReseedHeaderName = "x-bdd-admin-token";
const adminReseedToken = process.env.DB_RESEED_TOKEN;
const reseedRestrictedMessage =
  "Database reset is restricted to admin maintenance. For local development, use bun run db:seed from the project root.";

const readPositiveIntegerEnv = (name: string, fallback: number) => {
  const value = Number(process.env[name]);

  if (!Number.isSafeInteger(value) || value <= 0) {
    return fallback;
  }

  return value;
};

export const sqlSafetyLimits = {
  maxSqlLength: readPositiveIntegerEnv("SQL_MAX_LENGTH", 10_000),
  executionTimeoutMs: readPositiveIntegerEnv("SQL_EXECUTION_TIMEOUT_MS", 3_000),
  maxResultRows: readPositiveIntegerEnv("SQL_MAX_RESULT_ROWS", 500),
  maxResponseBytes: readPositiveIntegerEnv("SQL_MAX_RESPONSE_BYTES", 1_000_000),
};

type SqlSafetyLimits = typeof sqlSafetyLimits;

const blockedSqlPatterns = [
  {
    pattern: /\bSLEEP\s*\(/i,
    message:
      "SLEEP() is blocked because deliberate delays can exhaust the runner.",
  },
  {
    pattern: /\bBENCHMARK\s*\(/i,
    message:
      "BENCHMARK() is blocked because deliberate CPU burn can exhaust the runner.",
  },
  {
    pattern: /\bGET_LOCK\s*\(/i,
    message:
      "GET_LOCK() is blocked because user queries may not hold database locks.",
  },
  {
    pattern: /\bLOAD_FILE\s*\(/i,
    message: "LOAD_FILE() is blocked because file access is not allowed.",
  },
  {
    pattern: /\bINTO\s+(OUTFILE|DUMPFILE)\b/i,
    message: "Writing query output to server files is blocked.",
  },
];

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

export function getPublicQueryExecutionOptions(): SqlExecutionOptions {
  return {
    allowAlter: false,
    rollbackDml: true,
  };
}

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

export type ValidationResponse = {
  passed: boolean;
  exerciseId: string;
  mode: Exercise["type"];
  matchedSolutionIndex?: number;
  result?: QueryResult;
  diff?: ResultDiff;
  verificationLabel?: string;
};

const identifierSchema = z.string().regex(/^[A-Za-z0-9_]+$/);

const quoteIdentifier = (identifier: string) =>
  `\`${identifier.replaceAll("`", "``")}\``;

type SchemaColumnMetadata = {
  columnName: string;
  columnType: string;
  isNullable: boolean;
  columnKey: string;
  columnDefault: unknown;
  extra: string;
  ordinalPosition: number;
};

type SchemaTableMetadata = {
  tableName: string;
};

type SchemaColumnRow = {
  tableName: unknown;
  columnName: unknown;
  columnType: unknown;
  isNullable: unknown;
  columnKey: unknown;
  columnDefault: unknown;
  extra: unknown;
  ordinalPosition: unknown;
};

type SchemaMetadata = {
  tables: SchemaTableMetadata[];
  columnsByTable: Map<string, SchemaColumnMetadata[]>;
  fullSchema: Record<string, string[]>;
};

type SolutionQueryExecutor = (sql: string) => Promise<QueryResult>;

const dqlExpectedOutputCache = new Map<string, Promise<QueryResult[]>>();
let schemaMetadataCache: Promise<SchemaMetadata> | null = null;

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
    .replace(/\/\*.*?\*\//g, " ")
    .replace(/;\s*$/, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token.replace(/[^A-Za-z_]/g, "").toUpperCase());
}

export function stripSqlCommentsAndLiterals(sql: string) {
  let stripped = "";
  let quote: "'" | '"' | "`" | null = null;
  let isLineComment = false;
  let isBlockComment = false;

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const nextChar = sql[index + 1];

    if (isLineComment) {
      if (char === "\n") {
        stripped += "\n";
        isLineComment = false;
      } else {
        stripped += " ";
      }
      continue;
    }

    if (isBlockComment) {
      if (char === "*" && nextChar === "/") {
        stripped += "  ";
        index += 1;
        isBlockComment = false;
      } else {
        stripped += char === "\n" ? "\n" : " ";
      }
      continue;
    }

    if (!quote && char === "-" && nextChar === "-") {
      stripped += "  ";
      index += 1;
      isLineComment = true;
      continue;
    }

    if (!quote && char === "#") {
      stripped += " ";
      isLineComment = true;
      continue;
    }

    if (!quote && char === "/" && nextChar === "*") {
      stripped += "  ";
      index += 1;
      isBlockComment = true;
      continue;
    }

    if (quote) {
      if (char === "\\") {
        stripped += " ";
        if (nextChar) {
          stripped += " ";
          index += 1;
        }
        continue;
      }

      if (char === quote) {
        quote = null;
      }

      stripped += " ";
      continue;
    }

    if (char === "'" || char === '"' || char === "`") {
      quote = char;
      stripped += " ";
      continue;
    }

    stripped += char;
  }

  return stripped;
}

export function validateSqlSafety(
  sql: string,
  limits: Pick<SqlSafetyLimits, "maxSqlLength"> = sqlSafetyLimits,
) {
  if (sql.length > limits.maxSqlLength) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `SQL query is too long. Keep it under ${limits.maxSqlLength} characters.`,
    });
  }

  const executableSql = stripSqlCommentsAndLiterals(sql);
  for (const blockedPattern of blockedSqlPatterns) {
    if (blockedPattern.pattern.test(executableSql)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: blockedPattern.message,
      });
    }
  }
}

export function classifySql(
  sql: string,
  options: SqlExecutionOptions = {},
): SqlKind {
  validateSqlSafety(sql);

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

  if (keyword === "WITH") {
    const cteDmlKeywords = new Set(["DELETE", "INSERT", "UPDATE", "REPLACE"]);
    for (const token of tokens.slice(1)) {
      if (cteDmlKeywords.has(token)) {
        return "dml";
      }
    }
    return "read";
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

export function enforceQueryResultLimits(
  result: QueryResult,
  limits: Pick<
    SqlSafetyLimits,
    "maxResultRows" | "maxResponseBytes"
  > = sqlSafetyLimits,
) {
  if (result.rows.length > limits.maxResultRows) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Query returned too many rows. Narrow the query to at most ${limits.maxResultRows} rows.`,
    });
  }

  const responseBytes = Buffer.byteLength(JSON.stringify(result), "utf8");
  if (responseBytes > limits.maxResponseBytes) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Query result is too large. Narrow the selected columns or rows below ${limits.maxResponseBytes} bytes.`,
    });
  }

  return result;
}

function mapAndLimitQueryResult(
  rows: RowDataPacket[] | ResultSetHeader,
  fields: FieldPacket[],
) {
  return enforceQueryResultLimits(mapQueryResult(rows, fields));
}

export function createUserQueryOptions(sql: string) {
  return { sql, timeout: sqlSafetyLimits.executionTimeoutMs };
}

function isQueryTimeoutError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const code = "code" in error ? String(error.code) : "";
  return (
    code === "PROTOCOL_SEQUENCE_TIMEOUT" ||
    code === "ETIMEDOUT" ||
    /timeout/i.test(error.message)
  );
}

function getErrorMessage(error: unknown) {
  if (isQueryTimeoutError(error)) {
    return `SQL execution exceeded the ${sqlSafetyLimits.executionTimeoutMs} ms limit. Narrow the query before running it again.`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "SQL execution failed.";
}

async function runQueryForUser(
  sql: string,
  options: SqlExecutionOptions = getPublicQueryExecutionOptions(),
) {
  const start = performance.now();
  const sqlKind = classifySql(sql, options);
  try {
    const result = await runQuery(sql, options);
    recordHistogram("bdd.sql.duration", performance.now() - start, {
      kind: sqlKind,
    });
    return result;
  } catch (error) {
    recordHistogram("bdd.sql.duration", performance.now() - start, {
      kind: sqlKind,
      outcome: "error",
    });
    if (error instanceof TRPCError) {
      incrementCounter("bdd.sql.rejected", {
        reason: error.code,
      });
      throw error;
    }

    incrementCounter("bdd.sql.rejected", { reason: "execution_error" });
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
      if (char === quote && nextChar === quote) {
        current += nextChar;
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

export function clearDqlExpectedOutputCache() {
  dqlExpectedOutputCache.clear();
}

export function clearSchemaMetadataCache() {
  schemaMetadataCache = null;
}

function clearStaticCaches() {
  clearDqlExpectedOutputCache();
  clearSchemaMetadataCache();
}

export async function generateDqlExpectedOutputs(
  exercise: Exercise,
  executeSolutionQuery: SolutionQueryExecutor,
) {
  if (exercise.type !== "dql") {
    return [];
  }

  return Promise.all(exercise.solutionQueries.map(executeSolutionQuery));
}

export function getDqlExpectedOutputCacheSize() {
  return dqlExpectedOutputCache.size;
}

export async function getCachedDqlExpectedOutputs(
  exercise: Exercise,
  executeSolutionQuery: SolutionQueryExecutor = (sql) =>
    runQuery(sql, { rollbackDml: true }),
) {
  if (exercise.type !== "dql") {
    return [];
  }

  const cached = dqlExpectedOutputCache.get(exercise.id);
  if (cached) {
    return cached;
  }

  const pending = generateDqlExpectedOutputs(exercise, executeSolutionQuery);
  dqlExpectedOutputCache.set(exercise.id, pending);

  try {
    return await pending;
  } catch (error) {
    dqlExpectedOutputCache.delete(exercise.id);
    throw error;
  }
}

export async function primeDqlExpectedOutputCache(
  executeSolutionQuery?: SolutionQueryExecutor,
) {
  await Promise.all(
    exercises
      .filter((exercise) => exercise.type === "dql")
      .map((exercise) =>
        getCachedDqlExpectedOutputs(exercise, executeSolutionQuery),
      ),
  );
}

export async function warmStaticCaches() {
  await Promise.all([primeDqlExpectedOutputCache(), getSchemaMetadata()]);
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

export function buildSchemaMetadata(rows: SchemaColumnRow[]): SchemaMetadata {
  const tableNames = new Set<string>();
  const columnsByTable = new Map<string, SchemaColumnMetadata[]>();
  const fullSchema: Record<string, string[]> = {};

  for (const row of rows) {
    const tableName = String(row.tableName);
    tableNames.add(tableName);

    if (!columnsByTable.has(tableName)) {
      columnsByTable.set(tableName, []);
      fullSchema[tableName] = [];
    }

    if (row.columnName === null || row.columnName === undefined) {
      continue;
    }

    const columnName = String(row.columnName);
    columnsByTable.get(tableName)?.push({
      columnName,
      columnType: String(row.columnType),
      isNullable: row.isNullable === "YES",
      columnKey: String(row.columnKey ?? ""),
      columnDefault: row.columnDefault ?? null,
      extra: String(row.extra ?? ""),
      ordinalPosition: Number(row.ordinalPosition),
    });
    fullSchema[tableName].push(columnName);
  }

  const tables = Array.from(tableNames)
    .sort()
    .map((tableName) => ({ tableName }));

  return { tables, columnsByTable, fullSchema };
}

async function loadSchemaMetadata() {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       t.TABLE_NAME AS tableName,
       c.COLUMN_NAME AS columnName,
       c.COLUMN_TYPE AS columnType,
       c.IS_NULLABLE AS isNullable,
       c.COLUMN_KEY AS columnKey,
       c.COLUMN_DEFAULT AS columnDefault,
       c.EXTRA AS extra,
       c.ORDINAL_POSITION AS ordinalPosition
     FROM INFORMATION_SCHEMA.TABLES t
     LEFT JOIN INFORMATION_SCHEMA.COLUMNS c
       ON c.TABLE_SCHEMA = t.TABLE_SCHEMA
      AND c.TABLE_NAME = t.TABLE_NAME
     WHERE t.TABLE_SCHEMA = ? AND t.TABLE_TYPE = 'BASE TABLE'
     ORDER BY t.TABLE_NAME, c.ORDINAL_POSITION`,
    [databaseName],
  );

  return buildSchemaMetadata(rows as SchemaColumnRow[]);
}

async function getSchemaMetadata() {
  schemaMetadataCache ??= loadSchemaMetadata().catch((error) => {
    schemaMetadataCache = null;
    throw error;
  });

  return schemaMetadataCache;
}

async function assertTableExists(tableName: string) {
  const parsedTableName = identifierSchema.parse(tableName);
  const metadata = await getSchemaMetadata();

  if (!metadata.columnsByTable.has(parsedTableName)) {
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
      >(createUserQueryOptions(sql));
      await connection.rollback();
      return mapAndLimitQueryResult(rows, fields);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  const [rows, fields] = await pool.query<RowDataPacket[] | ResultSetHeader>(
    createUserQueryOptions(sql),
  );
  return mapAndLimitQueryResult(rows, fields);
}

async function dropAllSchemaObjects() {
  const [viewRows] = await pool.query<RowDataPacket[]>(
    `SELECT TABLE_NAME AS name
     FROM INFORMATION_SCHEMA.VIEWS
     WHERE TABLE_SCHEMA = DATABASE()`,
  );

  await pool.query("SET FOREIGN_KEY_CHECKS = 0");

  for (const { name } of viewRows) {
    await pool.query(`DROP VIEW IF EXISTS ${quoteIdentifier(String(name))}`);
  }

  const [tableRows] = await pool.query<RowDataPacket[]>(
    `SELECT TABLE_NAME AS name
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_TYPE = 'BASE TABLE'`,
  );

  for (const { name } of tableRows) {
    await pool.query(`DROP TABLE IF EXISTS ${quoteIdentifier(String(name))}`);
  }

  await pool.query("SET FOREIGN_KEY_CHECKS = 1");
}

async function reseedDatabase() {
  await dropAllSchemaObjects();

  const statements = await getSeedStatements({ includeDatabaseSetup: false });
  for (const statement of statements) {
    await pool.query(statement);
  }

  clearStaticCaches();
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

export async function validateDdlExercise(
  exercise: Exercise,
  userSql: string,
): Promise<ValidationResponse> {
  const validationId = generateValidationId();
  const disposableDbName = `bdd_ddl_${validationId}`;
  const connection = await pool.getConnection();

  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS ${quoteIdentifier(disposableDbName)}`,
    );
    await connection.query(`USE ${quoteIdentifier(disposableDbName)}`);

    if (exercise.id.startsWith("1.")) {
      for (const dependencyId of exerciseOneDependencies[exercise.id] ?? []) {
        const dependency = getExercise(dependencyId);
        if (!dependency) continue;
        await runStatementsOnConnection(
          connection,
          dependency.solutionQueries[0],
          {
            allowAlter: true,
            allowCreateTable: true,
            allowDatabaseSetup: true,
            rollbackDml: false,
          },
        );
      }
    } else {
      const seedStatements = await getSeedStatements({
        includeDatabaseSetup: false,
      });
      for (const statement of seedStatements) {
        await connection.execute(statement);
      }
    }

    const sanitizedSql = remapCanonicalReferences(userSql, disposableDbName);
    await runStatementsOnConnection(connection, sanitizedSql, {
      allowAlter: true,
      allowCreateTable: true,
      allowDatabaseSetup: true,
      rollbackDml: true,
    });

    for (const verificationQuery of exercise.verificationQueries ?? []) {
      if (!verificationQuery.expectedOutput) continue;

      const [rows, fields] = await connection.query<RowDataPacket[]>(
        createUserQueryOptions(verificationQuery.sql),
      );
      const actualResult = mapAndLimitQueryResult(rows, fields);
      const expectedResult = toQueryResult(verificationQuery.expectedOutput);
      const diff = compareResults(actualResult, expectedResult);

      if (diff) {
        return {
          passed: false,
          exerciseId: exercise.id,
          mode: exercise.type,
          result: actualResult,
          diff,
          verificationLabel: verificationQuery.label,
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
    try {
      await connection.query(
        `DROP DATABASE IF EXISTS ${quoteIdentifier(disposableDbName)}`,
      );
    } catch (cleanupError) {
      console.error(
        `Failed to drop disposable schema "${disposableDbName}":`,
        cleanupError,
      );
    }
    try {
      await connection.query(`USE ${quoteIdentifier(databaseName)}`);
    } catch {
      // Connection can still be released even if USE fails
    }
    connection.release();
  }
}

export function generateValidationId(): string {
  return randomUUID().replaceAll("-", "_");
}

export function remapCanonicalReferences(
  sql: string,
  targetDb: string,
): string {
  return sql
    .replace(
      /\bCREATE\s+DATABASE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?DZTelecom`?\s*;?\s*/gi,
      "",
    )
    .replace(/\bUSE\s+`?DZTelecom`?/gi, `USE ${quoteIdentifier(targetDb)}`);
}

async function runQueryOnConnection(
  connection: PoolConnection,
  sql: string,
  options: SqlExecutionOptions = {},
): Promise<QueryResult> {
  const sqlKind = classifySql(sql, options);
  const rollbackDml = options.rollbackDml ?? true;

  if (sqlKind === "dml" && rollbackDml) {
    try {
      await connection.beginTransaction();
      const [rows, fields] = await connection.query<
        RowDataPacket[] | ResultSetHeader
      >(createUserQueryOptions(sql));
      await connection.rollback();
      return mapAndLimitQueryResult(rows, fields);
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  }

  const [rows, fields] = await connection.query<
    RowDataPacket[] | ResultSetHeader
  >(createUserQueryOptions(sql));
  return mapAndLimitQueryResult(rows, fields);
}

async function runStatementsOnConnection(
  connection: PoolConnection,
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
    result = await runQueryOnConnection(connection, statement, options);
  }

  return result;
}

const schemaRouter = t.router({
  tables: t.procedure.query(async () => {
    const metadata = await getSchemaMetadata();
    return metadata.tables;
  }),

  tableColumns: t.procedure.input(identifierSchema).query(async ({ input }) => {
    const tableName = await assertTableExists(input);
    const metadata = await getSchemaMetadata();
    return metadata.columnsByTable.get(tableName) ?? [];
  }),

  tableData: t.procedure.input(identifierSchema).query(async ({ input }) => {
    const tableName = await assertTableExists(input);
    return runQueryForUser(
      `SELECT * FROM ${quoteIdentifier(tableName)} LIMIT 10`,
    );
  }),

  fullSchema: t.procedure.query(async () => {
    const metadata = await getSchemaMetadata();
    return metadata.fullSchema;
  }),

  erDiagram: t.procedure.query(() => ({ path: erDiagramPath })),

  batched: t.procedure.query(async () => {
    const metadata = await getSchemaMetadata();
    const columnsByTable: Record<
      string,
      {
        columnName: string;
        columnType: string;
        isNullable: boolean;
        columnKey: string;
        columnDefault: unknown;
        extra: string;
        ordinalPosition: number;
      }[]
    > = {};
    for (const [tableName, columns] of metadata.columnsByTable) {
      columnsByTable[tableName] = columns;
    }
    return { tables: metadata.tables, columnsByTable };
  }),
});

const queryRouter = t.router({
  execute: t.procedure
    .use(executeRateLimitMiddleware)
    .input(
      z.object({
        sql: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => runQueryForUser(input.sql)),
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

export async function validateDqlExercise(
  exercise: Exercise,
  userSql: string,
): Promise<ValidationResponse> {
  let userResult: QueryResult;

  try {
    userResult = await runQueryForUser(userSql);
  } catch (error) {
    return {
      passed: false,
      exerciseId: exercise.id,
      mode: exercise.type,
      diff: sqlErrorDiff(error),
    };
  }

  let firstDiff: ResultDiff | undefined;

  let expectedResults: QueryResult[];

  try {
    expectedResults = await getCachedDqlExpectedOutputs(exercise);
  } catch (error) {
    return {
      passed: false,
      exerciseId: exercise.id,
      mode: exercise.type,
      result: userResult,
      diff: sqlErrorDiff(error),
    };
  }

  for (const [index, expectedResult] of expectedResults.entries()) {
    try {
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

const jobIdSchema = z.string().min(1);

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
      const start = performance.now();
      const exercise = getExercise(input.exerciseId);

      if (!exercise) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Exercise ${input.exerciseId} does not exist.`,
        });
      }

      if (exercise.type === "ddl") {
        const { jobId } = await enqueueDdlJob(input.exerciseId, input.userSql);
        recordHistogram("bdd.validation.duration", performance.now() - start, {
          mode: "ddl",
        });
        return {
          passed: false,
          exerciseId: input.exerciseId,
          mode: "ddl" as const,
          jobId,
          status: "pending" as const,
        };
      }

      const result = await validateDqlExercise(exercise, input.userSql);
      recordHistogram("bdd.validation.duration", performance.now() - start, {
        mode: "dql",
        passed: String(result.passed),
      });
      return result;
    }),

  jobStatus: t.procedure.input(jobIdSchema).query(async ({ input }) => {
    const job = await getJobStatus(input);

    if (!job) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `Job ${input} does not exist or has expired.`,
      });
    }

    return job;
  }),
});

const dbRouter = t.router({
  reseed: t.procedure.mutation(async ({ ctx }) => {
    assertAdminReseedAuthorized(ctx.request?.headers);
    await reseedDatabase();
    return { status: "ok" as const };
  }),
});

export const appRouter = t.router({
  health: t.procedure.query(async () => {
    const checks: Record<string, string> = {};

    try {
      await pool.query("SELECT 1");
      checks.db = "ok";
    } catch {
      checks.db = "unhealthy";
    }

    try {
      const { getRedis } = await import("./redis");
      const redis = getRedis();
      if (redis.status === "ready") {
        await redis.ping();
        checks.redis = "ok";
      } else {
        checks.redis = "disconnected";
      }
    } catch {
      checks.redis = "unavailable";
    }

    const healthy = Object.values(checks).every((v) => v === "ok");

    return {
      status: healthy ? ("ok" as const) : ("degraded" as const),
      checks,
      uptime: process.uptime(),
      dbPool: {
        active: (pool as unknown as { _allConnections?: { length: number } })
          ._allConnections?.length,
        configLimit: dbConfig.host ? 80 : 0,
      },
    };
  }),

  metrics: t.procedure.query(() => getMetrics()),

  db: dbRouter,
  exercises: exercisesRouter,
  schema: schemaRouter,
  query: queryRouter,
  validation: validationRouter,
});

export type AppRouter = typeof appRouter;
