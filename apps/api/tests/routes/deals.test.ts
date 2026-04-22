import { OpenAPIHono } from "@hono/zod-openapi";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { userHasPermission } = vi.hoisted(() => ({
  userHasPermission: vi.fn(async () => ({ success: true })),
}));

vi.mock("../../src/auth", () => ({
  authByAudience: {
    crm: {
      api: {
        userHasPermission,
      },
    },
    finance: {
      api: {
        userHasPermission,
      },
    },
    portal: {
      api: {
        userHasPermission,
      },
    },
  },
}));

import {
  DealNotFoundError,
  DealPricingContextRevisionConflictError,
  DealTransitionBlockedError,
} from "@bedrock/deals";

import { dealsRoutes } from "../../src/routes/deals";

function createExecutionLeg(
  idx: number,
  kind: "collect" | "convert" | "payout" | "transit_hold" | "settle_exporter",
  state: "pending" | "ready" | "in_progress" | "done" | "blocked",
) {
  return {
    id: `00000000-0000-4000-8000-0000000001${idx.toString().padStart(2, "0")}`,
    idx,
    kind,
    operationRefs: [],
    state,
  };
}

function createDealDetail() {
  const now = new Date("2026-03-30T00:00:00.000Z");

  return {
    amount: "100.00",
    id: "00000000-0000-4000-8000-000000000010",
    customerId: "00000000-0000-4000-8000-000000000001",
    agreementId: "00000000-0000-4000-8000-000000000002",
    calculationId: "00000000-0000-4000-8000-000000000003",
    type: "payment" as const,
    status: "draft" as const,
    comment: "Draft payment deal",
    createdAt: now,
    currencyId: "00000000-0000-4000-8000-000000000006",
    updatedAt: now,
    legs: [
      {
        id: "00000000-0000-4000-8000-000000000011",
        idx: 1,
        kind: "payment" as const,
        status: "draft" as const,
        createdAt: now,
        updatedAt: now,
      },
    ],
    participants: [
      {
        id: "00000000-0000-4000-8000-000000000012",
        role: "customer" as const,
        partyId: "00000000-0000-4000-8000-000000000001",
        customerId: "00000000-0000-4000-8000-000000000001",
        organizationId: null,
        counterpartyId: null,
        createdAt: now,
        updatedAt: now,
      },
    ],
    statusHistory: [
      {
        id: "00000000-0000-4000-8000-000000000013",
        status: "draft" as const,
        changedBy: "user-1",
        comment: "Draft payment deal",
        createdAt: now,
      },
    ],
    approvals: [],
  };
}

function createDealsModuleStub() {
  return {
    deals: {
      queries: {
        findWorkflowById: vi.fn(),
        list: vi.fn(),
        findById: vi.fn(),
        listCalculationHistory: vi.fn(),
      },
      commands: {
        appendTimelineEvent: vi.fn(),
        acceptQuote: vi.fn(),
        assignAgent: vi.fn(),
        createDraft: vi.fn(),
        linkCalculation: vi.fn(),
        transitionStatus: vi.fn(),
        updateAgreement: vi.fn(),
        updateComment: vi.fn(),
        updateLegState: vi.fn(),
      },
    },
  };
}

