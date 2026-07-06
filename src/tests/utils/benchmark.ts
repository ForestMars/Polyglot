// src/test/utils/benchmark.ts 
export async function measureLatency(fn: () => Promise<void>, runs = 10) {
  const latencies: number[] = [];

  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    await fn();
    const end = performance.now();
    latencies.push(end - start);
  }

  latencies.sort((a, b) => a - b);

  return {
    latencies,
    median: latencies[Math.floor(latencies.length / 2)],
    p95: latencies[Math.floor(latencies.length * 0.95)],
    min: latencies[0],
    max: latencies[latencies.length - 1],
  };
}