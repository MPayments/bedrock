import { describe, expect, it } from "vitest";

import type { DealWorkflowProjection } from "@bedrock/deals/contracts";
import type { ReconciliationOperationLinkDto } from "@bedrock/reconciliation/contracts";
import type { TreasuryInstruction } from "@bedrock/treasury/contracts";

import {
  deriveFinanceDealReadiness,
  deriveFinanceDealStage,
} from "../src";

function createLeg(input: {
  id: string;
  idx: number;
  kind:
    | "collect"
    | "convert"
    | "payout"
    | "settle_exporter"
    | "transit_hold";
  operationId?: string;
  state?: "blocked" | "done" | "pending" | "ready" | "skipped";
}) {
  return {
    fromCurrencyId: null,
    id: input.id,
    idx: input.idx,
    kind: input.kind,
    operationRefs: input.operationId
      ? [
          {
            kind:
              input.kind === "collect"
                ? "payin"
                : input.kind === "convert"
                  ? "fx_conversion"
                  : input.kind === "payout"
                    ? "payout"
                    : input.kind === "settle_exporter"
                      ? "intercompany_funding"
                      : "intracompany_transfer",
            operationId: input.operationId,
            sourceRef: `deal:deal-1:leg:${input.idx}:${input.kind}:1`,
          },
        ]
      : [],
    routeSnapshotLegId: null,
    state: input.state ?? "ready",
    toCurrencyId: null,
  };
}

function createWorkflow(input?: {
  executionPlan?: ReturnType<typeof createLeg>[];
  formalDocuments?: DealWorkflowProjection["relatedResources"]["formalDocuments"];
  positions?: DealWorkflowProjection["operationalState"]["positions"];
  status?: DealWorkflowProjection["summary"]["status"];
  transitionReadiness?: DealWorkflowProjection["transitionReadiness"];
  type?: DealWorkflowProjection["summary"]["type"];
}) {
  return {
    acceptedQuote: null,
    attachmentIngestions: [],
    executionPlan: input?.executionPlan ?? [
      createLeg({
        id: "leg-1",
        idx: 1,
        kind: "collect",
        operationId: "operation-1",
      }),
      createLeg({
        id: "leg-2",
        idx: 2,
        kind: "payout",
        operationId: "operation-2",
      }),
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
        customerNote: null,
        requestedExecutionDate: new Date("2026-04-03T00:00:00.000Z"),
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
        invoiceNumber: null,
        payerCounterpartyId: null,
        payerSnapshot: null,
      },
      moneyRequest: {
        purpose: "Treasury execution",
        sourceAmount: "100.00",
        sourceCurrencyId: "currency-usd",
        targetCurrencyId: "currency-eur",
      },
      settlementDestination: {
        bankInstructionSnapshot: null,
        mode: null,
        requisiteId: null,
      },
      type: input?.type ?? "payment",
    },
    nextAction: "Prepare closing documents",
    operationalState: {
      positions: input?.positions ?? [],
    },
    participants: [
      {
        counterpartyId: null,
        customerId: "customer-1",
        displayName: "Customer",
        id: "participant-customer",
        organizationId: null,
        role: "customer",
      },
      {
        counterpartyId: null,
        customerId: null,
        displayName: "Internal entity",
        id: "participant-internal",
        organizationId: "org-internal",
        role: "internal_entity",
      },
    ],
    relatedResources: {
      attachments: [],
      calculations: [],
      formalDocuments: input?.formalDocuments ?? [],
      quotes: [],
    },
    revision: 1,
    sectionCompleteness: [],
    summary: {
      agreementId: "agreement-1",
      agentId: null,
      calculationId: null,
      createdAt: new Date("2026-04-03T00:00:00.000Z"),
      id: "deal-1",
      status: input?.status ?? "closing_documents",
      type: input?.type ?? "payment",
      updatedAt: new Date("2026-04-03T00:00:00.000Z"),
    },
    timeline: [],
    transitionReadiness: input?.transitionReadiness ?? [],
  } as DealWorkflowProjection;
}

