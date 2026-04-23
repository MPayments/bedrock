import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FinanceDealWorkspaceView } from "@/features/treasury/deals/components/workspace-view";
import type { FinanceDealWorkspace } from "@/features/treasury/deals/lib/queries";

function createDeal(): FinanceDealWorkspace {
  const fundingResolution = {
    availableMinor: null,
    fundingOrganizationId: "organization-1",
    fundingRequisiteId: null,
    reasonCode: "inventory_insufficient",
    requiredAmountMinor: "1214375000",
    state: "resolved" as const,
    strategy: "external_fx" as const,
    targetCurrency: "RUB",
    targetCurrencyId: "0f9d972c-b95b-4544-95d8-8ccdc7496ed8",
  };

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
      canRunReconciliation: true,
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
    cashflowSummary: {
      receivedIn: [],
      scheduledOut: [],
      settledOut: [],
    },
    closeReadiness: {
      blockers: [
        "Required intake sections are incomplete",
        "Required participant is unresolved: external_beneficiary",
      ],
      criteria: [
        {
          code: "operations_materialized",
          label: "Казначейские операции созданы для всех шагов",
          satisfied: false,
        },
        {
          code: "reconciliation_clear",
          label: "Сверка завершена без открытых исключений",
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
      planned: 1,
      prepared: 0,
      returnRequested: 0,
      returned: 0,
      settled: 0,
      submitted: 0,
      terminalOperations: 0,
      totalOperations: 1,
      voided: 0,
    },
    nextAction: "Create calculation from accepted quote",
    operationalState: {
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
      fundingMessage: "Требуется конвертация",
      fundingResolution,
      quoteAmount: "125000.00",
      quoteAmountSide: "target",
      quoteEligibility: true,
      routeAttachment: null,
      sourceCurrencyId: "fdcf4040-4a4e-4c90-b550-6898ab3789f4",
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
    reconciliationSummary: {
      ignoredExceptionCount: 0,
      lastActivityAt: null,
      openExceptionCount: 1,
      pendingOperationCount: 1,
      reconciledOperationCount: 0,
      requiredOperationCount: 1,
      resolvedExceptionCount: 0,
      state: "blocked",
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
      instructionArtifacts: [],
      operations: [],
      quotes: [
        {
          expiresAt: "2026-04-02T09:15:00.000Z",
          id: "a68fcc97-b77c-43b0-a323-45b6f783fd3a",
          status: "active",
        },
      ],
      reconciliationExceptions: [
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
        payload: {},
        type: "deal_created",
      },
    ],
  };
}

function normalizeMarkupWhitespace(markup: string) {
  return markup.replaceAll(/\u00a0|\u202f/gu, " ");
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

    const normalizedMarkup = normalizeMarkupWhitespace(markup);

    expect(normalizedMarkup).toContain("Платеж поставщику");
    expect(normalizedMarkup).toContain("Контур исполнения");
    expect(normalizedMarkup).toContain("Создать расчет по принятой котировке");
    expect(normalizedMarkup).toContain("Анкета заполнена не полностью.");
    expect(normalizedMarkup).toContain(
      "Не заполнен обязательный участник: получатель выплаты.",
    );
    expect(normalizedMarkup.indexOf("Контур исполнения")).toBeLessThan(
      normalizedMarkup.indexOf("Котировки и расчет"),
    );
    expect(normalizedMarkup).not.toContain("Required intake sections are incomplete");
    expect(normalizedMarkup).not.toContain("capability_missing");
    expect(normalizedMarkup).not.toContain("a68fcc97-b77c-43b0-a323-45b6f783fd3a");
    expect(normalizedMarkup).not.toContain("Запросить котировку");
    expect(normalizedMarkup).toContain("Расходы провайдера");
    expect(normalizedMarkup).toContain("Критерии закрытия");
    expect(normalizedMarkup).toContain("Сверка");
    expect(normalizedMarkup).toContain("Последнее исключение");
  });

  it("formats profitability snapshot amounts from minor units", () => {
    (
      globalThis as typeof globalThis & {
        React: typeof React;
      }
    ).React = React;

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
          amountMinor: "15000",
          currencyCode: "USD",
          currencyId: "fdcf4040-4a4e-4c90-b550-6898ab3789f4",
        },
      ],
      spreadRevenue: [],
      totalRevenue: [
        {
          amountMinor: "2551338",
          currencyCode: "RUB",
          currencyId: "fdcf4040-4a4e-4c90-b550-6898ab3789f4",
        },
      ],
    };

    const markup = renderToStaticMarkup(
      createElement(FinanceDealWorkspaceView, {
        deal,
      }),
    );
    const normalizedMarkup = normalizeMarkupWhitespace(markup);

    expect(normalizedMarkup).toContain("25 513,38 RUB");
    expect(normalizedMarkup).toContain("150 USD");
    expect(normalizedMarkup).not.toContain("2 551 338");
  });
});
