import { describe, it, expect } from "vitest";

import { createLedgerEngine } from "../../src/engine";
import { createLedgerWorker } from "../../src/worker";
import { OPERATION_TRANSFER_TYPE } from "../../src/types";
import {
  db,
  tb,
  randomOrgId,
  randomIdempotencyKey,
  getOperation,
  getTbTransferPlans,
  getTbAccount,
  getTbTransfer,
} from "./helpers";

describe("Worker Integration Tests", () => {
  const engine = createLedgerEngine({ db });
  const worker = createLedgerWorker({ db, tb });

  it("posts create operation to TigerBeetle", async () => {
    const { entryId } = await engine.createEntry({
      orgId: randomOrgId(),
      source: { type: "payment", id: "pay-001" },
      idempotencyKey: randomIdempotencyKey(),
      postingDate: new Date(),
      transfers: [
        {
          type: OPERATION_TRANSFER_TYPE.CREATE,
          planKey: "transfer-1",
          debitKey: "customer:alice",
          creditKey: "revenue:sales",
          currency: "USD",
          amount: 100000n,
        },
      ],
    });

    const processed = await worker.processOnce();
    expect(processed).toBe(1);

    const operation = await getOperation(entryId);
    expect(operation!.status).toBe("posted");
    expect(operation!.postedAt).toBeDefined();

    const plans = await getTbTransferPlans(entryId);
    expect(plans).toHaveLength(1);
    expect(plans[0]!.status).toBe("posted");

    const transfer = await getTbTransfer(plans[0]!.transferId);
    expect(transfer).toBeDefined();
    expect(transfer!.amount).toBe(100000n);

    const debitAccount = await getTbAccount(plans[0]!.debitTbAccountId!);
    const creditAccount = await getTbAccount(plans[0]!.creditTbAccountId!);
    expect(debitAccount).toBeDefined();
    expect(creditAccount).toBeDefined();
  });

  it("posts pending create with timeout", async () => {
    const { entryId } = await engine.createEntry({
      orgId: randomOrgId(),
      source: { type: "reservation", id: "res-001" },
      idempotencyKey: randomIdempotencyKey(),
      postingDate: new Date(),
      transfers: [
        {
          type: OPERATION_TRANSFER_TYPE.CREATE,
          planKey: "pending-1",
          debitKey: "customer:bob",
          creditKey: "revenue:pending",
          currency: "USD",
          amount: 150000n,
          pending: { timeoutSeconds: 3600 },
        },
      ],
    });

    await worker.processOnce();

    const plans = await getTbTransferPlans(entryId);
    const transfer = await getTbTransfer(plans[0]!.transferId);
    expect(transfer).toBeDefined();
    expect(transfer!.timeout).toBeGreaterThan(0);

    const debitAccount = await getTbAccount(plans[0]!.debitTbAccountId!);
    expect(debitAccount).toBeDefined();
    expect(debitAccount!.debits_pending).toBe(150000n);
  });

  it("processes multiple operations in one batch", async () => {
    const orgId = randomOrgId();
    for (let i = 0; i < 3; i++) {
      await engine.createEntry({
        orgId,
        source: { type: "payment", id: `pay-batch-${i}` },
        idempotencyKey: randomIdempotencyKey(),
        postingDate: new Date(),
        transfers: [
          {
            type: OPERATION_TRANSFER_TYPE.CREATE,
            planKey: `transfer-${i}`,
            debitKey: `customer:${i}`,
            creditKey: "revenue:sales",
            currency: "USD",
            amount: 10000n,
          },
        ],
      });
    }

    const processed = await worker.processOnce({ batchSize: 10 });
    expect(processed).toBe(3);
  });
});
