import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join, parse } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./index";

const __dirname = dirname(fileURLToPath(import.meta.url));
const seedFileName = "TelecomDZ_schema_data.sql";

export function findSeedSqlFilePath(startDirs = [__dirname, process.cwd()]) {
  for (const startDir of startDirs) {
    let currentDir = startDir;
    const rootDir = parse(currentDir).root;

    while (true) {
      const candidate = join(currentDir, seedFileName);
      if (existsSync(candidate)) {
        return candidate;
      }

      if (currentDir === rootDir) break;
      currentDir = dirname(currentDir);
    }
  }

  throw new Error(`Could not find ${seedFileName}`);
}

export const stripComments = (sql: string) =>
  sql
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");

export const splitStatements = (sql: string) =>
  stripComments(sql)
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);

export async function getSeedStatements(options?: {
  includeDatabaseSetup?: boolean;
}) {
  const includeDatabaseSetup = options?.includeDatabaseSetup ?? true;
  const sql = await readFile(findSeedSqlFilePath(), "utf8");
  const statements = splitStatements(sql);

  if (includeDatabaseSetup) {
    return statements;
  }

  return statements.filter((statement) => {
    const normalized = statement.trim().toUpperCase();
    return (
      !normalized.startsWith("CREATE DATABASE") &&
      !normalized.startsWith("USE ")
    );
  });
}

export async function seedDatabase() {
  const connection = await pool.getConnection();
  const statements = [
    "DROP DATABASE IF EXISTS DZTelecom",
    ...(await getSeedStatements({ includeDatabaseSetup: true })),
  ];

  try {
    for (const statement of statements) {
      if (statement.trim().toUpperCase().startsWith("USE ")) {
        await connection.query(statement);
        continue;
      }

      await connection.execute(statement);
    }

    console.log("DZTelecom database seeded successfully.");
  } finally {
    connection.release();
  }
}

if (import.meta.main) {
  try {
    await seedDatabase();
  } finally {
    await pool.end();
  }
}