function createInstructionStateMap(
  entries: [operationId: string, state: TreasuryInstruction["state"]][],
): ReadonlyMap<string, TreasuryInstruction> {
  return new Map<string, TreasuryInstruction>(
    entries.map(([operationId, state], index) => [
      operationId,
      {
        attempt: 1,
        createdAt: new Date("2026-04-03T10:00:00.000Z"),
        failedAt: state === "failed" ? new Date("2026-04-03T10:05:00.000Z") : null,
        id: `instruction-${index + 1}`,
        operationId,
        providerRef: null,
        providerSnapshot: null,
        returnRequestedAt:
          state === "return_requested"
            ? new Date("2026-04-03T10:05:00.000Z")
            : null,
        returnedAt: state === "returned" ? new Date("2026-04-03T10:05:00.000Z") : null,
        settledAt: state === "settled" ? new Date("2026-04-03T10:05:00.000Z") : null,
        sourceRef: `source-${index + 1}`,
        state,
        submittedAt: state === "submitted" ? new Date("2026-04-03T10:05:00.000Z") : null,
        updatedAt: new Date("2026-04-03T10:00:00.000Z"),
        voidedAt: state === "voided" ? new Date("2026-04-03T10:05:00.000Z") : null,
      },
    ]),
  );
}

function createReconciliationLinkMap(
  entries: [operationId: string, matchCount: number, openExceptionCount?: number][],
): ReadonlyMap<string, ReconciliationOperationLinkDto> {
  return new Map<string, ReconciliationOperationLinkDto>(
    entries.map(([operationId, matchCount, openExceptionCount = 0], index) => [
      operationId,
      {
        exceptions:
          openExceptionCount > 0
            ? [
                {
                  createdAt: new Date("2026-04-03T11:00:00.000Z"),
                  externalRecordId: `external-${index + 1}`,
                  id: `exception-${index + 1}`,
                  operationId,
                  reasonCode: "no_match",
                  resolvedAt: null,
                  source: "bank_statement",
                  state: "open",
                },
              ]
            : [],
        lastActivityAt:
          matchCount > 0 || openExceptionCount > 0
            ? new Date("2026-04-03T11:00:00.000Z")
            : null,
        matchCount,
        operationId,
      },
    ]),
  );
}

function createActiveAcceptanceDocument() {
  return {
    approvalStatus: "approved",
    createdAt: new Date("2026-04-03T12:00:00.000Z"),
    docType: "acceptance",
    id: "document-1",
    lifecycleStatus: "active",
    occurredAt: new Date("2026-04-03T12:00:00.000Z"),
    postingStatus: "posted",
    submissionStatus: "submitted",
  };
}

