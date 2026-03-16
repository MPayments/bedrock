import { describe, expect, it } from "vitest";

import {
  createWorkerMonitoringRegistry,
  renderWorkerMonitoringResponse,
} from "../src/monitoring";

describe("worker monitoring", () => {
  it("tracks worker success and failure state", () => {
    let currentTime = 1_700_000_000_000;
    const registry = createWorkerMonitoringRegistry(() => currentTime);
    const observer = registry.registerWorker({
      name: "ledger",
      intervalMs: 5_000,
    });

    observer.onLoopStarted?.();
    observer.onTickStarted?.();
    observer.onTickSucceeded?.({
      durationMs: 12,
      processed: 3,
      result: 3,
    });

    let snapshot = registry.getHealthSnapshot();
    expect(snapshot.status).toBe("ok");
    expect(snapshot.workers).toEqual([
      expect.objectContaining({
        name: "ledger",
        state: "idle",
        totalRuns: 1,
        totalProcessed: 3,
        totalErrors: 0,
        lastDurationMs: 12,
        lastProcessed: 3,
        lastError: null,
      }),
    ]);

    currentTime += 1_000;
    observer.onTickStarted?.();
    observer.onTickFailed?.({
      durationMs: 7,
      error: new Error("boom"),
    });

    snapshot = registry.getHealthSnapshot();
    expect(snapshot.status).toBe("degraded");
    expect(snapshot.degradedWorkers).toEqual(["ledger"]);
    expect(snapshot.workers[0]).toEqual(
      expect.objectContaining({
        totalRuns: 2,
        totalProcessed: 3,
        totalErrors: 1,
        lastDurationMs: 7,
        lastError: "boom",
      }),
    );

    const metrics = registry.renderPrometheusMetrics();
    expect(metrics).toContain('bedrock_worker_runs_total{worker="ledger"} 2');
    expect(metrics).toContain(
      'bedrock_worker_processed_total{worker="ledger"} 3',
    );
    expect(metrics).toContain('bedrock_worker_errors_total{worker="ledger"} 1');
    expect(metrics).toContain(
      'bedrock_worker_state{worker="ledger",state="idle"} 1',
    );
  });

  it("renders health and metrics endpoint responses", () => {
    let currentTime = 1_700_000_100_000;
    const registry = createWorkerMonitoringRegistry(() => currentTime);
    const observer = registry.registerWorker({
      name: "balances",
      intervalMs: 1_000,
    });

    observer.onLoopStarted?.();
    observer.onTickStarted?.();
    currentTime += 500;
    observer.onTickSucceeded?.({
      durationMs: 5,
      processed: 1,
      result: 1,
    });

    const healthResponse = renderWorkerMonitoringResponse({
      url: "/health",
      registry,
    });
    expect(healthResponse.statusCode).toBe(200);
    expect(JSON.parse(healthResponse.body)).toEqual(
      expect.objectContaining({
        status: "ok",
        workerCount: 1,
        workers: [
          expect.objectContaining({
            name: "balances",
            totalProcessed: 1,
          }),
        ],
      }),
    );

    const metricsResponse = renderWorkerMonitoringResponse({
      url: "/metrics",
      registry,
    });
    expect(metricsResponse.statusCode).toBe(200);
    expect(metricsResponse.body).toContain(
      'bedrock_worker_processed_total{worker="balances"} 1',
    );
  });
});
