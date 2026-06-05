import { randomUUID } from "node:crypto";
import { getRedis } from "./redis";
import type { ValidationResponse } from "./router";

export type JobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "timeout";

export type DdlJob = {
  id: string;
  status: JobStatus;
  exerciseId: string;
  userSql: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  result?: ValidationResponse;
  error?: string;
};

const JOB_TTL_SECONDS = 3600;
const PENDING_QUEUE = "bdd:jobs:pending";
const ACTIVE_SET = "bdd:jobs:active";

function jobKey(jobId: string) {
  return `bdd:job:${jobId}`;
}

export async function enqueueDdlJob(
  exerciseId: string,
  userSql: string,
): Promise<{ jobId: string }> {
  const jobId = randomUUID();
  const job: DdlJob = {
    id: jobId,
    status: "pending",
    exerciseId,
    userSql,
    createdAt: Date.now(),
  };

  const redis = getRedis();
  await redis.set(jobKey(jobId), JSON.stringify(job), "EX", JOB_TTL_SECONDS);
  await redis.rpush(PENDING_QUEUE, jobId);

  return { jobId };
}

export async function getJobStatus(jobId: string): Promise<DdlJob | null> {
  const raw = await getRedis().get(jobKey(jobId));
  if (!raw) return null;
  return JSON.parse(raw) as DdlJob;
}

export async function dequeueJob(): Promise<DdlJob | null> {
  const redis = getRedis();
  const result = await redis.blpop(PENDING_QUEUE, 5);
  if (!result) return null;

  const [, jobId] = result;
  const raw = await redis.get(jobKey(jobId));
  if (!raw) return null;

  const job: DdlJob = JSON.parse(raw);
  if (job.status !== "pending") return null;

  return job;
}

export async function markJobRunning(jobId: string): Promise<void> {
  const redis = getRedis();
  const raw = await redis.get(jobKey(jobId));
  if (!raw) return;

  const job: DdlJob = JSON.parse(raw);
  job.status = "running";
  job.startedAt = Date.now();

  await redis
    .multi()
    .set(jobKey(jobId), JSON.stringify(job), "EX", JOB_TTL_SECONDS)
    .sadd(ACTIVE_SET, jobId)
    .exec();
}

export async function markJobCompleted(
  jobId: string,
  result: ValidationResponse,
): Promise<void> {
  const redis = getRedis();
  const raw = await redis.get(jobKey(jobId));
  if (!raw) return;

  const job: DdlJob = JSON.parse(raw);
  job.status = "completed";
  job.completedAt = Date.now();
  job.result = result;

  await redis
    .multi()
    .set(jobKey(jobId), JSON.stringify(job), "EX", JOB_TTL_SECONDS)
    .srem(ACTIVE_SET, jobId)
    .exec();
}

export async function markJobFailed(
  jobId: string,
  error: string,
): Promise<void> {
  const redis = getRedis();
  const raw = await redis.get(jobKey(jobId));
  if (!raw) return;

  const job: DdlJob = JSON.parse(raw);
  job.status = "failed";
  job.completedAt = Date.now();
  job.error = error;

  await redis
    .multi()
    .set(jobKey(jobId), JSON.stringify(job), "EX", JOB_TTL_SECONDS)
    .srem(ACTIVE_SET, jobId)
    .exec();
}

export async function getActiveJobCount(): Promise<number> {
  return getRedis().scard(ACTIVE_SET);
}

export function getDdlJobConcurrency(): number {
  return Math.max(
    1,
    Number.isSafeInteger(Number(process.env.DDL_JOB_CONCURRENCY))
      ? Number(process.env.DDL_JOB_CONCURRENCY)
      : 2,
  );
}
