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
    dealLegIdx: 0,
    dealLegRole: "payout" as const,
    fromAmountMinor: 10000n,
    fromCurrencyId: currencyIdForCode("USD"),
    fromParty: {
      id: FROM_PARTY_ID,
      requisiteId: FROM_REQUISITE_ID,
    },
    id,
    initialState: "pending" as const,
    kind: "payout" as const,
    purpose: "deal_leg" as const,
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
      dealLegIdx: 0,
      dealLegRole: "payout",
      failureReason: "provider rejected",
      id: STEP_ID,
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
});
