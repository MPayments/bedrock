import { describe, it, expect } from "vitest";
import { createLedgerEngine } from "../../src/engine";
import { createLedgerWorker } from "../../src/worker";
import { PlanType } from "../../src/types";
import {
  db,
  tb,
  randomOrgId,
  randomIdempotencyKey,
  getJournalEntry,
  getTbTransferPlans,
  getTbAccount,
  getTbTransfer
} from "./helpers";
import { tbAccountIdFor, tbLedgerForCurrency } from "../../src/ids";

describe("Worker Integration Tests", () => {
  const engine = createLedgerEngine({ db });
  const worker = createLedgerWorker({ db, tb });

  describe("processOutboxOnce - full posting flow", () => {
    it("should post simple create transfer to TigerBeetle", async () => {
      const orgId = randomOrgId();
      const currency = "USD";
      const debitKey = "customer:alice";
      const creditKey = "revenue:sales";

      // Create entry
      const input = {
        orgId,
        source: { type: "payment", id: "pay-001" },
        idempotencyKey: randomIdempotencyKey(),
        postingDate: new Date(),
        transfers: [
          {
            type: PlanType.CREATE,
            planKey: "transfer-1",
            debitKey,
            creditKey,
            currency,
            amount: 100000n
          }
        ]
      };

      const { entryId } = await engine.createEntry(input);

      // Process outbox
      const processed = await worker.processOutboxOnce();
      expect(processed).toBe(1);

      // Verify entry status
      const entry = await getJournalEntry(entryId);
      expect(entry!.status).toBe("posted");
      expect(entry!.postedAt).toBeDefined();

      // Verify TB transfer plans status
      const plans = await getTbTransferPlans(entryId);
      expect(plans[0]!.status).toBe("posted");

      // Verify accounts were created in TigerBeetle
      const tbLedger = tbLedgerForCurrency(currency);
      const debitAccountId = tbAccountIdFor(orgId, debitKey, tbLedger);
      const creditAccountId = tbAccountIdFor(orgId, creditKey, tbLedger);

      const debitAccount = await getTbAccount(debitAccountId);
      const creditAccount = await getTbAccount(creditAccountId);

      expect(debitAccount).toBeDefined();
      expect(creditAccount).toBeDefined();

      // Verify balances
      expect(debitAccount!.debits_posted).toBe(100000n);
      expect(creditAccount!.credits_posted).toBe(100000n);

      // Verify transfer was created
      const transferId = plans[0]!.transferId;
      const transfer = await getTbTransfer(transferId);

      expect(transfer).toBeDefined();
      expect(transfer!.amount).toBe(100000n);
      expect(transfer!.debit_account_id).toBe(debitAccountId);
      expect(transfer!.credit_account_id).toBe(creditAccountId);
    });

    it("should post multiple transfers in single entry", async () => {
      const orgId = randomOrgId();
      const currency = "USD";

      const input = {
        orgId,
        source: { type: "batch", id: "batch-001" },
        idempotencyKey: randomIdempotencyKey(),
        postingDate: new Date(),
        transfers: [
          {
            type: PlanType.CREATE,
            planKey: "transfer-1",
            debitKey: "customer:bob",
            creditKey: "revenue:sales",
            currency,
            amount: 50000n
          },
          {
            type: PlanType.CREATE,
            planKey: "transfer-2",
            debitKey: "customer:charlie",
            creditKey: "revenue:sales",
            currency,
            amount: 75000n
          }
        ]
      };

      const { entryId } = await engine.createEntry(input);

      // Process outbox
      const processed = await worker.processOutboxOnce();
      expect(processed).toBe(1);

      // Verify entry status
      const entry = await getJournalEntry(entryId);
      expect(entry!.status).toBe("posted");

      // Verify all plans are posted
      const plans = await getTbTransferPlans(entryId);
      expect(plans).toHaveLength(2);
      expect(plans[0]!.status).toBe("posted");
      expect(plans[1]!.status).toBe("posted");

      // Verify all transfers were created in TigerBeetle
      const transfer1 = await getTbTransfer(plans[0]!.transferId);
      const transfer2 = await getTbTransfer(plans[1]!.transferId);

      expect(transfer1).toBeDefined();
      expect(transfer2).toBeDefined();
      expect(transfer1!.amount).toBe(50000n);
      expect(transfer2!.amount).toBe(75000n);
    });

    it("should post pending transfer with timeout", async () => {
      const orgId = randomOrgId();
      const currency = "USD";

      const input = {
        orgId,
        source: { type: "reservation", id: "res-001" },
        idempotencyKey: randomIdempotencyKey(),
        postingDate: new Date(),
        transfers: [
          {
            type: PlanType.CREATE,
            planKey: "pending-1",
            debitKey: "customer:dave",
            creditKey: "revenue:pending",
            currency,
            amount: 150000n,
            pending: {
              timeoutSeconds: 3600
            }
          }
        ]
      };

      const { entryId } = await engine.createEntry(input);

      // Process outbox
      await worker.processOutboxOnce();

      // Verify entry posted
      const entry = await getJournalEntry(entryId);
      expect(entry!.status).toBe("posted");

      // Get transfer from TigerBeetle
      const plans = await getTbTransferPlans(entryId);
      const transfer = await getTbTransfer(plans[0]!.transferId);

      expect(transfer).toBeDefined();
      expect(transfer!.timeout).toBeGreaterThan(0);

      // Verify pending balances
      const tbLedger = tbLedgerForCurrency(currency);
      const debitAccountId = tbAccountIdFor(orgId, "customer:dave", tbLedger);
      const account = await getTbAccount(debitAccountId);

      expect(account!.debits_pending).toBe(150000n);
      expect(account!.debits_posted).toBe(0n);
    });

    it("should post linked transfers atomically", async () => {
      const orgId = randomOrgId();
      const currency = "USD";

      const input = {
        orgId,
        source: { type: "atomic", id: "atomic-001" },
        idempotencyKey: randomIdempotencyKey(),
        postingDate: new Date(),
        transfers: [
          {
            type: PlanType.CREATE,
            planKey: "chain-1",
            debitKey: "customer:eve",
            creditKey: "intermediate:escrow",
            currency,
            amount: 50000n,
            chain: "atomic-chain"
          },
          {
            type: PlanType.CREATE,
            planKey: "chain-2",
            debitKey: "intermediate:escrow",
            creditKey: "revenue:sales",
            currency,
            amount: 50000n,
            chain: "atomic-chain"
          }
        ]
      };

      const { entryId } = await engine.createEntry(input);

      // Process outbox
      await worker.processOutboxOnce();

      // Verify both transfers posted
      const plans = await getTbTransferPlans(entryId);
      expect(plans[0]!.status).toBe("posted");
      expect(plans[1]!.status).toBe("posted");

      // Verify transfers in TigerBeetle
      const transfer1 = await getTbTransfer(plans[0]!.transferId);
      const transfer2 = await getTbTransfer(plans[1]!.transferId);

      expect(transfer1).toBeDefined();
      expect(transfer2).toBeDefined();

      // Verify escrow account has balanced in/out
      const tbLedger = tbLedgerForCurrency(currency);
      const escrowAccountId = tbAccountIdFor(orgId, "intermediate:escrow", tbLedger);
      const escrowAccount = await getTbAccount(escrowAccountId);

      expect(escrowAccount!.credits_posted).toBe(50000n);
      expect(escrowAccount!.debits_posted).toBe(50000n);
    });

    it("should handle account reuse across transfers", async () => {
      const orgId = randomOrgId();
      const currency = "USD";
      const customerKey = "customer:frank";

      // First transfer
      const input1 = {
        orgId,
        source: { type: "payment", id: "pay-002" },
        idempotencyKey: randomIdempotencyKey(),
        postingDate: new Date(),
        transfers: [
          {
            type: PlanType.CREATE,
            planKey: "transfer-1",
            debitKey: customerKey,
            creditKey: "revenue:sales",
            currency,
            amount: 100000n
          }
        ]
      };

      await engine.createEntry(input1);
      await worker.processOutboxOnce();

      // Second transfer (reuse same account)
      const input2 = {
        orgId,
        source: { type: "payment", id: "pay-003" },
        idempotencyKey: randomIdempotencyKey(),
        postingDate: new Date(),
        transfers: [
          {
            type: PlanType.CREATE,
            planKey: "transfer-2",
            debitKey: customerKey,
            creditKey: "revenue:sales",
            currency,
            amount: 50000n
          }
        ]
      };

      await engine.createEntry(input2);
      await worker.processOutboxOnce();

      // Verify cumulative balance
      const tbLedger = tbLedgerForCurrency(currency);
      const accountId = tbAccountIdFor(orgId, customerKey, tbLedger);
      const account = await getTbAccount(accountId);

      expect(account!.debits_posted).toBe(150000n); // 100000 + 50000
    });

    it("should retry failed transfers (idempotent)", async () => {
      const orgId = randomOrgId();
      const currency = "USD";

      const input = {
        orgId,
        source: { type: "payment", id: "pay-retry" },
        idempotencyKey: randomIdempotencyKey(),
        postingDate: new Date(),
        transfers: [
          {
            type: PlanType.CREATE,
            planKey: "transfer-retry",
            debitKey: "customer:grace",
            creditKey: "revenue:sales",
            currency,
            amount: 100000n
          }
        ]
      };

      const { entryId } = await engine.createEntry(input);

      // Process outbox first time
      await worker.processOutboxOnce();

      // Get current state
      const entry1 = await getJournalEntry(entryId);
      expect(entry1!.status).toBe("posted");

      // Process again (should be idempotent - no error)
      const processed2 = await worker.processOutboxOnce();
      expect(processed2).toBe(0); // No more pending jobs

      // Verify no duplicate transfer
      const plans = await getTbTransferPlans(entryId);
      const transferId = plans[0]!.transferId;

      // Should still have exactly one transfer
      const transfer = await getTbTransfer(transferId);
      expect(transfer).toBeDefined();
    });

    it("should handle multiple currencies", async () => {
      const orgId = randomOrgId();

      // USD transfer
      const input1 = {
        orgId,
        source: { type: "payment", id: "pay-usd" },
        idempotencyKey: randomIdempotencyKey(),
        postingDate: new Date(),
        transfers: [
          {
            type: PlanType.CREATE,
            planKey: "usd-transfer",
            debitKey: "customer:henry",
            creditKey: "revenue:sales",
            currency: "USD",
            amount: 100000n
          }
        ]
      };

      // EUR transfer
      const input2 = {
        orgId,
        source: { type: "payment", id: "pay-eur" },
        idempotencyKey: randomIdempotencyKey(),
        postingDate: new Date(),
        transfers: [
          {
            type: PlanType.CREATE,
            planKey: "eur-transfer",
            debitKey: "customer:henry",
            creditKey: "revenue:sales",
            currency: "EUR",
            amount: 90000n
          }
        ]
      };

      await engine.createEntry(input1);
      await engine.createEntry(input2);

      // Process both
      await worker.processOutboxOnce({ batchSize: 10 });

      // Verify separate ledgers in TigerBeetle
      const usdLedger = tbLedgerForCurrency("USD");
      const eurLedger = tbLedgerForCurrency("EUR");

      expect(usdLedger).not.toBe(eurLedger);

      // Verify separate accounts per currency
      const usdAccountId = tbAccountIdFor(orgId, "customer:henry", usdLedger);
      const eurAccountId = tbAccountIdFor(orgId, "customer:henry", eurLedger);

      expect(usdAccountId).not.toBe(eurAccountId);

      const usdAccount = await getTbAccount(usdAccountId);
      const eurAccount = await getTbAccount(eurAccountId);

      expect(usdAccount!.debits_posted).toBe(100000n);
      expect(eurAccount!.debits_posted).toBe(90000n);
    });

    it("should process multiple entries in batch", async () => {
      const orgId = randomOrgId();

      // Create multiple entries
      for (let i = 0; i < 5; i++) {
        const input = {
          orgId,
          source: { type: "payment", id: `pay-batch-${i}` },
          idempotencyKey: randomIdempotencyKey(),
          postingDate: new Date(),
          transfers: [
            {
              type: PlanType.CREATE,
              planKey: `transfer-${i}`,
              debitKey: `customer:user-${i}`,
              creditKey: "revenue:sales",
              currency: "USD",
              amount: BigInt((i + 1) * 10000)
            }
          ]
        };

        await engine.createEntry(input);
      }

      // Process all at once
      const processed = await worker.processOutboxOnce({ batchSize: 10 });
      expect(processed).toBe(5);

      // Verify all posted
      const allEntries = await db.select().from(schema.journalEntries).where(eq(schema.journalEntries.orgId, orgId));
      expect(allEntries.every((e: any) => e.status === "posted")).toBe(true);
    });
  });
});

// Import schema and eq for queries
import { schema } from "@repo/db/schema";
import { eq } from "drizzle-orm";
