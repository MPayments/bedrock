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
  Calculator: () => null,
  CheckCircle2: () => null,
  Clock3: () => null,
  Download: () => null,
  File: () => null,
  FileText: () => null,
  History: () => null,
  Info: () => null,
  ListChecks: () => null,
  Paperclip: () => null,
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
  Button: ({
    children,
    render,
  }: {
    children?: ReactNode;
    render?: ReactNode;
  }) =>
    React.isValidElement(render)
      ? React.cloneElement(render, undefined, children)
      : createElement(Fragment, null, children),
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
  const fundingResolution = {
    availableMinor: null,
    fundingOrganizationId: null,
    fundingRequisiteId: null,
    reasonCode: "accepted_quote_missing",
    requiredAmountMinor: null,
    state: "blocked" as const,
    strategy: null,
    targetCurrency: "USD",
    targetCurrencyId: "0f9d972c-b95b-4544-95d8-8ccdc7496ed8",
  };

  return {
    acceptedCalculation: null,
    actions: {
      canAcceptCalculation: false,
      canCloseDeal: false,
      canCreateCalculation: false,
      canCreateQuote: true,
      canRecordCashMovement: false,
      canRecordExecutionFee: false,
      canRecordExecutionFill: false,
      canRequestExecution: true,
      canRunReconciliation: false,
      canResolveExecutionBlocker: false,
      canSupersedeCalculation: false,
      canUploadAttachment: true,
    },
    attachmentRequirements: [],
    closeReadiness: {
      blockers: ["Required deal header sections are incomplete"],
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
          exchangeDocument: null,
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
    nextAction: "Complete deal header",
    operationalState: {
      positions: [],
    },
    pricing: {
      fundingMessage: null,
      fundingResolution,
      quoteAmount: "125000.00",
      quoteAmountSide: "target",
      quoteEligibility: false,
      sourceCurrencyId: "fdcf4040-4a4e-4c90-b550-6898ab3789f4",
      targetCurrencyId: "0f9d972c-b95b-4544-95d8-8ccdc7496ed8",
    },
    profitabilitySnapshot: null,
    profitabilityVariance: null,
    quoteHistory: [],
    queueContext: {
      blockers: [
        "Required deal header sections are incomplete",
        "Required participant is unresolved: external_beneficiary",
      ],
      queue: "funding",
      queueReason: "Required deal header sections are incomplete",
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
        payload: {},
        type: "deal_created",
      },
    ],
  };
}