function createWorkflowProjection() {
  const now = new Date("2026-03-30T00:00:00.000Z");

  return {
    acceptedQuote: null,
    attachmentIngestions: [],
    executionPlan: [
      createExecutionLeg(1, "collect", "ready"),
      createExecutionLeg(2, "payout", "pending"),
    ],
    fundingResolution: {
      availableMinor: null,
      fundingOrganizationId: null,
      fundingRequisiteId: null,
      reasonCode: "no_convert_leg",
      requiredAmountMinor: null,
      state: "not_applicable" as const,
      strategy: null,
      targetCurrency: null,
      targetCurrencyId: null,
    },
    intake: {
      common: {
        applicantCounterpartyId: "00000000-0000-4000-8000-000000000004",
        customerNote: "Draft payment deal",
        requestedExecutionDate: now,
      },
      externalBeneficiary: {
        bankInstructionSnapshot: null,
        beneficiaryCounterpartyId: "00000000-0000-4000-8000-000000000005",
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
        purpose: "Supplier payment",
        sourceAmount: "100.00",
        sourceCurrencyId: "00000000-0000-4000-8000-000000000006",
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
      positions: [],
    },
    participants: [
      {
        counterpartyId: null,
        customerId: "00000000-0000-4000-8000-000000000001",
        displayName: "Customer",
        id: "00000000-0000-4000-8000-000000000021",
        organizationId: null,
        role: "customer" as const,
      },
    ],
    relatedResources: {
      attachments: [],
      calculations: [],
      formalDocuments: [],
      quotes: [],
    },
    revision: 1,
    sectionCompleteness: [],
    summary: {
      agreementId: "00000000-0000-4000-8000-000000000002",
      agentId: null,
      calculationId: null,
      createdAt: now,
      id: "00000000-0000-4000-8000-000000000010",
      status: "draft" as const,
      type: "payment" as const,
      updatedAt: now,
    },
    timeline: [],
    transitionReadiness: [
      {
        allowed: false,
        blockers: [
          {
            code: "intake_incomplete",
            message: "Required intake sections are incomplete",
          },
        ],
        targetStatus: "submitted" as const,
      },
    ],
  };
}

function createFinanceQueueProjection() {
  return {
    counts: {
      execution: 1,
      failed_instruction: 0,
      funding: 0,
    },
    filters: {
      queue: "execution",
      stage: "awaiting_reconciliation",
    },
    items: [
      {
        applicantName: "ООО Ромашка",
        blockingReasons: [],
        createdAt: new Date("2026-04-03T09:00:00.000Z"),
        dealId: "00000000-0000-4000-8000-000000000010",
        documentSummary: {
          attachmentCount: 1,
          formalDocumentCount: 1,
        },
        executionSummary: {
          blockedLegCount: 0,
          doneLegCount: 2,
          totalLegCount: 2,
        },
        internalEntityName: "Multihansa",
        nextAction: "Close deal",
        operationalState: {
          positions: [],
        },
        profitabilitySnapshot: {
          calculationId: "calc-1",
          feeRevenue: [
            {
              amountMinor: "1000",
              currencyCode: "RUB",
              currencyId: "00000000-0000-4000-8000-000000000006",
            },
          ],
          providerFeeExpense: [
            {
              amountMinor: "250",
              currencyCode: "RUB",
              currencyId: "00000000-0000-4000-8000-000000000006",
            },
          ],
          spreadRevenue: [
            {
              amountMinor: "500",
              currencyCode: "RUB",
              currencyId: "00000000-0000-4000-8000-000000000006",
            },
          ],
          totalRevenue: [
            {
              amountMinor: "1500",
              currencyCode: "RUB",
              currencyId: "00000000-0000-4000-8000-000000000006",
            },
          ],
        },
        queue: "execution",
        queueReason: "Сделка ожидает исполнения",
        quoteSummary: null,
        stage: "awaiting_reconciliation",
        stageReason: "Ожидаем завершение сверки",
        status: "closing_documents",
        type: "payment",
      },
    ],
  } as const;
}

function createFinanceWorkspaceProjection() {
  return {
    acceptedQuote: null,
    acceptedQuoteDetails: null,
    actions: {
      canCloseDeal: false,
      canCreateCalculation: false,
      canCreateQuote: false,
      canRequestExecution: false,
      canRunReconciliation: true,
      canResolveExecutionBlocker: false,
      canUploadAttachment: true,
    },
    attachmentRequirements: [],
    closeReadiness: {
      blockers: ["Сверка еще не завершена по всем операциям"],
      criteria: [
        {
          code: "reconciliation_clear",
          label: "Сверка завершена без открытых исключений",
          satisfied: false,
        },
      ],
      ready: false,
    },
    executionPlan: [
      {
        actions: {
          canCreateLegOperation: false,
        },
        id: "leg-1",
        idx: 1,
        kind: "payout",
        operationRefs: [
          {
            kind: "payout",
            operationId: "operation-1",
            sourceRef: "deal:deal-1:leg:1:payout:1",
          },
        ],
        state: "done",
      },
    ],
    formalDocumentRequirements: [],
    instructionSummary: {
      failed: 0,
      planned: 0,
      prepared: 0,
      returnRequested: 0,
      returned: 0,
      settled: 1,
      submitted: 0,
      terminalOperations: 1,
      totalOperations: 1,
      voided: 0,
    },
    nextAction: "Close deal",
    operationalState: {
      positions: [],
    },
    pricing: {
      quoteAmount: "100.00",
      quoteAmountSide: "source",
      quoteEligibility: false,
      sourceCurrencyId: "00000000-0000-4000-8000-000000000006",
      targetCurrencyId: null,
    },
    profitabilitySnapshot: {
      calculationId: "calc-1",
      feeRevenue: [
        {
          amountMinor: "1000",
          currencyCode: "RUB",
          currencyId: "00000000-0000-4000-8000-000000000006",
        },
      ],
      providerFeeExpense: [
        {
          amountMinor: "250",
          currencyCode: "RUB",
          currencyId: "00000000-0000-4000-8000-000000000006",
        },
      ],
      spreadRevenue: [
        {
          amountMinor: "500",
          currencyCode: "RUB",
          currencyId: "00000000-0000-4000-8000-000000000006",
        },
      ],
      totalRevenue: [
        {
          amountMinor: "1500",
          currencyCode: "RUB",
          currencyId: "00000000-0000-4000-8000-000000000006",
        },
      ],
    },
    queueContext: {
      blockers: [],
      queue: "execution",
      queueReason: "Сделка ожидает исполнения",
    },
    reconciliationSummary: {
      ignoredExceptionCount: 0,
      lastActivityAt: new Date("2026-04-03T11:00:00.000Z"),
      openExceptionCount: 0,
      pendingOperationCount: 1,
      reconciledOperationCount: 0,
      requiredOperationCount: 1,
      resolvedExceptionCount: 0,
      state: "pending",
    },
    relatedResources: {
      attachments: [],
      formalDocuments: [],
      operations: [],
      quotes: [],
      reconciliationExceptions: [
        {
          actions: {
            adjustmentDocumentDocType: "transfer_resolution",
            canIgnore: true,
          },
          blocking: true,
          createdAt: new Date("2026-04-03T11:00:00.000Z"),
          externalRecordId: "external-1",
          id: "00000000-0000-4000-8000-000000000111",
          operationId: "operation-1",
          reasonCode: "no_match",
          resolvedAt: null,
          source: "bank_statement",
          state: "open",
        },
      ],
    },
    summary: {
      applicantDisplayName: "ООО Ромашка",
      calculationId: "calc-1",
      createdAt: new Date("2026-04-03T09:00:00.000Z"),
      id: "00000000-0000-4000-8000-000000000010",
      internalEntityDisplayName: "Multihansa",
      status: "closing_documents",
      type: "payment",
      updatedAt: new Date("2026-04-03T11:00:00.000Z"),
    },
    timeline: [],
    workflow: createWorkflowProjection(),
  } as const;
}

function createDealPricingRouteCandidate() {
  return {
    createdAt: "2026-04-19T09:00:00.000Z",
    currencyInId: "00000000-0000-4000-8000-000000000006",
    currencyOutId: "00000000-0000-4000-8000-000000000007",
    destinationEndpoint: {
      binding: "abstract",
      displayName: "Beneficiary",
      entityId: null,
      entityKind: null,
      requisiteId: null,
      role: "destination",
    },
    hopCount: 1,
    id: "00000000-0000-4000-8000-000000000301",
    lastCalculation: null,
    name: "RUB via AED to USD",
    snapshotPolicy: "clone_on_attach",
    sourceEndpoint: {
      binding: "abstract",
      displayName: "Client",
      entityId: null,
      entityKind: null,
      requisiteId: null,
      role: "source",
    },
    status: "active",
    updatedAt: "2026-04-19T10:00:00.000Z",
  } as const;
}

function createDealPricingPreview() {
  return {
    benchmarks: {
      client: {
        asOf: "2026-04-19T09:58:00.000Z",
        baseCurrency: "RUB",
        quoteCurrency: "USD",
        rateDen: "79005226",
        rateNum: "101819387",
        sourceKind: "client" as const,
        sourceLabel: "Курс клиенту",
      },
      cost: {
        asOf: "2026-04-19T09:58:00.000Z",
        baseCurrency: "RUB",
        quoteCurrency: "USD",
        rateDen: "79005526",
        rateNum: "101819387",
        sourceKind: "cost" as const,
        sourceLabel: "Курс себестоимости",
      },
      market: {
        asOf: "2026-04-19T09:58:00.000Z",
        baseCurrency: "RUB",
        quoteCurrency: "USD",
        rateDen: "78926300",
        rateNum: "1000000",
        sourceKind: "market" as const,
        sourceLabel: "Рыночный курс",
      },
      pricingBase: "route_benchmark" as const,
      routeBase: {
        asOf: "2026-04-19T09:58:00.000Z",
        baseCurrency: "RUB",
        quoteCurrency: "USD",
        rateDen: "36700",
        rateNum: "47300",
        sourceKind: "route" as const,
        sourceLabel: "Базовый курс маршрута",
      },
    },
    formulaTrace: {
      sections: [
        {
          kind: "client_pricing" as const,
          lines: [
            {
              currency: "USD",
              expression: "790 052.26 RUB / 77.59 = 10 181.94 USD",
              kind: "equation" as const,
              label: "Цена клиенту",
              metadata: {},
              result: "10 181.94 USD",
            },
          ],
          title: "Цена клиенту",
        },
      ],
    },
    fundingSummary: {
      positions: [
        {
          adjustmentTotalMinor: "0",
          currencyCode: "RUB",
          currencyId: "00000000-0000-4000-8000-000000000006",
          netFundingNeedMinor: "79005226",
          requiredMinor: "79005226",
        },
      ],
    },
    pricingMode: "explicit_route" as const,
    profitability: {
      commercialRevenueMinor: "197513",
      costPriceMinor: "79005526",
      currency: "RUB",
      customerPrincipalMinor: "79005226",
      customerTotalMinor: "79005376",
      passThroughMinor: "150",
      profitMinor: "197213",
      profitPercentOnCost: "0.25",
    },
    quotePreview: {
      commercialTerms: {
        agreementFeeBps: 125n,
        agreementVersionId: "agreement-version-1",
        fixedFeeAmountMinor: 1500n,
        fixedFeeCurrency: "USD",
        quoteMarkupBps: 25n,
        totalFeeBps: 150n,
      },
      dealDirection: null,
      dealForm: null,
      expiresAt: new Date("2026-04-19T10:58:00.000Z"),
      feeComponents: [],
      financialLines: [
        {
          amountMinor: 300n,
          bucket: "provider_fee_expense",
          currency: "RUB",
          source: "manual",
        },
      ],
      fromAmountMinor: 79005226n,
      fromCurrency: "RUB",
      legs: [],
      pricingMode: "explicit_route" as const,
      pricingTrace: {},
      rateDen: 79005226n,
      rateNum: 101819387n,
      toAmountMinor: 101819387n,
      toCurrency: "USD",
    },
    routePreview: {
      additionalFees: [],
      amountInMinor: "79005226",
      amountOutMinor: "101819387",
      chargedFeeTotals: [],
      cleanAmountOutMinor: "101819387",
      clientTotalInMinor: "79005226",
      computedAt: "2026-04-19T09:58:00.000Z",
      costPriceInMinor: "79005526",
      currencyInId: "00000000-0000-4000-8000-000000000006",
      currencyOutId: "00000000-0000-4000-8000-000000000007",
      feeTotals: [
        {
          amountMinor: "300",
          currencyId: "00000000-0000-4000-8000-000000000006",
        },
      ],
      grossAmountOutMinor: "101819387",
      internalFeeTotals: [
        {
          amountMinor: "300",
          currencyId: "00000000-0000-4000-8000-000000000006",
        },
      ],
      legs: [],
      lockedSide: "currency_in" as const,
      netAmountOutMinor: "101819387",
    },
  };
}

function createDealPricingQuoteResult() {
  return {
    benchmarks: createDealPricingPreview().benchmarks,
    formulaTrace: createDealPricingPreview().formulaTrace,
    pricingMode: "explicit_route" as const,
    profitability: createDealPricingPreview().profitability,
    quote: {
      benchmarks: createDealPricingPreview().benchmarks,
      commercialTerms: {
        agreementFeeBps: 125n,
        agreementVersionId: "agreement-version-1",
        fixedFeeAmountMinor: 1500n,
        fixedFeeCurrency: "USD",
        quoteMarkupBps: 25n,
        totalFeeBps: 150n,
      },
      createdAt: new Date("2026-04-19T09:58:00.000Z"),
      dealDirection: null,
      dealForm: null,
      dealId: "00000000-0000-4000-8000-000000000010",
      expiresAt: new Date("2026-04-19T10:58:00.000Z"),
      fromAmountMinor: 79005226n,
      fromCurrency: "RUB",
      fromCurrencyId: "00000000-0000-4000-8000-000000000006",
      id: "00000000-0000-4000-8000-000000000302",
      idempotencyKey: "pricing-quote-1",
      formulaTrace: createDealPricingPreview().formulaTrace,
      pricingMode: "explicit_route" as const,
      pricingTrace: {},
      profitability: createDealPricingPreview().profitability,
      rateDen: 79005226n,
      rateNum: 101819387n,
      status: "active" as const,
      toAmountMinor: 101819387n,
      toCurrency: "USD",
      toCurrencyId: "00000000-0000-4000-8000-000000000007",
      usedAt: null,
      usedByRef: null,
      usedDocumentId: null,
    },
  };
}

function createTestApp() {
  const dealsModule = createDealsModuleStub();
  const agreementsModule = {
    agreements: {
      queries: {
        findById: vi.fn(),
      },
    },
  };
  const dealProjectionsWorkflow = {
    getCrmDealsStats: vi.fn(),
    getCrmDealWorkbenchProjection: vi.fn(),
    getFinanceDealWorkspaceProjection: vi.fn(),
    listCrmDeals: vi.fn(),
    listCrmDealBoard: vi.fn(),
    listCrmDealsByDay: vi.fn(),
    listCrmDealsByStatus: vi.fn(),
    listFinanceDealQueues: vi.fn(),
  };
  const dealQuoteWorkflow = {
    createCalculationFromAcceptedQuote: vi.fn(),
  };
  const dealPricingWorkflow = {
    attachRoute: vi.fn(),
    createQuote: vi.fn(),
    detachRoute: vi.fn(),
    listRoutes: vi.fn(),
    preview: vi.fn(),
    updateContext: vi.fn(),
  };
  const dealExecutionWorkflow = {
    closeDeal: vi.fn(),
    createLegOperation: vi.fn(),
    requestExecution: vi.fn(),
    resolveExecutionBlocker: vi.fn(),
  };
  const treasuryModule = {
    quotes: {
      commands: {
        createQuote: vi.fn(),
      },
      queries: {
        listQuotes: vi.fn(),
        previewQuote: vi.fn(),
        getQuoteDetails: vi.fn(),
      },
    },
  };
  const calculationsModule = {
    calculations: {
      queries: {
        findById: vi.fn(),
      },
      commands: {
        create: vi.fn(),
      },
    },
  };
  const partiesModule = {
    customers: {
      queries: {
        findById: vi.fn(),
      },
    },
  };
  const currenciesService = {
    findByCode: vi.fn(),
    findById: vi.fn(),
  };
  const iamService = {
    queries: {
      findById: vi.fn(),
    },
  };
  const reconciliationService = {
    exceptions: {
      ignore: vi.fn(),
      resolveWithAdjustment: vi.fn(),
    },
    runs: {
      runReconciliation: vi.fn(),
    },
  };
  const documentsService = {
    get: vi.fn(),
  };
  const persistence = {
    db: {
      execute: vi.fn(async () => ({ rows: [] })),
    },
  };
  const app = new OpenAPIHono();

  app.use("*", async (c, next) => {
    c.set("user", { id: "user-1" } as any);
    c.set("requestContext", {
      requestId: "req-1",
      correlationId: "corr-1",
      traceId: null,
      causationId: null,
      idempotencyKey: c.req.header("idempotency-key") ?? null,
    });
    await next();
  });

  app.route(
    "/deals",
    dealsRoutes({
      dealProjectionsWorkflow,
      dealExecutionWorkflow,
      dealPricingWorkflow,
      dealQuoteWorkflow,
      dealsModule,
      agreementsModule,
      iamService,
      treasuryModule,
      calculationsModule,
      partiesModule,
      currenciesService,
      reconciliationService,
      documentsService,
      persistence,
    } as any),
  );

  return {
    app,
    dealProjectionsWorkflow,
    dealExecutionWorkflow,
    dealPricingWorkflow,
    dealQuoteWorkflow,
    dealsModule,
    agreementsModule,
    treasuryModule,
    calculationsModule,
    iamService,
    partiesModule,
    currenciesService,
    reconciliationService,
    documentsService,
    persistence,
  };
}

describe("deals routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userHasPermission.mockResolvedValue({ success: true });
  });

  it("lists and fetches canonical deals", async () => {
    const {
      app,
      dealProjectionsWorkflow,
      dealsModule,
    } = createTestApp();
    const detail = createDealDetail();
    dealProjectionsWorkflow.listCrmDeals.mockResolvedValue({
      data: [
        {
          agentName: "Agent Smith",
          amount: 100,
          amountInBase: 90,
          baseCurrencyCode: "RUB",
          client: "Customer One",
          clientId: detail.customerId,
          closedAt: null,
          comment: detail.comment,
          createdAt: detail.createdAt.toISOString(),
          currency: "USD",
          feePercentage: 1.5,
          id: detail.id,
          status: detail.status,
          updatedAt: detail.updatedAt.toISOString(),
        },
      ],
      total: 1,
      limit: 20,
      offset: 0,
    });
    dealsModule.deals.queries.findById.mockResolvedValue(detail);

    const listResponse = await app.request("http://localhost/deals");
    const getResponse = await app.request(
      `http://localhost/deals/${detail.id}`,
    );

    expect(listResponse.status).toBe(200);
    expect(getResponse.status).toBe(200);

    expect(dealProjectionsWorkflow.listCrmDeals).toHaveBeenCalledWith({
      limit: 20,
      offset: 0,
      sortBy: "createdAt",
      sortOrder: "desc",
    });
    await expect(listResponse.json()).resolves.toMatchObject({
      data: [
        expect.objectContaining({
          id: detail.id,
          client: "Customer One",
          currency: "USD",
          amount: 100,
          amountInBase: 90,
          baseCurrencyCode: "RUB",
          feePercentage: 1.5,
          agentName: "Agent Smith",
        }),
      ],
      total: 1,
    });
    expect(dealsModule.deals.queries.findById).toHaveBeenCalledWith(detail.id);
  });

  it("updates the root deal comment", async () => {
    const { app, dealsModule } = createTestApp();
    const detail = createDealDetail();
    dealsModule.deals.commands.updateComment.mockResolvedValue({
      ...detail,
      comment: "Updated comment",
    });

    const response = await app.request(
      `http://localhost/deals/${detail.id}/comment`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          comment: "  Updated comment  ",
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(dealsModule.deals.commands.updateComment).toHaveBeenCalledWith({
      comment: "Updated comment",
      dealId: detail.id,
    });
  });

  it("creates a typed draft deal for CRM origination", async () => {
    const { app, dealsModule } = createTestApp();
    const projection = createWorkflowProjection();
    dealsModule.deals.commands.createDraft.mockResolvedValue(projection);

    const response = await app.request("http://localhost/deals/drafts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "deal-draft-1",
      },
      body: JSON.stringify({
        agreementId: "00000000-0000-4000-8000-000000000002",
        customerId: "00000000-0000-4000-8000-000000000001",
        intake: {
          ...projection.intake,
          common: {
            ...projection.intake.common,
            requestedExecutionDate: "2026-03-30T00:00:00.000Z",
          },
        },
      }),
    });

    expect(response.status).toBe(201);
    expect(dealsModule.deals.commands.createDraft).toHaveBeenCalledWith({
      actorUserId: "user-1",
      agreementId: "00000000-0000-4000-8000-000000000002",
      customerId: "00000000-0000-4000-8000-000000000001",
      idempotencyKey: "deal-draft-1",
      intake: {
        ...projection.intake,
        common: {
          ...projection.intake.common,
          requestedExecutionDate: new Date("2026-03-30T00:00:00.000Z"),
        },
      },
    });
  });

  it("returns the CRM board projection", async () => {
    const { app, dealProjectionsWorkflow } = createTestApp();
    dealProjectionsWorkflow.listCrmDealBoard.mockResolvedValue({
      counts: {
        active: 1,
        documents: 2,
        drafts: 3,
        execution_blocked: 4,
        pricing: 5,
      },
      items: [],
    });

    const response = await app.request("http://localhost/deals/crm-board");

    expect(response.status).toBe(200);
    expect(dealProjectionsWorkflow.listCrmDealBoard).toHaveBeenCalledOnce();
  });

  it("creates a deal quote with markup and fixed fee overrides", async () => {
    const {
      app,
      agreementsModule,
      dealsModule,
      treasuryModule,
    } = createTestApp();

    dealsModule.deals.queries.findById.mockResolvedValue({
      ...createDealDetail(),
      status: "submitted",
    });
    agreementsModule.agreements.queries.findById.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000002",
      customerId: "00000000-0000-4000-8000-000000000001",
      organizationId: "00000000-0000-4000-8000-000000000020",
      organizationRequisiteId: "00000000-0000-4000-8000-000000000021",
      isActive: true,
      createdAt: new Date("2026-03-30T00:00:00.000Z"),
      updatedAt: new Date("2026-03-30T00:00:00.000Z"),
      currentVersion: {
        id: "00000000-0000-4000-8000-000000000099",
        versionNumber: 1,
        contractNumber: null,
        contractDate: null,
        createdAt: new Date("2026-03-30T00:00:00.000Z"),
        updatedAt: new Date("2026-03-30T00:00:00.000Z"),
        parties: [],
        feeRules: [
          {
            id: "00000000-0000-4000-8000-000000000201",
            kind: "agent_fee",
            value: "125",
            currencyCode: null,
          },
        ],
      },
    });
    treasuryModule.quotes.commands.createQuote.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000210",
      fromCurrencyId: "currency-rub",
      toCurrencyId: "currency-usd",
      fromCurrency: "RUB",
      toCurrency: "USD",
      fromAmountMinor: 100000n,
      toAmountMinor: 1100n,
      pricingMode: "auto_cross",
      pricingTrace: {},
      commercialTerms: {
        agreementVersionId: "00000000-0000-4000-8000-000000000099",
        agreementFeeBps: 125n,
        quoteMarkupBps: 50n,
        totalFeeBps: 175n,
        fixedFeeAmountMinor: 1500n,
        fixedFeeCurrency: "USD",
      },
      dealDirection: null,
      dealForm: null,
      rateNum: 11n,
      rateDen: 1000n,
      status: "active",
      dealId: "00000000-0000-4000-8000-000000000010",
      usedByRef: null,
      usedDocumentId: null,
      usedAt: null,
      expiresAt: new Date("2026-03-30T01:00:00.000Z"),
      idempotencyKey: "quote-create-1",
      createdAt: new Date("2026-03-30T00:00:00.000Z"),
    });

    const response = await app.request(
      "http://localhost/deals/00000000-0000-4000-8000-000000000010/quotes",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": "quote-create-1",
        },
        body: JSON.stringify({
          mode: "auto_cross",
          fromAmountMinor: "100000",
          fromCurrency: "RUB",
          toCurrency: "USD",
          asOf: "2026-03-30T00:00:00.000Z",
          quoteMarkupBps: 50,
          fixedFeeAmount: "15.00",
          fixedFeeCurrency: "USD",
        }),
      },
    );

    expect(response.status).toBe(201);
    expect(treasuryModule.quotes.commands.createQuote).toHaveBeenCalledWith(
      expect.objectContaining({
        commercialTerms: expect.objectContaining({
          agreementVersionId: "00000000-0000-4000-8000-000000000099",
          agreementFeeBps: "125",
          quoteMarkupBps: "50",
          fixedFeeAmount: "15.00",
          fixedFeeCurrency: "USD",
        }),
        dealId: "00000000-0000-4000-8000-000000000010",
        idempotencyKey: "quote-create-1",
      }),
    );
  });

  it("previews a deal quote with commercial terms before creation", async () => {
    const {
      app,
      agreementsModule,
      dealsModule,
      treasuryModule,
    } = createTestApp();

    dealsModule.deals.queries.findById.mockResolvedValue({
      ...createDealDetail(),
      status: "submitted",
    });
    agreementsModule.agreements.queries.findById.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000002",
      customerId: "00000000-0000-4000-8000-000000000001",
      organizationId: "00000000-0000-4000-8000-000000000020",
      organizationRequisiteId: "00000000-0000-4000-8000-000000000021",
      isActive: true,
      createdAt: new Date("2026-03-30T00:00:00.000Z"),
      updatedAt: new Date("2026-03-30T00:00:00.000Z"),
      currentVersion: {
        id: "00000000-0000-4000-8000-000000000099",
        versionNumber: 1,
        contractNumber: null,
        contractDate: null,
        createdAt: new Date("2026-03-30T00:00:00.000Z"),
        updatedAt: new Date("2026-03-30T00:00:00.000Z"),
        parties: [],
        feeRules: [],
      },
    });
    treasuryModule.quotes.queries.previewQuote.mockResolvedValue({
      fromCurrency: "RUB",
      toCurrency: "USD",
      fromAmountMinor: 100000n,
      toAmountMinor: 1100n,
      pricingMode: "auto_cross",
      pricingTrace: {},
      commercialTerms: {
        agreementVersionId: "00000000-0000-4000-8000-000000000099",
        agreementFeeBps: 0n,
        quoteMarkupBps: 50n,
        totalFeeBps: 50n,
        fixedFeeAmountMinor: 2500n,
        fixedFeeCurrency: "USD",
      },
      dealDirection: null,
      dealForm: null,
      rateNum: 11n,
      rateDen: 1000n,
      expiresAt: new Date("2026-03-30T01:00:00.000Z"),
      legs: [],
      feeComponents: [],
      financialLines: [],
    });

    const response = await app.request(
      "http://localhost/deals/00000000-0000-4000-8000-000000000010/quotes/preview",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          mode: "auto_cross",
          fromAmountMinor: "100000",
          fromCurrency: "RUB",
          toCurrency: "USD",
          asOf: "2026-03-30T00:00:00.000Z",
          quoteMarkupBps: 50,
          fixedFeeAmount: "25.00",
          fixedFeeCurrency: "USD",
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(treasuryModule.quotes.queries.previewQuote).toHaveBeenCalledWith(
      expect.objectContaining({
        commercialTerms: expect.objectContaining({
          quoteMarkupBps: "50",
          fixedFeeAmount: "25.00",
          fixedFeeCurrency: "USD",
        }),
      }),
    );
  });

  it("lists recommended payment routes for deal pricing", async () => {
    const { app, dealPricingWorkflow } = createTestApp();
    dealPricingWorkflow.listRoutes.mockResolvedValue([
      createDealPricingRouteCandidate(),
    ]);

    const response = await app.request(
      "http://localhost/deals/00000000-0000-4000-8000-000000000010/pricing/routes",
    );

    expect(response.status).toBe(200);
    expect(dealPricingWorkflow.listRoutes).toHaveBeenCalledWith({
      dealId: "00000000-0000-4000-8000-000000000010",
    });
    await expect(response.json()).resolves.toMatchObject([
      {
        id: "00000000-0000-4000-8000-000000000301",
        name: "RUB via AED to USD",
      },
    ]);
  });

  it("previews deal pricing through the route pricing workflow", async () => {
    const { app, dealPricingWorkflow } = createTestApp();
    dealPricingWorkflow.preview.mockResolvedValue(createDealPricingPreview());

    const response = await app.request(
      "http://localhost/deals/00000000-0000-4000-8000-000000000010/pricing/preview",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          amountMinor: "79005226",
          amountSide: "source",
          asOf: "2026-04-19T09:58:00.000Z",
          expectedRevision: 3,
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(dealPricingWorkflow.preview).toHaveBeenCalledWith({
      amountMinor: "79005226",
      amountSide: "source",
      asOf: new Date("2026-04-19T09:58:00.000Z"),
      dealId: "00000000-0000-4000-8000-000000000010",
      expectedRevision: 3,
    });
    await expect(response.json()).resolves.toMatchObject({
      fundingSummary: {
        positions: [
          {
            currencyCode: "RUB",
            netFundingNeedMinor: "79005226",
          },
        ],
      },
      pricingMode: "explicit_route",
      quotePreview: {
        financialLines: [
          {
            amountMinor: "300",
            bucket: "provider_fee_expense",
          },
        ],
      },
    });
  });

  it("creates a deal pricing quote and appends a timeline event", async () => {
    const { app, dealPricingWorkflow, dealsModule } = createTestApp();
    dealPricingWorkflow.createQuote.mockResolvedValue(
      createDealPricingQuoteResult(),
    );

    const response = await app.request(
      "http://localhost/deals/00000000-0000-4000-8000-000000000010/pricing/quotes",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": "pricing-quote-1",
        },
        body: JSON.stringify({
          amountMinor: "79005226",
          amountSide: "source",
          asOf: "2026-04-19T09:58:00.000Z",
          expectedRevision: 3,
        }),
      },
    );

    expect(response.status).toBe(201);
    expect(dealPricingWorkflow.createQuote).toHaveBeenCalledWith({
      amountMinor: "79005226",
      amountSide: "source",
      asOf: new Date("2026-04-19T09:58:00.000Z"),
      dealId: "00000000-0000-4000-8000-000000000010",
      expectedRevision: 3,
      idempotencyKey: "pricing-quote-1",
    });
    expect(dealsModule.deals.commands.appendTimelineEvent).toHaveBeenCalledWith({
      actorUserId: "user-1",
      dealId: "00000000-0000-4000-8000-000000000010",
      payload: {
        expiresAt: new Date("2026-04-19T10:58:00.000Z"),
        pricingMode: "explicit_route",
        quoteId: "00000000-0000-4000-8000-000000000302",
      },
      sourceRef: "quote:00000000-0000-4000-8000-000000000302:created",
      type: "quote_created",
      visibility: "internal",
    });
    await expect(response.json()).resolves.toMatchObject({
      pricingMode: "explicit_route",
      quote: {
        id: "00000000-0000-4000-8000-000000000302",
      },
    });
  });

  it("returns 409 for stale pricing context updates", async () => {
    const { app, dealPricingWorkflow } = createTestApp();
    dealPricingWorkflow.updateContext.mockRejectedValue(
      new DealPricingContextRevisionConflictError(
        "00000000-0000-4000-8000-000000000010",
        3,
      ),
    );

    const response = await app.request(
      "http://localhost/deals/00000000-0000-4000-8000-000000000010/pricing/context",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          commercialDraft: {
            quoteMarkupBps: 25,
          },
          expectedRevision: 3,
        }),
      },
    );

    expect(response.status).toBe(409);
  });

  it("normalizes decimal agreement fee bps before previewing a deal quote", async () => {
    const {
      app,
      agreementsModule,
      dealsModule,
      treasuryModule,
    } = createTestApp();

    dealsModule.deals.queries.findById.mockResolvedValue({
      ...createDealDetail(),
      status: "submitted",
    });
    agreementsModule.agreements.queries.findById.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000002",
      customerId: "00000000-0000-4000-8000-000000000001",
      organizationId: "00000000-0000-4000-8000-000000000020",
      organizationRequisiteId: "00000000-0000-4000-8000-000000000021",
      isActive: true,
      createdAt: new Date("2026-03-30T00:00:00.000Z"),
      updatedAt: new Date("2026-03-30T00:00:00.000Z"),
      currentVersion: {
        id: "00000000-0000-4000-8000-000000000099",
        versionNumber: 1,
        contractNumber: null,
        contractDate: null,
        createdAt: new Date("2026-03-30T00:00:00.000Z"),
        updatedAt: new Date("2026-03-30T00:00:00.000Z"),
        parties: [],
        feeRules: [
          {
            id: "00000000-0000-4000-8000-000000000201",
            kind: "agent_fee",
            value: "100.00000000",
            currencyCode: null,
          },
        ],
      },
    });
    treasuryModule.quotes.queries.previewQuote.mockResolvedValue({
      fromCurrency: "RUB",
      toCurrency: "USD",
      fromAmountMinor: 100000n,
      toAmountMinor: 1100n,
      pricingMode: "auto_cross",
      pricingTrace: {},
      commercialTerms: {
        agreementVersionId: "00000000-0000-4000-8000-000000000099",
        agreementFeeBps: 100n,
        quoteMarkupBps: 0n,
        totalFeeBps: 100n,
        fixedFeeAmountMinor: null,
        fixedFeeCurrency: null,
      },
      dealDirection: null,
      dealForm: null,
      rateNum: 11n,
      rateDen: 1000n,
      expiresAt: new Date("2026-03-30T01:00:00.000Z"),
      legs: [],
      feeComponents: [],
      financialLines: [],
    });

    const response = await app.request(
      "http://localhost/deals/00000000-0000-4000-8000-000000000010/quotes/preview",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          mode: "auto_cross",
          fromAmountMinor: "100000",
          fromCurrency: "RUB",
          toCurrency: "USD",
          asOf: "2026-03-30T00:00:00.000Z",
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(treasuryModule.quotes.queries.previewQuote).toHaveBeenCalledWith(
      expect.objectContaining({
        commercialTerms: expect.objectContaining({
          agreementVersionId: "00000000-0000-4000-8000-000000000099",
          agreementFeeBps: "100",
          quoteMarkupBps: "0",
        }),
      }),
    );
  });

  it("delegates CRM deals list projections to the workflow", async () => {
    const { app, dealProjectionsWorkflow } = createTestApp();
    dealProjectionsWorkflow.listCrmDeals.mockResolvedValue({
      data: [],
      limit: 20,
      offset: 0,
      total: 0,
    });

    const response = await app.request(
      "http://localhost/deals?sortBy=createdAt&sortOrder=desc&limit=20&offset=0",
    );

    expect(response.status).toBe(200);
    expect(dealProjectionsWorkflow.listCrmDeals).toHaveBeenCalledWith({
      limit: 20,
      offset: 0,
      sortBy: "createdAt",
      sortOrder: "desc",
    });
  });

  it("delegates CRM stats and bucketed projections to the workflow", async () => {
    const { app, dealProjectionsWorkflow } = createTestApp();
    dealProjectionsWorkflow.getCrmDealsStats.mockResolvedValue({
      byStatus: { draft: 1 },
      totalAmount: "10000",
      totalCount: 1,
    });
    dealProjectionsWorkflow.listCrmDealsByStatus.mockResolvedValue({
      done: [],
      inProgress: [],
      pending: [],
    });
    dealProjectionsWorkflow.listCrmDealsByDay.mockResolvedValue([
      {
        amount: 100,
        closedAmount: 0,
        closedCount: 0,
        count: 1,
        date: "2026-03-30",
        RUB: 100,
      },
    ]);

    const [statsResponse, byStatusResponse, byDayResponse] = await Promise.all([
      app.request("http://localhost/deals/stats?dateFrom=2026-03-01&dateTo=2026-03-31"),
      app.request("http://localhost/deals/by-status"),
      app.request("http://localhost/deals/by-day?dateFrom=2026-03-01"),
    ]);

    expect(statsResponse.status).toBe(200);
    expect(byStatusResponse.status).toBe(200);
    expect(byDayResponse.status).toBe(200);
    expect(dealProjectionsWorkflow.getCrmDealsStats).toHaveBeenCalledWith({
      dateFrom: "2026-03-01",
      dateTo: "2026-03-31",
    });
    expect(dealProjectionsWorkflow.listCrmDealsByStatus).toHaveBeenCalledOnce();
    expect(dealProjectionsWorkflow.listCrmDealsByDay).toHaveBeenCalledWith({
      dateFrom: "2026-03-01",
    });
  });

  it("returns 404 when a deal is missing", async () => {
    const { app, dealsModule } = createTestApp();
    dealsModule.deals.queries.findById.mockRejectedValue(
      new DealNotFoundError("00000000-0000-4000-8000-000000000099"),
    );

    const response = await app.request(
      "http://localhost/deals/00000000-0000-4000-8000-000000000099",
    );

    expect(response.status).toBe(404);
  });

  it("lists calculation history for a deal", async () => {
    const { app, dealsModule } = createTestApp();
    const detail = createDealDetail();
    dealsModule.deals.queries.findById.mockResolvedValue(detail);
    dealsModule.deals.queries.listCalculationHistory.mockResolvedValue([
      {
        calculationId: detail.calculationId,
        calculationTimestamp: detail.createdAt,
        createdAt: detail.createdAt,
        calculationCurrencyId: "00000000-0000-4000-8000-000000000101",
        baseCurrencyId: "00000000-0000-4000-8000-000000000102",
        originalAmountMinor: "10000",
        totalFeeAmountMinor: "100",
        totalAmountMinor: "10100",
        totalInBaseMinor: "9000",
        totalWithExpensesInBaseMinor: "9100",
        rateNum: "9",
        rateDen: "10",
        fxQuoteId: "00000000-0000-4000-8000-000000000201",
        sourceQuoteId: "00000000-0000-4000-8000-000000000201",
      },
    ]);

    const response = await app.request(
      `http://localhost/deals/${detail.id}/calculations`,
    );

    expect(response.status).toBe(200);
    expect(
      dealsModule.deals.queries.listCalculationHistory,
    ).toHaveBeenCalledWith(detail.id);
  });

  it("does not expose the legacy attach calculation route", async () => {
    const { app } = createTestApp();

    const response = await app.request(
      "http://localhost/deals/00000000-0000-4000-8000-000000000010/calculation",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          calculationId: "00000000-0000-4000-8000-000000000011",
        }),
      },
    );

    expect(response.status).toBe(404);
  });

  it("accepts a quote for a deal", async () => {
    const { app, dealsModule } = createTestApp();
    const projection = {
      summary: { id: "00000000-0000-4000-8000-000000000010" },
    };
    dealsModule.deals.commands.acceptQuote.mockResolvedValue(projection);

    const response = await app.request(
      "http://localhost/deals/00000000-0000-4000-8000-000000000010/quotes/00000000-0000-4000-8000-000000000210/accept",
      {
        method: "POST",
      },
    );

    expect(response.status).toBe(200);
    expect(dealsModule.deals.commands.acceptQuote).toHaveBeenCalledWith({
      actorUserId: "user-1",
      dealId: "00000000-0000-4000-8000-000000000010",
      quoteId: "00000000-0000-4000-8000-000000000210",
    });
  });

  it("updates the draft agreement on the workbench", async () => {
    const { app, dealsModule } = createTestApp();
    const projection = createWorkflowProjection();
    dealsModule.deals.commands.updateAgreement.mockResolvedValue(projection);

    const response = await app.request(
      "http://localhost/deals/00000000-0000-4000-8000-000000000010/agreement",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          agreementId: "00000000-0000-4000-8000-000000000099",
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(dealsModule.deals.commands.updateAgreement).toHaveBeenCalledWith({
      actorUserId: "user-1",
      agreementId: "00000000-0000-4000-8000-000000000099",
      id: "00000000-0000-4000-8000-000000000010",
    });
  });

  it("reassigns the deal assignee from CRM", async () => {
    const { app, dealsModule } = createTestApp();
    const projection = createWorkflowProjection();
    dealsModule.deals.commands.assignAgent.mockResolvedValue(projection);

    const response = await app.request(
      "http://localhost/deals/00000000-0000-4000-8000-000000000010/assignee",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          agentId: "agent-42",
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(dealsModule.deals.commands.assignAgent).toHaveBeenCalledWith({
      actorUserId: "user-1",
      agentId: "agent-42",
      id: "00000000-0000-4000-8000-000000000010",
    });
  });

  it("creates a calculation from the accepted quote via the workflow", async () => {
    const { app, dealQuoteWorkflow, dealsModule } = createTestApp();
    const detail = {
      ...createDealDetail(),
      status: "submitted" as const,
      calculationId: null,
    };
    dealsModule.deals.queries.findById.mockResolvedValue(detail);
    dealQuoteWorkflow.createCalculationFromAcceptedQuote.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000501",
      isActive: true,
      currentSnapshot: {
        id: "00000000-0000-4000-8000-000000000502",
        snapshotNumber: 1,
        agreementVersionId: null,
        agreementFeeBps: "10000",
        agreementFeeAmountMinor: "100",
        calculationCurrencyId: "00000000-0000-4000-8000-000000000301",
        originalAmountMinor: "10000",
        totalFeeBps: "10000",
        totalFeeAmountMinor: "100",
        totalAmountMinor: "10100",
        baseCurrencyId: "00000000-0000-4000-8000-000000000302",
        totalFeeAmountInBaseMinor: "90",
        totalInBaseMinor: "9000",
        additionalExpensesCurrencyId: "00000000-0000-4000-8000-000000000302",
        additionalExpensesAmountMinor: "50",
        additionalExpensesInBaseMinor: "50",
        fixedFeeAmountMinor: "0",
        fixedFeeCurrencyId: null,
        pricingProvenance: null,
        quoteMarkupAmountMinor: "0",
        quoteMarkupBps: "0",
        referenceRateAsOf: null,
        referenceRateSource: null,
        referenceRateNum: null,
        referenceRateDen: null,
        totalWithExpensesInBaseMinor: "9140",
        rateSource: "fx_quote",
        rateNum: "9",
        rateDen: "10",
        additionalExpensesRateSource: null,
        additionalExpensesRateNum: null,
        additionalExpensesRateDen: null,
        calculationTimestamp: new Date("2026-04-01T00:00:00.000Z"),
        fxQuoteId: "00000000-0000-4000-8000-000000000210",
        quoteSnapshot: null,
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
        updatedAt: new Date("2026-04-01T00:00:00.000Z"),
      },
      createdAt: new Date("2026-04-01T00:00:00.000Z"),
      updatedAt: new Date("2026-04-01T00:00:00.000Z"),
      lines: [],
    });

    const response = await app.request(
      `http://localhost/deals/${detail.id}/calculations/from-quote`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": "from-quote-1",
        },
        body: JSON.stringify({
          quoteId: "00000000-0000-4000-8000-000000000210",
        }),
      },
    );

    expect(response.status).toBe(201);
    expect(
      dealQuoteWorkflow.createCalculationFromAcceptedQuote,
    ).toHaveBeenCalledWith({
      actorUserId: "user-1",
      dealId: detail.id,
      idempotencyKey: "from-quote-1",
      quoteId: "00000000-0000-4000-8000-000000000210",
    });
  });

  it("imports a historical calculation and links it directly to the deal", async () => {
    const { app, calculationsModule, dealsModule } = createTestApp();
    const detail = createDealDetail();
    dealsModule.deals.queries.findById.mockResolvedValue(detail);
    const importedCalculation = {
      id: "00000000-0000-4000-8000-000000000601",
      isActive: true,
      currentSnapshot: {
        id: "00000000-0000-4000-8000-000000000602",
        snapshotNumber: 1,
        agreementVersionId: "00000000-0000-4000-8000-000000000699",
        agreementFeeBps: "100",
        agreementFeeAmountMinor: "100",
        calculationCurrencyId: "00000000-0000-4000-8000-000000000301",
        originalAmountMinor: "10000",
        totalFeeBps: "150",
        totalFeeAmountMinor: "150",
        totalAmountMinor: "10150",
        baseCurrencyId: "00000000-0000-4000-8000-000000000302",
        totalFeeAmountInBaseMinor: "135",
        totalInBaseMinor: "9000",
        additionalExpensesCurrencyId: null,
        additionalExpensesAmountMinor: "0",
        additionalExpensesInBaseMinor: "0",
        fixedFeeAmountMinor: "0",
        fixedFeeCurrencyId: null,
        quoteMarkupBps: "50",
        quoteMarkupAmountMinor: "50",
        referenceRateSource: "manual",
        referenceRateNum: "9",
        referenceRateDen: "10",
        referenceRateAsOf: new Date("2026-03-01T00:00:00.000Z"),
        pricingProvenance: { source: "historical_import" },
        totalWithExpensesInBaseMinor: "9135",
        rateSource: "manual",
        rateNum: "9",
        rateDen: "10",
        additionalExpensesRateSource: null,
        additionalExpensesRateNum: null,
        additionalExpensesRateDen: null,
        calculationTimestamp: new Date("2026-03-01T00:00:00.000Z"),
        fxQuoteId: null,
        quoteSnapshot: null,
        createdAt: new Date("2026-03-01T00:00:00.000Z"),
        updatedAt: new Date("2026-03-01T00:00:00.000Z"),
      },
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
      updatedAt: new Date("2026-03-01T00:00:00.000Z"),
      lines: [],
    };
    calculationsModule.calculations.commands.create.mockResolvedValue(
      importedCalculation,
    );
    dealsModule.deals.commands.linkCalculation.mockResolvedValue({
      ...createWorkflowProjection(),
      summary: {
        ...createWorkflowProjection().summary,
        calculationId: importedCalculation.id,
      },
    });

    const response = await app.request(
      `http://localhost/deals/${detail.id}/calculations/import`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": "historical-import-1",
        },
        body: JSON.stringify({
          agreementVersionId: "00000000-0000-4000-8000-000000000699",
          agreementFeeBps: "100",
          agreementFeeAmountMinor: "100",
          calculationCurrencyId: "00000000-0000-4000-8000-000000000301",
          originalAmountMinor: "10000",
          totalFeeBps: "150",
          totalFeeAmountMinor: "150",
          totalAmountMinor: "10150",
          baseCurrencyId: "00000000-0000-4000-8000-000000000302",
          totalFeeAmountInBaseMinor: "135",
          totalInBaseMinor: "9000",
          additionalExpensesCurrencyId: null,
          additionalExpensesAmountMinor: "0",
          additionalExpensesInBaseMinor: "0",
          fixedFeeAmountMinor: "0",
          fixedFeeCurrencyId: null,
          quoteMarkupBps: "50",
          quoteMarkupAmountMinor: "50",
          referenceRateSource: "manual",
          referenceRateNum: "9",
          referenceRateDen: "10",
          referenceRateAsOf: "2026-03-01T00:00:00.000Z",
          pricingProvenance: { source: "historical_import" },
          totalWithExpensesInBaseMinor: "9135",
          rateSource: "manual",
          rateNum: "9",
          rateDen: "10",
          additionalExpensesRateSource: null,
          additionalExpensesRateNum: null,
          additionalExpensesRateDen: null,
          calculationTimestamp: "2026-03-01T00:00:00.000Z",
          fxQuoteId: null,
          sourceQuoteId: null,
        }),
      },
    );

    expect(response.status).toBe(201);
    expect(
      calculationsModule.calculations.commands.create,
    ).toHaveBeenCalledWith({
      actorUserId: "user-1",
      agreementVersionId: "00000000-0000-4000-8000-000000000699",
      agreementFeeBps: "100",
      agreementFeeAmountMinor: "100",
      calculationCurrencyId: "00000000-0000-4000-8000-000000000301",
      originalAmountMinor: "10000",
      totalFeeBps: "150",
      totalFeeAmountMinor: "150",
      totalAmountMinor: "10150",
      baseCurrencyId: "00000000-0000-4000-8000-000000000302",
      totalFeeAmountInBaseMinor: "135",
      totalInBaseMinor: "9000",
      additionalExpensesCurrencyId: null,
      additionalExpensesAmountMinor: "0",
      additionalExpensesInBaseMinor: "0",
      fixedFeeAmountMinor: "0",
      fixedFeeCurrencyId: null,
      quoteMarkupBps: "50",
      quoteMarkupAmountMinor: "50",
      referenceRateSource: "manual",
      referenceRateNum: "9",
      referenceRateDen: "10",
      referenceRateAsOf: new Date("2026-03-01T00:00:00.000Z"),
      pricingProvenance: { source: "historical_import" },
      totalWithExpensesInBaseMinor: "9135",
      rateSource: "manual",
      rateNum: "9",
      rateDen: "10",
      additionalExpensesRateSource: null,
      additionalExpensesRateNum: null,
      additionalExpensesRateDen: null,
      calculationTimestamp: new Date("2026-03-01T00:00:00.000Z"),
      fxQuoteId: null,
      idempotencyKey: "historical-import-1",
    });
    expect(dealsModule.deals.commands.linkCalculation).toHaveBeenCalledWith({
      actorUserId: "user-1",
      calculationId: importedCalculation.id,
      dealId: detail.id,
      sourceQuoteId: null,
    });
  });

  it("returns structured blockers when a status transition is blocked", async () => {
    const { app, dealsModule } = createTestApp();
    dealsModule.deals.commands.transitionStatus.mockRejectedValue(
      new DealTransitionBlockedError("submitted", [
        {
          code: "intake_incomplete",
          message: "Required intake sections are incomplete",
        },
      ] as any),
    );

    const response = await app.request(
      "http://localhost/deals/00000000-0000-4000-8000-000000000010/status",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ status: "submitted" }),
      },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: "deal.transition_blocked",
      details: {
        targetStatus: "submitted",
      },
      error: "Deal transition to submitted is blocked",
    });
  });

  it("requests deal execution materialization", async () => {
    const { app, dealExecutionWorkflow, dealsModule } = createTestApp();
    const detail = {
      ...createDealDetail(),
      status: "submitted" as const,
    };
    const projection = createWorkflowProjection();
    dealsModule.deals.queries.findById.mockResolvedValue(detail);
    dealExecutionWorkflow.requestExecution.mockResolvedValue(projection);

    const response = await app.request(
      "http://localhost/deals/00000000-0000-4000-8000-000000000010/execution/request",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": "execution-request-1",
        },
        body: JSON.stringify({
          comment: "Materialize execution legs",
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(dealExecutionWorkflow.requestExecution).toHaveBeenCalledWith({
      actorUserId: "user-1",
      comment: "Materialize execution legs",
      dealId: "00000000-0000-4000-8000-000000000010",
      idempotencyKey: "execution-request-1",
    });
  });

  it("returns structured blockers when execution request is blocked", async () => {
    const { app, dealExecutionWorkflow, dealsModule } = createTestApp();
    dealsModule.deals.queries.findById.mockResolvedValue({
      ...createDealDetail(),
      status: "submitted" as const,
    });
    dealExecutionWorkflow.requestExecution.mockRejectedValue(
      new DealTransitionBlockedError("awaiting_funds", [
        {
          code: "execution_leg_not_done",
          message: "Execution is blocked",
        },
      ] as any),
    );

    const response = await app.request(
      "http://localhost/deals/00000000-0000-4000-8000-000000000010/execution/request",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": "execution-request-2",
        },
        body: JSON.stringify({}),
      },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: "deal.transition_blocked",
      details: {
        targetStatus: "awaiting_funds",
      },
      error: "Deal transition to awaiting_funds is blocked",
    });
  });

  it("forwards the same idempotency key on repeated execution requests", async () => {
    const { app, dealExecutionWorkflow, dealsModule } = createTestApp();
    const detail = {
      ...createDealDetail(),
      status: "awaiting_funds" as const,
    };
    const projection = createWorkflowProjection();
    dealsModule.deals.queries.findById.mockResolvedValue(detail);
    dealExecutionWorkflow.requestExecution.mockResolvedValue(projection);

    const first = await app.request(
      "http://localhost/deals/00000000-0000-4000-8000-000000000010/execution/request",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": "execution-request-replay",
        },
        body: JSON.stringify({}),
      },
    );
    const second = await app.request(
      "http://localhost/deals/00000000-0000-4000-8000-000000000010/execution/request",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": "execution-request-replay",
        },
        body: JSON.stringify({}),
      },
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(dealExecutionWorkflow.requestExecution).toHaveBeenNthCalledWith(1, {
      actorUserId: "user-1",
      comment: null,
      dealId: "00000000-0000-4000-8000-000000000010",
      idempotencyKey: "execution-request-replay",
    });
    expect(dealExecutionWorkflow.requestExecution).toHaveBeenNthCalledWith(2, {
      actorUserId: "user-1",
      comment: null,
      dealId: "00000000-0000-4000-8000-000000000010",
      idempotencyKey: "execution-request-replay",
    });
  });

  it("creates a missing leg operation through the execution workflow", async () => {
    const { app, dealExecutionWorkflow, dealsModule } = createTestApp();
    const detail = {
      ...createDealDetail(),
      status: "awaiting_funds" as const,
    };
    const projection = createWorkflowProjection();
    dealsModule.deals.queries.findById.mockResolvedValue(detail);
    dealExecutionWorkflow.createLegOperation.mockResolvedValue(projection);

    const response = await app.request(
      "http://localhost/deals/00000000-0000-4000-8000-000000000010/execution/legs/00000000-0000-4000-8000-000000000101/operation",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": "execution-leg-operation-1",
        },
        body: JSON.stringify({
          comment: "Repair missing operation",
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(dealExecutionWorkflow.createLegOperation).toHaveBeenCalledWith({
      actorUserId: "user-1",
      comment: "Repair missing operation",
      dealId: "00000000-0000-4000-8000-000000000010",
      idempotencyKey: "execution-leg-operation-1",
      legId: "00000000-0000-4000-8000-000000000101",
    });
  });

  it("resolves a supported execution blocker through the workflow", async () => {
    const { app, dealExecutionWorkflow, dealsModule } = createTestApp();
    dealsModule.deals.queries.findById.mockResolvedValue({
      ...createDealDetail(),
      status: "awaiting_payment" as const,
    });
    dealExecutionWorkflow.resolveExecutionBlocker.mockResolvedValue(
      createWorkflowProjection(),
    );

    const response = await app.request(
      "http://localhost/deals/00000000-0000-4000-8000-000000000010/execution/blockers/resolve",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": "execution-blocker-resolve-1",
        },
        body: JSON.stringify({
          legId: "00000000-0000-4000-8000-000000000102",
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(dealExecutionWorkflow.resolveExecutionBlocker).toHaveBeenCalledWith({
      actorUserId: "user-1",
      comment: null,
      dealId: "00000000-0000-4000-8000-000000000010",
      idempotencyKey: "execution-blocker-resolve-1",
      legId: "00000000-0000-4000-8000-000000000102",
    });
  });

  it("closes a fully executed deal through the workflow", async () => {
    const { app, dealExecutionWorkflow, dealsModule } = createTestApp();
    dealsModule.deals.queries.findById.mockResolvedValue({
      ...createDealDetail(),
      status: "closing_documents" as const,
    });
    dealExecutionWorkflow.closeDeal.mockResolvedValue(createWorkflowProjection());

    const response = await app.request(
      "http://localhost/deals/00000000-0000-4000-8000-000000000010/close",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": "deal-close-1",
        },
        body: JSON.stringify({
          comment: "Execution complete",
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(dealExecutionWorkflow.closeDeal).toHaveBeenCalledWith({
      actorUserId: "user-1",
      comment: "Execution complete",
      dealId: "00000000-0000-4000-8000-000000000010",
      idempotencyKey: "deal-close-1",
    });
  });

  it("passes the finance queue stage filter through to the projection workflow", async () => {
    const { app, dealProjectionsWorkflow } = createTestApp();
    dealProjectionsWorkflow.listFinanceDealQueues.mockResolvedValue(
      createFinanceQueueProjection(),
    );

    const response = await app.request(
      "http://localhost/deals/finance/queues?queue=execution&stage=awaiting_reconciliation",
    );

    expect(response.status).toBe(200);
    expect(dealProjectionsWorkflow.listFinanceDealQueues).toHaveBeenCalledWith({
      queue: "execution",
      stage: "awaiting_reconciliation",
    });

    const body = await response.json();
    expect(body.items[0]).toMatchObject({
      dealId: "00000000-0000-4000-8000-000000000010",
      stage: "awaiting_reconciliation",
      stageReason: "Ожидаем завершение сверки",
    });
  });

  it("returns reconciliation-aware finance workspace fields", async () => {
    const { app, dealProjectionsWorkflow } = createTestApp();
    dealProjectionsWorkflow.getFinanceDealWorkspaceProjection.mockResolvedValue(
      createFinanceWorkspaceProjection(),
    );

    const response = await app.request(
      "http://localhost/deals/00000000-0000-4000-8000-000000000010/finance-workspace",
    );

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.closeReadiness).toMatchObject({
      ready: false,
    });
    expect(body.instructionSummary).toMatchObject({
      settled: 1,
      totalOperations: 1,
    });
    expect(body.reconciliationSummary).toMatchObject({
      pendingOperationCount: 1,
      state: "pending",
    });
    expect(body.relatedResources.reconciliationExceptions).toEqual([
      expect.objectContaining({
        actions: {
          adjustmentDocumentDocType: "transfer_resolution",
          canIgnore: true,
        },
        id: "00000000-0000-4000-8000-000000000111",
        source: "bank_statement",
      }),
    ]);
  });

  it("lists deal-scoped reconciliation exceptions from the finance workspace", async () => {
    const { app, dealProjectionsWorkflow, dealsModule } = createTestApp();
    dealsModule.deals.queries.findById.mockResolvedValue(createDealDetail());
    dealProjectionsWorkflow.getFinanceDealWorkspaceProjection.mockResolvedValue(
      createFinanceWorkspaceProjection(),
    );

    const response = await app.request(
      "http://localhost/deals/00000000-0000-4000-8000-000000000010/reconciliation/exceptions",
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      expect.objectContaining({
        actions: {
          adjustmentDocumentDocType: "transfer_resolution",
          canIgnore: true,
        },
        id: "00000000-0000-4000-8000-000000000111",
      }),
    ]);
  });

  it("runs deal-scoped reconciliation for pending treasury outcome records", async () => {
    const {
      app,
      dealProjectionsWorkflow,
      dealsModule,
      persistence,
      reconciliationService,
    } = createTestApp();
    dealsModule.deals.queries.findById.mockResolvedValue(createDealDetail());
    dealProjectionsWorkflow.getFinanceDealWorkspaceProjection
      .mockResolvedValueOnce(createFinanceWorkspaceProjection())
      .mockResolvedValueOnce({
        ...createFinanceWorkspaceProjection(),
        actions: {
          ...createFinanceWorkspaceProjection().actions,
          canRunReconciliation: false,
        },
        reconciliationSummary: {
          ...createFinanceWorkspaceProjection().reconciliationSummary,
          pendingOperationCount: 0,
          reconciledOperationCount: 1,
          state: "clear",
        },
      });
    persistence.db.execute.mockResolvedValue({
      rows: [{ id: "external-record-1" }],
    });

    const response = await app.request(
      "http://localhost/deals/00000000-0000-4000-8000-000000000010/reconciliation/run",
      {
        method: "POST",
        headers: {
          "Idempotency-Key": "reconciliation-run-1",
        },
      },
    );

    expect(response.status).toBe(200);
    expect(reconciliationService.runs.runReconciliation).toHaveBeenCalledWith({
      actorUserId: "user-1",
      idempotencyKey: "reconciliation-run-1",
      inputQuery: {
        externalRecordIds: ["external-record-1"],
      },
      requestContext: {
        causationId: null,
        correlationId: "corr-1",
        idempotencyKey: "reconciliation-run-1",
        requestId: "req-1",
        traceId: null,
      },
      rulesetChecksum: "core-default-v1",
      source: "treasury_instruction_outcomes",
    });
  });

  it("ignores deal-scoped reconciliation exceptions", async () => {
    const {
      app,
      dealProjectionsWorkflow,
      dealsModule,
      reconciliationService,
    } = createTestApp();
    dealsModule.deals.queries.findById.mockResolvedValue(createDealDetail());
    dealProjectionsWorkflow.getFinanceDealWorkspaceProjection.mockResolvedValue(
      createFinanceWorkspaceProjection(),
    );

    const response = await app.request(
      "http://localhost/deals/00000000-0000-4000-8000-000000000010/reconciliation/exceptions/00000000-0000-4000-8000-000000000111/ignore",
      {
        method: "POST",
      },
    );

    expect(response.status).toBe(200);
    expect(reconciliationService.exceptions.ignore).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000111",
    );
  });

  it("resolves deal-scoped reconciliation exceptions with an adjustment document", async () => {
    const {
      app,
      dealProjectionsWorkflow,
      dealsModule,
      documentsService,
      reconciliationService,
    } = createTestApp();
    dealsModule.deals.queries.findById.mockResolvedValue(createDealDetail());
    dealProjectionsWorkflow.getFinanceDealWorkspaceProjection.mockResolvedValue(
      createFinanceWorkspaceProjection(),
    );
    documentsService.get.mockResolvedValue({
      dealId: "00000000-0000-4000-8000-000000000010",
      id: "00000000-0000-4000-8000-000000000555",
    });

    const response = await app.request(
      "http://localhost/deals/00000000-0000-4000-8000-000000000010/reconciliation/exceptions/00000000-0000-4000-8000-000000000111/adjustment-document",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          docType: "transfer_resolution",
          documentId: "00000000-0000-4000-8000-000000000555",
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(documentsService.get).toHaveBeenCalledWith(
      "transfer_resolution",
      "00000000-0000-4000-8000-000000000555",
      "user-1",
    );
    expect(
      reconciliationService.exceptions.resolveWithAdjustment,
    ).toHaveBeenCalledWith({
      adjustmentDocumentId: "00000000-0000-4000-8000-000000000555",
      exceptionId: "00000000-0000-4000-8000-000000000111",
    });
  });

  it("updates a deal execution leg state", async () => {
    const { app, dealsModule } = createTestApp();
    const projection = createWorkflowProjection();
    dealsModule.deals.commands.updateLegState.mockResolvedValue(projection);

    const response = await app.request(
      "http://localhost/deals/00000000-0000-4000-8000-000000000010/legs/1/state",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ state: "in_progress" }),
      },
    );

    expect(response.status).toBe(200);
    expect(dealsModule.deals.commands.updateLegState).toHaveBeenCalledWith({
      actorUserId: "user-1",
      comment: null,
      dealId: "00000000-0000-4000-8000-000000000010",
      idx: 1,
      state: "in_progress",
    });
  });
});
