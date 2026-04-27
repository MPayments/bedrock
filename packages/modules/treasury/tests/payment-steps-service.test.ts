import { describe, expect, it } from "vitest";

import { createModuleRuntime } from "@bedrock/shared/core";

import { createPaymentStepsService } from "../src/payment-steps/application";
import type {
  PaymentStepsListQuery,
  PaymentStepsRepository,
} from "../src/payment-steps/application/ports/payment-steps.repository";
import { PaymentStep } from "../src/payment-steps/domain/payment-step";
import type { PaymentStepRecord } from "../src/payment-steps/domain/types";

const STEP_ID = "00000000-0000-4000-8000-000000001001";
const SECOND_STEP_ID = "00000000-0000-4000-8000-000000001002";
const THIRD_STEP_ID = "00000000-0000-4000-8000-000000001003";
const ATTEMPT_ID = "00000000-0000-4000-8000-000000002001";
const USD_ID = "00000000-0000-4000-8000-000000003001";
const EUR_ID = "00000000-0000-4000-8000-000000003002";
const FROM_PARTY_ID = "00000000-0000-4000-8000-000000004001";
const TO_PARTY_ID = "00000000-0000-4000-8000-000000004002";
const FROM_REQUISITE_ID = "00000000-0000-4000-8000-000000005001";
const TO_REQUISITE_ID = "00000000-0000-4000-8000-000000005002";
const NOW = new Date("2026-04-24T10:00:00.000Z");
const SUBMITTED_AT = new Date("2026-04-24T10:05:00.000Z");
const OUTCOME_AT = new Date("2026-04-24T10:15:00.000Z");

class InMemoryPaymentStepsRepository implements PaymentStepsRepository {
  private readonly rows = new Map<string, PaymentStepRecord>();

  async findStepById(id: string): Promise<PaymentStepRecord | undefined> {
    const record = this.rows.get(id);

    return record ? cloneRecord(record) : undefined;
  }

  async insertStep(input: PaymentStepRecord): Promise<PaymentStepRecord | null> {
    if (this.rows.has(input.id)) {
      return null;
    }

    const record = cloneRecord(input);
    this.rows.set(record.id, record);

    return cloneRecord(record);
  }

  async listSteps(
    input: PaymentStepsListQuery,
  ): Promise<{ rows: PaymentStepRecord[]; total: number }> {
    const rows = [...this.rows.values()]
      .filter((row) => !input.batchId || row.treasuryBatchId === input.batchId)
      .filter((row) => !input.dealId || row.dealId === input.dealId)
      .filter((row) => !input.purpose || row.purpose === input.purpose)
      .filter((row) => !input.state?.length || input.state.includes(row.state))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return {
      rows: rows.slice(input.offset, input.offset + input.limit).map(cloneRecord),
      total: rows.length,
    };
  }

  async updateStep(
    input: PaymentStepRecord,
  ): Promise<PaymentStepRecord | undefined> {
    if (!this.rows.has(input.id)) {
      return undefined;
    }

    const record = cloneRecord(input);
    this.rows.set(record.id, record);

    return cloneRecord(record);
  }
}

function cloneRecord(record: PaymentStepRecord): PaymentStepRecord {
  return PaymentStep.fromSnapshot(record).toSnapshot();
}

function createHarness(initialNow = NOW) {
  let currentNow = initialNow;
  const repository = new InMemoryPaymentStepsRepository();
  const service = createPaymentStepsService({
    repository,
    runtime: createModuleRuntime({
      generateUuid: () => {
        throw new Error("Unexpected generated id");
      },
      now: () => currentNow,
      service: "treasury.payment_steps.test",
    }),
  });

  return {
    repository,
    service,
    setNow(now: Date) {
      currentNow = now;
    },
  };
}

function createStepInput(id = STEP_ID) {
  return {
    fromAmountMinor: 10000n,
    fromCurrencyId: USD_ID,
    fromParty: {
      id: FROM_PARTY_ID,
      requisiteId: FROM_REQUISITE_ID,
    },
    id,
    kind: "payout" as const,
    purpose: "standalone_payment" as const,
    toAmountMinor: 9200n,
    toCurrencyId: EUR_ID,
    toParty: {
      id: TO_PARTY_ID,
      requisiteId: TO_REQUISITE_ID,
    },
  };
}

