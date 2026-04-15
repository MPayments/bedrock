import React, { createElement, Fragment, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { FinanceDealReconciliationWorkspace } from "@/features/treasury/deals/lib/reconciliation-workspace";

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
  AlertCircle: () => null,
  ArrowRightLeft: () => null,
  ShieldCheck: () => null,
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

function createData(): FinanceDealReconciliationWorkspace {
  return {
    currencies: [],
    deal: {
      acceptedQuote: null,
      acceptedQuoteDetails: null,
      actions: {
        canCloseDeal: false,
        canCreateCalculation: true,
        canCreateQuote: true,
        canRequestExecution: false,
        canRunReconciliation: true,
        canResolveExecutionBlocker: false,
        canUploadAttachment: true,
      },
      attachmentRequirements: [],
      calculationHistory: [],
      closeReadiness: {
        blockers: ["Open reconciliation exceptions remain"],
        criteria: [
          {
            code: "reconciliation_clear",
            label: "Нет блокирующих исключений сверки",
            satisfied: false,
          },
        ],
        ready: false,
      },
      executionPlan: [],
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
      nextAction: "Resolve reconciliation exception",
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
          factCount: 2,
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
        varianceByCostFamily: [],
        varianceByLeg: [],
      },
      queueContext: {
        blockers: [],
        queue: "execution",
        queueReason: "Resolve reconciliation exception",
      },
      quoteHistory: [],
      reconciliationSummary: {
        ignoredExceptionCount: 0,
        lastActivityAt: null,
        openExceptionCount: 1,
        pendingOperationCount: 0,
        reconciledOperationCount: 1,
        requiredOperationCount: 1,
        resolvedExceptionCount: 0,
        state: "blocked",
      },
      relatedResources: {
        attachments: [],
        formalDocuments: [],
        operations: [],
        quotes: [],
        reconciliationExceptions: [
          {
            actions: {
              adjustmentDocumentDocType: "adjustment",
              canIgnore: true,
            },
            blocking: true,
            createdAt: "2026-04-02T08:35:00.000Z",
            externalRecordId: "ext-1",
            id: "a14fb6eb-a1bd-429e-9628-e97d0f2efa0b",
            operationId: "814fb6eb-a1bd-429e-9628-e97d0f2efa0b",
            reasonCode: "amount_mismatch",
            resolvedAt: null,
            source: "bank_statement",
            state: "open",
          },
        ],
      },
      summary: {
        applicantDisplayName: "ООО Ромашка",
        calculationId: "914fb6eb-a1bd-429e-9628-e97d0f2efa0b",
        createdAt: "2026-04-02T08:07:00.000Z",
        id: "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
        internalEntityDisplayName: "Мультиханса",
        status: "awaiting_payment",
        type: "payment",
        updatedAt: "2026-04-02T08:07:00.000Z",
      },
      timeline: [],
    },
    facts: [
      {
        amountMinor: "1214375000",
        confirmedAt: "2026-04-02T08:35:00.000Z",
        counterAmountMinor: null,
        counterCurrencyId: null,
        createdAt: "2026-04-02T08:35:00.000Z",
        currencyId: "45b2da57-4205-4607-a3ec-d0acbfb322ab",
        dealId: "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
        externalRecordId: "ext-1",
        feeAmountMinor: "25000",
        feeCurrencyId: "45b2da57-4205-4607-a3ec-d0acbfb322ab",
        id: "b14fb6eb-a1bd-429e-9628-e97d0f2efa0b",
        instructionId: null,
        metadata: null,
        notes: null,
        operationId: "814fb6eb-a1bd-429e-9628-e97d0f2efa0b",
        providerRef: null,
        recordedAt: "2026-04-02T08:35:00.000Z",
        routeLegId: null,
        sourceKind: "reconciliation",
        sourceRef: "reconciliation:1",
        updatedAt: "2026-04-02T08:35:00.000Z",
      },
    ],
  };
}

describe("treasury deal reconciliation workspace", () => {
  it("renders matched records, exceptions, variance explanations, and blockers", async () => {
    (
      globalThis as typeof globalThis & {
        React: typeof React;
      }
    ).React = React;

    const { ReconciliationWorkspace } = await import(
      "@/features/treasury/deals/components/reconciliation-workspace"
    );

    const markup = renderToStaticMarkup(
      createElement(ReconciliationWorkspace, {
        data: createData(),
      }),
    );

    expect(markup).toContain("Matched records");
    expect(markup).toContain("Open exceptions");
    expect(markup).toContain("Variance explanations");
    expect(markup).toContain("amount_mismatch");
    expect(markup).toContain("Close blockers");
  });
});
