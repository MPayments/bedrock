import { describe, it, expect } from "vitest";

import * as ledger from "../src/index";

describe("ledger public exports", () => {
  it("exposes the expected API surface", () => {
    expect(ledger.createLedgerModule).toBeTypeOf("function");
    expect("createLedgerService" in ledger).toBe(false);
    expect("createLedgerReadService" in ledger).toBe(false);
    expect(ledger.IdempotencyConflictError).toBeTypeOf("function");
    expect(ledger.isRetryableError).toBeTypeOf("function");
    expect("createLedgerWorkerDefinition" in ledger).toBe(false);
    expect("createTbClient" in ledger).toBe(false);
    expect("TransferCodes" in ledger).toBe(false);
    expect("AccountingNotInitializedError" in ledger).toBe(false);
  });
});
