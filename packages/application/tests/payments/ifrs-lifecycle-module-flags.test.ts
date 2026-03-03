import { describe, expect, it } from "vitest";

import { createIfrsDocumentModules } from "../../src/ifrs-documents";

const SIMPLE_IFRS_DOC_TYPES = [
  "intercompany_loan_drawdown",
  "intercompany_loan_repayment",
  "intercompany_interest_accrual",
  "intercompany_interest_settlement",
  "equity_contribution",
  "equity_distribution",
  "accrual_adjustment",
  "revaluation_adjustment",
  "impairment_adjustment",
  "closing_reclass",
  "period_close",
  "period_reopen",
] as const;

describe("ifrs lifecycle module flags", () => {
  it("uses explicit submit step for non-posting IFRS documents", () => {
    const modules = createIfrsDocumentModules({
      counterpartyAccountsService: {
        async resolveTransferBindings() {
          return [];
        },
      },
    });

    for (const docType of SIMPLE_IFRS_DOC_TYPES) {
      const module = modules.find((candidate) => candidate.docType === docType);
      expect(module).toBeDefined();
      expect(module?.postingRequired).toBe(false);
      expect(module?.allowDirectPostFromDraft).toBe(false);
    }
  });
});
