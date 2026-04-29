import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createEmptyCrmDealIntake } from "../../_components/deal-intake-form";
import { IntakeEditorCard } from "./intake-editor-card";

function normalizeMarkupWhitespace(markup: string) {
  return markup.replace(/\s+/gu, " ").trim();
}

describe("IntakeEditorCard", () => {
  it("renders foundation files inside the deal basis card", () => {
    (
      globalThis as typeof globalThis & {
        React: typeof React;
      }
    ).React = React;

    const markup = renderToStaticMarkup(
      createElement(IntakeEditorCard, {
        applicantRequisites: [],
        attachments: [],
        attachmentIngestions: [],
        counterparties: [],
        currencyOptions: [],
        deletingAttachmentId: null,
        intake: createEmptyCrmDealIntake({
          applicantCounterpartyId: null,
          type: "payment",
        }),
        isDirty: false,
        isSaving: false,
        onAttachmentDelete: () => undefined,
        onAttachmentDownload: () => undefined,
        onAttachmentReingest: () => undefined,
        onAttachmentUpload: () => undefined,
        onChange: () => undefined,
        onReset: () => undefined,
        onSave: () => undefined,
        readOnly: false,
        reingestingAttachmentId: null,
        sectionCompleteness: [],
      }),
    );
    const normalizedMarkup = normalizeMarkupWhitespace(markup);

    expect(normalizedMarkup).toContain("Основание сделки");
    expect(normalizedMarkup).toContain("Файлы основания");
    expect(normalizedMarkup).toContain(
      "Загрузите инвойс, договор или другой файл, связанный с основанием сделки.",
    );
    expect(normalizedMarkup).not.toContain("Подтверждающие файлы");
  });
});
