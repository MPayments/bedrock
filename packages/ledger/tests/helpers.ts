import { vi } from "vitest";
import {
    createStubDb,
    createStubTx,
    mockSelectReturns,
    mockInsertReturns,
    TEST_UUIDS,
    TEST_DATES,
    type StubDatabase,
    type StubTransaction,
} from "@bedrock/test-utils";
import type { TbClient } from "../src/tb";
import { PlanType, type CreatePlan } from "../src/types";

// Re-export shared utilities for convenience
export {
    createMockDb,
    createStubDb,
    createStubTx,
    mockSelectReturns,
    mockInsertReturns,
    mockUpdateReturns,
    mockExecuteReturns,
    mockTransactionWith,
    TEST_UUIDS,
    TEST_DATES,
    type StubDatabase,
    type StubTransaction,
} from "@bedrock/test-utils";

// ============================================================================
// Ledger-specific Factories
// ============================================================================

/**
 * Create a mock TigerBeetle client
 */
export function createMockTbClient(): TbClient {
    return {
        createAccounts: vi.fn(async () => []),
        createTransfers: vi.fn(async () => []),
        lookupAccounts: vi.fn(async () => []),
        lookupTransfers: vi.fn(async () => []),
        destroy: vi.fn(),
    } as any;
}

/**
 * Create a test journal entry input
 */
export function createTestEntry(overrides = {}) {
    return {
        orgId: TEST_UUIDS.ORG_1,
        source: { type: "payment", id: "pay-456" },
        idempotencyKey: "idem-789",
        postingDate: TEST_DATES.NOW,
        transfers: [],
        ...overrides,
    };
}

/**
 * Create a test transfer plan
 */
export function createTestTransferPlan(overrides: Partial<CreatePlan> = {}): CreatePlan {
    return {
        type: PlanType.CREATE,
        planKey: "test-plan-1",
        debitKey: "customer:123",
        creditKey: "revenue:sales",
        currency: "USD",
        amount: 10000n,
        code: 1,
        ...overrides,
    };
}

// ============================================================================
// Ledger-specific Mock Setup Helpers
// ============================================================================

/**
 * Helper to create execute result format
 */
export function mockDbExecuteResult(rows: unknown[]) {
    return { rows };
}

/**
 * Configure select mock to return data
 */
export function mockDbSelectResult(selectMock: ReturnType<typeof vi.fn>, data: unknown[]) {
    mockSelectReturns(selectMock, data);
}

/**
 * Configure insert mock for successful insert with returning values
 */
export function mockDbInsertSuccess(insertMock: ReturnType<typeof vi.fn>, returning: unknown[] = [{ id: "test-id" }]) {
    mockInsertReturns(insertMock, returning);
}

/**
 * Configure insert mock for conflict (no rows returned)
 */
export function mockDbInsertConflict(insertMock: ReturnType<typeof vi.fn>) {
    mockInsertReturns(insertMock, []);
}

/**
 * Create a stub transaction with smart insert behavior
 * that returns appropriate data based on the inserted values
 */
export function createSmartStubTx(): StubTransaction {
    const tx = createStubTx();

    // Override insert to provide smart defaults based on input
    tx.insert = vi.fn(() => ({
        values: vi.fn((vals: any) => {
            const insertedValues = Array.isArray(vals) ? vals : [vals];

            return {
                onConflictDoNothing: vi.fn(() => ({
                    returning: vi.fn(() => {
                        // For journal entries
                        if (insertedValues[0]?.idempotencyKey !== undefined) {
                            return Promise.resolve([{ id: "test-entry-id" }]);
                        }
                        // For journal lines
                        if (insertedValues[0]?.lineNo !== undefined) {
                            return Promise.resolve(insertedValues.map((v: any, i: number) => ({
                                lineNo: v.lineNo || i + 1,
                            })));
                        }
                        // For TB transfer plans
                        if (insertedValues[0]?.planKey !== undefined) {
                            return Promise.resolve(insertedValues.map((_: any, i: number) => ({
                                id: `plan-${i}`,
                            })));
                        }
                        // For outbox
                        if (insertedValues[0]?.kind !== undefined) {
                            return Promise.resolve([{ id: "outbox-id" }]);
                        }
                        // Default
                        return Promise.resolve(insertedValues.map((_: any, i: number) => ({
                            id: `id-${i}`,
                        })));
                    }),
                })),
                onConflictDoUpdate: vi.fn(() => ({
                    returning: vi.fn(() => Promise.resolve([{ tbAccountId: 12345n }])),
                })),
            };
        }),
    })) as any;

    return tx;
}

/**
 * Create a stub database with smart transaction behavior
 */
export function createSmartStubDb(): StubDatabase {
    const tx = createSmartStubTx();
    const db = createStubDb();
    db.transaction = vi.fn(async (fn: (tx: StubTransaction) => Promise<unknown>) => fn(tx));
    (db as any)._tx = tx;
    return db;
}
