import { describe, expect, it } from "vitest";

import { BEDROCK_MODULE_MANIFESTS } from "../../src/module-runtime";

describe("module manifest catalog", () => {
  it("includes expected runtime modules", () => {
    const moduleIds = BEDROCK_MODULE_MANIFESTS.map((manifest) => manifest.id);

    expect(moduleIds).toEqual(
      expect.arrayContaining([
        "ledger",
        "documents",
        "balances",
        "fees",
        "fx",
        "fx-rates",
        "ifrs-documents",
        "payments",
      ]),
    );
  });

  it("includes expected core worker ids", () => {
    const workerIds = BEDROCK_MODULE_MANIFESTS.flatMap(
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
