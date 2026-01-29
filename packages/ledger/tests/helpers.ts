import { vi } from "vitest";
import type { Logger } from "@repo/kernel";
import type { TbAdapter } from "../src/adapter";
import type { AccountStore, AccountMapping } from "../src/pg-store";
import type { AccountRef } from "../src/contract";
import { accountRefKey } from "../src/contract";

/**
 * Creates a mock Logger for testing.
 */
export function createMockLogger(): Logger {
  const mockLogger: Logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => mockLogger),
  };
  return mockLogger;
}

/**
 * Creates a mock TbAdapter for testing.
 */
export function createMockTbAdapter(overrides?: Partial<TbAdapter>): TbAdapter {
  let idCounter = 1n;

  return {
    id: vi.fn(() => idCounter++),
    createAccounts: vi.fn().mockResolvedValue(undefined),
    createTransfers: vi.fn().mockResolvedValue(undefined),
    lookupAccounts: vi.fn().mockResolvedValue([]),
    destroy: vi.fn(),
    ...overrides,
  };
}

/**
 * Creates a mock AccountStore backed by an in-memory Map.
 */
export function createMockAccountStore(
  initialMappings?: Map<string, AccountMapping>
): AccountStore & { _store: Map<string, AccountMapping> } {
  const store = initialMappings ?? new Map<string, AccountMapping>();

  return {
    _store: store,

    get: vi.fn(async (ref: AccountRef) => {
      const key = accountRefKey(ref);
      return store.get(key) ?? null;
    }),

    getMany: vi.fn(async (refs: AccountRef[]) => {
      const result = new Map<string, AccountMapping>();
      for (const ref of refs) {
        const key = accountRefKey(ref);
        const mapping = store.get(key);
        if (mapping) {
          result.set(key, mapping);
        }
      }
      return result;
    }),

    upsert: vi.fn(async (ref: AccountRef, mapping: AccountMapping) => {
      const key = accountRefKey(ref);
      const existing = store.get(key);
      if (existing) {
        return { created: false, mapping: existing };
      }
      store.set(key, mapping);
      return { created: true, mapping };
    }),

    list: vi.fn(async () => []),
  };
}

/**
 * Helper to create test AccountRef instances.
 */
export const testRefs = {
  customer: (customerId: string, currency = "USD"): AccountRef => ({
    kind: "customer",
    customerId,
    currency,
  }),

  internal: (name: string, currency = "USD"): AccountRef => ({
    kind: "internal",
    name,
    currency,
  }),

  globalLedger: (code: string, currency = "USD"): AccountRef => ({
    kind: "global_ledger",
    code,
    currency,
  }),
};

/**
 * Helper to add account mappings to mock store.
 */
export function addMapping(
  store: ReturnType<typeof createMockAccountStore>,
  ref: AccountRef,
  mapping: AccountMapping
) {
  const key = accountRefKey(ref);
  store._store.set(key, mapping);
}
