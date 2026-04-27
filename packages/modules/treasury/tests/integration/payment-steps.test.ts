import { describe, expect, it } from "vitest";

import { createModuleRuntime } from "@bedrock/shared/core";

import { createPaymentStepsService } from "../../src/payment-steps/application";
import { DrizzlePaymentStepsRepository } from "../../src/payment-steps/infra/drizzle/payment-steps.repository";
import { currencyIdForCode } from "../helpers";
import { db } from "./setup";

const STEP_ID = "00000000-0000-4000-8000-000000011001";
const SETTLED_STEP_ID = "00000000-0000-4000-8000-000000011002";
const ATTEMPT_ID = "00000000-0000-4000-8000-000000012001";
const SETTLED_ATTEMPT_ID = "00000000-0000-4000-8000-000000012002";
const DEAL_ID = "00000000-0000-4000-8000-000000013001";
const FROM_PARTY_ID = "00000000-0000-4000-8000-000000014001";
const TO_PARTY_ID = "00000000-0000-4000-8000-000000014002";
const FROM_REQUISITE_ID = "00000000-0000-4000-8000-000000015001";
const TO_REQUISITE_ID = "00000000-0000-4000-8000-000000015002";
const SETTLEMENT_EVIDENCE_FILE_ID = "00000000-0000-4000-8000-000000016001";
const POSTING_STEP_ID = "00000000-0000-4000-8000-000000011003";
const POSTING_DOCUMENT_ID = "00000000-0000-4000-8000-000000017001";

function createService(now: Date) {
  return createPaymentStepsService({
    repository: new DrizzlePaymentStepsRepository(db),
    runtime: createModuleRuntime({
      generateUuid: () => {
        throw new Error("Unexpected generated id");
      },
      now: () => now,
      service: "treasury.payment_steps.integration",
    }),
  });
}

function createDealLegStepInput(id = STEP_ID) {
  return {
    dealId: DEAL_ID,
    fromAmountMinor: 10000n,
    fromCurrencyId: currencyIdForCode("USD"),
    fromParty: {
      id: FROM_PARTY_ID,
      requisiteId: FROM_REQUISITE_ID,
    },
    id,
    initialState: "pending" as const,
    kind: "payout" as const,
    origin: {
      dealId: DEAL_ID,
      planLegId: `plan-leg-${id}`,
      routeSnapshotLegId: null,
      sequence: 1,
      treasuryOrderId: null,
      type: "deal_execution_leg" as const,
    },
    purpose: "deal_leg" as const,
    sourceRef: `deal:${DEAL_ID}:plan-leg:plan-leg-${id}:payout:1`,
    toAmountMinor: 9200n,
    toCurrencyId: currencyIdForCode("EUR"),
    toParty: {
      id: TO_PARTY_ID,
      requisiteId: TO_REQUISITE_ID,
    },
  };
}

