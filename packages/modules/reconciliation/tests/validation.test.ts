import { describe, expect, it } from "vitest";

import { RunReconciliationInputSchema } from "../src/contracts";

describe("reconciliation validation", () => {
  it("requires source on runs", () => {
    expect(() =>
      RunReconciliationInputSchema.parse({
        rulesetChecksum: "ruleset-1",
        inputQuery: {},
        idempotencyKey: "idem-1",
      }),
    ).toThrow();
  });
});
