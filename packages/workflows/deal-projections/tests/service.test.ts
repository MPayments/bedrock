import { describe, expect, it, vi } from "vitest";

import type { DealWorkflowProjection } from "@bedrock/deals/contracts";
import { MAX_QUERY_LIST_LIMIT } from "@bedrock/shared/core";

import { createDealProjectionsWorkflow } from "../src";

function createExecutionLeg(
  idx: number,
  kind: "collect" | "payout",
  state: "ready" | "pending",
) {
  return {
    fromCurrencyId: null,
    id: `leg-${idx}`,
    idx,
    kind,
    operationRefs: [],
    routeSnapshotLegId: null,
    state,
    toCurrencyId: null,
  };
}

function createBaseWorkflow(): DealWorkflowProjection {
  return {
    acceptedQuote: null,
    attachmentIngestions: [],
    executionPlan: [
      createExecutionLeg(1, "collect", "ready"),
      createExecutionLeg(2, "payout", "ready"),
    ],
    fundingResolution: {
      availableMinor: null,
      fundingOrganizationId: null,
      fundingRequisiteId: null,
      reasonCode: "not_applicable",
      requiredAmountMinor: null,
      state: "not_applicable",
      strategy: null,
      targetCurrency: null,
      targetCurrencyId: null,
    },
    intake: {
      common: {
        applicantCounterpartyId: "counterparty-1",
        customerNote: "customer note",
        requestedExecutionDate: new Date("2026-04-01T00:00:00.000Z"),
      },
      externalBeneficiary: {
        bankInstructionSnapshot: null,
        beneficiaryCounterpartyId: null,
        beneficiarySnapshot: null,
      },
      incomingReceipt: {
        contractNumber: null,
        expectedAmount: "1000",
        expectedAt: null,
        invoiceNumber: null,
        payerCounterpartyId: null,
        payerSnapshot: null,
      },
      moneyRequest: {
        purpose: "Pay supplier",
        sourceAmount: null,
        sourceCurrencyId: "currency-rub",
        targetCurrencyId: "currency-usd",
      },
      settlementDestination: {
        bankInstructionSnapshot: null,
        mode: null,
        requisiteId: null,
      },
      type: "payment",
    },
    nextAction: "Accept quote",
    operationalState: {
      positions: [
        {
          amountMinor: "100000",
          currencyId: "currency-rub",
          kind: "customer_receivable",
          reasonCode: null,
          sourceRefs: [],
          state: "ready",
          updatedAt: new Date("2026-04-01T00:00:00.000Z"),
        },
        {
          amountMinor: "100000",
          currencyId: "currency-rub",
          kind: "provider_payable",
          reasonCode: null,
          sourceRefs: [],
          state: "ready",
          updatedAt: new Date("2026-04-01T00:00:00.000Z"),
        },
      ],
    },
    participants: [
      {
        counterpartyId: null,
        customerId: "customer-1",
        displayName: "Customer One",
        id: "participant-customer",
        organizationId: null,
        role: "customer",
      },
      {
        counterpartyId: "counterparty-1",
        customerId: null,
        displayName: "Applicant One",
        id: "participant-applicant",
        organizationId: null,
        role: "applicant",
      },
      {
        counterpartyId: null,
        customerId: null,
        displayName: "Internal Org",
        id: "participant-org",
        organizationId: "organization-1",
        role: "internal_entity",
      },
    ],
    relatedResources: {
      attachments: [],
      calculations: [],
      formalDocuments: [],
      quotes: [],
    },
    revision: 1,
    sectionCompleteness: [
      {
        blockingReasons: [],
        complete: true,
        sectionId: "common",
      },
      {
        blockingReasons: [],
        complete: true,
        sectionId: "moneyRequest",
      },
    ],
    summary: {
      agreementId: "agreement-1",
      agentId: null,
      calculationId: null,
      createdAt: new Date("2026-04-01T00:00:00.000Z"),
      id: "deal-1",
      status: "submitted",
      type: "payment",
      updatedAt: new Date("2026-04-01T00:00:00.000Z"),
    },
    timeline: [
      {
        actor: {
          label: "Customer user",
          userId: "user-1",
        },
        id: "timeline-public-upload",
        occurredAt: new Date("2026-04-01T10:00:00.000Z"),
        payload: {
          attachmentId: "attachment-public",
          fileName: "invoice.pdf",
        },
        type: "attachment_uploaded",
        visibility: "customer_safe",
      },
      {
        actor: {
          label: "Operator",
          userId: "user-2",
        },
        id: "timeline-internal-upload",
        occurredAt: new Date("2026-04-01T11:00:00.000Z"),
        payload: {
          attachmentId: "attachment-internal",
          fileName: "ops-note.pdf",
        },
        type: "attachment_uploaded",
        visibility: "internal",
      },
    ],
    transitionReadiness: [],
  };
}

