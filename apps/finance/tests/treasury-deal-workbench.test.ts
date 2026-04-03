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
    nextAction: "Complete intake form",
    operationalState: {
      capabilities: [],
      positions: [],
    },
    pricing: {
      quoteEligibility: false,
      requestedAmount: "125000.00",
      requestedCurrencyId: "fdcf4040-4a4e-4c90-b550-6898ab3789f4",
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
    relatedResources: {
      attachments: [],
      formalDocuments: [],
      operations: [],
      quotes: [],
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
});
