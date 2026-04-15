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
    acceptedCalculation: {
      acceptedAt: "2026-04-02T08:15:00.000Z",
      calculationId: "7f6491b3-5226-4e34-a019-92a41315d642",
      calculationTimestamp: "2026-04-02T08:15:00.000Z",
      pricingProvenance: null,
      quoteProvenance: {
        fxQuoteId: "a68fcc97-b77c-43b0-a323-45b6f783fd3a",
        quoteSnapshot: null,
        sourceQuoteId: "a68fcc97-b77c-43b0-a323-45b6f783fd3a",
      },
      routeVersionId: null,
      snapshotId: "7f6491b3-5226-4e34-a019-92a41315d643",
      state: "accepted",
    },
    actions: {
      canAcceptCalculation: false,
      canCloseDeal: false,
      canCreateCalculation: true,
      canCreateQuote: true,
      canRecordCashMovement: false,
      canRecordExecutionFee: false,
      canRecordExecutionFill: false,
      canRequestExecution: false,
      canRunReconciliation: false,
      canResolveExecutionBlocker: false,
      canSupersedeCalculation: false,
      canUploadAttachment: true,
    },
    attachmentRequirements: [],
    calculationHistory: [
      {
        baseCurrencyId: "45b2da57-4205-4607-a3ec-d0acbfb322ab",
        calculationCurrencyId: "45b2da57-4205-4607-a3ec-d0acbfb322ab",
        calculationId: "7f6491b3-5226-4e34-a019-92a41315d642",
        calculationTimestamp: "2026-04-02T08:30:00.000Z",
        createdAt: "2026-04-02T08:30:00.000Z",
        expenseAmountInBaseMinor: "25000",
        grossRevenueInBaseMinor: "125000",
        netMarginInBaseMinor: "100000",
        passThroughAmountInBaseMinor: "0",
        rateDen: "100",
        rateNum: "9715",
        sourceQuoteId: "a68fcc97-b77c-43b0-a323-45b6f783fd3a",
        totalAmountMinor: "1214375000",
        totalInBaseMinor: "1214375000",
        totalWithExpensesInBaseMinor: "1214400000",
      },
    ],
    closeReadiness: {
      blockers: [],
      criteria: [],
      ready: false,
    },
    executionPlan: [],
    formalDocumentRequirements: [],
    instructionSummary: {
      failed: 0,
      planned: 0,
      prepared: 0,
      returnRequested: 0,
      returned: 0,
      settled: 0,
      submitted: 0,
      terminalOperations: 0,
      totalOperations: 0,
      voided: 0,
    },
    nextAction: "Create calculation from route",
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
    profitabilityVariance: null,
    queueContext: {
      blockers: [],
      queue: "pricing",
      queueReason: "Create calculation from route",
    },
    quoteHistory: [],
    reconciliationSummary: {
      ignoredExceptionCount: 0,
      lastActivityAt: null,
      openExceptionCount: 0,
      pendingOperationCount: 0,
      reconciledOperationCount: 0,
      requiredOperationCount: 0,
      resolvedExceptionCount: 0,
      state: "not_started",
    },
    relatedResources: {
      attachments: [],
      formalDocuments: [],
      operations: [],
      quotes: [],
      reconciliationExceptions: [],
    },
    summary: {
      applicantDisplayName: "ООО Ромашка",
      calculationId: "7f6491b3-5226-4e34-a019-92a41315d642",
      createdAt: "2026-04-02T08:07:00.000Z",
      id: "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
      internalEntityDisplayName: "Мультиханса",
      status: "draft",
      type: "payment",
      updatedAt: "2026-04-02T08:07:00.000Z",
    },
    timeline: [],
  };
}

function createCalculationDetailsPayload(id: string, snapshotNumber: number) {
  return {
    createdAt: "2026-04-02T08:30:00.000Z",
    currentSnapshot: {
      baseCurrencyId: "45b2da57-4205-4607-a3ec-d0acbfb322ab",
      calculationCurrencyId: "45b2da57-4205-4607-a3ec-d0acbfb322ab",
      calculationTimestamp: "2026-04-02T08:30:00.000Z",
      expenseAmountInBaseMinor: "25000",
      grossRevenueInBaseMinor: "125000",
      id: "c4e45b12-a65a-4907-b5af-94efcda0f4e4",
      netMarginInBaseMinor: "100000",
      passThroughAmountInBaseMinor: "0",
      rateDen: "100",
      rateNum: "9715",
      rateSource: "route",
      routeVersionId: "814fb6eb-a1bd-429e-9628-e97d0f2efa0b",
      snapshotNumber,
      state: "accepted",
      totalAmountMinor: "1214375000",
      totalInBaseMinor: "1214375000",
      totalWithExpensesInBaseMinor: "1214400000",
    },
    id,
    isActive: true,
    lines: [
      {
        amountMinor: "25000",
        classification: "expense",
        componentCode: "wire_fee",
        componentFamily: "provider_fee",
        currencyId: "45b2da57-4205-4607-a3ec-d0acbfb322ab",
        idx: 0,
        kind: "cost_component",
        routeLegId: "914fb6eb-a1bd-429e-9628-e97d0f2efa0b",
        sourceKind: "route",
      },
    ],
    updatedAt: "2026-04-02T08:30:00.000Z",
  };
}

