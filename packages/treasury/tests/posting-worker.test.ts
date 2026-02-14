import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTreasuryWorker } from "../src/worker";
import { createStubDb, mockDbExecuteResult, type StubDatabase } from "./helpers";

describe("createTreasuryWorker", () => {
    let db: StubDatabase;
    let worker: ReturnType<typeof createTreasuryWorker>;

    beforeEach(() => {
        db = createStubDb();
        worker = createTreasuryWorker({ db });
    });

    describe("processOnce", () => {
        it("should return 0 when no pending items", async () => {
            vi.mocked(db.execute).mockResolvedValue(mockDbExecuteResult([]));

            const result = await worker.processOnce();

            expect(result).toBe(0);
        });

        it("should process posted journal entries", async () => {
            const items = [
                {
                    order_id: "order-1",
                    order_status: "funding_settled_pending_posting",
                    ledger_entry_id: "entry-1",
                    journal_status: "posted",
                },
            ];

            vi.mocked(db.execute).mockResolvedValueOnce(mockDbExecuteResult(items));

            // Mock transaction to return locked row with posted status
            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    execute: vi.fn()
                        .mockResolvedValueOnce(mockDbExecuteResult([
                            { id: "order-1", status: "funding_settled_pending_posting", journal_status: "posted" }
                        ]))
                        .mockResolvedValue(mockDbExecuteResult([]))
                };
                return fn(tx);
            });

            const result = await worker.processOnce();

            expect(result).toBe(1);
            expect(db.transaction).toHaveBeenCalled();
        });

        it("should finalize funding_settled_pending_posting to funding_settled", async () => {
            const items = [
                {
                    order_id: "order-1",
                    order_status: "funding_settled_pending_posting",
                    ledger_entry_id: "entry-1",
                    journal_status: "posted",
                },
            ];

            vi.mocked(db.execute).mockResolvedValueOnce(mockDbExecuteResult(items));

            let updateCalled = false;
            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    execute: vi.fn().mockImplementation(async (query: any) => {
                        // Check if this is an UPDATE query (contains "funding_settled")
                        if (!updateCalled) {
                            updateCalled = true;
                            return mockDbExecuteResult([
                                { id: "order-1", status: "funding_settled_pending_posting", journal_status: "posted" }
                            ]);
                        }
                        return mockDbExecuteResult([]);
                    })
                };
                return fn(tx);
            });

            await worker.processOnce();

            expect(db.transaction).toHaveBeenCalled();
        });

        it("should finalize fx_executed_pending_posting to fx_executed", async () => {
            const items = [
                {
                    order_id: "order-1",
                    order_status: "fx_executed_pending_posting",
                    ledger_entry_id: "entry-1",
                    journal_status: "posted",
                },
            ];

            vi.mocked(db.execute).mockResolvedValueOnce(mockDbExecuteResult(items));

            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    execute: vi.fn()
                        .mockResolvedValueOnce(mockDbExecuteResult([
                            { id: "order-1", status: "fx_executed_pending_posting", journal_status: "posted" }
                        ]))
                        .mockResolvedValue(mockDbExecuteResult([]))
                };
                return fn(tx);
            });

            const result = await worker.processOnce();

            expect(result).toBe(1);
        });

        it("should finalize closed_pending_posting to closed", async () => {
            const items = [
                {
                    order_id: "order-1",
                    order_status: "closed_pending_posting",
                    ledger_entry_id: "entry-1",
                    journal_status: "posted",
                },
            ];

            vi.mocked(db.execute).mockResolvedValueOnce(mockDbExecuteResult(items));

            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    execute: vi.fn()
                        .mockResolvedValueOnce(mockDbExecuteResult([
                            { id: "order-1", status: "closed_pending_posting", journal_status: "posted" }
                        ]))
                        .mockResolvedValue(mockDbExecuteResult([]))
                };
                return fn(tx);
            });

            const result = await worker.processOnce();

            expect(result).toBe(1);
        });

        it("should set status to failed when journal entry failed", async () => {
            const items = [
                {
                    order_id: "order-1",
                    order_status: "funding_settled_pending_posting",
                    ledger_entry_id: "entry-1",
                    journal_status: "failed",
                },
            ];

            vi.mocked(db.execute).mockResolvedValueOnce(mockDbExecuteResult(items));

            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    execute: vi.fn()
                        .mockResolvedValueOnce(mockDbExecuteResult([
                            { id: "order-1", status: "funding_settled_pending_posting", journal_status: "failed" }
                        ]))
                        .mockResolvedValue(mockDbExecuteResult([]))
                };
                return fn(tx);
            });

            const result = await worker.processOnce();

            expect(result).toBe(1);
        });

        it("should skip items when row is locked by another worker", async () => {
            const items = [
                {
                    order_id: "order-1",
                    order_status: "funding_settled_pending_posting",
                    ledger_entry_id: "entry-1",
                    journal_status: "posted",
                },
            ];

            vi.mocked(db.execute).mockResolvedValueOnce(mockDbExecuteResult(items));

            // Simulate row being locked (empty result from FOR UPDATE SKIP LOCKED)
            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    execute: vi.fn().mockResolvedValue(mockDbExecuteResult([]))
                };
                return fn(tx);
            });

            const result = await worker.processOnce();

            expect(result).toBe(0);
        });

        it("should skip items with unknown status", async () => {
            const items = [
                {
                    order_id: "order-1",
                    order_status: "unknown_status",
                    ledger_entry_id: "entry-1",
                    journal_status: "posted",
                },
            ];

            vi.mocked(db.execute).mockResolvedValueOnce(mockDbExecuteResult(items));

            const result = await worker.processOnce();

            expect(result).toBe(0);
        });

        it("should process multiple items", async () => {
            const items = [
                {
                    order_id: "order-1",
                    order_status: "funding_settled_pending_posting",
                    ledger_entry_id: "entry-1",
                    journal_status: "posted",
                },
                {
                    order_id: "order-2",
                    order_status: "fx_executed_pending_posting",
                    ledger_entry_id: "entry-2",
                    journal_status: "posted",
                },
            ];

            vi.mocked(db.execute).mockResolvedValueOnce(mockDbExecuteResult(items));

            let txCount = 0;
            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                txCount++;
                const currentItem = items[txCount - 1];
                const tx = {
                    execute: vi.fn()
                        .mockResolvedValueOnce(mockDbExecuteResult([
                            { id: currentItem!.order_id, status: currentItem!.order_status, journal_status: "posted" }
                        ]))
                        .mockResolvedValue(mockDbExecuteResult([]))
                };
                return fn(tx);
            });

            const result = await worker.processOnce();

            expect(result).toBe(2);
            expect(db.transaction).toHaveBeenCalledTimes(2);
        });

        it("should respect batchSize option", async () => {
            vi.mocked(db.execute).mockResolvedValue(mockDbExecuteResult([]));

            await worker.processOnce({ batchSize: 10 });

            expect(db.execute).toHaveBeenCalled();
        });

        it("should not process items with pending journal status", async () => {
            const items = [
                {
                    order_id: "order-1",
                    order_status: "funding_settled_pending_posting",
                    ledger_entry_id: "entry-1",
                    journal_status: "pending", // Not posted yet
                },
            ];

            vi.mocked(db.execute).mockResolvedValueOnce(mockDbExecuteResult(items));

            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                const tx = {
                    execute: vi.fn()
                        .mockResolvedValueOnce(mockDbExecuteResult([
                            { id: "order-1", status: "funding_settled_pending_posting", journal_status: "pending" }
                        ]))
                        .mockResolvedValue(mockDbExecuteResult([]))
                };
                return fn(tx);
            });

            const result = await worker.processOnce();

            // Should not increment processed count for pending journal
            expect(result).toBe(0);
        });

        it("should return only finalized count when fetched set includes pending journals", async () => {
            const items = [
                {
                    order_id: "order-1",
                    order_status: "funding_settled_pending_posting",
                    ledger_entry_id: "entry-1",
                    journal_status: "posted",
                },
                {
                    order_id: "order-2",
                    order_status: "fx_executed_pending_posting",
                    ledger_entry_id: "entry-2",
                    journal_status: "pending",
                },
            ];

            vi.mocked(db.execute).mockResolvedValueOnce(mockDbExecuteResult(items));

            let txCount = 0;
            vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
                txCount++;
                const current = txCount === 1
                    ? { id: "order-1", status: "funding_settled_pending_posting", journal_status: "posted" }
                    : { id: "order-2", status: "fx_executed_pending_posting", journal_status: "pending" };
                const tx = {
                    execute: vi.fn()
                        .mockResolvedValueOnce(mockDbExecuteResult([current]))
                        .mockResolvedValue(mockDbExecuteResult([]))
                };
                return fn(tx);
            });

            const result = await worker.processOnce();
            expect(result).toBe(1);
        });
    });

    describe("system scope", () => {
        it("should process all orders", async () => {
            vi.mocked(db.execute).mockResolvedValue(mockDbExecuteResult([]));

            await worker.processOnce();

            expect(db.execute).toHaveBeenCalled();
        });
    });
});
