import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getFinanceDealRouteComposerById = vi.fn();
const renderRouteComposerWorkspace = vi.fn<(props: unknown) => null>(() => null);

vi.mock("@/features/treasury/deals/lib/queries", () => ({
  getFinanceDealRouteComposerById,
}));

vi.mock("@/features/treasury/deals/components/route-composer", () => ({
  RouteComposerWorkspace: (props: unknown) => {
    renderRouteComposerWorkspace(props);
    return createElement("section");
  },
}));

describe("treasury deal route composer page", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    getFinanceDealRouteComposerById.mockResolvedValue({
      currencies: [],
      deal: {
        agreementId: "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
        amount: "125000.00",
        calculationId: null,
        createdAt: "2026-04-02T08:07:00.000Z",
        currencyId: "fdcf4040-4a4e-4c90-b550-6898ab3789f4",
        customerId: "714fb6eb-a1bd-429e-9628-e97d0f2efa0b",
        id: "814fb6eb-a1bd-429e-9628-e97d0f2efa0b",
        status: "draft",
        type: "payment",
        updatedAt: "2026-04-02T08:07:00.000Z",
      },
      lookupContext: {
        lookupDefaults: {
          defaultLimit: 20,
          maxLimit: 50,
          prefixMatching: true,
        },
        participantKinds: [],
        roleHints: [],
        strictSemantics: {
          accessControlOwnedByIam: true,
          customerLegalEntitiesViaCounterparties: true,
          organizationsInternalOnly: true,
          subAgentsRequireCanonicalProfile: true,
        },
      },
      route: null,
      templates: [],
      workspace: {
        acceptedQuote: null,
        acceptedQuoteDetails: null,
        actions: {
          canCloseDeal: false,
          canCreateCalculation: true,
          canCreateQuote: true,
          canRequestExecution: false,
          canRunReconciliation: false,
          canResolveExecutionBlocker: false,
          canUploadAttachment: true,
        },
        attachmentRequirements: [],
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
        nextAction: "Continue processing",
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
          targetCurrencyId: "0f9d972c-b95b-4544-95d8-8ccdc7496ed8",
        },
        profitabilitySnapshot: null,
        profitabilityVariance: null,
        queueContext: {
          blockers: [],
          queue: "funding",
          queueReason: "Continue processing",
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
          attachments: [],
          formalDocuments: [],
          operations: [],
          quotes: [],
          reconciliationExceptions: [],
        },
        summary: {
          applicantDisplayName: "ООО Ромашка",
          calculationId: null,
          createdAt: "2026-04-02T08:07:00.000Z",
          id: "814fb6eb-a1bd-429e-9628-e97d0f2efa0b",
          internalEntityDisplayName: "Мультиханса",
          status: "draft",
          type: "payment",
          updatedAt: "2026-04-02T08:07:00.000Z",
        },
        timeline: [],
      },
    });
  });

  it("loads route composer data and passes it to the workspace component", async () => {
    (
      globalThis as typeof globalThis & {
        React: typeof React;
      }
    ).React = React;

    const { default: TreasuryDealRouteComposerPage } = await import(
      "@/app/(shell)/treasury/deals/[id]/compose/page"
    );

    renderToStaticMarkup(
      await TreasuryDealRouteComposerPage({
        params: Promise.resolve({
          id: "814fb6eb-a1bd-429e-9628-e97d0f2efa0b",
        }),
      }),
    );

    expect(getFinanceDealRouteComposerById).toHaveBeenCalledWith(
      "814fb6eb-a1bd-429e-9628-e97d0f2efa0b",
    );
    expect(renderRouteComposerWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          deal: expect.objectContaining({
            id: "814fb6eb-a1bd-429e-9628-e97d0f2efa0b",
          }),
          workspace: expect.objectContaining({
            summary: expect.objectContaining({
              applicantDisplayName: "ООО Ромашка",
            }),
          }),
        }),
      }),
    );
  });
});
