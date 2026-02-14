/**
 * Treasury package test helpers
 *
 * Uses shared utilities from @bedrock/test-utils and provides
 * domain-specific factories for treasury entities.
 */

import { vi } from "vitest";
import {
    createStubDb,
    createStubTx,
    mockSelectReturns,
    mockUpdateReturns,
    mockExecuteReturns,
    TEST_UUIDS,
    type StubDatabase,
    type StubTransaction,
} from "@bedrock/test-utils";

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
// Treasury-specific Constants
// ============================================================================

export const CUSTOMER_ID = TEST_UUIDS.CUSTOMER_1;
export const ORDER_ID = TEST_UUIDS.ORDER_1;
export const BRANCH_ORG_ID = TEST_UUIDS.ORG_2;

// ============================================================================
// Treasury-specific Factories
// ============================================================================

export interface MockOrder {
    id: string;
    customerId: string;
    payInOrgId: string;
    payOutOrgId: string;
    status: string;
    payInCurrency: string;
    payInExpectedMinor: bigint;
    payOutCurrency: string;
    payOutAmountMinor: bigint;
    ledgerEntryId: string | null;
    payoutPendingTransferId: bigint | null;
}

export function createMockOrder(overrides: Partial<MockOrder> = {}): MockOrder {
    return {
        id: ORDER_ID,
        customerId: CUSTOMER_ID,
        payInOrgId: BRANCH_ORG_ID,
        payOutOrgId: BRANCH_ORG_ID,
        status: "quote",
        payInCurrency: "USD",
        payInExpectedMinor: 100000n,
        payOutCurrency: "EUR",
        payOutAmountMinor: 85000n,
        ledgerEntryId: null,
        payoutPendingTransferId: null,
        ...overrides,
    };
}

export function createMockLedger() {
    // Mock the new CreateEntryResult format with entryId and transferIds
    const mockTransferIds = new Map<number, bigint>();
    mockTransferIds.set(1, 12345678901234567890n);
    
    const mockResult = {
        entryId: "test-entry-id",
        transferIds: mockTransferIds,
    };
    
    return {
        createEntryTx: vi.fn(async () => mockResult),
        createEntry: vi.fn(async () => mockResult),
    } as any;
}

// ============================================================================
// Treasury-specific Mock Setup Helpers
// ============================================================================

/**
 * Configure a stub transaction to return a specific order on select
 */
export function setupTxWithOrder(tx: StubTransaction, order: MockOrder | null): void {
    mockSelectReturns(tx.select, order ? [order] : []);
}

/**
 * Configure a stub transaction for successful update
 */
export function setupTxWithUpdateSuccess(tx: StubTransaction): void {
    mockUpdateReturns(tx.update, [{ id: "test-id" }]);
}

/**
 * Configure a stub transaction for failed update (no rows affected)
 */
export function setupTxWithUpdateFailure(tx: StubTransaction): void {
    mockUpdateReturns(tx.update, []);
}

/**
 * Helper to create execute result format
 */
export function mockDbExecuteResult(rows: unknown[]) {
    return { rows };
}

/**
 * Create a stub database with custom transaction behavior
 * for tests that need fine-grained control over tx mocks
 */
export function createStubDbWithCustomTx(): StubDatabase & { _tx: StubTransaction } {
    return createStubDb() as StubDatabase & { _tx: StubTransaction };
}
