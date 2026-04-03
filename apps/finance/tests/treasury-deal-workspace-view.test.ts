import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FinanceDealWorkspaceView } from "@/features/treasury/deals/components/workspace-view";
import type { FinanceDealWorkspace } from "@/features/treasury/deals/lib/queries";

function createDeal(): FinanceDealWorkspace {
  return {
    acceptedQuote: {
      acceptedAt: "2026-04-02T08:15:00.000Z",
      expiresAt: "2026-04-02T09:15:00.000Z",
      quoteId: "a68fcc97-b77c-43b0-a323-45b6f783fd3a",
      quoteStatus: "active",
      usedAt: null,
    },
    acceptedQuoteDetails: {
      createdAt: "2026-04-02T08:10:00.000Z",
      dealDirection: "sell",
      dealForm: "spot",
      dealId: "614fb6eb-a1bd-429e-9628-e97d0f2efa0b",
      dealRef: null,
      expiresAt: "2026-04-02T09:15:00.000Z",
      fromAmount: "125000.00",
      fromAmountMinor: "12500000",
      fromCurrency: "USD",
      fromCurrencyId: "fdcf4040-4a4e-4c90-b550-6898ab3789f4",
      id: "a68fcc97-b77c-43b0-a323-45b6f783fd3a",
      idempotencyKey: "idem-accepted",
      pricingMode: "spot",
      pricingTrace: {},
      rateDen: "1",
      rateNum: "97.15",
      status: "active",
      toAmount: "12143750.00",
      toAmountMinor: "1214375000",
      toCurrency: "RUB",
      toCurrencyId: "45b2da57-4205-4607-a3ec-d0acbfb322ab",
      usedAt: null,
      usedByRef: null,
      usedDocumentId: null,
    },
    actions: {
      canCloseDeal: false,
      canCreateCalculation: true,
      canCreateQuote: true,
      canRequestExecution: false,
      canResolveExecutionBlocker: true,
      canUploadAttachment: true,
    },
    attachmentRequirements: [
      {
        blockingReasons: ["Required intake sections are incomplete"],
        code: "invoice",
        label: "Инвойс",
        state: "missing",
      },
    ],
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
    nextAction: "Create calculation from accepted quote",
    operationalState: {
      capabilities: [
        {
          applicantCounterpartyId: null,
          internalEntityOrganizationId: null,
          kind: "can_payout",
          note: null,
          reasonCode: "capability_missing",
          status: "pending",
          updatedAt: null,
          updatedByUserId: null,
        },
      ],
      positions: [
        {
          amountMinor: "12500000",
          kind: "provider_payable",
          reasonCode: "execution_pending",
          state: "blocked",
        },
      ],
    },
    pricing: {
      quoteEligibility: true,
      requestedAmount: "125000.00",
      requestedCurrencyId: "fdcf4040-4a4e-4c90-b550-6898ab3789f4",
      targetCurrencyId: "0f9d972c-b95b-4544-95d8-8ccdc7496ed8",
    },
    profitabilitySnapshot: null,
    queueContext: {
      blockers: [
        "Required intake sections are incomplete",
        "Required participant is unresolved: external_beneficiary",
      ],
      queue: "funding",
      queueReason: "Required intake sections are incomplete",
    },
    relatedResources: {
      attachments: [
        {
          createdAt: "2026-04-02T08:09:00.000Z",
          description: "Счет клиента",
          fileName: "invoice.pdf",
          fileSize: 1024,
          id: "a953dc34-6f54-4f77-a6e8-b9c10d718279",
          mimeType: "application/pdf",
          updatedAt: "2026-04-02T08:09:00.000Z",
          uploadedBy: "alexey",
          visibility: "internal",
        },
      ],
      formalDocuments: [],
      operations: [],
      quotes: [
        {
          expiresAt: "2026-04-02T09:15:00.000Z",
          id: "a68fcc97-b77c-43b0-a323-45b6f783fd3a",
          status: "active",
        },
      ],
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

describe("treasury deal workspace view", () => {
  it("renders an execution-first localized preview without raw technical details or action buttons", () => {
    (
      globalThis as typeof globalThis & {
        React: typeof React;
      }
    ).React = React;

    const markup = renderToStaticMarkup(
      createElement(FinanceDealWorkspaceView, {
        deal: createDeal(),
      }),
    );

    expect(markup).toContain("Платеж поставщику");
    expect(markup).toContain("Контур исполнения");
    expect(markup).toContain("Создать расчет по принятой котировке");
    expect(markup).toContain("Анкета заполнена не полностью.");
    expect(markup).toContain("Не заполнен обязательный участник: получатель выплаты.");
    expect(markup.indexOf("Контур исполнения")).toBeLessThan(
      markup.indexOf("Котировки и расчет"),
    );
    expect(markup).not.toContain("Required intake sections are incomplete");
    expect(markup).not.toContain("capability_missing");
    expect(markup).not.toContain("a68fcc97-b77c-43b0-a323-45b6f783fd3a");
    expect(markup).not.toContain("Запросить котировку");
  });
});
