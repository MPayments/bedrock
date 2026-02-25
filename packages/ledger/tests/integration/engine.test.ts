import { describe, it, expect } from "vitest";

import { createLedgerEngine } from "../../src/engine";
import { IdempotencyConflictError } from "../../src/errors";
import { OPERATION_TRANSFER_TYPE } from "../../src/types";
import {
  db,
  randomOrgId,
  randomIdempotencyKey,
  getOperation,
  getPostings,
  getTbTransferPlans,
} from "./helpers";

describe("Engine Integration Tests", () => {
  const engine = createLedgerEngine({ db });

  it("creates pending operation with postings and TB plan", async () => {
    const orgId = randomOrgId();
    const idempotencyKey = randomIdempotencyKey();

    const { entryId } = await engine.createEntry({
      orgId,
      source: { type: "payment", id: "pay-123" },
      idempotencyKey,
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

    const operation = await getOperation(entryId);
    expect(operation).toBeDefined();
    expect(operation!.status).toBe("pending");
    expect(operation!.idempotencyKey).toBe(idempotencyKey);

    const postings = await getPostings(entryId);
    expect(postings).toHaveLength(1);
    expect(postings[0]!.bookOrgId).toBe(orgId);
    expect(postings[0]!.amountMinor).toBe(100000n);

    const plans = await getTbTransferPlans(entryId);
    expect(plans).toHaveLength(1);
    expect(plans[0]!.status).toBe("pending");
    expect(plans[0]!.amount).toBe(100000n);
  });

  it("returns same operation on idempotent replay", async () => {
    const orgId = randomOrgId();
    const idempotencyKey = randomIdempotencyKey();
    const input = {
      orgId,
      source: { type: "payment", id: "pay-789" },
      idempotencyKey,
      postingDate: new Date(),
      transfers: [
        {
          type: OPERATION_TRANSFER_TYPE.CREATE as const,
          planKey: "transfer-1",
          debitKey: "customer:bob",
          creditKey: "revenue:sales",
          currency: "USD",
          amount: 200000n,
        },
      ],
    };

    const first = await engine.createEntry(input);
    const second = await engine.createEntry(input);

    expect(second.entryId).toBe(first.entryId);

    const postings = await getPostings(first.entryId);
    expect(postings).toHaveLength(1);
  });

  it("fails idempotency when payload differs", async () => {
    const orgId = randomOrgId();
    const idempotencyKey = randomIdempotencyKey();

    await engine.createEntry({
      orgId,
      source: { type: "payment", id: "pay-999" },
      idempotencyKey,
      postingDate: new Date(),
      transfers: [
        {
          type: OPERATION_TRANSFER_TYPE.CREATE,
          planKey: "transfer-1",
          debitKey: "customer:charlie",
          creditKey: "revenue:sales",
          currency: "USD",
          amount: 100000n,
        },
      ],
    });

    await expect(
      engine.createEntry({
        orgId,
        source: { type: "payment", id: "pay-999" },
        idempotencyKey,
        postingDate: new Date(),
        transfers: [
          {
            type: OPERATION_TRANSFER_TYPE.CREATE,
            planKey: "transfer-1",
            debitKey: "customer:charlie",
            creditKey: "revenue:sales",
            currency: "USD",
            amount: 200000n,
          },
        ],
      }),
    ).rejects.toThrow(IdempotencyConflictError);
  });

  it("creates non-posting plans for post/void pending", async () => {
    const orgId = randomOrgId();

    const { entryId } = await engine.createEntry({
      orgId,
      source: { type: "pending", id: "pending-ops" },
      idempotencyKey: randomIdempotencyKey(),
      postingDate: new Date(),
      transfers: [
        {
          type: OPERATION_TRANSFER_TYPE.POST_PENDING,
          planKey: "post-1",
          currency: "USD",
          pendingId: 123n,
          amount: 0n,
        },
        {
          type: OPERATION_TRANSFER_TYPE.VOID_PENDING,
          planKey: "void-1",
          currency: "USD",
          pendingId: 124n,
        },
      ],
    });

    const postings = await getPostings(entryId);
    expect(postings).toHaveLength(0);

    const plans = await getTbTransferPlans(entryId);
    expect(plans).toHaveLength(2);
    expect(plans[0]!.type).toBe("post_pending");
    expect(plans[1]!.type).toBe("void_pending");
  });
});
