import { describe, it, expect } from "vitest";
import { resolveTbAccountId } from "../../src/resolve";
import { AccountMappingConflictError } from "../../src/errors";
import { tbAccountIdFor, tbLedgerForCurrency } from "../../src/ids";
import {
  db,
  tb,
  randomOrgId,
  getLedgerAccount,
  getTbAccount
} from "./helpers";

describe("Resolve Integration Tests", () => {
  describe("resolveTbAccountId", () => {
    it("should create account in both PostgreSQL and TigerBeetle", async () => {
      const orgId = randomOrgId();
      const key = "customer:alice";
      const currency = "USD";
      const tbLedger = tbLedgerForCurrency(currency);

      const accountId = await resolveTbAccountId({
        db,
        tb,
        orgId,
        key,
        currency,
        tbLedger
      });

      expect(accountId).toBeGreaterThan(0n);

      // Verify in PostgreSQL
      const pgAccount = await getLedgerAccount(orgId, key, tbLedger);
      expect(pgAccount).toBeDefined();
      expect(pgAccount!.orgId).toBe(orgId);
      expect(pgAccount!.key).toBe(key);
      expect(pgAccount!.currency).toBe(currency);
      expect(pgAccount!.tbAccountId).toBe(accountId);

      // Verify in TigerBeetle
      const tbAccount = await getTbAccount(accountId);
      expect(tbAccount).toBeDefined();
      expect(tbAccount!.id).toBe(accountId);
      expect(tbAccount!.ledger).toBe(tbLedger);
      expect(tbAccount!.debits_posted).toBe(0n);
      expect(tbAccount!.credits_posted).toBe(0n);
    });

    it("should return existing account ID on second call", async () => {
      const orgId = randomOrgId();
      const key = "customer:bob";
      const currency = "USD";
      const tbLedger = tbLedgerForCurrency(currency);

      // First call
      const accountId1 = await resolveTbAccountId({
        db,
        tb,
        orgId,
        key,
        currency,
        tbLedger
      });

      // Second call
      const accountId2 = await resolveTbAccountId({
        db,
        tb,
        orgId,
        key,
        currency,
        tbLedger
      });

      // Should return same ID
      expect(accountId1).toBe(accountId2);
    });

    it("should apply credit-normal account flags to customer wallet keys", async () => {
      const orgId = randomOrgId();
      const key = "treasury:CustomerWallet:customer-1:USD";
      const currency = "USD";
      const tbLedger = tbLedgerForCurrency(currency);

      const accountId = await resolveTbAccountId({
        db,
        tb,
        orgId,
        key,
        currency,
        tbLedger
      });

      const tbAccount = await getTbAccount(accountId);
      expect(tbAccount).toBeDefined();

      const { AccountFlags } = await import("tigerbeetle-node");
      expect(tbAccount!.flags).toBe(AccountFlags.debits_must_not_exceed_credits);
    });

    it("should apply debit-normal account flags to bank keys", async () => {
      const orgId = randomOrgId();
      const key = "treasury:Bank:org-1:bank-1:USD";
      const currency = "USD";
      const tbLedger = tbLedgerForCurrency(currency);

      const accountId = await resolveTbAccountId({
        db,
        tb,
        orgId,
        key,
        currency,
        tbLedger
      });

      const tbAccount = await getTbAccount(accountId);
      expect(tbAccount).toBeDefined();

      const { AccountFlags } = await import("tigerbeetle-node");
      expect(tbAccount!.flags).toBe(AccountFlags.credits_must_not_exceed_debits);
    });

    it("should generate deterministic account IDs", async () => {
      const orgId = randomOrgId();
      const key = "customer:charlie";
      const currency = "USD";
      const tbLedger = tbLedgerForCurrency(currency);

      const expectedId = tbAccountIdFor(orgId, key, tbLedger);

      const actualId = await resolveTbAccountId({
        db,
        tb,
        orgId,
        key,
        currency,
        tbLedger
      });

      expect(actualId).toBe(expectedId);
    });

    it("should create different accounts for different org IDs", async () => {
      const orgId1 = randomOrgId();
      const orgId2 = randomOrgId();
      const key = "customer:dave";
      const currency = "USD";
      const tbLedger = tbLedgerForCurrency(currency);

      const accountId1 = await resolveTbAccountId({
        db,
        tb,
        orgId: orgId1,
        key,
        currency,
        tbLedger
      });

      const accountId2 = await resolveTbAccountId({
        db,
        tb,
        orgId: orgId2,
        key,
        currency,
        tbLedger
      });

      expect(accountId1).not.toBe(accountId2);
    });

    it("should create different accounts for different keys", async () => {
      const orgId = randomOrgId();
      const currency = "USD";
      const tbLedger = tbLedgerForCurrency(currency);

      const accountId1 = await resolveTbAccountId({
        db,
        tb,
        orgId,
        key: "customer:eve",
        currency,
        tbLedger
      });

      const accountId2 = await resolveTbAccountId({
        db,
        tb,
        orgId,
        key: "revenue:sales",
        currency,
        tbLedger
      });

      expect(accountId1).not.toBe(accountId2);
    });

    it("should create different accounts for different currencies", async () => {
      const orgId = randomOrgId();
      const key = "customer:frank";

      const usdLedger = tbLedgerForCurrency("USD");
      const eurLedger = tbLedgerForCurrency("EUR");

      const usdAccountId = await resolveTbAccountId({
        db,
        tb,
        orgId,
        key,
        currency: "USD",
        tbLedger: usdLedger
      });

      const eurAccountId = await resolveTbAccountId({
        db,
        tb,
        orgId,
        key,
        currency: "EUR",
        tbLedger: eurLedger
      });

      expect(usdAccountId).not.toBe(eurAccountId);

      // Verify both exist in TigerBeetle with correct ledgers
      const usdAccount = await getTbAccount(usdAccountId);
      const eurAccount = await getTbAccount(eurAccountId);

      expect(usdAccount!.ledger).toBe(usdLedger);
      expect(eurAccount!.ledger).toBe(eurLedger);
    });

    it("should handle concurrent account creation (race condition)", async () => {
      const orgId = randomOrgId();
      const key = "customer:grace";
      const currency = "USD";
      const tbLedger = tbLedgerForCurrency(currency);

      // Simulate concurrent calls
      const [id1, id2, id3] = await Promise.all([
        resolveTbAccountId({ db, tb, orgId, key, currency, tbLedger }),
        resolveTbAccountId({ db, tb, orgId, key, currency, tbLedger }),
        resolveTbAccountId({ db, tb, orgId, key, currency, tbLedger })
      ]);

      // All should return same ID
      expect(id1).toBe(id2);
      expect(id2).toBe(id3);

      // Should only have one account in PostgreSQL
      const pgAccount = await getLedgerAccount(orgId, key, tbLedger);
      expect(pgAccount).toBeDefined();
    });

    it("should handle complex account keys", async () => {
      const orgId = randomOrgId();
      const currency = "USD";
      const tbLedger = tbLedgerForCurrency(currency);

      const keys = [
        "customer:company:acme:balance",
        "liability:loan:mortgage:12345",
        "revenue:subscription:premium:monthly",
        "expense:payroll:engineering:salaries"
      ];

      const accountIds = await Promise.all(
        keys.map((key) =>
          resolveTbAccountId({ db, tb, orgId, key, currency, tbLedger })
        )
      );

      // All should be unique
      const uniqueIds = new Set(accountIds);
      expect(uniqueIds.size).toBe(keys.length);

      // All should exist in TigerBeetle
      for (const id of accountIds) {
        const account = await getTbAccount(id);
        expect(account).toBeDefined();
      }
    });

    it("should assign account codes based on key hash", async () => {
      const orgId = randomOrgId();
      const currency = "USD";
      const tbLedger = tbLedgerForCurrency(currency);

      const keys = [
        "customer:henry",
        "revenue:sales",
        "liability:tax",
        "expense:operations"
      ];

      for (const key of keys) {
        const accountId = await resolveTbAccountId({
          db,
          tb,
          orgId,
          key,
          currency,
          tbLedger
        });

        const tbAccount = await getTbAccount(accountId);

        // Code should be deterministic and in valid range
        expect(tbAccount!.code).toBeGreaterThan(0);
        expect(tbAccount!.code).toBeLessThanOrEqual(0xffff);
      }
    });

    it("should create many accounts efficiently", async () => {
      const orgId = randomOrgId();
      const currency = "USD";
      const tbLedger = tbLedgerForCurrency(currency);

      const count = 50;
      const keys = Array.from({ length: count }, (_, i) => `account:batch:${i}`);

      const startTime = Date.now();

      const accountIds = await Promise.all(
        keys.map((key) =>
          resolveTbAccountId({ db, tb, orgId, key, currency, tbLedger })
        )
      );

      const duration = Date.now() - startTime;

      // Should complete in reasonable time (< 10 seconds for 50 accounts)
      expect(duration).toBeLessThan(10000);

      // All should be unique
      const uniqueIds = new Set(accountIds);
      expect(uniqueIds.size).toBe(count);
    });

    it("should handle TigerBeetle account exists gracefully", async () => {
      const orgId = randomOrgId();
      const key = "customer:ivan";
      const currency = "USD";
      const tbLedger = tbLedgerForCurrency(currency);

      // First call creates account
      const accountId1 = await resolveTbAccountId({
        db,
        tb,
        orgId,
        key,
        currency,
        tbLedger
      });

      // Delete from PostgreSQL but keep in TigerBeetle
      await db.execute(sql`DELETE FROM ${schema.ledgerAccounts} WHERE org_id = ${orgId}`);

      // Second call should still work (TB account exists)
      const accountId2 = await resolveTbAccountId({
        db,
        tb,
        orgId,
        key,
        currency,
        tbLedger
      });

      // Should return same ID
      expect(accountId1).toBe(accountId2);

      // Should recreate in PostgreSQL
      const pgAccount = await getLedgerAccount(orgId, key, tbLedger);
      expect(pgAccount).toBeDefined();
    });

    it("should verify account balances start at zero", async () => {
      const orgId = randomOrgId();
      const key = "customer:julia";
      const currency = "USD";
      const tbLedger = tbLedgerForCurrency(currency);

      const accountId = await resolveTbAccountId({
        db,
        tb,
        orgId,
        key,
        currency,
        tbLedger
      });

      const tbAccount = await getTbAccount(accountId);

      // All balances should be zero for new account
      expect(tbAccount!.debits_pending).toBe(0n);
      expect(tbAccount!.debits_posted).toBe(0n);
      expect(tbAccount!.credits_pending).toBe(0n);
      expect(tbAccount!.credits_posted).toBe(0n);
    });
  });
});

// Import schema and sql for queries
import { schema } from "@bedrock/db/schema";
import { sql } from "drizzle-orm";
