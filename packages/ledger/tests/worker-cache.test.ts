import { describe, it, expect, vi, beforeEach } from "vitest";
import { PlanType } from "../src/types";
import { TransferFlags } from "../src/tb";
import { createStubDb, createMockTbClient, mockDbExecuteResult, type StubDatabase } from "./helpers";
import { resolveTbAccountId } from "../src/resolve";

vi.mock("../src/resolve", () => ({
  resolveTbAccountId: vi.fn(),
}));

describe("createLedgerWorker cache behavior", () => {
  let db: StubDatabase;
  let tb: ReturnType<typeof createMockTbClient>;
  let worker: ReturnType<(typeof import("../src/worker"))["createLedgerWorker"]>;

  beforeEach(async () => {
    db = createStubDb();
    tb = createMockTbClient();
    const { createLedgerWorker } = await import("../src/worker");
    worker = createLedgerWorker({ db, tb });
    vi.mocked(resolveTbAccountId).mockReset();
  });

  it("reuses resolved account ids for repeated keys and sets linked/pending flags", async () => {
    const job = {
      outbox_id: "outbox-1",
      org_id: "org-123",
      journal_entry_id: "entry-456",
      attempts: 1,
    };

    const basePlan = {
      id: "plan-1",
      orgId: "org-123",
      journalEntryId: "entry-456",
      idx: 1,
      planKey: "plan-key-1",
      type: PlanType.CREATE,
      chainId: null,
      debitKey: "customer:1",
      creditKey: "revenue:sales",
      currency: "USD",
      tbLedger: 1000,
      amount: 100n,
      code: 0,
      isLinked: true,
      isPending: true,
      timeoutSeconds: 60,
      pendingId: null,
      transferId: 111n,
      status: "pending" as const,
      error: null,
      createdAt: new Date(),
    };

    const plans = [
      basePlan,
      {
        ...basePlan,
        id: "plan-2",
        idx: 2,
        transferId: 222n,
      },
    ];

    vi.mocked(db.execute)
      .mockResolvedValueOnce(mockDbExecuteResult([job]))
      .mockResolvedValue(mockDbExecuteResult([]));

    vi.mocked(db.select).mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(async () => plans),
        })),
      })),
    } as any);

    vi.mocked(resolveTbAccountId)
      .mockResolvedValueOnce(11n)
      .mockResolvedValueOnce(22n);

    await worker.processOnce();

    expect(resolveTbAccountId).toHaveBeenCalledTimes(2);

    const transferCall = vi.mocked(tb.createTransfers).mock.calls[0];
    expect(transferCall).toBeDefined();

    const transfers = transferCall![0];
    expect(transfers).toHaveLength(2);
    expect(transfers[0].flags).toBe(TransferFlags.linked | TransferFlags.pending);
    expect(transfers[0].timeout).toBe(60);
  });
});
