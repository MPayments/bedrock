import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BeneficiaryDraftCard } from "./beneficiary-draft-card";

function normalizeMarkupWhitespace(markup: string) {
  return markup.replace(/\s+/gu, " ").trim();
}

describe("BeneficiaryDraftCard", () => {
  it("renders beneficiary and bank country as flag with label", () => {
    (
      globalThis as typeof globalThis & {
        React: typeof React;
      }
    ).React = React;

    const markup = renderToStaticMarkup(
      createElement(BeneficiaryDraftCard, {
        beneficiaryDraft: {
          bankInstructionSnapshot: {
            accountNo: "123456789",
            bankAddress: null,
            bankCountry: "UAE",
            bankName: "EXI Bank",
            beneficiaryName: "Almutlaq Group for Industrial Investments",
            bic: null,
            iban: null,
            label: null,
            swift: "DUIBAEAD",
          },
          beneficiarySnapshot: {
            country: "UAE",
            displayName: null,
            inn: null,
            legalName: "Almutlaq Group for Industrial Investments",
          },
          fieldPresence: {
            bankInstructionFields: 3,
            beneficiaryFields: 2,
          },
          purpose: "invoice",
          sourceAttachmentId: "attachment-1",
        },
      }),
    );

    const normalizedMarkup = normalizeMarkupWhitespace(markup);

    expect(normalizedMarkup).toContain("🇦🇪 ОАЭ");
    expect(normalizedMarkup).not.toContain(">UAE<");
  });
});
