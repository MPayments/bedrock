import { describe, it, expect } from "vitest";
import { bigintFromString128, tbAccountIdFromKey, tbTransferIdFromKey } from "../src/ids.js";

describe("bigintFromString128", () => {
  it("returns a bigint", () => {
    const result = bigintFromString128("test");
    expect(typeof result).toBe("bigint");
  });

  it("produces deterministic output for the same input", () => {
    const input = "same-input";
    expect(bigintFromString128(input)).toBe(bigintFromString128(input));
  });

  it("produces different outputs for different inputs", () => {
    expect(bigintFromString128("input-a")).not.toBe(bigintFromString128("input-b"));
  });

  it("produces 128-bit values (fits in 128 bits)", () => {
    const result = bigintFromString128("test-value");
    // 128 bits = 2^128 - 1 max value
    const max128 = (1n << 128n) - 1n;
    expect(result).toBeGreaterThanOrEqual(0n);
    expect(result).toBeLessThanOrEqual(max128);
  });

  it("handles empty string", () => {
    const result = bigintFromString128("");
    expect(typeof result).toBe("bigint");
    expect(result).toBeGreaterThanOrEqual(0n);
  });

  it("handles unicode strings", () => {
    const result = bigintFromString128("テスト🎉");
    expect(typeof result).toBe("bigint");
    expect(result).toBeGreaterThanOrEqual(0n);
  });

  it("handles long strings", () => {
    const longString = "a".repeat(10000);
    const result = bigintFromString128(longString);
    expect(typeof result).toBe("bigint");
    // Still fits in 128 bits
    const max128 = (1n << 128n) - 1n;
    expect(result).toBeLessThanOrEqual(max128);
  });
});

describe("tbAccountIdFromKey", () => {
  it("returns a bigint", () => {
    const result = tbAccountIdFromKey("customer:cust_123:USD");
    expect(typeof result).toBe("bigint");
  });

  it("produces deterministic output", () => {
    const key = "customer:cust_123:USD";
    expect(tbAccountIdFromKey(key)).toBe(tbAccountIdFromKey(key));
  });

  it("produces different IDs for different keys", () => {
    const id1 = tbAccountIdFromKey("customer:cust_123:USD");
    const id2 = tbAccountIdFromKey("customer:cust_456:USD");
    expect(id1).not.toBe(id2);
  });

  it("uses tb:account: prefix namespace", () => {
    // The function should prefix with "tb:account:" so same key produces
    // different result than raw bigintFromString128
    const key = "customer:cust_123:USD";
    const accountId = tbAccountIdFromKey(key);
    const rawHash = bigintFromString128(key);
    expect(accountId).not.toBe(rawHash);
  });
});

describe("tbTransferIdFromKey", () => {
  it("returns a bigint", () => {
    const result = tbTransferIdFromKey("idempotency-key-123");
    expect(typeof result).toBe("bigint");
  });

  it("produces deterministic output", () => {
    const key = "transfer-key-abc";
    expect(tbTransferIdFromKey(key)).toBe(tbTransferIdFromKey(key));
  });

  it("produces different IDs for different keys", () => {
    const id1 = tbTransferIdFromKey("transfer-1");
    const id2 = tbTransferIdFromKey("transfer-2");
    expect(id1).not.toBe(id2);
  });

  it("uses tb:transfer: prefix namespace (different from account)", () => {
    const key = "same-key";
    const accountId = tbAccountIdFromKey(key);
    const transferId = tbTransferIdFromKey(key);
    // Same key but different namespace should produce different IDs
    expect(accountId).not.toBe(transferId);
  });
});

describe("collision resistance", () => {
  it("produces unique IDs for a batch of sequential keys", () => {
    const ids = new Set<bigint>();
    const count = 1000;

    for (let i = 0; i < count; i++) {
      ids.add(tbAccountIdFromKey(`customer:cust_${i}:USD`));
    }

    expect(ids.size).toBe(count);
  });

  it("produces unique IDs for similar-looking keys", () => {
    const keys = [
      "customer:abc:USD",
      "customer:abd:USD",
      "customer:abc:EUR",
      "internal:abc:USD",
      "gl:abc:USD",
    ];

    const ids = keys.map(tbAccountIdFromKey);
    const uniqueIds = new Set(ids);

    expect(uniqueIds.size).toBe(keys.length);
  });
});
