import { describe, expect, it } from "vitest";

import { schema } from "../src/schema";

describe("db schema exports", () => {
  it("includes module runtime tables", () => {
    expect(schema.coreModuleStates).toBeDefined();
    expect(schema.coreModuleEvents).toBeDefined();
    expect(schema.coreModuleRuntimeMeta).toBeDefined();
  });
});
