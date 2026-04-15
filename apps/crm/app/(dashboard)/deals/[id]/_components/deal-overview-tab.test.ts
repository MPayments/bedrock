import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DealOverviewTab } from "./deal-overview-tab";
import type { ApiCrmDealWorkbenchProjection } from "./types";

vi.mock("./deal-info-card", () => ({
  DealInfoCard: () => null,
}));

vi.mock("./counterparty-card", () => ({
  CounterpartyCard: () => null,
}));

vi.mock("./organization-card", () => ({
  OrganizationCard: () => null,
}));

vi.mock("./organization-requisite-card", () => ({
  OrganizationRequisiteCard: () => null,
}));

function normalizeMarkupWhitespace(markup: string) {
  return markup.replace(/\s+/gu, " ").trim();
}

describe("DealOverviewTab", () => {
  it("renders the next action and top blockers for the CRM summary flow", () => {
    (
      globalThis as typeof globalThis & {
        React: typeof React;
      }
    ).React = React;

    const markup = renderToStaticMarkup(
      createElement(DealOverviewTab, {
        commentValue: "",
        currency: null,
        isEditingComment: false,
        isSavingComment: false,
        onCancelEdit: () => undefined,
        onCommentChange: () => undefined,
        onEditComment: () => undefined,
        onSaveComment: () => undefined,
        workbench: {
          context: {
            agreement: null,
            applicant: null,
            customer: null,
            internalEntity: null,
            internalEntityRequisite: null,
            internalEntityRequisiteProvider: null,
          },
          documentRequirements: [
            {
              activeDocumentId: null,
              blockingReasons: ["Нужно выпустить открывающий инвойс"],
              createAllowed: true,
              docType: "invoice",
              openAllowed: true,
              stage: "opening",
              state: "missing",
            },
          ],
          evidenceRequirements: [
            {
              blockingReasons: ["Нужно загрузить клиентский инвойс"],
              code: "invoice_attachment",
              label: "Инвойс клиента",
              state: "missing",
            },
          ],
          nextAction: "Resolve submission blockers",
          sectionCompleteness: [
            {
              blockingReasons: ["Заполните реквизиты бенефициара"],
              complete: false,
              sectionId: "externalBeneficiary",
            },
          ],
          summary: {
            applicantDisplayName: "WHITE PRIDE LLC",
            calculationId: null,
            createdAt: "2026-04-14T09:00:00.000Z",
            id: "deal-1",
            internalEntityDisplayName: "Multihansa",
            status: "quoted",
            type: "payment",
            updatedAt: "2026-04-14T09:10:00.000Z",
          },
          transitionReadiness: [
            {
              allowed: false,
              blockers: [
                {
                  code: "missing_documents",
                  message: "Complete required client documents before continuing",
                },
              ],
              targetStatus: "approved_for_execution",
            },
          ],
        } as unknown as ApiCrmDealWorkbenchProjection,
      }),
    );

    const normalizedMarkup = normalizeMarkupWhitespace(markup);

    expect(normalizedMarkup).toContain("Что нужно сделать сейчас");
    expect(normalizedMarkup).toContain("Resolve submission blockers");
    expect(normalizedMarkup).toContain("Заполните реквизиты бенефициара");
    expect(normalizedMarkup).toContain("Нужно загрузить клиентский инвойс");
    expect(normalizedMarkup).toContain("Нужно выпустить открывающий инвойс");
  });
});
