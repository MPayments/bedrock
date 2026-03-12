import { describe, expect, it } from "vitest";

import type { ModuleManifest } from "../../src/module-runtime";
import { createWorkerFleet } from "../../src/worker-runtime";

function createManifest(id: string, workerId: string, envKey: string): ModuleManifest {
  return {
    id,
    version: 1,
    kind: "domain",
    mutability: "mutable",
    description: id,
    enabledByDefault: true,
    scopeSupport: { global: true, book: true },
    capabilities: {
      workers: [
        {
          id: workerId,
          envKey,
          defaultIntervalMs: 1_000,
          description: `${workerId} worker`,
        },
      ],
    },
    dependencies: [],
  };
}

describe("createWorkerFleet", () => {
  it("throws when manifest workers are missing implementations", () => {
    const manifests = [createManifest("comp-a", "worker-a", "WORKER_A_INTERVAL_MS")];

    expect(() =>
      createWorkerFleet({
        manifests,
        workerImplementations: {},
      }),
    ).toThrow(/Missing worker implementations/);
  });

  it("throws when implementations include unknown worker ids", () => {
    const manifests = [createManifest("comp-a", "worker-a", "WORKER_A_INTERVAL_MS")];

    expect(() =>
      createWorkerFleet({
        manifests,
        workerImplementations: {
          "worker-a": {
            id: "worker-a",
            moduleId: "comp-a",
            intervalMs: 1_000,
            runOnce: async () => ({ processed: 0 }),
          },
          "worker-extra": {
            id: "worker-extra",
            moduleId: "comp-a",
            intervalMs: 1_000,
            runOnce: async () => ({ processed: 0 }),
          },
        },
      }),
    ).toThrow(/unknown worker ids/i);
  });

  it("throws for unknown selected worker ids", () => {
    const manifests = [createManifest("comp-a", "worker-a", "WORKER_A_INTERVAL_MS")];

    expect(() =>
      createWorkerFleet({
        manifests,
        workerImplementations: {
          "worker-a": {
            id: "worker-a",
            moduleId: "comp-a",
            intervalMs: 1_000,
            runOnce: async () => ({ processed: 0 }),
          },
        },
        selectedWorkerIds: ["worker-missing"],
      }),
    ).toThrow(/Unknown worker ids requested/);
  });

  it("deduplicates selected worker ids", () => {
    const manifests = [createManifest("comp-a", "worker-a", "WORKER_A_INTERVAL_MS")];
    const workers = createWorkerFleet({
      manifests,
      workerImplementations: {
        "worker-a": {
          id: "worker-a",
          moduleId: "comp-a",
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