describe("PaymentSteps service", () => {
  it("creates and queries a standalone payment step", async () => {
    const { service } = createHarness();

    const created = await service.commands.create(createStepInput());
    const found = await service.queries.findById({ stepId: STEP_ID });

    expect(created).toMatchObject({
      fromAmountMinor: 10000n,
      id: STEP_ID,
      kind: "payout",
      purpose: "standalone_payment",
      state: "draft",
    });
    expect(found).toMatchObject({
      id: STEP_ID,
      state: "draft",
    });
  });

  it("submits and confirms a step with an append-only attempt", async () => {
    const { service, setNow } = createHarness();

    await service.commands.create({
      ...createStepInput(),
      initialState: "pending",
    });

    setNow(SUBMITTED_AT);
    const submitted = await service.commands.submit({
      attemptId: ATTEMPT_ID,
      providerRef: "bank-ref-1",
      providerSnapshot: { provider: "test-bank", status: "submitted" },
      stepId: STEP_ID,
    });

    expect(submitted).toMatchObject({
      id: STEP_ID,
      state: "processing",
      submittedAt: SUBMITTED_AT,
    });
    expect(submitted.attempts).toMatchObject([
      {
        attemptNo: 1,
        id: ATTEMPT_ID,
        outcome: "pending",
        providerRef: "bank-ref-1",
      },
    ]);

    setNow(OUTCOME_AT);
    const completed = await service.commands.confirm({
      artifacts: [
        {
          fileAssetId: "00000000-0000-4000-8000-000000006001",
          purpose: "bank_confirmation",
        },
      ],
      outcome: "settled",
      stepId: STEP_ID,
    });

    expect(completed).toMatchObject({
      completedAt: OUTCOME_AT,
      id: STEP_ID,
      state: "completed",
    });
    expect(completed.attempts).toMatchObject([
      {
        attemptNo: 1,
        id: ATTEMPT_ID,
        outcome: "settled",
        outcomeAt: OUTCOME_AT,
      },
    ]);
  });

  it("confirms a non-beneficiary step without evidence artifacts", async () => {
    const { service, setNow } = createHarness();

    await service.commands.create({
      ...createStepInput(),
      initialState: "pending",
    });

    setNow(SUBMITTED_AT);
    await service.commands.submit({
      attemptId: ATTEMPT_ID,
      stepId: STEP_ID,
    });

    setNow(OUTCOME_AT);
    const completed = await service.commands.confirm({
      outcome: "settled",
      stepId: STEP_ID,
    });

    expect(completed).toMatchObject({
      artifacts: [],
      completedAt: OUTCOME_AT,
      id: STEP_ID,
      state: "completed",
    });
  });

  it("amends, cancels, skips, and lists steps through command/query handlers", async () => {
    const { service } = createHarness();
    await service.commands.create({
      ...createStepInput(STEP_ID),
      initialState: "pending",
    });
    await service.commands.create(createStepInput(SECOND_STEP_ID));
    await service.commands.create(createStepInput(THIRD_STEP_ID));

    const amended = await service.commands.amend({
      fromAmountMinor: 12000n,
      rate: {
        lockedSide: "in",
        value: "1.08695652",
      },
      stepId: STEP_ID,
    });
    const cancelled = await service.commands.cancel({ stepId: SECOND_STEP_ID });
    const skipped = await service.commands.skip({ stepId: THIRD_STEP_ID });
    const listed = await service.queries.list({
      limit: 10,
      offset: 0,
      purpose: "standalone_payment",
      state: ["pending", "cancelled"],
    });

    expect(amended).toMatchObject({
      fromAmountMinor: 12000n,
      rate: {
        lockedSide: "in",
        value: "1.08695652",
      },
      state: "pending",
    });
    expect(cancelled.state).toBe("cancelled");
    expect(skipped.state).toBe("skipped");
    expect(listed.total).toBe(2);
    expect(listed.data.map((step) => step.id).sort()).toEqual([
      STEP_ID,
      SECOND_STEP_ID,
    ]);
  });

  it("cancelDrafts cancels only draft deal_leg steps and is naturally idempotent", async () => {
    const dealId = "00000000-0000-4000-8000-000000006001";
    const otherDealId = "00000000-0000-4000-8000-000000006002";
    const { service } = createHarness();

    await service.commands.create({
      ...createStepInput(STEP_ID),
      dealId,
      origin: {
        dealId,
        planLegId: "plan-leg-1",
        routeSnapshotLegId: null,
        sequence: 1,
        treasuryOrderId: null,
        type: "deal_execution_leg",
      },
      purpose: "deal_leg",
      sourceRef: `deal:${dealId}:plan-leg:plan-leg-1:payout:1`,
    });
    await service.commands.create({
      ...createStepInput(SECOND_STEP_ID),
      dealId,
      initialState: "pending",
      origin: {
        dealId,
        planLegId: "plan-leg-2",
        routeSnapshotLegId: null,
        sequence: 2,
        treasuryOrderId: null,
        type: "deal_execution_leg",
      },
      purpose: "deal_leg",
      sourceRef: `deal:${dealId}:plan-leg:plan-leg-2:payout:1`,
    });
    await service.commands.create({
      ...createStepInput(THIRD_STEP_ID),
      dealId: otherDealId,
      origin: {
        dealId: otherDealId,
        planLegId: "plan-leg-1",
        routeSnapshotLegId: null,
        sequence: 1,
        treasuryOrderId: null,
        type: "deal_execution_leg",
      },
      purpose: "deal_leg",
      sourceRef: `deal:${otherDealId}:plan-leg:plan-leg-1:payout:1`,
    });

    const firstResult = await service.commands.cancelDrafts({
      actorUserId: "user-1",
      dealId,
    });
    expect(firstResult.cancelledCount).toBe(1);

    const targetDealSteps = await service.queries.list({
      dealId,
      limit: 10,
      offset: 0,
      purpose: "deal_leg",
    });
    const stateById = new Map(
      targetDealSteps.data.map((step) => [step.id, step.state]),
    );
    expect(stateById.get(STEP_ID)).toBe("cancelled");
    expect(stateById.get(SECOND_STEP_ID)).toBe("pending");

    const otherDealStep = await service.queries.findById({
      stepId: THIRD_STEP_ID,
    });
    expect(otherDealStep?.state).toBe("draft");

    const secondResult = await service.commands.cancelDrafts({
      actorUserId: "user-1",
      dealId,
    });
    expect(secondResult.cancelledCount).toBe(0);
  });
});
