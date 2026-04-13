import { describe, expect, it } from "vitest";

import {
  admin,
  agent,
  customer,
  finance,
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

  it("grants calculations permissions to internal roles only", () => {
    expect((admin as any).statements.calculations).toEqual([
      "create",
      "list",
      "update",
      "delete",
    ]);
    expect((user as any).statements.calculations).toEqual([
      "create",
      "list",
      "update",
      "delete",
    ]);
    expect((agent as any).statements.calculations).toEqual([
      "create",
      "list",
      "update",
      "delete",
    ]);
    expect((customer as any).statements.calculations).toBeUndefined();
  });

  it("grants deals permissions to internal roles only", () => {
    expect((admin as any).statements.deals).toEqual([
      "create",
      "list",
      "update",
      "delete",
    ]);
    expect((user as any).statements.deals).toEqual([
      "create",
      "list",
      "update",
      "delete",
    ]);
    expect((agent as any).statements.deals).toEqual([
      "create",
      "list",
      "update",
      "delete",
    ]);
    expect((customer as any).statements.deals).toBeUndefined();
  });

  it("grants finance users post and cancel permissions for documents", () => {
    expect((finance as any).statements.documents).toEqual([
      "create",
      "list",
      "get",
      "update",
      "submit",
      "post",
      "cancel",
    ]);
  });

  it("grants reconciliation permissions to admin and finance roles only", () => {
    expect((admin as any).statements.reconciliation).toEqual([
      "list",
      "run",
      "resolve",
      "ignore",
    ]);
    expect((finance as any).statements.reconciliation).toEqual([
      "list",
      "run",
      "resolve",
      "ignore",
    ]);
    expect((user as any).statements.reconciliation).toBeUndefined();
    expect((agent as any).statements.reconciliation).toBeUndefined();
    expect((customer as any).statements.reconciliation).toBeUndefined();
  });
});
