import { describe, expect, it } from "vitest";

import {
  buildDealInvoiceBillingSplit,
  resolveDealInvoiceBillingSelection,
} from "../src/documents/invoice-billing";

function makeQuoteDetails(input: {
  customerTotalMinor?: string;
  financialLines?: {
    amountMinor: string;
    bucket: string;
    currency: string;
    id?: string;
  }[];
  fromAmountMinor?: string;
}) {
  return {
    financialLines: input.financialLines ?? [],
    pricingTrace: input.customerTotalMinor
      ? {
          metadata: {
            crmPricingSnapshot: {
              profitability: {
                commercialDiscountMinor: "0",
                commercialRevenueMinor: "7637823",
                costPriceMinor: "1501362177",
                currency: "RUB",
                customerPrincipalMinor: input.customerTotalMinor,
                customerTotalMinor: input.customerTotalMinor,
                passThroughMinor: "0",
                profitMinor: "7637823",
                profitPercentOnCost: "0.51",
              },
            },
          },
        }
      : {},
    quote: {
      fromAmountMinor: input.fromAmountMinor ?? "1501362177",
      fromCurrency: "RUB",
      id: "quote-1",
    },
  };
}

describe("deal invoice billing", () => {
  it("uses accepted quote customer total instead of buy-side source amount", () => {
    const split = buildDealInvoiceBillingSplit({
      dealId: "deal-1",
      feeBillingMode: "included_in_principal_invoice",
      quoteDetails: makeQuoteDetails({
        customerTotalMinor: "1509000000",
        fromAmountMinor: "1501362177",
      }),
    });

    expect(split?.principal.amountMinor).toBe("1509000000");
    expect(split?.principal.invoicePurpose).toBe("combined");
  });

  it("subtracts explicit commercial fee from principal for split billing", () => {
    const split = buildDealInvoiceBillingSplit({
      dealId: "deal-1",
      feeBillingMode: "separate_fee_invoice",
      quoteDetails: makeQuoteDetails({
        customerTotalMinor: "1509000000",
        financialLines: [
          {
            amountMinor: "100000",
            bucket: "commercial_revenue",
            currency: "RUB",
          },
        ],
        fromAmountMinor: "1501362177",
      }),
    });

    expect(split?.principal.amountMinor).toBe("1508900000");
    expect(split?.agencyFee?.amountMinor).toBe("100000");
  });

  it("keeps legacy fallback when quote trace has no CRM pricing snapshot", () => {
    const split = buildDealInvoiceBillingSplit({
      dealId: "deal-1",
      feeBillingMode: "included_in_principal_invoice",
      quoteDetails: makeQuoteDetails({
        financialLines: [
          {
            amountMinor: "200000",
            bucket: "fee_revenue",
            currency: "RUB",
          },
        ],
        fromAmountMinor: "1501362177",
      }),
    });

    expect(split?.principal.amountMinor).toBe("1501562177");
  });

  it("resolves quote component ids for split invoice creation", () => {
    const selection = resolveDealInvoiceBillingSelection({
      dealId: "deal-1",
      invoicePurpose: "principal",
      quoteDetails: makeQuoteDetails({
        customerTotalMinor: "1509000000",
        financialLines: [
          {
            amountMinor: "100000",
            bucket: "commercial_revenue",
            currency: "RUB",
            id: "fee-line",
          },
          {
            amountMinor: "50000",
            bucket: "pass_through_reimbursement",
            currency: "RUB",
            id: "pass-through-line",
          },
        ],
      }),
    });

    expect(selection).toMatchObject({
      amountMinor: "1508900000",
      billingSetRef: "billing_set:deal-1:quote-1",
      currency: "RUB",
      invoicePurpose: "principal",
      quoteComponentIds: ["pass-through-line"],
    });
  });

  it("rejects agency fee invoice when no positive fee revenue exists", () => {
    expect(() =>
      resolveDealInvoiceBillingSelection({
        dealId: "deal-1",
        invoicePurpose: "agency_fee",
        quoteDetails: makeQuoteDetails({ customerTotalMinor: "1509000000" }),
      }),
    ).toThrow("Split fee invoice requires positive fee revenue lines");
  });

  it("rejects split invoice creation when fee revenue is in another currency", () => {
    expect(() =>
      resolveDealInvoiceBillingSelection({
        dealId: "deal-1",
        invoicePurpose: "principal",
        quoteDetails: makeQuoteDetails({
          customerTotalMinor: "1509000000",
          financialLines: [
            {
              amountMinor: "100000",
              bucket: "commercial_revenue",
              currency: "USD",
            },
          ],
        }),
      }),
    ).toThrow(
      "Split fee invoice requires all fee revenue lines to use the principal invoice currency",
    );
  });
});
