import { describe, expect, it } from "vitest";

import {
  BEDROCK_COMPONENT_MANIFESTS,
  BEDROCK_APPLICATION_COMPONENT_MANIFESTS,
} from "../../src/component-runtime";

describe("bedrock component manifest composition", () => {
  it("includes module component manifests", () => {
    const ids = new Set(BEDROCK_APPLICATION_COMPONENT_MANIFESTS.map((manifest) => manifest.id));

    expect(ids).toEqual(
      new Set(["accounting-reporting", "fees", "fx", "fx-rates", "payments"]),
    );
  });

  it("builds a unique composed manifest catalog", () => {
    const componentIds = BEDROCK_COMPONENT_MANIFESTS.map((manifest) => manifest.id);
    expect(new Set(componentIds).size).toBe(componentIds.length);

    const workers = BEDROCK_COMPONENT_MANIFESTS.flatMap((manifest) =>
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
