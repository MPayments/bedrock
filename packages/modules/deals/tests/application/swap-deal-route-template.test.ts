import { describe, expect, it, vi } from "vitest";

import { createModuleRuntime } from "@bedrock/shared/core";
import { createTestLogger } from "@bedrock/test-utils";

import { SwapDealRouteTemplateCommand } from "../../src/application/commands/swap-deal-route-template";

const RUB_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USD_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TEMPLATE_OLD_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const TEMPLATE_NEW_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function createRouteSnapshot() {
  return {
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
        toCurrencyId: RUB_ID,
      },
      {
        fees: [],
        fromCurrencyId: RUB_ID,
        id: "leg-2",
        toCurrencyId: USD_ID,
      },
      {
        fees: [],
        fromCurrencyId: USD_ID,
        id: "leg-3",
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
        binding: "bound" as const,
        displayName: "Treasury RUB",
        entityId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        entityKind: "organization" as const,
        nodeId: "node-2",
        requisiteId: null,
        role: "hop" as const,
      },
      {
        binding: "bound" as const,
        displayName: "Treasury USD",
        entityId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
        entityKind: "organization" as const,
        nodeId: "node-3",
        requisiteId: null,
        role: "hop" as const,
      },
      {
        binding: "abstract" as const,
        displayName: "Destination",
        entityId: null,
        entityKind: null,
        nodeId: "node-4",
        requisiteId: null,
        role: "destination" as const,
      },
    ],
  };
}

function createPricingContext(templateId: string = TEMPLATE_OLD_ID) {
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
      snapshot: createRouteSnapshot(),
      templateId,
      templateName: "Old Route",
    },
  };
}

