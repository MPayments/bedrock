import { describe, expect, it } from "vitest";

import {
  IdempotencyConflictError,
  LedgerError,
  TigerBeetleBatchError,
  isRetryableError,
} from "../src/errors";

describe("ledger errors", () => {
  it("keeps the core error hierarchy", () => {
    const baseError = new LedgerError("base");
    const idemError = new IdempotencyConflictError("duplicate");
    const batchError = new TigerBeetleBatchError("failed", "createTransfers", [
      { index: 0, code: 1, name: "exists" },
    ]);

    expect(baseError).toBeInstanceOf(Error);
    expect(idemError).toBeInstanceOf(LedgerError);
    expect(batchError).toBeInstanceOf(LedgerError);
  });

  it("preserves TigerBeetle batch metadata", () => {
    const error = new TigerBeetleBatchError("failed", "createAccounts", [
      { index: 1, code: 10, name: "invalid_ledger" },
    ]);

    expect(error.operation).toBe("createAccounts");
    expect(error.details).toEqual([
      { index: 1, code: 10, name: "invalid_ledger" },
    ]);
  });
});

describe("isRetryableError", () => {
  it("treats transport failures as retryable", () => {
    expect(isRetryableError({ code: "ECONNRESET" })).toBe(true);
    expect(isRetryableError(new Error("Connection refused"))).toBe(true);
  });

  it("treats ledger conflicts and validation failures as non-retryable", () => {
    expect(isRetryableError(new IdempotencyConflictError("duplicate"))).toBe(false);
    expect(isRetryableError(new Error("invalid payload"))).toBe(false);
  });
});
