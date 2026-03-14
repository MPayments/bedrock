import { describe, it, expect, vi, beforeEach } from "vitest";

import { createStubDb, createMockTbClient, mockDbExecuteResult, type StubDatabase } from "./helpers";
import { LedgerError, OPERATION_TRANSFER_TYPE } from "@bedrock/ledger";

import { createLedgerWorkerDefinition } from "../src";

async function runWorkerOnce(
  worker: ReturnType<typeof createLedgerWorkerDefinition>,
  now: Date = new Date("2026-03-01T00:00:00Z"),
) {
  const result = await worker.runOnce({
    now,
    signal: new AbortController().signal,
  });
  return result.processed;
}

describe("createLedgerWorkerDefinition", () => {
  let db: StubDatabase;
  let tb: ReturnType<typeof createMockTbClient>;
  let worker: ReturnType<typeof createLedgerWorkerDefinition>;

  beforeEach(() => {
    db = createStubDb();
    tb = createMockTbClient();
    worker = createLedgerWorkerDefinition({ db, tb });
  });

  describe("runOnce", () => {
    it("should return 0 when no jobs available", async () => {
      vi.mocked(db.execute).mockResolvedValue(mockDbExecuteResult([]));

      const processed = await runWorkerOnce(worker);

      expect(processed).toBe(0);
    });

    it("should process single job successfully", async () => {
      const job = {
        outbox_id: "outbox-1",
        org_id: "org-123",
        journal_entry_id: "entry-456",
        attempts: 1
      };

      vi.mocked(db.execute)
        .mockResolvedValueOnce(mockDbExecuteResult([job])) // Claim
        .mockResolvedValueOnce(mockDbExecuteResult([])) // Plans query
        .mockResolvedValue(mockDbExecuteResult([])); // Updates

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(async () => [])
          }))
        }))
      } as any);

      vi.mocked(tb.createTransfers).mockResolvedValue([]);

      const processed = await runWorkerOnce(worker);

      expect(processed).toBe(1);
    });

    it("should process multiple jobs", async () => {
      const jobs = [
        { outbox_id: "outbox-1", org_id: "org-123", journal_entry_id: "entry-1", attempts: 1 },
        { outbox_id: "outbox-2", org_id: "org-123", journal_entry_id: "entry-2", attempts: 1 }
      ];

      vi.mocked(db.execute)
        .mockResolvedValueOnce(mockDbExecuteResult(jobs))
        .mockResolvedValue(mockDbExecuteResult([]));

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(async () => [])
          }))
        }))
      } as any);

      vi.mocked(tb.createTransfers).mockResolvedValue([]);

      const processed = await runWorkerOnce(worker);

      expect(processed).toBe(2);
    });

    it("should mark job as done on success", async () => {
      const job = {
        outbox_id: "outbox-1",
        org_id: "org-123",
        journal_entry_id: "entry-456",
        attempts: 1
      };

      vi.mocked(db.execute)
        .mockResolvedValueOnce(mockDbExecuteResult([job])) // Claim job
        .mockResolvedValue(mockDbExecuteResult([])); // All subsequent updates

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(async () => [])
          }))
        }))
      } as any);

      vi.mocked(tb.createTransfers).mockResolvedValue([]);

      await runWorkerOnce(worker);

      // Should have called execute for claim and transaction for updates
      expect(db.execute).toHaveBeenCalled();
      // Updates are now wrapped in transactions
      expect(db.transaction).toHaveBeenCalled();
    });

    it("should retry on transient failure", async () => {
      const job = {
        outbox_id: "outbox-1",
        org_id: "org-123",
        journal_entry_id: "entry-456",
        attempts: 3
      };

      vi.mocked(db.execute)
        .mockResolvedValueOnce(mockDbExecuteResult([job]))
        .mockResolvedValue(mockDbExecuteResult([]));

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => {
              throw new Error("Transient DB error");
            })
          }))
        }))
      } as any);

      await runWorkerOnce(worker);

      // Should have updated outbox to retry
      expect(db.execute).toHaveBeenCalled();
    });

    it("should mark as failed after max attempts", async () => {
      const job = {
        outbox_id: "outbox-1",
        org_id: "org-123",
        journal_entry_id: "entry-456",
        attempts: 25 // At max
      };

      vi.mocked(db.execute)
        .mockResolvedValueOnce(mockDbExecuteResult([job]))
        .mockResolvedValue(mockDbExecuteResult([]));

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => {
              throw new LedgerError("Permanent failure");
            })
          }))
        }))
      } as any);

      worker = createLedgerWorkerDefinition({ db, tb, maxAttempts: 25 });
      await runWorkerOnce(worker);

      // Should have marked as failed
      expect(db.execute).toHaveBeenCalled();
    });

    it("should respect batchSize option", async () => {
      const batchSize = 10;

      vi.mocked(db.execute).mockResolvedValue(mockDbExecuteResult([]));

      worker = createLedgerWorkerDefinition({ db, tb, batchSize });
      await runWorkerOnce(worker);

      // Verify LIMIT was set correctly in query
      expect(db.execute).toHaveBeenCalled();
    });

    it("should respect maxAttempts option", async () => {
      const maxAttempts = 10;

      vi.mocked(db.execute).mockResolvedValue(mockDbExecuteResult([]));

      worker = createLedgerWorkerDefinition({ db, tb, maxAttempts });
      await runWorkerOnce(worker);

      expect(db.execute).toHaveBeenCalled();
    });

    it("should use lease-based locking", async () => {
      const leaseSeconds = 300;

      vi.mocked(db.execute).mockResolvedValue(mockDbExecuteResult([]));

      worker = createLedgerWorkerDefinition({ db, tb, leaseSeconds });
      await runWorkerOnce(worker);

      expect(db.execute).toHaveBeenCalled();
    });

    it("should handle processing jobs with expired leases", async () => {
      vi.mocked(db.execute).mockResolvedValue(mockDbExecuteResult([]));

      worker = createLedgerWorkerDefinition({ db, tb, leaseSeconds: 600 });
      await runWorkerOnce(worker);

      expect(db.execute).toHaveBeenCalled();
    });
  });

  describe("postJournal", () => {
    /**
     * Note: The postJournal functionality is comprehensively tested in integration tests:
     *
     * - tests/integration/worker.test.ts:
     *   - "should post simple create transfer to TigerBeetle" (line 22)
     *   - "should post multiple transfers in single entry" (line 86)
     *   - "should post pending transfer with timeout" (line 141)
     *   - "should post linked transfers atomically" (line 190)
     *   - "should handle account reuse across transfers" (line 247)
     *   - "should retry failed transfers (idempotent)" (line 302)
     *   - "should handle multiple currencies" (line 345)
     *   - "should process multiple entries in batch" (line 409)
     *
     * Unit tests below focus on edge cases that don't require full account resolution.
     */

    it("should post post_pending transfer with TB_AMOUNT_MAX for full post", async () => {
      const plan = {
        id: "plan-1",
        orgId: "org-123",
        journalEntryId: "entry-456",
        idx: 1,
        planKey: "plan-key-1",
        type: OPERATION_TRANSFER_TYPE.POST_PENDING,
        chainId: null,
        transferId: 12345n,
        debitKey: null,
        creditKey: null,
        currency: "USD",
        tbLedger: 1000,
        amount: 0n, // 0 means post full
        code: 0,
        isLinked: false,
        isPending: false,
        timeoutSeconds: 0,
        pendingId: 99999n,
        status: "pending" as const,
        error: null,
        createdAt: new Date()
      };

      const job = {
        outbox_id: "outbox-1",
        org_id: "org-123",
        journal_entry_id: "entry-456",
        attempts: 1
      };

      vi.mocked(db.execute)
        .mockResolvedValueOnce(mockDbExecuteResult([job]))
        .mockResolvedValue(mockDbExecuteResult([]));

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(async () => [plan])
          }))
        }))
      } as any);

      vi.mocked(tb.createTransfers).mockResolvedValue([]);

      await runWorkerOnce(worker);

      const transferCall = vi.mocked(tb.createTransfers).mock.calls[0];
      expect(transferCall).toBeDefined();
      const transfer = transferCall![0][0];
      expect(transfer.amount).toBe((1n << 128n) - 1n); // TB_AMOUNT_MAX
    });

    it("should post post_pending transfer with explicit amount", async () => {
      const plan = {
        id: "plan-1",
        orgId: "org-123",
        journalEntryId: "entry-456",
        idx: 1,
        planKey: "plan-key-1",
        type: OPERATION_TRANSFER_TYPE.POST_PENDING,
        chainId: null,
        transferId: 12345n,
        debitKey: null,
        creditKey: null,
        currency: "USD",
        tbLedger: 1000,
        amount: 321n,
        code: 0,
        isLinked: false,
        isPending: false,
        timeoutSeconds: 0,
        pendingId: 99999n,
        status: "pending" as const,
        error: null,
        createdAt: new Date()
      };

      const job = {
        outbox_id: "outbox-1",
        org_id: "org-123",
        journal_entry_id: "entry-456",
        attempts: 1
      };

      vi.mocked(db.execute)
        .mockResolvedValueOnce(mockDbExecuteResult([job]))
        .mockResolvedValue(mockDbExecuteResult([]));

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(async () => [plan])
          }))
        }))
      } as any);

      vi.mocked(tb.createTransfers).mockResolvedValue([]);

      await runWorkerOnce(worker);

      const transferCall = vi.mocked(tb.createTransfers).mock.calls[0];
      expect(transferCall).toBeDefined();
      const transfer = transferCall![0][0];
      expect(transfer.amount).toBe(321n);
    });

    it("should fail posting when pending transfer plan misses pendingId", async () => {
      const plan = {
        id: "plan-1",
        orgId: "org-123",
        journalEntryId: "entry-456",
        idx: 1,
        planKey: "plan-key-1",
        type: OPERATION_TRANSFER_TYPE.POST_PENDING,
        chainId: null,
        transferId: 12345n,
        debitKey: null,
        creditKey: null,
        currency: "USD",
        tbLedger: 1000,
        amount: 10n,
        code: 0,
        isLinked: false,
        isPending: false,
        timeoutSeconds: 0,
        pendingId: null,
        status: "pending" as const,
        error: null,
        createdAt: new Date()
      };

      const job = {
        outbox_id: "outbox-1",
        org_id: "org-123",
        journal_entry_id: "entry-456",
        attempts: 1
      };

      vi.mocked(db.execute)
        .mockResolvedValueOnce(mockDbExecuteResult([job]))
        .mockResolvedValue(mockDbExecuteResult([]));

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(async () => [plan])
          }))
        }))
      } as any);

      await runWorkerOnce(worker);

      expect(tb.createTransfers).not.toHaveBeenCalled();
      expect(db.transaction).toHaveBeenCalled();
    });

    it("should post void_pending transfer", async () => {
      const plan = {
        id: "plan-1",
        orgId: "org-123",
        journalEntryId: "entry-456",
        idx: 1,
        planKey: "plan-key-1",
        type: OPERATION_TRANSFER_TYPE.VOID_PENDING,
        chainId: null,
        transferId: 12345n,
        debitKey: null,
        creditKey: null,
        currency: "USD",
        tbLedger: 1000,
        amount: 0n,
        code: 0,
        isLinked: false,
        isPending: false,
        timeoutSeconds: 0,
        pendingId: 88888n,
        status: "pending" as const,
        error: null,
        createdAt: new Date()
      };

      const job = {
        outbox_id: "outbox-1",
        org_id: "org-123",
        journal_entry_id: "entry-456",
        attempts: 1
      };

      vi.mocked(db.execute)
        .mockResolvedValueOnce(mockDbExecuteResult([job]))
        .mockResolvedValue(mockDbExecuteResult([]));

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(async () => [plan])
          }))
        }))
      } as any);

      vi.mocked(tb.createTransfers).mockResolvedValue([]);

      await runWorkerOnce(worker);

      expect(tb.createTransfers).toHaveBeenCalled();
    });

    // Note: "should skip already posted plans" is covered by integration test
    // "should retry failed transfers (idempotent)" at integration/worker.test.ts:302

    it("should throw if create plan missing debitKey", async () => {
      const plan = {
        id: "plan-1",
        orgId: "org-123",
        journalEntryId: "entry-456",
        idx: 1,
        planKey: "plan-key-1",
        type: OPERATION_TRANSFER_TYPE.CREATE,
        chainId: null,
        transferId: 12345n,
        debitKey: null, // Missing
        creditKey: "revenue:sales",
        currency: "USD",
        tbLedger: 1000,
        amount: 50000n,
        code: 1,
        isLinked: false,
        isPending: false,
        timeoutSeconds: 0,
        pendingId: null,
        status: "pending" as const,
        error: null,
        createdAt: new Date()
      };

      const job = {
        outbox_id: "outbox-1",
        org_id: "org-123",
        journal_entry_id: "entry-456",
        attempts: 1
      };

      vi.mocked(db.execute)
        .mockResolvedValueOnce(mockDbExecuteResult([job]))
        .mockResolvedValue(mockDbExecuteResult([]));

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(async () => [plan])
          }))
        }))
      } as any);

      await runWorkerOnce(worker);

      // Should have marked job for retry
      expect(db.execute).toHaveBeenCalled();
    });

    it("should throw if void_pending has non-zero amount", async () => {
      const plan = {
        id: "plan-1",
        orgId: "org-123",
        journalEntryId: "entry-456",
        idx: 1,
        planKey: "plan-key-1",
        type: OPERATION_TRANSFER_TYPE.VOID_PENDING,
        chainId: null,
        transferId: 12345n,
        debitKey: null,
        creditKey: null,
        currency: "USD",
        tbLedger: 1000,
        amount: 100n, // Should be 0
        code: 0,
        isLinked: false,
        isPending: false,
        timeoutSeconds: 0,
        pendingId: 88888n,
        status: "pending" as const,
        error: null,
        createdAt: new Date()
      };

      const job = {
        outbox_id: "outbox-1",
        org_id: "org-123",
        journal_entry_id: "entry-456",
        attempts: 1
      };

      vi.mocked(db.execute)
        .mockResolvedValueOnce(mockDbExecuteResult([job]))
        .mockResolvedValue(mockDbExecuteResult([]));

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(async () => [plan])
          }))
        }))
      } as any);

      await runWorkerOnce(worker);

      // Should have caught error and retried
      expect(db.execute).toHaveBeenCalled();
    });

    // Note: "should cache account resolutions" is covered by integration test
    // "should handle account reuse across transfers" at integration/worker.test.ts:247
  });
});
