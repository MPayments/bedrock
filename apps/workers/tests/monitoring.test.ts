import {
  createWorkerMonitoringRegistry,
  renderWorkerMonitoringResponse,
} from "../src/monitoring";

describe("worker monitoring", () => {
  test("tracks worker state and renders health and metrics responses", () => {
    let now = 1_000;
    const registry = createWorkerMonitoringRegistry(() => now);
    const observer = registry.registerWorker({
      name: "ledger",
      intervalMs: 5_000,
    });

    observer.onLoopStarted?.();
    now += 10;
    observer.onTickStarted?.();
    now += 25;
    observer.onTickSucceeded?.({
      durationMs: 25,
      processed: 3,
      result: { processed: 3 },
    });

    const healthResponse = renderWorkerMonitoringResponse({
      url: "/health",
      registry,
    });
    expect(healthResponse.statusCode).toBe(200);
    expect(JSON.parse(healthResponse.body)).toMatchObject({
      status: "ok",
      workerCount: 1,
      workers: [
        {
          name: "ledger",
          state: "idle",
          totalRuns: 1,
          totalProcessed: 3,
          totalErrors: 0,
        },
      ],
    });

    const metricsResponse = renderWorkerMonitoringResponse({
      url: "/metrics",
      registry,
    });
    expect(metricsResponse.statusCode).toBe(200);
    expect(metricsResponse.body).toContain("multihansa_workers_health 1");
    expect(metricsResponse.body).toContain('multihansa_worker_runs_total{worker="ledger"} 1');
  });
});
