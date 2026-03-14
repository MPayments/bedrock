import { describe, expect, it } from "vitest";

import { schema } from "@bedrock/platform/postgres/schema";

describe("db schema exports", () => {
  it("does not expose removed module runtime tables", () => {
    expect("coreModuleStates" in schema).toBe(false);
    expect("coreModuleEvents" in schema).toBe(false);
    expect("coreModuleRuntimeMeta" in schema).toBe(false);
    expect(schema.documents).toBeDefined();
  });
});
