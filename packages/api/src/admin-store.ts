import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const storeDir = path.resolve(packageRoot, "../../.local");
const passwordHashPath = path.join(storeDir, "admin-password-hash");
const sessionsPath = path.join(storeDir, "admin-sessions.json");
const analyticsPath = path.join(storeDir, "admin-analytics.json");
const defaultAdminPasswordHash =
  "$argon2id$v=19$m=65536,t=2,p=1$ITRiIwRKFs1E6Jrbs46EN525v0dqgymy3CrEA5LBi/U$/Yl5n0p48j2CIpxD5D0KX0r69HEdXMg/EPrzF/JiLIM";
const sessionTtlMs = 1000 * 60 * 60 * 12;

type AnalyticsData = {
  uniqueIps: string[];
  exerciseStats: Record<
    string,
    {
      hints: number;
      solutions: number;
      submitCorrect: number;
      submitIncorrect: number;
    }
  >;
};

type SessionData = {
  sessions: Record<string, number>;
};

export type AdminAnalyticsEvent =
  | "hint"
  | "solution"
  | "submit_correct"
  | "submit_incorrect";

async function ensureStoreDir() {
  await mkdir(storeDir, { recursive: true });
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonFile(filePath: string, data: unknown) {
  await ensureStoreDir();
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function getPasswordHash() {
  await ensureStoreDir();
  try {
    return (await readFile(passwordHashPath, "utf8")).trim();
  } catch {
    await writeFile(passwordHashPath, `${defaultAdminPasswordHash}\n`, "utf8");
    return defaultAdminPasswordHash;
  }
}

async function readSessions() {
  const now = Date.now();
  const data = await readJsonFile<SessionData>(sessionsPath, { sessions: {} });
  const activeSessions = Object.fromEntries(
    Object.entries(data.sessions).filter(([, expiresAt]) => expiresAt > now),
  );
  if (
    Object.keys(activeSessions).length !== Object.keys(data.sessions).length
  ) {
    await writeJsonFile(sessionsPath, { sessions: activeSessions });
  }
  return activeSessions;
}

async function readAnalytics() {
  return readJsonFile<AnalyticsData>(analyticsPath, {
    uniqueIps: [],
    exerciseStats: {},
  });
}

export async function verifyAdminPassword(password: string) {
  return Bun.password.verify(password, await getPasswordHash());
}

export async function createAdminSession() {
  const sessions = await readSessions();
  const token = randomBytes(32).toString("base64url");
  sessions[token] = Date.now() + sessionTtlMs;
  await writeJsonFile(sessionsPath, { sessions });
  return token;
}

export async function deleteAdminSession(token: string | undefined) {
  if (!token) return;
  const sessions = await readSessions();
  delete sessions[token];
  await writeJsonFile(sessionsPath, { sessions });
}

export async function isAdminSessionValid(token: string | undefined) {
  if (!token) return false;
  const sessions = await readSessions();
  return Boolean(sessions[token]);
}

export async function recordVisit(ipAddress: string) {
  const analytics = await readAnalytics();
  if (!analytics.uniqueIps.includes(ipAddress)) {
    analytics.uniqueIps.push(ipAddress);
    analytics.uniqueIps.sort();
    await writeJsonFile(analyticsPath, analytics);
  }
}

export async function recordExerciseEvent(
  exerciseId: string,
  event: AdminAnalyticsEvent,
) {
  const analytics = await readAnalytics();
  if (!analytics.exerciseStats[exerciseId]) {
    analytics.exerciseStats[exerciseId] = {
      hints: 0,
      solutions: 0,
      submitCorrect: 0,
      submitIncorrect: 0,
    };
  }

  const stats = analytics.exerciseStats[exerciseId];

  if (event === "hint") stats.hints += 1;
  if (event === "solution") stats.solutions += 1;
  if (event === "submit_correct") stats.submitCorrect += 1;
  if (event === "submit_incorrect") stats.submitIncorrect += 1;

  await writeJsonFile(analyticsPath, analytics);
}

export async function getAdminStats() {
  const analytics = await readAnalytics();
  return {
    uniqueIpCount: analytics.uniqueIps.length,
    exerciseStats: analytics.exerciseStats,
  };
}
