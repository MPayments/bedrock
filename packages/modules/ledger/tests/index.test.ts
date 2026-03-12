import { describe, it, expect } from "vitest";

import * as ledger from "../src/index";

describe("ledger public exports", () => {
  it("exposes the expected API surface", () => {
    expect(ledger.createLedgerEngine).toBeTypeOf("function");
    expect(ledger.OPERATION_TRANSFER_TYPE).toBeDefined();
    expect(ledger.IdempotencyConflictError).toBeTypeOf("function");
    expect(ledger.createLedgerWorkerDefinition).toBeTypeOf("function");
  });
});
