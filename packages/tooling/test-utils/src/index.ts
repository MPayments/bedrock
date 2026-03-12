/**
 * @multihansa/test-utils - Shared testing utilities for the ledger monorepo
 *
 * @example
 * import { createMockDb, createStubDb, TEST_UUIDS } from "@multihansa/test-utils";
 *
 * // Type-safe mock for verifying calls
 * const db = createMockDb();
 *
 * // Configurable stub for custom behavior
 * const db = createStubDb();
 * mockSelectReturns(db.select, [{ id: '123' }]);
 */

// Database mocking
export {
  createMockDb,
  createStubDb,
  createStubTx,
  mockSelectReturns,
  mockInsertReturns,
  mockUpdateReturns,
  mockExecuteReturns,
  mockTransactionWith,
  type MockDatabase,
  type StubDatabase,
  type StubTransaction,
} from "./db.js";

// Test fixtures
export {
  TEST_UUIDS,
  TEST_DATES,
  TEST_CURRENCIES,
  testUuid,
  createTestId,
} from "./fixtures.js";
