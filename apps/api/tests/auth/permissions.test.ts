import { describe, expect, it } from "vitest";

import {
  admin,
  agent,
  customer,
  user,
} from "../../src/auth/permissions";

describe("auth permissions", () => {
  it("grants agreements permissions to internal roles", () => {
    expect((admin as any).statements.agreements).toEqual([
      "create",
      "list",
      "update",
      "delete",
    ]);
    expect((user as any).statements.agreements).toEqual([
      "create",
      "list",
      "update",
      "delete",
    ]);
    expect((agent as any).statements.agreements).toEqual([
      "create",
      "list",
      "update",
      "delete",
    ]);
  });

  it("does not grant agreements permissions to customer users", () => {
    expect((customer as any).statements.agreements).toBeUndefined();
  });
});
