import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DealReconciliationExceptionsCard } from "./deal-reconciliation-exceptions-card";

function normalizeMarkupWhitespace(markup: string) {
  return markup.replace(/\s+/gu, " ").trim();
}

describe("DealReconciliationExceptionsCard", () => {
  it("renders blocking reconciliation exceptions", () => {
    (
      globalThis as typeof globalThis & {
        React: typeof React;
      }
    ).React = React;

    const markup = renderToStaticMarkup(
      createElement(DealReconciliationExceptionsCard, {
        reconciliationExceptions: [
          {
            actions: {
              adjustmentDocumentDocType: "acceptance",
              canIgnore: true,
            },
            blocking: true,
            createdAt: "2026-04-13T10:00:00.000Z",
            externalRecordId: "record-1",
            id: "exception-1",
            operationId: "operation-1",
            reasonCode: "amount_mismatch",
            resolvedAt: null,
            source: "provider_statement",
            state: "open",
          },
        ],
        reconciliationSummary: {
          ignoredExceptionCount: 0,
          lastActivityAt: "2026-04-13T10:05:00.000Z",
          openExceptionCount: 1,
          pendingOperationCount: 0,
          reconciledOperationCount: 1,
          requiredOperationCount: 1,
          resolvedExceptionCount: 0,
          state: "blocked",
        },
      }),
    );

    const normalizedMarkup = normalizeMarkupWhitespace(markup);

    expect(normalizedMarkup).toContain("Сверка и исключения");
    expect(normalizedMarkup).toContain("Есть исключения");
    expect(normalizedMarkup).toContain("amount_mismatch");
    expect(normalizedMarkup).toContain("Внешняя запись: record-1");
    expect(normalizedMarkup).toContain("сделка не считается готовой к закрытию");
  });
});
