import * as React from "react";
import { createElement, createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PortalDealVisibility } from "@/components/portal/deal-visibility";
import type { PortalDealProjectionResponse } from "@/lib/portal-deals";

function normalizeMarkupWhitespace(markup: string) {
  return markup.replace(/\s+/gu, " ").trim();
}

describe("PortalDealVisibility", () => {
  it("renders deal status, calculation summary, files, and timeline", () => {
    (
      globalThis as typeof globalThis & {
        React: typeof React;
      }
    ).React = React;

    const markup = renderToStaticMarkup(
      createElement(PortalDealVisibility, {
        attachmentError: null,
        calculationError: null,
        data: {
          attachments: [
            {
              createdAt: "2026-04-14T10:12:00.000Z",
              fileName: "invoice.pdf",
              id: "attachment-1",
              ingestionStatus: "applied",
              purpose: "invoice",
            },
          ],
          calculationSummary: {
            additionalExpenses: "50.00",
            additionalExpensesCurrencyCode: "USD",
            agreementFeeAmount: "120.00",
            agreementFeePercentage: "1.50",
            baseCurrencyCode: "USD",
            calculationTimestamp: "2026-04-14T09:30:00.000Z",
            currencyCode: "AED",
            fixedFeeAmount: "0.00",
            fixedFeeCurrencyCode: null,
            id: "calculation-1",
            originalAmount: "14500.00",
            quoteMarkupAmount: "20.00",
            quoteMarkupPercentage: "0.25",
            rate: "0.272400",
            totalAmount: "14640.00",
            totalFeeAmount: "140.00",
            totalFeeAmountInBase: "140.00",
            totalFeePercentage: "1.75",
            totalInBase: "14590.00",
            totalWithExpensesInBase: "14640.00",
          },
          customerSafeIntake: {
            contractNumber: "WP-PO-2026-001",
            customerNote: "Срочная оплата",
            expectedAmount: "14500.00 AED",
            expectedCurrencyId: "AED",
            invoiceNumber: "WP-INV-2026-001",
            purpose: "Payment for invoice WP-INV-2026-001",
            requestedExecutionDate: "2026-04-18T00:00:00.000Z",
            sourceAmount: "14500.00 AED",
            sourceCurrencyId: "AED",
            targetCurrencyId: "USD",
          },
          nextAction: "Подтвердите расчет",
          quoteSummary: {
            expiresAt: "2026-04-15T10:00:00.000Z",
            quoteId: "quote-1",
            status: "active",
          },
          requiredActions: ["Подтвердить расчет"],
          submissionCompleteness: {
            blockingReasons: [],
            complete: true,
          },
          summary: {
            applicantDisplayName: "WHITE PRIDE LLC",
            createdAt: "2026-04-14T09:00:00.000Z",
            id: "deal-1",
            status: "awaiting_funds",
            type: "payment",
          },
          timeline: [
            {
              actor: {
                label: "finance",
                userId: "user-1",
              },
              id: "event-1",
              occurredAt: "2026-04-14T10:20:00.000Z",
              payload: {
                operationCount: 3,
              },
              type: "execution_requested",
              visibility: "customer_safe",
            },
          ],
        } satisfies PortalDealProjectionResponse,
        dealId: "deal-1",
        deletingAttachmentId: null,
        downloadingFormat: null,
        fileInputRef: createRef<HTMLInputElement>(),
        onAttachmentDelete: () => undefined,
        onAttachmentDownload: () => undefined,
        onAttachmentSelection: () => undefined,
        onBack: () => undefined,
        onDownload: () => undefined,
        onUploadPurposeChange: () => undefined,
        uploadPurpose: "invoice",
        uploadingAttachment: false,
      }),
    );

    const normalizedMarkup = normalizeMarkupWhitespace(markup);

    expect(normalizedMarkup).toContain("Сделка #DEAL");
    expect(normalizedMarkup).toContain("Ожидание средств");
    expect(normalizedMarkup).toContain("Расчет привязан к сделке");
    expect(normalizedMarkup).toContain("invoice.pdf");
    expect(normalizedMarkup).toContain("Данные учтены");
    expect(normalizedMarkup).toContain("Подтвердить расчет");
    expect(normalizedMarkup).toContain("Исполнение запрошено");
    expect(normalizedMarkup).toContain("Финальный курс клиента");
  });
});
