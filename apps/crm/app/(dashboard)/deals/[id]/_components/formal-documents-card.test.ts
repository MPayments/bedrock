import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FormalDocumentsCard } from "./formal-documents-card";

function normalizeMarkupWhitespace(markup: string) {
  return markup.replace(/\s+/gu, " ").trim();
}

describe("FormalDocumentsCard", () => {
  it("separates requirements from created documents and localizes acceptance", () => {
    (
      globalThis as typeof globalThis & {
        React: typeof React;
      }
    ).React = React;

    const markup = renderToStaticMarkup(
      createElement(FormalDocumentsCard, {
        dealId: "00000000-0000-4000-8000-000000000001",
        documents: [
          {
            amount: null,
            approvalStatus: "not_required",
            createdAt: "2026-04-13T10:33:00.000Z",
            currency: null,
            docType: "acceptance",
            id: "document-1",
            lifecycleStatus: "active",
            postingStatus: "not_required",
            submissionStatus: "submitted",
            title: null,
          },
        ],
        requirements: [
          {
            activeDocumentId: "document-1",
            blockingReasons: [],
            createAllowed: false,
            docType: "acceptance",
            openAllowed: true,
            stage: "closing",
            state: "ready",
          },
        ],
      }),
    );

    const normalizedMarkup = normalizeMarkupWhitespace(markup);

    expect(normalizedMarkup).toContain("Требуемые документы");
    expect(normalizedMarkup).toContain("Созданные документы");
    expect(normalizedMarkup).toContain("Акт / подтверждение исполнения");
    expect(normalizedMarkup).not.toContain(">acceptance<");
  });

  it("does not render a create action when the requirement is missing but creation is disallowed", () => {
    (
      globalThis as typeof globalThis & {
        React: typeof React;
      }
    ).React = React;

    const markup = renderToStaticMarkup(
      createElement(FormalDocumentsCard, {
        dealId: "00000000-0000-4000-8000-000000000001",
        documents: [],
        requirements: [
          {
            activeDocumentId: null,
            blockingReasons: ["Формальный документ еще не создан"],
            createAllowed: false,
            docType: "invoice",
            openAllowed: false,
            stage: "opening",
            state: "missing",
          },
        ],
      }),
    );

    expect(normalizeMarkupWhitespace(markup)).not.toContain("Создать");
  });
});