describe("finance close readiness", () => {
  it("moves terminal execution into awaiting_reconciliation until reconciliation is clear", () => {
    const workflow = createWorkflow({
      formalDocuments: [createActiveAcceptanceDocument()],
    });
    const readiness = deriveFinanceDealReadiness({
      latestInstructionByOperationId: createInstructionStateMap([
        ["operation-1", "voided"],
        ["operation-2", "settled"],
      ]),
      reconciliationLinksByOperationId: createReconciliationLinkMap([
        ["operation-2", 0],
      ]),
      workflow,
    });

    const stage = deriveFinanceDealStage({
      agreementOrganizationId: "org-internal",
      closeReadiness: readiness.closeReadiness,
      internalEntityOrganizationId: "org-internal",
      latestInstructionByOperationId: createInstructionStateMap([
        ["operation-1", "voided"],
        ["operation-2", "settled"],
      ]),
      reconciliationSummary: readiness.reconciliationSummary,
      workflow,
    });

    expect(readiness.reconciliationSummary.state).toBe("pending");
    expect(readiness.closeReadiness.ready).toBe(false);
    expect(stage).toEqual({
      stage: "awaiting_reconciliation",
      stageReason: "Ожидаем завершение сверки",
    });
  });

  it("marks payment deals ready to close only after payout, reconciliation, and closing documents are complete", () => {
    const workflow = createWorkflow({
      formalDocuments: [createActiveAcceptanceDocument()],
    });
    const latestInstructionByOperationId = createInstructionStateMap([
      ["operation-1", "voided"],
      ["operation-2", "settled"],
    ]);
    const readiness = deriveFinanceDealReadiness({
      latestInstructionByOperationId,
      reconciliationLinksByOperationId: createReconciliationLinkMap([
        ["operation-2", 1],
      ]),
      workflow,
    });

    const stage = deriveFinanceDealStage({
      agreementOrganizationId: "org-internal",
      closeReadiness: readiness.closeReadiness,
      internalEntityOrganizationId: "org-internal",
      latestInstructionByOperationId,
      reconciliationSummary: readiness.reconciliationSummary,
      workflow,
    });

    expect(readiness.closeReadiness.criteria).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "payment_payout_settled",
          satisfied: true,
        }),
        expect.objectContaining({
          code: "payment_documents_ready",
          satisfied: true,
        }),
      ]),
    );
    expect(readiness.reconciliationSummary.state).toBe("clear");
    expect(readiness.closeReadiness.ready).toBe(true);
    expect(stage.stage).toBe("ready_to_close");
  });

  it("accepts returned payouts for currency exchange close readiness after conversion settles", () => {
    const workflow = createWorkflow({
      executionPlan: [
        createLeg({
          id: "leg-1",
          idx: 1,
          kind: "collect",
          operationId: "operation-1",
        }),
        createLeg({
          id: "leg-2",
          idx: 2,
          kind: "convert",
          operationId: "operation-2",
        }),
        createLeg({
          id: "leg-3",
          idx: 3,
          kind: "payout",
          operationId: "operation-3",
        }),
      ],
      type: "currency_exchange",
    });

    const readiness = deriveFinanceDealReadiness({
      latestInstructionByOperationId: createInstructionStateMap([
        ["operation-1", "voided"],
        ["operation-2", "settled"],
        ["operation-3", "returned"],
      ]),
      reconciliationLinksByOperationId: createReconciliationLinkMap([
        ["operation-2", 1],
        ["operation-3", 1],
      ]),
      workflow,
    });

    expect(readiness.closeReadiness.criteria).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "currency_exchange_conversion_settled",
          satisfied: true,
        }),
        expect.objectContaining({
          code: "currency_exchange_payout_or_returned",
          satisfied: true,
        }),
      ]),
    );
    expect(readiness.closeReadiness.ready).toBe(true);
  });

  it("maps open transit funding legs to intracompany or intercompany stages using organization ownership", () => {
    const workflow = createWorkflow({
      executionPlan: [
        createLeg({
          id: "leg-1",
          idx: 1,
          kind: "collect",
          operationId: "operation-1",
          state: "done",
        }),
        createLeg({
          id: "leg-2",
          idx: 2,
          kind: "transit_hold",
          operationId: "operation-2",
          state: "pending",
        }),
      ],
      type: "currency_transit",
    });
    const readiness = deriveFinanceDealReadiness({
      latestInstructionByOperationId: createInstructionStateMap([
        ["operation-1", "settled"],
      ]),
      reconciliationLinksByOperationId: createReconciliationLinkMap([
        ["operation-1", 1],
      ]),
      workflow,
    });

    expect(
      deriveFinanceDealStage({
        agreementOrganizationId: "org-internal",
        closeReadiness: readiness.closeReadiness,
        internalEntityOrganizationId: "org-internal",
        latestInstructionByOperationId: createInstructionStateMap([
          ["operation-1", "settled"],
        ]),
        reconciliationSummary: readiness.reconciliationSummary,
        workflow,
      }).stage,
    ).toBe("awaiting_intracompany_transfer");
    expect(
      deriveFinanceDealStage({
        agreementOrganizationId: "org-external",
        closeReadiness: readiness.closeReadiness,
        internalEntityOrganizationId: "org-internal",
        latestInstructionByOperationId: createInstructionStateMap([
          ["operation-1", "settled"],
        ]),
        reconciliationSummary: readiness.reconciliationSummary,
        workflow,
      }).stage,
    ).toBe("awaiting_intercompany_funding");
  });

  it("requires exporter settlement receivables to be closed before close readiness turns green", () => {
    const workflow = createWorkflow({
      executionPlan: [
        createLeg({
          id: "leg-1",
          idx: 1,
          kind: "payout",
          operationId: "operation-1",
        }),
        createLeg({
          id: "leg-2",
          idx: 2,
          kind: "collect",
          operationId: "operation-2",
        }),
        createLeg({
          id: "leg-3",
          idx: 3,
          kind: "settle_exporter",
          operationId: "operation-3",
        }),
      ],
      positions: [
        {
          amountMinor: "10000",
          currencyId: "currency-usd",
          kind: "exporter_expected_receivable",
          reasonCode: null,
          sourceRefs: [],
          state: "pending",
          updatedAt: new Date("2026-04-03T00:00:00.000Z"),
        },
      ],
      type: "exporter_settlement",
    });

    const readiness = deriveFinanceDealReadiness({
      latestInstructionByOperationId: createInstructionStateMap([
        ["operation-1", "settled"],
        ["operation-2", "voided"],
        ["operation-3", "voided"],
      ]),
      reconciliationLinksByOperationId: createReconciliationLinkMap([
        ["operation-1", 1],
      ]),
      workflow,
    });

    expect(readiness.closeReadiness.criteria).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "exporter_settlement_payout_settled",
          satisfied: true,
        }),
        expect.objectContaining({
          code: "exporter_settlement_receivable_resolved",
          satisfied: false,
        }),
      ]),
    );
    expect(readiness.closeReadiness.ready).toBe(false);
  });

  it("requires every convert leg to settle before currency_exchange close readiness passes (multi-hop route)", () => {
    // Multi-hop route produces 2 convert legs + 2 transit_hold legs plus collect + payout.
    const workflow = createWorkflow({
      executionPlan: [
        createLeg({ id: "leg-1", idx: 1, kind: "collect", operationId: "op-1", state: "done" }),
        createLeg({ id: "leg-2", idx: 2, kind: "transit_hold", operationId: "op-2", state: "done" }),
        createLeg({ id: "leg-3", idx: 3, kind: "convert", operationId: "op-3", state: "done" }),
        createLeg({ id: "leg-4", idx: 4, kind: "transit_hold", operationId: "op-4", state: "done" }),
        // Second convert is still in progress — should keep conversion_settled false.
        createLeg({ id: "leg-5", idx: 5, kind: "convert", operationId: "op-5", state: "ready" }),
        createLeg({ id: "leg-6", idx: 6, kind: "payout", operationId: "op-6", state: "ready" }),
      ],
      type: "currency_exchange",
    });

    const readiness = deriveFinanceDealReadiness({
      latestInstructionByOperationId: createInstructionStateMap([
        ["op-1", "settled"],
        ["op-2", "settled"],
        ["op-3", "settled"],
        ["op-4", "settled"],
        ["op-5", "submitted"],
        ["op-6", "prepared"],
      ]),
      reconciliationLinksByOperationId: createReconciliationLinkMap([]),
      workflow,
    });

    expect(readiness.closeReadiness.criteria).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "currency_exchange_conversion_settled",
          satisfied: false,
        }),
      ]),
    );
    expect(readiness.closeReadiness.ready).toBe(false);
  });
});
