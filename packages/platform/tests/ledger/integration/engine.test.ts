import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import { ACCOUNT_NO, POSTING_CODE } from "@bedrock/platform/accounting";

import {
  db,
  getOperation,
  getPostings,
  getTbTransferPlans,
  randomIdempotencyKey,
  randomOrgId,
} from "./helpers";
import { createLedgerEngine } from "../../../src/ledger/engine";
import { IdempotencyConflictError } from "../../../src/ledger/errors";
import { OPERATION_TRANSFER_TYPE } from "../../../src/ledger/types";

describe("Engine Integration Tests", () => {
  const engine = createLedgerEngine({ db });

  it("creates pending operation with postings and TB plan", async () => {
    const orgId = randomOrgId();
    const idempotencyKey = randomIdempotencyKey();

    const { operationId } = await engine.commitStandalone({
      source: { type: "payment", id: "pay-123" },
      operationCode: "TEST.ENGINE.CREATE",
      idempotencyKey,
      postingDate: new Date(),
      lines: [
        {
          type: OPERATION_TRANSFER_TYPE.CREATE,
          planRef: "transfer-1",
          bookId: orgId,
          postingCode: POSTING_CODE.TRANSFER_INTRA_IMMEDIATE,
          debit: {
            accountNo: ACCOUNT_NO.BANK,
            currency: "USD",
            dimensions: { operationalAccountId: randomUUID() },
          },
          credit: {
            accountNo: ACCOUNT_NO.BANK,
            currency: "USD",
            dimensions: { operationalAccountId: randomUUID() },
          },
          amountMinor: 100000n,
        },
      ],
    });

    const operation = await getOperation(operationId);
    expect(operation).toBeDefined();
    expect(operation!.status).toBe("pending");
    expect(operation!.idempotencyKey).toBe(idempotencyKey);

    const postings = await getPostings(operationId);
    expect(postings).toHaveLength(1);
    expect(postings[0]!.bookId).toBe(orgId);
    expect(postings[0]!.amountMinor).toBe(100000n);

    const plans = await getTbTransferPlans(operationId);
    expect(plans).toHaveLength(1);
    expect(plans[0]!.status).toBe("pending");
    expect(plans[0]!.amount).toBe(100000n);
  });

  it("returns same operation on idempotent replay", async () => {
    const orgId = randomOrgId();
    const idempotencyKey = randomIdempotencyKey();
    const input = {
      source: { type: "payment", id: "pay-789" },
      operationCode: "TEST.ENGINE.REPLAY",
      idempotencyKey,
      postingDate: new Date(),
      lines: [
        {
          type: OPERATION_TRANSFER_TYPE.CREATE as const,
          planRef: "transfer-1",
          bookId: orgId,
          postingCode: POSTING_CODE.TRANSFER_INTRA_IMMEDIATE,
          debit: {
            accountNo: ACCOUNT_NO.BANK,
            currency: "USD",
            dimensions: { operationalAccountId: randomUUID() },
          },
          credit: {
            accountNo: ACCOUNT_NO.BANK,
            currency: "USD",
            dimensions: { operationalAccountId: randomUUID() },
          },
          amountMinor: 200000n,
        },
      ],
    };

    const first = await engine.commitStandalone(input);
    const second = await engine.commitStandalone(input);

    expect(second.operationId).toBe(first.operationId);

    const postings = await getPostings(first.operationId);
    expect(postings).toHaveLength(1);
  });

  it("fails idempotency when payload differs", async () => {
    const orgId = randomOrgId();
    const idempotencyKey = randomIdempotencyKey();

    await engine.commitStandalone({
      source: { type: "payment", id: "pay-999" },
      operationCode: "TEST.ENGINE.CONFLICT",
      idempotencyKey,
      postingDate: new Date(),
      lines: [
        {
          type: OPERATION_TRANSFER_TYPE.CREATE,
          planRef: "transfer-1",
          bookId: orgId,
          postingCode: POSTING_CODE.TRANSFER_INTRA_IMMEDIATE,
          debit: {
            accountNo: ACCOUNT_NO.BANK,
            currency: "USD",
            dimensions: { operationalAccountId: randomUUID() },
          },
          credit: {
            accountNo: ACCOUNT_NO.BANK,
            currency: "USD",
            dimensions: { operationalAccountId: randomUUID() },
          },
          amountMinor: 100000n,
        },
      ],
    });

    await expect(
      engine.commitStandalone({
        source: { type: "payment", id: "pay-999" },
        operationCode: "TEST.ENGINE.CONFLICT",
        idempotencyKey,
        postingDate: new Date(),
        lines: [
          {
            type: OPERATION_TRANSFER_TYPE.CREATE,
            planRef: "transfer-1",
            bookId: orgId,
            postingCode: POSTING_CODE.TRANSFER_INTRA_IMMEDIATE,
            debit: {
              accountNo: ACCOUNT_NO.BANK,
              currency: "USD",
              dimensions: { operationalAccountId: randomUUID() },
            },
            credit: {
              accountNo: ACCOUNT_NO.BANK,
              currency: "USD",
              dimensions: { operationalAccountId: randomUUID() },
            },
            amountMinor: 200000n,
          },
        ],
      }),
    ).rejects.toThrow(IdempotencyConflictError);
  });

  it("creates non-posting plans for post/void pending", async () => {
    const { operationId } = await engine.commitStandalone({
      source: { type: "pending", id: "pending-ops" },
      operationCode: "TEST.ENGINE.PENDING",
      idempotencyKey: randomIdempotencyKey(),
      postingDate: new Date(),
      lines: [
        {
          type: OPERATION_TRANSFER_TYPE.POST_PENDING,
          planRef: "post-1",
          currency: "USD",
          pendingId: 123n,
          amount: 0n,
        },
        {
          type: OPERATION_TRANSFER_TYPE.VOID_PENDING,
          planRef: "void-1",
          currency: "USD",
          pendingId: 124n,
        },
      ],
    });

    const postings = await getPostings(operationId);
    expect(postings).toHaveLength(0);

    const plans = await getTbTransferPlans(operationId);
    expect(plans).toHaveLength(2);
    expect(plans[0]!.type).toBe("post_pending");
    expect(plans[1]!.type).toBe("void_pending");
  });
});
