import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  createStubDb,
  createMockTbClient,
  mockDbExecuteResult,
  type StubDatabase,
} from "./helpers";
import { TransferFlags } from "../../src/ledger/tb";
import { OPERATION_TRANSFER_TYPE } from "../../src/ledger/types";
import type { createLedgerWorker as createLedgerWorkerFactory } from "../../src/ledger/worker";

describe("createLedgerWorker account setup", () => {
  let db: StubDatabase;
  let tb: ReturnType<typeof createMockTbClient>;
  let worker: ReturnType<typeof createLedgerWorkerFactory>;

  beforeEach(async () => {
    db = createStubDb();
    tb = createMockTbClient();
    const { createLedgerWorker } = await import("../../src/ledger/worker");
    worker = createLedgerWorker({ db, tb });
  });

  it("creates unique TB accounts once and posts linked pending transfers", async () => {
    const job = {
      outbox_id: "outbox-1",
      operation_id: "op-456",
      attempts: 1,
    };

    const plans = [
      {
        operationId: "op-456",
        lineNo: 1,
        type: OPERATION_TRANSFER_TYPE.CREATE,
        transferId: 111n,
        debitTbAccountId: 11n,
        creditTbAccountId: 22n,
        tbLedger: 1000,
        amount: 100n,
        code: 1,
        isLinked: true,
        isPending: true,
        timeoutSeconds: 60,
        pendingId: null,
        status: "pending" as const,
      },
      {
        operationId: "op-456",
        lineNo: 2,
        type: OPERATION_TRANSFER_TYPE.CREATE,
        transferId: 222n,
        debitTbAccountId: 11n,
        creditTbAccountId: 22n,
        tbLedger: 1000,
        amount: 100n,
        code: 1,
        isLinked: false,
        isPending: false,
        timeoutSeconds: 0,
        pendingId: null,
        status: "pending" as const,
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

    await worker.processOnce();

    const accountCall = vi.mocked(tb.createAccounts).mock.calls[0];
    expect(accountCall).toBeDefined();
    expect(accountCall![0]).toHaveLength(2);

    const transferCall = vi.mocked(tb.createTransfers).mock.calls[0];
    expect(transferCall).toBeDefined();
    const transfers = transferCall![0];
    expect(transfers).toHaveLength(2);
    expect(transfers[0].flags).toBe(TransferFlags.linked | TransferFlags.pending);
    expect(transfers[0].timeout).toBe(60);
  });
});
