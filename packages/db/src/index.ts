import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

export const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT ?? 3308),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "root",
  database: process.env.DB_NAME || "DZTelecom",
};

export const pool = mysql.createPool({
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: 80,
  multipleStatements: false,
});

export const db = drizzle(pool, { schema, mode: "default" });

export * from "./schema";
export { getSeedStatements, seedDatabase, splitStatements } from "./seed";
