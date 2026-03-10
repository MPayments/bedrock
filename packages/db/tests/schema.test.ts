import { describe, expect, it } from "vitest";

import { schema } from "../src/schema";

describe("db schema exports", () => {
  it("aggregates runtime schema without module-state tables", () => {
    expect(schema.ledgerOperations).toBeDefined();
    expect(schema.documents).toBeDefined();
    expect(schema.currencies).toBeDefined();
    expect("coreModuleStates" in schema).toBe(false);
    expect("coreModuleEvents" in schema).toBe(false);
    expect("coreModuleRuntimeMeta" in schema).toBe(false);
  });
});
