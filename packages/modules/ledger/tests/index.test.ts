import { describe, it, expect } from "vitest";

import * as ledger from "../src/index";

describe("ledger public exports", () => {
  it("exposes the expected API surface", () => {
    expect(ledger.createLedgerService).toBeTypeOf("function");
    expect(ledger.createLedgerBookAccountsService).toBeTypeOf("function");
    expect(ledger.IdempotencyConflictError).toBeTypeOf("function");
    expect(ledger.isRetryableError).toBeTypeOf("function");
    expect("createLedgerWorkerDefinition" in ledger).toBe(false);
    expect("createTbClient" in ledger).toBe(false);
    expect("TransferCodes" in ledger).toBe(false);
    expect("AccountingNotInitializedError" in ledger).toBe(false);
  });
});
