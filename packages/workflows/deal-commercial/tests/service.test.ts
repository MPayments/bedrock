import { describe, expect, it, vi } from "vitest";

import { createDealCommercialWorkflow } from "../src/service";

const IDS = {
  actor: "user-1",
  agreement: "agreement-1",
  calculation: "calculation-1",
  counterparty: "counterparty-1",
  customer: "customer-1",
  deal: "deal-1",
  evidenceFile: "file-1",
  invoice: "invoice-1",
  application: "application-1",
  organization: "organization-1",
  organizationRequisite: "organization-requisite-1",
  quote: "quote-1",
} as const;

function readyDocument(input: {
  docType: string;
  id: string;
  invoicePurpose?: "agency_fee" | "combined" | "principal" | null;
}) {
  return {
    approvalStatus: "approved",
    docType: input.docType,
    id: input.id,
    invoicePurpose: input.invoicePurpose ?? null,
    lifecycleStatus: "active",
    postingStatus: input.docType === "invoice" ? "posted" : "not_required",
    submissionStatus: "submitted",
  };
}

function createDeal(overrides: Record<string, unknown> = {}) {
  return {
    agreementId: IDS.agreement,
    calculationId: IDS.calculation,
    id: IDS.deal,
    status: "preparing_documents",
    type: "payment",
    ...overrides,
  };
}

function createAgreement() {
  return {
    currentVersion: {
      feeRules: [
        {
          kind: "agent_fee",
          value: "125",
        },
        {
          currencyCode: "USD",
          kind: "fixed_fee",
          value: "10.00",
        },
      ],
      id: "agreement-version-1",
    },
    id: IDS.agreement,
    organizationId: IDS.organization,
    organizationRequisiteId: IDS.organizationRequisite,
  };
}

function createWorkflow(overrides: Record<string, unknown> = {}) {
  return {
    acceptedQuote: {
      quoteId: IDS.quote,
      revokedAt: null,
    },
    executionPlan: [
      {
        id: "leg-1",
        idx: 1,
        kind: "payout",
      },
    ],
    intake: {
      common: {
        applicantCounterpartyId: IDS.counterparty,
      },
    },
    participants: [
      {
        counterpartyId: IDS.counterparty,
        role: "applicant",
      },
      {
        customerId: IDS.customer,
        role: "customer",
      },
      {
        organizationId: IDS.organization,
        role: "internal_entity",
      },
    ],
    relatedResources: {
      formalDocuments: [],
    },
    summary: {
      calculationId: IDS.calculation,
      id: IDS.deal,
      status: "preparing_documents",
      type: "payment",
    },
    ...overrides,
  };
}

function createPaymentStep(overrides: Record<string, unknown> = {}) {
  return {
    artifacts: [],
    id: "payment-step-1",
    kind: "payout",
    origin: {
      planLegId: "leg-1",
      sequence: 1,
    },
    state: "completed",
    ...overrides,
  };
}

function createDeps(input: {
  deal?: Record<string, unknown> | null;
  workflow?: Record<string, unknown> | null;
  paymentSteps?: Record<string, unknown>[];
} = {}) {
  const deal = input.deal === undefined ? createDeal() : input.deal;
  const workflow =
    input.workflow === undefined ? createWorkflow() : input.workflow;
  const paymentSteps = input.paymentSteps ?? [];

  return {
    agreements: {
      agreements: {
        queries: {
          findById: vi.fn(async () => createAgreement()),
        },
      },
    },
    dealExecution: {
      requestExecution: vi.fn(async () => ({ id: "execution-1" })),
    },
    deals: {
      deals: {
        commands: {
          appendTimelineEvent: vi.fn(async () => undefined),
        },
        queries: {
          findById: vi.fn(async () => deal),
          findWorkflowById: vi.fn(async () => workflow),
        },
      },
    },
    documentDrafts: {
      createDraft: vi.fn(async (request) => ({
        id: "draft-1",
        request,
      })),
    },
    documentsReadModel: {
      listDealTraceRowsByDealId: vi.fn(async () => []),
    },
    logger: {
      warn: vi.fn(),
    },
    treasury: {
      paymentSteps: {
        queries: {
          list: vi.fn(async () => ({
            data: paymentSteps,
            limit: 100,
            offset: 0,
            total: paymentSteps.length,
          })),
        },
      },
      quotes: {
        commands: {
          createQuote: vi.fn(async (request) => ({
            id: IDS.quote,
            request,
          })),
        },
        queries: {
          getQuoteDetails: vi.fn(),
          listQuotes: vi.fn(async () => ({
            data: [],
            limit: 500,
            offset: 0,
            total: 0,
          })),
          previewQuote: vi.fn(async (request) => ({
            id: "preview-1",
            request,
          })),
        },
      },
    },
  } as any;
}

