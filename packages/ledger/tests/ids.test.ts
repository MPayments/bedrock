import { describe, it, expect } from "vitest";
import {
  normalizeTbId,
  u128FromHash,
  tbLedgerForCurrency,
  tbAccountIdFor,
  tbTransferIdForPlan,
  TB_ID_MAX,
  TB_ID_MAX_ALLOWED
} from "../src/ids";
import { sha256Hex } from "@bedrock/kernel";

describe("normalizeTbId", () => {
  it("should normalize zero to 1", () => {
    expect(normalizeTbId(0n)).toBe(1n);
  });

  it("should normalize negative to 1", () => {
    expect(normalizeTbId(-1n)).toBe(1n);
    expect(normalizeTbId(-100n)).toBe(1n);
  });

  it("should normalize TB_ID_MAX to TB_ID_MAX_ALLOWED", () => {
    expect(normalizeTbId(TB_ID_MAX)).toBe(TB_ID_MAX_ALLOWED);
  });

  it("should normalize values greater than TB_ID_MAX to TB_ID_MAX_ALLOWED", () => {
    expect(normalizeTbId(TB_ID_MAX + 1n)).toBe(TB_ID_MAX_ALLOWED);
    expect(normalizeTbId(TB_ID_MAX + 1000n)).toBe(TB_ID_MAX_ALLOWED);
  });

  it("should keep valid IDs unchanged", () => {
    expect(normalizeTbId(1n)).toBe(1n);
    expect(normalizeTbId(100n)).toBe(100n);
    expect(normalizeTbId(999999999999n)).toBe(999999999999n);
    expect(normalizeTbId(TB_ID_MAX_ALLOWED)).toBe(TB_ID_MAX_ALLOWED);
  });
});

describe("u128FromHash", () => {
  it("should generate valid 128-bit IDs", () => {
    const id = u128FromHash("test");
    expect(id).toBeGreaterThan(0n);
    expect(id).toBeLessThan(TB_ID_MAX);
  });

  it("should be deterministic", () => {
    const input = "test-input-123";
    const id1 = u128FromHash(input);
    const id2 = u128FromHash(input);
    expect(id1).toBe(id2);
  });

  it("should produce different IDs for different inputs", () => {
    const id1 = u128FromHash("input1");
    const id2 = u128FromHash("input2");
    expect(id1).not.toBe(id2);
  });

  it("should handle empty string", () => {
    const id = u128FromHash("");
    expect(id).toBeGreaterThan(0n);
    expect(id).toBeLessThan(TB_ID_MAX);
  });

  it("should handle special characters", () => {
    const id = u128FromHash("!@#$%^&*()_+-=[]{}|;:',.<>?/~`");
    expect(id).toBeGreaterThan(0n);
    expect(id).toBeLessThan(TB_ID_MAX);
  });

  it("should handle unicode characters", () => {
    const id = u128FromHash("你好世界🎉");
    expect(id).toBeGreaterThan(0n);
    expect(id).toBeLessThan(TB_ID_MAX);
  });

  it("should produce well-distributed IDs", () => {
    const ids = new Set<bigint>();
    for (let i = 0; i < 1000; i++) {
      ids.add(u128FromHash(`test-${i}`));
    }
    expect(ids.size).toBe(1000); // No collisions in 1000 samples
  });
});

