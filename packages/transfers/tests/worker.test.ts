import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTransfersWorker } from "../src/worker";
import { createStubDb, type StubDatabase } from "@bedrock/test-utils";

describe("createTransfersWorker", () => {
    let db: StubDatabase;
    let worker: ReturnType<typeof createTransfersWorker>;

    beforeEach(() => {
        db = createStubDb();
        worker = createTransfersWorker({ db });
    });

    it("returns processed count, not fetched count, when journals are still pending", async () => {
        vi.mocked(db.execute).mockResolvedValue({
            rows: [
                {
                    transfer_id: "t1",
                    status: "approved_pending_posting",
                    settlement_mode: "pending",
                    ledger_entry_id: "e1",
                    journal_status: "pending",
                    journal_error: null,
                },
                {
                    transfer_id: "t2",
                    status: "approved_pending_posting",
                    settlement_mode: "immediate",
                    ledger_entry_id: "e2",
                    journal_status: "pending",
                    journal_error: null,
                },
            ],
        } as any);

        const processed = await worker.processOnce();

        expect(processed).toBe(0);
        expect(db.update).not.toHaveBeenCalled();
    });

    it("returns only finalized items for mixed statuses", async () => {
        vi.mocked(db.execute).mockResolvedValue({
            rows: [
                {
                    transfer_id: "t1",
                    status: "approved_pending_posting",
                    settlement_mode: "immediate",
                    ledger_entry_id: "e1",
                    journal_status: "posted",
                    journal_error: null,
                },
                {
                    transfer_id: "t2",
                    status: "approved_pending_posting",
                    settlement_mode: "pending",
                    ledger_entry_id: "e2",
                    journal_status: "failed",
                    journal_error: "failed to post",
                },
                {
                    transfer_id: "t3",
                    status: "approved_pending_posting",
                    settlement_mode: "pending",
                    ledger_entry_id: "e3",
                    journal_status: "pending",
                    journal_error: null,
                },
            ],
        } as any);

        const processed = await worker.processOnce();

        expect(processed).toBe(2);
        expect(db.update).toHaveBeenCalledTimes(2);
    });

    it("logs and continues when processing throws", async () => {
        const logger = {
            debug: vi.fn(),
            info: vi.fn(),
            error: vi.fn(),
        } as any;
        worker = createTransfersWorker({ db, logger });

        vi.mocked(db.execute).mockResolvedValue({
            rows: [
                {
                    transfer_id: "t1",
                    status: "approved_pending_posting",
                    settlement_mode: "immediate",
                    ledger_entry_id: "e1",
                    journal_status: "posted",
                    journal_error: null,
                },
            ],
        } as any);

        vi.mocked(db.update).mockImplementation(() => {
            throw new Error("boom");
        });

        const processed = await worker.processOnce();

        expect(processed).toBe(0);
        expect(logger.error).toHaveBeenCalled();
    });

    it("maps settle/void posting states to final transfer statuses", async () => {
        const setSpy = vi.fn(() => ({
            where: vi.fn(async () => undefined),
        }));
        vi.mocked(db.update).mockImplementation(() => ({ set: setSpy }) as any);

        vi.mocked(db.execute).mockResolvedValue({
            rows: [
                {
                    transfer_id: "t-settle",
                    status: "settle_pending_posting",
                    settlement_mode: "pending",
                    ledger_entry_id: "e-settle",
                    journal_status: "posted",
                    journal_error: null,
                },
                {
                    transfer_id: "t-void",
                    status: "void_pending_posting",
                    settlement_mode: "pending",
                    ledger_entry_id: "e-void",
                    journal_status: "posted",
                    journal_error: null,
                },
            ],
        } as any);

        const processed = await worker.processOnce();

        expect(processed).toBe(2);
        expect(setSpy).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({ status: "posted" }),
        );
        expect(setSpy).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({ status: "voided" }),
        );
    });
});
