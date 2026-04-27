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

vi.mock("@/features/treasury/steps/components/step-card", () => ({
  StepCard: ({ step, title }: { step: { id: string }; title?: string }) =>
    createElement(
      "div",
      { "data-testid": `finance-step-card-${step.id}` },
      title,
    ),
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
    cashflowSummary: {
      receivedIn: [],
      scheduledOut: [],
      settledOut: [],
    },
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
    executionSteps: [],
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
        routeSnapshotLegId: null,
        runtimeState: "not_materialized",
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
    printForms: {
      calculation: [],
      deal: [],
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
      paymentSteps: [],
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

  it("renders the KPI header banner with progress / cashflow / documents tiles", async () => {
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
    // Header becomes a compact KPI tile strip — each tile has a stable testid.
    expect(markup).toContain('data-testid="finance-deal-header-progress"');
    expect(markup).toContain('data-testid="finance-deal-header-received-in"');
    expect(markup).toContain('data-testid="finance-deal-header-scheduled-out"');
    expect(markup).toContain('data-testid="finance-deal-header-margin"');
    expect(markup).toContain('data-testid="finance-deal-header-documents"');
  }, 30000);

  it("shows an empty-state placeholder when the deal has no materialized payment steps", async () => {
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

    // After commit 11 the legacy LegEditor is gone — workbench falls back to
    // the empty-state card until a step materializes for the selected leg.
    expect(markup).toContain(
      "Шагов исполнения ещё нет",
    );
    expect(markup).not.toContain('data-testid="finance-step-card-');
  });

  it("renders StepCard when executionSteps has a matching payment step", async () => {
    (
      globalThis as typeof globalThis & {
        React: typeof React;
      }
    ).React = React;

    const { FinanceDealWorkbench } = await import(
      "@/features/treasury/deals/components/workbench"
    );

    const deal = createDeal();
    deal.executionSteps = [
      {
        artifacts: [],
        attempts: [],
        amendments: [],
        completedAt: null,
        createdAt: "2026-04-02T08:07:00.000Z",
        currentRoute: {
          fromAmountMinor: "10000",
          fromCurrencyId: "0f9d972c-b95b-4544-95d8-8ccdc7496ed8",
          fromParty: {
            id: "11111111-1111-4111-8111-111111111111",
            requisiteId: null,
          },
          rate: null,
          toAmountMinor: "10000",
          toCurrencyId: "0f9d972c-b95b-4544-95d8-8ccdc7496ed8",
          toParty: {
            id: "33333333-3333-4333-8333-333333333333",
            requisiteId: null,
          },
        },
        dealId: deal.summary.id,
        failureReason: null,
        fromAmountMinor: "10000",
        fromCurrencyId: "0f9d972c-b95b-4544-95d8-8ccdc7496ed8",
        fromParty: {
          id: "11111111-1111-4111-8111-111111111111",
          requisiteId: null,
        },
        id: "22222222-2222-4222-8222-222222222222",
        kind: "payin",
        origin: {
          dealId: deal.summary.id,
          planLegId: "714fb6eb-a1bd-429e-9628-e97d0f2efa0b",
          routeSnapshotLegId: null,
          sequence: 1,
          treasuryOrderId: null,
          type: "deal_execution_leg",
        },
        plannedRoute: {
          fromAmountMinor: "10000",
          fromCurrencyId: "0f9d972c-b95b-4544-95d8-8ccdc7496ed8",
          fromParty: {
            id: "11111111-1111-4111-8111-111111111111",
            requisiteId: null,
          },
          rate: null,
          toAmountMinor: "10000",
          toCurrencyId: "0f9d972c-b95b-4544-95d8-8ccdc7496ed8",
          toParty: {
            id: "33333333-3333-4333-8333-333333333333",
            requisiteId: null,
          },
        },
        postingDocumentRefs: [],
        purpose: "deal_leg",
        quoteId: null,
        rate: null,
        returns: [],
        scheduledAt: null,
        sourceRef:
          "deal:614fb6eb-a1bd-429e-9628-e97d0f2efa0b:plan-leg:714fb6eb-a1bd-429e-9628-e97d0f2efa0b:payin:1",
        state: "pending",
        submittedAt: null,
        toAmountMinor: "10000",
        toCurrencyId: "0f9d972c-b95b-4544-95d8-8ccdc7496ed8",
        toParty: {
          id: "33333333-3333-4333-8333-333333333333",
          requisiteId: null,
        },
        treasuryBatchId: null,
        updatedAt: "2026-04-02T08:07:00.000Z",
      },
    ];

    const markup = renderToStaticMarkup(
      createElement(FinanceDealWorkbench, {
        deal,
      }),
    );

    // New path: the StepCard replaces the leg editor for the selected leg.
    expect(markup).toContain(
      'data-testid="finance-step-card-22222222-2222-4222-8222-222222222222"',
    );
    expect(markup).not.toContain('data-testid="finance-deal-leg-editor-1"');
  });

  it("renders the deal context, leg editor, and sidebar timeline together", async () => {
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
    expect(markup).toContain("Маршрут");
    expect(markup).toContain("Денежный поток");
    expect(markup).toContain("Контекст сделки");
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
      netProfit: null,
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
