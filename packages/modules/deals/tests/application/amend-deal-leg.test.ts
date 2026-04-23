import { describe, expect, it, vi } from "vitest";

import { createModuleRuntime } from "@bedrock/shared/core";

import { AmendDealLegCommand } from "../../src/application/commands/amend-deal-leg";

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

function createExecutionLeg(
  idx: number,
  state: "pending" | "ready" | "in_progress" | "done",
) {
  return {
    id: `leg-${idx}`,
    idx,
    kind: "collect" as const,
    operationRefs: [],
    state,
  };
}

const RUB_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USD_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TEMPLATE_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function createPricingContext() {
  return {
    commercialDraft: {
      fixedFeeAmount: null,
      fixedFeeCurrency: null,
      quoteMarkupBps: null,
    },
    fundingAdjustments: [],
    revision: 1,
    routeAttachment: {
      attachedAt: new Date("2026-04-01T10:00:00.000Z"),
      snapshot: {
        additionalFees: [],
        amountInMinor: "1000000",
        amountOutMinor: "1000000",
        currencyInId: RUB_ID,
        currencyOutId: USD_ID,
        legs: [
          {
            fees: [],
            fromCurrencyId: RUB_ID,
            id: "leg-1",
            toCurrencyId: USD_ID,
          },
        ],
        lockedSide: "currency_in" as const,
        participants: [
          {
            binding: "abstract" as const,
            displayName: "Source",
            entityId: null,
            entityKind: null,
            nodeId: "node-1",
            requisiteId: null,
            role: "source" as const,
          },
          {
            binding: "abstract" as const,
            displayName: "Destination",
            entityId: null,
            entityKind: null,
            nodeId: "node-2",
            requisiteId: null,
            role: "destination" as const,
          },
        ],
      },
      templateId: TEMPLATE_ID,
      templateName: "Test Route",
    },
  } as const;
}

function createWorkflow(overrides?: {
  legState?: "pending" | "ready" | "in_progress" | "done";
  acceptedQuote?: { revokedAt: Date | null; quoteId: string } | null;
}) {
  const now = new Date("2026-04-01T12:00:00.000Z");
  return {
    acceptedQuote:
      overrides?.acceptedQuote === undefined
        ? {
            acceptedAt: now,
            acceptedByUserId: "user-1",
            agreementVersionId: null,
            dealId: "00000000-0000-4000-8000-000000000010",
            dealRevision: 1,
            expiresAt: null,
            id: "acceptance-1",
            quoteId: "quote-1",
            quoteStatus: "accepted",
            replacedByQuoteId: null,
            revocationReason: null,
            revokedAt: null,
            usedAt: null,
            usedDocumentId: null,
          }
        : overrides.acceptedQuote,
    executionPlan: [createExecutionLeg(1, overrides?.legState ?? "ready")],
    intake: {
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
      createdAt: now,
      id: "00000000-0000-4000-8000-000000000010",
      status: "awaiting_funds" as const,
      type: "payment" as const,
      updatedAt: now,
    },
    timeline: [],
    transitionReadiness: [],
  };
}

function createCommand(input: {
  workflow: ReturnType<typeof createWorkflow>;
  pricingContext: ReturnType<typeof createPricingContext>;
  revokeResult?: boolean;
}) {
  const dealStore = {
    createDealTimelineEvents: vi.fn(),
    replaceDealLegs: vi.fn(),
    replaceDealOperationalPositions: vi.fn(),
    replaceDealPricingContext: vi.fn(async () => true),
    revokeCurrentQuoteAcceptances: vi.fn(async () => input.revokeResult ?? true),
    setDealRoot: vi.fn(),
  };
  const dealReads = {
    findPricingContextByDealId: vi.fn(async () => input.pricingContext),
    findWorkflowById: vi.fn(async () => input.workflow),
  };

  const command = new AmendDealLegCommand(
    createModuleRuntime({
      generateUuid: () => "00000000-0000-4000-8000-000000000099",
      logger: createLogger(),
      now: () => new Date("2026-04-01T12:05:00.000Z"),
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

describe("AmendDealLegCommand", () => {
  it("execution-kind amendment patches the route snapshot and leaves the lock intact", async () => {
    const { command, dealStore } = createCommand({
      pricingContext: createPricingContext(),
      workflow: createWorkflow(),
    });

    await command.execute({
      actorUserId: "user-1",
      amendmentKind: "execution",
      changes: { fees: [] },
      dealId: "00000000-0000-4000-8000-000000000010",
      legIdx: 1,
      reasonCode: "fee_correction",
    });

    expect(dealStore.replaceDealPricingContext).toHaveBeenCalledTimes(1);
    expect(dealStore.revokeCurrentQuoteAcceptances).not.toHaveBeenCalled();
    const events = dealStore.createDealTimelineEvents.mock.calls[0][0];
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("deal_leg_amended");
    expect(events[0].payload.amendmentKind).toBe("execution");
    expect(events[0].payload.approvalStatus).toBe("auto");
  });

  it("commercial-kind amendment revokes current acceptance and appends both events", async () => {
    const { command, dealStore } = createCommand({
      pricingContext: createPricingContext(),
      workflow: createWorkflow(),
    });

    await command.execute({
      actorUserId: "user-1",
      amendmentKind: "commercial",
      changes: { fees: [] },
      dealId: "00000000-0000-4000-8000-000000000010",
      legIdx: 1,
      reasonCode: "market_moved",
    });

    expect(dealStore.revokeCurrentQuoteAcceptances).toHaveBeenCalledTimes(1);
    const events = dealStore.createDealTimelineEvents.mock.calls[0][0];
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe("deal_leg_amended");
    expect(events[1].type).toBe("acceptance_revoked_by_operator");
    expect(events[1].payload.revocationReason).toBe(
      "operator_commercial_amendment",
    );
  });

  it("commercial-kind amendment skips revocation when no active acceptance", async () => {
    const { command, dealStore } = createCommand({
      pricingContext: createPricingContext(),
      workflow: createWorkflow({ acceptedQuote: null }),
    });

    await command.execute({
      actorUserId: "user-1",
      amendmentKind: "commercial",
      changes: { fees: [] },
      dealId: "00000000-0000-4000-8000-000000000010",
      legIdx: 1,
      reasonCode: "market_moved",
    });

    expect(dealStore.revokeCurrentQuoteAcceptances).not.toHaveBeenCalled();
    const events = dealStore.createDealTimelineEvents.mock.calls[0][0];
    expect(events).toHaveLength(1);
  });

  it.each(["in_progress", "done"] as const)(
    "rejects amendment when leg is %s",
    async (state) => {
      const { command } = createCommand({
        pricingContext: createPricingContext(),
        workflow: createWorkflow({ legState: state }),
      });

      await expect(
        command.execute({
          actorUserId: "user-1",
          amendmentKind: "execution",
          changes: { fees: [] },
          dealId: "00000000-0000-4000-8000-000000000010",
          legIdx: 1,
          reasonCode: "fee_correction",
        }),
      ).rejects.toThrow(/is (in_progress|done)/u);
    },
  );

  it("rejects amendment when leg index is out of range", async () => {
    const { command } = createCommand({
      pricingContext: createPricingContext(),
      workflow: createWorkflow(),
    });

    await expect(
      command.execute({
        actorUserId: "user-1",
        amendmentKind: "execution",
        changes: { fees: [] },
        dealId: "00000000-0000-4000-8000-000000000010",
        legIdx: 99,
        reasonCode: "requisite_invalid",
      }),
    ).rejects.toThrow(/no leg at index 99/u);
  });
});
