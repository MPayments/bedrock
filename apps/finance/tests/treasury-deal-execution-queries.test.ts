import { beforeEach, describe, expect, it, vi } from "vitest";

const headers = vi.fn();
const fetchMock = vi.fn();
const getFinanceDealWorkbenchById = vi.fn();

vi.mock("next/headers", () => ({
  headers,
}));

vi.mock("@/features/treasury/deals/lib/queries", () => ({
  getFinanceDealWorkbenchById,
}));

function createDealWorkbenchPayload() {
  return {
    acceptedCalculation: null,
    actions: {
      canAcceptCalculation: false,
      canCloseDeal: false,
      canCreateCalculation: true,
      canCreateQuote: true,
      canRecordCashMovement: false,
      canRecordExecutionFee: false,
      canRecordExecutionFill: false,
      canRequestExecution: true,
      canRunReconciliation: true,
      canResolveExecutionBlocker: false,
      canSupersedeCalculation: false,
      canUploadAttachment: true,
    },
    attachmentRequirements: [],
    calculationHistory: [],
    closeReadiness: {
      blockers: ["Realized profitability is not available"],
      criteria: [
        {
          code: "realized_profitability_available",
          label: "Есть реализованная прибыльность",
          satisfied: false,
        },
      ],
      ready: false,
    },
    executionPlan: [
      {
        actions: {
          canCreateLegOperation: false,
          exchangeDocument: null,
        },
        id: "714fb6eb-a1bd-429e-9628-e97d0f2efa0b",
        idx: 1,
        kind: "collect",
        operationRefs: [
          {
            operationId: "814fb6eb-a1bd-429e-9628-e97d0f2efa0b",
          },
        ],
        state: "done",
      },
    ],
    formalDocumentRequirements: [],
    instructionSummary: {
      failed: 0,
      planned: 1,
      prepared: 0,
      returnRequested: 0,
      returned: 0,
      settled: 1,
      submitted: 1,
      terminalOperations: 1,
      totalOperations: 1,
      voided: 0,
    },
    nextAction: "Monitor execution",
    operationalState: {
      positions: [],
    },
    pricing: {
      fundingMessage: null,
      fundingResolution: {
        availableMinor: null,
        fundingOrganizationId: null,
        fundingRequisiteId: null,
        reasonCode: null,
        requiredAmountMinor: null,
        state: "not_applicable",
        strategy: null,
        targetCurrency: null,
        targetCurrencyId: null,
      },
      quoteAmount: "125000.00",
      quoteAmountSide: "source",
      quoteEligibility: true,
      sourceCurrencyId: "fdcf4040-4a4e-4c90-b550-6898ab3789f4",
      targetCurrencyId: "45b2da57-4205-4607-a3ec-d0acbfb322ab",
    },
    profitabilitySnapshot: null,
    profitabilityVariance: {
      actualCoverage: {
        factCount: 1,
        legsWithFacts: 1,
        operationCount: 1,
        state: "complete",
        terminalOperationCount: 1,
        totalLegCount: 1,
      },
      actualExpense: [
        {
          amountMinor: "25000",
          currencyCode: "RUB",
          currencyId: "45b2da57-4205-4607-a3ec-d0acbfb322ab",
        },
      ],
      actualPassThrough: [],
      calculationId: "914fb6eb-a1bd-429e-9628-e97d0f2efa0b",
      expectedNetMargin: [
        {
          amountMinor: "100000",
          currencyCode: "RUB",
          currencyId: "45b2da57-4205-4607-a3ec-d0acbfb322ab",
        },
      ],
      netMarginVariance: [
        {
          amountMinor: "-5000",
          currencyCode: "RUB",
          currencyId: "45b2da57-4205-4607-a3ec-d0acbfb322ab",
        },
      ],
      realizedNetMargin: [
        {
          amountMinor: "95000",
          currencyCode: "RUB",
          currencyId: "45b2da57-4205-4607-a3ec-d0acbfb322ab",
        },
      ],
      varianceByCostFamily: [],
      varianceByLeg: [],
    },
    queueContext: {
      blockers: [],
      queue: "execution",
      queueReason: "Monitor execution",
    },
    quoteHistory: [],
    reconciliationSummary: {
      ignoredExceptionCount: 0,
      lastActivityAt: null,
      openExceptionCount: 0,
      pendingOperationCount: 0,
      reconciledOperationCount: 1,
      requiredOperationCount: 1,
      resolvedExceptionCount: 0,
      state: "clear",
    },
    relatedResources: {
      attachments: [],
      formalDocuments: [],
      operations: [
        {
          actions: {
            canPrepareInstruction: false,
            canRequestReturn: false,
            canRetryInstruction: false,
            canSubmitInstruction: false,
            canVoidInstruction: false,
          },
          availableOutcomeTransitions: [],
          id: "814fb6eb-a1bd-429e-9628-e97d0f2efa0b",
          instructionStatus: "settled",
          kind: "payin",
          latestInstruction: {
            attempt: 1,
            createdAt: "2026-04-02T08:10:00.000Z",
            failedAt: null,
            id: "a14fb6eb-a1bd-429e-9628-e97d0f2efa0b",
            operationId: "814fb6eb-a1bd-429e-9628-e97d0f2efa0b",
            providerRef: "provider-1",
            providerSnapshot: null,
            returnRequestedAt: null,
            returnedAt: null,
            settledAt: "2026-04-02T08:30:00.000Z",
            sourceRef: "instruction-1",
            state: "settled",
            submittedAt: "2026-04-02T08:20:00.000Z",
            updatedAt: "2026-04-02T08:30:00.000Z",
            voidedAt: null,
          },
          operationHref: "/treasury/operations/814fb6eb-a1bd-429e-9628-e97d0f2efa0b",
          sourceRef: "deal-leg:collect",
          state: "planned",
        },
      ],
      quotes: [],
      reconciliationExceptions: [],
    },
    summary: {
      applicantDisplayName: "ООО Ромашка",
      calculationId: "914fb6eb-a1bd-429e-9628-e97d0f2efa0b",
      createdAt: "2026-04-02T08:07:00.000Z",
      id: "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
      internalEntityDisplayName: "Мультиханса",
      status: "executing",
      type: "payment",
      updatedAt: "2026-04-02T08:07:00.000Z",
    },
    timeline: [],
  };
}

