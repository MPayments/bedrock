import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTransfersWorker } from "../src/worker";
import { createStubDb, type StubDatabase } from "./helpers";

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
                    org_id: "o1",
                    status: "approved_pending_posting",
                    ledger_entry_id: "e1",
                    journal_status: "pending",
                },
                {
                    transfer_id: "t2",
                    org_id: "o1",
                    status: "approved_pending_posting",
                    ledger_entry_id: "e2",
                    journal_status: "pending",
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
                    org_id: "o1",
                    status: "approved_pending_posting",
                    ledger_entry_id: "e1",
                    journal_status: "posted",
                },
                {
                    transfer_id: "t2",
                    org_id: "o1",
                    status: "approved_pending_posting",
                    ledger_entry_id: "e2",
                    journal_status: "failed",
                },
                {
                    transfer_id: "t3",
                    org_id: "o1",
                    status: "approved_pending_posting",
                    ledger_entry_id: "e3",
                    journal_status: "pending",
                },
            ],
        } as any);

        const processed = await worker.processOnce();

        expect(processed).toBe(2);
        expect(db.update).toHaveBeenCalledTimes(2);
    });
});
