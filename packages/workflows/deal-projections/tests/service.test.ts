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
    id: `leg-${idx}`,
    idx,
    kind,
    operationRefs: [],
    state,
  };
}

function createBaseWorkflow(): DealWorkflowProjection {
  const header = {
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
      expectedCurrencyId: "currency-usd",
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
    type: "payment" as const,
  };

  return {
    acceptedCalculation: null,
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
    header,
    nextAction: "Accept calculation",
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
      status: "quoted",
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
      routeSnapshot?: Record<string, unknown> | null;
      routeVersionId?: string | null;
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
      classification?: "revenue" | "expense" | "pass_through" | "adjustment" | null;
      componentFamily?: string | null;
      createdAt: Date;
      currencyId: string;
      id: string;
      idx: number;
      kind: string;
      routeLegId?: string | null;
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
  treasuryFacts?: {
    amountMinor: string | null;
    confirmedAt: Date | null;
    counterAmountMinor: string | null;
    counterCurrencyId: string | null;
    createdAt: Date;
    currencyId: string | null;
    dealId: string | null;
    externalRecordId: string | null;
    feeAmountMinor: string | null;
    feeCurrencyId: string | null;
    id: string;
    instructionId: string | null;
    metadata: Record<string, unknown> | null;
    notes: string | null;
    operationId: string;
    providerRef: string | null;
    recordedAt: Date;
    routeLegId: string | null;
    sourceKind: "manual" | "provider" | "reconciliation" | "system";
    sourceRef: string;
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
        findWorkflowById: vi.fn(async () => workflow),
        list: vi.fn(async () => ({
          data: [
            {
              agreementId: workflow.summary.agreementId,
              amount:
                workflow.summary.type === "payment"
                  ? workflow.header.incomingReceipt.expectedAmount
                  : workflow.header.moneyRequest.sourceAmount,
              agentId: workflow.summary.agentId,
              calculationId: workflow.summary.calculationId,
              comment: workflow.header.common.customerNote,
              currencyId:
                workflow.summary.type === "payment"
                  ? workflow.header.moneyRequest.targetCurrencyId
                  : workflow.header.moneyRequest.sourceCurrencyId,
              createdAt: workflow.summary.createdAt,
              customerId:
                workflow.participants.find((participant) => participant.role === "customer")
                  ?.customerId ?? "customer-1",
              id: workflow.summary.id,
              intakeComment: workflow.header.common.customerNote,
              nextAction: workflow.nextAction,
              reason: workflow.header.moneyRequest.purpose,
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
          listLatestByOperationIds: vi.fn(
            async () => overrides?.latestInstructions ?? [],
          ),
        },
      },
      operations: {
        queries: {
          listCashMovements: vi.fn(async () => ({
            data:
              overrides?.treasuryFacts
                ?.filter((fact) => fact.amountMinor !== null && !fact.counterAmountMinor)
                .map((fact) => ({
                  accountRef: null,
                  amountMinor: fact.amountMinor,
                  bookedAt: fact.recordedAt,
                  calculationSnapshotId: null,
                  confirmedAt: fact.confirmedAt,
                  createdAt: fact.createdAt,
                  currencyId: fact.currencyId,
                  dealId: fact.dealId,
                  direction: "debit" as const,
                  externalRecordId: fact.externalRecordId,
                  id: `cash:${fact.id}`,
                  instructionId: fact.instructionId,
                  metadata: fact.metadata,
                  notes: fact.notes,
                  operationId: fact.operationId,
                  providerCounterpartyId: null,
                  providerRef: fact.providerRef,
                  requisiteId: null,
                  routeLegId: fact.routeLegId,
                  routeVersionId: null,
                  sourceKind: fact.sourceKind,
                  sourceRef: `cash:${fact.sourceRef}`,
                  statementRef: null,
                  updatedAt: fact.updatedAt,
                  valueDate: fact.confirmedAt,
                })) ?? [],
            limit: MAX_QUERY_LIST_LIMIT,
            offset: 0,
            total:
              overrides?.treasuryFacts?.filter(
                (fact) => fact.amountMinor !== null && !fact.counterAmountMinor,
              ).length ?? 0,
          })),
          listExecutionFees: vi.fn(async () => ({
            data:
              overrides?.treasuryFacts
                ?.filter((fact) => fact.feeAmountMinor !== null)
                .map((fact) => ({
                  amountMinor: fact.feeAmountMinor,
                  calculationSnapshotId: null,
                  chargedAt: fact.recordedAt,
                  componentCode: null,
                  confirmedAt: fact.confirmedAt,
                  createdAt: fact.createdAt,
                  currencyId: fact.feeCurrencyId ?? fact.currencyId,
                  dealId: fact.dealId,
                  externalRecordId: fact.externalRecordId,
                  feeFamily:
                    (fact.metadata?.feeComponentFamily as string | undefined) ??
                    (fact.metadata?.componentFamily as string | undefined) ??
                    "provider_fee",
                  fillId: null,
                  id: `fee:${fact.id}`,
                  instructionId: fact.instructionId,
                  metadata: fact.metadata
                    ? {
                        classification:
                          (fact.metadata.feeClassification as string | undefined) ??
                          (fact.metadata.classification as string | undefined) ??
                          null,
                        componentFamily:
                          (fact.metadata.feeComponentFamily as string | undefined) ??
                          (fact.metadata.componentFamily as string | undefined) ??
                          null,
                      }
                    : null,
                  notes: fact.notes,
                  operationId: fact.operationId,
                  providerCounterpartyId: null,
                  providerRef: fact.providerRef,
                  routeComponentId: null,
                  routeLegId: fact.routeLegId,
                  routeVersionId: null,
                  sourceKind: fact.sourceKind,
                  sourceRef: `fee:${fact.sourceRef}`,
                  updatedAt: fact.updatedAt,
                })) ?? [],
            limit: MAX_QUERY_LIST_LIMIT,
            offset: 0,
            total:
              overrides?.treasuryFacts?.filter(
                (fact) => fact.feeAmountMinor !== null,
              ).length ?? 0,
          })),
          listExecutionFills: vi.fn(async () => ({
            data:
              overrides?.treasuryFacts
                ?.filter(
                  (fact) =>
                    fact.counterAmountMinor !== null ||
                    fact.counterCurrencyId !== null,
                )
                .map((fact) => ({
                  actualRateDen: fact.amountMinor,
                  actualRateNum: fact.counterAmountMinor,
                  boughtAmountMinor: fact.counterAmountMinor,
                  boughtCurrencyId: fact.counterCurrencyId,
                  calculationSnapshotId: null,
                  confirmedAt: fact.confirmedAt,
                  createdAt: fact.createdAt,
                  dealId: fact.dealId,
                  executedAt: fact.recordedAt,
                  externalRecordId: fact.externalRecordId,
                  fillSequence: null,
                  id: `fill:${fact.id}`,
                  instructionId: fact.instructionId,
                  metadata: fact.metadata,
                  notes: fact.notes,
                  operationId: fact.operationId,
                  providerCounterpartyId: null,
                  providerRef: fact.providerRef,
                  routeLegId: fact.routeLegId,
                  routeVersionId: null,
                  soldAmountMinor: fact.amountMinor,
                  soldCurrencyId: fact.currencyId,
                  sourceKind: fact.sourceKind,
                  sourceRef: `fill:${fact.sourceRef}`,
                  updatedAt: fact.updatedAt,
                })) ?? [],
            limit: MAX_QUERY_LIST_LIMIT,
            offset: 0,
            total:
              overrides?.treasuryFacts?.filter(
                (fact) =>
                  fact.counterAmountMinor !== null ||
                  fact.counterCurrencyId !== null,
              ).length ?? 0,
          })),
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
    expect(projection?.submissionCompleteness.complete).toBe(true);
    expect(projection?.requiredActions).toContain(
      "Ожидайте или подтвердите расчет",
    );
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

  it("includes accepted calculation summary in portal projection", async () => {
    const workflowState = createBaseWorkflow();
    const workflow = createWorkflow({
      calculation: {
        createdAt: new Date("2026-04-01T09:00:00.000Z"),
        currentSnapshot: {
          agreementVersionId: null,
          agreementFeeAmountMinor: "2500",
          agreementFeeBps: "150",
          additionalExpensesAmountMinor: "1500",
          additionalExpensesCurrencyId: null,
          additionalExpensesInBaseMinor: "1500",
          additionalExpensesRateDen: null,
          additionalExpensesRateNum: null,
          additionalExpensesRateSource: null,
          baseCurrencyId: "currency-rub",
          calculationCurrencyId: "currency-usd",
          calculationTimestamp: new Date("2026-04-01T10:00:00.000Z"),
          createdAt: new Date("2026-04-01T10:00:00.000Z"),
          fixedFeeAmountMinor: "300",
          fixedFeeCurrencyId: "currency-usd",
          fxQuoteId: null,
          id: "snapshot-portal",
          originalAmountMinor: "100000",
          pricingProvenance: null,
          quoteMarkupAmountMinor: "500",
          quoteMarkupBps: "25",
          quoteSnapshot: null,
          referenceRateAsOf: null,
          referenceRateDen: null,
          referenceRateNum: null,
          referenceRateSource: null,
          rateDen: "100",
          rateNum: "9715",
          rateSource: "manual",
          snapshotNumber: 1,
          totalFeeAmountInBaseMinor: "29147",
          totalFeeAmountMinor: "3000",
          totalFeeBps: "175",
          totalAmountMinor: "103000",
          totalInBaseMinor: "1000715",
          totalWithExpensesInBaseMinor: "1002215",
          updatedAt: new Date("2026-04-01T10:00:00.000Z"),
        },
        id: "calculation-portal",
        isActive: true,
        lines: [],
        updatedAt: new Date("2026-04-01T10:00:00.000Z"),
      },
      workflow: {
        ...workflowState,
        summary: {
          ...workflowState.summary,
          calculationId: "calculation-portal",
        },
      },
    });

    const projection = await workflow.getPortalDealProjection("deal-1", "customer-1");

    expect(projection?.calculationSummary).toEqual({
      additionalExpenses: "15.00",
      additionalExpensesCurrencyCode: null,
      agreementFeeAmount: "25.00",
      agreementFeePercentage: "1.50",
      baseCurrencyCode: "RUB",
      calculationTimestamp: new Date("2026-04-01T10:00:00.000Z"),
      currencyCode: "USD",
      fixedFeeAmount: "3.00",
      fixedFeeCurrencyCode: "USD",
      id: "calculation-portal",
      originalAmount: "1000.00",
      quoteMarkupAmount: "5.00",
      quoteMarkupPercentage: "0.25",
      rate: "97.15",
      totalAmount: "1030.00",
      totalFeeAmount: "30.00",
      totalFeeAmountInBase: "291.47",
      totalFeePercentage: "1.75",
      totalInBase: "10007.15",
      totalWithExpensesInBase: "10022.15",
    });
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
          targetStatus: "executing",
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

  it("includes profitability and reconciliation summary in CRM workbench", async () => {
    const workflow = createWorkflow({
      calculation: {
        createdAt: new Date("2026-04-01T08:00:00.000Z"),
        currentSnapshot: {
          agreementVersionId: null,
          agreementFeeAmountMinor: "0",
          agreementFeeBps: "0",
          additionalExpensesAmountMinor: "0",
          additionalExpensesCurrencyId: null,
          additionalExpensesInBaseMinor: "0",
          additionalExpensesRateDen: null,
          additionalExpensesRateNum: null,
          additionalExpensesRateSource: null,
          baseCurrencyId: "currency-rub",
          calculationCurrencyId: "currency-rub",
          calculationTimestamp: new Date("2026-04-01T08:00:00.000Z"),
          createdAt: new Date("2026-04-01T08:00:00.000Z"),
          fixedFeeAmountMinor: "0",
          fixedFeeCurrencyId: null,
          fxQuoteId: null,
          id: "snapshot-crm-1",
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
          routeSnapshot: null,
          routeVersionId: null,
          snapshotNumber: 1,
          totalFeeAmountInBaseMinor: "600",
          totalFeeAmountMinor: "600",
          totalFeeBps: "0",
          totalAmountMinor: "100000",
          totalInBaseMinor: "100000",
          totalWithExpensesInBaseMinor: "100350",
          updatedAt: new Date("2026-04-01T08:00:00.000Z"),
        },
        id: "calculation-1",
        isActive: true,
        lines: [
          {
            amountMinor: "100",
            classification: "revenue",
            componentFamily: "customer_fee",
            createdAt: new Date("2026-04-01T08:00:00.000Z"),
            currencyId: "currency-rub",
            id: "line-1",
            idx: 0,
            kind: "fee_revenue",
            updatedAt: new Date("2026-04-01T08:00:00.000Z"),
          },
          {
            amountMinor: "500",
            classification: "revenue",
            componentFamily: "spread",
            createdAt: new Date("2026-04-01T08:00:00.000Z"),
            currencyId: "currency-rub",
            id: "line-2",
            idx: 1,
            kind: "spread_revenue",
            updatedAt: new Date("2026-04-01T08:00:00.000Z"),
          },
          {
            amountMinor: "250",
            classification: "expense",
            componentFamily: "provider_fee",
            createdAt: new Date("2026-04-01T08:00:00.000Z"),
            currencyId: "currency-rub",
            id: "line-3",
            idx: 2,
            kind: "provider_fee_expense",
            updatedAt: new Date("2026-04-01T08:00:00.000Z"),
          },
        ],
        updatedAt: new Date("2026-04-01T08:00:00.000Z"),
      },
      latestInstructions: [
        {
          attempt: 1,
          createdAt: new Date("2026-04-01T10:00:00.000Z"),
          id: "instruction-1",
          operationId: "operation-1",
          providerRef: null,
          providerSnapshot: null,
          sourceRef: "deal:deal-1:leg:1:payout:1",
          state: "settled",
          updatedAt: new Date("2026-04-01T10:00:00.000Z"),
        },
      ],
      reconciliationLinks: [
        {
          exceptions: [
            {
              createdAt: new Date("2026-04-01T11:00:00.000Z"),
              externalRecordId: "record-1",
              id: "exception-1",
              operationId: "operation-1",
              reasonCode: "amount_mismatch",
              resolvedAt: null,
              source: "provider_statement",
              state: "open",
            },
          ],
          lastActivityAt: new Date("2026-04-01T11:00:00.000Z"),
          matchCount: 1,
          operationId: "operation-1",
        },
      ],
      treasuryFacts: [
        {
          amountMinor: null,
          confirmedAt: new Date("2026-04-01T10:00:00.000Z"),
          counterAmountMinor: null,
          counterCurrencyId: null,
          createdAt: new Date("2026-04-01T10:00:00.000Z"),
          currencyId: null,
          dealId: "deal-1",
          externalRecordId: "record-1",
          feeAmountMinor: "275",
          feeCurrencyId: "currency-rub",
          id: "fact-1",
          instructionId: "instruction-1",
          metadata: {
            feeClassification: "expense",
            feeComponentFamily: "provider_fee",
          },
          notes: null,
          operationId: "operation-1",
          providerRef: null,
          recordedAt: new Date("2026-04-01T10:00:00.000Z"),
          routeLegId: null,
          sourceKind: "provider",
          sourceRef: "fact-1",
          updatedAt: new Date("2026-04-01T10:00:00.000Z"),
        },
      ],
      treasuryOperations: [
        {
          amountMinor: 100000n,
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
      workflow: {
        ...createBaseWorkflow(),
        executionPlan: [
          {
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
        summary: {
          ...createBaseWorkflow().summary,
          calculationId: "calculation-1",
        },
      },
    });

    const projection = await workflow.getCrmDealWorkbenchProjection("deal-1");

    expect(projection).not.toBeNull();
    expect(projection).toMatchObject({
      attachmentIngestions: [],
      pricing: {
        currentCalculation: {
          additionalExpenses: "0.00",
          additionalExpensesCurrencyCode: null,
          agreementFeeAmount: "0.00",
          agreementFeePercentage: "0.00",
          baseCurrencyCode: "RUB",
          currencyCode: "RUB",
          fixedFeeAmount: "0.00",
          fixedFeeCurrencyCode: null,
          id: "calculation-1",
          originalAmount: "1000.00",
          quoteMarkupAmount: "0.00",
          quoteMarkupPercentage: "0.00",
          rate: "1",
          totalAmount: "1000.00",
          totalFeeAmount: "6.00",
          totalFeeAmountInBase: "6.00",
          totalFeePercentage: "0.00",
          totalInBase: "1000.00",
          totalWithExpensesInBase: "1003.50",
        },
      },
      revision: 1,
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
      },
      profitabilityVariance: {
        actualCoverage: {
          factCount: 1,
          operationCount: 1,
          state: "partial",
          terminalOperationCount: 1,
        },
        actualExpense: [
          {
            amountMinor: "275",
            currencyCode: "RUB",
            currencyId: "currency-rub",
          },
        ],
        expectedNetMargin: [
          {
            amountMinor: "350",
            currencyCode: "RUB",
            currencyId: "currency-rub",
          },
        ],
        realizedNetMargin: [
          {
            amountMinor: "325",
            currencyCode: "RUB",
            currencyId: "currency-rub",
          },
        ],
      },
      reconciliationSummary: {
        openExceptionCount: 1,
        reconciledOperationCount: 1,
        requiredOperationCount: 1,
        state: "blocked",
      },
      relatedResources: {
        reconciliationExceptions: [
          expect.objectContaining({
            id: "exception-1",
            operationId: "operation-1",
            reasonCode: "amount_mismatch",
          }),
        ],
      },
    });
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

  it("prefers accepted calculation quote provenance in CRM board quote summary", async () => {
    const workflow = createWorkflow({
      workflow: {
        ...createBaseWorkflow(),
        acceptedCalculation: {
          acceptedAt: new Date("2026-04-01T09:30:00.000Z"),
          calculationId: "calculation-1",
          calculationTimestamp: new Date("2026-04-01T09:25:00.000Z"),
          pricingProvenance: null,
          quoteProvenance: {
            fxQuoteId: null,
            quoteSnapshot: null,
            sourceQuoteId: "quote-accepted",
          },
          routeVersionId: null,
          snapshotId: "snapshot-1",
          state: "accepted",
        },
        relatedResources: {
          ...createBaseWorkflow().relatedResources,
          quotes: [
            {
              expiresAt: new Date("2026-04-01T12:00:00.000Z"),
              id: "quote-accepted",
              status: "used",
            },
            {
              expiresAt: new Date("2026-04-01T14:00:00.000Z"),
              id: "quote-latest",
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
      quoteId: "quote-accepted",
      status: "used",
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
          status: "quoted",
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
          status: "closed",
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
      byStatus: { closed: 1 },
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
            state: "ready",
          },
        ],
        acceptedCalculation: {
          acceptedAt: new Date("2026-04-01T09:00:00.000Z"),
          calculationId: "calculation-1",
          calculationTimestamp: new Date("2026-04-01T08:55:00.000Z"),
          pricingProvenance: null,
          quoteProvenance: {
            fxQuoteId: "quote-1",
            quoteSnapshot: null,
            sourceQuoteId: "quote-1",
          },
          routeVersionId: null,
          snapshotId: "snapshot-1",
          state: "accepted",
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

  it("builds expected vs actual profitability variance for finance workspace", async () => {
    const routeVersionId = "00000000-0000-4000-8000-000000000901";
    const routeId = "00000000-0000-4000-8000-000000000902";
    const routeLegFxId = "00000000-0000-4000-8000-000000000903";
    const routeLegPayoutId = "00000000-0000-4000-8000-000000000904";

    const routeSnapshot = {
      costComponents: [],
      createdAt: new Date("2026-04-01T08:00:00.000Z"),
      dealId: "00000000-0000-4000-8000-000000000905",
      id: routeVersionId,
      isCurrent: true,
      legs: [
        {
          code: "fx-leg",
          executionCounterpartyId: null,
          expectedFromAmountMinor: "100000",
          expectedRateDen: "100",
          expectedRateNum: "1",
          expectedToAmountMinor: "1000",
          fromCurrencyId: "currency-rub",
          fromParticipantCode: "A",
          id: routeLegFxId,
          idx: 1,
          kind: "fx_conversion",
          notes: null,
          settlementModel: "gross",
          toCurrencyId: "currency-usd",
          toParticipantCode: "B",
        },
        {
          code: "payout-leg",
          executionCounterpartyId: null,
          expectedFromAmountMinor: "1000",
          expectedRateDen: null,
          expectedRateNum: null,
          expectedToAmountMinor: "1000",
          fromCurrencyId: "currency-usd",
          fromParticipantCode: "B",
          id: routeLegPayoutId,
          idx: 2,
          kind: "payout",
          notes: null,
          settlementModel: "gross",
          toCurrencyId: "currency-usd",
          toParticipantCode: "C",
        },
      ],
      participants: [
        {
          code: "A",
          displayNameSnapshot: "Source",
          id: "00000000-0000-4000-8000-000000000906",
          metadata: {},
          partyId: "00000000-0000-4000-8000-000000000907",
          partyKind: "counterparty",
          requisiteId: null,
          role: "source",
          sequence: 1,
        },
        {
          code: "B",
          displayNameSnapshot: "Bridge",
          id: "00000000-0000-4000-8000-000000000908",
          metadata: {},
          partyId: "00000000-0000-4000-8000-000000000909",
          partyKind: "organization",
          requisiteId: null,
          role: "bridge",
          sequence: 2,
        },
        {
          code: "C",
          displayNameSnapshot: "Beneficiary",
          id: "00000000-0000-4000-8000-000000000910",
          metadata: {},
          partyId: "00000000-0000-4000-8000-000000000911",
          partyKind: "counterparty",
          requisiteId: null,
          role: "beneficiary",
          sequence: 3,
        },
      ],
      routeId,
      validationIssues: [],
      version: 1,
    };

    const workflow = createWorkflow({
      calculation: {
        createdAt: new Date("2026-04-01T08:00:00.000Z"),
        currentSnapshot: {
          agreementVersionId: null,
          agreementFeeAmountMinor: "0",
          agreementFeeBps: "0",
          additionalExpensesAmountMinor: "10",
          additionalExpensesCurrencyId: "currency-usd",
          additionalExpensesInBaseMinor: "10",
          additionalExpensesRateDen: null,
          additionalExpensesRateNum: null,
          additionalExpensesRateSource: null,
          baseCurrencyId: "currency-usd",
          calculationCurrencyId: "currency-rub",
          calculationTimestamp: new Date("2026-04-01T08:00:00.000Z"),
          createdAt: new Date("2026-04-01T08:00:00.000Z"),
          fixedFeeAmountMinor: "0",
          fixedFeeCurrencyId: null,
          fxQuoteId: null,
          id: "snapshot-variance-1",
          originalAmountMinor: "100000",
          pricingProvenance: null,
          quoteMarkupAmountMinor: "0",
          quoteMarkupBps: "0",
          quoteSnapshot: null,
          referenceRateAsOf: null,
          referenceRateDen: null,
          referenceRateNum: null,
          referenceRateSource: null,
          rateDen: "100",
          rateNum: "1",
          rateSource: "manual",
          routeSnapshot,
          routeVersionId,
          snapshotNumber: 1,
          totalFeeAmountInBaseMinor: "200",
          totalFeeAmountMinor: "200",
          totalFeeBps: "0",
          totalAmountMinor: "100000",
          totalInBaseMinor: "1000",
          totalWithExpensesInBaseMinor: "1170",
          updatedAt: new Date("2026-04-01T08:00:00.000Z"),
        },
        id: "calculation-variance-1",
        isActive: true,
        lines: [
          {
            amountMinor: "120",
            classification: "revenue",
            componentFamily: "customer_fee",
            createdAt: new Date("2026-04-01T08:00:00.000Z"),
            currencyId: "currency-usd",
            id: "variance-line-1",
            idx: 0,
            kind: "fee_revenue",
            updatedAt: new Date("2026-04-01T08:00:00.000Z"),
          },
          {
            amountMinor: "80",
            classification: "revenue",
            componentFamily: "spread",
            createdAt: new Date("2026-04-01T08:00:00.000Z"),
            currencyId: "currency-usd",
            id: "variance-line-2",
            idx: 1,
            kind: "spread_revenue",
            routeLegId: routeLegFxId,
            updatedAt: new Date("2026-04-01T08:00:00.000Z"),
          },
          {
            amountMinor: "20",
            classification: "expense",
            componentFamily: "provider_fee",
            createdAt: new Date("2026-04-01T08:00:00.000Z"),
            currencyId: "currency-usd",
            id: "variance-line-3",
            idx: 2,
            kind: "provider_fee_expense",
            routeLegId: routeLegFxId,
            updatedAt: new Date("2026-04-01T08:00:00.000Z"),
          },
          {
            amountMinor: "10",
            classification: "pass_through",
            componentFamily: "wire_fee",
            createdAt: new Date("2026-04-01T08:00:00.000Z"),
            currencyId: "currency-usd",
            id: "variance-line-4",
            idx: 3,
            kind: "pass_through",
            routeLegId: routeLegPayoutId,
            updatedAt: new Date("2026-04-01T08:00:00.000Z"),
          },
        ],
        updatedAt: new Date("2026-04-01T08:00:00.000Z"),
      },
      latestInstructions: [
        {
          attempt: 1,
          createdAt: new Date("2026-04-01T09:00:00.000Z"),
          id: "instruction-variance-1",
          operationId: "operation-variance-1",
          providerRef: null,
          providerSnapshot: null,
          sourceRef: "source-variance-1",
          state: "settled",
          updatedAt: new Date("2026-04-01T09:00:00.000Z"),
        },
        {
          attempt: 1,
          createdAt: new Date("2026-04-01T09:10:00.000Z"),
          id: "instruction-variance-2",
          operationId: "operation-variance-2",
          providerRef: null,
          providerSnapshot: null,
          sourceRef: "source-variance-2",
          state: "settled",
          updatedAt: new Date("2026-04-01T09:10:00.000Z"),
        },
      ],
      treasuryFacts: [
        {
          amountMinor: "100000",
          confirmedAt: new Date("2026-04-01T09:00:00.000Z"),
          counterAmountMinor: "990",
          counterCurrencyId: "currency-usd",
          createdAt: new Date("2026-04-01T09:00:00.000Z"),
          currencyId: "currency-rub",
          dealId: "deal-1",
          externalRecordId: "record-1",
          feeAmountMinor: "30",
          feeCurrencyId: "currency-usd",
          id: "fact-variance-1",
          instructionId: "instruction-variance-1",
          metadata: null,
          notes: null,
          operationId: "operation-variance-1",
          providerRef: null,
          recordedAt: new Date("2026-04-01T09:00:00.000Z"),
          routeLegId: routeLegFxId,
          sourceKind: "provider",
          sourceRef: "fact-variance-1",
          updatedAt: new Date("2026-04-01T09:00:00.000Z"),
        },
        {
          amountMinor: "990",
          confirmedAt: new Date("2026-04-01T09:10:00.000Z"),
          counterAmountMinor: null,
          counterCurrencyId: null,
          createdAt: new Date("2026-04-01T09:10:00.000Z"),
          currencyId: "currency-usd",
          dealId: "deal-1",
          externalRecordId: "record-2",
          feeAmountMinor: "15",
          feeCurrencyId: "currency-usd",
          id: "fact-variance-2",
          instructionId: "instruction-variance-2",
          metadata: {
            feeClassification: "pass_through",
            feeComponentFamily: "wire_fee",
          },
          notes: null,
          operationId: "operation-variance-2",
          providerRef: null,
          recordedAt: new Date("2026-04-01T09:10:00.000Z"),
          routeLegId: routeLegPayoutId,
          sourceKind: "provider",
          sourceRef: "fact-variance-2",
          updatedAt: new Date("2026-04-01T09:10:00.000Z"),
        },
      ],
      treasuryOperations: [
        {
          amountMinor: 100000n,
          counterAmountMinor: 990n,
          counterCurrencyId: "currency-usd",
          createdAt: new Date("2026-04-01T08:30:00.000Z"),
          currencyId: "currency-rub",
          customerId: "customer-1",
          dealId: "deal-1",
          id: "operation-variance-1",
          internalEntityOrganizationId: "organization-1",
          kind: "fx_conversion",
          quoteId: null,
          sourceRef: "deal:deal-1:route-leg-fx",
          state: "planned",
          updatedAt: new Date("2026-04-01T08:30:00.000Z"),
        },
        {
          amountMinor: 990n,
          counterAmountMinor: null,
          counterCurrencyId: null,
          createdAt: new Date("2026-04-01T08:45:00.000Z"),
          currencyId: "currency-usd",
          customerId: "customer-1",
          dealId: "deal-1",
          id: "operation-variance-2",
          internalEntityOrganizationId: "organization-1",
          kind: "payout",
          quoteId: null,
          sourceRef: "deal:deal-1:route-leg-payout",
          state: "planned",
          updatedAt: new Date("2026-04-01T08:45:00.000Z"),
        },
      ],
      workflow: {
        ...createBaseWorkflow(),
        executionPlan: [
          {
            id: routeLegFxId,
            idx: 1,
            kind: "convert",
            operationRefs: [
              {
                kind: "fx_conversion",
                operationId: "operation-variance-1",
                sourceRef: "deal:deal-1:route-leg-fx",
              },
            ],
            state: "done",
          },
          {
            id: routeLegPayoutId,
            idx: 2,
            kind: "payout",
            operationRefs: [
              {
                kind: "payout",
                operationId: "operation-variance-2",
                sourceRef: "deal:deal-1:route-leg-payout",
              },
            ],
            state: "done",
          },
        ],
        nextAction: "Run reconciliation",
        summary: {
          ...createBaseWorkflow().summary,
          calculationId: "calculation-variance-1",
        },
      },
    });

    const projection = await workflow.getFinanceDealWorkspaceProjection("deal-1");

    expect(projection?.profitabilityVariance).toMatchObject({
      actualCoverage: {
        factCount: 4,
        legsWithFacts: 2,
        operationCount: 2,
        state: "complete",
        terminalOperationCount: 2,
        totalLegCount: 2,
      },
      actualExpense: [
        {
          amountMinor: "30",
          currencyCode: "USD",
          currencyId: "currency-usd",
        },
      ],
      actualPassThrough: [
        {
          amountMinor: "15",
          currencyCode: "USD",
          currencyId: "currency-usd",
        },
      ],
      calculationId: "calculation-variance-1",
      expectedNetMargin: [
        {
          amountMinor: "170",
          currencyCode: "USD",
          currencyId: "currency-usd",
        },
      ],
      netMarginVariance: [
        {
          amountMinor: "-15",
          currencyCode: "USD",
          currencyId: "currency-usd",
        },
      ],
      realizedNetMargin: [
        {
          amountMinor: "155",
          currencyCode: "USD",
          currencyId: "currency-usd",
        },
      ],
      varianceByCostFamily: expect.arrayContaining([
        expect.objectContaining({
          classification: "expense",
          family: "provider_fee",
          actual: [
            {
              amountMinor: "30",
              currencyCode: "USD",
              currencyId: "currency-usd",
            },
          ],
          expected: [
            {
              amountMinor: "20",
              currencyCode: "USD",
              currencyId: "currency-usd",
            },
          ],
          variance: [
            {
              amountMinor: "10",
              currencyCode: "USD",
              currencyId: "currency-usd",
            },
          ],
        }),
        expect.objectContaining({
          classification: "pass_through",
          family: "wire_fee",
          actual: [
            {
              amountMinor: "15",
              currencyCode: "USD",
              currencyId: "currency-usd",
            },
          ],
          expected: [
            {
              amountMinor: "10",
              currencyCode: "USD",
              currencyId: "currency-usd",
            },
          ],
          variance: [
            {
              amountMinor: "5",
              currencyCode: "USD",
              currencyId: "currency-usd",
            },
          ],
        }),
      ]),
      varianceByLeg: expect.arrayContaining([
        expect.objectContaining({
          routeLegId: routeLegFxId,
          actualFees: [
            {
              amountMinor: "30",
              currencyCode: "USD",
              currencyId: "currency-usd",
            },
          ],
          varianceTo: {
            amountMinor: "-10",
            currencyCode: "USD",
            currencyId: "currency-usd",
          },
        }),
        expect.objectContaining({
          routeLegId: routeLegPayoutId,
          actualFees: [
            {
              amountMinor: "15",
              currencyCode: "USD",
              currencyId: "currency-usd",
            },
          ],
          varianceFrom: null,
          varianceTo: null,
        }),
      ]),
    });
  });
});
