import { describe, expect, it, vi } from "vitest";

const CUSTOMER_GROUP_ID = "00000000-0000-4000-8000-000000000912";
const EXISTING_GROUP_ID = "00000000-0000-4000-8000-000000000911";

const groupRulesMocks = vi.hoisted(() => {
  return {
    enforceCustomerLinkRules: vi.fn(),
    ensureCustomerGroupForCustomer: vi.fn(async () => CUSTOMER_GROUP_ID),
    readMembershipIds: vi.fn(async () => [EXISTING_GROUP_ID]),
    replaceMemberships: vi.fn(async () => undefined),
    resolveGroupMembershipClassification: vi.fn(
      async () => ({
        customerScopeByGroupId: new Map(),
        customerScopedIds: new Set(),
      }),
    ),
    withoutRootGroups: vi.fn(async (_db, groupIds: string[]) => groupIds),
  };
});

vi.mock("../../src/internal/group-rules", () => groupRulesMocks);

import { createCounterpartiesService } from "../../src/service";

function makeCounterparty(overrides: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-4000-8000-000000000401",
    externalId: null,
    customerId: null,
    shortName: "Multihansa",
    fullName: "Multihansa fzco",
    description: null,
    country: null,
    kind: "legal_entity",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function insertReturning<T>(rows: T[]) {
  return {
    values: vi.fn(() => ({
      returning: vi.fn(async () => rows),
    })),
  };
}

function selectSingleRow<T>(rows: T[]) {
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(async () => rows),
      })),
    })),
  };
}

function updateReturning<T>(rows: T[]) {
  return {
    set: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(async () => rows),
      })),
    })),
  };
}

describe("counterparties service", () => {
  it("adds the managed customer group when creating a customer-linked counterparty", async () => {
    const created = makeCounterparty({
      customerId: "00000000-0000-4000-8000-000000000999",
    });
    const tx = {
      insert: vi.fn().mockReturnValue(insertReturning([created])),
      select: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      execute: vi.fn(),
    };
    const db = {
      transaction: vi.fn(async (fn: (tx: typeof tx) => Promise<unknown>) => fn(tx)),
    };

    const service = createCounterpartiesService({ db: db as any });
    const result = await service.create({
      shortName: created.shortName,
      fullName: created.fullName,
      kind: created.kind,
      customerId: created.customerId,
      groupIds: [EXISTING_GROUP_ID],
    });

    expect(result).toEqual({
      ...created,
      groupIds: [EXISTING_GROUP_ID, CUSTOMER_GROUP_ID],
    });
    expect(groupRulesMocks.ensureCustomerGroupForCustomer).toHaveBeenCalledWith(
      tx,
      created.customerId,
    );
    expect(groupRulesMocks.replaceMemberships).toHaveBeenCalledWith(
      tx,
      created.id,
      [EXISTING_GROUP_ID, CUSTOMER_GROUP_ID],
    );
  });

  it("drops previous customer-scoped groups before switching customers", async () => {
    const existing = makeCounterparty({
      customerId: "00000000-0000-4000-8000-000000000998",
    });
    const updated = makeCounterparty({
      customerId: "00000000-0000-4000-8000-000000000999",
      shortName: "Multihansa Updated",
    });
    const tx = {
      select: vi.fn().mockReturnValueOnce(selectSingleRow([existing])),
      update: vi.fn().mockReturnValueOnce(updateReturning([updated])),
      insert: vi.fn(),
      delete: vi.fn(),
      execute: vi.fn(),
    };
    const db = {
      transaction: vi.fn(async (fn: (tx: typeof tx) => Promise<unknown>) => fn(tx)),
    };

    groupRulesMocks.withoutRootGroups.mockResolvedValueOnce([EXISTING_GROUP_ID]);

    const service = createCounterpartiesService({ db: db as any });
    const result = await service.update(existing.id, {
      shortName: updated.shortName,
      customerId: updated.customerId,
    });

    expect(result).toEqual({
      ...updated,
      groupIds: [EXISTING_GROUP_ID, CUSTOMER_GROUP_ID],
    });
    expect(groupRulesMocks.withoutRootGroups).toHaveBeenCalledWith(tx, [
      EXISTING_GROUP_ID,
    ]);
    expect(groupRulesMocks.ensureCustomerGroupForCustomer).toHaveBeenCalledWith(
      tx,
      updated.customerId,
    );
    expect(groupRulesMocks.replaceMemberships).toHaveBeenCalledWith(
      tx,
      existing.id,
      [EXISTING_GROUP_ID, CUSTOMER_GROUP_ID],
    );
  });
});
