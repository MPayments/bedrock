import { vi } from "vitest";
import type { Database } from "@repo/db";
import type { TbClient } from "../src/tb";

export function createMockDb(): Database {
  return {
    transaction: vi.fn(async (fn: any) => fn(createMockTx())),
    execute: vi.fn(async () => ({ rows: [] })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([])),
          orderBy: vi.fn(() => Promise.resolve([]))
        }))
      }))
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoNothing: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([]))
        })),
        onConflictDoUpdate: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([]))
        }))
      }))
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve())
      }))
    }))
  } as any;
}

export function createMockTx() {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([]))
        }))
      }))
    })),
    insert: vi.fn(() => ({
      values: vi.fn((vals: any) => {
        const insertedValues = Array.isArray(vals) ? vals : [vals];

        return {
          onConflictDoNothing: vi.fn(() => ({
            returning: vi.fn(() => {
              // For journal entries, return single entry
              if (insertedValues[0]?.idempotencyKey !== undefined) {
                return Promise.resolve([{ id: "test-entry-id" }]);
              }
              // For journal lines, return all lines with lineNo
              if (insertedValues[0]?.lineNo !== undefined) {
                return Promise.resolve(insertedValues.map((v, i) => ({ lineNo: v.lineNo || i + 1 })));
              }
              // For TB transfer plans
              if (insertedValues[0]?.planKey !== undefined) {
                return Promise.resolve(insertedValues.map((v, i) => ({ id: `plan-${i}` })));
              }
              // For outbox
              if (insertedValues[0]?.kind !== undefined) {
                return Promise.resolve([{ id: "outbox-id" }]);
              }
              // Default: return all entries
              return Promise.resolve(insertedValues.map((v, i) => ({ id: `id-${i}` })));
            })
          })),
          onConflictDoUpdate: vi.fn(() => ({
            returning: vi.fn(() => Promise.resolve([{ tbAccountId: 12345n }]))
          }))
        };
      })
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve())
      }))
    })),
    execute: vi.fn(() => Promise.resolve())
  } as any;
}

export function createMockTbClient(): TbClient {
  return {
    createAccounts: vi.fn(async () => []),
    createTransfers: vi.fn(async () => []),
    lookupAccounts: vi.fn(async () => []),
    lookupTransfers: vi.fn(async () => []),
    destroy: vi.fn()
  } as any;
}

export function createTestEntry() {
  return {
    orgId: "550e8400-e29b-41d4-a716-446655440000", // Valid UUID
    source: { type: "payment", id: "pay-456" },
    idempotencyKey: "idem-789",
    postingDate: new Date("2024-01-15T10:00:00Z"),
    transfers: []
  };
}

export function createTestTransferPlan(overrides = {}) {
  return {
    type: "create" as const,
    planKey: "test-plan-1",
    debitKey: "customer:123",
    creditKey: "revenue:sales",
    currency: "USD",
    amount: 10000n,
    code: 1,
    ...overrides
  };
}

export function mockDbExecuteResult(rows: any[]) {
  return { rows };
}

export function mockDbSelectResult(data: any[]) {
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(async () => data),
        orderBy: vi.fn(async () => data)
      }))
    }))
  };
}

export function mockDbInsertSuccess(returning: any[] = [{ id: "test-id" }]) {
  return {
    values: vi.fn(() => ({
      onConflictDoNothing: vi.fn(() => ({
        returning: vi.fn(async () => returning)
      }))
    }))
  };
}
