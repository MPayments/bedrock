import { describe, expect, it, vi } from "vitest";

import { createModuleRuntime } from "@bedrock/shared/core";

import { UpdateDealLegStateCommand } from "../../src/application/commands/update-deal-leg-state";
import { DealLegStateTransitionError } from "../../src/errors";

function createExecutionLeg(
  idx: number,
  kind: "collect" | "payout",
  state: "pending" | "ready" | "in_progress",
) {
  return {
    id: `leg-${idx}`,
    idx,
    kind,
    operationRefs: [],
    state,
  };
}

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

function createWorkflow() {
  const now = new Date("2026-04-01T12:00:00.000Z");

  return {
    acceptedCalculation: null,
    executionPlan: [
      createExecutionLeg(1, "collect", "ready"),
      createExecutionLeg(2, "payout", "pending"),
    ],
    header: {
      common: {
        applicantCounterpartyId: "applicant-1",
        customerNote: null,
        requestedExecutionDate: now,
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
        expectedCurrencyId: null,
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
    nextAction: "Update execution leg state",
    operationalState: {
      positions: [
        {
          amountMinor: null,
          currencyId: null,
          kind: "customer_receivable" as const,
          reasonCode: null,
          sourceRefs: ["leg:1:collect"],
          state: "ready" as const,
          updatedAt: now,
        },
      ],
    },
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
      createdAt: now,
      id: "00000000-0000-4000-8000-000000000010",
      status: "approved_for_execution" as const,
      type: "payment" as const,
      updatedAt: now,
    },
    timeline: [],
    transitionReadiness: [],
  };
}

describe("update deal leg state command", () => {
  it("rejects invalid leg state transitions", async () => {
    const existing = createWorkflow();
    const command = new UpdateDealLegStateCommand(
      createModuleRuntime({
        generateUuid: () => "00000000-0000-4000-8000-000000000099",
        logger: createLogger(),
        now: () => new Date("2026-04-01T12:05:00.000Z"),
        service: "deals",
      }),
      {
        run: vi.fn(async (work: (tx: any) => Promise<unknown>) =>
          work({
            dealReads: {
              findWorkflowById: vi.fn(async () => existing),
            },
            dealStore: {
              createDealTimelineEvents: vi.fn(),
              replaceDealOperationalPositions: vi.fn(),
              setDealRoot: vi.fn(),
              updateDealLegState: vi.fn(),
            },
          })),
      } as any,
    );

    await expect(
      command.execute({
        actorUserId: "user-1",
        dealId: existing.summary.id,
        idx: 1,
        state: "done",
      }),
    ).rejects.toBeInstanceOf(DealLegStateTransitionError);
  });

  it("updates the leg state and appends a timeline event", async () => {
    const existing = createWorkflow();
    const updated = {
      ...existing,
      executionPlan: [
        createExecutionLeg(1, "collect", "in_progress"),
        existing.executionPlan[1],
      ],
    };
    const dealStore = {
      createDealTimelineEvents: vi.fn(),
      replaceDealOperationalPositions: vi.fn(),
      setDealRoot: vi.fn(),
      updateDealLegState: vi.fn(async () => true),
    };

    const command = new UpdateDealLegStateCommand(
      createModuleRuntime({
        generateUuid: () => "00000000-0000-4000-8000-000000000099",
        logger: createLogger(),
        now: () => new Date("2026-04-01T12:05:00.000Z"),
        service: "deals",
      }),
      {
        run: vi.fn(async (work: (tx: any) => Promise<unknown>) =>
          work({
            dealReads: {
              findWorkflowById: vi
                .fn()
                .mockResolvedValueOnce(existing)
                .mockResolvedValueOnce(updated),
            },
            dealStore,
          })),
      } as any,
    );

    const result = await command.execute({
      actorUserId: "user-1",
      dealId: existing.summary.id,
      idx: 1,
      state: "in_progress",
    });

    expect(result).toBe(updated);
    expect(dealStore.updateDealLegState).toHaveBeenCalledWith({
      dealId: existing.summary.id,
      idx: 1,
      state: "in_progress",
    });
    expect(dealStore.createDealTimelineEvents).toHaveBeenCalledTimes(1);
    expect(dealStore.setDealRoot).toHaveBeenCalledWith({
      dealId: existing.summary.id,
      nextAction: updated.nextAction,
    });
    expect(dealStore.replaceDealOperationalPositions).toHaveBeenCalledTimes(1);
  });
});
