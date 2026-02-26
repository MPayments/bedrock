import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import { ACCOUNT_NO, POSTING_CODE } from "@bedrock/accounting";

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
import { createLedgerEngine } from "../../src/engine";
import { OPERATION_TRANSFER_TYPE } from "../../src/types";
import { createLedgerWorker } from "../../src/worker";

describe("Worker Integration Tests", () => {
  const engine = createLedgerEngine({ db });
  const worker = createLedgerWorker({ db, tb });

  it("posts create operation to TigerBeetle", async () => {
    const { operationId } = await engine.createOperation({
      source: { type: "payment", id: "pay-001" },
      operationCode: "TEST.WORKER.CREATE",
      idempotencyKey: randomIdempotencyKey(),
      postingDate: new Date(),
      transfers: [
        {
          type: OPERATION_TRANSFER_TYPE.CREATE,
          planRef: "transfer-1",
          bookOrgId: randomOrgId(),
          debitAccountNo: ACCOUNT_NO.BANK,
          creditAccountNo: ACCOUNT_NO.CUSTOMER_WALLET,
          postingCode: POSTING_CODE.FUNDING_SETTLED,
          currency: "USD",
          amount: 100000n,
          analytics: {
            customerId: randomUUID(),
            operationalAccountId: randomUUID(),
          },
        },
      ],
    });

    const processed = await worker.processOnce();
    expect(processed).toBe(1);

    const operation = await getOperation(operationId);
    expect(operation!.status).toBe("posted");
    expect(operation!.postedAt).toBeDefined();

    const plans = await getTbTransferPlans(operationId);
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
    const { operationId } = await engine.createOperation({
      source: { type: "reservation", id: "res-001" },
      operationCode: "TEST.WORKER.PENDING",
      idempotencyKey: randomIdempotencyKey(),
      postingDate: new Date(),
      transfers: [
        {
          type: OPERATION_TRANSFER_TYPE.CREATE,
          planRef: "pending-1",
          bookOrgId: randomOrgId(),
          debitAccountNo: ACCOUNT_NO.BANK,
          creditAccountNo: ACCOUNT_NO.CUSTOMER_WALLET,
          postingCode: POSTING_CODE.FUNDING_SETTLED,
          currency: "USD",
          amount: 150000n,
          pending: { timeoutSeconds: 3600 },
          analytics: {
            customerId: randomUUID(),
            operationalAccountId: randomUUID(),
          },
        },
      ],
    });

    await worker.processOnce();

    const plans = await getTbTransferPlans(operationId);
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
      await engine.createOperation({
        source: { type: "payment", id: `pay-batch-${i}` },
        operationCode: "TEST.WORKER.BATCH",
        idempotencyKey: randomIdempotencyKey(),
        postingDate: new Date(),
        transfers: [
          {
            type: OPERATION_TRANSFER_TYPE.CREATE,
            planRef: `transfer-${i}`,
            bookOrgId: orgId,
            debitAccountNo: ACCOUNT_NO.BANK,
            creditAccountNo: ACCOUNT_NO.BANK,
            postingCode: POSTING_CODE.TRANSFER_INTRA_IMMEDIATE,
            currency: "USD",
            amount: 10000n,
            analytics: {
              operationalAccountId: randomUUID(),
            },
          },
        ],
      });
    }

    const processed = await worker.processOnce({ batchSize: 10 });
    expect(processed).toBe(3);
  });
});
