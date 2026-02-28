import { describe, expect, it } from "vitest";

import {
  sha256Hex,
  normalizeTbId,
  TB_ID_MAX,
  TB_ID_MAX_ALLOWED,
  tbBookAccountInstanceIdFor,
  tbLedgerForCurrency,
  tbTransferIdForOperation,
  u128FromHash,
} from "@bedrock/kernel";

describe("normalizeTbId", () => {
  it("normalizes zero and negatives to 1", () => {
    expect(normalizeTbId(0n)).toBe(1n);
    expect(normalizeTbId(-1n)).toBe(1n);
  });

  it("caps values at TB_ID_MAX_ALLOWED", () => {
    expect(normalizeTbId(TB_ID_MAX)).toBe(TB_ID_MAX_ALLOWED);
    expect(normalizeTbId(TB_ID_MAX + 123n)).toBe(TB_ID_MAX_ALLOWED);
  });

  it("keeps valid values unchanged", () => {
    expect(normalizeTbId(1n)).toBe(1n);
    expect(normalizeTbId(999999999999n)).toBe(999999999999n);
  });
});

describe("u128FromHash", () => {
  it("produces deterministic u128 IDs", () => {
    const a = u128FromHash("test-input");
    const b = u128FromHash("test-input");

    expect(a).toBe(b);
    expect(a).toBeGreaterThan(0n);
    expect(a).toBeLessThan(TB_ID_MAX);
  });

  it("produces different IDs for different inputs", () => {
    expect(u128FromHash("input-a")).not.toBe(u128FromHash("input-b"));
  });

  it("has no collisions in a 1k sample", () => {
    const ids = new Set<bigint>();
    for (let i = 0; i < 1000; i++) {
      ids.add(u128FromHash(`sample-${i}`));
    }
    expect(ids.size).toBe(1000);
  });
});

describe("tbLedgerForCurrency", () => {
  it("returns a non-zero u32", () => {
    const ledger = tbLedgerForCurrency("USD");
    expect(ledger).toBeGreaterThan(0);
    expect(ledger).toBeLessThanOrEqual(0xffffffff);
  });

  it("is deterministic", () => {
    expect(tbLedgerForCurrency("USD")).toBe(tbLedgerForCurrency("USD"));
  });

  it("differs across currencies", () => {
    const usd = tbLedgerForCurrency("USD");
    const eur = tbLedgerForCurrency("EUR");
    expect(usd).not.toBe(eur);
  });
});

describe("tbBookAccountInstanceIdFor", () => {
  it("generates valid account IDs", () => {
    const tbLedger = tbLedgerForCurrency("USD");
    const id = tbBookAccountInstanceIdFor(
      "550e8400-e29b-41d4-a716-446655440000",
      "1000",
      "USD",
      "dims-hash",
      tbLedger,
    );

    expect(id).toBeGreaterThan(0n);
    expect(id).toBeLessThan(TB_ID_MAX);
  });

  it("is deterministic", () => {
    const tbLedger = tbLedgerForCurrency("USD");
    const id1 = tbBookAccountInstanceIdFor(
      "550e8400-e29b-41d4-a716-446655440000",
      "1000",
      "USD",
      "dims-hash",
      tbLedger,
    );
    const id2 = tbBookAccountInstanceIdFor(
      "550e8400-e29b-41d4-a716-446655440000",
      "1000",
      "USD",
      "dims-hash",
      tbLedger,
    );

    expect(id1).toBe(id2);
  });

  it("changes when org/account/currency/ledger changes", () => {
    const usdLedger = tbLedgerForCurrency("USD");
    const eurLedger = tbLedgerForCurrency("EUR");

    const base = tbBookAccountInstanceIdFor(
      "550e8400-e29b-41d4-a716-446655440000",
      "1000",
      "USD",
      "dims-hash",
      usdLedger,
    );

    expect(
      tbBookAccountInstanceIdFor(
        "550e8400-e29b-41d4-a716-446655440001",
        "1000",
        "USD",
        "dims-hash",
        usdLedger,
      ),
    ).not.toBe(base);

    expect(
      tbBookAccountInstanceIdFor(
        "550e8400-e29b-41d4-a716-446655440000",
        "2000",
        "USD",
        "dims-hash",
        usdLedger,
      ),
    ).not.toBe(base);

    expect(
      tbBookAccountInstanceIdFor(
        "550e8400-e29b-41d4-a716-446655440000",
        "1000",
        "EUR",
        "dims-hash",
        eurLedger,
      ),
    ).not.toBe(base);
  });
});

describe("tbTransferIdForOperation", () => {
  it("generates valid transfer IDs", () => {
    const id = tbTransferIdForOperation("op-123", 1, "plan-1");
    expect(id).toBeGreaterThan(0n);
    expect(id).toBeLessThan(TB_ID_MAX);
  });

  it("is deterministic", () => {
    const id1 = tbTransferIdForOperation("op-123", 1, "plan-1");
    const id2 = tbTransferIdForOperation("op-123", 1, "plan-1");
    expect(id1).toBe(id2);
  });

  it("changes when operation/line/planRef changes", () => {
    const base = tbTransferIdForOperation("op-123", 1, "plan-1");

    expect(tbTransferIdForOperation("op-456", 1, "plan-1")).not.toBe(base);
    expect(tbTransferIdForOperation("op-123", 2, "plan-1")).not.toBe(base);
    expect(tbTransferIdForOperation("op-123", 1, "plan-2")).not.toBe(base);
  });

  it("does not collide for 100 generated combinations", () => {
    const ids = new Set<bigint>();

    for (let i = 0; i < 100; i++) {
      ids.add(
        tbTransferIdForOperation(`op-${i % 10}`, (i % 5) + 1, `plan-${i}`),
      );
    }

    expect(ids.size).toBe(100);
  });
});

describe("sha256Hex", () => {
  it("returns a 64-char lowercase hex string", () => {
    const hash = sha256Hex("test");
    expect(hash).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);
  });

  it("is deterministic", () => {
    expect(sha256Hex("abc")).toBe(sha256Hex("abc"));
  });

  it("matches known vectors", () => {
    expect(sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(sha256Hex("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });
});
