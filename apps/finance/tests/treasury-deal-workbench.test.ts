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
  ArrowDownToLine: () => null,
  ArrowLeftRight: () => null,
  ArrowRight: () => null,
  ArrowUpFromLine: () => null,
  CheckCircle2: () => null,
  Clock3: () => null,
  Download: () => null,
  File: () => null,
  FileText: () => null,
  History: () => null,
  Info: () => null,
  ListChecks: () => null,
  Paperclip: () => null,
  PlayCircle: () => null,
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
    acceptedQuote: null,
    acceptedQuoteDetails: null,
    actions: {
      canCloseDeal: false,
      canCreateCalculation: false,
      canCreateQuote: true,
      canRequestExecution: true,
      canRunReconciliation: false,
      canResolveExecutionBlocker: false,
      canUploadAttachment: true,
    },
    attachmentRequirements: [],
    closeReadiness: {
      blockers: ["Required intake sections are incomplete"],
      criteria: [
        {
          code: "operations_materialized",
          label: "Казначейские операции созданы для всех шагов",
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
        fromCurrencyId: null,
        id: "714fb6eb-a1bd-429e-9628-e97d0f2efa0b",
        idx: 1,
        kind: "collect",
        operationRefs: [],
        routeSnapshotLegId: null,
        state: "pending",
        toCurrencyId: null,
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
      positions: [],
    },
    pricing: {
      fundingMessage: null,
      fundingResolution,
      quoteAmount: "125000.00",
      quoteAmountSide: "target",
      quoteEligibility: false,
      routeAttachment: null,
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
      instructionArtifacts: [],
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

    expect(markup).toContain("Шаги");
    expect(markup).toContain("Причина очереди");
    expect(markup).not.toContain("Контур исполнения");
    expect(markup).not.toContain("Обзор сделки");
    expect(markup).not.toContain("Что нужно сделать сейчас");
    expect(markup).not.toContain("Запросить котировку");
    expect(markup).not.toContain("Создать расчет");
    expect(markup.match(/Что мешает движению сделки/g)).toHaveLength(1);
    expect(
      markup.match(/Не заполнен обязательный участник: получатель выплаты\./g),
    ).toHaveLength(1);
  }, 30000);

  it("renders a single tab-less view with deal context, leg editor, and sidebar timeline", async () => {
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

    // Single-view layout: leg editor, timeline sidebar, context grid, and
    // deal context card are all rendered simultaneously. No tab shell.
    expect(markup).toContain("Шаги");
    expect(markup).toContain("Маршрут");
    expect(markup).toContain("Стороны");
    expect(markup).toContain("Денежный поток");
    expect(markup).toContain("Контекст сделки");
    expect(markup).toContain("Что мешает движению сделки");

    // Tab labels are gone.
    expect(markup).not.toContain("Котировки и расчет");
    expect(markup).not.toContain("Обзор сделки");

    // Pricing controls moved to CRM — finance workbench never shows them.
    expect(markup).not.toContain("Запросить котировку");
    expect(markup).not.toContain("Создать расчет");
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

    expect(normalizedMarkup).toContain("Денежный поток");
    expect(normalizedMarkup).toContain("Расходы провайдера");
    expect(normalizedMarkup).toContain("Сверка");
    expect(normalizedMarkup).toContain("Открытых исключений");
    expect(normalizedMarkup).toContain("bank_statement");
    expect(normalizedMarkup).toContain(
      "reconciliationExceptionId=exception-1",
    );
    expect(normalizedMarkup).toContain("25 513,38 RUB");
    expect(normalizedMarkup).not.toContain("2 551 338");
    expect(normalizedMarkup).not.toContain("Закрыть сделку");
  });

});
