import Redis from "ioredis";

const redisConfig = {
  host: process.env.REDIS_HOST ?? "localhost",
  port: Number(process.env.REDIS_PORT ?? 6379),
  maxRetriesPerRequest: 3,
  retryStrategy(times: number) {
    if (times > 10) return null;
    return Math.min(times * 200, 3000);
  },
  lazyConnect: true,
};

let redisClient: Redis | null = null;

export function getRedis(): Redis {
  redisClient ??= new Redis(redisConfig);
  return redisClient;
}

export async function connectRedis(): Promise<void> {
  const client = getRedis();
  if (client.status === "ready") return;
  await client.connect();
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
