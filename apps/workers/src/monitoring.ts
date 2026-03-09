import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import { type Logger } from "@bedrock/common";

type WorkerState = "created" | "idle" | "running" | "stopped";
type HealthStatus = "ok" | "degraded";

interface WorkerRuntimeState {
  name: string;
  intervalMs: number;
  state: WorkerState;
  startedAt: number | null;
  lastRunStartedAt: number | null;
  lastRunFinishedAt: number | null;
  lastSuccessAt: number | null;
  lastErrorAt: number | null;
  lastDurationMs: number | null;
  lastProcessed: number | null;
  lastError: string | null;
  totalRuns: number;
  totalProcessed: number;
  totalErrors: number;
}

export interface RunLoopObserver {
  onLoopStarted?: () => void;
  onTickStarted?: () => void;
  onTickSucceeded?: (input: {
    durationMs: number;
    processed: number;
    result: unknown;
  }) => void;
  onTickFailed?: (input: { durationMs: number; error: unknown }) => void;
  onLoopStopped?: () => void;
}

export interface WorkerHealthSnapshot {
  status: HealthStatus;
  checkedAt: string;
  workerCount: number;
  degradedWorkers: string[];
  workers: {
    name: string;
    intervalMs: number;
    state: WorkerState;
    startedAt: string | null;
    lastRunStartedAt: string | null;
    lastRunFinishedAt: string | null;
    lastSuccessAt: string | null;
    lastErrorAt: string | null;
    lastDurationMs: number | null;
    lastProcessed: number | null;
    lastError: string | null;
    totalRuns: number;
    totalProcessed: number;
    totalErrors: number;
  }[];
}

export interface WorkerMonitoringRegistry {
  registerWorker: (input: {
    name: string;
    intervalMs: number;
  }) => RunLoopObserver;
  getHealthSnapshot: () => WorkerHealthSnapshot;
  renderPrometheusMetrics: () => string;
}

export interface WorkerMonitoringServer {
  host: string;
  port: number;
  stop: () => Promise<void>;
}

export interface WorkerMonitoringHttpResponse {
  statusCode: number;
  contentType: string;
  body: string;
}

function toIsoString(value: number | null): string | null {
  return value === null ? null : new Date(value).toISOString();
}