function createCalculationComparePayload() {
  return {
    left: createCalculationDetailsPayload(
      "7f6491b3-5226-4e34-a019-92a41315d642",
      2,
    ),
    lineDiffs: [
      {
        classification: "expense",
        componentCode: "wire_fee",
        componentFamily: "provider_fee",
        currencyId: "45b2da57-4205-4607-a3ec-d0acbfb322ab",
        deltaAmountMinor: "5000",
        kind: "cost_component",
        leftAmountMinor: "25000",
        rightAmountMinor: "20000",
        routeLegId: "914fb6eb-a1bd-429e-9628-e97d0f2efa0b",
      },
    ],
    right: createCalculationDetailsPayload(
      "df65ce76-7cb4-4eb0-b4c0-080cf2a70413",
      1,
    ),
    totals: {
      expenseAmountInBaseMinor: {
        deltaMinor: "5000",
        leftMinor: "25000",
        rightMinor: "20000",
      },
      grossRevenueInBaseMinor: {
        deltaMinor: "0",
        leftMinor: "125000",
        rightMinor: "125000",
      },
      netMarginInBaseMinor: {
        deltaMinor: "-5000",
        leftMinor: "100000",
        rightMinor: "105000",
      },
      passThroughAmountInBaseMinor: {
        deltaMinor: "0",
        leftMinor: "0",
        rightMinor: "0",
      },
      totalInBaseMinor: {
        deltaMinor: "0",
        leftMinor: "1214375000",
        rightMinor: "1214375000",
      },
      totalWithExpensesInBaseMinor: {
        deltaMinor: "5000",
        leftMinor: "1214400000",
        rightMinor: "1214395000",
      },
    },
  };
}

describe("treasury deal calculation queries", () => {
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

  it("loads calculation workspace from workbench, calculation details, compare, and currencies", async () => {
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
        json: async () =>
          createCalculationDetailsPayload(
            "7f6491b3-5226-4e34-a019-92a41315d642",
            2,
          ),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createCalculationComparePayload(),
      });

    const { getFinanceDealCalculationWorkspaceById } = await import(
      "@/features/treasury/deals/lib/calculation-workspace"
    );

    const result = await getFinanceDealCalculationWorkspaceById(
      "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
    );

    expect(getFinanceDealWorkbenchById).toHaveBeenCalledWith(
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
      "http://localhost:3000/v1/deals/614fb6eb-a1bd-429e-9628-e97d0f2efa0b/calculations/7f6491b3-5226-4e34-a019-92a41315d642",
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
      "http://localhost:3000/v1/deals/614fb6eb-a1bd-429e-9628-e97d0f2efa0b/calculations/compare",
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
        comparison: expect.objectContaining({
          lineDiffs: [
            expect.objectContaining({
              componentCode: "wire_fee",
            }),
          ],
        }),
        currentCalculation: expect.objectContaining({
          id: "7f6491b3-5226-4e34-a019-92a41315d642",
        }),
        deal: expect.objectContaining({
          summary: expect.objectContaining({
            applicantDisplayName: "ООО Ромашка",
          }),
        }),
      }),
    );
  });

  it("keeps the page available when compare endpoint is unavailable", async () => {
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
        json: async () =>
          createCalculationDetailsPayload(
            "7f6491b3-5226-4e34-a019-92a41315d642",
            2,
          ),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({
          message: "Boom",
        }),
      });

    const { getFinanceDealCalculationWorkspaceById } = await import(
      "@/features/treasury/deals/lib/calculation-workspace"
    );

    const result = await getFinanceDealCalculationWorkspaceById(
      "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
    );

    expect(result).toEqual(
      expect.objectContaining({
        comparison: null,
        currentCalculation: expect.objectContaining({
          currentSnapshot: expect.objectContaining({
            snapshotNumber: 2,
          }),
        }),
      }),
    );
  });
});
