import { describe, expect, it } from "vitest";

import { schema } from "../src/schema";

describe("db schema exports", () => {
  it("includes component runtime tables", () => {
    expect(schema.coreComponentStates).toBeDefined();
    expect(schema.coreComponentEvents).toBeDefined();
    expect(schema.coreComponentRuntimeMeta).toBeDefined();
  });
});
