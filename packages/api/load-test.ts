import { getExercise, getExerciseSummaries } from "../exercises";
import { getMetrics, resetMetrics } from "./metrics";

const API_URL = process.env.API_URL ?? "http://localhost:3001";
const CONCURRENT_USERS = Number(process.env.LOAD_USERS) || 200;
const BURST_USERS = Number(process.env.LOAD_BURST_USERS) || 300;
const DURATION_MS = Number(process.env.LOAD_DURATION_MS) || 30_000;

type Result = {
  status: number;
  body: unknown;
  latency: number;
};

async function apiCall(
  path: string,
  options?: { method?: string; body?: unknown },
): Promise<Result> {
  const start = performance.now();
  const url = `${API_URL}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const res = await fetch(url, {
    method: options?.method ?? "GET",
    headers,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {}

  return { status: res.status, body, latency: performance.now() - start };
}

async function _tRpcCall(procedure: string, input?: unknown): Promise<Result> {
  const query = input
    ? `?input=${encodeURIComponent(JSON.stringify(input))}`
    : "";
  return apiCall(`/${procedure}${query}`);
}

type LoadTestTargets = {
  dqlP95LatencyMs: number;
  dqlErrorRate: number;
  ddlJobAcceptedRate: number;
  ddlJobCompletionP95Ms: number;
};

const PASS_TARGETS: LoadTestTargets = {
  dqlP95LatencyMs: 700,
  dqlErrorRate: 0.02,
  ddlJobAcceptedRate: 0.99,
  ddlJobCompletionP95Ms: 5_000,
};

const BURST_TARGETS: LoadTestTargets = {
  dqlP95LatencyMs: 1500,
  dqlErrorRate: 0.05,
  ddlJobAcceptedRate: 0.95,
  ddlJobCompletionP95Ms: 10_000,
};

function percentile(sorted: number[], p: number) {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function evaluate(label: string, actual: number, target: number, unit: string) {
  const pass = actual <= target;
  console.log(
    `  ${label}: ${actual.toFixed(1)}${unit} (target ≤ ${target}${unit}) ${pass ? "✓" : "✗"}`,
  );
  return pass;
}

function evaluateMin(
  label: string,
  actual: number,
  target: number,
  unit: string,
) {
  const pass = actual >= target;
  console.log(
    `  ${label}: ${(actual * 100).toFixed(1)}${unit} (target ≥ ${(target * 100).toFixed(0)}${unit}) ${pass ? "✓" : "✗"}`,
  );
  return pass;
}

async function runDqlLoad(concurrency: number, durationMs: number) {
  const dqlExercises = getExerciseSummaries().filter((e) => e.type === "dql");
  const exerciseIds = dqlExercises.map((e) => e.id);

  const latencies: number[] = [];
  const errors: number[] = [];
  const endTime = Date.now() + durationMs;

  async function userLoop(id: number) {
    while (Date.now() < endTime) {
      const exerciseId = exerciseIds[id % exerciseIds.length];
      const exercise = getExercise(exerciseId);
      if (!exercise) continue;

      const sql = exercise.solutionQueries[0];
      if (!sql) continue;

      const start = performance.now();
      try {
        const res = await apiCall("/validation.submit", {
          method: "POST",
          body: { exerciseId, userSql: sql },
        });
        const lat = performance.now() - start;
        latencies.push(lat);
        if (res.status !== 200) errors.push(1);
      } catch {
        errors.push(1);
        latencies.push(performance.now() - start);
      }

      await new Promise((r) => setTimeout(r, 50 + Math.random() * 150));
    }
  }

  const users = Array.from({ length: concurrency }, (_, i) => userLoop(i));
  await Promise.all(users);

  return {
    latencies,
    errorCount: errors.length,
    requestCount: latencies.length,
  };
}

async function main() {
  console.log("BDD SQL Revision — Load Test");
  console.log(`API: ${API_URL}`);
  console.log("");

  const apiHealth = await apiCall("/health");
  console.log(`API health: ${JSON.stringify(apiHealth.body)}\n`);

  resetMetrics();

  const dqlExercise = getExercise("2.1.1");
  if (!dqlExercise) {
    console.error("Missing test exercise");
    process.exit(1);
  }

  console.log(
    `=== Base (${CONCURRENT_USERS} concurrent users, ${DURATION_MS / 1000}s) ===\n`,
  );
  const base = await runDqlLoad(CONCURRENT_USERS, DURATION_MS);

  const baseSorted = [...base.latencies].sort((a, b) => a - b);
  const baseErrorRate =
    base.requestCount > 0 ? base.errorCount / base.requestCount : 0;

  console.log(`DQL requests: ${base.requestCount}`);
  console.log(`DQL errors: ${base.errorCount}`);
  console.log(
    `DQL latency: avg=${(baseSorted.reduce((a, b) => a + b, 0) / baseSorted.length).toFixed(1)}ms p50=${percentile(baseSorted, 50).toFixed(1)}ms p95=${percentile(baseSorted, 95).toFixed(1)}ms p99=${percentile(baseSorted, 99).toFixed(1)}ms`,
  );
  console.log("");

  let passCount = 0;
  let totalChecks = 0;

  totalChecks += 1;
  if (
    evaluate(
      "DQL p95 latency",
      percentile(baseSorted, 95),
      PASS_TARGETS.dqlP95LatencyMs,
      "ms",
    )
  )
    passCount += 1;
  totalChecks += 1;
  if (
    evaluateMin(
      "DQL success rate",
      1 - baseErrorRate,
      1 - PASS_TARGETS.dqlErrorRate,
      "%",
    )
  )
    passCount += 1;

  console.log(
    `\n=== Burst (${BURST_USERS} concurrent, ${DURATION_MS / 1000}s) ===\n`,
  );
  const burst = await runDqlLoad(BURST_USERS, DURATION_MS);

  const burstSorted = [...burst.latencies].sort((a, b) => a - b);
  const burstErrorRate =
    burst.requestCount > 0 ? burst.errorCount / burst.requestCount : 0;

  console.log(`DQL requests: ${burst.requestCount}`);
  console.log(`DQL errors: ${burst.errorCount}`);
  console.log(
    `DQL latency: avg=${(burstSorted.reduce((a, b) => a + b, 0) / burstSorted.length).toFixed(1)}ms p50=${percentile(burstSorted, 50).toFixed(1)}ms p95=${percentile(burstSorted, 95).toFixed(1)}ms p99=${percentile(burstSorted, 99).toFixed(1)}ms`,
  );
  console.log("");

  totalChecks += 1;
  if (
    evaluate(
      "Burst DQL p95 latency",
      percentile(burstSorted, 95),
      BURST_TARGETS.dqlP95LatencyMs,
      "ms",
    )
  )
    passCount += 1;
  totalChecks += 1;
  if (
    evaluateMin(
      "Burst DQL success rate",
      1 - burstErrorRate,
      1 - BURST_TARGETS.dqlErrorRate,
      "%",
    )
  )
    passCount += 1;

  console.log(`\n=== DDL Submission Test ===\n`);
  const ddlStart = performance.now();
  const ddlResult = await apiCall("/validation.submit", {
    method: "POST",
    body: {
      exerciseId: "1.1",
      userSql:
        "CREATE TABLE CUSTOMER (customerId INT AUTO_INCREMENT PRIMARY KEY, customerName VARCHAR(150) NOT NULL, address TEXT, email VARCHAR(150) UNIQUE);",
    },
  });
  const ddlLatency = performance.now() - ddlStart;
  const ddlAccepted = ddlResult.status === 200;

  console.log(`DDL submit latency: ${ddlLatency.toFixed(1)}ms`);
  console.log(`DDL job accepted: ${ddlAccepted}`);

  totalChecks += 1;
  if (
    evaluateMin(
      "DDL job acceptance rate",
      ddlAccepted ? 1 : 0,
      PASS_TARGETS.ddlJobAcceptedRate,
      "%",
    )
  )
    passCount += 1;

  console.log(`\n=== Metrics Snapshot ===\n`);
  const metrics = getMetrics();
  console.log(JSON.stringify(metrics, null, 2));

  console.log(`\n=== Summary: ${passCount}/${totalChecks} targets passed ===`);
  process.exit(passCount === totalChecks ? 0 : 1);
}

void main();
