import { vi } from "vitest";

import type { TbClient } from "@bedrock/ledger/worker";

export { createStubDb, type StubDatabase } from "@bedrock/test-utils";

export function createMockTbClient(): TbClient {
  return {
    createAccounts: vi.fn(async () => []),
    createTransfers: vi.fn(async () => []),
    lookupAccounts: vi.fn(async () => []),
    lookupTransfers: vi.fn(async () => []),
    destroy: vi.fn(),
  } as any;
}

export function mockDbExecuteResult(rows: unknown[]) {
  return { rows };
}
