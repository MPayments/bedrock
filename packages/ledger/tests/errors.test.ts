import { describe, it, expect } from "vitest";
import {
  LedgerError,
  PostingError,
  IdempotencyConflictError,
  AccountMappingConflictError,
  TigerBeetleBatchError
} from "../src/errors";

describe("LedgerError", () => {
  it("should create error with message", () => {
    const error = new LedgerError("test error");
    expect(error.message).toBe("test error");
    expect(error.name).toBe("LedgerError");
  });

  it("should be instance of Error", () => {
    const error = new LedgerError("test");
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(LedgerError);
  });

  it("should have stack trace", () => {
    const error = new LedgerError("test");
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain("LedgerError");
  });
});

describe("PostingError", () => {
  it("should create posting error", () => {
    const error = new PostingError("posting failed");
    expect(error.message).toBe("posting failed");
    expect(error.name).toBe("PostingError");
  });

  it("should be instance of LedgerError", () => {
    const error = new PostingError("test");
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(LedgerError);
    expect(error).toBeInstanceOf(PostingError);
  });
});

describe("IdempotencyConflictError", () => {
  it("should create idempotency conflict error", () => {
    const error = new IdempotencyConflictError("duplicate request");
    expect(error.message).toBe("duplicate request");
    expect(error.name).toBe("IdempotencyConflictError");
  });

  it("should be instance of LedgerError", () => {
    const error = new IdempotencyConflictError("test");
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(LedgerError);
    expect(error).toBeInstanceOf(IdempotencyConflictError);
  });

  it("should preserve error message details", () => {
    const msg = "Entry already exists with different plan fingerprint for idempotencyKey=idem-123";
    const error = new IdempotencyConflictError(msg);
    expect(error.message).toBe(msg);
  });
});

describe("AccountMappingConflictError", () => {
  it("should create error with all context", () => {
    const error = new AccountMappingConflictError(
      "mapping mismatch",
      "org-123",
      1000,
      "customer:alice",
      12345n,
      67890n
    );

    expect(error.message).toBe("mapping mismatch");
    expect(error.name).toBe("AccountMappingConflictError");
    expect(error.orgId).toBe("org-123");
    expect(error.tbLedger).toBe(1000);
    expect(error.key).toBe("customer:alice");
    expect(error.expected).toBe(12345n);
    expect(error.actual).toBe(67890n);
  });

  it("should be instance of LedgerError", () => {
    const error = new AccountMappingConflictError(
      "test",
      "org",
      1,
      "key",
      1n,
      2n
    );

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(LedgerError);
    expect(error).toBeInstanceOf(AccountMappingConflictError);
  });

  it("should preserve all context fields", () => {
    const error = new AccountMappingConflictError(
      "db!=deterministic",
      "org-prod-456",
      2500,
      "liability:loan:mortgage",
      999888777666n,
      111222333444n
    );

    expect(error.orgId).toBe("org-prod-456");
    expect(error.tbLedger).toBe(2500);
    expect(error.key).toBe("liability:loan:mortgage");
    expect(error.expected).toBe(999888777666n);
    expect(error.actual).toBe(111222333444n);
  });

  it("should allow inspection of mismatch", () => {
    const error = new AccountMappingConflictError(
      "conflict",
      "org",
      1,
      "key",
      100n,
      200n
    );

    const mismatch = error.expected !== error.actual;
    expect(mismatch).toBe(true);
  });
});

describe("TigerBeetleBatchError", () => {
  it("should create error with operation and details", () => {
    const details = [
      { index: 0, code: 1, name: "exists" },
      { index: 2, code: 5, name: "invalid_amount" }
    ];

    const error = new TigerBeetleBatchError(
      "batch failed",
      "createTransfers",
      details
    );

    expect(error.message).toBe("batch failed");
    expect(error.name).toBe("TigerBeetleBatchError");
    expect(error.operation).toBe("createTransfers");
    expect(error.details).toEqual(details);
  });

  it("should be instance of LedgerError", () => {
    const error = new TigerBeetleBatchError("test", "createAccounts", []);

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(LedgerError);
    expect(error).toBeInstanceOf(TigerBeetleBatchError);
  });

  it("should handle createAccounts operation", () => {
    const error = new TigerBeetleBatchError(
      "account creation failed",
      "createAccounts",
      [{ index: 1, code: 10, name: "invalid_ledger" }]
    );

    expect(error.operation).toBe("createAccounts");
    expect(error.details).toHaveLength(1);
    expect(error.details[0]?.index).toBe(1);
  });

  it("should handle createTransfers operation", () => {
    const error = new TigerBeetleBatchError(
      "transfer creation failed",
      "createTransfers",
      [
        { index: 0, code: 2, name: "insufficient_funds" },
        { index: 1, code: 3, name: "exceeds_limit" }
      ]
    );

    expect(error.operation).toBe("createTransfers");
    expect(error.details).toHaveLength(2);
  });

  it("should handle empty details array", () => {
    const error = new TigerBeetleBatchError(
      "unknown error",
      "createTransfers",
      []
    );

    expect(error.details).toEqual([]);
    expect(error.details).toHaveLength(0);
  });

  it("should preserve error details for debugging", () => {
    const details = [
      { index: 5, code: 99, name: "custom_error" },
      { index: 10, code: 100, name: "another_error" }
    ];

    const error = new TigerBeetleBatchError("multiple errors", "createTransfers", details);

    expect(error.details).toEqual(details);
    expect(error.details[0]?.index).toBe(5);
    expect(error.details[0]?.code).toBe(99);
    expect(error.details[0]?.name).toBe("custom_error");
    expect(error.details[1]?.index).toBe(10);
    expect(error.details[1]?.code).toBe(100);
    expect(error.details[1]?.name).toBe("another_error");
  });

  it("should format helpful error messages", () => {
    const details = [
      { index: 0, code: 1, name: "linked_event_failed" },
      { index: 3, code: 2, name: "debit_amount_overflow" }
    ];

    const msg = `TigerBeetle createTransfers failed: ${details.map(d => `${d.index}:${d.name}`).join(", ")}`;
    const error = new TigerBeetleBatchError(msg, "createTransfers", details);

    expect(error.message).toContain("0:linked_event_failed");
    expect(error.message).toContain("3:debit_amount_overflow");
  });
});

describe("Error hierarchy", () => {
  it("should allow catching all ledger errors", () => {
    const errors = [
      new LedgerError("base"),
      new PostingError("posting"),
      new IdempotencyConflictError("idem"),
      new AccountMappingConflictError("map", "org", 1, "key", 1n, 2n),
      new TigerBeetleBatchError("tb", "createAccounts", [])
    ];

    for (const error of errors) {
      expect(error).toBeInstanceOf(LedgerError);
    }
  });

  it("should allow specific error type catching", () => {
    try {
      throw new IdempotencyConflictError("duplicate");
    } catch (e) {
      expect(e).toBeInstanceOf(IdempotencyConflictError);
      expect(e).toBeInstanceOf(LedgerError);

      if (e instanceof IdempotencyConflictError) {
        expect(e.message).toBe("duplicate");
      }
    }
  });

  it("should allow distinguishing between error types", () => {
    const postingError = new PostingError("posting");
    const idemError = new IdempotencyConflictError("idem");

    expect(postingError).toBeInstanceOf(PostingError);
    expect(postingError).not.toBeInstanceOf(IdempotencyConflictError);

    expect(idemError).toBeInstanceOf(IdempotencyConflictError);
    expect(idemError).not.toBeInstanceOf(PostingError);
  });
});