function normalizeMarkupWhitespace(markup: string) {
  return markup.replaceAll(/\u00a0|\u202f/gu, " ");
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
  }, 30000);

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
  }, 15000);

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

    expect(markup).toContain("Запросить котировку");
    expect(markup).toContain("Создать расчет");
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
      feeRevenue: [
        {
          amountMinor: "2551338",
          currencyCode: "RUB",
          currencyId: "fdcf4040-4a4e-4c90-b550-6898ab3789f4",
        },
      ],
      providerFeeExpense: [
        {
          amountMinor: "250",
          currencyCode: "RUB",
          currencyId: "fdcf4040-4a4e-4c90-b550-6898ab3789f4",
        },
      ],
      spreadRevenue: [
        {
          amountMinor: "500",
          currencyCode: "RUB",
          currencyId: "fdcf4040-4a4e-4c90-b550-6898ab3789f4",
        },
      ],
      totalRevenue: [
        {
          amountMinor: "2551838",
          currencyCode: "RUB",
          currencyId: "fdcf4040-4a4e-4c90-b550-6898ab3789f4",
        },
      ],
    };
    deal.profitabilityVariance = {
      actualCoverage: {
        factCount: 2,
        legsWithFacts: 2,
        operationCount: 2,
        state: "partial",
        terminalOperationCount: 1,
        totalLegCount: 3,
      },
      actualExpense: [
        {
          amountMinor: "400",
          currencyCode: "RUB",
          currencyId: "fdcf4040-4a4e-4c90-b550-6898ab3789f4",
        },
      ],
      actualPassThrough: [
        {
          amountMinor: "150",
          currencyCode: "RUB",
          currencyId: "fdcf4040-4a4e-4c90-b550-6898ab3789f4",
        },
      ],
      calculationId: "calc-1",
      expectedNetMargin: [
        {
          amountMinor: "2551088",
          currencyCode: "RUB",
          currencyId: "fdcf4040-4a4e-4c90-b550-6898ab3789f4",
        },
      ],
      netMarginVariance: [
        {
          amountMinor: "-50",
          currencyCode: "RUB",
          currencyId: "fdcf4040-4a4e-4c90-b550-6898ab3789f4",
        },
      ],
      realizedNetMargin: [
        {
          amountMinor: "2551038",
          currencyCode: "RUB",
          currencyId: "fdcf4040-4a4e-4c90-b550-6898ab3789f4",
        },
      ],
      varianceByCostFamily: [
        {
          actual: [
            {
              amountMinor: "400",
              currencyCode: "RUB",
              currencyId: "fdcf4040-4a4e-4c90-b550-6898ab3789f4",
            },
          ],
          classification: "expense",
          expected: [
            {
              amountMinor: "250",
              currencyCode: "RUB",
              currencyId: "fdcf4040-4a4e-4c90-b550-6898ab3789f4",
            },
          ],
          family: "provider_fee",
          variance: [
            {
              amountMinor: "150",
              currencyCode: "RUB",
              currencyId: "fdcf4040-4a4e-4c90-b550-6898ab3789f4",
            },
          ],
        },
      ],
      varianceByLeg: [
        {
          actualFees: [
            {
              amountMinor: "400",
              currencyCode: "RUB",
              currencyId: "fdcf4040-4a4e-4c90-b550-6898ab3789f4",
            },
          ],
          actualFrom: null,
          actualTo: null,
          code: "fx-leg",
          expectedFrom: null,
          expectedTo: null,
          idx: 2,
          kind: "fx_conversion",
          routeLegId: "714fb6eb-a1bd-429e-9628-e97d0f2efa0b",
          varianceFrom: null,
          varianceTo: null,
        },
      ],
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
        actions: {
          adjustmentDocumentDocType: "transfer_resolution",
          canIgnore: true,
        },
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

    const normalizedMarkup = normalizeMarkupWhitespace(markup);

    expect(normalizedMarkup).toContain("Финансовый результат и закрытие");
    expect(normalizedMarkup).toContain("Расходы провайдера");
    expect(normalizedMarkup).toContain("Plan vs Actual");
    expect(normalizedMarkup).toContain("Реализованная маржа");
    expect(normalizedMarkup).toContain("Variance по этапам маршрута");
    expect(normalizedMarkup).toContain("Результат сверки");
    expect(normalizedMarkup).toContain("Открытых исключений");
    expect(normalizedMarkup).toContain("Исключения сверки");
    expect(normalizedMarkup).toContain("bank_statement");
    expect(normalizedMarkup).toContain(
      "reconciliationExceptionId=exception-1",
    );
    expect(normalizedMarkup).toContain("25 513,38 RUB");
    expect(normalizedMarkup).not.toContain("2 551 338");
    expect(normalizedMarkup).not.toContain("Закрыть сделку");
  });

  it("renders a deal-scoped create action for missing formal document requirements", async () => {
    searchParamsValue = "tab=documents";

    (
      globalThis as typeof globalThis & {
        React: typeof React;
      }
    ).React = React;

    const { FinanceDealWorkbench } = await import(
      "@/features/treasury/deals/components/workbench"
    );
    const deal = createDeal();
    const [firstRequirement] = deal.formalDocumentRequirements;
    if (!firstRequirement) {
      throw new Error("Expected at least one formal document requirement");
    }
    deal.formalDocumentRequirements = [
      {
        ...firstRequirement,
        createAllowed: true,
      },
    ];

    const markup = renderToStaticMarkup(
      createElement(FinanceDealWorkbench, {
        deal,
      }),
    );

    expect(markup).toContain("Создать");
    expect(markup).toContain(
      "returnTo=%2Ftreasury%2Fdeals%2F614fb6eb-a1bd-429e-9628-e97d0f2efa0b%3Ftab%3Ddocuments",
    );
  });

  it("keeps the requirement-row open action and removes the duplicate card open action", async () => {
    searchParamsValue = "tab=documents";

    (
      globalThis as typeof globalThis & {
        React: typeof React;
      }
    ).React = React;

    const { FinanceDealWorkbench } = await import(
      "@/features/treasury/deals/components/workbench"
    );
    const deal = createDeal();
    deal.formalDocumentRequirements = [
      {
        activeDocumentId: "doc-1",
        blockingReasons: [
          "Opening document is not ready: invoice",
        ],
        createAllowed: false,
        docType: "invoice",
        openAllowed: true,
        stage: "opening",
        state: "in_progress",
      },
    ];
    deal.relatedResources.formalDocuments = [
      {
        approvalStatus: "pending",
        createdAt: "2026-04-02T08:10:00.000Z",
        docType: "invoice",
        id: "doc-1",
        lifecycleStatus: "active",
        occurredAt: "2026-04-02T08:10:00.000Z",
        postingStatus: "unposted",
        submissionStatus: "draft",
      },
    ];

    const markup = renderToStaticMarkup(
      createElement(FinanceDealWorkbench, {
        deal,
      }),
    );

    expect(markup.match(/Открыть/g)).toHaveLength(1);
  });
});
