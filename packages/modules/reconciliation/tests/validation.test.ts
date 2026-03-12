import { describe, expect, it } from "vitest";

import { validateRunReconciliationInput } from "../src/validation";

describe("reconciliation validation", () => {
  it("requires source on runs", () => {
    expect(() =>
      validateRunReconciliationInput({
        rulesetChecksum: "ruleset-1",
        inputQuery: {},
      }),
    ).toThrow();
  });
});