describe("tbLedgerForCurrency", () => {
  it("should generate valid ledger IDs", () => {
    const ledger = tbLedgerForCurrency("USD");
    expect(ledger).toBeGreaterThan(0);
    expect(ledger).toBeLessThanOrEqual(0xFFFFFFFF); // u32 max
  });

  it("should be deterministic", () => {
    const ledger1 = tbLedgerForCurrency("USD");
    const ledger2 = tbLedgerForCurrency("USD");
    expect(ledger1).toBe(ledger2);
  });

  it("should produce different ledgers for different currencies", () => {
    const usd = tbLedgerForCurrency("USD");
    const eur = tbLedgerForCurrency("EUR");
    const gbp = tbLedgerForCurrency("GBP");

    expect(usd).not.toBe(eur);
    expect(eur).not.toBe(gbp);
    expect(usd).not.toBe(gbp);
  });

  it("should handle normalized currency codes", () => {
    const ledger = tbLedgerForCurrency("USD");
    expect(ledger).toBeGreaterThan(0);
  });

  it("should handle custom currency codes", () => {
    const btc = tbLedgerForCurrency("BTC");
    const eth = tbLedgerForCurrency("ETH");
    const points = tbLedgerForCurrency("POINTS");

    expect(btc).toBeGreaterThan(0);
    expect(eth).toBeGreaterThan(0);
    expect(points).toBeGreaterThan(0);
    expect(btc).not.toBe(eth);
  });

  it("should never return 0", () => {
    // Test various inputs to ensure we never get 0
    const currencies = ["USD", "EUR", "GBP", "JPY", "CHF", "AUD", "CAD", "CNY"];
    for (const currency of currencies) {
      expect(tbLedgerForCurrency(currency)).toBeGreaterThan(0);
    }
  });

  it("should produce well-distributed ledger IDs", () => {
    const ledgers = new Set<number>();
    const currencies = Array.from({ length: 100 }, (_, i) => `CUR${i}`);

    for (const currency of currencies) {
      ledgers.add(tbLedgerForCurrency(currency));
    }

    expect(ledgers.size).toBe(100); // No collisions
  });
});

describe("tbAccountIdFor", () => {
  it("should generate valid account IDs", () => {
    const id = tbAccountIdFor("org-123", "customer:alice", 1000);
    expect(id).toBeGreaterThan(0n);
    expect(id).toBeLessThan(TB_ID_MAX);
  });

  it("should be deterministic", () => {
    const id1 = tbAccountIdFor("org-123", "customer:alice", 1000);
    const id2 = tbAccountIdFor("org-123", "customer:alice", 1000);
    expect(id1).toBe(id2);
  });

  it("should produce different IDs for different orgs", () => {
    const id1 = tbAccountIdFor("org-123", "customer:alice", 1000);
    const id2 = tbAccountIdFor("org-456", "customer:alice", 1000);
    expect(id1).not.toBe(id2);
  });

  it("should produce different IDs for different keys", () => {
    const id1 = tbAccountIdFor("org-123", "customer:alice", 1000);
    const id2 = tbAccountIdFor("org-123", "customer:bob", 1000);
    expect(id1).not.toBe(id2);
  });

  it("should produce different IDs for different ledgers", () => {
    const id1 = tbAccountIdFor("org-123", "customer:alice", 1000);
    const id2 = tbAccountIdFor("org-123", "customer:alice", 2000);
    expect(id1).not.toBe(id2);
  });

  it("should handle complex account keys", () => {
    const keys = [
      "customer:company:acme:balance",
      "liability:loan:mortgage:12345",
      "revenue:subscription:premium:monthly",
      "expense:payroll:engineering:salaries"
    ];

    const ids = keys.map(key => tbAccountIdFor("org-123", key, 1000));
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(keys.length);
  });

  it("should be stable across multiple calls", () => {
    const orgId = "org-stable-test";
    const key = "account:test";
    const ledger = 5000;

    const ids = Array.from({ length: 100 }, () =>
      tbAccountIdFor(orgId, key, ledger)
    );

    const firstId = ids[0]!;
    expect(ids.every(id => id === firstId)).toBe(true);
  });
});

