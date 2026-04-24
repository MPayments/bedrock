import { describe, expect, it, vi } from "vitest";

import { createModuleRuntime } from "@bedrock/shared/core";
import { ValidationError } from "@bedrock/shared/core/errors";

import { SetDealLegManualOverrideCommand } from "../../src/application/commands/set-deal-leg-manual-override";
import { DealNotFoundError } from "../../src/errors";

const DEAL_ID = "00000000-0000-4000-8000-000000000010";
const TIMESTAMP = new Date("2026-04-01T12:00:00.000Z");

function createLogger() {
  const logger = {
    child: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  };
  logger.child.mockReturnValue(logger);
  return logger;
}

function createWorkflow(
  overrides?: Partial<{
    legState:
      | "pending"
      | "ready"
      | "in_progress"
      | "done"
      | "blocked"
      | "skipped";
  }>,
) {
  return {
    acceptedQuote: null,
    executionPlan: [
      {
        id: "leg-1",
        idx: 1,
        kind: "collect" as const,
        operationRefs: [],
        state: overrides?.legState ?? "pending",
      },
    ],
    intake: {
      common: {
        applicantCounterpartyId: "applicant-1",
        customerNote: null,
        requestedExecutionDate: TIMESTAMP,
      },
      externalBeneficiary: {
        bankInstructionSnapshot: null,
        beneficiaryCounterpartyId: "beneficiary-1",
        beneficiarySnapshot: null,
      },
      incomingReceipt: {
        contractNumber: null,
        expectedAmount: null,
        expectedAt: null,
        invoiceNumber: null,
        payerCounterpartyId: null,
        payerSnapshot: null,
      },
      moneyRequest: {
        purpose: "Payment",
        sourceAmount: "100.00",
        sourceCurrencyId: "currency-1",
        targetCurrencyId: null,
      },
      settlementDestination: {
        bankInstructionSnapshot: null,
        mode: null,
        requisiteId: null,
      },
      type: "payment" as const,
    },
    nextAction: "Do something",
    operationalState: { positions: [] },
    participants: [],
    relatedResources: {
      attachments: [],
      calculations: [],
      formalDocuments: [],
      quotes: [],
    },
    revision: 1,
    sectionCompleteness: [],
    summary: {
      agreementId: "agreement-1",
      agentId: null,
      calculationId: null,
      createdAt: TIMESTAMP,
      id: DEAL_ID,
      status: "awaiting_funds" as const,
      type: "payment" as const,
      updatedAt: TIMESTAMP,
    },
    timeline: [],
    transitionReadiness: [],
  };
}

function createCommand(overrides?: {
  workflowBefore?: ReturnType<typeof createWorkflow> | null;
  workflowAfter?: ReturnType<typeof createWorkflow> | null;
  setWrites?: boolean;
}) {
  const workflowBefore =
    overrides?.workflowBefore === undefined
      ? createWorkflow()
      : overrides.workflowBefore;
  const workflowAfter =
    overrides?.workflowAfter === undefined
      ? createWorkflow({ legState: "blocked" })
      : overrides.workflowAfter;

  const dealStore = {
    createDealTimelineEvents: vi.fn(),
    setDealLegManualOverride: vi.fn(async () => overrides?.setWrites ?? true),
    setDealRoot: vi.fn(),
  };
  const dealReads = {
    findWorkflowById: vi
      .fn()
      .mockResolvedValueOnce(workflowBefore)
      .mockResolvedValueOnce(workflowAfter),
  };

  const command = new SetDealLegManualOverrideCommand(
    createModuleRuntime({
      generateUuid: () => "00000000-0000-4000-8000-000000000099",
      logger: createLogger(),
      now: () => TIMESTAMP,
      service: "deals",
    }),
    {
      run: vi.fn(async (work: (tx: any) => Promise<unknown>) =>
        work({ dealReads, dealStore }),
      ),
    } as any,
  );

  return { command, dealReads, dealStore };
}

