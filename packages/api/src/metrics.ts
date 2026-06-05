type MetricTags = Record<string, string>;

type HistogramBucket = { count: number; sum: number; min: number; max: number };

type MetricsState = {
  counters: Map<string, number>;
  histograms: Map<string, HistogramBucket>;
};

const state: MetricsState = {
  counters: new Map(),
  histograms: new Map(),
};

export function incrementCounter(name: string, tags?: MetricTags) {
  const key = buildKey(name, tags);
  state.counters.set(key, (state.counters.get(key) ?? 0) + 1);
}

export function recordHistogram(
  name: string,
  value: number,
  tags?: MetricTags,
) {
  const key = buildKey(name, tags);
  const existing = state.histograms.get(key);
  if (existing) {
    existing.count += 1;
    existing.sum += value;
    if (value < existing.min) existing.min = value;
    if (value > existing.max) existing.max = value;
  } else {
    state.histograms.set(key, { count: 1, sum: value, min: value, max: value });
  }
}

export function getMetrics() {
  const counters: Record<string, number> = {};
  for (const [key, value] of state.counters) {
    counters[key] = value;
  }

  const histograms: Record<
    string,
    { count: number; avg: number; min: number; max: number }
  > = {};
  for (const [key, bucket] of state.histograms) {
    histograms[key] = {
      count: bucket.count,
      avg: bucket.count > 0 ? bucket.sum / bucket.count : 0,
      min: bucket.min,
      max: bucket.max,
    };
  }

  return { counters, histograms };
}

export function resetMetrics() {
  state.counters.clear();
  state.histograms.clear();
}

function buildKey(name: string, tags?: MetricTags) {
  if (!tags || Object.keys(tags).length === 0) return name;
  const tagStr = Object.entries(tags)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}`)
    .join(",");
  return `${name}{${tagStr}}`;
}

export function wrapWithLatency<T extends (...args: unknown[]) => unknown>(
  metricName: string,
  fn: T,
  tags?: MetricTags,
): T {
  return (async (...args: unknown[]) => {
    const start = performance.now();
    try {
      return await fn(...args);
    } finally {
      recordHistogram(metricName, performance.now() - start, tags);
    }
  }) as unknown as T;
}
