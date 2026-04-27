import { describe, expect, it } from "vitest";

import {
  canDealCreateFormalDocuments,
  canDealWriteTreasuryOrFormalDocuments,
} from "../../src";
import {
  DealPricingContextSchema,
  DealPricingPreviewSchema,
  DealTypeSchema,
  DealLegOperationKindSchema,
  PreviewDealPricingInputSchema,
  RequestDealExecutionInputSchema,
  UpdateDealPricingContextInputSchema,
  UpdateDealCommentInputSchema,
} from "../../src/contracts";

describe("deals contracts", () => {
  it("trims nullable deal comment updates", () => {
    const parsed = UpdateDealCommentInputSchema.parse({
      comment: "  test  ",
    });

    expect(parsed.comment).toBe("test");
  });

  it("accepts reserved canonical deal types in the enum", () => {
    expect(DealTypeSchema.safeParse("currency_exchange").success).toBe(true);
    expect(DealTypeSchema.safeParse("currency_transit").success).toBe(true);
    expect(DealTypeSchema.safeParse("exporter_settlement").success).toBe(true);
  });

  it("accepts empty or trimmed execution request comments", () => {
    expect(RequestDealExecutionInputSchema.parse({})).toEqual({
      comment: null,
    });
    expect(
      RequestDealExecutionInputSchema.parse({
        comment: "  materialize treasury ops  ",
      }),
    ).toEqual({
      comment: "materialize treasury ops",
    });
  });

  it("accepts treasury operation kinds linkable from deal legs", () => {
    expect(DealLegOperationKindSchema.safeParse("payin").success).toBe(true);
    expect(
      DealLegOperationKindSchema.safeParse("fx_conversion").success,
    ).toBe(true);
    expect(
      DealLegOperationKindSchema.safeParse("internal_treasury").success,
    ).toBe(false);
  });

  it("applies pricing context defaults for commercial draft fields", () => {
    const parsed = DealPricingContextSchema.parse({
      commercialDraft: {},
      fundingAdjustments: [],
      revision: 1,
      routeAttachment: null,
    });

    expect(parsed).toEqual({
      commercialDraft: {
        fixedFeeAmount: null,
        fixedFeeCurrency: null,
        quoteMarkupBps: null,
      },
      fundingAdjustments: [],
      revision: 1,
      routeAttachment: null,
    });
  });

  it("accepts signed funding adjustments and requires at least one pricing patch", () => {
    expect(
      UpdateDealPricingContextInputSchema.parse({
        expectedRevision: 2,
        fundingAdjustments: [
          {
            amountMinor: "-500",
            currencyId: "00000000-0000-4000-8000-000000000101",
            id: "00000000-0000-4000-8000-000000000201",
            kind: "manual_offset",
            label: "Treasury top-up",
          },
        ],
      }),
    ).toMatchObject({
      expectedRevision: 2,
      fundingAdjustments: [
        expect.objectContaining({
          amountMinor: "-500",
          kind: "manual_offset",
        }),
      ],
    });

    expect(
      UpdateDealPricingContextInputSchema.safeParse({
        expectedRevision: 2,
      }).success,
    ).toBe(false);
  });

  it("parses persisted deal pricing preview payloads", () => {
    const parsed = DealPricingPreviewSchema.parse({
      benchmarks: {
        client: {
          asOf: "2026-04-19T13:00:00.000Z",
          baseCurrency: "RUB",
          quoteCurrency: "USD",
          rateDen: "10000",
          rateNum: "127",
          sourceKind: "client",
          sourceLabel: "Курс клиенту",
        },
        cost: null,
        market: {
          asOf: "2026-04-19T13:00:00.000Z",
          baseCurrency: "RUB",
          quoteCurrency: "USD",
          rateDen: "78926300",
          rateNum: "1000000",
          sourceKind: "market",
          sourceLabel: "Рыночный курс",
        },
        pricingBase: "market_benchmark",
        routeBase: null,
      },
      formulaTrace: {
        sections: [
          {
            kind: "client_pricing",
            lines: [
              {
                currency: "USD",
                expression: "100.00 RUB / 78.74 = 1.27 USD",
                kind: "equation",
                label: "Цена клиенту",
                metadata: {},
                result: "1.27 USD",
              },
            ],
            title: "Цена клиенту",
          },
        ],
      },
      fundingSummary: {
        positions: [
          {
            adjustmentTotalMinor: "-100",
            currencyCode: "AED",
            currencyId: "00000000-0000-4000-8000-000000000101",
            netFundingNeedMinor: "5100",
            requiredMinor: "5000",
          },
        ],
      },
      pricingFingerprint: "fingerprint-1",
      pricingMode: "explicit_route",
      profitability: {
        commercialRevenueMinor: "250",
        costPriceMinor: "10000",
        currency: "RUB",
        customerPrincipalMinor: "10000",
        customerTotalMinor: "10000",
        passThroughMinor: "0",
        profitMinor: "250",
        profitPercentOnCost: "2.50",
      },
      quotePreview: {
        commercialTerms: null,
        dealDirection: null,
        dealForm: null,
        expiresAt: "2026-04-19T13:00:00.000Z",
        feeComponents: [],
        financialLines: [
          {
            id: "financial-line-1",
            amountMinor: "250",
            bucket: "provider_fee_expense",
            currency: "RUB",
            source: "manual",
          },
        ],
        fromAmount: "100.00",
        fromAmountMinor: "10000",
        fromCurrency: "RUB",
        legs: [],
        pricingMode: "explicit_route",
        pricingTrace: {},
        rateDen: "10000",
        rateNum: "127",
        toAmount: "1.27",
        toAmountMinor: "127",
        toCurrency: "USD",
      },
      routePreview: null,
    });

    expect(parsed.quotePreview.financialLines[0]).toMatchObject({
      amountMinor: "250",
      bucket: "provider_fee_expense",
    });
    expect(parsed.benchmarks.market.rateDen).toBe("78926300");
    expect(parsed.formulaTrace.sections[0]?.kind).toBe("client_pricing");
  });

  it("coerces pricing preview timestamps and requires positive amountMinor", () => {
    expect(
      PreviewDealPricingInputSchema.parse({
        amountMinor: "10000",
        amountSide: "source",
        asOf: "2026-04-19T13:00:00.000Z",
        expectedRevision: 3,
      }),
    ).toMatchObject({
      amountMinor: "10000",
      amountSide: "source",
      expectedRevision: 3,
    });

    expect(
      PreviewDealPricingInputSchema.safeParse({
        amountMinor: "0",
        amountSide: "source",
        asOf: "2026-04-19T13:00:00.000Z",
        expectedRevision: 3,
      }).success,
    ).toBe(false);
  });

  it("allows formal document creation only from preparing_documents onwards", () => {
    const allowedStatuses = [
      "preparing_documents",
      "awaiting_funds",
      "awaiting_payment",
      "closing_documents",
    ] as const;
    const deniedStatuses = [
      "draft",
      "submitted",
      "rejected",
      "done",
      "cancelled",
    ] as const;

    for (const status of allowedStatuses) {
      expect(
        canDealCreateFormalDocuments({
          status,
          type: "payment",
        }),
      ).toBe(true);
    }

    for (const status of deniedStatuses) {
      expect(
        canDealCreateFormalDocuments({
          status,
          type: "payment",
        }),
      ).toBe(false);
    }
  });

  it("keeps submitted deals writable for pricing while blocking formal document creation", () => {
    expect(
      canDealWriteTreasuryOrFormalDocuments({
        status: "submitted",
        type: "payment",
      }),
    ).toBe(true);
    expect(
      canDealCreateFormalDocuments({
        status: "submitted",
        type: "payment",
      }),
    ).toBe(false);
  });
});
