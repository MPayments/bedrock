import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import { ACCOUNT_NO, POSTING_CODE } from "@bedrock/application/accounting";

import {
  db,
  getOperation,
  getTbAccount,
  getTbTransfer,
  getTbTransferPlans,
  randomIdempotencyKey,
  randomOrgId,
  tb,
} from "./helpers";
import { createLedgerEngine } from "../../../src/ledger/engine";
import { OPERATION_TRANSFER_TYPE } from "../../../src/ledger/types";
import { createLedgerWorkerDefinition } from "../../../src/ledger/worker";

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

describe("Worker Integration Tests", () => {
  const engine = createLedgerEngine({ db });
  const worker = createLedgerWorkerDefinition({ db, tb });

  it("posts create operation to TigerBeetle", async () => {
    const { operationId } = await engine.commitStandalone({
      source: { type: "payment", id: "pay-001" },
      operationCode: "TEST.WORKER.CREATE",
      idempotencyKey: randomIdempotencyKey(),
      postingDate: new Date(),
      lines: [
        {
          type: OPERATION_TRANSFER_TYPE.CREATE,
          planRef: "transfer-1",
          bookId: randomOrgId(),
          postingCode: POSTING_CODE.FUNDING_SETTLED,
          debit: {
            accountNo: ACCOUNT_NO.BANK,
            currency: "USD",
            dimensions: { organizationRequisiteId: randomUUID() },
          },
          credit: {
            accountNo: ACCOUNT_NO.CUSTOMER_WALLET,
            currency: "USD",
            dimensions: { customerId: randomUUID() },
          },
          amountMinor: 100000n,
        },
      ],
    });

    const processed = await runWorkerOnce(worker);
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
    const { operationId } = await engine.commitStandalone({
      source: { type: "reservation", id: "res-001" },
      operationCode: "TEST.WORKER.PENDING",
      idempotencyKey: randomIdempotencyKey(),
      postingDate: new Date(),
      lines: [
        {
          type: OPERATION_TRANSFER_TYPE.CREATE,
          planRef: "pending-1",
          bookId: randomOrgId(),
          postingCode: POSTING_CODE.FUNDING_SETTLED,
          debit: {
            accountNo: ACCOUNT_NO.BANK,
            currency: "USD",
            dimensions: { organizationRequisiteId: randomUUID() },
          },
          credit: {
            accountNo: ACCOUNT_NO.CUSTOMER_WALLET,
            currency: "USD",
            dimensions: { customerId: randomUUID() },
          },
          amountMinor: 150000n,
          pending: { timeoutSeconds: 3600 },
        },
      ],
    });

    await runWorkerOnce(worker);

    const plans = await getTbTransferPlans(operationId);
    const transfer = await getTbTransfer(plans[0]!.transferId);
    expect(transfer).toBeDefined();
    expect(transfer!.timeout).toBeGreaterThan(0n);

    const debitAccount = await getTbAccount(plans[0]!.debitTbAccountId!);
    expect(debitAccount).toBeDefined();
    expect(debitAccount!.debits_pending).toBe(150000n);
  });

  it("processes multiple operations in one batch", async () => {
    const orgId = randomOrgId();
    const operationIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const { operationId } = await engine.commitStandalone({
        source: { type: "payment", id: `pay-batch-${i}` },
        operationCode: "TEST.WORKER.BATCH",
        idempotencyKey: randomIdempotencyKey(),
        postingDate: new Date(),
        lines: [
          {
            type: OPERATION_TRANSFER_TYPE.CREATE,
            planRef: `transfer-${i}`,
            bookId: orgId,
            postingCode: POSTING_CODE.TRANSFER_INTRA_IMMEDIATE,
            debit: {
              accountNo: ACCOUNT_NO.BANK,
              currency: "USD",
              dimensions: { organizationRequisiteId: randomUUID() },
            },
            credit: {
              accountNo: ACCOUNT_NO.BANK,
              currency: "USD",
              dimensions: { organizationRequisiteId: randomUUID() },
            },
            amountMinor: 10000n,
          },
        ],
      });
      operationIds.push(operationId);
    }

    const batchWorker = createLedgerWorkerDefinition({ db, tb, batchSize: 10 });
    const processed = await runWorkerOnce(batchWorker);
    expect(processed).toBe(3);

    for (const operationId of operationIds) {
      const operation = await getOperation(operationId);
      expect(operation).toBeDefined();
      expect(operation!.status).toBe("posted");

      const plans = await getTbTransferPlans(operationId);
      expect(plans).toHaveLength(1);
      expect(plans[0]!.status).toBe("posted");

      const transfer = await getTbTransfer(plans[0]!.transferId);
      expect(transfer).toBeDefined();
      expect(transfer!.amount).toBe(10000n);
    }
  });
});
