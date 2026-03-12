import { describe, expect, it } from "vitest";

import { DORMANT_MODULE_IDS } from "@bedrock/app/module-runtime";

import {
  BEDROCK_MODULE_MANIFESTS,
} from "../../src/module-runtime";

describe("bedrock module manifest composition", () => {
  it("includes merged runtime module manifests", () => {
    const ids = new Set(
      BEDROCK_MODULE_MANIFESTS.map((manifest) => manifest.id),
    );

    for (const id of [
      "accounting",
      "documents",
      "fees",
      "fx",
      "fx-rates",
      "ifrs-documents",
      "ledger",
      "payments",
    ]) {
      expect(ids.has(id)).toBe(true);
    }
  });

  it("does not expose dormant or merged submodule module IDs", () => {
    const moduleIds = BEDROCK_MODULE_MANIFESTS.map((manifest) => manifest.id);

    expect(moduleIds).not.toContain("accounting-reporting");
    for (const dormantModuleId of DORMANT_MODULE_IDS) {
      expect(moduleIds).not.toContain(dormantModuleId);
    }
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
