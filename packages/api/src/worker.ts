import { getExercise } from "./exercises";
import {
  dequeueJob,
  getActiveJobCount,
  getDdlJobConcurrency,
  markJobCompleted,
  markJobFailed,
  markJobRunning,
} from "./jobs";
import { connectRedis, disconnectRedis } from "./redis";
import { validateDdlExercise } from "./router";

async function processOneJob(): Promise<boolean> {
  const concurrency = getDdlJobConcurrency();
  const activeCount = await getActiveJobCount();

  if (activeCount >= concurrency) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return false;
  }

  const job = await dequeueJob();
  if (!job) return false;

  try {
    await markJobRunning(job.id);
  } catch {
    return false;
  }

  try {
    const exercise = getExercise(job.exerciseId);
    if (!exercise) {
      await markJobFailed(job.id, `Exercise ${job.exerciseId} not found.`);
      return true;
    }

    const result = await validateDdlExercise(exercise, job.userSql);
    await markJobCompleted(job.id, result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown worker error";
    await markJobFailed(job.id, message);
  }

  return true;
}

async function main() {
  console.log("DDL worker starting...");

  try {
    await connectRedis();
    console.log("Redis connected.");
  } catch (error) {
    console.error("Failed to connect to Redis:", error);
    process.exit(1);
  }

  const concurrency = getDdlJobConcurrency();
  console.log(`Worker concurrency: ${concurrency}`);

  let isShuttingDown = false;

  process.on("SIGTERM", () => {
    isShuttingDown = true;
  });
  process.on("SIGINT", () => {
    isShuttingDown = true;
  });

  while (!isShuttingDown) {
    try {
      const processed = await processOneJob();

      if (!processed) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    } catch (error) {
      console.error("Worker loop error:", error);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  console.log("Worker shutting down...");
  await disconnectRedis();
  process.exit(0);
}

void main();