describe("deal commercial workflow", () => {
  it("applies agreement commercial defaults to quote previews", async () => {
    const deps = createDeps();
    const workflow = createDealCommercialWorkflow(deps);

    await workflow.previewQuote({
      dealId: IDS.deal,
      quoteInput: {
        fromCurrency: "RUB",
        toCurrency: "USD",
      },
    });

    expect(deps.treasury.quotes.queries.previewQuote).toHaveBeenCalledWith(
      expect.objectContaining({
        commercialTerms: {
          agreementFeeBps: "125",
          agreementVersionId: "agreement-version-1",
          fixedFeeAmount: "10.00",
          fixedFeeCurrency: "USD",
          quoteMarkupBps: "0",
        },
      }),
    );
  });

  it("creates application drafts with deal quote and calculation enrichment", async () => {
    const deps = createDeps();
    const workflow = createDealCommercialWorkflow(deps);

    await workflow.createFormalDocument({
      actorUserId: IDS.actor,
      dealId: IDS.deal,
      docType: "application",
      idempotencyKey: "idem-1",
      payload: {
        memo: "client accepted quote",
      },
    });

    expect(deps.documentDrafts.createDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        dealId: IDS.deal,
        docType: "application",
        payload: {
          calculationId: IDS.calculation,
          counterpartyId: IDS.counterparty,
          customerId: IDS.customer,
          dealId: IDS.deal,
          memo: "client accepted quote",
          organizationId: IDS.organization,
          organizationRequisiteId: IDS.organizationRequisite,
          quoteId: IDS.quote,
        },
      }),
    );
  });

  it("blocks duplicate applications for a deal", async () => {
    const deps = createDeps({
      workflow: createWorkflow({
        relatedResources: {
          formalDocuments: [
            readyDocument({ docType: "application", id: IDS.application }),
          ],
        },
      }),
    });
    const workflow = createDealCommercialWorkflow(deps);

    await expect(
      workflow.createFormalDocument({
        actorUserId: IDS.actor,
        dealId: IDS.deal,
        docType: "application",
        idempotencyKey: "idem-1",
        payload: {},
      }),
    ).rejects.toThrow("application already exists for this deal");
  });

  it("blocks payment invoice creation until application is ready", async () => {
    const deps = createDeps();
    const workflow = createDealCommercialWorkflow(deps);

    await expect(
      workflow.createFormalDocument({
        actorUserId: IDS.actor,
        dealId: IDS.deal,
        docType: "invoice",
        idempotencyKey: "idem-1",
        payload: {},
      }),
    ).rejects.toThrow(
      "invoice creation requires a ready application document for payment deals",
    );
  });

  it("blocks acceptance before closing_documents", async () => {
    const deps = createDeps({
      workflow: createWorkflow({
        relatedResources: {
          formalDocuments: [
            readyDocument({ docType: "application", id: IDS.application }),
            readyDocument({ docType: "invoice", id: IDS.invoice }),
          ],
        },
      }),
    });
    const workflow = createDealCommercialWorkflow(deps);

    await expect(
      workflow.createFormalDocument({
        actorUserId: IDS.actor,
        dealId: IDS.deal,
        docType: "acceptance",
        idempotencyKey: "idem-1",
        payload: {},
      }),
    ).rejects.toThrow(
      "acceptance can be created only in closing_documents status",
    );
  });

  it("blocks acceptance before completed final payout", async () => {
    const deps = createDeps({
      deal: createDeal({ status: "closing_documents" }),
      workflow: createWorkflow({
        relatedResources: {
          formalDocuments: [
            readyDocument({ docType: "application", id: IDS.application }),
            readyDocument({ docType: "invoice", id: IDS.invoice }),
          ],
        },
        summary: {
          calculationId: IDS.calculation,
          id: IDS.deal,
          status: "closing_documents",
          type: "payment",
        },
      }),
    });
    const workflow = createDealCommercialWorkflow(deps);

    await expect(
      workflow.createFormalDocument({
        actorUserId: IDS.actor,
        dealId: IDS.deal,
        docType: "acceptance",
        idempotencyKey: "idem-1",
        payload: {},
      }),
    ).rejects.toThrow("acceptance requires a completed final payout step");
  });

  it("blocks acceptance before final SWIFT evidence", async () => {
    const deps = createDeps({
      deal: createDeal({ status: "closing_documents" }),
      paymentSteps: [createPaymentStep()],
      workflow: createWorkflow({
        relatedResources: {
          formalDocuments: [
            readyDocument({ docType: "application", id: IDS.application }),
            readyDocument({ docType: "invoice", id: IDS.invoice }),
          ],
        },
        summary: {
          calculationId: IDS.calculation,
          id: IDS.deal,
          status: "closing_documents",
          type: "payment",
        },
      }),
    });
    const workflow = createDealCommercialWorkflow(deps);

    await expect(
      workflow.createFormalDocument({
        actorUserId: IDS.actor,
        dealId: IDS.deal,
        docType: "acceptance",
        idempotencyKey: "idem-1",
        payload: {},
      }),
    ).rejects.toThrow("acceptance requires final SWIFT/MT103 payout evidence");
  });

  it("creates acceptance from application and invoice after final payout evidence", async () => {
    const deps = createDeps({
      deal: createDeal({ status: "closing_documents" }),
      paymentSteps: [
        createPaymentStep({
          artifacts: [
            {
              fileAssetId: IDS.evidenceFile,
              purpose: "swift_mt103",
            },
          ],
        }),
      ],
      workflow: createWorkflow({
        relatedResources: {
          formalDocuments: [
            readyDocument({ docType: "application", id: IDS.application }),
            readyDocument({ docType: "invoice", id: IDS.invoice }),
          ],
        },
        summary: {
          calculationId: IDS.calculation,
          id: IDS.deal,
          status: "closing_documents",
          type: "payment",
        },
      }),
    });
    const workflow = createDealCommercialWorkflow(deps);

    await workflow.createFormalDocument({
      actorUserId: IDS.actor,
      dealId: IDS.deal,
      docType: "acceptance",
      idempotencyKey: "idem-1",
      payload: {
        memo: "done",
      },
    });

    expect(deps.documentDrafts.createDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        docType: "acceptance",
        payload: {
          applicationDocumentId: IDS.application,
          invoiceDocumentId: IDS.invoice,
          memo: "done",
          settlementEvidenceFileAssetIds: [IDS.evidenceFile],
        },
      }),
    );
  });

  it("logs and appends timeline event when auto-materialization fails", async () => {
    const deps = createDeps();
    deps.dealExecution.requestExecution.mockRejectedValueOnce(
      new Error("materialize failed"),
    );
    const workflow = createDealCommercialWorkflow(deps);

    await workflow.autoMaterializeAfterQuoteAccept({
      actorUserId: IDS.actor,
      dealId: IDS.deal,
      quoteId: IDS.quote,
    });

    expect(deps.logger.warn).toHaveBeenCalledWith(
      "auto-materialize after accept-quote failed",
      expect.objectContaining({
        dealId: IDS.deal,
        quoteId: IDS.quote,
      }),
    );
    expect(deps.deals.deals.commands.appendTimelineEvent).toHaveBeenCalledWith({
      actorUserId: IDS.actor,
      dealId: IDS.deal,
      payload: {
        quoteId: IDS.quote,
        reason: "materialize failed",
      },
      sourceRef: `materialize:auto:${IDS.quote}`,
      type: "materialization_failed",
      visibility: "internal",
    });
  });
});