function createWorkflow(overrides?: {
  attachments?: {
    createdAt: Date;
    description: string | null;
    fileName: string;
    fileSize: number;
    id: string;
    mimeType: string;
    purpose: "contract" | "invoice" | "other" | null;
    updatedAt: Date;
    uploadedBy: string | null;
    visibility: "customer_safe" | "internal" | null;
  }[];
  calculation?: {
    createdAt: Date;
    currentSnapshot: {
      agreementVersionId: string | null;
      agreementFeeAmountMinor: string;
      agreementFeeBps: string;
      additionalExpensesAmountMinor: string;
      additionalExpensesCurrencyId: string | null;
      additionalExpensesInBaseMinor: string;
      fixedFeeAmountMinor: string;
      fixedFeeCurrencyId: string | null;
      baseCurrencyId: string;
      calculationCurrencyId: string;
      calculationTimestamp: Date;
      fxQuoteId: string | null;
      id: string;
      originalAmountMinor: string;
      pricingProvenance: Record<string, unknown> | null;
      quoteMarkupAmountMinor: string;
      quoteMarkupBps: string;
      quoteSnapshot: Record<string, unknown> | null;
      referenceRateAsOf: Date | null;
      referenceRateDen: string | null;
      referenceRateNum: string | null;
      referenceRateSource: "manual" | "fx_quote" | "cbr" | null;
      rateDen: string;
      rateNum: string;
      rateSource: "manual";
      snapshotNumber: number;
      totalFeeAmountInBaseMinor: string;
      totalFeeAmountMinor: string;
      totalFeeBps: string;
      totalAmountMinor: string;
      totalInBaseMinor: string;
      totalWithExpensesInBaseMinor: string;
      createdAt: Date;
      updatedAt: Date;
      additionalExpensesRateDen: string | null;
      additionalExpensesRateNum: string | null;
      additionalExpensesRateSource: "manual" | null;
    };
    id: string;
    isActive: boolean;
    lines: {
      amountMinor: string;
      createdAt: Date;
      currencyId: string;
      id: string;
      idx: number;
      kind: string;
      updatedAt: Date;
    }[];
    updatedAt: Date;
  } | null;
  treasuryQuotes?: {
    createdAt: Date;
    dealDirection: string | null;
    dealForm: string | null;
    dealId: string | null;
    expiresAt: Date;
    fromAmountMinor: bigint;
    fromCurrency: string;
    fromCurrencyId: string;
    id: string;
    idempotencyKey: string;
    pricingMode: string;
    pricingTrace: Record<string, unknown>;
    rateDen: bigint;
    rateNum: bigint;
    status: string;
    toAmountMinor: bigint;
    toCurrency: string;
    toCurrencyId: string;
    usedAt: Date | null;
    usedByRef: string | null;
    usedDocumentId: string | null;
  }[];
  treasuryOperations?: {
    amountMinor: bigint | null;
    counterAmountMinor: bigint | null;
    counterCurrencyId: string | null;
    createdAt: Date;
    currencyId: string | null;
    customerId: string | null;
    dealId: string | null;
    id: string;
    internalEntityOrganizationId: string | null;
    kind: "payin" | "payout" | "fx_conversion" | "intracompany_transfer" | "intercompany_funding";
    quoteId: string | null;
    sourceRef: string;
    state: "planned";
    updatedAt: Date;
  }[];
  latestInstructions?: {
    attempt: number;
    createdAt: Date;
    id: string;
    operationId: string;
    providerRef: string | null;
    providerSnapshot: Record<string, unknown> | null;
    sourceRef: string;
    state:
      | "prepared"
      | "submitted"
      | "settled"
      | "failed"
      | "voided"
      | "return_requested"
      | "returned";
    updatedAt: Date;
  }[];
  reconciliationLinks?: {
    exceptions: {
      createdAt: Date;
      externalRecordId: string;
      id: string;
      operationId: string;
      reasonCode: string;
      resolvedAt: Date | null;
      source: string;
      state: "open" | "resolved" | "ignored";
    }[];
    lastActivityAt: Date | null;
    matchCount: number;
    operationId: string;
  }[];
  workflow?: ReturnType<typeof createBaseWorkflow>;
}) {
  const workflow = overrides?.workflow ?? createBaseWorkflow();
  const attachments = overrides?.attachments ?? [
    {
      createdAt: new Date("2026-04-01T10:00:00.000Z"),
      description: null,
      fileName: "invoice.pdf",
      fileSize: 1024,
      id: "attachment-public",
      mimeType: "application/pdf",
      purpose: "invoice",
      updatedAt: new Date("2026-04-01T10:00:00.000Z"),
      uploadedBy: "user-1",
      visibility: "customer_safe",
    },
    {
      createdAt: new Date("2026-04-01T11:00:00.000Z"),
      description: null,
      fileName: "ops-note.pdf",
      fileSize: 2048,
      id: "attachment-internal",
      mimeType: "application/pdf",
      purpose: "other",
      updatedAt: new Date("2026-04-01T11:00:00.000Z"),
      uploadedBy: "user-2",
      visibility: "internal",
    },
  ];

  const deals = {
    deals: {
      queries: {
        findById: vi.fn(async () => ({
          approvals: [],
        })),
        findPricingContextByDealId: vi.fn(async () => ({
          commercialDraft: {
            fixedFeeAmount: null,
            fixedFeeCurrency: null,
            quoteMarkupBps: null,
          },
          fundingAdjustments: [],
          revision: 1,
          routeAttachment: null,
        })),
        findWorkflowById: vi.fn(async () => workflow),
        list: vi.fn(async () => ({
          data: [
            {
              agreementId: workflow.summary.agreementId,
              amount:
                workflow.summary.type === "payment"
                  ? workflow.intake.incomingReceipt.expectedAmount
                  : workflow.intake.moneyRequest.sourceAmount,
              agentId: workflow.summary.agentId,
              calculationId: workflow.summary.calculationId,
              comment: workflow.intake.common.customerNote,
              currencyId:
                workflow.summary.type === "payment"
                  ? workflow.intake.moneyRequest.targetCurrencyId
                  : workflow.intake.moneyRequest.sourceCurrencyId,
              createdAt: workflow.summary.createdAt,
              customerId:
                workflow.participants.find((participant) => participant.role === "customer")
                  ?.customerId ?? "customer-1",
              id: workflow.summary.id,
              intakeComment: workflow.intake.common.customerNote,
              nextAction: workflow.nextAction,
              reason: workflow.intake.moneyRequest.purpose,
              revision: workflow.revision,
              status: workflow.summary.status,
              type: workflow.summary.type,
              updatedAt: workflow.summary.updatedAt,
            },
          ],
          limit: MAX_QUERY_LIST_LIMIT,
          offset: 0,
          total: 1,
        })),
        listCalculationHistory: vi.fn(async () => []),
      },
    },
  };

  return createDealProjectionsWorkflow({
    agreements: {
      agreements: {
        queries: {
          findById: vi.fn(async () => null),
        },
      },
    } as never,
    calculations: {
      calculations: {
        queries: {
          findById: vi.fn(async () => overrides?.calculation ?? null),
        },
      },
    } as never,
    currencies: {
      findById: vi.fn(async (id: string) => ({
        code: id === "currency-usd" ? "USD" : "RUB",
        id,
        precision: 2,
      })),
    } as never,
    deals: deals as never,
    documentsReadModel: {
      listDealTraceRowsByDealId: vi.fn(async () => []),
    },
    files: {
      files: {
        queries: {
          listCurrentFileVersionsByAssetIds: vi.fn(async () => []),
          listDealAttachments: vi.fn(async () => attachments),
        },
      },
    } as never,
    iam: {
      queries: {
        findById: vi.fn(async () => ({
          id: "user-1",
          name: "Operator One",
        })),
      },
    } as never,
    parties: {
      counterparties: {
        queries: {
          findById: vi.fn(async () => null),
          list: vi.fn(async () => ({
            data: [],
            limit: MAX_QUERY_LIST_LIMIT,
            offset: 0,
            total: 0,
          })),
        },
      },
      customers: {
        queries: {
          findById: vi.fn(async () => ({
            description: "Customer description",
            name: "Customer One",
            externalRef: "cust-001",
            id: "customer-1",
          })),
          listByIds: vi.fn(async () => [
            {
              description: "Customer description",
              name: "Customer One",
              externalRef: "cust-001",
              id: "customer-1",
            },
          ]),
        },
      },
      organizations: {
        queries: {
          findById: vi.fn(async () => null),
        },
      },
      requisites: {
        queries: {
          findById: vi.fn(async () => null),
          findProviderById: vi.fn(async () => null),
        },
      },
    } as never,
    reconciliation: {
      links: {
        listOperationLinks: vi.fn(
          async () => overrides?.reconciliationLinks ?? [],
        ),
      },
    } as never,
    treasury: {
      instructions: {
        queries: {
          listArtifactsByInstructionIds: vi.fn(async () => []),
          listByOperationIds: vi.fn(
            async () => overrides?.latestInstructions ?? [],
          ),
          listLatestByOperationIds: vi.fn(
            async () => overrides?.latestInstructions ?? [],
          ),
        },
      },
      operations: {
        queries: {
          list: vi.fn(async () => ({
            data: overrides?.treasuryOperations ?? [],
            limit: MAX_QUERY_LIST_LIMIT,
            offset: 0,
            total: overrides?.treasuryOperations?.length ?? 0,
          })),
        },
      },
      quotes: {
        queries: {
          listQuotes: vi.fn(async () => ({
            data: overrides?.treasuryQuotes ?? [],
            limit: MAX_QUERY_LIST_LIMIT,
            offset: 0,
            total: overrides?.treasuryQuotes?.length ?? 0,
          })),
        },
      },
    } as never,
  });
}

