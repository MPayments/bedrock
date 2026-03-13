import { describe, expect, it } from "vitest";

import { createWorkerFleet } from "../src/service";

const WORKER_CATALOG = [
  {
    id: "worker-a",
    envKey: "WORKER_A_INTERVAL_MS",
    defaultIntervalMs: 1_000,
    description: "Worker A",
  },
] as const;

describe("createWorkerFleet", () => {
  it("throws when configured workers are missing implementations", () => {
    expect(() =>
      createWorkerFleet({
        catalog: WORKER_CATALOG,
        workerImplementations: {},
      }),
    ).toThrow(/Missing worker implementations/);
  });

  it("throws when implementations include unknown worker ids", () => {
    expect(() =>
      createWorkerFleet({
        catalog: WORKER_CATALOG,
        workerImplementations: {
          "worker-a": {
            id: "worker-a",
            intervalMs: 1_000,
            runOnce: async () => ({ processed: 0 }),
          },
          "worker-extra": {
            id: "worker-extra",
            intervalMs: 1_000,
            runOnce: async () => ({ processed: 0 }),
          },
        },
      }),
    ).toThrow(/unknown worker ids/i);
  });

  it("throws for unknown selected worker ids", () => {
    expect(() =>
      createWorkerFleet({
        catalog: WORKER_CATALOG,
        workerImplementations: {
          "worker-a": {
            id: "worker-a",
            intervalMs: 1_000,
            runOnce: async () => ({ processed: 0 }),
          },
        },
        selectedWorkerIds: ["worker-missing"],
      }),
    ).toThrow(/Unknown worker ids requested/);
  });

  it("deduplicates selected worker ids", () => {
    const workers = createWorkerFleet({
      catalog: WORKER_CATALOG,
      workerImplementations: {
        "worker-a": {
          id: "worker-a",
          intervalMs: 1_000,
          runOnce: async () => ({ processed: 0 }),
        },
      },
      selectedWorkerIds: ["worker-a", "worker-a"],
    });

    expect(workers).toHaveLength(1);
    expect(workers[0]?.id).toBe("worker-a");
  });
});
