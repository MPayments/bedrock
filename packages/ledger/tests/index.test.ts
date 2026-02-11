import { describe, it, expect } from "vitest";
import * as ledger from "../src/index";

describe("ledger public exports", () => {
  it("exposes the expected API surface", () => {
    expect(ledger.createLedgerEngine).toBeTypeOf("function");
    expect(ledger.PlanType).toBeDefined();
    expect(ledger.IdempotencyConflictError).toBeTypeOf("function");
    expect(ledger.defineKeyspace).toBeTypeOf("function");
    expect(ledger.createLedgerWorker).toBeTypeOf("function");
  });
});
