import { describe, it, expect } from "vitest";
import { createLedgerEngine } from "../../src/engine";
import { PlanType } from "../../src/types";
import { IdempotencyConflictError } from "../../src/errors";
import {
  db,
  randomOrgId,
  randomIdempotencyKey,
  getJournalEntry,
  getJournalLines,
  getTbTransferPlans
} from "./helpers";

describe("Engine Integration Tests", () => {
  const engine = createLedgerEngine({ db });

  describe("createEntry - full flow", () => {
    it("should create entry with single transfer", async () => {
      const orgId = randomOrgId();
      const idempotencyKey = randomIdempotencyKey();

      const input = {
        orgId,
        source: { type: "payment", id: "pay-123" },
        idempotencyKey,
        postingDate: new Date(),
        transfers: [
          {
            type: PlanType.CREATE,
            planKey: "transfer-1",
            debitKey: "customer:alice",
            creditKey: "revenue:sales",
            currency: "USD",
            amount: 100000n,
            code: 1
          }
        ]
      };

      const { entryId } = await engine.createEntry(input);

      // Verify journal entry
      const entry = await getJournalEntry(entryId);
      expect(entry).toBeDefined();
      expect(entry!.orgId).toBe(orgId);
      expect(entry!.status).toBe("pending");
      expect(entry!.idempotencyKey).toBe(idempotencyKey);

      // Verify journal lines
      const lines = await getJournalLines(entryId);
      expect(lines).toHaveLength(2); // Debit and credit

      const debitLine = lines.find((l) => l.side === "debit");
      const creditLine = lines.find((l) => l.side === "credit");

      expect(debitLine).toBeDefined();
      expect(debitLine!.accountKey).toBe("customer:alice");
      expect(debitLine!.amountMinor).toBe(100000n);

      expect(creditLine).toBeDefined();
      expect(creditLine!.accountKey).toBe("revenue:sales");
      expect(creditLine!.amountMinor).toBe(100000n);

      // Verify TB transfer plans
      const plans = await getTbTransferPlans(entryId);
      expect(plans).toHaveLength(1);
      expect(plans[0]!.status).toBe("pending");
      expect(plans[0]!.amount).toBe(100000n);
    });

    it("should create entry with multiple transfers", async () => {
      const orgId = randomOrgId();

      const input = {
        orgId,
        source: { type: "batch", id: "batch-456" },
        idempotencyKey: randomIdempotencyKey(),
        postingDate: new Date(),
        transfers: [
          {
            type: PlanType.CREATE,
            planKey: "transfer-1",
            debitKey: "customer:alice",
            creditKey: "revenue:sales",
            currency: "USD",
            amount: 50000n
          },
          {
            type: PlanType.CREATE,
            planKey: "transfer-2",
            debitKey: "customer:bob",
            creditKey: "revenue:sales",
            currency: "USD",
            amount: 75000n
          },
          {
            type: PlanType.CREATE,
            planKey: "transfer-3",
            debitKey: "revenue:sales",
            creditKey: "liability:tax",
            currency: "USD",
            amount: 25000n
          }
        ]
      };

      const { entryId } = await engine.createEntry(input);

      // Verify journal lines (2 per transfer)
      const lines = await getJournalLines(entryId);
      expect(lines).toHaveLength(6);

      // Verify TB transfer plans
      const plans = await getTbTransferPlans(entryId);
      expect(plans).toHaveLength(3);
    });

    it("should handle idempotency - return existing entry", async () => {
      const orgId = randomOrgId();
      const idempotencyKey = randomIdempotencyKey();

      const input = {
        orgId,
        source: { type: "payment", id: "pay-789" },
        idempotencyKey,
        postingDate: new Date(),
        transfers: [
          {
            type: PlanType.CREATE,
            planKey: "transfer-1",
            debitKey: "customer:charlie",
            creditKey: "revenue:sales",
            currency: "USD",
            amount: 200000n
          }
        ]
      };

      // First call
      const result1 = await engine.createEntry(input);

      // Second call with same idempotency key
      const result2 = await engine.createEntry(input);

      // Should return same entry ID
      expect(result1.entryId).toBe(result2.entryId);

      // Should not create duplicate lines
      const lines = await getJournalLines(result1.entryId);
      expect(lines).toHaveLength(2);
    });

    it("should throw on idempotency conflict with different plan", async () => {
      const orgId = randomOrgId();
      const idempotencyKey = randomIdempotencyKey();

      const input1 = {
        orgId,
        source: { type: "payment", id: "pay-conflict" },
        idempotencyKey,
        postingDate: new Date(),
        transfers: [
          {
            type: PlanType.CREATE,
            planKey: "transfer-1",
            debitKey: "customer:dave",
            creditKey: "revenue:sales",
            currency: "USD",
            amount: 100000n
          }
        ]
      };

      // First call
      await engine.createEntry(input1);

      // Second call with different amount (different plan)
      const input2 = {
        ...input1,
        transfers: [
          {
            ...input1.transfers[0],
            amount: 200000n // Different amount
          }
        ]
      };

      await expect(engine.createEntry(input2)).rejects.toThrow(
        IdempotencyConflictError
      );
    });

    it("should create entry with pending transfer", async () => {
      const orgId = randomOrgId();

      const input = {
        orgId,
        source: { type: "reservation", id: "res-123" },
        idempotencyKey: randomIdempotencyKey(),
        postingDate: new Date(),
        transfers: [
          {
            type: PlanType.CREATE,
            planKey: "pending-transfer-1",
            debitKey: "customer:eve",
            creditKey: "revenue:pending",
            currency: "USD",
            amount: 150000n,
            pending: {
              timeoutSeconds: 3600
            }
          }
        ]
      };

      const { entryId } = await engine.createEntry(input);

      const plans = await getTbTransferPlans(entryId);
      expect(plans).toHaveLength(1);
      expect(plans[0]!.isPending).toBe(true);
      expect(plans[0]!.timeoutSeconds).toBe(3600);
    });

    it("should create entry with linked transfers (chain)", async () => {
      const orgId = randomOrgId();

      const input = {
        orgId,
        source: { type: "atomic-batch", id: "atomic-123" },
        idempotencyKey: randomIdempotencyKey(),
        postingDate: new Date(),
        transfers: [
          {
            type: PlanType.CREATE,
            planKey: "chain-1",
            debitKey: "customer:frank",
            creditKey: "intermediate:account",
            currency: "USD",
            amount: 50000n,
            chain: "atomic-chain"
          },
          {
            type: PlanType.CREATE,
            planKey: "chain-2",
            debitKey: "intermediate:account",
            creditKey: "revenue:sales",
            currency: "USD",
            amount: 50000n,
            chain: "atomic-chain"
          }
        ]
      };

      const { entryId } = await engine.createEntry(input);

      const plans = await getTbTransferPlans(entryId);
      expect(plans).toHaveLength(2);

      // First should be linked, last should not
      expect(plans[0]!.isLinked).toBe(true);
      expect(plans[1]!.isLinked).toBe(false);
    });

    it("should create post_pending plan", async () => {
      const orgId = randomOrgId();
      const pendingId = 99999n;

      const input = {
        orgId,
        source: { type: "post-pending", id: "post-123" },
        idempotencyKey: randomIdempotencyKey(),
        postingDate: new Date(),
        transfers: [
          {
            type: PlanType.POST_PENDING,
            planKey: "post-pending-1",
            currency: "USD",
            pendingId,
            amount: 0n // Post full amount
          }
        ]
      };

      const { entryId } = await engine.createEntry(input);

      // Should not create journal lines for post_pending
      const lines = await getJournalLines(entryId);
      expect(lines).toHaveLength(0);

      // Should create TB transfer plan
      const plans = await getTbTransferPlans(entryId);
      expect(plans).toHaveLength(1);
      expect(plans[0]!.type).toBe("post_pending");
      expect(plans[0]!.pendingId).toBe(pendingId);
      expect(plans[0]!.amount).toBe(0n);
    });

    it("should create void_pending plan", async () => {
      const orgId = randomOrgId();
      const pendingId = 88888n;

      const input = {
        orgId,
        source: { type: "void-pending", id: "void-123" },
        idempotencyKey: randomIdempotencyKey(),
        postingDate: new Date(),
        transfers: [
          {
            type: PlanType.VOID_PENDING,
            planKey: "void-pending-1",
            currency: "USD",
            pendingId
          }
        ]
      };

      const { entryId } = await engine.createEntry(input);

      // Should not create journal lines for void_pending
      const lines = await getJournalLines(entryId);
      expect(lines).toHaveLength(0);

      // Should create TB transfer plan
      const plans = await getTbTransferPlans(entryId);
      expect(plans).toHaveLength(1);
      expect(plans[0]!.type).toBe("void_pending");
      expect(plans[0]!.pendingId).toBe(pendingId);
      expect(plans[0]!.amount).toBe(0n);
    });

    it("should create outbox entry atomically", async () => {
      const orgId = randomOrgId();

      const input = {
        orgId,
        source: { type: "payment", id: "pay-outbox" },
        idempotencyKey: randomIdempotencyKey(),
        postingDate: new Date(),
        transfers: [
          {
            type: PlanType.CREATE,
            planKey: "transfer-outbox",
            debitKey: "customer:grace",
            creditKey: "revenue:sales",
            currency: "USD",
            amount: 100000n
          }
        ]
      };

      const { entryId } = await engine.createEntry(input);

      // Verify outbox entry was created
      const outboxEntries = await db.select().from(schema.outbox);
      const outboxEntry = outboxEntries.find((e: any) => e.refId === entryId);

      expect(outboxEntry).toBeDefined();
      expect(outboxEntry!.kind).toBe("post_journal");
      expect(outboxEntry!.status).toBe("pending");
    });

    it("should handle mixed transfer types", async () => {
      const orgId = randomOrgId();

      const input = {
        orgId,
        source: { type: "complex", id: "complex-123" },
        idempotencyKey: randomIdempotencyKey(),
        postingDate: new Date(),
        transfers: [
          {
            type: PlanType.CREATE,
            planKey: "create-1",
            debitKey: "customer:henry",
            creditKey: "revenue:sales",
            currency: "USD",
            amount: 100000n
          },
          {
            type: PlanType.POST_PENDING,
            planKey: "post-1",
            currency: "USD",
            pendingId: 12345n,
            amount: 50000n
          },
          {
            type: PlanType.VOID_PENDING,
            planKey: "void-1",
            currency: "USD",
            pendingId: 67890n
          }
        ]
      };

      const { entryId } = await engine.createEntry(input);

      // Should create journal lines only for CREATE transfers
      const lines = await getJournalLines(entryId);
      expect(lines).toHaveLength(2);

      // Should create all TB transfer plans
      const plans = await getTbTransferPlans(entryId);
      expect(plans).toHaveLength(3);
    });

    it("should handle large amounts (near uint128 max)", async () => {
      const orgId = randomOrgId();
      // Use large but valid PostgreSQL bigint value (max is 2^63-1)
      const largeAmount = (1n << 62n) - 1n; // Large value that fits in PostgreSQL bigint

      const input = {
        orgId,
        source: { type: "large-payment", id: "large-123" },
        idempotencyKey: randomIdempotencyKey(),
        postingDate: new Date(),
        transfers: [
          {
            type: PlanType.CREATE,
            planKey: "large-transfer",
            debitKey: "customer:whale",
            creditKey: "revenue:vip",
            currency: "USD",
            amount: largeAmount
          }
        ]
      };

      const { entryId } = await engine.createEntry(input);

      const lines = await getJournalLines(entryId);
      expect(lines).toHaveLength(2);
      expect(lines[0]!.amountMinor).toBe(largeAmount);

      const plans = await getTbTransferPlans(entryId);
      expect(plans[0]!.amount).toBe(largeAmount);
    });
  });
});

// Import schema for outbox queries
import { schema } from "@bedrock/db/schema";
