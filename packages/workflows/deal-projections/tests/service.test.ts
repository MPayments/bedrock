import { describe, expect, it, vi } from "vitest";

import { MAX_QUERY_LIST_LIMIT } from "@bedrock/shared/core";
import type { DealWorkflowProjection } from "@bedrock/deals/contracts";

import { createDealProjectionsWorkflow } from "../src";

function createBaseWorkflow(): DealWorkflowProjection {
  return {
    acceptedQuote: null,
    attachmentIngestions: [],
    executionPlan: [
      {
        idx: 1,
        kind: "collect",
        state: "ready",
      },
      {
        idx: 2,
        kind: "payout",
        state: "ready",
      },
    ],
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
        expectedAmount: null,
        expectedAt: null,
        expectedCurrencyId: null,
        invoiceNumber: null,
        payerCounterpartyId: null,
        payerSnapshot: null,
      },
      moneyRequest: {
        purpose: "Pay supplier",
        sourceAmount: "1000",
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
      capabilities: [],
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
  attachments?: Array<{
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
  }>;
  calculation?: {
    createdAt: Date;
    currentSnapshot: {
      additionalExpensesAmountMinor: string;
      additionalExpensesCurrencyId: string | null;
      additionalExpensesInBaseMinor: string;
      baseCurrencyId: string;
      calculationCurrencyId: string;
      calculationTimestamp: Date;
      feeAmountInBaseMinor: string;
      feeAmountMinor: string;
      feeBps: string;
      fxQuoteId: string | null;
      id: string;
      originalAmountMinor: string;
      quoteSnapshot: Record<string, unknown> | null;
      rateDen: string;
      rateNum: string;
      rateSource: "manual";
      snapshotNumber: number;
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
    lines: Array<{
      amountMinor: string;
      createdAt: Date;
      currencyId: string;
      id: string;
      idx: number;
      kind: string;
      updatedAt: Date;
    }>;
    updatedAt: Date;
  } | null;
  treasuryQuotes?: Array<{
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
  }>;
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
        findWorkflowById: vi.fn(async () => workflow),
        list: vi.fn(async () => ({
          data: [{ id: workflow.summary.id }],
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
    deals: deals as never,
    documentsReadModel: {
      listDealTraceRowsByDealId: vi.fn(async () => []),
    },
    files: {
      files: {
        queries: {
          listDealAttachments: vi.fn(async () => attachments),
        },
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
            displayName: "Customer One",
            externalRef: "cust-001",
            id: "customer-1",
          })),
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
    treasury: {
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
          feeAmountInBaseMinor: "100",
          feeAmountMinor: "100",
          feeBps: "100",
          fxQuoteId: null,
          id: "snapshot-1",
          originalAmountMinor: "100000",
          quoteSnapshot: null,
          rateDen: "1",
          rateNum: "1",
          rateSource: "manual",
          snapshotNumber: 1,
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
      dealId: "deal-1",
      createdAt: new Date("2026-04-01T00:00:00.000Z"),
      queue: "failed_instruction",
      queueReason: "Сделка заблокирована на этапе исполнения",
      profitabilitySnapshot: {
        feeRevenueMinor: "100",
        spreadRevenueMinor: "250",
        totalRevenueMinor: "350",
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

  it("returns treasury-only workspace actions and requirements for finance", async () => {
    const workflow = createWorkflow({
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
          revokedAt: null,
          usedAt: null,
          usedDocumentId: null,
        },
        relatedResources: {
          attachments: [],
          calculations: [],
          formalDocuments: [],
          quotes: [
            {
              expiresAt: new Date("2026-04-01T12:00:00.000Z"),
              id: "quote-1",
              status: "active",
            },
          ],
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
          docType: "invoice",
          state: "missing",
        },
        {
          docType: "acceptance",
          state: "missing",
        },
      ],
      pricing: {
        quoteEligibility: false,
        requestedAmount: "1000",
        requestedCurrencyId: "currency-rub",
        targetCurrencyId: "currency-usd",
      },
    });
  });
});
