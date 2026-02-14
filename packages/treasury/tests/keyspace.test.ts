import { describe, it, expect } from "vitest";
import { treasuryKeyspace } from "../src/keyspace";

describe("treasuryKeyspace", () => {
    const K = treasuryKeyspace.keys;
    const NS = "treasury"; // namespace prefix

    describe("customerWallet", () => {
        it("should generate correct key format", () => {
            const key = K.customerWallet("customer-123", "USD");
            expect(key).toBe(`${NS}:CustomerWallet:customer-123:USD`);
        });

        it("should include currency in key", () => {
            const keyUsd = K.customerWallet("customer-123", "USD");
            const keyEur = K.customerWallet("customer-123", "EUR");
            expect(keyUsd).not.toBe(keyEur);
        });
    });

    describe("bank", () => {
        it("should generate correct key format", () => {
            const key = K.bank("org-123", "bank-stable-key", "USD");
            expect(key).toBe(`${NS}:Bank:org-123:bank-stable-key:USD`);
        });

        it("should differentiate by orgId", () => {
            const key1 = K.bank("org-1", "bank-key", "USD");
            const key2 = K.bank("org-2", "bank-key", "USD");
            expect(key1).not.toBe(key2);
        });

        it("should differentiate by bankStableKey", () => {
            const key1 = K.bank("org-1", "bank-1", "USD");
            const key2 = K.bank("org-1", "bank-2", "USD");
            expect(key1).not.toBe(key2);
        });
    });

    describe("treasuryPool", () => {
        it("should generate correct key format", () => {
            const key = K.treasuryPool("USD");
            expect(key).toBe(`${NS}:TreasuryPool:USD`);
        });
    });

    describe("intercompanyNet", () => {
        it("should generate correct key format", () => {
            const key = K.intercompanyNet("branch-456", "USD");
            expect(key).toBe(`${NS}:IC:BranchNet:branch-456:USD`);
        });

        it("should differentiate by branch org", () => {
            const key = K.intercompanyNet("a", "USD");
            const key2 = K.intercompanyNet("b", "USD");
            expect(key).not.toBe(key2);
        });
    });

    describe("orderPayIn", () => {
        it("should generate correct key format", () => {
            const key = K.orderPayIn("order-123", "USD");
            expect(key).toBe(`${NS}:OrderPayIn:order-123:USD`);
        });
    });

    describe("payoutObligation", () => {
        it("should generate correct key format", () => {
            const key = K.payoutObligation("order-123", "EUR");
            expect(key).toBe(`${NS}:PayoutObligation:order-123:EUR`);
        });
    });

    describe("revenueFee", () => {
        it("should generate correct key format", () => {
            const key = K.revenueFee("USD");
            expect(key).toBe(`${NS}:Revenue:Fee:USD`);
        });
    });

    describe("revenueSpread", () => {
        it("should generate correct key format", () => {
            const key = K.revenueSpread("USD");
            expect(key).toBe(`${NS}:Revenue:FXSpread:USD`);
        });
    });

    describe("feeRevenueBucket", () => {
        it("should generate bucketed fee revenue key", () => {
            const key = K.feeRevenueBucket("bank", "EUR");
            expect(key).toBe(`${NS}:Revenue:Fee:bank:EUR`);
        });
    });

    describe("feeClearing", () => {
        it("should generate clearing account key for separate fee payment", () => {
            const key = K.feeClearing("bank", "EUR");
            expect(key).toBe(`${NS}:Liability:FeeClearing:bank:EUR`);
        });
    });

    describe("keyspace properties", () => {
        it("should have a namespace", () => {
            expect(treasuryKeyspace.namespace).toBe("treasury");
        });

        it("should have all expected keys", () => {
            expect(K.customerWallet).toBeDefined();
            expect(K.bank).toBeDefined();
            expect(K.treasuryPool).toBeDefined();
            expect(K.intercompanyNet).toBeDefined();
            expect(K.orderPayIn).toBeDefined();
            expect(K.payoutObligation).toBeDefined();
            expect(K.revenueFee).toBeDefined();
            expect(K.revenueSpread).toBeDefined();
            expect(K.feeRevenueBucket).toBeDefined();
            expect(K.feeClearing).toBeDefined();
        });
    });
});
