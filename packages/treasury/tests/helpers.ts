/**
 * Treasury package test helpers
 *
 * Uses shared utilities from @bedrock/test-utils and provides
 * domain-specific factories for treasury entities.
 */

import { vi } from "vitest";

import {
  createStubDb,
  mockSelectReturns,
  mockUpdateReturns,
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
export const BRANCH_COUNTERPARTY_ID = TEST_UUIDS.ORG_2;

// ============================================================================
// Treasury-specific Factories
// ============================================================================

export interface MockOrder {
  id: string;
  customerId: string;
  payInCounterpartyId: string;
  payOutCounterpartyId: string;
  status: string;
  payInCurrencyId: string;
  payInCurrency: string;
  payInExpectedMinor: bigint;
  payOutCurrencyId: string;
  payOutCurrency: string;
  payOutAmountMinor: bigint;
  ledgerOperationId: string | null;
  ledgerEntryId?: string | null;
  payoutPendingTransferId: bigint | null;
}

function currencyIdFromCode(code: string): string {
  return `cur-${code.trim().toLowerCase()}`;
}

export function createMockOrder(overrides: Partial<MockOrder> = {}): MockOrder {
  const order: MockOrder = {
    id: ORDER_ID,
    customerId: CUSTOMER_ID,
    payInCounterpartyId: BRANCH_COUNTERPARTY_ID,
    payOutCounterpartyId: BRANCH_COUNTERPARTY_ID,
    status: "quote",
    payInCurrencyId: "cur-usd",
    payInCurrency: "USD",
    payInExpectedMinor: 100000n,
    payOutCurrencyId: "cur-eur",
    payOutCurrency: "EUR",
    payOutAmountMinor: 85000n,
    ledgerOperationId: null,
    ledgerEntryId: null,
    payoutPendingTransferId: null,
    ...overrides,
  };

  if (
    overrides.ledgerEntryId !== undefined &&
    overrides.ledgerOperationId === undefined
  ) {
    order.ledgerOperationId = overrides.ledgerEntryId;
  }
  if (
    overrides.ledgerOperationId !== undefined &&
    overrides.ledgerEntryId === undefined
  ) {
    order.ledgerEntryId = overrides.ledgerOperationId;
  }

  const payInCurrency = overrides.payInCurrency;
  if (payInCurrency && !overrides.payInCurrencyId) {
    order.payInCurrencyId = currencyIdFromCode(payInCurrency);
  }

  const payOutCurrency = overrides.payOutCurrency;
  if (payOutCurrency && !overrides.payOutCurrencyId) {
    order.payOutCurrencyId = currencyIdFromCode(payOutCurrency);
  }

  return order;
}

export function createMockLedger() {
  const mockTransferIds = new Map<number, bigint>([[1, 12345678901234567890n]]);
  const mockResult = {
    entryId: "test-entry-id",
    transferIds: mockTransferIds,
  };

  const createEntryTx = vi.fn(async () => mockResult);
  const createEntry = vi.fn(async (...args: any[]) => createEntryTx(...args));

  const createOperationTx = vi.fn(async (tx: unknown, input: any) => {
    const legacy = await createEntryTx(tx as any, input);
    const transferIds: Map<number, bigint> =
      legacy?.transferIds instanceof Map ? legacy.transferIds : new Map();
    const pendingTransferIdsByRef = new Map<string, bigint>();

    if (Array.isArray(input?.transfers)) {
      for (let i = 0; i < input.transfers.length; i++) {
        const transfer = input.transfers[i];
        if (transfer?.type !== "create" || !transfer?.pending) continue;
        const ref =
          transfer.pending.ref ?? transfer.planRef ?? transfer.planKey;
        const transferId = transferIds.get(i + 1) ?? BigInt(i + 1);
        pendingTransferIdsByRef.set(ref, transferId);
      }
    }

    return {
      operationId: legacy?.entryId ?? "test-entry-id",
      pendingTransferIdsByRef,
    };
  });
  const createOperation = vi.fn(async (input: any) =>
    createOperationTx(undefined, input),
  );

  return {
    createEntryTx,
    createEntry,
    createOperationTx,
    createOperation,
  } as any;
}

// ============================================================================
// Treasury-specific Mock Setup Helpers
// ============================================================================

/**
 * Configure a stub transaction to return a specific order on select
 */
export function setupTxWithOrder(
  tx: StubTransaction,
  order: MockOrder | null,
): void {
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
export function createStubDbWithCustomTx(): StubDatabase & {
  _tx: StubTransaction;
} {
  return createStubDb() as StubDatabase & { _tx: StubTransaction };
}
