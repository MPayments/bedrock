import { describe, expect, it, vi } from "vitest";

import {
  CounterpartyCustomerNotFoundError,
  CounterpartyGroupNotFoundError,
  CounterpartyGroupRuleError,
} from "../../src/counterparties/errors";
import {
  assertCustomerExists,
  CUSTOMERS_ROOT_GROUP_CODE,
  ensureCustomerGroupForCustomer,
  ensureSystemRootGroups,
  readMembershipIds,
  readMembershipMap,
  replaceMemberships,
  resolveGroupMembershipClassification,
  TREASURY_INTERNAL_LEDGER_GROUP_CODE,
  TREASURY_ROOT_GROUP_CODE,
  withoutRootGroups,
} from "../../src/counterparties/internal/group-rules";

describe("group-rules internals", () => {
  it("classifies membership roots and scoped customers", async () => {
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(async () => [
          {
            id: "root-t",
            code: TREASURY_ROOT_GROUP_CODE,
            parentId: null,
            customerId: null,
          },
          {
            id: "root-c",
            code: CUSTOMERS_ROOT_GROUP_CODE,
            parentId: null,
            customerId: null,
          },
          {
            id: "team-t",
            code: "treasury-team",
            parentId: "root-t",
            customerId: null,
          },
          {
            id: "cust-scope",
            code: "customer:abc",
            parentId: "root-c",
            customerId: "cust-abc",
          },
          {
            id: "cust-leaf",
            code: "customer-leaf",
            parentId: "cust-scope",
            customerId: null,
          },
        ]),
      })),
    } as any;

    const result = await resolveGroupMembershipClassification(db, [
      "team-t",
      "cust-leaf",
      "team-t", // duplicate should be deduped
    ]);

    expect(result.hasTreasury).toBe(true);
    expect(result.hasCustomers).toBe(true);
    expect(result.rootsByGroupId.get("team-t")).toBe(TREASURY_ROOT_GROUP_CODE);
    expect(result.rootsByGroupId.get("cust-leaf")).toBe(CUSTOMERS_ROOT_GROUP_CODE);
    expect(result.customerScopeByGroupId.get("cust-leaf")).toBe("cust-abc");
    expect(result.customerScopedIds.has("cust-abc")).toBe(true);
  });

  it("returns empty classification for empty ids", async () => {
    const db = {
      select: vi.fn(),
    } as any;

    const result = await resolveGroupMembershipClassification(db, []);

    expect(result.hasTreasury).toBe(false);
    expect(result.hasCustomers).toBe(false);
    expect(result.rootsByGroupId.size).toBe(0);
    expect(db.select).not.toHaveBeenCalled();
  });

  it("throws when group is missing", async () => {
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(async () => [
          {
            id: "root-t",
            code: TREASURY_ROOT_GROUP_CODE,
            parentId: null,
            customerId: null,
          },
        ]),
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

    await expect(resolveGroupMembershipClassification(db, ["a"]))
      .rejects.toThrow(CounterpartyGroupRuleError);
  });

  it("filters out groups by root code", async () => {
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(async () => [
          {
            id: "root-t",
            code: TREASURY_ROOT_GROUP_CODE,
            parentId: null,
            customerId: null,
          },
          {
            id: "root-c",
            code: CUSTOMERS_ROOT_GROUP_CODE,
            parentId: null,
            customerId: null,
          },
          {
            id: "t1",
            code: "t1",
            parentId: "root-t",
            customerId: null,
          },
          {
            id: "c1",
            code: "c1",
            parentId: "root-c",
            customerId: null,
          },
        ]),
      })),
    } as any;

    const filtered = await withoutRootGroups(db, ["t1", "c1", "t1"], "treasury");
    expect(filtered).toEqual(["c1"]);
  });

  it("ensures system roots and returns their IDs", async () => {
    const tx = {
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          onConflictDoNothing: vi.fn(async () => undefined),
          onConflictDoUpdate: vi.fn(async () => undefined),
        })),
      })),
      select: vi.fn()
        .mockImplementationOnce(() => ({
          from: vi.fn(() => ({
            where: vi.fn(async () => [
              { id: "root-t", code: TREASURY_ROOT_GROUP_CODE },
              { id: "root-c", code: CUSTOMERS_ROOT_GROUP_CODE },
            ]),
          })),
        }))
        .mockImplementationOnce(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [{ id: "treasury-internal-ledger-group" }]),
            })),
          })),
        })),
    } as any;

    const roots = await ensureSystemRootGroups(tx);

    expect(roots).toEqual({
      treasuryGroupId: "root-t",
      customersGroupId: "root-c",
      treasuryInternalLedgerGroupId: "treasury-internal-ledger-group",
    });
    expect(tx.insert).toHaveBeenCalledTimes(3);
  });

  it("throws when system roots are unavailable", async () => {
    const tx = {
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          onConflictDoNothing: vi.fn(async () => undefined),
        })),
      })),
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(async () => [{ id: "root-t", code: TREASURY_ROOT_GROUP_CODE }]),
        })),
      })),
    } as any;

    await expect(ensureSystemRootGroups(tx)).rejects.toThrow(
      "System root groups are not available",
    );
  });

  it("ensures customer group by returning existing membership group", async () => {
    const tx = {
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          onConflictDoNothing: vi.fn(async () => undefined),
          onConflictDoUpdate: vi.fn(async () => undefined),
        })),
      })),
      select: vi.fn()
        .mockImplementationOnce(() => ({
          from: vi.fn(() => ({
            where: vi.fn(async () => [
              { id: "root-t", code: TREASURY_ROOT_GROUP_CODE },
              { id: "root-c", code: CUSTOMERS_ROOT_GROUP_CODE },
            ]),
          })),
        }))
        .mockImplementationOnce(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [{ id: TREASURY_INTERNAL_LEDGER_GROUP_CODE }]),
            })),
          })),
        }))
        .mockImplementationOnce(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [{ id: "cust-group-existing" }]),
            })),
          })),
        })),
    } as any;

    const result = await ensureCustomerGroupForCustomer(tx, "cust-1");
    expect(result).toBe("cust-group-existing");
  });

  it("creates customer group when missing", async () => {
    const tx = {
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          onConflictDoNothing: vi.fn(async () => undefined),
          onConflictDoUpdate: vi.fn(async () => undefined),
        })),
      })),
      select: vi.fn()
        .mockImplementationOnce(() => ({
          from: vi.fn(() => ({
            where: vi.fn(async () => [
              { id: "root-t", code: TREASURY_ROOT_GROUP_CODE },
              { id: "root-c", code: CUSTOMERS_ROOT_GROUP_CODE },
            ]),
          })),
        }))
        .mockImplementationOnce(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [{ id: TREASURY_INTERNAL_LEDGER_GROUP_CODE }]),
            })),
          })),
        }))
        .mockImplementationOnce(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => []),
            })),
          })),
        }))
        .mockImplementationOnce(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [{ displayName: "Alice" }]),
            })),
          })),
        }))
        .mockImplementationOnce(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [{ id: "cust-group-new" }]),
            })),
          })),
        })),
    } as any;

    const result = await ensureCustomerGroupForCustomer(tx, "cust-1");
    expect(result).toBe("cust-group-new");
    expect(tx.insert).toHaveBeenCalledTimes(4);
  });

  it("throws when customer is missing while ensuring customer group", async () => {
    const tx = {
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          onConflictDoNothing: vi.fn(async () => undefined),
          onConflictDoUpdate: vi.fn(async () => undefined),
        })),
      })),
      select: vi.fn()
        .mockImplementationOnce(() => ({
          from: vi.fn(() => ({
            where: vi.fn(async () => [
              { id: "root-t", code: TREASURY_ROOT_GROUP_CODE },
              { id: "root-c", code: CUSTOMERS_ROOT_GROUP_CODE },
            ]),
          })),
        }))
        .mockImplementationOnce(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [{ id: TREASURY_INTERNAL_LEDGER_GROUP_CODE }]),
            })),
          })),
        }))
        .mockImplementationOnce(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => []),
            })),
          })),
        }))
        .mockImplementationOnce(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => []),
            })),
          })),
        })),
    } as any;

    await expect(ensureCustomerGroupForCustomer(tx, "cust-1")).rejects.toThrow(
      CounterpartyCustomerNotFoundError,
    );
  });

  it("throws when created customer group cannot be found", async () => {
    const tx = {
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          onConflictDoNothing: vi.fn(async () => undefined),
          onConflictDoUpdate: vi.fn(async () => undefined),
        })),
      })),
      select: vi.fn()
        .mockImplementationOnce(() => ({
          from: vi.fn(() => ({
            where: vi.fn(async () => [
              { id: "root-t", code: TREASURY_ROOT_GROUP_CODE },
              { id: "root-c", code: CUSTOMERS_ROOT_GROUP_CODE },
            ]),
          })),
        }))
        .mockImplementationOnce(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [{ id: TREASURY_INTERNAL_LEDGER_GROUP_CODE }]),
            })),
          })),
        }))
        .mockImplementationOnce(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => []),
            })),
          })),
        }))
        .mockImplementationOnce(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [{ displayName: "Alice" }]),
            })),
          })),
        }))
        .mockImplementationOnce(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => []),
            })),
          })),
        })),
    } as any;

    await expect(ensureCustomerGroupForCustomer(tx, "cust-1")).rejects.toThrow(
      "Failed to ensure customer group for customer cust-1",
    );
  });

  it("asserts customer existence", async () => {
    const foundDb = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [{ id: "cust-1" }]),
          })),
        })),
      })),
    } as any;

    await expect(assertCustomerExists(foundDb, "cust-1")).resolves.toBeUndefined();

    const missingDb = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => []),
          })),
        })),
      })),
    } as any;

    await expect(assertCustomerExists(missingDb, "cust-404")).rejects.toThrow(
      CounterpartyCustomerNotFoundError,
    );
  });

  it("replaces memberships and reads membership IDs/map", async () => {
    const tx = {
      delete: vi.fn(() => ({
        where: vi.fn(async () => undefined),
      })),
      insert: vi.fn(() => ({
        values: vi.fn(async () => undefined),
      })),
    } as any;

    await replaceMemberships(tx, "cp-1", ["g1", "g2", "g1"]);
    expect(tx.delete).toHaveBeenCalledTimes(1);
    expect(tx.insert).toHaveBeenCalledTimes(1);

    await replaceMemberships(tx, "cp-2", []);
    expect(tx.delete).toHaveBeenCalledTimes(2);

    const dbForIds = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(async () => [{ groupId: "g1" }, { groupId: "g2" }]),
        })),
      })),
    } as any;

    await expect(readMembershipIds(dbForIds, "cp-1")).resolves.toEqual(["g1", "g2"]);

    const dbForMap = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(async () => [
            { counterpartyId: "cp-1", groupId: "g1" },
            { counterpartyId: "cp-1", groupId: "g2" },
            { counterpartyId: "cp-2", groupId: "g3" },
          ]),
        })),
      })),
    } as any;

    const map = await readMembershipMap(dbForMap, ["cp-1", "cp-2"]);
    expect(map.get("cp-1")).toEqual(["g1", "g2"]);
    expect(map.get("cp-2")).toEqual(["g3"]);

    const emptyMap = await readMembershipMap(dbForMap, []);
    expect(emptyMap.size).toBe(0);
  });
});