describe("tbTransferIdForPlan", () => {
  it("should generate valid transfer IDs", () => {
    const id = tbTransferIdForPlan("org-123", "entry-456", 1, "plan-key-1");
    expect(id).toBeGreaterThan(0n);
    expect(id).toBeLessThan(TB_ID_MAX);
  });

  it("should be deterministic", () => {
    const id1 = tbTransferIdForPlan("org-123", "entry-456", 1, "plan-key-1");
    const id2 = tbTransferIdForPlan("org-123", "entry-456", 1, "plan-key-1");
    expect(id1).toBe(id2);
  });

  it("should produce different IDs for different orgs", () => {
    const id1 = tbTransferIdForPlan("org-123", "entry-456", 1, "plan-key-1");
    const id2 = tbTransferIdForPlan("org-789", "entry-456", 1, "plan-key-1");
    expect(id1).not.toBe(id2);
  });

  it("should produce different IDs for different entries", () => {
    const id1 = tbTransferIdForPlan("org-123", "entry-456", 1, "plan-key-1");
    const id2 = tbTransferIdForPlan("org-123", "entry-789", 1, "plan-key-1");
    expect(id1).not.toBe(id2);
  });

  it("should produce different IDs for different indices", () => {
    const id1 = tbTransferIdForPlan("org-123", "entry-456", 1, "plan-key-1");
    const id2 = tbTransferIdForPlan("org-123", "entry-456", 2, "plan-key-1");
    expect(id1).not.toBe(id2);
  });

  it("should produce different IDs for different plan keys", () => {
    const id1 = tbTransferIdForPlan("org-123", "entry-456", 1, "plan-key-1");
    const id2 = tbTransferIdForPlan("org-123", "entry-456", 1, "plan-key-2");
    expect(id1).not.toBe(id2);
  });

  it("should handle multiple transfers in same entry", () => {
    const orgId = "org-batch";
    const entryId = "entry-multi";
    const planKey = "plan-x";

    const ids = Array.from({ length: 10 }, (_, i) =>
      tbTransferIdForPlan(orgId, entryId, i + 1, planKey)
    );

    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(10);
  });

  it("should handle complex plan keys", () => {
    const planKeys = [
      "transfer:customer:alice:to:revenue:sales",
      "refund:order:12345",
      "fee:payment:processor:stripe"
    ];

    const ids = planKeys.map((key, idx) =>
      tbTransferIdForPlan("org-123", "entry-456", idx + 1, key)
    );

    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(planKeys.length);
  });
});

describe("sha256Hex", () => {
  it("should generate 64-character hex strings", () => {
    const hash = sha256Hex("test");
    expect(hash).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);
  });

  it("should be deterministic", () => {
    const hash1 = sha256Hex("test-data");
    const hash2 = sha256Hex("test-data");
    expect(hash1).toBe(hash2);
  });

  it("should produce different hashes for different inputs", () => {
    const hash1 = sha256Hex("input1");
    const hash2 = sha256Hex("input2");
    expect(hash1).not.toBe(hash2);
  });

  it("should handle empty string", () => {
    const hash = sha256Hex("");
    expect(hash).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);
  });

  it("should handle large inputs", () => {
    const largeInput = "x".repeat(100000);
    const hash = sha256Hex(largeInput);
    expect(hash).toHaveLength(64);
  });

  it("should produce known SHA-256 hashes", () => {
    // Known SHA-256 test vectors
    const hash1 = sha256Hex("abc");
    expect(hash1).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");

    const hash2 = sha256Hex("");
    expect(hash2).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });
});

describe("ID collision resistance", () => {
  it("should not produce collisions in account IDs", () => {
    const ids = new Set<bigint>();
    const orgIds = ["org-1", "org-2", "org-3"];
    const keys = ["customer:a", "customer:b", "revenue:sales", "liability:debt"];
    const ledgers = [1000, 2000, 3000];

    for (const orgId of orgIds) {
      for (const key of keys) {
        for (const ledger of ledgers) {
          ids.add(tbAccountIdFor(orgId, key, ledger));
        }
      }
    }

    expect(ids.size).toBe(orgIds.length * keys.length * ledgers.length);
  });

  it("should not produce collisions in transfer IDs", () => {
    const ids = new Set<bigint>();
    const combinations = 100;

    for (let i = 0; i < combinations; i++) {
      const id = tbTransferIdForPlan(
        `org-${i % 10}`,
        `entry-${i % 20}`,
        (i % 5) + 1,
        `plan-${i}`
      );
      ids.add(id);
    }

    expect(ids.size).toBe(combinations);
  });
});
