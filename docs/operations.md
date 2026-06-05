## Operations: BDD SQL Revision

### Health & Readiness

`GET /health` — returns process health + dependency status:

```json
{
  "status": "ok" | "degraded",
  "checks": {
    "db": "ok" | "unhealthy",
    "redis": "ok" | "disconnected" | "unavailable"
  },
  "uptime": 123.4,
  "dbPool": { "active": 3, "configLimit": 80 }
}
```

- **status `ok`**: All dependencies healthy.
- **status `degraded`**: One or more dependencies unhealthy. The service may still function with degraded behavior (e.g., in-memory rate limiting when Redis is down).

### Key Metrics

`GET /metrics` — returns counters + histograms:

| Metric | Type | What it tracks |
|---|---|---|
| `bdd.sql.duration{kind,outcome}` | Histogram | SQL execution latency by query kind and error |
| `bdd.sql.rejected{reason}` | Counter | Rejected SQL by reason (BAD_REQUEST, etc.) |
| `bdd.validation.duration{mode,passed}` | Histogram | Full validation round-trip time |
| `bdd.ddl.job.duration{outcome}` | Histogram | DDL job processing time in worker |
| `bdd.ddl.job.failed` | Counter | DDL job failures |
| `bdd.worker.loop.error` | Counter | Unexpected worker loop errors |

### Bottleneck Inspection During a Class/Session

1. **High DQL latency (p50 > 500ms)**:
   - Check `bdd.sql.duration` histogram — is the DB slow?
   - Check DB pool active count via `/health` — are connections exhausted?
   - Check API resource limits — is the container CPU-throttled?

2. **High DDL job queue depth**:
   - The Redis key `bdd:jobs:pending` (LLEN) shows pending job count.
   - Scale worker replicas if `DDL_JOB_CONCURRENCY` is maxed.
   - Check `bdd.ddl.job.duration` for abnormally long jobs.

3. **High error rate on DQL submissions**:
   - Check `bdd.sql.rejected{reason}` for rate-limiting or safety rejections.
   - If `TOO_MANY_REQUESTS` dominates, consider adjusting rate limits.
   - If `BAD_REQUEST` dominates, students are submitting unsupported SQL.

4. **Redis unavailable**:
   - Rate limiting falls back to in-memory (single-instance safe).
   - DDL job queue stops — jobs cannot be enqueued or processed.
   - Restart Redis and verify `GET /health` shows `redis: ok`.

### Load-Test Pass/Fail Targets

Run: `bun load-test.ts`

| Scenario | Target | Criterion |
|---|---|---|
| Base (200 users) | DQL p95 latency ≤ 700ms | DQL response time |
| Base (200 users) | DQL error rate ≤ 2% | Submission reliability |
| Base (200 users) | DDL job acceptance ≥ 99% | Queue availability |
| Base (200 users) | DDL job completion p95 ≤ 5s | Async job speed |
| Burst (300 users) | DQL p95 latency ≤ 1500ms | Overload resilience |
| Burst (300 users) | DQL error rate ≤ 5% | Graceful degradation |
| Burst (300 users) | DDL job acceptance ≥ 95% | Queue under load |
| Burst (300 users) | DDL job completion p95 ≤ 10s | Worker throughput |

### Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `DDL_JOB_CONCURRENCY` | `2` | Max parallel DDL jobs per worker |
| `SQL_MAX_LENGTH` | `10000` | Max SQL query length |
| `SQL_EXECUTION_TIMEOUT_MS` | `3000` | SQL query timeout |
| `SQL_MAX_RESULT_ROWS` | `500` | Max result rows |
| `SQL_MAX_RESPONSE_BYTES` | `1000000` | Max response size |
| `DB_RESEED_TOKEN` | unset | Required for admin reseed |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