describe("createDealProjectionsWorkflow", () => {
  it("filters portal projections to customer-safe timeline and attachments", async () => {
    const workflow = createWorkflow();

    const projection = await workflow.getPortalDealProjection("deal-1", "customer-1");

    expect(projection).not.toBeNull();
    expect(projection?.attachments).toEqual([
      {
        createdAt: new Date("2026-04-01T10:00:00.000Z"),
        fileName: "invoice.pdf",
        id: "attachment-public",
        ingestionStatus: null,
        purpose: "invoice",
      },
    ]);
    expect(projection?.timeline).toHaveLength(1);
    expect(projection?.summary.applicantDisplayName).toBe("Applicant One");
    expect(projection?.customerSafeIntake).toMatchObject({
      sourceCurrencyCode: "RUB",
      targetCurrencyCode: "USD",
    });
    expect(projection?.submissionCompleteness.complete).toBe(true);
    expect(projection?.requiredActions).toContain("Ожидайте или примите котировку");
  });

  it("marks payment portal submission incomplete when customer invoice is missing", async () => {
    const workflow = createWorkflow({
      attachments: [],
      workflow: {
        ...createBaseWorkflow(),
        nextAction: "Prepare documents",
      },
    });

    const projection = await workflow.getPortalDealProjection("deal-1", "customer-1");

    expect(projection).not.toBeNull();
    expect(projection?.submissionCompleteness).toEqual({
      blockingReasons: ["Загрузите инвойс"],
      complete: false,
    });
    expect(projection?.nextAction).toBe("Загрузите инвойс");
    expect(projection?.requiredActions).toContain("Загрузите инвойс");
  });

  it("classifies blocked downstream execution into the failed instruction queue", async () => {
    const workflowState = createBaseWorkflow();
    const blockedWorkflow: DealWorkflowProjection = {
      ...workflowState,
      summary: {
        ...workflowState.summary,
        calculationId: "calculation-1",
      },
      executionPlan: workflowState.executionPlan.map((leg) =>
        leg.kind === "payout" ? { ...leg, state: "blocked" } : leg,
      ),
      operationalState: {
        ...workflowState.operationalState,
        positions: workflowState.operationalState.positions.map((position) =>
          position.kind === "provider_payable"
            ? {
                ...position,
                reasonCode: "provider_timeout",
                state: "blocked",
              }
            : position,
        ),
      },
      transitionReadiness: [
        {
          allowed: false,
          blockers: [
            {
              code: "operational_position_blocked",
              message: "Провайдерская выплата заблокирована",
            },
          ],
          targetStatus: "awaiting_payment",
        },
      ],
    };

    const workflow = createWorkflow({
      calculation: {
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
        currentSnapshot: {
          agreementVersionId: null,
          agreementFeeAmountMinor: "100",
          agreementFeeBps: "100",
          additionalExpensesAmountMinor: "0",
          additionalExpensesCurrencyId: null,
          additionalExpensesInBaseMinor: "0",
          additionalExpensesRateDen: null,
          additionalExpensesRateNum: null,
          additionalExpensesRateSource: null,
          baseCurrencyId: "currency-rub",
          calculationCurrencyId: "currency-rub",
          calculationTimestamp: new Date("2026-04-01T00:00:00.000Z"),
          createdAt: new Date("2026-04-01T00:00:00.000Z"),
          fixedFeeAmountMinor: "0",
          fixedFeeCurrencyId: null,
          fxQuoteId: null,
          id: "snapshot-1",
          originalAmountMinor: "100000",
          pricingProvenance: null,
          quoteMarkupAmountMinor: "0",
          quoteMarkupBps: "0",
          quoteSnapshot: null,
          referenceRateAsOf: null,
          referenceRateDen: null,
          referenceRateNum: null,
          referenceRateSource: null,
          rateDen: "1",
          rateNum: "1",
          rateSource: "manual",
          snapshotNumber: 1,
          totalFeeAmountInBaseMinor: "100",
          totalFeeAmountMinor: "100",
          totalFeeBps: "100",
          totalAmountMinor: "100100",
          totalInBaseMinor: "100100",
          totalWithExpensesInBaseMinor: "100100",
          updatedAt: new Date("2026-04-01T00:00:00.000Z"),
        },
        id: "calculation-1",
        isActive: true,
        lines: [
          {
            amountMinor: "100",
            createdAt: new Date("2026-04-01T00:00:00.000Z"),
            currencyId: "currency-rub",
            id: "line-1",
            idx: 0,
            kind: "fee_revenue",
            updatedAt: new Date("2026-04-01T00:00:00.000Z"),
          },
          {
            amountMinor: "250",
            createdAt: new Date("2026-04-01T00:00:00.000Z"),
            currencyId: "currency-rub",
            id: "line-2",
            idx: 1,
            kind: "spread_revenue",
            updatedAt: new Date("2026-04-01T00:00:00.000Z"),
          },
        ],
        updatedAt: new Date("2026-04-01T00:00:00.000Z"),
      },
      workflow: blockedWorkflow,
    });

    const projection = await workflow.listFinanceDealQueues({
      queue: "failed_instruction",
    });

    expect(projection.counts.failed_instruction).toBe(1);
    expect(projection.items).toHaveLength(1);
    expect(projection.items[0]).toMatchObject({
      applicantName: "Customer One",
      dealId: "deal-1",
      createdAt: new Date("2026-04-01T00:00:00.000Z"),
      queue: "failed_instruction",
      queueReason: "Сделка заблокирована на этапе исполнения",
      profitabilitySnapshot: {
        feeRevenue: [
          {
            amountMinor: "100",
            currencyCode: "RUB",
            currencyId: "currency-rub",
          },
        ],
        spreadRevenue: [
          {
            amountMinor: "250",
            currencyCode: "RUB",
            currencyId: "currency-rub",
          },
        ],
        totalRevenue: [
          {
            amountMinor: "350",
            currencyCode: "RUB",
            currencyId: "currency-rub",
          },
        ],
      },
    });
    expect(projection.items[0]?.blockingReasons).toContain(
      "Провайдерская выплата заблокирована",
    );
  });

  it("returns CRM quote history with currencies, amounts, and rate", async () => {
    const workflow = createWorkflow({
      treasuryQuotes: [
        {
          createdAt: new Date("2026-04-01T10:00:00.000Z"),
          dealDirection: "buy",
          dealForm: "spot",
          dealId: "deal-1",
          expiresAt: new Date("2026-04-01T12:00:00.000Z"),
          fromAmountMinor: 10000000n,
          fromCurrency: "RUB",
          fromCurrencyId: "currency-rub",
          id: "quote-1",
          idempotencyKey: "idem-1",
          pricingMode: "auto_cross",
          pricingTrace: {},
          rateDen: 10000n,
          rateNum: 91n,
          status: "active",
          toAmountMinor: 91000n,
          toCurrency: "USD",
          toCurrencyId: "currency-usd",
          usedAt: null,
          usedByRef: null,
          usedDocumentId: null,
        },
      ],
      workflow: {
        ...createBaseWorkflow(),
        acceptedQuote: {
          acceptedAt: new Date("2026-04-01T10:05:00.000Z"),
          acceptedByUserId: "user-1",
          agreementVersionId: null,
          dealId: "deal-1",
          dealRevision: 1,
          expiresAt: new Date("2026-04-01T12:00:00.000Z"),
          id: "acceptance-1",
          quoteId: "quote-1",
          quoteStatus: "active",
          replacedByQuoteId: null,
          revocationReason: null,
          revokedAt: null,
          usedAt: null,
          usedDocumentId: null,
        },
      },
    });

    const projection = await workflow.getCrmDealWorkbenchProjection("deal-1");

    expect(projection).not.toBeNull();
    expect(projection?.pricing.quotes).toEqual([
      expect.objectContaining({
        fromAmountMinor: "10000000",
        fromCurrency: "RUB",
        id: "quote-1",
        rateDen: "10000",
        rateNum: "91",
        toAmountMinor: "91000",
        toCurrency: "USD",
      }),
    ]);
  });

  it("builds CRM board projections when quote expiry timestamps arrive as strings", async () => {
    const workflow = createWorkflow({
      workflow: {
        ...createBaseWorkflow(),
        relatedResources: {
          ...createBaseWorkflow().relatedResources,
          quotes: [
            {
              expiresAt:
                "2026-04-01T12:00:00.000Z" as unknown as Date | null,
              id: "quote-1",
              status: "active",
            },
          ],
        },
      },
    });

    const projection = await workflow.listCrmDealBoard();

    expect(projection.items).toHaveLength(1);
    expect(projection.items[0]?.quoteSummary).toEqual({
      expiresAt: new Date("2026-04-01T12:00:00.000Z"),
      quoteId: "quote-1",
      status: "active",
    });
  });

  it("builds CRM list projections without route-owned SQL", async () => {
    const workflow = createWorkflow();

    const projection = await workflow.listCrmDeals({
      limit: 20,
      offset: 0,
      sortBy: "createdAt",
      sortOrder: "desc",
    });

    expect(projection).toEqual({
      data: [
        expect.objectContaining({
          agentName: "",
          amount: 1000,
          amountInBase: 1000,
          baseCurrencyCode: "USD",
          client: "Customer One",
          clientId: "customer-1",
          currency: "USD",
          feePercentage: 0,
          id: "deal-1",
          status: "submitted",
        }),
      ],
      limit: 20,
      offset: 0,
      total: 1,
    });
  });

  it("builds CRM stats, buckets, and daily aggregates from workflow dependencies", async () => {
    const workflow = createWorkflow({
      workflow: {
        ...createBaseWorkflow(),
        summary: {
          ...createBaseWorkflow().summary,
          status: "done",
        },
      },
    });

    const [stats, buckets, byDay] = await Promise.all([
      workflow.getCrmDealsStats({
        dateFrom: "2026-04-01",
        dateTo: "2026-04-30",
      }),
      workflow.listCrmDealsByStatus(),
      workflow.listCrmDealsByDay({
        dateFrom: "2026-04-01",
      }),
    ]);

    expect(stats).toEqual({
      byStatus: { done: 1 },
      totalAmount: "100000",
      totalCount: 1,
    });
    expect(buckets.done).toEqual([
      expect.objectContaining({
        amount: 1000,
        amountInBase: 1000,
        baseCurrencyCode: "USD",
        client: "Customer One",
        currency: "USD",
        id: "deal-1",
      }),
    ]);
    expect(byDay).toEqual([
      expect.objectContaining({
        USD: 1000,
        amount: 1000,
        closedAmount: 1000,
        closedCount: 1,
        count: 1,
        date: "2026-04-01",
      }),
    ]);
  });

  it("returns day aggregates in the selected report currency without relabeling mixed totals", async () => {
    const workflow = createWorkflow();

    const byDay = await workflow.listCrmDealsByDay({
      dateFrom: "2026-04-01",
      reportCurrencyCode: "USD",
    });

    expect(byDay).toEqual([
      expect.objectContaining({
        USD: 1000,
        amount: 1000,
        closedAmount: 0,
        closedCount: 0,
        count: 1,
        date: "2026-04-01",
      }),
    ]);
  });

  it("returns treasury-only workspace actions and requirements for finance", async () => {
    const workflow = createWorkflow({
      calculation: {
        createdAt: new Date("2026-04-01T09:00:00.000Z"),
        currentSnapshot: {
          agreementVersionId: null,
          agreementFeeAmountMinor: "100",
          agreementFeeBps: "100",
          additionalExpensesAmountMinor: "0",
          additionalExpensesCurrencyId: null,
          additionalExpensesInBaseMinor: "0",
          additionalExpensesRateDen: null,
          additionalExpensesRateNum: null,
          additionalExpensesRateSource: null,
          baseCurrencyId: "currency-rub",
          calculationCurrencyId: "currency-rub",
          calculationTimestamp: new Date("2026-04-01T09:00:00.000Z"),
          createdAt: new Date("2026-04-01T09:00:00.000Z"),
          fixedFeeAmountMinor: "0",
          fixedFeeCurrencyId: null,
          fxQuoteId: null,
          id: "snapshot-1",
          originalAmountMinor: "100000",
          pricingProvenance: null,
          quoteMarkupAmountMinor: "0",
          quoteMarkupBps: "0",
          quoteSnapshot: null,
          referenceRateAsOf: null,
          referenceRateDen: null,
          referenceRateNum: null,
          referenceRateSource: null,
          rateDen: "1",
          rateNum: "1",
          rateSource: "manual",
          snapshotNumber: 1,
          totalFeeAmountInBaseMinor: "100",
          totalFeeAmountMinor: "100",
          totalFeeBps: "100",
          totalAmountMinor: "600",
          totalInBaseMinor: "600",
          totalWithExpensesInBaseMinor: "600",
          updatedAt: new Date("2026-04-01T09:00:00.000Z"),
        },
        id: "calculation-1",
        isActive: true,
        lines: [
          {
            amountMinor: "100",
            createdAt: new Date("2026-04-01T09:00:00.000Z"),
            currencyId: "currency-rub",
            id: "line-1",
            idx: 0,
            kind: "fee_revenue",
            updatedAt: new Date("2026-04-01T09:00:00.000Z"),
          },
          {
            amountMinor: "250",
            createdAt: new Date("2026-04-01T09:00:00.000Z"),
            currencyId: "currency-rub",
            id: "line-2",
            idx: 1,
            kind: "provider_fee_expense",
            updatedAt: new Date("2026-04-01T09:00:00.000Z"),
          },
          {
            amountMinor: "500",
            createdAt: new Date("2026-04-01T09:00:00.000Z"),
            currencyId: "currency-rub",
            id: "line-3",
            idx: 2,
            kind: "spread_revenue",
            updatedAt: new Date("2026-04-01T09:00:00.000Z"),
          },
        ],
        updatedAt: new Date("2026-04-01T09:00:00.000Z"),
      },
      latestInstructions: [
        {
          attempt: 1,
          createdAt: new Date("2026-04-01T10:00:00.000Z"),
          id: "instruction-1",
          operationId: "operation-1",
          providerRef: null,
          providerSnapshot: null,
          sourceRef: "source-1",
          state: "settled",
          updatedAt: new Date("2026-04-01T10:00:00.000Z"),
        },
      ],
      reconciliationLinks: [
        {
          exceptions: [
            {
              createdAt: new Date("2026-04-01T11:00:00.000Z"),
              externalRecordId: "external-record-1",
              id: "exception-1",
              operationId: "operation-1",
              reasonCode: "no_match",
              resolvedAt: null,
              source: "bank_statement",
              state: "open",
            },
          ],
          lastActivityAt: new Date("2026-04-01T11:00:00.000Z"),
          matchCount: 0,
          operationId: "operation-1",
        },
      ],
      treasuryOperations: [
        {
          amountMinor: 10000000n,
          counterAmountMinor: null,
          counterCurrencyId: null,
          createdAt: new Date("2026-04-01T09:00:00.000Z"),
          currencyId: "currency-rub",
          customerId: "customer-1",
          dealId: "deal-1",
          id: "operation-1",
          internalEntityOrganizationId: "organization-1",
          kind: "payout",
          quoteId: null,
          sourceRef: "deal:deal-1:leg:1:payout:1",
          state: "planned",
          updatedAt: new Date("2026-04-01T09:00:00.000Z"),
        },
      ],
      treasuryQuotes: [
        {
          createdAt: new Date("2026-04-01T09:00:00.000Z"),
          dealDirection: "buy",
          dealForm: "spot",
          dealId: "deal-1",
          expiresAt: new Date("2026-04-01T12:00:00.000Z"),
          fromAmountMinor: 10000000n,
          fromCurrency: "RUB",
          fromCurrencyId: "currency-rub",
          id: "quote-1",
          idempotencyKey: "idem-1",
          pricingMode: "auto_cross",
          pricingTrace: {},
          rateDen: 10000n,
          rateNum: 91n,
          status: "active",
          toAmountMinor: 91000n,
          toCurrency: "USD",
          toCurrencyId: "currency-usd",
          usedAt: null,
          usedByRef: null,
          usedDocumentId: null,
        },
      ],
      workflow: {
        ...createBaseWorkflow(),
        executionPlan: [
          {
            fromCurrencyId: null,
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
            routeSnapshotLegId: null,
            state: "ready",
            toCurrencyId: null,
          },
        ],
        acceptedQuote: {
          acceptedAt: new Date("2026-04-01T09:00:00.000Z"),
          acceptedByUserId: "user-2",
          agreementVersionId: null,
          dealId: "deal-1",
          dealRevision: 1,
          expiresAt: new Date("2026-04-01T12:00:00.000Z"),
          id: "quote-acceptance-1",
          quoteId: "quote-1",
          quoteStatus: "active",
          replacedByQuoteId: null,
          revocationReason: null,
          revokedAt: null,
          usedAt: null,
          usedDocumentId: null,
        },
        relatedResources: {
          attachments: [],
          calculations: [],
          formalDocuments: [
            {
              approvalStatus: "approved",
              createdAt: new Date("2026-04-01T10:00:00.000Z"),
              docType: "acceptance",
              id: "document-1",
              lifecycleStatus: "active",
              occurredAt: new Date("2026-04-01T10:00:00.000Z"),
              postingStatus: "posted",
              submissionStatus: "submitted",
            },
          ],
          quotes: [
            {
              expiresAt: new Date("2026-04-01T12:00:00.000Z"),
              id: "quote-1",
              status: "active",
            },
          ],
        },
        summary: {
          ...createBaseWorkflow().summary,
          calculationId: "calculation-1",
        },
      },
    });

    const projection = await workflow.getFinanceDealWorkspaceProjection("deal-1");

    expect(projection).not.toBeNull();
    expect(projection).toMatchObject({
      acceptedQuoteDetails: {
        fromAmount: "100000",
        fromCurrency: "RUB",
        id: "quote-1",
        rateDen: "10000",
        rateNum: "91",
        toAmount: "910",
        toCurrency: "USD",
      },
      actions: {
        canCreateCalculation: false,
        canCreateQuote: false,
        canUploadAttachment: true,
      },
      attachmentRequirements: [
        {
          code: "invoice",
          state: "provided",
        },
        {
          code: "contract",
          state: "not_required",
        },
      ],
      formalDocumentRequirements: [
        {
          createAllowed: true,
          docType: "invoice",
          openAllowed: false,
          state: "missing",
        },
        {
          createAllowed: false,
          docType: "acceptance",
          openAllowed: true,
          state: "ready",
        },
      ],
      pricing: {
        quoteAmount: "1000",
        quoteAmountSide: "target",
        quoteEligibility: false,
        sourceCurrencyId: "currency-rub",
        targetCurrencyId: "currency-usd",
      },
      profitabilitySnapshot: {
        calculationId: "calculation-1",
        feeRevenue: [
          {
            amountMinor: "100",
            currencyCode: "RUB",
            currencyId: "currency-rub",
          },
        ],
        providerFeeExpense: [
          {
            amountMinor: "250",
            currencyCode: "RUB",
            currencyId: "currency-rub",
          },
        ],
        spreadRevenue: [
          {
            amountMinor: "500",
            currencyCode: "RUB",
            currencyId: "currency-rub",
          },
        ],
        totalRevenue: [
          {
            amountMinor: "600",
            currencyCode: "RUB",
            currencyId: "currency-rub",
          },
        ],
      },
      cashflowSummary: {
        receivedIn: [],
        scheduledOut: [],
        settledOut: [
          {
            amountMinor: "10000000",
            currencyCode: "RUB",
            currencyId: "currency-rub",
          },
        ],
      },
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
      reconciliationSummary: {
        ignoredExceptionCount: 0,
        lastActivityAt: new Date("2026-04-01T11:00:00.000Z"),
        openExceptionCount: 1,
        pendingOperationCount: 0,
        reconciledOperationCount: 1,
        requiredOperationCount: 1,
        resolvedExceptionCount: 0,
        state: "blocked",
      },
      closeReadiness: {
        blockers: expect.arrayContaining([
          "Есть открытые исключения сверки",
        ]),
        criteria: expect.arrayContaining([
          expect.objectContaining({
            code: "reconciliation_clear",
            satisfied: false,
          }),
          expect.objectContaining({
            code: "payment_payout_settled",
            satisfied: true,
          }),
        ]),
        ready: false,
      },
      relatedResources: {
        reconciliationExceptions: [
          expect.objectContaining({
            id: "exception-1",
            operationId: "operation-1",
          }),
        ],
      },
    });
  });

  it("keeps createAllowed disabled for missing formal documents when commercial writes are blocked", async () => {
    const workflow = createWorkflow({
      workflow: {
        ...createBaseWorkflow(),
        summary: {
          ...createBaseWorkflow().summary,
          status: "draft",
        },
      },
    });

    const projection = await workflow.getFinanceDealWorkspaceProjection("deal-1");

    expect(projection).not.toBeNull();
    expect(projection?.formalDocumentRequirements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          createAllowed: false,
          docType: "invoice",
          openAllowed: false,
          state: "missing",
        }),
      ]),
    );
  });
});
