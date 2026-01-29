import { describe, it, expect } from "vitest";
import { accountRefKey, type AccountRef } from "../src/contract";

describe("accountRefKey", () => {
  describe("customer accounts", () => {
    it("generates correct key for customer account", () => {
      const ref: AccountRef = { kind: "customer", customerId: "cust_123", currency: "USD" };
      expect(accountRefKey(ref)).toBe("customer:cust_123:USD");
    });

    it("encodes special characters in customerId", () => {
      const ref: AccountRef = { kind: "customer", customerId: "cust:with:colons", currency: "USD" };
      expect(accountRefKey(ref)).toBe("customer:cust%3Awith%3Acolons:USD");
    });

    it("encodes special characters in currency", () => {
      const ref: AccountRef = { kind: "customer", customerId: "cust_123", currency: "USD:test" };
      expect(accountRefKey(ref)).toBe("customer:cust_123:USD%3Atest");
    });

    it("encodes spaces and unicode", () => {
      const ref: AccountRef = { kind: "customer", customerId: "cust 123", currency: "€UR" };
      expect(accountRefKey(ref)).toBe("customer:cust%20123:%E2%82%ACUR");
    });
  });

  describe("internal accounts", () => {
    it("generates correct key for internal account", () => {
      const ref: AccountRef = { kind: "internal", name: "fees_pool", currency: "USD" };
      expect(accountRefKey(ref)).toBe("internal:fees_pool:USD");
    });

    it("encodes special characters in name", () => {
      const ref: AccountRef = { kind: "internal", name: "fees:pool:v2", currency: "EUR" };
      expect(accountRefKey(ref)).toBe("internal:fees%3Apool%3Av2:EUR");
    });
  });

  describe("global_ledger accounts", () => {
    it("generates correct key for global_ledger account", () => {
      const ref: AccountRef = { kind: "global_ledger", code: "REVENUE", currency: "USD" };
      expect(accountRefKey(ref)).toBe("gl:REVENUE:USD");
    });

    it("encodes special characters in code", () => {
      const ref: AccountRef = { kind: "global_ledger", code: "REV:2024", currency: "GBP" };
      expect(accountRefKey(ref)).toBe("gl:REV%3A2024:GBP");
    });
  });

  describe("key uniqueness", () => {
    it("produces different keys for different account kinds with same identifiers", () => {
      const customerRef: AccountRef = { kind: "customer", customerId: "test", currency: "USD" };
      const internalRef: AccountRef = { kind: "internal", name: "test", currency: "USD" };

      expect(accountRefKey(customerRef)).not.toBe(accountRefKey(internalRef));
    });

    it("produces different keys for different currencies", () => {
      const usdRef: AccountRef = { kind: "customer", customerId: "cust_1", currency: "USD" };
      const eurRef: AccountRef = { kind: "customer", customerId: "cust_1", currency: "EUR" };

      expect(accountRefKey(usdRef)).not.toBe(accountRefKey(eurRef));
    });

    it("encoding prevents collision between similar-looking keys", () => {
      // Without encoding, these could collide: "customer:a:b:USD" vs "customer:a:b:USD"
      const ref1: AccountRef = { kind: "customer", customerId: "a:b", currency: "USD" };
      const ref2: AccountRef = { kind: "customer", customerId: "a", currency: "b:USD" };

      const key1 = accountRefKey(ref1);
      const key2 = accountRefKey(ref2);

      expect(key1).not.toBe(key2);
      // ref1: customer:a%3Ab:USD
      // ref2: customer:a:b%3AUSD
    });
  });

  describe("determinism", () => {
    it("produces the same key for the same input", () => {
      const ref: AccountRef = { kind: "customer", customerId: "cust_123", currency: "USD" };

      expect(accountRefKey(ref)).toBe(accountRefKey(ref));
      expect(accountRefKey({ ...ref })).toBe(accountRefKey(ref));
    });
  });
});
