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
        documents: [
          {
            approvalStatus: "not_required",
            createdAt: "2026-04-13T10:33:00.000Z",
            docType: "acceptance",
            id: "document-1",
            lifecycleStatus: "active",
            occurredAt: null,
            postingStatus: "not_required",
            submissionStatus: "submitted",
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
});