describe("PaymentSteps repository integration", () => {
  it("persists commands and loads attempts through queries", async () => {
    const createdAt = new Date("2026-04-24T10:00:00.000Z");
    const submittedAt = new Date("2026-04-24T10:05:00.000Z");
    const outcomeAt = new Date("2026-04-24T10:15:00.000Z");

    await createService(createdAt).commands.create(createDealLegStepInput());
    await createService(submittedAt).commands.submit({
      attemptId: ATTEMPT_ID,
      providerRef: "bank-ref-1",
      providerSnapshot: { provider: "integration-bank", status: "submitted" },
      stepId: STEP_ID,
    });
    await createService(outcomeAt).commands.confirm({
      failureReason: "provider rejected",
      outcome: "failed",
      stepId: STEP_ID,
    });

    const service = createService(outcomeAt);
    const found = await service.queries.findById({ stepId: STEP_ID });
    const listed = await service.queries.list({
      dealId: DEAL_ID,
      limit: 10,
      offset: 0,
      purpose: "deal_leg",
      state: ["failed"],
    });

    expect(found).toMatchObject({
      dealId: DEAL_ID,
      failureReason: "provider rejected",
      id: STEP_ID,
      origin: expect.objectContaining({
        planLegId: `plan-leg-${STEP_ID}`,
        type: "deal_execution_leg",
      }),
      state: "failed",
    });
    expect(found.attempts).toMatchObject([
      {
        attemptNo: 1,
        id: ATTEMPT_ID,
        outcome: "failed",
        providerRef: "bank-ref-1",
      },
    ]);
    expect(listed).toMatchObject({
      limit: 10,
      offset: 0,
      total: 1,
    });
    expect(listed.data[0]?.id).toBe(STEP_ID);
  });

  it("persists settlement evidence artifacts for completed steps", async () => {
    const createdAt = new Date("2026-04-24T11:00:00.000Z");
    const submittedAt = new Date("2026-04-24T11:05:00.000Z");
    const outcomeAt = new Date("2026-04-24T11:15:00.000Z");

    await createService(createdAt).commands.create(
      createDealLegStepInput(SETTLED_STEP_ID),
    );
    await createService(submittedAt).commands.submit({
      attemptId: SETTLED_ATTEMPT_ID,
      providerRef: "bank-ref-settled",
      providerSnapshot: { provider: "integration-bank", status: "settled" },
      stepId: SETTLED_STEP_ID,
    });
    await createService(outcomeAt).commands.confirm({
      artifacts: [
        {
          fileAssetId: SETTLEMENT_EVIDENCE_FILE_ID,
          purpose: "bank_confirmation",
        },
      ],
      attemptId: SETTLED_ATTEMPT_ID,
      outcome: "settled",
      stepId: SETTLED_STEP_ID,
    });

    const service = createService(outcomeAt);
    const found = await service.queries.findById({ stepId: SETTLED_STEP_ID });
    const listed = await service.queries.list({
      dealId: DEAL_ID,
      limit: 10,
      offset: 0,
      purpose: "deal_leg",
      state: ["completed"],
    });

    expect(found).toMatchObject({
      completedAt: outcomeAt,
      id: SETTLED_STEP_ID,
      state: "completed",
    });
    expect(found.artifacts).toEqual([
      {
        fileAssetId: SETTLEMENT_EVIDENCE_FILE_ID,
        purpose: "bank_confirmation",
      },
    ]);
    expect(found.attempts).toMatchObject([
      {
        attemptNo: 1,
        id: SETTLED_ATTEMPT_ID,
        outcome: "settled",
        providerRef: "bank-ref-settled",
      },
    ]);
    expect(listed.data[0]?.artifacts).toEqual(found.artifacts);
  });

  it("links a posting document idempotently via attachPosting", async () => {
    const createdAt = new Date("2026-04-24T12:00:00.000Z");
    const firstAttachAt = new Date("2026-04-24T12:05:00.000Z");
    const secondAttachAt = new Date("2026-04-24T12:10:00.000Z");

    await createService(createdAt).commands.create(
      createDealLegStepInput(POSTING_STEP_ID),
    );

    const firstAttach = await createService(
      firstAttachAt,
    ).commands.attachPosting({
      documentId: POSTING_DOCUMENT_ID,
      kind: "exchange",
      stepId: POSTING_STEP_ID,
    });
    expect(firstAttach.postingDocumentRefs).toEqual([
      { documentId: POSTING_DOCUMENT_ID, kind: "exchange" },
    ]);
    expect(firstAttach.updatedAt).toEqual(firstAttachAt);

    // Re-attaching the same `(documentId, kind)` pair is a no-op: postings
    // stay as one entry and `updatedAt` does not advance because the
    // aggregate returns a clone when nothing changed.
    const secondAttach = await createService(
      secondAttachAt,
    ).commands.attachPosting({
      documentId: POSTING_DOCUMENT_ID,
      kind: "exchange",
      stepId: POSTING_STEP_ID,
    });
    expect(secondAttach.postingDocumentRefs).toEqual([
      { documentId: POSTING_DOCUMENT_ID, kind: "exchange" },
    ]);
    expect(secondAttach.updatedAt).toEqual(firstAttachAt);

    const persisted = await createService(secondAttachAt).queries.findById({
      stepId: POSTING_STEP_ID,
    });
    expect(persisted.postingDocumentRefs).toEqual([
      { documentId: POSTING_DOCUMENT_ID, kind: "exchange" },
    ]);
  });
});
