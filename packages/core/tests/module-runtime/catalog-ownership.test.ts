import { describe, expect, it } from "vitest";

import { BEDROCK_CORE_MODULE_MANIFESTS } from "../../src/module-runtime";

const APPLICATION_MODULE_IDS = new Set([
  "fees",
  "fx",
  "fx-rates",
  "ifrs-documents",
  "payments",
]);

describe("core module manifest ownership", () => {
  it("does not include application module manifests", () => {
    for (const manifest of BEDROCK_CORE_MODULE_MANIFESTS) {
      expect(APPLICATION_MODULE_IDS.has(manifest.id)).toBe(false);
    }
  });

  it("includes expected core worker ids", () => {
    const workerIds = BEDROCK_CORE_MODULE_MANIFESTS.flatMap(
      (manifest) => manifest.capabilities.workers?.map((worker) => worker.id) ?? [],
    );

    expect(workerIds).toEqual(
      expect.arrayContaining([
        "ledger",
        "documents",
        "documents-period-close",
        "balances",
      ]),
    );
  });
});
