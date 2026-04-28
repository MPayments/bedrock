import { describe, expect, it, vi } from "vitest";

import type {
  TreasuryInventoryAllocationRecord,
  TreasuryInventoryPositionRecord,
} from "../src/treasury-orders/domain/types";
import { DrizzleTreasuryOrdersRepository } from "../src/treasury-orders/infra/drizzle/treasury-orders.repository";

const NOW = new Date("2026-04-28T10:00:00.000Z");

function createPosition(
  overrides: Partial<TreasuryInventoryPositionRecord> = {},
): TreasuryInventoryPositionRecord {
  return {
    acquiredAmountMinor: 100n,
    availableAmountMinor: 100n,
    costAmountMinor: 7_500n,
    costCurrencyId: "00000000-0000-4000-8000-000000000201",
    createdAt: NOW,
    currencyId: "00000000-0000-4000-8000-000000000202",
    id: "00000000-0000-4000-8000-000000000101",
    ledgerSubjectType: "organization_requisite",
    ownerBookId: "00000000-0000-4000-8000-000000000301",
    ownerPartyId: "00000000-0000-4000-8000-000000000302",
    ownerRequisiteId: "00000000-0000-4000-8000-000000000303",
    sourceOrderId: "00000000-0000-4000-8000-000000000401",
    sourcePostingDocumentId: "00000000-0000-4000-8000-000000000501",
    sourcePostingDocumentKind: "fx_execute",
    sourceQuoteExecutionId: "00000000-0000-4000-8000-000000000402",
    state: "open",
    updatedAt: NOW,
    ...overrides,
  };
}

function createAllocation(
  overrides: Partial<TreasuryInventoryAllocationRecord> = {},
): TreasuryInventoryAllocationRecord {
  return {
    amountMinor: 80n,
    consumedAt: null,
    costAmountMinor: 6_000n,
    createdAt: NOW,
    currencyId: "00000000-0000-4000-8000-000000000202",
    dealId: "00000000-0000-4000-8000-000000000601",
    id: "00000000-0000-4000-8000-000000000102",
    ledgerHoldRef:
      "treasury_inventory_allocation:00000000-0000-4000-8000-000000000102",
    ownerBookId: "00000000-0000-4000-8000-000000000301",
    ownerRequisiteId: "00000000-0000-4000-8000-000000000303",
    positionId: "00000000-0000-4000-8000-000000000101",
    quoteId: "00000000-0000-4000-8000-000000000602",
    releasedAt: null,
    reservedAt: NOW,
    state: "reserved",
    updatedAt: NOW,
    ...overrides,
  };
}

describe("DrizzleTreasuryOrdersRepository", () => {
  it("does not insert allocation when atomic inventory decrement fails", async () => {
    const insert = vi.fn();
    const tx = {
      insert,
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn(async () => []),
          })),
        })),
      })),
    };
    const db = {
      transaction: vi.fn(async (callback: (database: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const repository = new DrizzleTreasuryOrdersRepository(db as any);

    const result = await repository.reserveInventoryAllocation(
      createAllocation(),
    );

    expect(result).toBeNull();
    expect(insert).not.toHaveBeenCalled();
  });

  it("inserts allocation after the conditional position decrement succeeds", async () => {
    const allocation = createAllocation();
    const updatedPosition = createPosition({
      availableAmountMinor: 20n,
    });
    const tx = {
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn(async () => [allocation]),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn(async () => [updatedPosition]),
          })),
        })),
      })),
    };
    const db = {
      transaction: vi.fn(async (callback: (database: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const repository = new DrizzleTreasuryOrdersRepository(db as any);

    const result = await repository.reserveInventoryAllocation(allocation);

    expect(tx.update).toHaveBeenCalledTimes(1);
    expect(tx.insert).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      allocation,
      position: updatedPosition,
    });
  });

  it("does not re-credit position when allocation state transition loses a race", async () => {
    const allocation = createAllocation();
    const position = createPosition({
      availableAmountMinor: 20n,
    });
    const tx = {
      select: vi
        .fn()
        .mockImplementationOnce(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [allocation]),
            })),
          })),
        }))
        .mockImplementationOnce(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [position]),
            })),
          })),
        })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn(async () => []),
          })),
        })),
      })),
    };
    const db = {
      transaction: vi.fn(async (callback: (database: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const repository = new DrizzleTreasuryOrdersRepository(db as any);

    const result = await repository.updateInventoryAllocationState({
      allocationId: allocation.id,
      at: NOW,
      state: "released",
    });

    expect(result).toBeNull();
    expect(tx.update).toHaveBeenCalledTimes(1);
  });

  it("re-credits position only after guarded release transition succeeds", async () => {
    const allocation = createAllocation();
    const position = createPosition({
      availableAmountMinor: 20n,
    });
    const releasedAllocation = {
      ...allocation,
      releasedAt: NOW,
      state: "released" as const,
    };
    const updatedPosition = createPosition({
      availableAmountMinor: 100n,
    });
    const tx = {
      select: vi
        .fn()
        .mockImplementationOnce(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [allocation]),
            })),
          })),
        }))
        .mockImplementationOnce(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [position]),
            })),
          })),
        })),
      update: vi
        .fn()
        .mockImplementationOnce(() => ({
          set: vi.fn(() => ({
            where: vi.fn(() => ({
              returning: vi.fn(async () => [releasedAllocation]),
            })),
          })),
        }))
        .mockImplementationOnce(() => ({
          set: vi.fn(() => ({
            where: vi.fn(() => ({
              returning: vi.fn(async () => [updatedPosition]),
            })),
          })),
        })),
    };
    const db = {
      transaction: vi.fn(async (callback: (database: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const repository = new DrizzleTreasuryOrdersRepository(db as any);

    const result = await repository.updateInventoryAllocationState({
      allocationId: allocation.id,
      at: NOW,
      state: "released",
    });

    expect(tx.update).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      allocation: releasedAllocation,
      position: updatedPosition,
    });
  });
});
