import { describe, expect, it } from "vitest";

import type { DocumentFormOptions } from "@bedrock/sdk-documents-form-ui/lib/form-options";

import type { ApiCrmDealWorkbenchProjection } from "@/app/(dashboard)/deals/[id]/_components/types";

import { buildCrmDealDocumentInitialPayload } from "./deal-prefill";

const formOptions = {
  currencies: [{ code: "RUB", id: "currency-rub", label: "RUB" }],
} as unknown as Pick<DocumentFormOptions, "currencies">;

function createWorkbench(
  overrides: Record<string, unknown> = {},
): ApiCrmDealWorkbenchProjection {
  return {
    acceptedQuote: {
      quoteId: "quote-1",
    },
    context: {
      applicant: { id: "counterparty-1" },
      customer: { customer: { id: "customer-1" } },
      internalEntity: { id: "org-1" },
      internalEntityRequisite: { id: "req-1" },
    },
    intake: {
      common: {
        applicantCounterpartyId: null,
      },
    },
    pricing: {
      currentCalculation: {
        currentSnapshot: {
          calculationCurrencyId: "currency-rub",
          totalAmountMinor: "24000000",
        },
      },
      quotes: [
        {
          fromCurrency: "RUB",
          id: "quote-1",
          profitability: {
            currency: "RUB",
            customerTotalMinor: "2414301254",
          },
        },
      ],
    },
    ...overrides,
  } as unknown as ApiCrmDealWorkbenchProjection;
}

describe("buildCrmDealDocumentInitialPayload", () => {
  it("prefills invoice amount from accepted quote customer total", () => {
    const payload = buildCrmDealDocumentInitialPayload(
      createWorkbench(),
      "invoice",
      formOptions,
    );

    expect(payload).toMatchObject({
      amount: "24143012.54",
      currency: "RUB",
    });
  });

  it("does not prefill invoice amount when no quote is accepted", () => {
    const payload = buildCrmDealDocumentInitialPayload(
      createWorkbench({
        acceptedQuote: null,
        pricing: {
          currentCalculation: {
            currentSnapshot: {
              calculationCurrencyId: "currency-rub",
              totalAmountMinor: "24000000",
            },
          },
          quotes: [],
        },
      }),
      "invoice",
      formOptions,
    );

    expect(payload).not.toHaveProperty("amount");
    expect(payload).not.toHaveProperty("currency");
  });

  it("does not fall back to calculation total when accepted quote pricing is unavailable", () => {
    const payload = buildCrmDealDocumentInitialPayload(
      createWorkbench({
        pricing: {
          currentCalculation: {
            currentSnapshot: {
              calculationCurrencyId: "currency-rub",
              totalAmountMinor: "24000000",
            },
          },
          quotes: [{ fromCurrency: "RUB", id: "quote-1", profitability: null }],
        },
      }),
      "invoice",
      formOptions,
    );

    expect(payload).not.toHaveProperty("amount");
    expect(payload).not.toHaveProperty("currency");
  });
});
