import { describe, expect, it } from "vitest";

import * as treasury from "../src/index";

describe("treasury public exports", () => {
  it("keeps runtime worker exports off the root barrel", () => {
    expect(treasury.createTreasuryModule).toBeTypeOf("function");
    expect(treasury.RateSourceStaleError).toBeTypeOf("function");
    expect("createTreasuryRatesWorkerDefinition" in treasury).toBe(false);
  });
});
