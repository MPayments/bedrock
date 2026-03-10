import { describe, expect, it } from "vitest";

import {
  createWorkerFleet,
  defineWorkerDescriptor,
  listWorkerIds,
  resolveWorkerIntervals,
} from "../../src/workers";

describe("@bedrock/common/workers", () => {
  it("lists worker ids deterministically", () => {
    const descriptors = [
      defineWorkerDescriptor({
        id: "b",
        envKey: "B_INTERVAL_MS",
        defaultIntervalMs: 2_000,
      }),
      defineWorkerDescriptor({
        id: "a",
        envKey: "A_INTERVAL_MS",
        defaultIntervalMs: 1_000,
      }),
    ];

    expect(listWorkerIds(descriptors)).toEqual(["a", "b"]);
  });

  it("resolves intervals from env and defaults", () => {
    const descriptors = [
      defineWorkerDescriptor({
        id: "ledger",
        envKey: "LEDGER_INTERVAL_MS",
        defaultIntervalMs: 5_000,
      }),
      defineWorkerDescriptor({
        id: "fx-rates",
        envKey: "FX_RATES_INTERVAL_MS",
        defaultIntervalMs: 60_000,
      }),
    ];

    expect(
      resolveWorkerIntervals({
        descriptors,
        env: {
          LEDGER_INTERVAL_MS: "7000",
        },
      }),
    ).toEqual({
      ledger: 7_000,
      "fx-rates": 60_000,
    });
  });

  it("creates a selected worker fleet", () => {
    const workers = createWorkerFleet({
      workers: {
        ledger: {
          id: "ledger",
          intervalMs: 5_000,
          runOnce: async () => ({ processed: 0 }),
        },
        documents: {
          id: "documents",
          intervalMs: 5_000,
          runOnce: async () => ({ processed: 0 }),
        },
      },
      selectedWorkerIds: ["documents"],
    });

    expect(workers.map((worker) => worker.id)).toEqual(["documents"]);
  });
});
