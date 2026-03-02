import { describe, it, expect } from "vitest";
import { stableStringify, makePlanKey } from "@bedrock/foundation/kernel";

describe("stableStringify", () => {
  it("should stringify primitives", () => {
    expect(stableStringify(null)).toBe("null");
    expect(stableStringify(undefined)).toBe("null");
    expect(stableStringify(true)).toBe("true");
    expect(stableStringify(false)).toBe("false");
    expect(stableStringify(42)).toBe("42");
    expect(stableStringify("hello")).toBe('"hello"');
  });

  it("should stringify bigints as strings", () => {
    expect(stableStringify(123n)).toBe('"123"');
    expect(stableStringify(9007199254740991n)).toBe('"9007199254740991"');
  });

  it("should stringify arrays", () => {
    expect(stableStringify([])).toBe("[]");
    expect(stableStringify([1, 2, 3])).toBe("[1,2,3]");
    expect(stableStringify(["a", "b"])).toBe('["a","b"]');
    expect(stableStringify([1, "two", 3n])).toBe('[1,"two","3"]');
  });

  it("should stringify objects with sorted keys", () => {
    const obj = { z: 3, a: 1, m: 2 };
    expect(stableStringify(obj)).toBe('{"a":1,"m":2,"z":3}');
  });

  it("should produce same output regardless of key insertion order", () => {
    const obj1 = { b: 2, a: 1, c: 3 };
    const obj2 = { c: 3, a: 1, b: 2 };
    const obj3 = { a: 1, b: 2, c: 3 };

    const result1 = stableStringify(obj1);
    const result2 = stableStringify(obj2);
    const result3 = stableStringify(obj3);

    expect(result1).toBe(result2);
    expect(result2).toBe(result3);
    expect(result1).toBe('{"a":1,"b":2,"c":3}');
  });

  it("should handle nested objects", () => {
    const obj = {
      z: { nested: 2, value: 1 },
      a: { x: 10 }
    };
    expect(stableStringify(obj)).toBe('{"a":{"x":10},"z":{"nested":2,"value":1}}');
  });

  it("should handle nested arrays", () => {
    const arr = [[3, 2, 1], [6, 5, 4]];
    expect(stableStringify(arr)).toBe("[[3,2,1],[6,5,4]]");
  });

  it("should handle complex nested structures", () => {
    const complex = {
      transfers: [
        { amount: 100n, currency: "USD", id: 1 },
        { amount: 200n, currency: "EUR", id: 2 }
      ],
      metadata: { createdAt: "2024-01-01", version: 1 }
    };

    const result = stableStringify(complex);
    expect(result).toContain('"amount":"100"');
    expect(result).toContain('"amount":"200"');
    expect(result).toContain('"metadata"');
    expect(result).toContain('"transfers"');
  });

  it("should filter out undefined values in objects", () => {
    const obj = { a: 1, b: undefined, c: 3 };
    expect(stableStringify(obj)).toBe('{"a":1,"c":3}');
  });

  it("should keep null values in objects", () => {
    const obj = { a: 1, b: null, c: 3 };
    expect(stableStringify(obj)).toBe('{"a":1,"b":null,"c":3}');
  });

  it("should handle empty objects", () => {
    expect(stableStringify({})).toBe("{}");
  });

  it("should handle objects with only undefined values", () => {
    const obj = { a: undefined, b: undefined };
    expect(stableStringify(obj)).toBe("{}");
  });

  it("should handle arrays with undefined values", () => {
    const arr = [1, undefined, 3];
    expect(stableStringify(arr)).toBe('[1,null,3]');
  });

  it("should be deterministic for financial data", () => {
    const transfer1 = {
      amount: 100050n,
      currency: "USD",
      debit: "account:customer:123",
      credit: "account:revenue:456",
      pending: { timeout: 3600 },
      metadata: { invoice: "INV-001" }
    };

    const transfer2 = {
      metadata: { invoice: "INV-001" },
      pending: { timeout: 3600 },
      credit: "account:revenue:456",
      debit: "account:customer:123",
      currency: "USD",
      amount: 100050n
    };

    expect(stableStringify(transfer1)).toBe(stableStringify(transfer2));
  });
});

describe("makePlanKey", () => {
  it("should create plan key with operation and payload", () => {
    const key = makePlanKey("transfer", { from: "A", to: "B", amount: 100n });
    expect(key).toContain("transfer:");
    expect(key).toContain('"from":"A"');
    expect(key).toContain('"to":"B"');
    expect(key).toContain('"amount":"100"');
  });

  it("should produce deterministic keys regardless of payload order", () => {
    const key1 = makePlanKey("pay", { amount: 50n, user: "alice", currency: "USD" });
    const key2 = makePlanKey("pay", { currency: "USD", amount: 50n, user: "alice" });
    expect(key1).toBe(key2);
  });

  it("should produce different keys for different operations", () => {
    const payload = { amount: 100n };
    const key1 = makePlanKey("debit", payload);
    const key2 = makePlanKey("credit", payload);
    expect(key1).not.toBe(key2);
    expect(key1).toContain("debit:");
    expect(key2).toContain("credit:");
  });

  it("should produce different keys for different payloads", () => {
    const key1 = makePlanKey("transfer", { amount: 100n });
    const key2 = makePlanKey("transfer", { amount: 200n });
    expect(key1).not.toBe(key2);
  });

  it("should handle complex payloads", () => {
    const payload = {
      transfers: [
        { debit: "acc1", credit: "acc2", amount: 100n },
        { debit: "acc3", credit: "acc4", amount: 200n }
      ],
      metadata: { batch: "B-001" }
    };

    const key = makePlanKey("batch_transfer", payload);
    expect(key).toContain("batch_transfer:");
    expect(key).toContain("transfers");
    expect(key).toContain("metadata");
  });
});
