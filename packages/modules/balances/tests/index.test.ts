import { describe, expect, it } from "vitest";

import * as balances from "../src/index";

describe("balances public exports", () => {
  it("keeps runtime worker exports off the root barrel", () => {
    expect(balances.createBalancesService).toBeTypeOf("function");
    expect("createBalancesProjectorWorkerDefinition" in balances).toBe(false);
  });
});
