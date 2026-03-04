import { describe, expect, it } from "vitest";

import {
  BEDROCK_MODULE_MANIFESTS,
  BEDROCK_APPLICATION_MODULE_MANIFESTS,
} from "../../src/module-runtime";

describe("bedrock module manifest composition", () => {
  it("includes application module manifests", () => {
    const ids = new Set(
      BEDROCK_APPLICATION_MODULE_MANIFESTS.map((manifest) => manifest.id),
    );

    expect(ids).toEqual(
      new Set([
        "accounting-reporting",
        "fees",
        "fx",
        "fx-rates",
        "ifrs-documents",
        "payments",
      ]),
    );
  });

  it("builds a unique composed manifest catalog", () => {
    const moduleIds = BEDROCK_MODULE_MANIFESTS.map(
      (manifest) => manifest.id,
    );
    expect(new Set(moduleIds).size).toBe(moduleIds.length);

    const workers = BEDROCK_MODULE_MANIFESTS.flatMap((manifest) =>
      (manifest.capabilities.workers ?? []).map((worker) => ({
        workerId: worker.id,
        envKey: worker.envKey,
      })),
    );

    const workerIds = workers.map((worker) => worker.workerId);
    const workerEnvKeys = workers.map((worker) => worker.envKey);

    expect(new Set(workerIds).size).toBe(workerIds.length);
    expect(new Set(workerEnvKeys).size).toBe(workerEnvKeys.length);
  });
});
