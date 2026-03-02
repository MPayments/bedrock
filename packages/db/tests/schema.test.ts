import { describe, expect, it } from "vitest";

import { schema } from "../src/schema";

describe("db schema exports", () => {
  it("includes component runtime tables", () => {
    expect(schema.platformComponentStates).toBeDefined();
    expect(schema.platformComponentEvents).toBeDefined();
    expect(schema.platformComponentRuntimeMeta).toBeDefined();
  });
});
