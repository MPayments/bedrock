import React, { createElement, Fragment, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { FinanceDealExecutionWorkspace } from "@/features/treasury/deals/lib/execution-workspace";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children?: ReactNode;
    href?: string;
  }) => createElement("a", { href }, children),
}));

vi.mock("lucide-react", () => ({
  Activity: () => null,
  ArrowRightLeft: () => null,
  ListChecks: () => null,
  ShieldCheck: () => null,
  Workflow: () => null,
}));

vi.mock("@bedrock/sdk-ui/components/button", () => ({
  Button: ({
    children,
    render,
  }: {
    children?: ReactNode;
    render?: ReactNode;
  }) =>
    React.isValidElement(render)
      ? React.cloneElement(render, undefined, children)
      : createElement("button", null, children),
}));

vi.mock("@bedrock/sdk-ui/components/card", () => ({
  Card: ({ children }: { children?: ReactNode }) =>
    createElement(Fragment, null, children),
  CardContent: ({ children }: { children?: ReactNode }) =>
    createElement(Fragment, null, children),
  CardDescription: ({ children }: { children?: ReactNode }) =>
    createElement("p", null, children),
  CardHeader: ({ children }: { children?: ReactNode }) =>
    createElement(Fragment, null, children),
  CardTitle: ({ children }: { children?: ReactNode }) =>
    createElement("h3", null, children),
}));

vi.mock("@bedrock/sdk-ui/components/table", () => ({
  Table: ({ children }: { children?: ReactNode }) =>
    createElement("table", null, children),
  TableBody: ({ children }: { children?: ReactNode }) =>
    createElement("tbody", null, children),
  TableCell: ({ children }: { children?: ReactNode }) =>
    createElement("td", null, children),
  TableHead: ({ children }: { children?: ReactNode }) =>
    createElement("th", null, children),
  TableHeader: ({ children }: { children?: ReactNode }) =>
    createElement("thead", null, children),
  TableRow: ({ children }: { children?: ReactNode }) =>
    createElement("tr", null, children),
}));

vi.mock("@bedrock/sdk-ui/components/alert", () => ({
  Alert: ({ children }: { children?: ReactNode }) =>
    createElement("section", null, children),
  AlertDescription: ({ children }: { children?: ReactNode }) =>
    createElement("div", null, children),
  AlertTitle: ({ children }: { children?: ReactNode }) =>
    createElement("h4", null, children),
}));

vi.mock("@bedrock/sdk-ui/components/badge", () => ({
  Badge: ({ children }: { children?: ReactNode }) =>
    createElement("span", null, children),
}));

vi.mock("@/features/treasury/deals/components/workspace-layout", () => ({
  FinanceDealWorkspaceLayout: ({
    actions,
    children,
  }: {
    actions?: ReactNode;
    children?: ReactNode;
  }) => createElement(Fragment, null, actions, children),
}));

function createData(): FinanceDealExecutionWorkspace {
  return {
    currencies: [
      {
        code: "RUB",
        id: "45b2da57-4205-4607-a3ec-d0acbfb322ab",
        label: "RUB · Российский рубль",
        name: "Российский рубль",
      },
    ],
    deal: {
      acceptedCalculation: null,
      actions: {
        canCloseDeal: false,
        canCreateCalculation: true,
        canCreateQuote: true,
        canRequestExecution: true,
        canRunReconciliation: true,
        canResolveExecutionBlocker: false,
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
              kind: "payin",
              operationId: "814fb6eb-a1bd-429e-9628-e97d0f2efa0b",
              sourceRef: "deal-leg:collect",
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
        varianceByCostFamily: [
          {
            actual: [],
            classification: "expense",
            expected: [],
            family: "provider_fee",
            variance: [
              {
                amountMinor: "25000",
                currencyCode: "RUB",
                currencyId: "45b2da57-4205-4607-a3ec-d0acbfb322ab",
              },
            ],
          },
        ],
        varianceByLeg: [
          {
            actualFees: [
              {
                amountMinor: "25000",
                currencyCode: "RUB",
                currencyId: "45b2da57-4205-4607-a3ec-d0acbfb322ab",
              },
            ],
            actualFrom: {
              amountMinor: "1214375000",
              currencyCode: "RUB",
              currencyId: "45b2da57-4205-4607-a3ec-d0acbfb322ab",
            },
            actualTo: null,
            code: "collect",
            expectedFrom: {
              amountMinor: "1214375000",
              currencyCode: "RUB",
              currencyId: "45b2da57-4205-4607-a3ec-d0acbfb322ab",
            },
            expectedTo: null,
            idx: 1,
            kind: "collect",
            routeLegId: "714fb6eb-a1bd-429e-9628-e97d0f2efa0b",
            varianceFrom: {
              amountMinor: "0",
              currencyCode: "RUB",
              currencyId: "45b2da57-4205-4607-a3ec-d0acbfb322ab",
            },
            varianceTo: null,
          },
        ],
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
              createdAt: new Date("2026-04-02T08:10:00.000Z"),
              failedAt: null,
              id: "a14fb6eb-a1bd-429e-9628-e97d0f2efa0b",
              operationId: "814fb6eb-a1bd-429e-9628-e97d0f2efa0b",
              providerRef: "provider-1",
              providerSnapshot: null,
              returnRequestedAt: null,
              returnedAt: null,
              settledAt: new Date("2026-04-02T08:30:00.000Z"),
              sourceRef: "instruction-1",
              state: "settled",
              submittedAt: new Date("2026-04-02T08:20:00.000Z"),
              updatedAt: new Date("2026-04-02T08:30:00.000Z"),
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
    },
    cashMovements: [
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
        id: "b14fb6eb-a1bd-429e-9628-e97d0f2efa0b",
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
    fees: [
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
    fills: [],
  };
}

describe("treasury deal execution workspace", () => {
  it("renders the variance summary, operations, actuals, and close blockers", async () => {
    (
      globalThis as typeof globalThis & {
        React: typeof React;
      }
    ).React = React;

    const { ExecutionWorkspace } = await import(
      "@/features/treasury/deals/components/execution-workspace"
    );

    const markup = renderToStaticMarkup(
      createElement(ExecutionWorkspace, {
        data: createData(),
      }),
    );

    expect(markup).toContain("Expected vs Actual");
    expect(markup).toContain("Treasury operations");
    expect(markup).toContain("Actual execution actuals");
    expect(markup).toContain("provider fee");
    expect(markup).toContain("Close blockers");
    expect(markup).toContain("Провайдер");
  });
});
