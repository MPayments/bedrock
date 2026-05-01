import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AttachmentsCard } from "./attachments-card";
import type { ApiAttachment, ApiDealAttachmentIngestion } from "./types";

function normalizeMarkupWhitespace(markup: string) {
  return markup.replace(/\s+/gu, " ").trim();
}

function createAttachment(
  overrides: Partial<ApiAttachment> = {},
): ApiAttachment {
  return {
    createdAt: "2026-04-29T10:00:00.000Z",
    description: null,
    fileName: "invoice.pdf",
    fileSize: 1024,
    id: "attachment-1",
    mimeType: "application/pdf",
    purpose: "invoice",
    updatedAt: "2026-04-29T10:00:00.000Z",
    uploadedBy: null,
    visibility: "internal",
    ...overrides,
  };
}

function createIngestion(
  status: ApiDealAttachmentIngestion["status"],
  overrides: Partial<ApiDealAttachmentIngestion> = {},
): ApiDealAttachmentIngestion {
  return {
    appliedFields: [],
    appliedRevision: null,
    attempts: 1,
    availableAt: "2026-04-29T10:00:00.000Z",
    errorCode: null,
    errorMessage: null,
    fileAssetId: "attachment-1",
    lastProcessedAt: null,
    normalizedPayload: null,
    observedRevision: 1,
    skippedFields: [],
    status,
    updatedAt: "2026-04-29T10:00:00.000Z",
    ...overrides,
  };
}

function renderCard(input: {
  attachment?: ApiAttachment;
  ingestion?: ApiDealAttachmentIngestion | null;
}) {
  (
    globalThis as typeof globalThis & {
      React: typeof React;
    }
  ).React = React;

  return normalizeMarkupWhitespace(
    renderToStaticMarkup(
      createElement(AttachmentsCard, {
        attachments: [input.attachment ?? createAttachment()],
        attachmentIngestions: input.ingestion ? [input.ingestion] : [],
        deletingAttachmentId: null,
        onDelete: () => undefined,
        onDownload: () => undefined,
        onReingest: () => undefined,
        onUpload: () => undefined,
        reingestingAttachmentId: null,
      }),
    ),
  );
}

describe("AttachmentsCard", () => {
  it("renders a spinner badge for pending ingestion", () => {
    const markup = renderCard({
      ingestion: createIngestion("pending"),
    });

    expect(markup).toContain("Ожидает распознавания");
    expect(markup).toContain("Loading");
  });

  it("renders a spinner badge for processing ingestion", () => {
    const markup = renderCard({
      ingestion: createIngestion("processing"),
    });

    expect(markup).toContain("Распознаётся");
    expect(markup).toContain("Loading");
  });

  it("does not render a spinner for terminal ingestion states", () => {
    const processedMarkup = renderCard({
      ingestion: createIngestion("processed", {
        appliedFields: ["intake.externalBeneficiary.beneficiarySnapshot"],
      }),
    });
    const failedMarkup = renderCard({
      ingestion: createIngestion("failed"),
    });

    expect(processedMarkup).toContain("Данные учтены");
    expect(processedMarkup).not.toContain("Loading");
    expect(failedMarkup).toContain("Ошибка распознавания");
    expect(failedMarkup).not.toContain("Loading");
  });

  it("shows a neutral status when eligible attachment was not ingested", () => {
    const markup = renderCard({
      ingestion: null,
    });

    expect(markup).toContain("Распознавание не запускалось");
    expect(markup).not.toContain("Loading");
  });
});
