import { describe, expect, it } from "vitest";

import * as fx from "../src/index";

describe("fx public exports", () => {
  it("keeps runtime worker exports off the root barrel", () => {
    expect(fx.createFxService).toBeTypeOf("function");
    expect(fx.RateSourceStaleError).toBeTypeOf("function");
    expect("createFxRatesWorkerDefinition" in fx).toBe(false);
  });
});
