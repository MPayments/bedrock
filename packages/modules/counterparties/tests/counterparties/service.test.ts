import { describe, expect, it, vi } from "vitest";

const defaultBookMocks = vi.hoisted(() => {
  return {
    ensureInternalLedgerDefaultBookIdTx: vi.fn(
      async () => "00000000-0000-4000-8000-000000000701",
    ),
  };
});

const TREASURY_INTERNAL_GROUP_ID = "00000000-0000-4000-8000-000000000910";
const EXISTING_GROUP_ID = "00000000-0000-4000-8000-000000000911";

const groupRulesMocks = vi.hoisted(() => {
  return {
    enforceCustomerLinkRules: vi.fn(),
    ensureCustomerGroupForCustomer: vi.fn(
      async () => "00000000-0000-4000-8000-000000000912",
    ),
    ensureSystemRootGroups: vi.fn(
      async () =>
        ({
          treasuryGroupId: "00000000-0000-4000-8000-000000000913",
          customersGroupId: "00000000-0000-4000-8000-000000000914",
          treasuryInternalLedgerGroupId: TREASURY_INTERNAL_GROUP_ID,
        }),
    ),
    readMembershipIds: vi.fn(async () => [EXISTING_GROUP_ID]),
    replaceMemberships: vi.fn(async () => undefined),
    resolveGroupMembershipClassification: vi.fn(
      async () =>
        ({
          rootsByGroupId: new Map(),
          customerScopeByGroupId: new Map(),
          hasTreasury: true,
          hasCustomers: false,
          customerScopedIds: new Set(),
        }),
    ),
    withoutRootGroups: vi.fn(async (_db, groupIds: string[]) => groupIds),
  };
});

const internalLedgerMocks = vi.hoisted(() => {
  return {
    isInternalLedgerCounterparty: vi.fn(async () => true),
  };
});

vi.mock("../../src/internal/default-book", () => {
  return {
    ensureInternalLedgerDefaultBookIdTx:
      defaultBookMocks.ensureInternalLedgerDefaultBookIdTx,
  };
});

vi.mock("../../src/internal/group-rules", () => {
  return groupRulesMocks;
});

vi.mock("../../src/internal-ledger", () => {
  return internalLedgerMocks;
});

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
  it("creates a default book when a new counterparty is internal ledger", async () => {
    const created = makeCounterparty();
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
      groupIds: [TREASURY_INTERNAL_GROUP_ID],
    });

    expect(result).toEqual({
      ...created,
      groupIds: [TREASURY_INTERNAL_GROUP_ID],
    });
    expect(groupRulesMocks.replaceMemberships).toHaveBeenCalledWith(
      tx,
      created.id,
      [TREASURY_INTERNAL_GROUP_ID],
    );
    expect(
      defaultBookMocks.ensureInternalLedgerDefaultBookIdTx,
    ).toHaveBeenCalledWith(tx, created.id);
  });

  it("creates a default book when an existing counterparty becomes internal ledger", async () => {
    const existing = makeCounterparty();
    const updated = makeCounterparty({ shortName: "Multihansa Updated" });
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

    const service = createCounterpartiesService({ db: db as any });
    const result = await service.update(existing.id, {
      shortName: updated.shortName,
      groupIds: [TREASURY_INTERNAL_GROUP_ID],
    });

    expect(result).toEqual({
      ...updated,
      groupIds: [TREASURY_INTERNAL_GROUP_ID],
    });
    expect(groupRulesMocks.replaceMemberships).toHaveBeenCalledWith(
      tx,
      existing.id,
      [TREASURY_INTERNAL_GROUP_ID],
    );
    expect(
      defaultBookMocks.ensureInternalLedgerDefaultBookIdTx,
    ).toHaveBeenCalledWith(tx, existing.id);
  });
});
