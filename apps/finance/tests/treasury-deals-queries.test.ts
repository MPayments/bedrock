import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FinanceDealWorkspace } from "@/features/treasury/deals/lib/queries";

const headers = vi.fn();
const fetchMock = vi.fn();

type SerializedDates<T> = T extends Date
  ? string | Date
  : T extends (infer U)[]
    ? SerializedDates<U>[]
    : T extends object
      ? { [K in keyof T]: SerializedDates<T[K]> }
      : T;

vi.mock("next/headers", () => ({
  headers,
}));

function createFinanceWorkspacePayload(): SerializedDates<FinanceDealWorkspace> {
  const fundingResolution = {
    availableMinor: null,
    fundingOrganizationId: "84bb2b72-886b-43b2-bdc5-1d4d6d03120d",
    fundingRequisiteId: null,
    reasonCode: "inventory_insufficient",
    requiredAmountMinor: "1214375000",
    state: "resolved" as const,
    strategy: "external_fx" as const,
    targetCurrency: "RUB",
    targetCurrencyId: "0f9d972c-b95b-4544-95d8-8ccdc7496ed8",
  };

  return {
    acceptedQuote: {
      acceptedAt: "2026-04-02T08:15:00.000Z",
      expiresAt: "2026-04-02T09:15:00.000Z",
      quoteId: "a68fcc97-b77c-43b0-a323-45b6f783fd3a",
      quoteStatus: "active",
      usedAt: null,
    },
    acceptedQuoteDetails: {
      createdAt: "2026-04-02T08:10:00.000Z",
      dealDirection: "sell",
      dealForm: "spot",
      dealId: "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
      dealRef: null,
      expiresAt: "2026-04-02T09:15:00.000Z",
      fromAmount: "125000.00",
      fromAmountMinor: "12500000",
      fromCurrency: "USD",
      fromCurrencyId: "fdcf4040-4a4e-4c90-b550-6898ab3789f4",
      id: "a68fcc97-b77c-43b0-a323-45b6f783fd3a",
      idempotencyKey: "idem-accepted",
      pricingMode: "spot",
      pricingTrace: {},
      rateDen: "1",
      rateNum: "97.15",
      status: "active",
      toAmount: "12143750.00",
      toAmountMinor: "1214375000",
      toCurrency: "RUB",
      toCurrencyId: "45b2da57-4205-4607-a3ec-d0acbfb322ab",
      usedAt: null,
      usedByRef: null,
      usedDocumentId: null,
    },
    actions: {
      canCloseDeal: false,
      canCreateCalculation: true,
      canCreateQuote: true,
      canRequestExecution: false,
      canRunReconciliation: false,
      canResolveExecutionBlocker: false,
      canUploadAttachment: true,
    },
    attachmentRequirements: [
      {
        blockingReasons: ["Required intake sections are incomplete"],
        code: "invoice",
        label: "Инвойс",
        state: "missing",
      },
    ],
    cashflowSummary: {
      receivedIn: [],
      scheduledOut: [],
      settledOut: [],
    },
    closeReadiness: {
      blockers: ["Required intake sections are incomplete"],
      criteria: [
        {
          code: "operations_materialized",
          label: "Казначейские операции созданы для всех шагов",
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
        fromCurrencyId: null,
        id: "714fb6eb-a1bd-429e-9628-e97d0f2efa0b",
        idx: 1,
        kind: "collect",
        operationRefs: [],
        routeSnapshotLegId: null,
        state: "pending",
        toCurrencyId: null,
      },
    ],
    formalDocumentRequirements: [
      {
        activeDocumentId: null,
        blockingReasons: ["Opening document is required: invoice"],
        createAllowed: false,
        docType: "invoice",
        openAllowed: false,
        stage: "opening",
        state: "missing",
      },
    ],
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
    nextAction: "Create calculation from accepted quote",
    operationalState: {
      positions: [
        {
          amountMinor: null,
          kind: "customer_receivable",
          reasonCode: null,
          state: "pending",
        },
      ],
    },
    pricing: {
      fundingMessage: "Требуется конвертация",
      fundingResolution,
      quoteAmount: "125000.00",
      quoteAmountSide: "target",
      quoteEligibility: true,
      routeAttachment: null,
      sourceCurrencyId: "fdcf4040-4a4e-4c90-b550-6898ab3789f4",
      targetCurrencyId: "0f9d972c-b95b-4544-95d8-8ccdc7496ed8",
    },
    profitabilitySnapshot: null,
    queueContext: {
      blockers: ["Required intake sections are incomplete"],
      queue: "funding",
      queueReason: "Required intake sections are incomplete",
    },
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
      attachments: [
        {
          createdAt: "2026-04-02T08:09:00.000Z",
          description: "Счет клиента",
          fileName: "invoice.pdf",
          fileSize: 1024,
          id: "a953dc34-6f54-4f77-a6e8-b9c10d718279",
          mimeType: "application/pdf",
          updatedAt: "2026-04-02T08:09:00.000Z",
          uploadedBy: "alexey",
          visibility: "internal",
        },
      ],
      formalDocuments: [],
      instructionArtifacts: [],
      operations: [],
      paymentSteps: [],
      quotes: [
        {
          expiresAt: "2026-04-02T09:15:00.000Z",
          id: "a68fcc97-b77c-43b0-a323-45b6f783fd3a",
          status: "active",
        },
      ],
      reconciliationExceptions: [],
    },
    summary: {
      applicantDisplayName: "ООО Тест",
      calculationId: null,
      createdAt: "2026-04-02T08:07:00.000Z",
      id: "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
      internalEntityDisplayName: "Multihansa",
      status: "draft",
      type: "payment",
      updatedAt: "2026-04-02T08:09:00.000Z",
    },
    timeline: [
      {
        actor: {
          label: "alexey",
        },
        id: "bb36a82b-7a9b-4a88-91d7-39818114e79d",
        occurredAt: "2026-04-02T08:07:00.000Z",
        payload: {},
        type: "deal_created",
      },
    ],
  };
}

