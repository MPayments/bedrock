import { describe, expect, it, vi } from "vitest";

import {
  CounterpartyCustomerNotFoundError,
  CounterpartyGroupNotFoundError,
  CounterpartyGroupRuleError,
} from "../../src/errors";
import {
  assertCustomerExists,
  readMembershipIds,
  readMembershipMap,
  replaceMemberships,
  resolveGroupMembershipClassification,
  withoutRootGroups,
} from "../../src/internal/group-rules";

describe("group-rules internals", () => {
  it("classifies customer-scoped membership by ancestry", async () => {
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(async () => [
          {
            id: "shared-root",
            code: "shared-root",
            parentId: null,
            customerId: null,
          },
          {
            id: "customer-root",
            code: "customer:abc",
            parentId: null,
            customerId: "cust-abc",
          },
          {
            id: "customer-leaf",
            code: "customer-leaf",
            parentId: "customer-root",
            customerId: null,
          },
          {
            id: "shared-leaf",
            code: "shared-leaf",
            parentId: "shared-root",
            customerId: null,
          },
        ]),
      })),
    } as any;

    const result = await resolveGroupMembershipClassification(db, [
      "customer-leaf",
      "shared-leaf",
      "customer-leaf",
    ]);

    expect(result.customerScopeByGroupId.get("customer-leaf")).toBe("cust-abc");
    expect(result.customerScopeByGroupId.get("shared-leaf")).toBeNull();
    expect(result.customerScopedIds).toEqual(new Set(["cust-abc"]));
  });

  it("returns empty classification for empty ids", async () => {
    const db = {
      select: vi.fn(),
    } as any;

    const result = await resolveGroupMembershipClassification(db, []);

    expect(result.customerScopeByGroupId.size).toBe(0);
    expect(result.customerScopedIds.size).toBe(0);
    expect(db.select).not.toHaveBeenCalled();
  });

  it("throws when group is missing", async () => {
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(async () => []),
      })),
    } as any;

    await expect(
      resolveGroupMembershipClassification(db, ["missing-group"]),
    ).rejects.toThrow(CounterpartyGroupNotFoundError);
  });

  it("throws on group hierarchy loop", async () => {
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(async () => [
          {
            id: "a",
            code: "a",
            parentId: "b",
            customerId: null,
          },
          {
            id: "b",
            code: "b",
            parentId: "a",
            customerId: null,
          },
        ]),
      })),
    } as any;

    await expect(resolveGroupMembershipClassification(db, ["a"])).rejects.toThrow(
      CounterpartyGroupRuleError,
    );
  });

  it("filters out customer-scoped groups", async () => {
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(async () => [
          {
            id: "customer-root",
            code: "customer:abc",
            parentId: null,
            customerId: "cust-abc",
          },
          {
            id: "customer-leaf",
            code: "customer-leaf",
            parentId: "customer-root",
            customerId: null,
          },
          {
            id: "shared-leaf",
            code: "shared-leaf",
            parentId: null,
            customerId: null,
          },
        ]),
      })),
    } as any;

    const filtered = await withoutRootGroups(db, [
      "customer-leaf",
      "shared-leaf",
      "customer-leaf",
    ]);

    expect(filtered).toEqual(["shared-leaf"]);
  });

  it("throws when asserted customer does not exist", async () => {
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => []),
          })),
        })),
      })),
    } as any;

    await expect(assertCustomerExists(db, "cust-missing")).rejects.toThrow(
      CounterpartyCustomerNotFoundError,
    );
  });

  it("reads and replaces memberships", async () => {
    const tx = {
      delete: vi.fn(() => ({
        where: vi.fn(async () => undefined),
      })),
      insert: vi.fn(() => ({
        values: vi.fn(async () => undefined),
      })),
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(async () => [
            { groupId: "group-1" },
            { groupId: "group-2" },
          ]),
        })),
      })),
    } as any;

    await replaceMemberships(tx, "cp-1", ["group-1", "group-2", "group-1"]);
    const membershipIds = await readMembershipIds(tx, "cp-1");
    const membershipMap = await readMembershipMap(
      {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(async () => [
              { counterpartyId: "cp-1", groupId: "group-1" },
              { counterpartyId: "cp-1", groupId: "group-2" },
              { counterpartyId: "cp-2", groupId: "group-3" },
            ]),
          })),
        })),
      } as any,
      ["cp-1", "cp-2"],
    );

    expect(tx.delete).toHaveBeenCalled();
    expect(tx.insert).toHaveBeenCalled();
    expect(membershipIds).toEqual(["group-1", "group-2"]);
    expect(membershipMap).toEqual(
      new Map([
        ["cp-1", ["group-1", "group-2"]],
        ["cp-2", ["group-3"]],
      ]),
    );
  });
});
