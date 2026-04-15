import React, { createElement, Fragment, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { FinanceDealCalculationWorkspace } from "@/features/treasury/deals/lib/calculation-workspace";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh,
  }),
}));

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
  ArrowRightLeft: () => null,
  Calculator: () => null,
  Clock3: () => null,
  LineChart: () => null,
  ListChecks: () => null,
  Save: () => null,
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

vi.mock("@bedrock/sdk-ui/components/sheet", () => ({
  Sheet: ({ children }: { children?: ReactNode }) =>
    createElement(Fragment, null, children),
  SheetContent: ({ children }: { children?: ReactNode }) =>
    createElement(Fragment, null, children),
  SheetDescription: ({ children }: { children?: ReactNode }) =>
    createElement("p", null, children),
  SheetHeader: ({ children }: { children?: ReactNode }) =>
    createElement(Fragment, null, children),
  SheetTitle: ({ children }: { children?: ReactNode }) =>
    createElement("h3", null, children),
  SheetTrigger: ({
    children,
    render,
  }: {
    children?: ReactNode;
    render?: ReactNode;
  }) =>
    React.isValidElement(render)
      ? children
        ? React.cloneElement(render, undefined, children)
        : render
      : createElement(Fragment, null, children),
}));

vi.mock("@bedrock/sdk-ui/components/sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
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

vi.mock("@/features/treasury/deals/components/workbench", () => ({
  formatQuoteAmountsSummary: () => "125000.00 USD → 12143750.00 RUB",
  formatQuoteRateSummary: () => "97.15 RUB за 1 USD",
  refreshPage: vi.fn(),
}));

vi.mock("@/lib/resources/http", () => ({
  executeMutation: vi.fn(),
}));

function createData(): FinanceDealCalculationWorkspace {
  return {
    comparison: {
      left: {
        createdAt: "2026-04-02T08:30:00.000Z",
        currentSnapshot: {
          baseCurrencyId: "45b2da57-4205-4607-a3ec-d0acbfb322ab",
          calculationCurrencyId: "45b2da57-4205-4607-a3ec-d0acbfb322ab",
          calculationTimestamp: "2026-04-02T08:30:00.000Z",
          expenseAmountInBaseMinor: "25000",
          grossRevenueInBaseMinor: "125000",
          id: "c4e45b12-a65a-4907-b5af-94efcda0f4e4",
          netMarginInBaseMinor: "100000",
          passThroughAmountInBaseMinor: "0",
          rateDen: "100",
          rateNum: "9715",
          rateSource: "route",
          routeVersionId: "814fb6eb-a1bd-429e-9628-e97d0f2efa0b",
          snapshotNumber: 2,
          state: "accepted",
          totalAmountMinor: "1214375000",
          totalInBaseMinor: "1214375000",
          totalWithExpensesInBaseMinor: "1214400000",
        },
        id: "7f6491b3-5226-4e34-a019-92a41315d642",
        isActive: true,
        lines: [
          {
            amountMinor: "25000",
            classification: "expense",
            componentCode: "wire_fee",
            componentFamily: "provider_fee",
            currencyId: "45b2da57-4205-4607-a3ec-d0acbfb322ab",
            idx: 0,
            kind: "cost_component",
            routeLegId: "914fb6eb-a1bd-429e-9628-e97d0f2efa0b",
            sourceKind: "route",
          },
        ],
        updatedAt: "2026-04-02T08:30:00.000Z",
      },
      lineDiffs: [
        {
          classification: "expense",
          componentCode: "wire_fee",
          componentFamily: "provider_fee",
          currencyId: "45b2da57-4205-4607-a3ec-d0acbfb322ab",
          deltaAmountMinor: "5000",
          kind: "cost_component",
          leftAmountMinor: "25000",
          rightAmountMinor: "20000",
          routeLegId: "914fb6eb-a1bd-429e-9628-e97d0f2efa0b",
        },
      ],
      right: {
        createdAt: "2026-04-02T08:12:00.000Z",
        currentSnapshot: {
          baseCurrencyId: "45b2da57-4205-4607-a3ec-d0acbfb322ab",
          calculationCurrencyId: "45b2da57-4205-4607-a3ec-d0acbfb322ab",
          calculationTimestamp: "2026-04-02T08:12:00.000Z",
          expenseAmountInBaseMinor: "20000",
          grossRevenueInBaseMinor: "125000",
          id: "467a4f24-fec5-4f67-8ea9-5551a4f8958b",
          netMarginInBaseMinor: "105000",
          passThroughAmountInBaseMinor: "0",
          rateDen: "100",
          rateNum: "9710",
          rateSource: "route",
          routeVersionId: "714fb6eb-a1bd-429e-9628-e97d0f2efa0b",
          snapshotNumber: 1,
          state: "draft",
          totalAmountMinor: "1214375000",
          totalInBaseMinor: "1214375000",
          totalWithExpensesInBaseMinor: "1214395000",
        },
        id: "df65ce76-7cb4-4eb0-b4c0-080cf2a70413",
        isActive: false,
        lines: [],
        updatedAt: "2026-04-02T08:12:00.000Z",
      },
      totals: {
        expenseAmountInBaseMinor: {
          deltaMinor: "5000",
          leftMinor: "25000",
          rightMinor: "20000",
        },
        grossRevenueInBaseMinor: {
          deltaMinor: "0",
          leftMinor: "125000",
          rightMinor: "125000",
        },
        netMarginInBaseMinor: {
          deltaMinor: "-5000",
          leftMinor: "100000",
          rightMinor: "105000",
        },
        passThroughAmountInBaseMinor: {
          deltaMinor: "0",
          leftMinor: "0",
          rightMinor: "0",
        },
        totalInBaseMinor: {
          deltaMinor: "0",
          leftMinor: "1214375000",
          rightMinor: "1214375000",
        },
        totalWithExpensesInBaseMinor: {
          deltaMinor: "5000",
          leftMinor: "1214400000",
          rightMinor: "1214395000",
        },
      },
    },
    currentCalculation: {
      createdAt: "2026-04-02T08:30:00.000Z",
      currentSnapshot: {
        baseCurrencyId: "45b2da57-4205-4607-a3ec-d0acbfb322ab",
        calculationCurrencyId: "45b2da57-4205-4607-a3ec-d0acbfb322ab",
        calculationTimestamp: "2026-04-02T08:30:00.000Z",
        expenseAmountInBaseMinor: "25000",
        grossRevenueInBaseMinor: "125000",
        id: "c4e45b12-a65a-4907-b5af-94efcda0f4e4",
        netMarginInBaseMinor: "100000",
        passThroughAmountInBaseMinor: "0",
        rateDen: "100",
        rateNum: "9715",
        rateSource: "route",
        routeVersionId: "814fb6eb-a1bd-429e-9628-e97d0f2efa0b",
        snapshotNumber: 2,
        state: "accepted",
        totalAmountMinor: "1214375000",
        totalInBaseMinor: "1214375000",
        totalWithExpensesInBaseMinor: "1214400000",
      },
      id: "7f6491b3-5226-4e34-a019-92a41315d642",
      isActive: true,
      lines: [
        {
          amountMinor: "25000",
          classification: "expense",
          componentCode: "wire_fee",
          componentFamily: "provider_fee",
          currencyId: "45b2da57-4205-4607-a3ec-d0acbfb322ab",
          idx: 0,
          kind: "cost_component",
          routeLegId: "914fb6eb-a1bd-429e-9628-e97d0f2efa0b",
          sourceKind: "route",
        },
      ],
      updatedAt: "2026-04-02T08:30:00.000Z",
    },
    currencies: [
      {
        code: "RUB",
        id: "45b2da57-4205-4607-a3ec-d0acbfb322ab",
        label: "RUB · Российский рубль",
        name: "Российский рубль",
      },
    ],
    deal: {
      acceptedCalculation: {
        acceptedAt: "2026-04-02T08:15:00.000Z",
        calculationId: "7f6491b3-5226-4e34-a019-92a41315d642",
        calculationTimestamp: "2026-04-02T08:15:00.000Z",
        pricingProvenance: null,
        quoteProvenance: {
          fxQuoteId: "a68fcc97-b77c-43b0-a323-45b6f783fd3a",
          quoteSnapshot: null,
          sourceQuoteId: "a68fcc97-b77c-43b0-a323-45b6f783fd3a",
        },
        routeVersionId: null,
        snapshotId: "7f6491b3-5226-4e34-a019-92a41315d643",
        state: "accepted",
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
      attachmentRequirements: [],
      calculationHistory: [
        {
          baseCurrencyId: "45b2da57-4205-4607-a3ec-d0acbfb322ab",
          calculationCurrencyId: "45b2da57-4205-4607-a3ec-d0acbfb322ab",
          calculationId: "7f6491b3-5226-4e34-a019-92a41315d642",
          calculationTimestamp: "2026-04-02T08:30:00.000Z",
          createdAt: "2026-04-02T08:30:00.000Z",
          fxQuoteId: "a68fcc97-b77c-43b0-a323-45b6f783fd3a",
          originalAmountMinor: "12500000",
          rateDen: "100",
          rateNum: "9715",
          sourceQuoteId: "a68fcc97-b77c-43b0-a323-45b6f783fd3a",
          totalAmountMinor: "1214375000",
          totalFeeAmountMinor: "25000",
          totalInBaseMinor: "1214375000",
          totalWithExpensesInBaseMinor: "1214400000",
        },
        {
          baseCurrencyId: "45b2da57-4205-4607-a3ec-d0acbfb322ab",
          calculationCurrencyId: "45b2da57-4205-4607-a3ec-d0acbfb322ab",
          calculationId: "df65ce76-7cb4-4eb0-b4c0-080cf2a70413",
          calculationTimestamp: "2026-04-02T08:12:00.000Z",
          createdAt: "2026-04-02T08:12:00.000Z",
          fxQuoteId: "a68fcc97-b77c-43b0-a323-45b6f783fd3a",
          originalAmountMinor: "12500000",
          rateDen: "100",
          rateNum: "9710",
          sourceQuoteId: "a68fcc97-b77c-43b0-a323-45b6f783fd3a",
          totalAmountMinor: "1214375000",
          totalFeeAmountMinor: "20000",
          totalInBaseMinor: "1214375000",
          totalWithExpensesInBaseMinor: "1214395000",
        },
      ],
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
      queueContext: {
        blockers: [],
        queue: "funding",
        queueReason: "Create calculation from route",
      },
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
        calculationId: "7f6491b3-5226-4e34-a019-92a41315d642",
        createdAt: "2026-04-02T08:07:00.000Z",
        id: "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
        internalEntityDisplayName: "Мультиханса",
        status: "draft",
        type: "payment",
        updatedAt: "2026-04-02T08:07:00.000Z",
      },
      timeline: [],
    },
  };
}

describe("treasury deal calculation workspace", () => {
  it("renders the current snapshot, compare drawer, and calculation history", async () => {
    (
      globalThis as typeof globalThis & {
        React: typeof React;
      }
    ).React = React;

    const { CalculationWorkspace } = await import(
      "@/features/treasury/deals/components/calculation-workspace"
    );

    const markup = renderToStaticMarkup(
      createElement(CalculationWorkspace, {
        data: createData(),
      }),
    );

    expect(markup).toContain("Current snapshot");
    expect(markup).toContain("Calculation lines");
    expect(markup).toContain("Сравнить snapshots");
    expect(markup).toContain("Итоговые дельты");
    expect(markup).toContain("wire_fee");
    expect(markup).toContain("История расчетов");
  });
});
