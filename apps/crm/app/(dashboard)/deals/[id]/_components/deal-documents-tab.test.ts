import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DealDocumentsTab } from "./deal-documents-tab";

function normalizeMarkupWhitespace(markup: string) {
  return markup.replace(/\s+/gu, " ").trim();
}

describe("DealDocumentsTab", () => {
  it("renders only formal documents", () => {
    (
      globalThis as typeof globalThis & {
        React: typeof React;
      }
    ).React = React;

    const markup = renderToStaticMarkup(
      createElement(DealDocumentsTab, {
        dealId: "00000000-0000-4000-8000-000000000001",
        documentRequirements: [],
        formalDocuments: [],
      }),
    );
    const normalizedMarkup = normalizeMarkupWhitespace(markup);

    expect(normalizedMarkup).toContain("Внутренние документы");
    expect(normalizedMarkup).not.toContain("Подтверждающие файлы");
    expect(normalizedMarkup).not.toContain("Файлы основания");
    expect(normalizedMarkup).not.toContain("Черновик получателя");
  });
});
