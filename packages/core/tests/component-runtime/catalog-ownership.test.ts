import { describe, expect, it } from "vitest";

import { BEDROCK_CORE_COMPONENT_MANIFESTS } from "../../src/component-runtime";

const MODULE_COMPONENT_IDS = new Set([
  "accounting-reporting",
  "fees",
  "fx",
  "fx-rates",
  "payments",
]);

describe("core component manifest ownership", () => {
  it("does not include module-owned component manifests", () => {
    for (const manifest of BEDROCK_CORE_COMPONENT_MANIFESTS) {
      expect(MODULE_COMPONENT_IDS.has(manifest.id)).toBe(false);
    }
  });

  it("includes expected core worker ids", () => {
    const workerIds = BEDROCK_CORE_COMPONENT_MANIFESTS.flatMap(
      (manifest) => manifest.capabilities.workers?.map((worker) => worker.id) ?? [],
    );

    expect(workerIds).toEqual(
      expect.arrayContaining([
        "ledger",
        "documents",
        "balances",
        "reconciliation",
        "connectors-dispatch",
        "connectors-poller",
        "connectors-statements",
        "orchestration-retry",
      ]),
    );
  });
});
