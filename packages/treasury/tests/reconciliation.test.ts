import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTreasuryReconciliationWorker } from "../src/reconciliation";
import { createStubDb, mockDbExecuteResult, type StubDatabase, TREASURY_ORG_ID } from "./helpers";

describe("createTreasuryReconciliationWorker", () => {
    let db: StubDatabase;
    let worker: ReturnType<typeof createTreasuryReconciliationWorker>;

    function selectReturning(rows: any[]) {
        return {
            from: vi.fn(() => ({
                where: vi.fn(() => ({
                    limit: vi.fn(async () => rows),
                })),
            })),
        };
    }

    beforeEach(() => {
        db = createStubDb();
        worker = createTreasuryReconciliationWorker({ db, treasuryOrgId: TREASURY_ORG_ID });
    });

    it("detects issues and upserts them into reconciliation exceptions", async () => {
        vi.mocked(db.execute)
            .mockResolvedValueOnce(mockDbExecuteResult([
                {
                    order_id: "order-stuck",
                    order_status: "funding_settled_pending_posting",
                    updated_at: new Date("2025-01-01T00:00:00.000Z"),
                    journal_entry_id: "journal-stuck",
                },
            ]))
            .mockResolvedValueOnce(mockDbExecuteResult([
                {
                    order_id: "order-lag",
                    order_status: "fx_executed_pending_posting",
                    journal_entry_id: "journal-lag",
                    journal_status: "posted",
                    updated_at: new Date("2025-01-01T00:01:00.000Z"),
                },
            ]))
            .mockResolvedValueOnce(mockDbExecuteResult([
                {
                    order_id: "order-missing",
                    order_status: "funding_settled",
                    ledger_entry_id: "journal-missing",
                },
            ]))
            .mockResolvedValueOnce(mockDbExecuteResult([
                {
                    order_id: "order-plan-mismatch",
                    journal_entry_id: "journal-plan-mismatch",
                },
            ]))
            .mockResolvedValueOnce(mockDbExecuteResult([
                {
                    settlement_id: "settlement-mismatch",
                    order_id: "order-rail-mismatch",
                    kind: "payout",
                    order_status: "payout_initiated",
                },
            ]));

        const onConflictDoUpdate = vi.fn(async () => undefined);
        const values = vi.fn(() => ({ onConflictDoUpdate }));
        vi.mocked(db.insert).mockReturnValue({ values } as any);
        vi.mocked(db.select).mockReturnValue(selectReturning([]) as any);

        const result = await worker.processOnce({ slaMinutes: 30, finalizationLagMinutes: 10 });

        expect(result).toEqual({
            detected: 5,
            resolved: 0,
            openAfterRun: 5,
        });
        expect(db.insert).toHaveBeenCalledTimes(5);
        expect(values).toHaveBeenCalledTimes(5);
        expect(onConflictDoUpdate).toHaveBeenCalledTimes(5);
        expect(db.update).not.toHaveBeenCalled();
    });

    it("resolves stale open issues that are no longer detected", async () => {
        vi.mocked(db.execute)
            .mockResolvedValueOnce(mockDbExecuteResult([]))
            .mockResolvedValueOnce(mockDbExecuteResult([]))
            .mockResolvedValueOnce(mockDbExecuteResult([]))
            .mockResolvedValueOnce(mockDbExecuteResult([]))
            .mockResolvedValueOnce(mockDbExecuteResult([]));

        const openIssues = [
            {
                id: "550e8400-e29b-41d4-a716-446655440021",
                entityType: "payment_order",
                entityId: "order-1",
                issueCode: "ORDER_STUCK_PENDING_POSTING",
            },
            {
                id: "550e8400-e29b-41d4-a716-446655440022",
                entityType: "journal_entry",
                entityId: "journal-2",
                issueCode: "POSTED_JOURNAL_PLAN_MISMATCH",
            },
        ];
        vi.mocked(db.select).mockReturnValue(selectReturning(openIssues) as any);

        const where = vi.fn(async () => []);
        const set = vi.fn(() => ({ where }));
        vi.mocked(db.update).mockReturnValue({ set } as any);

        const result = await worker.processOnce();

        expect(result).toEqual({
            detected: 0,
            resolved: 2,
            openAfterRun: 0,
        });
        expect(db.insert).not.toHaveBeenCalled();
        expect(db.update).toHaveBeenCalledTimes(2);
        expect(where).toHaveBeenCalledTimes(2);
    });
});
