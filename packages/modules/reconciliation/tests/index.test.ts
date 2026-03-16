import { describe, expect, it } from "vitest";

import * as reconciliation from "../src/index";

describe("reconciliation public exports", () => {
  it("keeps runtime worker exports off the root barrel", () => {
    expect(reconciliation.createReconciliationService).toBeTypeOf("function");
    expect("createReconciliationWorkerDefinition" in reconciliation).toBe(false);
  });
});
