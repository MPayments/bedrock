import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  COMMERCIAL_CORE_ACTOR_USER_ID,
  createCalculationFixture,
  createCommercialPartiesFixture,
  createFxQuoteFixture,
} from "../../../../../tests/integration/commercial-core/fixtures";

describe("calculations integration characterization", () => {
  it("creates a calculation snapshot from an fx quote and persists the financial lines", async () => {
    const fixture = await createCommercialPartiesFixture();
    const quote = await createFxQuoteFixture({
      dealId: randomUUID(),
      fromAmountMinor: 100000n,
      fromCurrencyId: fixture.currencies.usd.id,
      rateDen: 100n,
      rateNum: 91n,
      toAmountMinor: 91000n,
      toCurrencyId: fixture.currencies.eur.id,
    });

    const calculation = await createCalculationFixture({
      baseCurrencyId: fixture.currencies.eur.id,
      calculationCurrencyId: fixture.currencies.usd.id,
      fxQuoteId: quote.id,
      rateDen: quote.rateDen,
      rateNum: quote.rateNum,
    });

    expect(calculation.currentSnapshot.fxQuoteId).toBe(quote.id);
    expect(calculation.currentSnapshot.rateSource).toBe("fx_quote");
    expect(calculation.currentSnapshot.state).toBe("draft");
    expect(calculation.lines).toHaveLength(2);
    expect(calculation.lines.map((line) => line.kind)).toEqual([
      "fee_revenue",
      "spread_revenue",
    ]);
    expect(calculation.lines.map((line) => line.sourceKind)).toEqual([
      "manual",
      "manual",
    ]);
  });

  it("rejects mismatched fx quote provenance", async () => {
    const fixture = await createCommercialPartiesFixture();
    const quote = await createFxQuoteFixture({
      dealId: randomUUID(),
      fromAmountMinor: 100000n,
      fromCurrencyId: fixture.currencies.usd.id,
      rateDen: 100n,
      rateNum: 91n,
      toAmountMinor: 91000n,
      toCurrencyId: fixture.currencies.eur.id,
    });

    await expect(
      fixture.runtime.modules.calculations.calculations.commands.create({
        actorUserId: COMMERCIAL_CORE_ACTOR_USER_ID,
        agreementVersionId: null,
        agreementFeeBps: "150",
        agreementFeeAmountMinor: "1500",
        additionalExpensesAmountMinor: "0",
        additionalExpensesCurrencyId: null,
        additionalExpensesInBaseMinor: "0",
        additionalExpensesRateDen: null,
        additionalExpensesRateNum: null,
        additionalExpensesRateSource: null,
        baseCurrencyId: fixture.currencies.eur.id,
        calculationCurrencyId: fixture.currencies.usd.id,
        calculationTimestamp: new Date("2026-01-06T10:00:00.000Z"),
        fixedFeeAmountMinor: "0",
        fixedFeeCurrencyId: null,
        financialLines: [],
        fxQuoteId: quote.id,
        idempotencyKey: randomUUID(),
        originalAmountMinor: "100000",
        pricingProvenance: null,
        quoteMarkupAmountMinor: "0",
        quoteMarkupBps: "0",
        quoteSnapshot: { source: "phase-0-fixture" },
        rateDen: "100",
        rateNum: "92",
        rateSource: "fx_quote",
        referenceRateAsOf: null,
        referenceRateDen: null,
        referenceRateNum: null,
        referenceRateSource: null,
        totalFeeAmountInBaseMinor: "1500",
        totalFeeAmountMinor: "1500",
        totalFeeBps: "150",
        totalAmountMinor: "101500",
        totalInBaseMinor: "91500",
        totalWithExpensesInBaseMinor: "91500",
      }),
    ).rejects.toThrow(
      `FX quote ${quote.id} does not match the stored primary rate fields`,
    );
  });
});
