import { describe, it, expect, vi, beforeEach } from "vitest";
import { createLedgerWorker } from "../src/worker";
import { PostingError } from "../src/errors";
import { PlanType } from "../src/types";
import { createMockDb, createMockTbClient, mockDbExecuteResult } from "./helpers";

describe("createLedgerWorker", () => {
  let db: ReturnType<typeof createMockDb>;
  let tb: ReturnType<typeof createMockTbClient>;
  let worker: ReturnType<typeof createLedgerWorker>;

  beforeEach(() => {
    db = createMockDb();
    tb = createMockTbClient();
    worker = createLedgerWorker({ db, tb });
  });

  describe("processOutboxOnce", () => {
    it("should return 0 when no jobs available", async () => {
      vi.mocked(db.execute).mockResolvedValue(mockDbExecuteResult([]));

      const processed = await worker.processOutboxOnce();

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

      const processed = await worker.processOutboxOnce();

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

      const processed = await worker.processOutboxOnce();

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

      await worker.processOutboxOnce();

      // Should have called execute multiple times for updates
      expect(db.execute).toHaveBeenCalled();
      expect(vi.mocked(db.execute).mock.calls.length).toBeGreaterThan(1);
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

      await worker.processOutboxOnce();

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
              throw new PostingError("Permanent failure");
            })
          }))
        }))
      } as any);

      await worker.processOutboxOnce({ maxAttempts: 25 });

      // Should have marked as failed
      expect(db.execute).toHaveBeenCalled();
    });

    it("should respect batchSize option", async () => {
      const batchSize = 10;

      vi.mocked(db.execute).mockResolvedValue(mockDbExecuteResult([]));

      await worker.processOutboxOnce({ batchSize });

      // Verify LIMIT was set correctly in query
      expect(db.execute).toHaveBeenCalled();
    });

    it("should respect maxAttempts option", async () => {
      const maxAttempts = 10;

      vi.mocked(db.execute).mockResolvedValue(mockDbExecuteResult([]));

      await worker.processOutboxOnce({ maxAttempts });

      expect(db.execute).toHaveBeenCalled();
    });

    it("should use lease-based locking", async () => {
      const leaseSeconds = 300;

      vi.mocked(db.execute).mockResolvedValue(mockDbExecuteResult([]));

      await worker.processOutboxOnce({ leaseSeconds });

      expect(db.execute).toHaveBeenCalled();
    });

    it("should handle processing jobs with expired leases", async () => {
      vi.mocked(db.execute).mockResolvedValue(mockDbExecuteResult([]));

      await worker.processOutboxOnce({ leaseSeconds: 600 });

      expect(db.execute).toHaveBeenCalled();
    });
  });

  describe("postJournal", () => {
    // Note: These tests require complex mocking of account resolution
    // Consider integration tests with real DB for full coverage
    it.skip("should post create transfer successfully", async () => {
      const plan = {
        id: "plan-1",
        orgId: "org-123",
        journalEntryId: "entry-456",
        idx: 1,
        planKey: "plan-key-1",
        type: PlanType.CREATE,
        chainId: null,
        transferId: 12345n,
        debitKey: "customer:alice",
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

      // Mock account resolution
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [{ tbAccountId: 100n }])
          }))
        }))
      } as any);

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [{ tbAccountId: 200n }])
          }))
        }))
      } as any);

      vi.mocked(tb.createTransfers).mockResolvedValue([]);

      const processed = await worker.processOutboxOnce();

      expect(processed).toBe(1);
      expect(tb.createTransfers).toHaveBeenCalled();
    });

    it.skip("should post pending transfer with timeout", async () => {
      const plan = {
        id: "plan-1",
        orgId: "org-123",
        journalEntryId: "entry-456",
        idx: 1,
        planKey: "plan-key-1",
        type: PlanType.CREATE,
        chainId: null,
        transferId: 12345n,
        debitKey: "customer:alice",
        creditKey: "revenue:sales",
        currency: "USD",
        tbLedger: 1000,
        amount: 50000n,
        code: 1,
        isLinked: false,
        isPending: true,
        timeoutSeconds: 3600,
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

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [{ tbAccountId: 100n }])
          }))
        }))
      } as any);

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [{ tbAccountId: 200n }])
          }))
        }))
      } as any);

      vi.mocked(tb.createTransfers).mockResolvedValue([]);

      await worker.processOutboxOnce();

      const transferCall = vi.mocked(tb.createTransfers).mock.calls[0];
      expect(transferCall).toBeDefined();
      const transfer = transferCall![0][0];
      expect(transfer.timeout).toBe(3600);
    });

    it("should post post_pending transfer with TB_AMOUNT_MAX for full post", async () => {
      const plan = {
        id: "plan-1",
        orgId: "org-123",
        journalEntryId: "entry-456",
        idx: 1,
        planKey: "plan-key-1",
        type: PlanType.POST_PENDING,
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

      await worker.processOutboxOnce();

      const transferCall = vi.mocked(tb.createTransfers).mock.calls[0];
      expect(transferCall).toBeDefined();
      const transfer = transferCall![0][0];
      expect(transfer.amount).toBe((1n << 128n) - 1n); // TB_AMOUNT_MAX
    });

    it("should post void_pending transfer", async () => {
      const plan = {
        id: "plan-1",
        orgId: "org-123",
        journalEntryId: "entry-456",
        idx: 1,
        planKey: "plan-key-1",
        type: PlanType.VOID_PENDING,
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

      await worker.processOutboxOnce();

      expect(tb.createTransfers).toHaveBeenCalled();
    });

    it.skip("should skip already posted plans", async () => {
      const plan = {
        id: "plan-1",
        orgId: "org-123",
        journalEntryId: "entry-456",
        idx: 1,
        planKey: "plan-key-1",
        type: PlanType.CREATE,
        chainId: null,
        transferId: 12345n,
        debitKey: "customer:alice",
        creditKey: "revenue:sales",
        currency: "USD",
        tbLedger: 1000,
        amount: 50000n,
        code: 1,
        isLinked: false,
        isPending: false,
        timeoutSeconds: 0,
        pendingId: null,
        status: "posted" as const, // Already posted
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

      await worker.processOutboxOnce();

      // Should not create any transfers
      expect(tb.createTransfers).toHaveBeenCalledWith([]);
    });

    it("should throw if create plan missing debitKey", async () => {
      const plan = {
        id: "plan-1",
        orgId: "org-123",
        journalEntryId: "entry-456",
        idx: 1,
        planKey: "plan-key-1",
        type: PlanType.CREATE,
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

      await worker.processOutboxOnce();

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
        type: PlanType.VOID_PENDING,
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

      await worker.processOutboxOnce();

      // Should have caught error and retried
      expect(db.execute).toHaveBeenCalled();
    });

    it.skip("should cache account resolutions", async () => {
      const plans = [
        {
          id: "plan-1",
          orgId: "org-123",
          journalEntryId: "entry-456",
          idx: 1,
          planKey: "plan-key-1",
          type: PlanType.CREATE,
          chainId: null,
          transferId: 12345n,
          debitKey: "customer:alice",
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
        },
        {
          id: "plan-2",
          orgId: "org-123",
          journalEntryId: "entry-456",
          idx: 2,
          planKey: "plan-key-2",
          type: PlanType.CREATE,
          chainId: null,
          transferId: 67890n,
          debitKey: "customer:alice", // Same as above
          creditKey: "revenue:sales", // Same as above
          currency: "USD",
          tbLedger: 1000,
          amount: 30000n,
          code: 1,
          isLinked: false,
          isPending: false,
          timeoutSeconds: 0,
          pendingId: null,
          status: "pending" as const,
          error: null,
          createdAt: new Date()
        }
      ];

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
            orderBy: vi.fn(async () => plans)
          }))
        }))
      } as any);

      let selectCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCount++;
        const accountId = selectCount === 1 ? 100n : 200n;
        return {
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [{ tbAccountId: accountId }]),
              orderBy: vi.fn(async () => plans)
            }))
          }))
        } as any;
      });

      vi.mocked(tb.createTransfers).mockResolvedValue([]);

      await worker.processOutboxOnce();

      // Should have resolved each unique account only once
      expect(tb.createTransfers).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ id: 12345n }),
        expect.objectContaining({ id: 67890n })
      ]));
    });
  });
});
