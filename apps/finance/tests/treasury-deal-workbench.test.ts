import React, { createElement, Fragment, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FinanceDealWorkbench as FinanceDealWorkbenchData } from "@/features/treasury/deals/lib/queries";

const replace = vi.fn();
const refresh = vi.fn();
let searchParamsValue = "";

vi.mock("next/navigation", () => ({
  usePathname: () => "/treasury/deals/614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
  useRouter: () => ({
    refresh,
    replace,
  }),
  useSearchParams: () => new URLSearchParams(searchParamsValue),
}));

vi.mock("next/link", () => ({
  default: ({ children }: { children?: ReactNode }) =>
    createElement(Fragment, null, children),
}));

vi.mock("lucide-react", () => ({
  AlertCircle: () => null,
  CheckCircle2: () => null,
  Clock3: () => null,
  Download: () => null,
  File: () => null,
  FileText: () => null,
  Info: () => null,
  ListChecks: () => null,
  ShieldCheck: () => null,
  Trash2: () => null,
  Upload: () => null,
  Wallet: () => null,
  WalletCards: () => null,
  Workflow: () => null,
}));

vi.mock("@bedrock/sdk-ui/components/badge", () => ({
  Badge: ({ children }: { children?: ReactNode }) =>
    createElement(Fragment, null, children),
}));

vi.mock("@bedrock/sdk-ui/components/button", () => ({
  Button: ({ children }: { children?: ReactNode }) =>
    createElement(Fragment, null, children),
}));

vi.mock("@bedrock/sdk-ui/components/card", () => ({
  Card: ({ children }: { children?: ReactNode }) =>
    createElement(Fragment, null, children),
  CardContent: ({ children }: { children?: ReactNode }) =>
    createElement(Fragment, null, children),
  CardHeader: ({ children }: { children?: ReactNode }) =>
    createElement(Fragment, null, children),
  CardTitle: ({ children }: { children?: ReactNode }) =>
    createElement(Fragment, null, children),
}));

vi.mock("@bedrock/sdk-ui/components/sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/components/entities/workspace-layout", () => ({
  EntityWorkspaceTabs: ({
    tabs,
  }: {
    tabs: Array<{ id: string; label: string }>;
  }) =>
    createElement(
      "div",
      { "data-testid": "entity-workspace-tabs" },
      tabs.map((tab) => createElement("span", { key: tab.id }, tab.label)),
    ),
}));

vi.mock("@/features/treasury/deals/components/execution-summary-rail", () => ({
  ExecutionSummaryRail: () => createElement("div", null, "Контур исполнения"),
}));

vi.mock("@/features/treasury/deals/components/quote-request-dialog", () => ({
  QuoteRequestDialog: () => null,
}));

vi.mock("@/features/treasury/deals/components/upload-attachment-dialog", () => ({
  UploadAttachmentDialog: () => null,
}));

vi.mock("@/features/treasury/deals/components/workspace-layout", () => ({
  FinanceDealWorkspaceLayout: ({
    actions,
    children,
    controls,
  }: {
    actions?: ReactNode;
    children?: ReactNode;
    controls?: ReactNode;
  }) => createElement(Fragment, null, actions, controls, children),
}));

vi.mock("@/lib/resources/http", () => ({
  executeMutation: vi.fn(),
}));

function createDeal(): FinanceDealWorkbenchData {
  return {
    acceptedQuote: null,
    acceptedQuoteDetails: null,
    actions: {
      canCloseDeal: false,
      canCreateCalculation: false,
      canCreateQuote: true,
      canRequestExecution: true,
      canResolveExecutionBlocker: false,
      canUploadAttachment: true,
    },
    attachmentRequirements: [],
    closeReadiness: {
      blockers: ["Required intake sections are incomplete"],
      criteria: [
        {
          code: "operations_materialized",
          label: "Казначейские операции созданы для всех этапов",
          satisfied: false,
        },
        {
          code: "reconciliation_clear",
          label: "Сверка завершена без открытых исключений",
          satisfied: true,
        },
      ],
      ready: false,
    },
    calculationHistory: [],
    executionPlan: [
      {
        actions: {
          canCreateLegOperation: false,
        },
        id: "714fb6eb-a1bd-429e-9628-e97d0f2efa0b",
        idx: 1,
        kind: "collect",
        operationRefs: [],
        state: "pending",
      },
    ],
    formalDocumentRequirements: [
      {
        activeDocumentId: null,
        blockingReasons: ["Opening document is required: invoice"],
        createAllowed: false,
        docType: "invoice",
        openAllowed: false,
        stage: "opening",
        state: "missing",
      },
    ],
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
    nextAction: "Complete intake form",
    operationalState: {
      capabilities: [],
      positions: [],
    },
    pricing: {
      quoteAmount: "125000.00",
      quoteAmountSide: "target",
      quoteEligibility: false,
      sourceCurrencyId: "fdcf4040-4a4e-4c90-b550-6898ab3789f4",
      targetCurrencyId: "0f9d972c-b95b-4544-95d8-8ccdc7496ed8",
    },
    profitabilitySnapshot: null,
    quoteHistory: [],
    queueContext: {
      blockers: [
        "Required intake sections are incomplete",
        "Required participant is unresolved: external_beneficiary",
      ],
      queue: "funding",
      queueReason: "Required intake sections are incomplete",
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
      applicantDisplayName: "ООО Тест",
      calculationId: null,
      createdAt: "2026-04-02T08:07:00.000Z",
      id: "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
      internalEntityDisplayName: "Multihansa",
      status: "draft",
      type: "payment",
      updatedAt: "2026-04-02T08:09:00.000Z",
    },
    timeline: [
      {
        actor: {
          label: "alexey",
        },
        id: "bb36a82b-7a9b-4a88-91d7-39818114e79d",
        occurredAt: "2026-04-02T08:07:00.000Z",
        type: "deal_created",
      },
    ],
  };
}

