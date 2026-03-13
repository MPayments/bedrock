/**
 * Database mocking utilities for unit tests
 *
 * Provides two approaches:
 * 1. `createMockDb()` - Uses Drizzle's mock driver for type-safe mocking
 * 2. `createStubDb()` - Manual stub for tests needing custom behavior
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { vi, type Mock } from "vitest";

import type { Database } from "@bedrock/adapter-db-drizzle/db/types";

// Type for the mock database from drizzle.mock()
export type MockDatabase = ReturnType<typeof drizzle.mock>;

/**
 * Create a type-safe mock database using Drizzle's mock driver.
 * Best for tests that verify method calls without custom return values.
 *
 * @example
 * const db = createMockDb();
 * await myFunction(db);
 * expect(db.select).toHaveBeenCalled();
 */
export function createMockDb(): MockDatabase {
  const db = drizzle.mock();

  // Spy on methods for assertions (cast to any to avoid TypeScript issues with method names)
  const dbAny = db as any;
  vi.spyOn(dbAny, "transaction");
  vi.spyOn(dbAny, "execute");
  vi.spyOn(dbAny, "select");
  vi.spyOn(dbAny, "insert");
  vi.spyOn(dbAny, "update");
  vi.spyOn(dbAny, "delete");

  return db;
}

/**
 * Stub database for tests requiring custom mock behavior.
 * Provides chainable mocks that can be configured per-test.
 */
export interface StubDatabase extends Database {
  transaction: Mock;
  execute: Mock;
  select: Mock;
  insert: Mock;
  update: Mock;
  delete: Mock;
  _tx: StubTransaction;
}

/**
 * Stub transaction for use within db.transaction() callbacks
 */
export interface StubTransaction {
  select: Mock;
  insert: Mock;
  update: Mock;
  delete: Mock;
  execute: Mock;
}

/**
 * Create a stub transaction with chainable mocks
 */
export function createStubTx(): StubTransaction {
  return {
    select: vi.fn(() => createSelectChain()),
    insert: vi.fn(() => createInsertChain()),
    update: vi.fn(() => createUpdateChain()),
    delete: vi.fn(() => createDeleteChain()),
    execute: vi.fn(async () => ({ rows: [] })),
  };
}

/**
 * Create a stub database for tests needing custom mock behavior.
 * The transaction callback receives a stub transaction by default.
 *
 * @example
 * const db = createStubDb();
 * mockSelectReturns(db.select, [{ id: '123' }]);
 * const result = await myFunction(db);
 */
export function createStubDb(): StubDatabase {
  const tx = createStubTx();

  return {
    transaction: vi.fn(async (fn: (tx: StubTransaction) => Promise<unknown>) => fn(tx)),
    execute: vi.fn(async () => ({ rows: [] })),
    select: vi.fn(() => createSelectChain()),
    insert: vi.fn(() => createInsertChain()),
    update: vi.fn(() => createUpdateChain()),
    delete: vi.fn(() => createDeleteChain()),
    _tx: tx,
  } as StubDatabase;
}

// Chain builders for Drizzle query patterns
function createSelectChain(data: unknown[] = []) {
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        for: vi.fn(() => ({
          limit: vi.fn(async () => data),
        })),
        limit: vi.fn(async () => data),
        orderBy: vi.fn(() => ({
          limit: vi.fn(async () => data),
        })),
      })),
      innerJoin: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => data),
        })),
      })),
    })),
  };
}

function createInsertChain(returning: unknown[] = []) {
  return {
    values: vi.fn(() => ({
      onConflictDoNothing: vi.fn(() => ({
        returning: vi.fn(async () => returning),
      })),
      onConflictDoUpdate: vi.fn(() => ({
        returning: vi.fn(async () => returning),
      })),
      returning: vi.fn(async () => returning),
    })),
  };
}

function createUpdateChain(returning: unknown[] = []) {
  return {
    set: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(async () => returning),
      })),
    })),
  };
}

function createDeleteChain() {
  return {
    where: vi.fn(async () => undefined),
  };
}

// ============================================================================
// Mock Configuration Helpers
// ============================================================================

/**
 * Configure a select mock to return specific data
 *
 * @example
 * mockSelectReturns(db.select, [{ id: '123', name: 'Test' }]);
 */
export function mockSelectReturns(selectMock: Mock, data: unknown[]): void {
  selectMock.mockReturnValue(createSelectChain(data));
}

/**
 * Configure an insert mock to return specific data
 *
 * @example
 * mockInsertReturns(db.insert, [{ id: 'new-id' }]);
 */
export function mockInsertReturns(insertMock: Mock, returning: unknown[]): void {
  insertMock.mockReturnValue(createInsertChain(returning));
}

/**
 * Configure an update mock to return specific data
 *
 * @example
 * mockUpdateReturns(db.update, [{ id: 'updated-id' }]);
 */
export function mockUpdateReturns(updateMock: Mock, returning: unknown[]): void {
  updateMock.mockReturnValue(createUpdateChain(returning));
}

/**
 * Configure execute mock to return specific rows
 *
 * @example
 * mockExecuteReturns(db.execute, [{ id: '1' }, { id: '2' }]);
 */
export function mockExecuteReturns(executeMock: Mock, rows: unknown[]): void {
  executeMock.mockResolvedValue({ rows });
}

/**
 * Configure transaction to use a custom transaction mock
 *
 * @example
 * const tx = createStubTx();
 * mockSelectReturns(tx.select, [order]);
 * mockTransactionWith(db.transaction, tx);
 */
export function mockTransactionWith(transactionMock: Mock, tx: StubTransaction): void {
  transactionMock.mockImplementation(async (fn: (tx: StubTransaction) => Promise<unknown>) => fn(tx));
}