describe("treasury deals queries", () => {
  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockReset();
    headers.mockReset();

    headers.mockResolvedValue(
      new Headers({
        cookie: "session=token",
      }),
    );

    vi.stubGlobal("fetch", fetchMock);
  });

  it("serializes filters and applies local sort with pagination", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        counts: {
          execution: 2,
          failed_instruction: 0,
          funding: 0,
        },
        filters: {
          applicant: "ООО",
          queue: "execution",
        },
        items: [
          {
            applicantName: "ООО Бета",
            blockingReasons: [],
            createdAt: "2026-04-03T00:00:00.000Z",
            dealId: "8a35811e-b6ab-43f5-88ef-5dc8c9af4a8e",
            documentSummary: {
              attachmentCount: 1,
              formalDocumentCount: 2,
            },
            executionSummary: {
              blockedLegCount: 0,
              doneLegCount: 1,
              totalLegCount: 2,
            },
            internalEntityName: "Орг Б",
            nextAction: "Подготовить платеж",
            profitabilitySnapshot: null,
            queue: "execution",
            queueReason: "Сделка ожидает исполнения",
            stage: "awaiting_payout",
            stageReason: "Ожидаем выплату",
            quoteSummary: null,
            status: "awaiting_payment",
            type: "payment",
          },
          {
            applicantName: "ООО Альфа",
            blockingReasons: [],
            createdAt: "2026-04-02T00:00:00.000Z",
            dealId: "b21972b4-aee0-45fb-86f8-b4175b42b39c",
            documentSummary: {
              attachmentCount: 0,
              formalDocumentCount: 1,
            },
            executionSummary: {
              blockedLegCount: 0,
              doneLegCount: 0,
              totalLegCount: 1,
            },
            internalEntityName: "Орг А",
            nextAction: "Проверить документы",
            profitabilitySnapshot: null,
            queue: "execution",
            queueReason: "Сделка ожидает исполнения",
            stage: "awaiting_fx",
            stageReason: "Ожидаем конвертацию",
            quoteSummary: null,
            status: "submitted",
            type: "currency_exchange",
          },
        ],
      }),
    });

    const { getFinanceDeals } = await import(
      "@/features/treasury/deals/lib/queries"
    );

    const result = await getFinanceDeals({
      applicant: "ООО",
      blockerState: "clear",
      page: 2,
      perPage: 1,
      queue: "execution",
      sort: [{ id: "applicantName", desc: false }],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/v1/deals/finance/queues?applicant=%D0%9E%D0%9E%D0%9E&queue=execution",
      {
        cache: "no-store",
        headers: {
          cookie: "session=token",
          "x-bedrock-app-audience": "finance",
        },
      },
    );
    expect(result).toEqual({
      data: [
        expect.objectContaining({
          applicantName: "ООО Бета",
          blockerState: "clear",
          dealId: "8a35811e-b6ab-43f5-88ef-5dc8c9af4a8e",
        }),
      ],
      total: 2,
      limit: 1,
      offset: 1,
    });
  });

  it("filters blocker state locally before pagination", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        counts: {
          execution: 2,
          failed_instruction: 1,
          funding: 1,
        },
        filters: {},
        items: [
          {
            applicantName: "ООО Блок",
            blockingReasons: ["Required intake sections are incomplete"],
            createdAt: "2026-04-03T00:00:00.000Z",
            dealId: "8a35811e-b6ab-43f5-88ef-5dc8c9af4a8e",
            documentSummary: {
              attachmentCount: 1,
              formalDocumentCount: 2,
            },
            executionSummary: {
              blockedLegCount: 1,
              doneLegCount: 0,
              totalLegCount: 2,
            },
            internalEntityName: "Орг Б",
            nextAction: "Подготовить платеж",
            profitabilitySnapshot: null,
            queue: "execution",
            queueReason: "Сделка ожидает исполнения",
            stage: "awaiting_payout",
            stageReason: "Ожидаем выплату",
            quoteSummary: null,
            status: "awaiting_payment",
            type: "payment",
          },
          {
            applicantName: "ООО Ошибка",
            blockingReasons: [],
            createdAt: "2026-04-02T00:00:00.000Z",
            dealId: "b21972b4-aee0-45fb-86f8-b4175b42b39c",
            documentSummary: {
              attachmentCount: 0,
              formalDocumentCount: 1,
            },
            executionSummary: {
              blockedLegCount: 0,
              doneLegCount: 0,
              totalLegCount: 1,
            },
            internalEntityName: "Орг А",
            nextAction: "Проверить документы",
            profitabilitySnapshot: null,
            queue: "failed_instruction",
            queueReason: "Сделка заблокирована на этапе исполнения",
            stage: "awaiting_fx",
            stageReason: "Ожидаем конвертацию",
            quoteSummary: null,
            status: "submitted",
            type: "currency_exchange",
          },
          {
            applicantName: "ООО Чисто",
            blockingReasons: [],
            createdAt: "2026-04-01T00:00:00.000Z",
            dealId: "f26f1b6e-7509-480d-9b3c-caa836ea0ae5",
            documentSummary: {
              attachmentCount: 0,
              formalDocumentCount: 0,
            },
            executionSummary: {
              blockedLegCount: 0,
              doneLegCount: 0,
              totalLegCount: 1,
            },
            internalEntityName: "Орг В",
            nextAction: "Продолжить обработку",
            profitabilitySnapshot: null,
            queue: "funding",
            queueReason: "Сделка находится на этапе фондирования",
            stage: "awaiting_collection",
            stageReason: "Ожидаем поступление средств",
            quoteSummary: null,
            status: "draft",
            type: "payment",
          },
        ],
      }),
    });

    const { getFinanceDeals } = await import(
      "@/features/treasury/deals/lib/queries"
    );

    const blocked = await getFinanceDeals({
      blockerState: "blocked",
      page: 1,
      perPage: 1,
      sort: [{ id: "createdAt", desc: true }],
    });

    const clear = await getFinanceDeals({
      blockerState: "clear",
      page: 1,
      perPage: 10,
      sort: [{ id: "createdAt", desc: true }],
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:3000/v1/deals/finance/queues?",
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
      "http://localhost:3000/v1/deals/finance/queues?",
      {
        cache: "no-store",
        headers: {
          cookie: "session=token",
          "x-bedrock-app-audience": "finance",
        },
      },
    );
    expect(blocked).toEqual({
      data: [
        expect.objectContaining({
          applicantName: "ООО Блок",
          blockerState: "blocked",
        }),
      ],
      total: 2,
      limit: 1,
      offset: 0,
    });
    expect(clear).toEqual({
      data: [
        expect.objectContaining({
          applicantName: "ООО Чисто",
          blockerState: "clear",
        }),
      ],
      total: 1,
      limit: 10,
      offset: 0,
    });
  });

  it("returns null for an invalid deal id without hitting the API", async () => {
    const { getFinanceDealWorkspaceById } = await import(
      "@/features/treasury/deals/lib/queries"
    );

    await expect(getFinanceDealWorkspaceById("not-a-uuid")).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("loads breadcrumb summary without parsing unrelated quote fields", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ...createFinanceWorkspacePayload(),
        relatedResources: {
          ...createFinanceWorkspacePayload().relatedResources,
          quotes: [
            {
              expiresAt: "2026-04-02 09:15:00",
              id: "a68fcc97-b77c-43b0-a323-45b6f783fd3a",
              status: "active",
            },
          ],
        },
      }),
    });

    const { getFinanceDealBreadcrumbById } = await import(
      "@/features/treasury/deals/lib/queries"
    );

    await expect(
      getFinanceDealBreadcrumbById("614fb6eb-a1bd-429e-9628-e97d0f2efa0b"),
    ).resolves.toEqual({
      summary: expect.objectContaining({
        applicantDisplayName: "ООО Тест",
        id: "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
        type: "payment",
      }),
    });
  });

  it("normalizes non-ISO quote timestamps from finance workspace", async () => {
    const workspacePayload = createFinanceWorkspacePayload();
    const acceptedQuote = workspacePayload.acceptedQuote;

    if (!acceptedQuote) {
      throw new Error("expected accepted quote in workspace payload");
    }

    workspacePayload.acceptedQuote = {
      ...acceptedQuote,
      acceptedAt: "2026-04-02 08:15:00",
      expiresAt: "2026-04-02 09:15:00",
      usedAt: "2026-04-02 08:35:00",
    };
    workspacePayload.relatedResources.quotes = [
      {
        expiresAt: "2026-04-02 09:15:00",
        id: "a68fcc97-b77c-43b0-a323-45b6f783fd3a",
        status: "active",
      },
    ];

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => workspacePayload,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [],
      });

    const { getFinanceDealWorkbenchById } = await import(
      "@/features/treasury/deals/lib/queries"
    );

    await expect(
      getFinanceDealWorkbenchById("614fb6eb-a1bd-429e-9628-e97d0f2efa0b"),
    ).resolves.toEqual(
      expect.objectContaining({
        acceptedQuote: expect.objectContaining({
          acceptedAt: "2026-04-02T08:15:00Z",
          expiresAt: "2026-04-02T09:15:00Z",
          usedAt: "2026-04-02T08:35:00Z",
        }),
        relatedResources: expect.objectContaining({
          quotes: [
            expect.objectContaining({
              expiresAt: "2026-04-02T09:15:00Z",
            }),
          ],
        }),
      }),
    );
  });

  it("accepts treasury instruction timestamps serialized as strings in deal operations", async () => {
    const workspacePayload = createFinanceWorkspacePayload();

    workspacePayload.relatedResources.operations = [
      {
        actions: {
          canPrepareInstruction: false,
          canRequestReturn: false,
          canRetryInstruction: false,
          canSubmitInstruction: true,
          canVoidInstruction: false,
        },
        availableOutcomeTransitions: [],
        id: "114fb6eb-a1bd-429e-9628-e97d0f2efa0b",
        instructionStatus: "prepared",
        kind: "payout",
        latestInstruction: {
          attempt: 1,
          createdAt: "2026-04-02T08:20:00.000Z",
          failedAt: null,
          id: "214fb6eb-a1bd-429e-9628-e97d0f2efa0b",
          operationId: "114fb6eb-a1bd-429e-9628-e97d0f2efa0b",
          providerRef: null,
          providerSnapshot: null,
          returnRequestedAt: null,
          returnedAt: null,
          settledAt: null,
          sourceRef: "deal:614fb6eb-a1bd-429e-9628-e97d0f2efa0b:leg:2:payout:1",
          state: "prepared",
          submittedAt: null,
          updatedAt: "2026-04-02T08:21:00.000Z",
          voidedAt: null,
        },
        operationHref: "/treasury/operations/114fb6eb-a1bd-429e-9628-e97d0f2efa0b",
        projectedState: null,
        sourceRef: "deal:614fb6eb-a1bd-429e-9628-e97d0f2efa0b:leg:2:payout:1",
        state: "planned",
      },
    ];

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => workspacePayload,
    });

    const { getFinanceDealWorkspaceById } = await import(
      "@/features/treasury/deals/lib/queries"
    );

    await expect(
      getFinanceDealWorkspaceById("614fb6eb-a1bd-429e-9628-e97d0f2efa0b"),
    ).resolves.toEqual(
      expect.objectContaining({
        relatedResources: expect.objectContaining({
          operations: [
            expect.objectContaining({
              latestInstruction: expect.objectContaining({
                createdAt: expect.any(Date),
                updatedAt: expect.any(Date),
              }),
            }),
          ],
        }),
      }),
    );
  });

  it("merges finance workspace with quotes and calculations for the treasury workbench", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createFinanceWorkspacePayload(),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [
          {
            createdAt: "2026-04-02T08:20:00.000Z",
            dealDirection: "sell",
            dealForm: "spot",
            dealId: "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
            expiresAt: "2026-04-02T10:20:00.000Z",
            fromAmount: "125000.00",
            fromAmountMinor: "12500000",
            fromCurrency: "USD",
            fromCurrencyId: "fdcf4040-4a4e-4c90-b550-6898ab3789f4",
            id: "8a35811e-b6ab-43f5-88ef-5dc8c9af4a8e",
            idempotencyKey: "idem-1",
            pricingMode: "spot",
            pricingTrace: {},
            rateDen: "1",
            rateNum: "97.15",
            status: "active",
            toAmount: "12143750.00",
            toAmountMinor: "1214375000",
            toCurrency: "RUB",
            toCurrencyId: "45b2da57-4205-4607-a3ec-d0acbfb322ab",
            usedAt: null,
            usedByRef: null,
            usedDocumentId: null,
          },
          {
            createdAt: "2026-04-02T08:10:00.000Z",
            dealDirection: "sell",
            dealForm: "spot",
            dealId: "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
            expiresAt: "2026-04-02T09:10:00.000Z",
            fromAmount: "120000.00",
            fromAmountMinor: "12000000",
            fromCurrency: "USD",
            fromCurrencyId: "fdcf4040-4a4e-4c90-b550-6898ab3789f4",
            id: "b21972b4-aee0-45fb-86f8-b4175b42b39c",
            idempotencyKey: "idem-2",
            pricingMode: "spot",
            pricingTrace: {},
            rateDen: "1",
            rateNum: "96.40",
            status: "expired",
            toAmount: "11568000.00",
            toAmountMinor: "1156800000",
            toCurrency: "RUB",
            toCurrencyId: "45b2da57-4205-4607-a3ec-d0acbfb322ab",
            usedAt: null,
            usedByRef: null,
            usedDocumentId: null,
          },
        ],
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [
          {
            baseCurrencyId: "45b2da57-4205-4607-a3ec-d0acbfb322ab",
            calculationCurrencyId: "45b2da57-4205-4607-a3ec-d0acbfb322ab",
            calculationId: "7f6491b3-5226-4e34-a019-92a41315d642",
            calculationTimestamp: "2026-04-02T08:30:00.000Z",
            createdAt: "2026-04-02T08:30:00.000Z",
            totalFeeAmountMinor: "0",
            fxQuoteId: null,
            originalAmountMinor: "12500000",
            rateDen: "1",
            rateNum: "97.15",
            sourceQuoteId: "8a35811e-b6ab-43f5-88ef-5dc8c9af4a8e",
            totalAmountMinor: "1214375000",
            totalInBaseMinor: "1214375000",
            totalWithExpensesInBaseMinor: "1214375000",
          },
          {
            baseCurrencyId: "45b2da57-4205-4607-a3ec-d0acbfb322ab",
            calculationCurrencyId: "45b2da57-4205-4607-a3ec-d0acbfb322ab",
            calculationId: "df65ce76-7cb4-4eb0-b4c0-080cf2a70413",
            calculationTimestamp: "2026-04-02T08:12:00.000Z",
            createdAt: "2026-04-02T08:12:00.000Z",
            totalFeeAmountMinor: "0",
            fxQuoteId: null,
            originalAmountMinor: "12000000",
            rateDen: "1",
            rateNum: "96.40",
            sourceQuoteId: "b21972b4-aee0-45fb-86f8-b4175b42b39c",
            totalAmountMinor: "1156800000",
            totalInBaseMinor: "1156800000",
            totalWithExpensesInBaseMinor: "1156800000",
          },
        ],
      });

    const { getFinanceDealWorkbenchById } = await import(
      "@/features/treasury/deals/lib/queries"
    );

    const result = await getFinanceDealWorkbenchById(
      "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:3000/v1/deals/614fb6eb-a1bd-429e-9628-e97d0f2efa0b/finance-workspace",
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
      "http://localhost:3000/v1/deals/614fb6eb-a1bd-429e-9628-e97d0f2efa0b/quotes",
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
      "http://localhost:3000/v1/deals/614fb6eb-a1bd-429e-9628-e97d0f2efa0b/calculations",
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
        nextAction: "Create calculation from accepted quote",
        pricing: expect.objectContaining({
          quoteAmount: "125000.00",
          quoteAmountSide: "target",
          quoteEligibility: true,
          sourceCurrencyId: "fdcf4040-4a4e-4c90-b550-6898ab3789f4",
          targetCurrencyId: "0f9d972c-b95b-4544-95d8-8ccdc7496ed8",
        }),
        quoteHistory: [
          expect.objectContaining({
            createdAt: "2026-04-02T08:20:00.000Z",
            id: "8a35811e-b6ab-43f5-88ef-5dc8c9af4a8e",
          }),
          expect.objectContaining({
            createdAt: "2026-04-02T08:10:00.000Z",
            id: "b21972b4-aee0-45fb-86f8-b4175b42b39c",
          }),
        ],
        calculationHistory: [
          expect.objectContaining({
            calculationId: "7f6491b3-5226-4e34-a019-92a41315d642",
            createdAt: "2026-04-02T08:30:00.000Z",
          }),
          expect.objectContaining({
            calculationId: "df65ce76-7cb4-4eb0-b4c0-080cf2a70413",
            createdAt: "2026-04-02T08:12:00.000Z",
          }),
        ],
      }),
    );
  });

  it("keeps the workbench available when quote or calculation history endpoints return validation errors", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => createFinanceWorkspacePayload(),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => ({
          message: "Validation error",
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => ({
          message: "Validation error",
        }),
      });

    const { getFinanceDealWorkbenchById } = await import(
      "@/features/treasury/deals/lib/queries"
    );

    const result = await getFinanceDealWorkbenchById(
      "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
    );

    expect(result).toEqual(
      expect.objectContaining({
        calculationHistory: [],
        quoteHistory: [],
        summary: expect.objectContaining({
          id: "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
        }),
      }),
    );
  });
});