describe("treasury deal workbench", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParamsValue = "";
  });

  it("opens the execution tab by default and keeps the operational summary centralized", async () => {
    (
      globalThis as typeof globalThis & {
        React: typeof React;
      }
    ).React = React;

    const { FinanceDealWorkbench } = await import(
      "@/features/treasury/deals/components/workbench"
    );

    const markup = renderToStaticMarkup(
      createElement(FinanceDealWorkbench, {
        deal: createDeal(),
      }),
    );

    expect(markup).toContain("Этапы исполнения");
    expect(markup).toContain("Операционная готовность");
    expect(markup).toContain("Контур исполнения");
    expect(markup).toContain("Причина очереди");
    expect(markup).not.toContain("Обзор сделки");
    expect(markup).not.toContain("Что нужно сделать сейчас");
    expect(markup).not.toContain("Запросить котировку");
    expect(markup).not.toContain("Создать расчет");
    expect(markup.match(/Что мешает движению сделки/g)).toHaveLength(1);
    expect(
      markup.match(/Не заполнен обязательный участник: получатель выплаты\./g),
    ).toHaveLength(1);
  }, 15000);

  it("renders the execution summary above the workspace tabs", async () => {
    (
      globalThis as typeof globalThis & {
        React: typeof React;
      }
    ).React = React;

    const { FinanceDealWorkbench } = await import(
      "@/features/treasury/deals/components/workbench"
    );

    const markup = renderToStaticMarkup(
      createElement(FinanceDealWorkbench, {
        deal: createDeal(),
      }),
    );

    expect(markup.indexOf("Что мешает движению сделки")).toBeGreaterThan(-1);
    expect(markup.indexOf("Котировки и расчет")).toBeGreaterThan(-1);
    expect(markup.indexOf("Что мешает движению сделки")).toBeLessThan(
      markup.indexOf("Котировки и расчет"),
    );
  });

  it("keeps the shared header on overview without duplicating next-step sections", async () => {
    searchParamsValue = "tab=overview";

    (
      globalThis as typeof globalThis & {
        React: typeof React;
      }
    ).React = React;

    const { FinanceDealWorkbench } = await import(
      "@/features/treasury/deals/components/workbench"
    );

    const markup = renderToStaticMarkup(
      createElement(FinanceDealWorkbench, {
        deal: createDeal(),
      }),
    );

    expect(markup).toContain("Обзор сделки");
    expect(markup.match(/Следующий шаг/g)).toHaveLength(1);
    expect(markup.match(/Что мешает движению сделки/g)).toHaveLength(1);
    expect(markup).not.toContain("Что нужно сделать сейчас");
    expect(markup).not.toContain("Запросить котировку");
    expect(markup).not.toContain("Создать расчет");
  });

  it("shows pricing actions only inside the pricing tab", async () => {
    searchParamsValue = "tab=pricing";

    (
      globalThis as typeof globalThis & {
        React: typeof React;
      }
    ).React = React;

    const { FinanceDealWorkbench } = await import(
      "@/features/treasury/deals/components/workbench"
    );

    const markup = renderToStaticMarkup(
      createElement(FinanceDealWorkbench, {
        deal: createDeal(),
      }),
    );

    expect(markup.match(/Запросить котировку/g)).toHaveLength(1);
    expect(markup.match(/Создать расчет/g)).toHaveLength(1);
  });

  it("renders profitability, reconciliation, and close-readiness details from the backend projection", async () => {
    (
      globalThis as typeof globalThis & {
        React: typeof React;
      }
    ).React = React;

    const { FinanceDealWorkbench } = await import(
      "@/features/treasury/deals/components/workbench"
    );
    const deal = createDeal();
    deal.profitabilitySnapshot = {
      calculationId: "calc-1",
      currencyId: "fdcf4040-4a4e-4c90-b550-6898ab3789f4",
      feeRevenueMinor: "1000",
      providerFeeExpenseMinor: "250",
      spreadRevenueMinor: "500",
      totalRevenueMinor: "1500",
    };
    deal.reconciliationSummary = {
      ignoredExceptionCount: 0,
      lastActivityAt: "2026-04-02T10:00:00.000Z",
      openExceptionCount: 1,
      pendingOperationCount: 1,
      reconciledOperationCount: 0,
      requiredOperationCount: 1,
      resolvedExceptionCount: 0,
      state: "blocked",
    };
    deal.relatedResources.reconciliationExceptions = [
      {
        blocking: true,
        createdAt: "2026-04-02T10:00:00.000Z",
        externalRecordId: "external-record-1",
        id: "exception-1",
        operationId: "operation-1",
        reasonCode: "no_match",
        resolvedAt: null,
        source: "bank_statement",
        state: "open",
      },
    ];

    const markup = renderToStaticMarkup(
      createElement(FinanceDealWorkbench, {
        deal,
      }),
    );

    expect(markup).toContain("Финансовый результат и закрытие");
    expect(markup).toContain("Расходы провайдера");
    expect(markup).toContain("Результат сверки");
    expect(markup).toContain("Открытых исключений");
    expect(markup).toContain("Исключения сверки");
    expect(markup).toContain("bank_statement");
    expect(markup).not.toContain("Закрыть сделку");
  });
});