describe("SetDealLegManualOverrideCommand", () => {
  it("writes the blocked override + emits `leg_manual_override_set` timeline event", async () => {
    const { command, dealStore } = createCommand();

    await command.execute({
      actorUserId: "user-1",
      comment: "Customer requested hold",
      dealId: DEAL_ID,
      idx: 1,
      override: "blocked",
      reasonCode: "customer_request",
    });

    expect(dealStore.setDealLegManualOverride).toHaveBeenCalledWith({
      comment: "Customer requested hold",
      dealId: DEAL_ID,
      idx: 1,
      manualOverrideState: "blocked",
      reasonCode: "customer_request",
    });
    expect(dealStore.createDealTimelineEvents).toHaveBeenCalledTimes(1);
    const events = dealStore.createDealTimelineEvents.mock
      .calls[0][0] as Array<{
      payload: Record<string, unknown>;
      type: string;
    }>;
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("leg_manual_override_set");
    expect(events[0]?.payload).toMatchObject({
      comment: "Customer requested hold",
      fromState: "pending",
      idx: 1,
      kind: "collect",
      override: "blocked",
      reasonCode: "customer_request",
    });
  });

  it("writes the skipped override", async () => {
    const { command, dealStore } = createCommand({
      workflowAfter: createWorkflow({ legState: "skipped" }),
    });

    await command.execute({
      actorUserId: "user-1",
      dealId: DEAL_ID,
      idx: 1,
      override: "skipped",
    });

    expect(dealStore.setDealLegManualOverride).toHaveBeenCalledWith({
      comment: null,
      dealId: DEAL_ID,
      idx: 1,
      manualOverrideState: "skipped",
      reasonCode: null,
    });
    const events = dealStore.createDealTimelineEvents.mock
      .calls[0][0] as Array<{ type: string }>;
    expect(events[0]?.type).toBe("leg_manual_override_set");
  });

  it("emits `leg_manual_override_cleared` when clearing to null", async () => {
    const { command, dealStore } = createCommand({
      workflowBefore: createWorkflow({ legState: "blocked" }),
      workflowAfter: createWorkflow({ legState: "pending" }),
    });

    await command.execute({
      actorUserId: "user-1",
      comment: "Resolved after customer confirmation",
      dealId: DEAL_ID,
      idx: 1,
      override: null,
    });

    expect(dealStore.setDealLegManualOverride).toHaveBeenCalledWith({
      comment: "Resolved after customer confirmation",
      dealId: DEAL_ID,
      idx: 1,
      manualOverrideState: null,
      reasonCode: null,
    });
    const events = dealStore.createDealTimelineEvents.mock
      .calls[0][0] as Array<{ payload: Record<string, unknown>; type: string }>;
    expect(events[0]?.type).toBe("leg_manual_override_cleared");
    expect(events[0]?.payload).toMatchObject({
      fromState: "blocked",
      override: null,
    });
  });

  it("throws DealNotFoundError when the deal workflow cannot be found", async () => {
    const { command } = createCommand({ workflowBefore: null });

    await expect(
      command.execute({
        actorUserId: "user-1",
        dealId: DEAL_ID,
        idx: 1,
        override: "blocked",
      }),
    ).rejects.toBeInstanceOf(DealNotFoundError);
  });

  it("throws ValidationError when the requested leg idx does not exist", async () => {
    const { command } = createCommand();

    await expect(
      command.execute({
        actorUserId: "user-1",
        dealId: DEAL_ID,
        idx: 9,
        override: "blocked",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("throws ValidationError when the stored leg write returns false (no row matched)", async () => {
    const { command } = createCommand({ setWrites: false });

    await expect(
      command.execute({
        actorUserId: "user-1",
        dealId: DEAL_ID,
        idx: 1,
        override: "blocked",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("refreshes the deal's `nextAction` after writing the override", async () => {
    const { command, dealStore } = createCommand();

    await command.execute({
      actorUserId: "user-1",
      dealId: DEAL_ID,
      idx: 1,
      override: "blocked",
    });

    expect(dealStore.setDealRoot).toHaveBeenCalledWith({
      dealId: DEAL_ID,
      nextAction: "Do something",
    });
  });
});
