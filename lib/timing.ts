export type Timings = Record<string, number>;

export async function time<T>(timings: Timings, key: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    timings[key] = performance.now() - start;
  }
}
