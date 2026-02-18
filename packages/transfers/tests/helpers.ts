/**
 * Transfers package test helpers
 *
 * Uses shared utilities from @bedrock/test-utils and provides
 * domain-specific factories for transfer entities.
 */

import { vi } from "vitest";
import {
    createStubDb,
    createStubTx,
    mockSelectReturns,
    mockUpdateReturns,
    mockInsertReturns,
    TEST_UUIDS,
    type StubDatabase,
    type StubTransaction,
} from "@bedrock/test-utils";
import { TransferStatus } from "@bedrock/db/schema";

// Re-export shared utilities for convenience
export {
    createStubDb,
    createStubTx,
    mockSelectReturns,
    mockInsertReturns,
    mockUpdateReturns,
    TEST_UUIDS,
    type StubDatabase,
    type StubTransaction,
} from "@bedrock/test-utils";

// ============================================================================
// Transfers-specific Constants
// ============================================================================

export const ORG_ID = TEST_UUIDS.ORG_1;
export const TRANSFER_ID = TEST_UUIDS.ORDER_1; // Reuse for simplicity
export const MAKER_USER_ID = TEST_UUIDS.CUSTOMER_1;
export const CHECKER_USER_ID = TEST_UUIDS.CUSTOMER_2;

// ============================================================================
// Transfers-specific Factories
// ============================================================================

export interface MockTransfer {
    id: string;
    orgId: string;
    status: TransferStatus;
    fromAccountKey: string;
    toAccountKey: string;
    currencyId: string;
    amountMinor: bigint;
    memo: string | null;
    makerUserId: string;
    checkerUserId: string | null;
    approvedAt: Date | null;
    rejectedAt: Date | null;
    rejectReason: string | null;
    ledgerEntryId: string | null;
    idempotencyKey: string;
    createdAt: Date;
    updatedAt: Date;
}

export function createMockTransfer(overrides: Partial<MockTransfer> = {}): MockTransfer {
    return {
        id: TRANSFER_ID,
        orgId: ORG_ID,
        status: TransferStatus.DRAFT,
        fromAccountKey: "Account:org1:vault:USD",
        toAccountKey: "Account:org1:operating:USD",
        currencyId: "cur-usd",
        amountMinor: 100000n,
        memo: "Test transfer",
        makerUserId: MAKER_USER_ID,
        checkerUserId: null,
        approvedAt: null,
        rejectedAt: null,
        rejectReason: null,
        ledgerEntryId: null,
        idempotencyKey: "test-idempotency-key",
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    };
}

export function createMockLedger() {
    const mockTransferIds = new Map<number, bigint>();
    mockTransferIds.set(1, 12345678901234567890n);
    
    return {
        createEntryTx: vi.fn(async () => ({
            entryId: "test-entry-id",
            transferIds: mockTransferIds,
        })),
        createEntry: vi.fn(async () => ({
            entryId: "test-entry-id",
            transferIds: mockTransferIds,
        })),
    } as any;
}

// ============================================================================
// Transfers-specific Mock Setup Helpers
// ============================================================================

/**
 * Configure a stub transaction to return a specific transfer on select
 */
export function setupTxWithTransfer(tx: StubTransaction, transfer: MockTransfer | null): void {
    mockSelectReturns(tx.select, transfer ? [transfer] : []);
}

/**
 * Configure a stub transaction for successful update
 */
export function setupTxWithUpdateSuccess(tx: StubTransaction, transferId: string = TRANSFER_ID): void {
    mockUpdateReturns(tx.update, [{ id: transferId }]);
}

/**
 * Configure a stub transaction for failed update (no rows affected)
 */
export function setupTxWithUpdateFailure(tx: StubTransaction): void {
    mockUpdateReturns(tx.update, []);
}
