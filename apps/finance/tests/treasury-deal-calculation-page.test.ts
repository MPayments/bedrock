import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getFinanceDealCalculationWorkspaceById = vi.fn();
const renderCalculationWorkspace = vi.fn<(props: unknown) => null>(() => null);

vi.mock("@/features/treasury/deals/lib/calculation-workspace", () => ({
  getFinanceDealCalculationWorkspaceById,
}));

vi.mock("@/features/treasury/deals/components/calculation-workspace", () => ({
  CalculationWorkspace: (props: unknown) => {
    renderCalculationWorkspace(props);
    return createElement("section");
  },
}));

describe("treasury deal calculation page", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    getFinanceDealCalculationWorkspaceById.mockResolvedValue({
      comparison: null,
      currentCalculation: null,
      currencies: [],
      deal: {
        acceptedCalculation: null,
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
        calculationHistory: [],
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
          calculationId: null,
          createdAt: "2026-04-02T08:07:00.000Z",
          id: "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
          internalEntityDisplayName: "Мультиханса",
          status: "draft",
          type: "payment",
          updatedAt: "2026-04-02T08:07:00.000Z",
        },
        timeline: [],
      },
    });
  });

  it("loads calculation workspace data and passes it to the page component", async () => {
    (
      globalThis as typeof globalThis & {
        React: typeof React;
      }
    ).React = React;

    const { default: TreasuryDealCalculationPage } = await import(
      "@/app/(shell)/treasury/deals/[id]/calculation/page"
    );

    renderToStaticMarkup(
      await TreasuryDealCalculationPage({
        params: Promise.resolve({
          id: "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
        }),
      }),
    );

    expect(getFinanceDealCalculationWorkspaceById).toHaveBeenCalledWith(
      "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
    );
    expect(renderCalculationWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          deal: expect.objectContaining({
            summary: expect.objectContaining({
              applicantDisplayName: "ООО Ромашка",
            }),
          }),
        }),
      }),
    );
  });
});