function createWorkflow(overrides?: {
  legState?: "pending" | "ready" | "in_progress" | "done";
  hasAcceptance?: boolean;
}) {
  const now = new Date("2026-04-01T12:00:00.000Z");
  return {
    acceptedQuote: overrides?.hasAcceptance === false
      ? null
      : {
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
        },
    executionPlan: [
      {
        id: "leg-1",
        idx: 1,
        kind: "collect" as const,
        operationRefs: [],
        state: overrides?.legState ?? "ready",
      },
    ],
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

function buildCommand(input: {
  pricingContext: ReturnType<typeof createPricingContext>;
  workflow: ReturnType<typeof createWorkflow>;
  templateFound?: boolean;
}) {
  const findPaymentRouteTemplateById = vi.fn(async (templateId: string) =>
    input.templateFound === false
      ? null
      : {
          id: templateId,
          name: templateId === TEMPLATE_OLD_ID ? "Old Route" : "New Route",
          snapshot: createRouteSnapshot(),
        },
  );
  const dealStore = {
    createDealTimelineEvents: vi.fn(),
    replaceDealLegs: vi.fn(),
    replaceDealOperationalPositions: vi.fn(),
    replaceDealPricingContext: vi.fn(async () => true),
    revokeCurrentQuoteAcceptances: vi.fn(async () => true),
    setDealRoot: vi.fn(),
  };
  const dealReads = {
    findPricingContextByDealId: vi.fn(async () => input.pricingContext),
    findWorkflowById: vi.fn(async () => input.workflow),
  };

  const command = new SwapDealRouteTemplateCommand(
    createModuleRuntime({
      generateUuid: () => "00000000-0000-4000-8000-000000000099",
      logger: createTestLogger(),
      now: () => new Date("2026-04-01T12:05:00.000Z"),
      service: "deals",
    }),
    {
      run: vi.fn(async (work: (tx: any) => Promise<unknown>) =>
        work({ dealReads, dealStore }),
      ),
    } as any,
    { findPaymentRouteTemplateById } as any,
  );

  return { command, dealStore, findPaymentRouteTemplateById };
}

describe("SwapDealRouteTemplateCommand", () => {
  it("is a no-op when newRouteTemplateId matches the current template", async () => {
    const { command, dealStore, findPaymentRouteTemplateById } = buildCommand({
      pricingContext: createPricingContext(TEMPLATE_OLD_ID),
      workflow: createWorkflow(),
    });

    await command.execute({
      actorUserId: "user-1",
      dealId: "00000000-0000-4000-8000-000000000010",
      newRouteTemplateId: TEMPLATE_OLD_ID,
      reasonCode: "market_moved",
    });

    expect(findPaymentRouteTemplateById).toHaveBeenCalledWith(TEMPLATE_OLD_ID);
    expect(dealStore.replaceDealPricingContext).not.toHaveBeenCalled();
    expect(dealStore.revokeCurrentQuoteAcceptances).not.toHaveBeenCalled();
    expect(dealStore.createDealTimelineEvents).not.toHaveBeenCalled();
  });

  it("detaches + reattaches and revokes active acceptance when swapping to a different template", async () => {
    const pricingContext = createPricingContext(TEMPLATE_OLD_ID);
    const afterDetachPricingContext = {
      ...pricingContext,
      revision: pricingContext.revision + 1,
      routeAttachment: null,
    };
    const dealReads = {
      findPricingContextByDealId: vi
        .fn()
        .mockResolvedValueOnce(pricingContext)
        .mockResolvedValueOnce(afterDetachPricingContext),
      findWorkflowById: vi.fn(async () => createWorkflow()),
    };
    const dealStore = {
      createDealTimelineEvents: vi.fn(),
      replaceDealLegs: vi.fn(),
      replaceDealOperationalPositions: vi.fn(),
      replaceDealPricingContext: vi.fn(async () => true),
      revokeCurrentQuoteAcceptances: vi.fn(async () => true),
      setDealRoot: vi.fn(),
    };
    const findPaymentRouteTemplateById = vi.fn(async () => ({
      id: TEMPLATE_NEW_ID,
      name: "New Route",
      snapshot: createRouteSnapshot(),
    }));

    const command = new SwapDealRouteTemplateCommand(
      createModuleRuntime({
        generateUuid: () => "00000000-0000-4000-8000-000000000099",
        logger: createTestLogger(),
        now: () => new Date("2026-04-01T12:05:00.000Z"),
        service: "deals",
      }),
      {
        run: vi.fn(async (work: (tx: any) => Promise<unknown>) =>
          work({ dealReads, dealStore }),
        ),
      } as any,
      { findPaymentRouteTemplateById } as any,
    );

    await command.execute({
      actorUserId: "user-1",
      dealId: "00000000-0000-4000-8000-000000000010",
      newRouteTemplateId: TEMPLATE_NEW_ID,
      reasonCode: "market_moved",
    });

    // detach then attach → two replaceDealPricingContext calls
    expect(dealStore.replaceDealPricingContext).toHaveBeenCalledTimes(2);
    expect(dealStore.revokeCurrentQuoteAcceptances).toHaveBeenCalledTimes(1);
    // Legs are re-materialized from the newly attached route snapshot.
    expect(dealStore.replaceDealLegs).toHaveBeenCalledTimes(1);
    const replaceLegsCall = dealStore.replaceDealLegs.mock.calls[0][0];
    const legs: {
      kind: string;
      routeSnapshotLegId: string | null;
    }[] = replaceLegsCall.legs;
    // Attached route is the full execution plan: one deal leg per snapshot leg.
    expect(legs[0]?.kind).toBe("collect");
    expect(legs[legs.length - 1]?.kind).toBe("payout");
    expect(legs.every((leg) => leg.routeSnapshotLegId !== null)).toBe(true);
    const events = dealStore.createDealTimelineEvents.mock.calls[0][0];
    const types = events.map((event: any) => event.type);
    expect(types).toContain("deal_route_template_swapped");
    expect(types).toContain("acceptance_revoked_by_operator");
  });

  it("rejects swap when any leg is in_progress", async () => {
    const { command } = buildCommand({
      pricingContext: createPricingContext(),
      workflow: createWorkflow({ legState: "in_progress" }),
    });

    await expect(
      command.execute({
        actorUserId: "user-1",
        dealId: "00000000-0000-4000-8000-000000000010",
        newRouteTemplateId: TEMPLATE_NEW_ID,
        reasonCode: "market_moved",
      }),
    ).rejects.toThrow(/in_progress/u);
  });

  it("throws NotFoundError when the new template does not exist", async () => {
    const { command } = buildCommand({
      pricingContext: createPricingContext(),
      templateFound: false,
      workflow: createWorkflow(),
    });

    await expect(
      command.execute({
        actorUserId: "user-1",
        dealId: "00000000-0000-4000-8000-000000000010",
        newRouteTemplateId: TEMPLATE_NEW_ID,
        reasonCode: "market_moved",
      }),
    ).rejects.toThrow(/PaymentRouteTemplate/u);
  });
});
