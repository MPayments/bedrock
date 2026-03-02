import { vi } from "vitest";

import {
    createStubDb,
    createStubTx,
    TEST_UUIDS,
    TEST_DATES,
    type StubDatabase,
    type StubTransaction,
} from "@bedrock/test-utils";
import { schema } from "@bedrock/ledger/schema";

import type { TbClient } from "../src/tb";
import type { OperationIntent, CreateIntentLine } from "../src/types";
import { OPERATION_TRANSFER_TYPE } from "../src/types";

export { createStubDb, type StubDatabase } from "@bedrock/test-utils";

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
 * Create a test operation input
 */
export function createTestEntry(
    overrides: Partial<OperationIntent> & { transfers?: any[] } = {},
): OperationIntent {
    const lines = overrides.lines ?? overrides.transfers ?? [createTestTransferPlan()];
    return {
        source: { type: "payment", id: "pay-456" },
        operationCode: "ledger.test",
        operationVersion: 1,
        idempotencyKey: "idem-789",
        postingDate: TEST_DATES.NOW,
        lines,
        ...overrides,
    };
}

/**
 * Create a test create-transfer plan
 */
export function createTestTransferPlan(
    overrides: Partial<CreateIntentLine> & Record<string, any> = {},
): CreateIntentLine {
    const currency = overrides.currency ?? overrides.debit?.currency ?? "USD";
    const debitAccountNo = overrides.debitAccountNo ?? overrides.debit?.accountNo ?? "1000";
    const creditAccountNo =
        overrides.creditAccountNo ?? overrides.credit?.accountNo ?? "2000";
    const analytics = overrides.analytics ?? {};

    return {
        type: OPERATION_TRANSFER_TYPE.CREATE,
        planRef: overrides.planRef ?? "test-plan-1",
        bookId: overrides.bookId ?? TEST_UUIDS.ORG_1,
        postingCode: overrides.postingCode ?? "test.posting",
        debit: overrides.debit ?? {
            accountNo: debitAccountNo,
            currency,
            dimensions: analytics,
        },
        credit: overrides.credit ?? {
            accountNo: creditAccountNo,
            currency,
            dimensions: analytics,
        },
        amountMinor: overrides.amountMinor ?? overrides.amount ?? 10000n,
        code: overrides.code ?? 1,
        pending: overrides.pending,
        chain: overrides.chain ?? null,
        memo: overrides.memo ?? null,
        context: overrides.context ?? null,
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
 * Create a stub transaction with smart insert behavior
 * that returns appropriate data based on the inserted values.
 */
function createSmartStubTx(): StubTransaction {
    const tx = createStubTx();

    tx.insert = vi.fn(() => ({
        values: vi.fn((vals: any) => {
            const insertedValues = Array.isArray(vals) ? vals : [vals];

            return {
                onConflictDoNothing: vi.fn(() => ({
                    returning: vi.fn(() => {
                        if (insertedValues[0]?.idempotencyKey !== undefined) {
                            return Promise.resolve([{ id: "test-operation-id" }]);
                        }

                        if (insertedValues[0]?.tbAccountId !== undefined) {
                            return Promise.resolve(
                                insertedValues.map((v: any, i: number) => ({
                                    id: v.id ?? `book-account-${i + 1}`,
                                    tbLedger: v.tbLedger,
                                    tbAccountId: v.tbAccountId,
                                })),
                            );
                        }

                        if (insertedValues[0]?.lineNo !== undefined) {
                            return Promise.resolve(
                                insertedValues.map((v: any, i: number) => ({
                                    lineNo: v.lineNo || i + 1,
                                })),
                            );
                        }

                        if (insertedValues[0]?.kind !== undefined) {
                            return Promise.resolve([{ id: "outbox-id" }]);
                        }

                        return Promise.resolve(
                            insertedValues.map((_: any, i: number) => ({
                                id: `id-${i + 1}`,
                            })),
                        );
                    }),
                })),
                onConflictDoUpdate: vi.fn(() => ({
                    returning: vi.fn(() =>
                        Promise.resolve([{ tbAccountId: 12345n }]),
                    ),
                })),
            };
        }),
    })) as any;

    tx.select = vi.fn(() => ({
        from: vi.fn((table: any) => ({
            where: vi.fn(() => ({
                limit: vi.fn(async () => {
                    if (table === (schema as any).correspondenceRules) {
                        return [{ id: "rule-1" }];
                    }
                    if (table === (schema as any).chartTemplateAccounts) {
                        return [{ postingAllowed: true, enabled: true, accountNo: "1000" }];
                    }
                    if (table === (schema as any).chartAccountDimensionPolicy) {
                        return [];
                    }
                    if (table === (schema as any).postingCodeDimensionPolicy) {
                        return [];
                    }
                    return [];
                }),
            })),
        })),
    })) as any;

    return tx;
}

/**
 * Create a stub database with smart transaction behavior
 */
export function createSmartStubDb(): StubDatabase {
    const tx = createSmartStubTx();
    const db = createStubDb();
    db.transaction = vi.fn(async (fn: (tx: StubTransaction) => Promise<unknown>) =>
        fn(tx),
    );
    (db as any)._tx = tx;
    return db;
}
