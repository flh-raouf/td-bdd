import { getRedis } from "./redis";

const RATE_LIMIT_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]

redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local count = redis.call('ZCARD', key)
if count >= limit then
  return 0
end
redis.call('ZADD', key, now, member)
redis.call('EXPIRE', key, math.ceil(window / 1000) + 1)
return 1
`;

let rateLimitScriptSha: string | null = null;
let redisAvailable = true;

async function tryInitRedis(): Promise<boolean> {
  if (!redisAvailable) return false;
  try {
    const redis = getRedis();
    if (redis.status !== "ready") return false;
    rateLimitScriptSha = (await redis.script("LOAD", RATE_LIMIT_LUA)) as string;
    return true;
  } catch {
    redisAvailable = false;
    return false;
  }
}

async function consumeRedisRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  const now = Date.now();
  const member = `${now}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    let sha = rateLimitScriptSha;
    if (!sha) {
      const ok = await tryInitRedis();
      if (!ok) return consumeMemoryRateLimit(key, limit, windowMs);
      sha = rateLimitScriptSha;
      if (!sha) return consumeMemoryRateLimit(key, limit, windowMs);
    }

    const result = await getRedis().evalsha(
      sha,
      1,
      `rate:${key}`,
      now,
      windowMs,
      limit,
      member,
    );
    return result === 1;
  } catch {
    redisAvailable = false;
    rateLimitScriptSha = null;
    return consumeMemoryRateLimit(key, limit, windowMs);
  }
}

type MemoryStore = Map<string, number[]>;

const memoryStore: MemoryStore = new Map();

function cleanupMemoryStore(now: number, windowMs: number) {
  for (const [entryKey, timestamps] of memoryStore) {
    const activeTimestamps = timestamps.filter(
      (timestamp) => now - timestamp < windowMs,
    );

    if (activeTimestamps.length === 0) {
      memoryStore.delete(entryKey);
      continue;
    }

    memoryStore.set(entryKey, activeTimestamps);
  }
}

function consumeMemoryRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  cleanupMemoryStore(now, windowMs);

  const timestamps = memoryStore.get(key) ?? [];

  if (timestamps.length >= limit) {
    return false;
  }

  timestamps.push(now);
  memoryStore.set(key, timestamps);

  return true;
}

export function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  try {
    const redis = getRedis();
    if (redis.status === "ready") {
      return consumeRedisRateLimit(key, limit, windowMs);
    }
  } catch {
    // Redis not configured, fall through to memory
  }

  return Promise.resolve(consumeMemoryRateLimit(key, limit, windowMs));
}

export const rateLimitWindowMs = 1_000;