describe("treasury deal execution queries", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    headers.mockResolvedValue(
      new Headers({
        cookie: "session=token",
      }),
    );
    fetchMock.mockReset();
    getFinanceDealWorkbenchById.mockResolvedValue(createDealWorkbenchPayload());
    vi.stubGlobal("fetch", fetchMock);
  });

  it("loads execution workspace from workbench, actuals, and currencies", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            {
              code: "RUB",
              id: "45b2da57-4205-4607-a3ec-d0acbfb322ab",
              label: "RUB · Российский рубль",
              name: "Российский рубль",
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            {
              actualRateDen: null,
              actualRateNum: null,
              boughtAmountMinor: null,
              boughtCurrencyId: null,
              calculationSnapshotId: null,
              confirmedAt: "2026-04-02T08:30:00.000Z",
              createdAt: "2026-04-02T08:30:00.000Z",
              dealId: "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
              executedAt: "2026-04-02T08:30:00.000Z",
              externalRecordId: "ext-1",
              fillSequence: null,
              id: "b14fb6eb-a1bd-429e-9628-e97d0f2efa0b",
              instructionId: "a14fb6eb-a1bd-429e-9628-e97d0f2efa0b",
              metadata: null,
              notes: null,
              operationId: "814fb6eb-a1bd-429e-9628-e97d0f2efa0b",
              providerCounterpartyId: null,
              providerRef: "provider-1",
              routeLegId: "714fb6eb-a1bd-429e-9628-e97d0f2efa0b",
              routeVersionId: null,
              soldAmountMinor: null,
              soldCurrencyId: null,
              sourceKind: "provider",
              sourceRef: "outcome-1",
              updatedAt: "2026-04-02T08:30:00.000Z",
            },
          ],
          limit: 200,
          offset: 0,
          total: 1,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            {
              amountMinor: "25000",
              calculationSnapshotId: null,
              chargedAt: "2026-04-02T08:30:00.000Z",
              componentCode: null,
              confirmedAt: "2026-04-02T08:30:00.000Z",
              createdAt: "2026-04-02T08:30:00.000Z",
              currencyId: "45b2da57-4205-4607-a3ec-d0acbfb322ab",
              dealId: "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
              externalRecordId: "ext-1",
              feeFamily: "provider_fee",
              fillId: null,
              id: "c14fb6eb-a1bd-429e-9628-e97d0f2efa0b",
              instructionId: "a14fb6eb-a1bd-429e-9628-e97d0f2efa0b",
              metadata: null,
              notes: null,
              operationId: "814fb6eb-a1bd-429e-9628-e97d0f2efa0b",
              providerCounterpartyId: null,
              providerRef: "provider-1",
              routeComponentId: null,
              routeLegId: "714fb6eb-a1bd-429e-9628-e97d0f2efa0b",
              routeVersionId: null,
              sourceKind: "provider",
              sourceRef: "outcome-1:fee",
              updatedAt: "2026-04-02T08:30:00.000Z",
            },
          ],
          limit: 200,
          offset: 0,
          total: 1,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            {
              accountRef: null,
              amountMinor: "1214375000",
              bookedAt: "2026-04-02T08:30:00.000Z",
              calculationSnapshotId: null,
              confirmedAt: "2026-04-02T08:30:00.000Z",
              createdAt: "2026-04-02T08:30:00.000Z",
              currencyId: "45b2da57-4205-4607-a3ec-d0acbfb322ab",
              dealId: "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
              direction: "debit",
              externalRecordId: "ext-1",
              id: "d14fb6eb-a1bd-429e-9628-e97d0f2efa0b",
              instructionId: "a14fb6eb-a1bd-429e-9628-e97d0f2efa0b",
              metadata: null,
              notes: null,
              operationId: "814fb6eb-a1bd-429e-9628-e97d0f2efa0b",
              providerCounterpartyId: null,
              providerRef: "provider-1",
              requisiteId: null,
              routeLegId: "714fb6eb-a1bd-429e-9628-e97d0f2efa0b",
              routeVersionId: null,
              sourceKind: "provider",
              sourceRef: "outcome-1:cash",
              statementRef: null,
              updatedAt: "2026-04-02T08:30:00.000Z",
              valueDate: "2026-04-02T08:30:00.000Z",
            },
          ],
          limit: 200,
          offset: 0,
          total: 1,
        }),
      });

    const { getFinanceDealExecutionWorkspaceById } = await import(
      "@/features/treasury/deals/lib/execution-workspace"
    );

    const result = await getFinanceDealExecutionWorkspaceById(
      "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:3000/v1/currencies/options",
      {
        cache: "no-store",
        headers: {
          cookie: "session=token",
          "x-bedrock-app-audience": "finance",
        },
      },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:3000/v1/treasury/execution-fills?dealId=614fb6eb-a1bd-429e-9628-e97d0f2efa0b&limit=200&sortBy=executedAt&sortOrder=desc",
      {
        cache: "no-store",
        headers: {
          cookie: "session=token",
          "x-bedrock-app-audience": "finance",
        },
      },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:3000/v1/treasury/execution-fees?dealId=614fb6eb-a1bd-429e-9628-e97d0f2efa0b&limit=200&sortBy=chargedAt&sortOrder=desc",
      {
        cache: "no-store",
        headers: {
          cookie: "session=token",
          "x-bedrock-app-audience": "finance",
        },
      },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "http://localhost:3000/v1/treasury/cash-movements?dealId=614fb6eb-a1bd-429e-9628-e97d0f2efa0b&limit=200&sortBy=bookedAt&sortOrder=desc",
      {
        cache: "no-store",
        headers: {
          cookie: "session=token",
          "x-bedrock-app-audience": "finance",
        },
      },
    );
    expect(result).toEqual(
      expect.objectContaining({
        cashMovements: [
          expect.objectContaining({
            externalRecordId: "ext-1",
            sourceKind: "provider",
          }),
        ],
        deal: expect.objectContaining({
          summary: expect.objectContaining({
            status: "executing",
          }),
        }),
        fees: [
          expect.objectContaining({
            externalRecordId: "ext-1",
            sourceKind: "provider",
          }),
        ],
        fills: [
          expect.objectContaining({
            externalRecordId: "ext-1",
            sourceKind: "provider",
          }),
        ],
      }),
    );
  });

  it("keeps the execution page available when actuals endpoints are unavailable", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            {
              code: "RUB",
              id: "45b2da57-4205-4607-a3ec-d0acbfb322ab",
              label: "RUB · Российский рубль",
              name: "Российский рубль",
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({
          message: "Boom",
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({
          message: "Boom",
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({
          message: "Boom",
        }),
      });

    const { getFinanceDealExecutionWorkspaceById } = await import(
      "@/features/treasury/deals/lib/execution-workspace"
    );

    const result = await getFinanceDealExecutionWorkspaceById(
      "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
    );

    expect(result).toEqual(
      expect.objectContaining({
        cashMovements: [],
        fees: [],
        fills: [],
      }),
    );
  });
});