function toUnixSeconds(value: number | null): number | null {
  return value === null ? null : value / 1000;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function escapeLabelValue(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function formatMetric(
  name: string,
  value: number,
  labels?: Record<string, string>,
) {
  const renderedLabels = labels
    ? `{${Object.entries(labels)
        .map(([key, labelValue]) => `${key}="${escapeLabelValue(labelValue)}"`)
        .join(",")}}`
    : "";
  return `${name}${renderedLabels} ${value}`;
}

export function createWorkerMonitoringRegistry(
  now: () => number = () => Date.now(),
): WorkerMonitoringRegistry {
  const workers = new Map<string, WorkerRuntimeState>();

  function ensureWorker(input: { name: string; intervalMs: number }) {
    const existing = workers.get(input.name);
    if (existing) {
      existing.intervalMs = input.intervalMs;
      return existing;
    }

    const created: WorkerRuntimeState = {
      name: input.name,
      intervalMs: input.intervalMs,
      state: "created",
      startedAt: null,
      lastRunStartedAt: null,
      lastRunFinishedAt: null,
      lastSuccessAt: null,
      lastErrorAt: null,
      lastDurationMs: null,
      lastProcessed: null,
      lastError: null,
      totalRuns: 0,
      totalProcessed: 0,
      totalErrors: 0,
    };
    workers.set(input.name, created);
    return created;
  }

  function registerWorker(input: {
    name: string;
    intervalMs: number;
  }): RunLoopObserver {
    const worker = ensureWorker(input);

    return {
      onLoopStarted() {
        worker.state = "idle";
        worker.startedAt ??= now();
      },
      onTickStarted() {
        worker.state = "running";
        worker.lastRunStartedAt = now();
        worker.totalRuns += 1;
      },
      onTickSucceeded({ durationMs, processed }) {
        const completedAt = now();
        worker.state = "idle";
        worker.lastRunFinishedAt = completedAt;
        worker.lastSuccessAt = completedAt;
        worker.lastDurationMs = durationMs;
        worker.lastProcessed = processed;
        worker.lastError = null;
        worker.totalProcessed += processed;
      },
      onTickFailed({ durationMs, error }) {
        const completedAt = now();
        worker.state = "idle";
        worker.lastRunFinishedAt = completedAt;
        worker.lastErrorAt = completedAt;
        worker.lastDurationMs = durationMs;
        worker.lastProcessed = 0;
        worker.lastError = toErrorMessage(error);
        worker.totalErrors += 1;
      },
      onLoopStopped() {
        worker.state = "stopped";
      },
    };
  }

  function getHealthSnapshot(): WorkerHealthSnapshot {
    const checkedAt = now();
    const workerStates = Array.from(workers.values())
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((worker) => ({
        name: worker.name,
        intervalMs: worker.intervalMs,
        state: worker.state,
        startedAt: toIsoString(worker.startedAt),
        lastRunStartedAt: toIsoString(worker.lastRunStartedAt),
        lastRunFinishedAt: toIsoString(worker.lastRunFinishedAt),
        lastSuccessAt: toIsoString(worker.lastSuccessAt),
        lastErrorAt: toIsoString(worker.lastErrorAt),
        lastDurationMs: worker.lastDurationMs,
        lastProcessed: worker.lastProcessed,
        lastError: worker.lastError,
        totalRuns: worker.totalRuns,
        totalProcessed: worker.totalProcessed,
        totalErrors: worker.totalErrors,
      }));

    const degradedWorkers = workerStates
      .filter(
        (worker) =>
          worker.state === "stopped" ||
          (worker.lastErrorAt !== null &&
            (worker.lastSuccessAt === null ||
              worker.lastErrorAt > worker.lastSuccessAt)),
      )
      .map((worker) => worker.name);

    return {
      status: degradedWorkers.length === 0 ? "ok" : "degraded",
      checkedAt: new Date(checkedAt).toISOString(),
      workerCount: workerStates.length,
      degradedWorkers,
      workers: workerStates,
    };
  }

  function renderPrometheusMetrics() {
    const snapshot = getHealthSnapshot();
    const lines = [
      "# HELP bedrock_workers_health Overall workers health status (1=ok, 0=degraded).",
      "# TYPE bedrock_workers_health gauge",
      formatMetric("bedrock_workers_health", snapshot.status === "ok" ? 1 : 0),
      "# HELP bedrock_worker_up Worker process availability (1=running/idle, 0=stopped).",
      "# TYPE bedrock_worker_up gauge",
      "# HELP bedrock_worker_runs_total Total worker loop iterations.",
      "# TYPE bedrock_worker_runs_total counter",
      "# HELP bedrock_worker_processed_total Total processed records reported by the worker.",
      "# TYPE bedrock_worker_processed_total counter",
      "# HELP bedrock_worker_errors_total Total failed worker loop iterations.",
      "# TYPE bedrock_worker_errors_total counter",
      "# HELP bedrock_worker_last_duration_ms Duration of the last worker iteration in milliseconds.",
      "# TYPE bedrock_worker_last_duration_ms gauge",
      "# HELP bedrock_worker_last_success_timestamp_seconds Unix timestamp of the last successful worker iteration.",
      "# TYPE bedrock_worker_last_success_timestamp_seconds gauge",
      "# HELP bedrock_worker_last_error_timestamp_seconds Unix timestamp of the last failed worker iteration.",
      "# TYPE bedrock_worker_last_error_timestamp_seconds gauge",
      "# HELP bedrock_worker_state Current worker state label.",
      "# TYPE bedrock_worker_state gauge",
    ];

    for (const worker of snapshot.workers) {
      const labels = { worker: worker.name };
      lines.push(
        formatMetric(
          "bedrock_worker_up",
          worker.state === "stopped" ? 0 : 1,
          labels,
        ),
      );
      lines.push(
        formatMetric("bedrock_worker_runs_total", worker.totalRuns, labels),
      );
      lines.push(
        formatMetric(
          "bedrock_worker_processed_total",
          worker.totalProcessed,
          labels,
        ),
      );
      lines.push(
        formatMetric("bedrock_worker_errors_total", worker.totalErrors, labels),
      );
      lines.push(
        formatMetric(
          "bedrock_worker_last_duration_ms",
          worker.lastDurationMs ?? 0,
          labels,
        ),
      );

      const lastSuccess = toUnixSeconds(
        worker.lastSuccessAt ? Date.parse(worker.lastSuccessAt) : null,
      );
      if (lastSuccess !== null) {
        lines.push(
          formatMetric(
            "bedrock_worker_last_success_timestamp_seconds",
            lastSuccess,
            labels,
          ),
        );
      }

      const lastError = toUnixSeconds(
        worker.lastErrorAt ? Date.parse(worker.lastErrorAt) : null,
      );
      if (lastError !== null) {
        lines.push(
          formatMetric(
            "bedrock_worker_last_error_timestamp_seconds",
            lastError,
            labels,
          ),
        );
      }

      for (const state of ["created", "idle", "running", "stopped"] as const) {
        lines.push(
          formatMetric("bedrock_worker_state", worker.state === state ? 1 : 0, {
            worker: worker.name,
            state,
          }),
        );
      }
    }

    return `${lines.join("\n")}\n`;
  }

  return {
    registerWorker,
    getHealthSnapshot,
    renderPrometheusMetrics,
  };
}

export function renderWorkerMonitoringResponse(input: {
  url?: string | null;
  registry: WorkerMonitoringRegistry;
}): WorkerMonitoringHttpResponse {
  const url = input.url ?? "/";

  if (url === "/health") {
    const snapshot = input.registry.getHealthSnapshot();
    return {
      statusCode: snapshot.status === "ok" ? 200 : 503,
      contentType: "application/json; charset=utf-8",
      body: `${JSON.stringify(snapshot)}\n`,
    };
  }

  if (url === "/metrics") {
    return {
      statusCode: 200,
      contentType: "text/plain; version=0.0.4; charset=utf-8",
      body: input.registry.renderPrometheusMetrics(),
    };
  }

  return {
    statusCode: 200,
    contentType: "application/json; charset=utf-8",
    body: `${JSON.stringify({
      service: "multihansa-workers",
      endpoints: ["/health", "/metrics"],
    })}\n`,
  };
}

export async function startWorkerMonitoringServer(input: {
  host: string;
  port: number;
  registry: WorkerMonitoringRegistry;
  logger?: Logger;
}): Promise<WorkerMonitoringServer> {
  const server = createServer((req, res) => {
    const response = renderWorkerMonitoringResponse({
      url: req.url,
      registry: input.registry,
    });
    res.statusCode = response.statusCode;
    res.setHeader("content-type", response.contentType);
    res.end(response.body);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(input.port, input.host, () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address() as AddressInfo;
  input.logger?.info("Worker monitoring server started", {
    host: input.host,
    port: address.port,
  });

  return {
    host: input.host,
    port: address.port,
    stop: async () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      }),
  };
}
